// FR-027, ADR-012: Client-side Google Calendar integration with in-memory token handling and .ics fallback.
import type { PrepPlan, ScheduledSession } from "./types.js";

/**
 * The narrowest workable OAuth scope for creating events without full calendar access (ADR-012).
 */
export const GOOGLE_CALENDAR_NARROW_SCOPE = "https://www.googleapis.com/auth/calendar.events";

export interface GoogleEventDateTime {
  dateTime?: string | undefined;
  date?: string | undefined;
  timeZone?: string | undefined;
}

export interface GoogleEventPayload {
  summary: string;
  description: string;
  start: GoogleEventDateTime;
  end: GoogleEventDateTime;
  status?: string | undefined;
  transparency?: "opaque" | "transparent" | undefined;
}

export interface GoogleCalendarEventResponse {
  id: string;
  htmlLink?: string | undefined;
  status: string;
}

export interface TimeSlot {
  start: string; // ISO string
  end: string; // ISO string
}

// In-memory token store: tokens are NEVER persisted to localStorage, IndexedDB, or server (ADR-012).
let inMemoryAccessToken: { token: string; expiresAt: number } | null = null;

export function setInMemoryGoogleToken(token: string, expiresInSeconds: number): void {
  inMemoryAccessToken = {
    token,
    expiresAt: Date.now() + expiresInSeconds * 1000,
  };
}

export function getInMemoryGoogleToken(): string | null {
  if (!inMemoryAccessToken) return null;
  if (Date.now() >= inMemoryAccessToken.expiresAt) {
    inMemoryAccessToken = null;
    return null;
  }
  return inMemoryAccessToken.token;
}

export function clearInMemoryGoogleToken(): void {
  inMemoryAccessToken = null;
}

/**
 * Transforms a ScheduledSession into a Google Calendar event payload.
 */
export function sessionToGoogleEvent(
  session: ScheduledSession,
  timeZone: string
): GoogleEventPayload {
  const [hStr, mStr] = session.startTime.split(":");
  const h = Number(hStr ?? "18");
  const m = Number(mStr ?? "00");

  const [yearStr, monthStr, dayStr] = session.date.split("-");
  const y = Number(yearStr);
  const mo = Number(monthStr ?? "1") - 1;
  const d = Number(dayStr ?? "1");

  const startDate = new Date(Date.UTC(y, mo, d, h, m, 0));
  const endDate = new Date(startDate.getTime() + session.durationMinutes * 60_000);

  const pad = (n: number) => String(n).padStart(2, "0");
  const formatIso = (date: Date) =>
    `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}T${pad(
      date.getUTCHours()
    )}:${pad(date.getUTCMinutes())}:00`;

  const startIso = formatIso(startDate);
  const endIso = formatIso(endDate);

  const description = [
    session.description,
    "",
    `Stage: ${session.stage.replace(/_/g, " ").toUpperCase()}`,
    `Format: ${session.suggestedFormat}`,
    `Difficulty: ${session.difficulty}`,
    `Duration: ${session.durationMinutes} min`,
    "Practice in Abhyas: https://abhyas.app/app/practice",
  ].join("\n");

  return {
    summary: `Abhyas: ${session.title}`,
    description,
    start: {
      dateTime: startIso,
      timeZone,
    },
    end: {
      dateTime: endIso,
      timeZone,
    },
    transparency: "opaque",
    status: "confirmed",
  };
}

/**
 * Converts an entire PrepPlan into an array of Google Calendar event payloads.
 */
export function planToGoogleEvents(plan: PrepPlan): GoogleEventPayload[] {
  return plan.sessions.map((session) => sessionToGoogleEvent(session, plan.timeZone));
}

/**
 * Dispatches an event payload to the Google Calendar v3 API using a client-side access token.
 */
export async function createGoogleCalendarEvent(
  token: string,
  event: GoogleEventPayload,
  fetchFn: typeof fetch = fetch
): Promise<GoogleCalendarEventResponse> {
  const response = await fetchFn(
    "https://www.googleapis.com/calendar/v3/calendars/primary/events",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(event),
    }
  );

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    throw new Error(
      `Google Calendar API error (${response.status}): ${errorBody || "Failed to create event"}`
    );
  }

  return (await response.json()) as GoogleCalendarEventResponse;
}

/**
 * Suggests free practice slots from candidate slots by filtering out busy intervals.
 */
export function suggestFreeSlots(
  busyIntervals: TimeSlot[],
  candidateSlots: TimeSlot[]
): TimeSlot[] {
  return candidateSlots.filter((candidate) => {
    const candStart = new Date(candidate.start).getTime();
    const candEnd = new Date(candidate.end).getTime();

    // Check overlap with any busy interval
    const hasOverlap = busyIntervals.some((busy) => {
      const busyStart = new Date(busy.start).getTime();
      const busyEnd = new Date(busy.end).getTime();
      return candStart < busyEnd && candEnd > busyStart;
    });

    return !hasOverlap;
  });
}
