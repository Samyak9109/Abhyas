// FR-002, FR-003, FR-004, PG-10: Profile and documents screen (Step 2 of 3).
// Handles resume upload (PDF/DOCX/TXT in a worker), JD paste with budget note,
// experience level selection, role-only mode, and structured profile extraction.
import React, { useEffect, useRef, useState } from "react";
import {
  computeSha256,
  extractProfile,
  type DocumentRow,
  type ExperienceLevel,
  type ProfileRow,
  type StorageAdapter,
  type StructuredProfile,
  type StructuredProfileRow,
} from "@abhyas/core";
import { BrandMark, Button, Callout, Input, Progress, RadioCard, Stepper, Switch } from "../components";
import { parseDocument } from "../services/document-parser";

interface ProfileScreenProps {
  storage: StorageAdapter;
  onComplete: () => void;
  onBack: () => void;
  onNavigateSettings?: () => void;
}

const SETUP_STEPS = [
  { id: "ai", label: "AI Setup" },
  { id: "profile", label: "Profile" },
  { id: "session", label: "Session" },
];

const EXPERIENCE_LEVELS: {
  id: ExperienceLevel;
  label: string;
  monogram: string;
  description: string;
}[] = [
  {
    id: "intern_fresher",
    label: "Intern / Fresher",
    monogram: "L1",
    description: "Students, new graduates, or early transitions into engineering",
  },
  {
    id: "junior",
    label: "Junior (1–3 yrs)",
    monogram: "L2",
    description: "Foundational project experience, implementing guided features",
  },
  {
    id: "mid",
    label: "Mid-level (3–5 yrs)",
    monogram: "L3",
    description: "Independent contributor owning complex features and services",
  },
  {
    id: "senior",
    label: "Senior (5–8 yrs)",
    monogram: "L4",
    description: "Experienced lead driving system architecture, standards, and mentorship",
  },
  {
    id: "staff_plus",
    label: "Staff+ (8+ yrs)",
    monogram: "L5",
    description: "Principal engineer or leader setting strategic technical direction",
  },
];

const MAX_JD_CHARS = 8000;

