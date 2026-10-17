// FR-018: Habit, streak, and daily drill types.

export interface WeeklyProgress {
  target: number; // e.g. 4 days/week
  completedDays: number; // e.g. 3
  daysPracticed: string[]; // YYYY-MM-DD
}

export interface StreakState {
  currentStreak: number;
  longestStreak: number;
  lastPracticedDate: string | null; // YYYY-MM-DD
  todayPracticed: boolean;
  weeklyProgress: WeeklyProgress;
  restDays: number[]; // 0 = Sunday, 6 = Saturday (e.g. [0, 6])
  freezesAvailable: number; // e.g. 2 per month
  freezesUsed: string[]; // YYYY-MM-DD dates that consumed a freeze
  practicedDates: string[]; // sorted ascending YYYY-MM-DD
}

export interface StreakOptions {
  referenceDate?: Date | undefined;
  timeZone?: string | undefined;
  restDays?: number[] | undefined; // default: [0, 6] (weekends)
  weeklyTarget?: number | undefined; // default: 4 days/week
  maxFreezes?: number | undefined; // default: 2
}

export interface DailyDrillRecommendation {
  skillId: string;
  isCompletedToday: boolean;
  reason: "weakest_calibrated" | "uncalibrated_focus" | "foundational_default";
  score: number | null;
}
