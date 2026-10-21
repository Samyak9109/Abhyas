// FR-027, ADR-012, design.md 8 (PG-22): Interview Schedule and Preparation Plan screen.
// Manages target interview date, practice cadence, ramping difficulty preview,
// RFC 5545 .ics calendar export, and Google Calendar fallback.

import { useCallback, useEffect, useId, useMemo, useState } from "react";
import {
  generateIcs,
  generatePrepPlan,
  type PracticeCadence,
  type ScheduledSession,
  type SettingRow,
  type StorageAdapter,
} from "@abhyas/core";
import { Button, Callout, Input, RadioCard, Skeleton } from "../components";

interface SchedulePreferences {
  interviewDate: string | null;
  cadence: PracticeCadence;
  sessionTime: string;
  durationMinutes: number;
  targetCompany: string;
  targetRole: string;
}

const DEFAULT_PREFERENCES: SchedulePreferences = {
  interviewDate: null,
  cadence: "three_days",
  sessionTime: "18:00",
  durationMinutes: 30,
  targetCompany: "",
  targetRole: "",
};

interface ScheduleScreenProps {
  storage: StorageAdapter;
  onNavigatePractice?: () => void;
  onNavigateHome?: () => void;
}

function downloadIcsFile(icsContent: string, filename = "abhyas-interview-prep.ics"): void {
  const blob = new Blob([icsContent], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.style.display = "none";
  document.body.appendChild(a);
  try {
    a.click();
  } catch {
    // Graceful catch for test environments where jsdom does not implement anchor navigation
  }
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function ScheduleScreen({
  storage,
  onNavigatePractice,
  onNavigateHome,
}: ScheduleScreenProps) {
  const dateInputId = useId();
  const timeInputId = useId();
  const companyInputId = useId();
  const roleInputId = useId();

  const [loading, setLoading] = useState(true);
  const [preferences, setPreferences] = useState<SchedulePreferences>(DEFAULT_PREFERENCES);
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const [oauthState, setOauthState] = useState<"idle" | "connecting" | "denied">("idle");

  // Compute minimum selectable date (tomorrow)
  const minDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }, []);

  // Load preferences from storage
  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const row = await storage.get<SettingRow>("settings", "schedule_preferences");
        if (mounted && row?.value && typeof row.value === "object") {
          setPreferences({
            ...DEFAULT_PREFERENCES,
            ...(row.value as Partial<SchedulePreferences>),
          });
        }
      } catch {
        // Fall back to default
      } finally {
        if (mounted) setLoading(false);
      }
    }
    void load();
    return () => {
      mounted = false;
    };
  }, [storage]);

  // Persist preferences
  const updatePreferences = useCallback(
    (patch: Partial<SchedulePreferences>) => {
      setPreferences((prev) => {
        const next = { ...prev, ...patch };
        void storage.put("settings", {
          key: "schedule_preferences",
          value: next,
        });
        return next;
      });
      setDownloadSuccess(false);
    },
    [storage]
  );

  // Calculate prep plan and derive validation error cleanly without setting state during render
  const { plan, dateError } = useMemo(() => {
    try {
      const p = generatePrepPlan({
        interviewDate: preferences.interviewDate,
        cadence: preferences.cadence,
        sessionTime: preferences.sessionTime,
        durationMinutes: preferences.durationMinutes,
        targetCompany: preferences.targetCompany,
        targetRole: preferences.targetRole,
      });
      return { plan: p, dateError: null };
    } catch (err) {
      const fallbackPlan = generatePrepPlan({
        interviewDate: null,
        cadence: preferences.cadence,
        sessionTime: preferences.sessionTime,
        durationMinutes: preferences.durationMinutes,
        targetCompany: preferences.targetCompany,
        targetRole: preferences.targetRole,
      });
      return {
        plan: fallbackPlan,
        dateError: err instanceof Error ? err.message : "Invalid date",
      };
    }
  }, [preferences]);

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    updatePreferences({ interviewDate: val ? val : null });
  };

  const handleCadenceChange = (cadence: PracticeCadence) => {
    updatePreferences({ cadence });
  };

  const handleExportIcs = () => {
    const icsContent = generateIcs(plan);
    const filename = preferences.targetCompany
      ? `abhyas-${preferences.targetCompany.toLowerCase().replace(/[^a-z0-9]/g, "-")}-prep.ics`
      : "abhyas-interview-prep.ics";
    downloadIcsFile(icsContent, filename);
    setDownloadSuccess(true);
  };

  const handleConnectGoogleCalendar = () => {
    setOauthState("connecting");
    // Client-side OAuth simulation / verification fallback per ADR-012
    setTimeout(() => {
      // Per ADR-012: In the absence of an approved Google API Client ID,
      // fail gracefully with clear explanation and 1-click .ics fallback.
      setOauthState("denied");
    }, 400);
  };

  if (loading) {
    return (
      <div className="abh-schedule-screen" role="status" aria-label="Loading schedule">
        <Skeleton height="36px" />
        <Skeleton height="140px" />
        <Skeleton height="200px" />
      </div>
    );
  }

  return (
    <div className="abh-schedule-screen">
      <header className="abh-schedule-header">
        <div className="abh-schedule-title-row">
          <div>
            <h1 className="abh-schedule-title">Interview Schedule & Prep Plan</h1>
            <p className="abh-schedule-subtitle">
              Tie practice to your real interview date or establish a consistent preparation
              cadence.
            </p>
          </div>
          {onNavigateHome && (
            <Button variant="ghost" onClick={onNavigateHome}>
              ← Back to Home
            </Button>
          )}
        </div>
      </header>

      {/* Preferences Form */}
      <section className="abh-schedule-section" aria-labelledby="schedule-config-title">
        <h2 id="schedule-config-title" className="abh-section-heading">
          Schedule Configuration
        </h2>

        <div className="abh-schedule-form-grid">
          <div className="abh-field">
            <label htmlFor={dateInputId} className="abh-label">
              Target Interview Date
            </label>
            <div className="abh-input-with-action">
              <input
                id={dateInputId}
                type="date"
                min={minDate}
                value={preferences.interviewDate ?? ""}
                onChange={handleDateChange}
                className="abh-input"
                aria-describedby={dateError ? "schedule-date-error" : undefined}
              />
              {preferences.interviewDate && (
                <Button
                  variant="ghost"
                  onClick={() => updatePreferences({ interviewDate: null })}
                  aria-label="Clear interview date"
                >
                  Clear (Rolling mode)
                </Button>
              )}
            </div>
            {dateError && (
              <p id="schedule-date-error" className="abh-field-error" role="alert">
                {dateError}
              </p>
            )}
            <p className="abh-field-hint">
              {preferences.interviewDate
                ? `Plan will ramp up to your interview on ${preferences.interviewDate}.`
                : "No date set: showing a generic 2-week rolling preparation plan."}
            </p>
          </div>

          <div className="abh-field">
            <label htmlFor={timeInputId} className="abh-label">
              Daily Practice Time
            </label>
            <input
              id={timeInputId}
              type="time"
              value={preferences.sessionTime}
              onChange={(e) => updatePreferences({ sessionTime: e.target.value || "18:00" })}
              className="abh-input"
            />
            <p className="abh-field-hint">Calendar events will be scheduled at this local time.</p>
          </div>

          <div className="abh-field">
            <Input
              id={companyInputId}
              label="Target Company (Optional)"
              placeholder="e.g. Google, Stripe, Microsoft"
              value={preferences.targetCompany}
              onChange={(e) => updatePreferences({ targetCompany: e.target.value })}
            />
          </div>

          <div className="abh-field">
            <Input
              id={roleInputId}
              label="Target Role (Optional)"
              placeholder="e.g. Senior Software Engineer"
              value={preferences.targetRole}
              onChange={(e) => updatePreferences({ targetRole: e.target.value })}
            />
          </div>
        </div>

        {/* Cadence Selection */}
        <fieldset className="abh-schedule-cadence-group">
          <legend className="abh-label">Practice Cadence</legend>
          <div className="abh-cadence-grid">
            <RadioCard
              monogram="3D"
              checked={preferences.cadence === "three_days"}
              onChange={() => handleCadenceChange("three_days")}
              title="3 Days / Week (Recommended)"
              description="Mon, Wed, Fri practice sessions with built-in rest and review days."
            />
            <RadioCard
              monogram="WD"
              checked={preferences.cadence === "weekdays"}
              onChange={() => handleCadenceChange("weekdays")}
              title="Weekdays"
              description="Monday through Friday active practice with weekends reserved for rest."
            />
            <RadioCard
              monogram="1D"
              checked={preferences.cadence === "daily"}
              onChange={() => handleCadenceChange("daily")}
              title="Daily Sprint"
              description="Practice every day leading up to the interview for maximum immersion."
            />
            <RadioCard
              monogram="WE"
              checked={preferences.cadence === "weekends"}
              onChange={() => handleCadenceChange("weekends")}
              title="Weekends Only"
              description="Saturday and Sunday focused sessions for busy work schedules."
            />
          </div>
        </fieldset>
      </section>

      {/* Plan Summary Banner */}
      <section className="abh-schedule-section" aria-labelledby="schedule-plan-title">
        <div className="abh-schedule-plan-header">
          <div>
            <h2 id="schedule-plan-title" className="abh-section-heading">
              Generated Preparation Plan
            </h2>
            <p className="abh-schedule-plan-stats">
              {plan.isGeneric ? (
                <span>Rolling 2-Week Plan • {plan.sessions.length} sessions</span>
              ) : (
                <span>
                  {plan.totalDays} days remaining • {plan.sessions.length} sessions scheduled •
                  Difficulty ramps to Final Mock
                </span>
              )}
            </p>
          </div>

          <div className="abh-schedule-export-actions">
            <Button variant="primary" onClick={handleExportIcs}>
              📅 Export .ics Calendar
            </Button>
            <Button
              variant="secondary"
              onClick={handleConnectGoogleCalendar}
              disabled={oauthState === "connecting"}
            >
              {oauthState === "connecting" ? "Connecting…" : "Connect Google Calendar"}
            </Button>
          </div>
        </div>

        {downloadSuccess && (
          <div className="abh-schedule-notice" role="status">
            <Callout variant="info" title="Calendar File Exported">
              Your <code>.ics</code> calendar file has been downloaded. You can import it into
              Google Calendar, Apple Calendar, or Microsoft Outlook to sync all reminders.
            </Callout>
          </div>
        )}

        {oauthState === "denied" && (
          <div className="abh-schedule-notice" role="alert">
            <Callout variant="warning" title="Google OAuth Unavailable">
              Direct Google Calendar sync requires Google OAuth verification (ADR-012). To schedule
              practice immediately without third-party account permissions, use the{" "}
              <strong>Export .ics Calendar</strong> button above.
            </Callout>
          </div>
        )}

        {/* Sessions Timeline */}
        <div className="abh-schedule-timeline">
          {plan.sessions.map((session, index) => (
            <SessionCard
              key={session.id}
              session={session}
              isFinal={index === plan.sessions.length - 1}
              onPractice={onNavigatePractice}
            />
          ))}
        </div>
      </section>
    </div>
  );
}

