import { describe, expect, it, vi } from "vitest";
import { generatePrepPlan } from "./generator.js";
import { escapeIcsText, foldIcsLine, generateIcs } from "./ics.js";

describe("generatePrepPlan", () => {
  const baseStartDate = "2026-10-21";

  it("throws when interviewDate is today or in the past", () => {
    expect(() =>
      generatePrepPlan({
        startDate: baseStartDate,
        interviewDate: "2026-10-21",
      })
    ).toThrow("Interview date must be in the future");

    expect(() =>
      generatePrepPlan({
        startDate: baseStartDate,
        interviewDate: "2026-10-15",
      })
    ).toThrow("Interview date must be in the future");
  });

  it("generates a generic 2-week rolling schedule when no date is provided", () => {
    const plan = generatePrepPlan({
      startDate: baseStartDate,
      cadence: "three_days",
    });

    expect(plan.isGeneric).toBe(true);
    expect(plan.interviewDate).toBeNull();
    expect(plan.cadence).toBe("three_days");
    expect(plan.sessions.length).toBeGreaterThanOrEqual(3);

    // Final session of the generic plan should still be a mock simulation
    const lastSession = plan.sessions[plan.sessions.length - 1]!;
    expect(lastSession.stage).toBe("final_mock");
    expect(lastSession.difficulty).toBe("simulation");
    expect(lastSession.suggestedFormat).toBe("mock");
  });

  it("ramps difficulty from foundations to final mock toward interview date", () => {
    const plan = generatePrepPlan({
      startDate: baseStartDate,
      interviewDate: "2026-11-15", // 25 days out
      cadence: "daily",
      targetCompany: "Acme Corp",
      targetRole: "Frontend Lead",
    });

    expect(plan.isGeneric).toBe(false);
    expect(plan.interviewDate).toBe("2026-11-15");
    expect(plan.totalDays).toBe(25);
    expect(plan.sessions.length).toBe(25);

    // First session: foundations & quick drills
    const firstSession = plan.sessions[0]!;
    expect(firstSession.stage).toBe("foundations");
    expect(firstSession.difficulty).toBe("easy");
    expect(firstSession.suggestedFormat).toBe("drill");
    expect(firstSession.title).toContain("Acme Corp");

    // Middle session: skill building / role practice
    const midSession = plan.sessions[10]!;
    expect(midSession.stage).toBe("skill_building");
    expect(midSession.difficulty).toBe("medium");

    // Late session: pressure / edge cases
    const lateSession = plan.sessions[20]!;
    expect(lateSession.stage).toBe("deep_dive");
    expect(lateSession.difficulty).toBe("hard");

    // Final session: mock interview
    const finalSession = plan.sessions[plan.sessions.length - 1]!;
    expect(finalSession.stage).toBe("final_mock");
    expect(finalSession.difficulty).toBe("simulation");
    expect(finalSession.suggestedFormat).toBe("mock");
    expect(finalSession.title).toContain("Final Mock Interview");
  });

  it("handles short notice (1 or 2 days away) without crashing", () => {
    const plan1 = generatePrepPlan({
      startDate: baseStartDate,
      interviewDate: "2026-10-22", // 1 day away
    });

    expect(plan1.sessions.length).toBe(1);
    expect(plan1.sessions[0]!.stage).toBe("final_mock");

    const plan2 = generatePrepPlan({
      startDate: baseStartDate,
      interviewDate: "2026-10-23", // 2 days away
      cadence: "weekends", // Even if weekends requested, short deadline adapts
    });

    expect(plan2.sessions.length).toBe(2);
    expect(plan2.sessions[1]!.stage).toBe("final_mock");
  });

  it("respects cadence filters (weekdays vs weekends)", () => {
    const weekdaysPlan = generatePrepPlan({
      startDate: "2026-10-19", // Monday
      interviewDate: "2026-10-26", // next Monday
      cadence: "weekdays",
    });

    // Mon, Tue, Wed, Thu, Fri = 5 days
    expect(weekdaysPlan.sessions.length).toBe(5);

    const weekendPlan = generatePrepPlan({
      startDate: "2026-10-19", // Monday
      interviewDate: "2026-10-26", // next Monday
      cadence: "weekends",
    });

    // Sat, Sun = 2 days
    expect(weekendPlan.sessions.length).toBe(2);
  });
});

