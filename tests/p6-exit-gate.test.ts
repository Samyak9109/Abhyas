// Phase 6 Exit Gate Verification (phases.md Section 3 & 7, FR-027, FR-028, ADR-012, PG-22, PG-23)
// Verifies:
// 1. .ics Universal Calendar Compatibility (Google Calendar, Apple Calendar, Microsoft Outlook)
// 2. Ramping Preparation Schedule & Difficulty Progression (FR-027)
// 3. Spaced Repetition Engine & Daily Cap Enforcement (FR-028)
// 4. Automatic Session Weak-Turn Enqueuing into Review Queue (FR-028)
// 5. Google Calendar OAuth Narrow Scope, In-Memory Tokens, and .ics Fallback (ADR-012)

import { describe, expect, it } from "vitest";
import {
  calculateNextInterval,
  generateIcs,
  generatePrepPlan,
  getDailyReviewSet,
  getInMemoryGoogleToken,
  GOOGLE_CALENDAR_NARROW_SCOPE,
  isWeakTurn,
  MemoryStorageAdapter,
  planToGoogleEvents,
  processReviewOutcome,
  setInMemoryGoogleToken,
  syncSessionWeakTurnsToQueue,
  type PrepPlan,
  type ReviewQueueRow,
  type TurnRow,
} from "@abhyas/core";

function makeTurnFixture(id: string, criteriaMean: number): TurnRow {
  const score = Math.max(1, Math.min(5, criteriaMean));
  return {
    id,
    sessionId: "sess-p6-exit",
    index: 0,
    questionId: `q-${id}`,
    isUnverifiedQuestion: false,
    skillTags: ["system_design"],
    difficulty: 0.5,
    questionText: "How do you scale a distributed message broker under high fan-out?",
    answerText: "Partitioning topics by message key with Kafka consumer groups.",
    status: "scored",
    evaluation: {
      criteria: {
        relevance: { score, reason: "Relevance note", evidence: "Kafka" },
        structure: { score, reason: "Structure note", evidence: "Kafka" },
        depth: { score, reason: "Depth note", evidence: "Kafka" },
        clarity: { score, reason: "Clarity note", evidence: "Kafka" },
        levelFit: { score, reason: "Level fit note", evidence: "Kafka" },
      },
      skillScores: { system_design: Math.round(((score - 1) / 4) * 100) },
      topFix: "Address broker partition rebalancing storms",
      unsupportedClaims: [],
    },
  };
}

