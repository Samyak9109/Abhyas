// FR-N/A, NFR-011, ADR-021: Component gallery rendering all 14 primitives across Ink and Paper themes.
import { getContentInfo } from "@abhyas/content";
import { getCoreInfo } from "@abhyas/core";
import { useState } from "react";
import "./styles/tokens.css";
import "./styles/components.css";
import {
  Button,
  Input,
  SecretInput,
  Switch,
  RadioCard,
  Stepper,
  Callout,
  Dialog,
  Toast,
  Banner,
  Progress,
  Skeleton,
  Tabs,
  Disclosure,
} from "./components";

export function App() {
  const [theme, setTheme] = useState<"ink" | "paper">("ink");
  const [switchVal, setSwitchVal] = useState(false);
  const [selectedRadio, setSelectedRadio] = useState("gemini");
  const [activeTab, setActiveTab] = useState("tab1");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [showToast, setShowToast] = useState(false);

  const core = getCoreInfo();
  const content = getContentInfo();

  return (
    <div data-theme={theme} style={{ minHeight: "100vh", padding: "var(--space-8)" }}>
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "var(--space-8)",
        }}
      >
        <div>
          <h1
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "36px",
              margin: 0,
              color: "var(--text)",
            }}
          >
            Abhyas Design System
          </h1>
          <p style={{ color: "var(--text-muted)", margin: "var(--space-1) 0 0 0" }}>
            {core.name} v{core.version} | {content.name} v{content.version}
          </p>
        </div>
        <div style={{ display: "flex", gap: "var(--space-3)", alignItems: "center" }}>
          <Button
            variant="secondary"
            onClick={() => setTheme((t) => (t === "ink" ? "paper" : "ink"))}
          >
            Toggle Theme ({theme.toUpperCase()})
          </Button>
        </div>
      </header>

      {/* Banner */}
      <section style={{ marginBottom: "var(--space-6)" }}>
        <Banner
          message="System status: all foundational components operational"
          variant="info"
          action={
            <Button
              variant="ghost"
              style={{ padding: "0 var(--space-2)" }}
              onClick={() => setShowToast(true)}
            >
              Trigger Toast
            </Button>
          }
        />
      </section>

      {/* Stepper */}
      <section style={{ marginBottom: "var(--space-8)" }}>
        <Stepper
          currentStepIndex={1}
          steps={[
            { id: "s1", label: "Select Role" },
            { id: "s2", label: "AI Setup" },
            { id: "s3", label: "Practice" },
          ]}
        />
      </section>

      {/* Grid of Components */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: "var(--space-6)",
        }}
      >
        {/* Buttons */}
        <div
          style={{
            padding: "var(--space-6)",
            border: "1px solid var(--line)",
            backgroundColor: "var(--surface)",
          }}
        >
          <h2 style={{ fontFamily: "var(--font-mono)", fontSize: "16px", color: "var(--text)" }}>
            Buttons
          </h2>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "var(--space-3)",
              marginTop: "var(--space-4)",
            }}
          >
            <Button variant="primary">Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="danger">Danger</Button>
            <Button variant="primary" isLoading>
              Loading
            </Button>
            <Button variant="primary" disabled>
              Disabled
            </Button>
          </div>
        </div>

        {/* Inputs */}
        <div
          style={{
            padding: "var(--space-6)",
            border: "1px solid var(--line)",
            backgroundColor: "var(--surface)",
          }}
        >
          <h2 style={{ fontFamily: "var(--font-mono)", fontSize: "16px", color: "var(--text)" }}>
            Inputs & Secret
          </h2>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "var(--space-4)",
              marginTop: "var(--space-4)",
            }}
          >
            <Input
              label="Target Role"
              placeholder="e.g. SDE II"
              helperText="Your prospective job title"
            />
            <SecretInput
              label="API Key"
              placeholder="AIzaSy..."
              helperText="Key never leaves your browser"
            />
            <Input
              label="Error State"
              defaultValue="invalid"
              errorMessage="Field contains invalid character"
            />
          </div>
        </div>

        {/* Controls */}
        <div
          style={{
            padding: "var(--space-6)",
            border: "1px solid var(--line)",
            backgroundColor: "var(--surface)",
          }}
        >
          <h2 style={{ fontFamily: "var(--font-mono)", fontSize: "16px", color: "var(--text)" }}>
            Controls & Progress
          </h2>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "var(--space-4)",
              marginTop: "var(--space-4)",
            }}
          >
            <Switch label="Voice Input" checked={switchVal} onChange={setSwitchVal} />
            <Progress label="Interview Progress" value={65} />
            <Progress label="Evaluating STAR Response" />
            <div>
              <p
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "12px",
                  color: "var(--text-muted)",
                }}
              >
                Skeleton Loading:
              </p>
              <Skeleton height="32px" />
            </div>
          </div>
        </div>

        {/* Radio Cards */}
        <div
          style={{
            padding: "var(--space-6)",
            border: "1px solid var(--line)",
            backgroundColor: "var(--surface)",
          }}
        >
          <h2 style={{ fontFamily: "var(--font-mono)", fontSize: "16px", color: "var(--text)" }}>
            Radio Cards
          </h2>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "var(--space-3)",
              marginTop: "var(--space-4)",
            }}
          >
            <RadioCard
              title="Google Gemini"
              description="Direct browser calls to Gemini 2.5 Flash / Pro"
              monogram="G"
              checked={selectedRadio === "gemini"}
              onChange={() => setSelectedRadio("gemini")}
            />
            <RadioCard
              title="OpenAI Compatible"
              description="OpenAI, Groq, OpenRouter or local endpoints"
              monogram="O"
              checked={selectedRadio === "openai"}
              onChange={() => setSelectedRadio("openai")}
            />
            <RadioCard
              title="Ollama (Local)"
              description="Private offline models on your local machine"
              monogram="L"
              checked={false}
              comingSoon
            />
          </div>
        </div>
      </div>

      {/* Callouts & Disclosure */}
      <section style={{ marginTop: "var(--space-8)" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-6)" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
            <Callout variant="info" title="Privacy Guarantee">
              Keys and resumes are stored exclusively in your local browser IndexedDB.
            </Callout>
            <Callout variant="warning">
              Microphone permission is required for voice interview mode.
            </Callout>
          </div>
          <div>
            <Disclosure summary="Why is there zero server proxying?">
              Because Abhyas adheres to ADR-001 and ADR-002: your transcripts and keys go straight
              from your browser to your chosen AI provider without passing through any intermediate
              proxy.
            </Disclosure>
            <Disclosure summary="What are the approved typefaces?">
              Pixelify Sans (display), Instrument Sans (body), JetBrains Mono (labels/code), and
              Caveat (hand note).
            </Disclosure>
          </div>
        </div>
      </section>

      {/* Tabs */}
      <section style={{ marginTop: "var(--space-8)" }}>
        <Tabs
          selectedId={activeTab}
          onSelect={setActiveTab}
          items={[
            {
              id: "tab1",
              label: "Overview",
              content: <p>All components built strictly with semantic design tokens.</p>,
            },
            {
              id: "tab2",
              label: "Theme Contrast",
              content: <p>Both Ink and Paper themes verify WCAG 2.2 AA contrast requirements.</p>,
            },
          ]}
        />
      </section>

      {/* Modal Dialog Trigger */}
      <div style={{ marginTop: "var(--space-8)" }}>
        <Button variant="secondary" onClick={() => setIsDialogOpen(true)}>
          Open Confirmation Dialog
        </Button>
      </div>

      <Dialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        title="Delete Session History"
        actions={
          <>
            <Button variant="secondary" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={() => setIsDialogOpen(false)}>
              Confirm Delete
            </Button>
          </>
        }
      >
        Are you sure you want to delete all practice sessions? This action cannot be undone.
      </Dialog>

      {showToast && (
        <Toast message="Session saved to IndexedDB" onDismiss={() => setShowToast(false)} />
      )}
    </div>
  );
}
