// FR-027, ADR-012: RFC 5545 compliant iCalendar (.ics) serializer.
import type { PrepPlan } from "./types.js";

/**
 * Escapes characters in text strings per RFC 5545 section 3.3.11:
 * backslash, semicolon, comma, and newline.
 */
export function escapeIcsText(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/**
 * Folds lines longer than 75 octets by inserting CRLF followed by a single whitespace (RFC 5545 Section 3.1).
 */
export function foldIcsLine(line: string): string {
  const MAX_LINE_LENGTH = 75;
  if (line.length <= MAX_LINE_LENGTH) return line;

  let result = "";
  let remaining = line;

  // First chunk up to 75
  result += remaining.slice(0, MAX_LINE_LENGTH);
  remaining = remaining.slice(MAX_LINE_LENGTH);

  // Subsequent chunks up to 74 (with leading space = 75)
  while (remaining.length > 0) {
    result += "\r\n ";
    result += remaining.slice(0, 74);
    remaining = remaining.slice(74);
  }

  return result;
}

function formatUtcTimestamp(date: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    date.getUTCFullYear() +
    pad(date.getUTCMonth() + 1) +
    pad(date.getUTCDate()) +
    "T" +
    pad(date.getUTCHours()) +
    pad(date.getUTCMinutes()) +
    pad(date.getUTCSeconds()) +
    "Z"
  );
}

function calculateSessionTimes(
  dateStr: string,
  timeStr: string,
  durationMinutes: number
): { dtstart: string; dtend: string } {
  const [yStr, moStr, dStr] = dateStr.split("-");
  const [hStr, mStr] = timeStr.split(":");
  const y = Number(yStr);
  const mo = Number(moStr ?? "1") - 1;
  const d = Number(dStr ?? "1");
  const h = Number(hStr ?? "18");
  const m = Number(mStr ?? "00");

  const startDate = new Date(Date.UTC(y, mo, d, h, m, 0));
  const endDate = new Date(startDate.getTime() + durationMinutes * 60_000);

  const pad = (n: number) => String(n).padStart(2, "0");
  const formatLocal = (date: Date) =>
    `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}T${pad(
      date.getUTCHours()
    )}${pad(date.getUTCMinutes())}00`;

  return { dtstart: formatLocal(startDate), dtend: formatLocal(endDate) };
}

/**
 * Serializes a PrepPlan into a valid RFC 5545 .ics string.
 * Uses CRLF line endings, proper line folding, and universal floating timestamps.
 */
export function generateIcs(plan: PrepPlan, options: { prodId?: string; now?: Date } = {}): string {
  const prodId = options.prodId ?? "-//Abhyas//Interview Prep Schedule//EN";
  const dtstamp = formatUtcTimestamp(options.now ?? new Date());

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:${prodId}`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:Abhyas Interview Prep`,
    `X-WR-TIMEZONE:${plan.timeZone}`,
  ];

  for (const session of plan.sessions) {
    const { dtstart, dtend } = calculateSessionTimes(
      session.date,
      session.startTime,
      session.durationMinutes
    );

    const summary = `Abhyas: ${session.title}`;
    const description = [
      session.description,
      "",
      `Stage: ${session.stage.replace(/_/g, " ").toUpperCase()}`,
      `Format: ${session.suggestedFormat}`,
      `Difficulty: ${session.difficulty}`,
      `Duration: ${session.durationMinutes} min`,
      "Practice link: https://abhyas.app/app/practice",
    ].join("\n");

    lines.push(
      "BEGIN:VEVENT",
      `UID:abhyas-${session.id}@abhyas.app`,
      `DTSTAMP:${dtstamp}`,
      `DTSTART:${dtstart}`,
      `DTEND:${dtend}`,
      `SUMMARY:${escapeIcsText(summary)}`,
      `DESCRIPTION:${escapeIcsText(description)}`,
      "STATUS:CONFIRMED",
      "TRANSP:OPAQUE",
      "END:VEVENT"
    );
  }

  lines.push("END:VCALENDAR");

  // Apply line folding and CRLF line terminator
  return lines.map((l) => foldIcsLine(l)).join("\r\n") + "\r\n";
}