export function ProfileScreen({
  storage,
  onComplete,
  onBack,
  onNavigateSettings,
}: ProfileScreenProps) {
  // Form state
  const [level, setLevel] = useState<ExperienceLevel>("mid");
  const [targetRole, setTargetRole] = useState("Frontend Engineer");
  const [roleOnly, setRoleOnly] = useState(false);
  const [resumeText, setResumeText] = useState("");
  const [jdText, setJdText] = useState("");
  const [resumeMode, setResumeMode] = useState<"upload" | "paste">("upload");

  // Ingestion states
  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [isScanned, setIsScanned] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Analysis / Structured Profile state
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractedProfile, setExtractedProfile] = useState<StructuredProfile | null>(null);
  const [skills, setSkills] = useState<string[]>([]);
  const [gaps, setGaps] = useState<string[]>([]);
  const [quantifiedClaims, setQuantifiedClaims] = useState<string[]>([]);
  const [newSkillText, setNewSkillText] = useState("");

  // Validation & Saving
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Load existing profile & documents on mount
  useEffect(() => {
    let mounted = true;

    async function loadInitial() {
      try {
        const profiles = await storage.getAll<ProfileRow>("profile");
        if (profiles.length > 0 && mounted) {
          const current = profiles[0]!;
          if (current.level) setLevel(current.level as ExperienceLevel);
          if (current.targetRole) setTargetRole(current.targetRole);
        }

        const docs = await storage.getAll<DocumentRow>("documents");
        if (mounted) {
          const rDoc = docs.find((d) => d.kind === "resume");
          if (rDoc?.text) {
            setResumeText(rDoc.text);
          }
          const jDoc = docs.find((d) => d.kind === "jd");
          if (jDoc?.text) {
            setJdText(jDoc.text);
          }
        }

        const structured = await storage.getAll<StructuredProfileRow>("structuredProfiles");
        if (structured.length > 0 && mounted) {
          const latest = structured[structured.length - 1]!;
          if (latest.json) {
            const p = latest.json as StructuredProfile;
            setExtractedProfile(p);
            setSkills(p.skills || []);
            setGaps(p.gaps || []);
            setQuantifiedClaims(p.quantifiedClaims || []);
          }
        }
      } catch {
        // Fallback to defaults
      }
    }

    loadInitial();
    return () => {
      mounted = false;
    };
  }, [storage]);

  // Handle file drop & selection
  const handleFileProcess = async (file: File) => {
    setIsParsing(true);
    setParseError(null);
    setIsScanned(false);

    try {
      const res = await parseDocument(file);
      if (res.ok) {
        setResumeText(res.text);
        setParseError(null);
        setIsScanned(false);
      } else {
        setParseError(res.error || "Failed to parse document");
        if (res.isScanned) {
          setIsScanned(true);
          setResumeMode("paste");
        }
      }
    } catch (err: unknown) {
      setParseError(err instanceof Error ? err.message : "Error processing file");
    } finally {
      setIsParsing(false);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileProcess(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFileProcess(file);
    }
  };

  // Profile extraction trigger
  const handleAnalyzeProfile = async () => {
    if (!targetRole.trim()) {
      setValidationError("Please specify a target role before analyzing.");
      return;
    }

    setIsExtracting(true);
    setValidationError(null);

    try {
      // Note: If no provider adapter or encrypted key locked, extractProfile uses deterministic fallback
      const result = await extractProfile({
        resumeText: roleOnly ? "" : resumeText,
        jdText: roleOnly ? "" : jdText,
        targetRole,
        level,
        storage,
        forceRefresh: true,
      });

      setExtractedProfile(result.profile);
      setSkills(result.profile.skills || []);
      setGaps(result.profile.gaps || []);
      setQuantifiedClaims(result.profile.quantifiedClaims || []);
    } catch (err: unknown) {
      setValidationError(err instanceof Error ? err.message : "Failed to analyze profile");
    } finally {
      setIsExtracting(false);
    }
  };

  // Skill management
  const handleRemoveSkill = (skillToRemove: string) => {
    setSkills(skills.filter((s) => s !== skillToRemove));
  };

  const handleAddSkill = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newSkillText.trim();
    if (trimmed && !skills.includes(trimmed)) {
      setSkills([...skills, trimmed]);
      setNewSkillText("");
    }
  };

  // Save and proceed
  const handleContinue = async () => {
    if (!targetRole.trim()) {
      setValidationError("Target role is required. Please specify the role you are preparing for.");
      return;
    }
    if (targetRole.trim().length > 120) {
      setValidationError("Target role must not exceed 120 characters.");
      return;
    }

    setIsSaving(true);
    setValidationError(null);

    try {
      const now = new Date().toISOString();

      // 1. Save Profile (FR-004)
      const profileRow: ProfileRow = {
        id: "current_profile",
        level,
        targetRole: targetRole.trim(),
        updatedAt: now,
      };
      await storage.put("profile", profileRow);

      // 2. Save Documents if not role-only (FR-002)
      if (!roleOnly) {
        if (resumeText.trim()) {
          const rHash = await computeSha256(resumeText.trim());
          await storage.put("documents", {
            id: "doc_resume",
            kind: "resume",
            text: resumeText.trim(),
            hash: rHash,
            updatedAt: now,
          });
        }
        if (jdText.trim()) {
          const jHash = await computeSha256(jdText.trim());
          await storage.put("documents", {
            id: "doc_jd",
            kind: "jd",
            text: jdText.trim(),
            hash: jHash,
            updatedAt: now,
          });
        }
      }

      // 3. Save Structured Profile if analyzed or fallback (FR-003)
      if (extractedProfile) {
        const updatedProfile: StructuredProfile = {
          ...extractedProfile,
          skills,
          gaps,
          quantifiedClaims,
        };
        await storage.put("structuredProfiles", {
          id: updatedProfile.id,
          inputHash: updatedProfile.inputHash,
          json: updatedProfile,
          condensed: updatedProfile.condensed,
          promptVersion: updatedProfile.promptVersion,
        });
      }

      onComplete();
    } catch (err: unknown) {
      setValidationError(
        err instanceof Error ? err.message : "Failed to save profile. Please try again."
      );
    } finally {
      setIsSaving(false);
    }
  };

  const isJdOverBudget = jdText.length > MAX_JD_CHARS;

  return (
    <div className="abh-setup-page">
      <header className="abh-setup-header">
        <div className="abh-setup-header-inner">
          <div className="abh-brand-lockup">
            <BrandMark size={24} />
            <span className="abh-wordmark">Abhyas</span>
          </div>
          <Stepper steps={SETUP_STEPS} currentStepIndex={1} />
          {onNavigateSettings && (
            <Button variant="ghost" onClick={onNavigateSettings}>
              Settings
            </Button>
          )}
        </div>
      </header>

      <main className="abh-setup-main">
        <div className="abh-setup-grid">
          {/* Left Column: Role, Experience Level & Mode */}
          <section className="abh-setup-col-left" aria-labelledby="experience-level-heading">
            <span className="abh-step-badge">Step 2 of 3</span>
            <h1 className="abh-setup-title">Your Profile & Role</h1>
            <p className="abh-setup-intro">
              Calibrate your practice sessions. Questions adapt to your stated experience level and
              target job requirements.
            </p>

            <Input
              id="target-role-input"
              label="Target Role or Title"
              value={targetRole}
              onChange={(e) => setTargetRole(e.target.value)}
              placeholder="e.g. Frontend Engineer, Full Stack Developer, Systems Lead"
              maxLength={120}
              helperText="The role you are practicing for (maximum 120 characters)."
              required
            />

            <div className="abh-form-field">
              <h2 id="experience-level-heading" className="abh-section-heading">
                Experience Level
              </h2>
              <p className="abh-form-hint">
                Controls question depth and rubric scoring anchors (FR-004, FR-017).
              </p>
              <div
                className="abh-level-radio-group"
                role="radiogroup"
                aria-labelledby="experience-level-heading"
              >
                {EXPERIENCE_LEVELS.map((lvl) => (
                  <RadioCard
                    key={lvl.id}
                    title={lvl.label}
                    description={lvl.description}
                    monogram={lvl.monogram}
                    checked={level === lvl.id}
                    onChange={() => setLevel(lvl.id)}
                  />
                ))}
              </div>
            </div>

            <div className="abh-mode-card">
              <div className="abh-mode-card-header">
                <div>
                  <h3 className="abh-mode-card-title">Practice by role only</h3>
                  <p className="abh-mode-card-desc">
                    Skip uploading a resume or job description. Practice with standard questions
                    tailored to your role and experience level.
                  </p>
                </div>
                <Switch
                  id="role-only-toggle"
                  checked={roleOnly}
                  onChange={(checked) => setRoleOnly(checked)}
                  label="Role only mode"
                />
              </div>
            </div>
          </section>

          {/* Right Column: Documents and Structured Analysis */}
          <section className="abh-setup-col-right" aria-labelledby="documents-heading">
            {!roleOnly ? (
              <>
                <h2 id="documents-heading" className="abh-section-heading">
                  Resume & Job Description
                </h2>
                <p className="abh-form-hint">
                  Parsed locally in your browser. No files or resumes are ever sent to Abhyas
                  servers.
                </p>

                {/* Resume Mode Switcher */}
                <div className="abh-resume-tabs">
                  <button
                    type="button"
                    className={`abh-resume-tab ${resumeMode === "upload" ? "active" : ""}`}
                    onClick={() => setResumeMode("upload")}
                  >
                    Upload File
                  </button>
                  <button
                    type="button"
                    className={`abh-resume-tab ${resumeMode === "paste" ? "active" : ""}`}
                    onClick={() => setResumeMode("paste")}
                  >
                    Paste Text
                  </button>
                </div>

                {resumeMode === "upload" ? (
                  <div
                    className={`abh-dropzone ${isDragging ? "dragging" : ""}`}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    role="region"
                    aria-label="Resume drop zone"
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf,.docx,.txt"
                      className="abh-file-input-hidden"
                      onChange={handleFileInputChange}
                      aria-label="Choose resume file (PDF, DOCX, TXT)"
                    />
                    <div className="abh-dropzone-content">
                      <span className="abh-dropzone-icon" aria-hidden="true">
                        📄
                      </span>
                      <strong className="abh-dropzone-cta">
                        Choose a file or drag & drop here
                      </strong>
                      <span className="abh-dropzone-formats">PDF, DOCX, or TXT • Max 5 MB</span>
                    </div>
                  </div>
                ) : (
                  <div className="abh-form-field">
                    <label htmlFor="resume-textarea" className="abh-form-label">
                      Resume Text
                    </label>
                    <textarea
                      id="resume-textarea"
                      className="abh-textarea"
                      rows={6}
                      value={resumeText}
                      onChange={(e) => setResumeText(e.target.value)}
                      placeholder="Paste your plain text resume content here..."
                    />
                  </div>
                )}

                {/* Parsing Progress Indicator */}
                {isParsing && (
                  <div className="abh-parsing-box" role="status" aria-live="polite">
                    <span className="abh-parsing-text">Extracting resume text locally...</span>
                    <Progress label="Parsing document" />
                  </div>
                )}

                {/* Scanned PDF Callout */}
                {isScanned && (
                  <Callout variant="warning" title="Scanned PDF Detected">
                    No readable text was found in your PDF. This file appears to be an image or
                    scanned document. Abhyas parses text directly and does not run OCR in v1. Please
                    paste your resume text above.
                  </Callout>
                )}

                {/* Parse Error Callout */}
                {parseError && !isScanned && (
                  <Callout variant="danger" title="Document Parsing Issue">
                    {parseError}
                    <div style={{ marginTop: "var(--space-2)" }}>
                      <Button variant="secondary" onClick={() => setResumeMode("paste")}>
                        Switch to Paste Text
                      </Button>
                    </div>
                  </Callout>
                )}

                {/* Editable Preview of Extracted Resume */}
                {resumeText.trim() && resumeMode === "upload" && (
                  <div className="abh-form-field">
                    <div className="abh-field-header-row">
                      <label htmlFor="extracted-resume-preview" className="abh-form-label">
                        Extracted Resume Text ({resumeText.length} characters)
                      </label>
                      <Button variant="ghost" onClick={() => setResumeText("")}>
                        Clear
                      </Button>
                    </div>
                    <textarea
                      id="extracted-resume-preview"
                      className="abh-textarea"
                      rows={5}
                      value={resumeText}
                      onChange={(e) => setResumeText(e.target.value)}
                    />
                    <span className="abh-form-hint">
                      Review and correct any text extracted from your document.
                    </span>
                  </div>
                )}

                {/* Target Job Description */}
                <div className="abh-form-field">
                  <div className="abh-field-header-row">
                    <label htmlFor="jd-textarea" className="abh-form-label">
                      Target Job Description (Optional)
                    </label>
                    <span className="abh-form-hint">
                      {jdText.length} / {MAX_JD_CHARS}
                    </span>
                  </div>
                  <textarea
                    id="jd-textarea"
                    className="abh-textarea"
                    rows={4}
                    value={jdText}
                    onChange={(e) => setJdText(e.target.value)}
                    placeholder="Paste job description or requirements to align question focus and detect gaps..."
                  />
                  {isJdOverBudget && (
                    <Callout variant="info" title="Large Job Description">
                      Your job description exceeds 8,000 characters and will be trimmed to fit the
                      AI context budget.
                    </Callout>
                  )}
                </div>

                {/* Profile Analysis Button */}
                <div className="abh-analyze-actions">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={handleAnalyzeProfile}
                    isLoading={isExtracting}
                    disabled={isParsing || !resumeText.trim()}
                  >
                    {extractedProfile ? "Re-analyze Profile" : "Analyze Profile & Skills"}
                  </Button>
                </div>
              </>
            ) : (
              <div className="abh-role-only-notice">
                <Callout variant="info" title="Role-Only Mode Active">
                  You are practicing without documents. Questions will be selected from the curated
                  bank for <strong>{targetRole || "Software Engineer"}</strong> at the{" "}
                  <strong>{EXPERIENCE_LEVELS.find((l) => l.id === level)?.label}</strong> level.
                </Callout>
              </div>
            )}

            {/* Extracted Profile Review (Skills, Gaps, Highlights) */}
            {(skills.length > 0 || gaps.length > 0 || extractedProfile) && (
              <div className="abh-structured-card" aria-label="Structured Profile Review">
                <h3 className="abh-structured-title">Profile Analysis</h3>

                {/* Skills Section */}
                <div className="abh-form-field">
                  <label className="abh-form-label">Identified Skills ({skills.length})</label>
                  <div className="abh-skills-pill-wrap">
                    {skills.map((s) => (
                      <span key={s} className="abh-skill-pill">
                        {s}
                        <button
                          type="button"
                          className="abh-skill-remove-btn"
                          onClick={() => handleRemoveSkill(s)}
                          aria-label={`Remove skill ${s}`}
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>

                  {/* Add manual skill */}
                  <form onSubmit={handleAddSkill} className="abh-add-skill-form">
                    <Input
                      id="add-skill-input"
                      label="Add Custom Skill"
                      value={newSkillText}
                      onChange={(e) => setNewSkillText(e.target.value)}
                      placeholder="Add another skill (e.g. GraphQL, AWS, Docker)"
                    />
                    <Button type="submit" variant="secondary" disabled={!newSkillText.trim()}>
                      Add Skill
                    </Button>
                  </form>
                </div>

                {/* Job Description Gaps */}
                {gaps.length > 0 && (
                  <div className="abh-form-field">
                    <label className="abh-form-label">
                      Requirements Gap (Found in JD, not in Resume)
                    </label>
                    <ul className="abh-gaps-list">
                      {gaps.map((g, idx) => (
                        <li key={idx} className="abh-gap-item">
                          {g}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Quantified Claims */}
                {quantifiedClaims.length > 0 && (
                  <div className="abh-form-field">
                    <label className="abh-form-label">Key Quantified Claims</label>
                    <ul className="abh-claims-list">
                      {quantifiedClaims.map((claim, idx) => (
                        <li key={idx} className="abh-claim-item">
                          {claim}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </section>
        </div>

        {/* Validation & Error Callouts */}
        {validationError && (
          <div style={{ marginTop: "var(--space-4)" }}>
            <Callout variant="danger" title="Validation Note">
              {validationError}
            </Callout>
          </div>
        )}

        {/* Navigation Actions */}
        <div className="abh-setup-actions">
          <Button type="button" variant="secondary" onClick={onBack}>
            Back to AI Setup
          </Button>
          <Button type="button" variant="primary" onClick={handleContinue} isLoading={isSaving}>
            Continue to Session Setup
          </Button>
        </div>
      </main>
    </div>
  );
}