interface SessionCardProps {
  session: ScheduledSession;
  isFinal: boolean;
  onPractice?: (() => void) | undefined;
}

function SessionCard({ session, isFinal, onPractice }: SessionCardProps) {
  const stageBadges: Record<ScheduledSession["stage"], { label: string; className: string }> = {
    foundations: { label: "Foundations", className: "abh-stage-badge--foundations" },
    skill_building: { label: "Core Skills", className: "abh-stage-badge--building" },
    deep_dive: { label: "Edge Cases", className: "abh-stage-badge--deep" },
    final_mock: { label: "Final Mock", className: "abh-stage-badge--mock" },
    rest_prep: { label: "Rest & Review", className: "abh-stage-badge--rest" },
  };

  const badge = stageBadges[session.stage];

  return (
    <article
      className={`abh-session-card ${isFinal ? "abh-session-card--final" : ""}`}
      aria-label={`${session.title} on ${session.date}`}
    >
      <div className="abh-session-card-left">
        <time className="abh-session-date" dateTime={session.date}>
          {session.date}
        </time>
        <span className="abh-session-time">{session.startTime}</span>
        <span className="abh-session-duration">{session.durationMinutes}m</span>
      </div>

      <div className="abh-session-card-body">
        <div className="abh-session-card-top">
          <span className={`abh-stage-badge ${badge.className}`}>{badge.label}</span>
          <span className="abh-difficulty-badge">Difficulty: {session.difficulty}</span>
          <span className="abh-format-badge">Format: {session.suggestedFormat}</span>
        </div>
        <h3 className="abh-session-card-title">{session.title}</h3>
        <p className="abh-session-card-desc">{session.description}</p>
      </div>

      <div className="abh-session-card-actions">
        {onPractice && (
          <Button variant="ghost" onClick={onPractice}>
            Practice now →
          </Button>
        )}
      </div>
    </article>
  );
}
