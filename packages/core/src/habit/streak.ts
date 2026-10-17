// FR-018, architecture.md: Local habit, streak calculation, rest days, freezes, and time-zone resilience.
import type { SessionRow } from "../schemas/storage-rows.schema.js";
import type { StreakOptions, StreakState, WeeklyProgress } from "./types.js";

/**
 * Formats a Date or timestamp as a local calendar date string (YYYY-MM-DD).
 * When timeZone is provided, uses Intl.DateTimeFormat with en-CA formatting.
 */
export function formatLocalDate(date: Date | string | number, timeZone?: string): string {
  const d = typeof date === "object" ? date : new Date(date);
  if (isNaN(d.getTime())) return "";

  if (timeZone) {
    try {
      const formatter = new Intl.DateTimeFormat("en-CA", {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      });
      return formatter.format(d);
    } catch {
      // Fallback to local if invalid timeZone
    }
  }

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Returns the day of the week for a YYYY-MM-DD date string.
 * 0 = Sunday, 1 = Monday, ..., 6 = Saturday.
 */
export function getDayOfWeek(dateStr: string): number {
  const [year, month, day] = dateStr.split("-").map(Number);
  if (!year || !month || !day) return 0;
  const d = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  return d.getUTCDay();
}

/**
 * Shifts a YYYY-MM-DD calendar date string by a number of days (positive or negative)
 * using UTC midday arithmetic to prevent daylight saving boundary shifts.
 */
export function shiftDate(dateStr: string, daysOffset: number): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  if (!year || !month || !day) return dateStr;
  const d = new Date(Date.UTC(year, month - 1, day + daysOffset, 12, 0, 0));
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const da = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${da}`;
}

/**
 * Returns all 7 YYYY-MM-DD dates in the ISO calendar week (Monday to Sunday)
 * containing the reference date.
 */
export function getISOWeekDates(refDateStr: string): string[] {
  const day = getDayOfWeek(refDateStr);
  // ISO week: Mon=0 offset from Mon, Tue=1, ..., Sun=6
  const daysSinceMonday = day === 0 ? 6 : day - 1;
  const mondayStr = shiftDate(refDateStr, -daysSinceMonday);
  const weekDays: string[] = [];
  for (let i = 0; i < 7; i++) {
    weekDays.push(shiftDate(mondayStr, i));
  }
  return weekDays;
}

/**
 * Computes deterministic streak metrics from stored sessions.
 * Respects configured rest days (e.g. weekends) and protective freezes so
 * users aren't subjected to guilt-based resets.
 */
export function computeStreak(sessions: SessionRow[], options: StreakOptions = {}): StreakState {
  const referenceDate = options.referenceDate ?? new Date();
  const timeZone = options.timeZone;
  const restDays = options.restDays ?? [0, 6]; // Sunday (0) and Saturday (6) by default
  const weeklyTarget = options.weeklyTarget ?? 4;
  const maxFreezes = options.maxFreezes ?? 2;

  const todayStr = formatLocalDate(referenceDate, timeZone);

  // Filter valid sessions that had practice activity
  const validSessions = sessions.filter(
    (s) => s.status === "completed" || s.status === "active" || s.status === "abandoned"
  );

  // Collect unique local practice dates
  const practicedSet = new Set<string>();
  for (const s of validSessions) {
    const dStr = formatLocalDate(s.startedAt, timeZone);
    if (dStr) {
      practicedSet.add(dStr);
    }
  }

  const sortedDates = Array.from(practicedSet).sort();
  const lastPracticedDate = sortedDates.length > 0 ? sortedDates[sortedDates.length - 1]! : null;
  const earliestDate = sortedDates.length > 0 ? sortedDates[0]! : null;

  const todayPracticed = practicedSet.has(todayStr);

  // 1. Compute Weekly Progress
  const weekDates = getISOWeekDates(todayStr);
  const weekPracticedDays = weekDates.filter((d) => practicedSet.has(d));
  const weeklyProgress: WeeklyProgress = {
    target: weeklyTarget,
    completedDays: weekPracticedDays.length,
    daysPracticed: weekPracticedDays,
  };

  if (sortedDates.length === 0 || !earliestDate) {
    return {
      currentStreak: 0,
      longestStreak: 0,
      lastPracticedDate: null,
      todayPracticed: false,
      weeklyProgress,
      restDays,
      freezesAvailable: maxFreezes,
      freezesUsed: [],
      practicedDates: [],
    };
  }

  // 2. Compute Current Streak walking backwards from today
  let currentStreak = 0;
  const tentativeFreezesUsed: string[] = [];
  let reachedPracticedDay = false;

  // If today is practiced, current streak starts at 1
  let nextDateToCheck = todayStr;
  if (todayPracticed) {
    currentStreak += 1;
    nextDateToCheck = shiftDate(todayStr, -1);
    reachedPracticedDay = true;
  } else {
    // If today is not practiced, check from yesterday
    nextDateToCheck = shiftDate(todayStr, -1);
  }

  let curr = nextDateToCheck;
  // Safety bound: walk back up to 365 days
  let steps = 0;
  while (steps < 365 && curr >= earliestDate) {
    steps++;
    if (practicedSet.has(curr)) {
      currentStreak += 1;
      reachedPracticedDay = true;
      curr = shiftDate(curr, -1);
    } else if (restDays.includes(getDayOfWeek(curr))) {
      // Rest day: streak is preserved, do not increment practice count
      curr = shiftDate(curr, -1);
    } else if (tentativeFreezesUsed.length < maxFreezes) {
      // Unpracticed non-rest day: protect with a freeze
      tentativeFreezesUsed.push(curr);
      curr = shiftDate(curr, -1);
    } else {
      // Unpracticed non-rest day and no freezes remaining: streak broke
      break;
    }
  }

  // If we never actually connected to a practiced day (e.g. today was not practiced and
  // previous days were all missed until freezes ran out), streak is 0 and no freezes consumed.
  let freezesUsed: string[] = [];
  if (reachedPracticedDay) {
    freezesUsed = tentativeFreezesUsed;
  } else {
    currentStreak = 0;
    freezesUsed = [];
  }

  // 3. Compute Longest Streak across all history
  // Walk from earliest date to todayStr
  let longestStreak = currentStreak;
  let runningStreak = 0;
  let historicalFreezesLeft = maxFreezes;
  let currForward = earliestDate;

  while (currForward <= todayStr) {
    if (practicedSet.has(currForward)) {
      runningStreak += 1;
      if (runningStreak > longestStreak) {
        longestStreak = runningStreak;
      }
      currForward = shiftDate(currForward, 1);
    } else if (restDays.includes(getDayOfWeek(currForward))) {
      // Rest day preserves streak
      currForward = shiftDate(currForward, 1);
    } else if (historicalFreezesLeft > 0) {
      // Use freeze
      historicalFreezesLeft -= 1;
      currForward = shiftDate(currForward, 1);
    } else {
      // Streak breaks
      runningStreak = 0;
      historicalFreezesLeft = maxFreezes; // reset freeze pool for new run
      currForward = shiftDate(currForward, 1);
    }
  }

  return {
    currentStreak,
    longestStreak: Math.max(longestStreak, currentStreak),
    lastPracticedDate,
    todayPracticed,
    weeklyProgress,
    restDays,
    freezesAvailable: Math.max(0, maxFreezes - freezesUsed.length),
    freezesUsed,
    practicedDates: sortedDates,
  };
}
