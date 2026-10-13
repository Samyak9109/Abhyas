# External Integrations

**Analysis Date:** 2026-10-13

## AI / LLM Providers

**Direct Browser Integration (ADR-002):**
- **Google Gemini API**: Native JSON mode, structured output, temperature 0. Direct client-to-API communication using user-provided API key.
- **OpenAI API**: Standard chat completions endpoint with structured schema support. Direct client-to-API communication using user-provided API key.
- **OpenAI-Compatible Endpoints**: Configurable baseURL (e.g. OpenRouter, local server, Ollama) for custom model freedom (ADR-017).

*Security Invariant:* Candidate resumes, answers, transcripts, and API keys are transmitted ONLY to the user-selected provider origin. The project servers never proxy interview conversations.

## Speech & Audio

- **Browser Speech Recognition**: Native `webkitSpeechRecognition` / `SpeechRecognition` API. Uses push-to-talk interaction to prevent runaway listening. Clear disclosure displayed when a browser delegates audio to remote speech services.
- **Browser Speech Synthesis**: Native `window.speechSynthesis` API for AI interviewer questions with synchronized subtitles.
- **Fallback**: Graceful text-only fallback on unsupported browsers.

## Client Storage & Encryption

- **IndexedDB**: Browser-native persistent storage wrapped via Dexie (ADR-004).
- **WebCrypto API**: Optional passphrase-derived AES-GCM encryption for stored API keys (ADR-005).

## Local Inference (Phase 3)

- **WebGPU (WebLLM)**: In-browser local model inference for offline text sessions on supported PCs (ADR-013).
- **Local Ollama REST API**: Localhost HTTP connection to candidate's Ollama instance with CORS setup guidance.

## Content & Company Packs (Phases 4 & 5)

- **Static Pack Mirror**: Curated company question packs hosted on static origin / CDN mirror.
- **Research API (FastAPI)**: Optional Phase 5 backend for demand-gated company research. Transmits only company name/domain; never user profile or interview data.

## Calendar Integration (Phase 6)

- **iCalendar (.ics)**: Standard offline calendar export format compatible with Google Calendar, Apple Calendar, and Outlook.
- **Google Calendar OAuth**: Optional client-side OAuth flow using narrow calendar write permissions with in-memory token storage.
