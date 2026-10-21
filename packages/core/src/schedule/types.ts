// FR-027, ADR-012: Types for interview prep planning and calendar export.

export type PracticeCadence = "daily" | "weekdays" | "three_days" | "weekends";

export type PrepStage = "foundations" | "skill_building" | "deep_dive" | "final_mock" | "rest_prep";

export type DifficultyLevel = "easy" | "medium" | "hard" | "simulation";

export type SessionFormat = "drill" | "interview" | "mock";

export interface ScheduleOptions {
  /** Target interview date (YYYY-MM-DD). If omitted, a generic rolling plan is generated. */
  interviewDate?: string | null | undefined;
  /** Practice frequency (default: "three_days"). */
  cadence?: PracticeCadence | undefined;
  /** IANA time zone identifier (e.g. "America/New_York", "Asia/Kolkata"). */
  timeZone?: string | undefined;
  /** Default time of day for practice sessions (HH:MM in 24h format, default: "18:00"). */
  sessionTime?: string | undefined;
  /** Duration in minutes per practice session (default: 30). */
  durationMinutes?: number | undefined;
  /** Optional target company name for tailored event summaries. */
  targetCompany?: string | undefined;
  /** Optional target role for tailored event descriptions. */
  targetRole?: string | undefined;
  /** Reference start date for planning (default: current local date). */
  startDate?: string | Date | undefined;
}

export interface ScheduledSession {
  id: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:MM
  durationMinutes: number;
  title: string;
  description: string;
  stage: PrepStage;
  difficulty: DifficultyLevel;
  suggestedFormat: SessionFormat;
}

export interface PrepPlan {
  interviewDate: string | null;
  cadence: PracticeCadence;
  timeZone: string;
  sessionTime: string;
  durationMinutes: number;
  totalDays: number;
  sessions: ScheduledSession[];
  isGeneric: boolean;
}
