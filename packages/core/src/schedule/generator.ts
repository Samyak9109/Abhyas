// FR-027, ADR-012: Interview preparation schedule generator with ramping difficulty.
import { formatLocalDate, getDayOfWeek, shiftDate } from "../habit/streak.js";
import type {
  DifficultyLevel,
  PracticeCadence,
  PrepPlan,
  PrepStage,
  ScheduleOptions,
  ScheduledSession,
  SessionFormat,
} from "./types.js";

function diffInDays(startStr: string, endStr: string): number {
  const [y1, m1, d1] = startStr.split("-").map(Number);
  const [y2, m2, d2] = endStr.split("-").map(Number);
  const t1 = Date.UTC(y1!, m1! - 1, d1!);
  const t2 = Date.UTC(y2!, m2! - 1, d2!);
  return Math.round((t2 - t1) / (1000 * 60 * 60 * 24));
}

function matchesCadence(dayOfWeek: number, cadence: PracticeCadence): boolean {
  switch (cadence) {
    case "daily":
      return true;
    case "weekdays":
      return dayOfWeek >= 1 && dayOfWeek <= 5;
    case "three_days":
      // Mon (1), Wed (3), Fri (5)
      return dayOfWeek === 1 || dayOfWeek === 3 || dayOfWeek === 5;
    case "weekends":
      // Sun (0) or Sat (6)
      return dayOfWeek === 0 || dayOfWeek === 6;
  }
}

interface RampedProfile {
  stage: PrepStage;
  difficulty: DifficultyLevel;
  suggestedFormat: SessionFormat;
  title: string;
  description: string;
}

function getRampedSessionProfile(
  index: number,
  total: number,
  company?: string,
  role?: string
): RampedProfile {
  const entity = company ? `for ${company}` : role ? `for ${role}` : "Practice";
  // The very last session is always the final mock
  if (index === total - 1 && total > 1) {
    return {
      stage: "final_mock",
      difficulty: "simulation",
      suggestedFormat: "mock",
      title: `Final Mock Interview ${entity}`,
      description: `Comprehensive mock interview simulation under real conditions with full scorecard evaluation.`,
    };
  }

  if (total === 1) {
    return {
      stage: "final_mock",
      difficulty: "simulation",
      suggestedFormat: "mock",
      title: `Final Mock Interview ${entity}`,
      description: `Comprehensive mock interview simulation under real conditions.`,
    };
  }

  const ratio = index / Math.max(total - 1, 1);

  if (ratio < 0.3) {
    return {
      stage: "foundations",
      difficulty: "easy",
      suggestedFormat: "drill",
      title: `Foundations & Quick Drills ${entity}`,
      description: `Warmup drills focusing on foundational structure, concise responses, and confidence.`,
    };
  }

  if (ratio < 0.7) {
    return {
      stage: "skill_building",
      difficulty: "medium",
      suggestedFormat: "interview",
      title: `Core Skills & Role Practice ${entity}`,
      description: `In-depth behavioral and technical questions aligned with role competencies.`,
    };
  }

  return {
    stage: "deep_dive",
    difficulty: "hard",
    suggestedFormat: "drill",
    title: `Pressure Scenarios & Edge Cases ${entity}`,
    description: `High-pressure follow-ups, challenging scenarios, and targeted remediation of weak areas.`,
  };
}

/**
 * Generates an interview preparation plan with difficulty ramping toward the interview date.
 * If no interview date is provided, generates a generic 2-week rolling schedule (FR-027 empty state).
 */
export function generatePrepPlan(options: ScheduleOptions = {}): PrepPlan {
  const timeZone = options.timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone ?? "UTC";
  const cadence: PracticeCadence = options.cadence ?? "three_days";
  const sessionTime = options.sessionTime ?? "18:00";
  const durationMinutes = options.durationMinutes ?? 30;
  const company = options.targetCompany?.trim();
  const role = options.targetRole?.trim();

  const startDateStr = options.startDate
    ? typeof options.startDate === "string"
      ? options.startDate
      : formatLocalDate(options.startDate, timeZone)
    : formatLocalDate(new Date(), timeZone);

  // If no date provided, generate generic rolling 2-week plan (FR-027 empty state)
  if (!options.interviewDate) {
    const totalDays = 14;
    const sessionDates: string[] = [];

    for (let i = 0; i < totalDays; i++) {
      const date = shiftDate(startDateStr, i);
      const dow = getDayOfWeek(date);
      if (matchesCadence(dow, cadence)) {
        sessionDates.push(date);
      }
    }

    // Ensure at least 3 sessions in generic plan
    if (sessionDates.length === 0) {
      sessionDates.push(
        shiftDate(startDateStr, 1),
        shiftDate(startDateStr, 3),
        shiftDate(startDateStr, 5)
      );
    }

    const sessions: ScheduledSession[] = sessionDates.map((date, idx) => {
      const profile = getRampedSessionProfile(idx, sessionDates.length, company, role);
      return {
        id: `plan-generic-${idx + 1}`,
        date,
        startTime: sessionTime,
        durationMinutes,
        title: profile.title,
        description: profile.description,
        stage: profile.stage,
        difficulty: profile.difficulty,
        suggestedFormat: profile.suggestedFormat,
      };
    });

    return {
      interviewDate: null,
      cadence,
      timeZone,
      sessionTime,
      durationMinutes,
      totalDays,
      sessions,
      isGeneric: true,
    };
  }

  // Interview date provided: validate it is strictly in the future
  const interviewDate = options.interviewDate.trim();
  const daysUntil = diffInDays(startDateStr, interviewDate);

  if (daysUntil <= 0) {
    throw new Error("Interview date must be in the future");
  }

  // Available prep days: from today (or tomorrow if today is past sessionTime) up to the day before interview
  const sessionDates: string[] = [];
  for (let i = 0; i < daysUntil; i++) {
    const date = shiftDate(startDateStr, i);
    const dow = getDayOfWeek(date);
    if (matchesCadence(dow, cadence)) {
      sessionDates.push(date);
    }
  }

  // If strict cadence yielded no slots (e.g. interview is in 2 days and user picked weekends),
  // adapt cadence so candidate still gets prep before the interview
  if (sessionDates.length === 0) {
    for (let i = 0; i < daysUntil; i++) {
      sessionDates.push(shiftDate(startDateStr, i));
    }
  }

  const sessions: ScheduledSession[] = sessionDates.map((date, idx) => {
    const profile = getRampedSessionProfile(idx, sessionDates.length, company, role);
    return {
      id: `plan-${idx + 1}-${date}`,
      date,
      startTime: sessionTime,
      durationMinutes,
      title: profile.title,
      description: profile.description,
      stage: profile.stage,
      difficulty: profile.difficulty,
      suggestedFormat: profile.suggestedFormat,
    };
  });

  return {
    interviewDate,
    cadence,
    timeZone,
    sessionTime,
    durationMinutes,
    totalDays: daysUntil,
    sessions,
    isGeneric: false,
  };
}