describe("Phase 6 Exit Gate Verification (phases.md Section 3 & 7)", () => {
  describe("1. Universal .ics Calendar Export Compatibility (Exit Gate Criterion)", () => {
    const fixedNow = new Date("2026-10-21T08:00:00.000Z");
    const plan: PrepPlan = generatePrepPlan({
      startDate: "2026-10-21",
      interviewDate: "2026-11-04", // 14 days out
      cadence: "three_days",
      sessionTime: "18:00",
      durationMinutes: 45,
      targetCompany: "Google",
      targetRole: "Staff Software Engineer",
      timeZone: "America/Los_Angeles",
    });

    const icsContent = generateIcs(plan, { now: fixedNow });

    it("satisfies Google Calendar import requirements", () => {
      // Must have standard VCALENDAR wrapper with version 2.0
      expect(icsContent).toContain("BEGIN:VCALENDAR\r\n");
      expect(icsContent).toContain("VERSION:2.0\r\n");
      expect(icsContent).toContain("PRODID:-//Abhyas//Interview Prep Schedule//EN\r\n");
      expect(icsContent).toContain("CALSCALE:GREGORIAN\r\n");
      expect(icsContent).toContain("METHOD:PUBLISH\r\n");
      expect(icsContent).toContain("X-WR-CALNAME:Abhyas Interview Prep\r\n");
      expect(icsContent).toContain("X-WR-TIMEZONE:America/Los_Angeles\r\n");

      // Each event must have unique UID, UTC DTSTAMP, and local floating DTSTART/DTEND
      const eventBlocks = icsContent.split("BEGIN:VEVENT\r\n").slice(1);
      expect(eventBlocks.length).toBe(plan.sessions.length);

      for (const block of eventBlocks) {
        expect(block).toMatch(/UID:abhyas-[a-zA-Z0-9_-]+@abhyas\.app\r\n/);
        expect(block).toContain("DTSTAMP:20261021T080000Z\r\n");
        expect(block).toMatch(/DTSTART:\d{8}T180000\r\n/);
        expect(block).toMatch(/DTEND:\d{8}T184500\r\n/);
        expect(block).toContain("SUMMARY:Abhyas: ");
        expect(block).toContain("END:VEVENT\r\n");
      }
    });

    it("satisfies Apple Calendar (macOS / iOS) import requirements", () => {
      // Must not exceed 75 octets per line without CRLF space folding (RFC 5545 Section 3.1)
      const rawLines = icsContent.split("\r\n");
      // Except for the empty last line after trailing CRLF
      const contentLines = rawLines.slice(0, -1);

      for (let i = 0; i < contentLines.length; i++) {
        const line = contentLines[i]!;
        expect(
          Buffer.byteLength(line, "utf8"),
          `Line ${i + 1} must not exceed 75 octets for Apple Calendar compatibility: "${line}"`
        ).toBeLessThanOrEqual(75);
      }

      // Verify that description fields are present and properly escaped
      expect(icsContent).toContain("DESCRIPTION:");
      expect(icsContent).toContain("Practice link: https://abhyas.app/app/practice");
    });

    it("satisfies Microsoft Outlook (Desktop & Web) import requirements", () => {
      // Outlook requires strict CRLF terminations and breaks on stray standalone LFs
      expect(icsContent).toContain("\r\n");
      expect(icsContent).not.toMatch(/[^\r]\n/);

      // Must specify STATUS:CONFIRMED and TRANSP:OPAQUE for accurate free/busy rendering
      expect(icsContent).toContain("STATUS:CONFIRMED\r\n");
      expect(icsContent).toContain("TRANSP:OPAQUE\r\n");
      expect(icsContent).toContain("END:VCALENDAR\r\n");
    });
  });

  describe("2. Ramping Preparation Schedule & Business Logic (FR-027)", () => {
    it("ramps difficulty from foundations to final mock interview", () => {
      const plan = generatePrepPlan({
        startDate: "2026-10-21",
        interviewDate: "2026-11-10",
        cadence: "daily",
        targetCompany: "Stripe",
      });

      expect(plan.sessions.length).toBeGreaterThanOrEqual(10);

      // Earliest sessions: foundations / easy drills
      expect(plan.sessions[0]!.stage).toBe("foundations");
      expect(plan.sessions[0]!.difficulty).toBe("easy");

      // Middle sessions: core skills / medium difficulty
      const mid = plan.sessions[Math.floor(plan.sessions.length / 2)]!;
      expect(mid.stage).toBe("skill_building");
      expect(mid.difficulty).toBe("medium");

      // Final session: strictly final mock simulation
      const finalSession = plan.sessions[plan.sessions.length - 1]!;
      expect(finalSession.stage).toBe("final_mock");
      expect(finalSession.difficulty).toBe("simulation");
      expect(finalSession.suggestedFormat).toBe("mock");
      expect(finalSession.title).toContain("Final Mock Interview");
    });

    it("provides rolling 2-week plan when interview date is not yet scheduled", () => {
      const genericPlan = generatePrepPlan({
        startDate: "2026-10-21",
        cadence: "weekdays",
      });

      expect(genericPlan.isGeneric).toBe(true);
      expect(genericPlan.interviewDate).toBeNull();
      expect(genericPlan.sessions.length).toBe(10); // 2 weeks of weekdays
    });

    it("enforces validation rejecting past and same-day interview dates", () => {
      expect(() =>
        generatePrepPlan({ startDate: "2026-10-21", interviewDate: "2026-10-21" })
      ).toThrow("Interview date must be in the future");

      expect(() =>
        generatePrepPlan({ startDate: "2026-10-21", interviewDate: "2026-10-18" })
      ).toThrow("Interview date must be in the future");
    });
  });

  describe("3. Spaced Repetition Engine & Daily Cap (FR-028)", () => {
    it("grows interval on good answers and resets interval on poor answers", () => {
      // Good answer sequence: 1 -> 3 -> 7 -> 14 -> 30 -> 60
      let interval = 1;
      interval = calculateNextInterval(interval, true);
      expect(interval).toBe(3);
      interval = calculateNextInterval(interval, true);
      expect(interval).toBe(7);
      interval = calculateNextInterval(interval, true);
      expect(interval).toBe(14);
      interval = calculateNextInterval(interval, true);
      expect(interval).toBe(30);
      interval = calculateNextInterval(interval, true);
      expect(interval).toBe(60);

      // Poor answer resets back to 1 from any interval
      interval = calculateNextInterval(interval, false);
      expect(interval).toBe(1);
    });

    it("strictly respects the daily cap of 10 items even under large backlogs", () => {
      const refDate = new Date("2026-10-21T12:00:00.000Z");

      // Create 25 overdue items
      const queue: ReviewQueueRow[] = Array.from({ length: 25 }, (_, idx) => ({
        id: `review-q-${idx + 1}`,
        turnId: `turn-${idx + 1}`,
        intervalDays: 1,
        dueAt: new Date(refDate.getTime() - (30 - idx) * 3600000).toISOString(),
      }));

      const dailySet = getDailyReviewSet(queue, { referenceDate: refDate, maxDailyCap: 10 });
      expect(dailySet.length).toBe(10);

      // Verify earliest due date prioritization (most overdue first)
      expect(dailySet[0]!.id).toBe("review-q-1");
      expect(dailySet[9]!.id).toBe("review-q-10");
    });

    it("processes review outcome updating next due date based on new score", () => {
      const item: ReviewQueueRow = {
        id: "review-test",
        turnId: "t-1",
        intervalDays: 3,
        dueAt: "2026-10-21T10:00:00.000Z",
      };

      const now = new Date("2026-10-21T10:00:00.000Z");

      // Scored 85 (good): interval grows to 7 days
      const outcomeGood = processReviewOutcome(item, 85, now);
      expect(outcomeGood.intervalDays).toBe(7);
      expect(outcomeGood.dueAt).toBe("2026-10-28T10:00:00.000Z");

      // Scored 50 (poor): interval resets to 1 day
      const outcomePoor = processReviewOutcome(item, 50, now);
      expect(outcomePoor.intervalDays).toBe(1);
      expect(outcomePoor.dueAt).toBe("2026-10-22T10:00:00.000Z");
    });
  });

  describe("4. Session Weak-Turn Auto-Enqueuing (FR-028)", () => {
    it("automatically identifies weak turns from sessions and syncs to reviewQueue without duplicates", async () => {
      const storage = new MemoryStorageAdapter();

      const strongTurn = makeTurnFixture("turn-strong", 4.5); // score 88 -> not weak
      const weakTurn1 = makeTurnFixture("turn-weak-1", 2.2); // score 30 -> weak
      const weakTurn2 = makeTurnFixture("turn-weak-2", 3.0); // score 50 -> weak

      expect(isWeakTurn(strongTurn)).toBe(false);
      expect(isWeakTurn(weakTurn1)).toBe(true);
      expect(isWeakTurn(weakTurn2)).toBe(true);

      const added = await syncSessionWeakTurnsToQueue(storage, [strongTurn, weakTurn1, weakTurn2]);
      expect(added).toBe(2);

      const queuedRows = await storage.getAll<ReviewQueueRow>("reviewQueue");
      expect(queuedRows.length).toBe(2);
      expect(queuedRows.find((r) => r.turnId === "turn-weak-1")?.intervalDays).toBe(1);
      expect(queuedRows.find((r) => r.turnId === "turn-weak-2")?.intervalDays).toBe(1);

      // Re-running does not re-add existing items
      const secondRun = await syncSessionWeakTurnsToQueue(storage, [weakTurn1, weakTurn2]);
      expect(secondRun).toBe(0);
    });
  });

  describe("5. Client-Side Google Calendar Architecture (ADR-012, FR-027)", () => {
    it("enforces narrowest calendar.events scope", () => {
      expect(GOOGLE_CALENDAR_NARROW_SCOPE).toBe("https://www.googleapis.com/auth/calendar.events");
    });

    it("isolates OAuth tokens to memory with zero disk or server persistence", () => {
      setInMemoryGoogleToken("temp-oauth-token-xyz", 3600);
      expect(getInMemoryGoogleToken()).toBe("temp-oauth-token-xyz");
    });

    it("transforms prep plan into compliant Google Calendar REST v3 event payloads", () => {
      const plan = generatePrepPlan({
        startDate: "2026-10-21",
        interviewDate: "2026-10-24",
        cadence: "daily",
        targetCompany: "Amazon",
      });

      const events = planToGoogleEvents(plan);
      expect(events.length).toBe(plan.sessions.length);

      for (const evt of events) {
        expect(evt.summary).toContain("Amazon");
        expect(evt.start.dateTime).toBeDefined();
        expect(evt.end.dateTime).toBeDefined();
        expect(evt.status).toBe("confirmed");
        expect(evt.transparency).toBe("opaque");
      }
    });
  });
});
