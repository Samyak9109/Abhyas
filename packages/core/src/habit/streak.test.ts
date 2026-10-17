// FR-018: Habit, streak calculation, rest days, freezes, and time-zone resilience tests.
import { describe, expect, it } from "vitest";
import type { SessionRow, SkillStatRow } from "../schemas/storage-rows.schema.js";
import {
  computeStreak,
  formatLocalDate,
  getDayOfWeek,
  getISOWeekDates,
  shiftDate,
} from "./streak.js";
import { getDailyDrillRecommendation } from "./daily-drill.js";

function createMockSession(id: string, startedAtISO: string, isDrill = false): SessionRow {
  return {
    id,
    startedAt: startedAtISO,
    status: "completed",
    plan: {
      interviewType: "technical",
      length: 5,
      targetRole: "Software Engineer",
      isDrill,
    },
    modality: "text",
    level: "mid",
    providerId: "mock",
    modelId: "mock-model",
    schemaVersion: 1,
  };
}

describe("M2.6 Habit & Streak Engine (FR-018)", () => {
  describe("Date utilities & Time-zone resilience", () => {
    it("formats local dates consistently as YYYY-MM-DD", () => {
      const d = new Date("2026-10-17T14:30:00.000Z");
      expect(formatLocalDate(d)).toBe("2026-10-17");
    });

    it("handles time zone shifts across calendar dates", () => {
      // 2026-10-17 21:00:00 UTC is:
      // - 2026-10-17 in UTC and America/New_York
      // - 2026-10-18 in Asia/Kolkata (+05:30) and Asia/Tokyo (+09:00)
      const lateUTC = new Date("2026-10-17T21:00:00.000Z");

      expect(formatLocalDate(lateUTC, "UTC")).toBe("2026-10-17");
      expect(formatLocalDate(lateUTC, "America/New_York")).toBe("2026-10-17");
      expect(formatLocalDate(lateUTC, "Asia/Kolkata")).toBe("2026-10-18");
      expect(formatLocalDate(lateUTC, "Asia/Tokyo")).toBe("2026-10-18");
    });

    it("correctly computes day of week (0=Sunday, 6=Saturday)", () => {
      expect(getDayOfWeek("2026-10-17")).toBe(6); // Saturday
      expect(getDayOfWeek("2026-10-18")).toBe(0); // Sunday
      expect(getDayOfWeek("2026-10-19")).toBe(1); // Monday
      expect(getDayOfWeek("2026-10-23")).toBe(5); // Friday
    });

    it("shifts dates across month and leap year boundaries correctly", () => {
      expect(shiftDate("2026-10-17", -1)).toBe("2026-10-16");
      expect(shiftDate("2026-10-01", -1)).toBe("2026-09-30");
      expect(shiftDate("2026-01-01", -1)).toBe("2025-12-31");
      // Leap year 2024: Feb has 29 days
      expect(shiftDate("2024-03-01", -1)).toBe("2024-02-29");
      // Non-leap year 2026: Feb has 28 days
      expect(shiftDate("2026-03-01", -1)).toBe("2026-02-28");
    });

    it("returns 7 ISO week dates from Monday to Sunday", () => {
      // 2026-10-17 is Saturday
      const week = getISOWeekDates("2026-10-17");
      expect(week).toHaveLength(7);
      expect(week[0]).toBe("2026-10-12"); // Monday
      expect(week[6]).toBe("2026-10-18"); // Sunday
    });
  });

  describe("Streak calculation with Rest Days & Freezes", () => {
    it("returns zero streak and full freezes for new user with zero sessions", () => {
      const refDate = new Date("2026-10-17T12:00:00.000Z");
      const streak = computeStreak([], { referenceDate: refDate });

      expect(streak.currentStreak).toBe(0);
      expect(streak.longestStreak).toBe(0);
      expect(streak.todayPracticed).toBe(false);
      expect(streak.lastPracticedDate).toBeNull();
      expect(streak.freezesAvailable).toBe(2);
      expect(streak.freezesUsed).toHaveLength(0);
      expect(streak.weeklyProgress.completedDays).toBe(0);
      expect(streak.weeklyProgress.target).toBe(4);
    });

    it("computes streak = 1 when session completed today", () => {
      const refDate = new Date("2026-10-17T12:00:00.000Z");
      const sessions = [createMockSession("s1", "2026-10-17T10:00:00.000Z")];
      const streak = computeStreak(sessions, { referenceDate: refDate });

      expect(streak.currentStreak).toBe(1);
      expect(streak.longestStreak).toBe(1);
      expect(streak.todayPracticed).toBe(true);
      expect(streak.lastPracticedDate).toBe("2026-10-17");
      expect(streak.freezesAvailable).toBe(2);
    });

    it("computes streak across consecutive days", () => {
      const refDate = new Date("2026-10-17T12:00:00.000Z");
      const sessions = [
        createMockSession("s1", "2026-10-15T10:00:00.000Z"),
        createMockSession("s2", "2026-10-16T10:00:00.000Z"),
        createMockSession("s3", "2026-10-17T10:00:00.000Z"),
      ];
      const streak = computeStreak(sessions, { referenceDate: refDate });

      expect(streak.currentStreak).toBe(3);
      expect(streak.longestStreak).toBe(3);
      expect(streak.todayPracticed).toBe(true);
    });

    it("preserves streak across configured weekend rest days (Saturday & Sunday)", () => {
      // 2026-10-19 is Monday
      // User practiced Thursday (10-15) & Friday (10-16)
      // Sat (10-17) & Sun (10-18) were rest days
      // Monday (10-19) practiced today!
      const refDate = new Date("2026-10-19T12:00:00.000Z");
      const sessions = [
        createMockSession("s1", "2026-10-15T10:00:00.000Z"),
        createMockSession("s2", "2026-10-16T10:00:00.000Z"),
        createMockSession("s3", "2026-10-19T10:00:00.000Z"),
      ];
      const streak = computeStreak(sessions, {
        referenceDate: refDate,
        restDays: [0, 6], // Sunday & Saturday
      });

      // 3 practice days preserved across the weekend!
      expect(streak.currentStreak).toBe(3);
      expect(streak.freezesUsed).toHaveLength(0); // Zero freezes consumed!
    });

    it("protects missed weekday with an available freeze", () => {
      // 2026-10-16 is Friday
      // User practiced Wed (10-14), missed Thursday (10-15), practiced Friday (10-16)
      const refDate = new Date("2026-10-16T12:00:00.000Z");
      const sessions = [
        createMockSession("s1", "2026-10-14T10:00:00.000Z"),
        createMockSession("s2", "2026-10-16T10:00:00.000Z"),
      ];
      const streak = computeStreak(sessions, {
        referenceDate: refDate,
        maxFreezes: 2,
      });

      expect(streak.currentStreak).toBe(2);
      expect(streak.freezesUsed).toEqual(["2026-10-15"]);
      expect(streak.freezesAvailable).toBe(1);
    });

    it("breaks streak when unpracticed non-rest days exceed available freezes", () => {
      // 2026-10-16 is Friday
      // User practiced Monday (10-12), missed Tue (10-13), Wed (10-14), Thu (10-15), practiced Friday (10-16)
      // With maxFreezes = 2, Tue & Wed use freezes, but Thu breaks the streak!
      const refDate = new Date("2026-10-16T12:00:00.000Z");
      const sessions = [
        createMockSession("s1", "2026-10-12T10:00:00.000Z"),
        createMockSession("s2", "2026-10-16T10:00:00.000Z"),
      ];
      const streak = computeStreak(sessions, {
        referenceDate: refDate,
        maxFreezes: 2,
      });

      // Streak only counts today (Friday) because Thursday broke the chain
      expect(streak.currentStreak).toBe(1);
    });

    it("computes weekly progress correctly within current calendar week", () => {
      // 2026-10-17 is Saturday in week 2026-10-12 (Mon) to 2026-10-18 (Sun)
      const refDate = new Date("2026-10-17T12:00:00.000Z");
      const sessions = [
        createMockSession("s1", "2026-10-12T10:00:00.000Z"), // Mon (this week)
        createMockSession("s2", "2026-10-14T10:00:00.000Z"), // Wed (this week)
        createMockSession("s3", "2026-10-17T10:00:00.000Z"), // Sat (this week)
        createMockSession("s0", "2026-10-05T10:00:00.000Z"), // Prior week (ignored)
      ];
      const streak = computeStreak(sessions, {
        referenceDate: refDate,
        weeklyTarget: 4,
      });

      expect(streak.weeklyProgress.completedDays).toBe(3);
      expect(streak.weeklyProgress.target).toBe(4);
      expect(streak.weeklyProgress.daysPracticed).toEqual([
        "2026-10-12",
        "2026-10-14",
        "2026-10-17",
      ]);
    });
  });

  describe("Daily drill recommendation (FR-018)", () => {
    it("defaults to foundational skill for a new user without stats", () => {
      const drill = getDailyDrillRecommendation([], []);
      expect(drill.skillId).toBe("system_design");
      expect(drill.isCompletedToday).toBe(false);
      expect(drill.reason).toBe("foundational_default");
      expect(drill.score).toBeNull();
    });

    it("recommends the weakest calibrated skill with medium/high confidence", () => {
      const stats: SkillStatRow[] = [
        {
          skillId: "system_design",
          score: 85,
          n: 10,
          confidence: "high",
          lastPracticedAt: "2026-10-16T10:00:00.000Z",
          taxonomyVersion: 1,
        },
        {
          skillId: "dsa",
          score: 45,
          n: 5,
          confidence: "medium",
          lastPracticedAt: "2026-10-15T10:00:00.000Z",
          taxonomyVersion: 1,
        },
        {
          skillId: "behavioral",
          score: 30, // lower score, but low confidence (n=1)
          n: 1,
          confidence: "low",
          lastPracticedAt: "2026-10-14T10:00:00.000Z",
          taxonomyVersion: 1,
        },
      ];

      const drill = getDailyDrillRecommendation([], stats);
      // dsa has lowest score among calibrated (medium/high confidence) skills
      expect(drill.skillId).toBe("dsa");
      expect(drill.score).toBe(45);
      expect(drill.reason).toBe("weakest_calibrated");
      expect(drill.isCompletedToday).toBe(false);
    });

    it("detects if daily drill was already completed today", () => {
      const refDate = new Date("2026-10-17T15:00:00.000Z");
      const sessions = [
        createMockSession("s_drill_1", "2026-10-17T10:00:00.000Z", true), // drill today!
      ];

      const drill = getDailyDrillRecommendation(sessions, [], { referenceDate: refDate });
      expect(drill.isCompletedToday).toBe(true);
    });
  });
});