describe("generateIcs serializer", () => {
  it("escapes special characters per RFC 5545", () => {
    expect(escapeIcsText("Hello, world; foo\\bar\nnext line")).toBe(
      "Hello\\, world\\; foo\\\\bar\\nnext line"
    );
  });

  it("folds long lines exceeding 75 octets with CRLF space", () => {
    const shortLine = "SUMMARY:Short line";
    expect(foldIcsLine(shortLine)).toBe(shortLine);

    const longLine =
      "DESCRIPTION:This is a very long text string that definitely exceeds seventy-five characters in length according to the RFC 5545 specifications.";
    const folded = foldIcsLine(longLine);
    expect(folded).toContain("\r\n ");
    const lines = folded.split("\r\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      expect(line.length).toBeLessThanOrEqual(75);
    }
  });

  it("produces RFC 5545 compliant VCALENDAR with CRLF line endings", () => {
    const plan = generatePrepPlan({
      startDate: "2026-10-21",
      interviewDate: "2026-10-25",
      cadence: "daily",
      targetCompany: "Google",
    });

    const fixedNow = new Date("2026-10-21T07:30:00.000Z");
    const ics = generateIcs(plan, { now: fixedNow });

    // Must use CRLF exclusively
    expect(ics).toContain("\r\n");
    expect(ics).not.toMatch(/[^\r]\n/);

    expect(ics).toContain("BEGIN:VCALENDAR\r\n");
    expect(ics).toContain("VERSION:2.0\r\n");
    expect(ics).toContain("PRODID:-//Abhyas//Interview Prep Schedule//EN\r\n");
    expect(ics).toContain("END:VCALENDAR\r\n");

    // All events present
    expect(ics).toContain("BEGIN:VEVENT\r\n");
    expect(ics).toContain("DTSTAMP:20261021T073000Z\r\n");
    expect(ics).toContain("STATUS:CONFIRMED\r\n");
    expect(ics).toContain("DTSTART:20261021T180000\r\n");
    expect(ics).toContain("DTEND:20261021T183000\r\n");

    // Number of VEVENTs equals number of sessions
    const eventMatches = ics.match(/BEGIN:VEVENT/g);
    expect(eventMatches?.length).toBe(plan.sessions.length);
  });

  it("handles midnight date rollover accurately in DTEND", () => {
    const basePlan = generatePrepPlan({
      startDate: "2026-10-21",
      interviewDate: "2026-11-01",
      targetRole: "Backend Engineer",
    });
    const plan = {
      ...basePlan,
      sessions: [
        {
          id: "late-session",
          date: "2026-10-26",
          startTime: "23:45",
          durationMinutes: 30,
          title: "Late Mock",
          stage: "skill_building" as const,
          suggestedFormat: "drill" as const,
          difficulty: "medium" as const,
          focusSkills: ["algorithms"],
          description: "Midnight crossing session",
        },
      ],
    };
    const ics = generateIcs(plan);
    expect(ics).toContain("DTSTART:20261026T234500");
    expect(ics).toContain("DTEND:20261027T001500");
  });
});

describe("M6.3 Google Calendar integration (FR-027, ADR-012)", () => {
  it("enforces narrow scope for calendar events", async () => {
    const { GOOGLE_CALENDAR_NARROW_SCOPE } = await import("./google-calendar.js");
    expect(GOOGLE_CALENDAR_NARROW_SCOPE).toBe("https://www.googleapis.com/auth/calendar.events");
  });

  it("keeps Google OAuth tokens strictly in memory with expiry", async () => {
    const { clearInMemoryGoogleToken, getInMemoryGoogleToken, setInMemoryGoogleToken } =
      await import("./google-calendar.js");

    clearInMemoryGoogleToken();
    expect(getInMemoryGoogleToken()).toBeNull();

    setInMemoryGoogleToken("mock-oauth-token-123", 3600);
    expect(getInMemoryGoogleToken()).toBe("mock-oauth-token-123");

    // Clear removes token
    clearInMemoryGoogleToken();
    expect(getInMemoryGoogleToken()).toBeNull();
  });

  it("converts plan sessions into Google Calendar payloads", async () => {
    const { planToGoogleEvents } = await import("./google-calendar.js");
    const plan = generatePrepPlan({
      startDate: "2026-10-21",
      interviewDate: "2026-10-25",
      cadence: "daily",
      sessionTime: "17:30",
      durationMinutes: 45,
      targetCompany: "Microsoft",
    });

    const events = planToGoogleEvents(plan);
    expect(events.length).toBe(plan.sessions.length);

    const firstEvent = events[0]!;
    expect(firstEvent.summary).toContain("Microsoft");
    expect(firstEvent.start.dateTime).toContain("17:30:00");
    expect(firstEvent.end.dateTime).toContain("18:15:00");
    expect(firstEvent.status).toBe("confirmed");
  });

  it("dispatches createGoogleCalendarEvent to Google v3 API with bearer token", async () => {
    const { createGoogleCalendarEvent, sessionToGoogleEvent } = await import(
      "./google-calendar.js"
    );
    const plan = generatePrepPlan({
      startDate: "2026-10-21",
      interviewDate: "2026-10-23",
      cadence: "daily",
    });

    const eventPayload = sessionToGoogleEvent(plan.sessions[0]!, plan.timeZone);

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: "gcal-evt-123",
        status: "confirmed",
        htmlLink: "https://calendar.google.com/event?eid=123",
      }),
    });

    const res = await createGoogleCalendarEvent(
      "token-abc",
      eventPayload,
      mockFetch as unknown as typeof fetch
    );
    expect(res.id).toBe("gcal-evt-123");
    expect(mockFetch).toHaveBeenCalledWith(
      "https://www.googleapis.com/calendar/v3/calendars/primary/events",
      expect.objectContaining({
        method: "POST",
        headers: {
          Authorization: "Bearer token-abc",
          "Content-Type": "application/json",
        },
      })
    );
  });

  it("suggests free slots by excluding busy intervals", async () => {
    const { suggestFreeSlots } = await import("./google-calendar.js");

    const busy = [
      {
        start: "2026-10-22T14:00:00.000Z",
        end: "2026-10-22T15:00:00.000Z",
      },
    ];

    const candidates = [
      {
        start: "2026-10-22T14:30:00.000Z", // overlaps with busy
        end: "2026-10-22T15:00:00.000Z",
      },
      {
        start: "2026-10-22T18:00:00.000Z", // free
        end: "2026-10-22T18:30:00.000Z",
      },
    ];

    const freeSlots = suggestFreeSlots(busy, candidates);
    expect(freeSlots.length).toBe(1);
    expect(freeSlots[0]!.start).toBe("2026-10-22T18:00:00.000Z");
  });
});
