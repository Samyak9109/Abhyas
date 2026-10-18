# Troubleshooting & Compatibility Guide

This document catalogs supported browsers, local server configurations, common runtime errors, and recovery steps for Abhyas.

---

## 1. Browser Support Matrix

Abhyas runs directly in client web browsers with zero proxy servers. Different browser engines provide varying support for modern Web APIs (Web Speech API, WebGPU, Storage Persistence).

| Browser | Voice Input (PTT) | Speech Output | Local Models (WebGPU) | Local Servers (Ollama / LM Studio) | Storage (IndexedDB) | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Google Chrome (113+)** | Full | Full | Full (DirectX 12 / Metal / Vulkan) | Full (via loopback CORS) | Full | **Recommended** |
| **Microsoft Edge (113+)** | Full | Full | Full (Windows Direct3D 12) | Full (via loopback CORS) | Full | **Recommended** |
| **Mozilla Firefox (120+)** | Text fallback | Full | In Development (`dom.webgpu.enabled`) | Full (via loopback CORS) | Full | Supported (Text mode default) |
| **Apple Safari (17+)** | Full | Full | Partial (macOS Sonoma+, iOS blocked) | Full (via loopback CORS) | Full | Supported |

> **Device Rules (FR-022, ADR-013):**
> Local models (both in-browser WebGPU and local loopback servers) run on **desktop and laptop PCs only**, in **text-only mode**. Phones and tablets are blocked from local mode to protect memory and battery stability.

---

## 2. Common Errors and Resolutions

### Error: `err-cors-ollama` — Local Server Cross-Origin (CORS) Blocked
- **Symptoms:** When clicking "Test Ollama connection", the browser displays `CORS Restriction Blocked Access` or `Failed to fetch`.
- **Cause:** Web browsers enforce Cross-Origin Resource Sharing (CORS) policies. Ollama rejects cross-origin browser requests by default unless explicit origins are configured.
- **Remedy:** Stop the running Ollama process and launch it with `OLLAMA_ORIGINS="*"`:
  - **macOS / Linux:**
    ```bash
    OLLAMA_ORIGINS="*" ollama serve
    ```
    *(If running as a systemd service on Linux, add `Environment="OLLAMA_ORIGINS=*"` to `/etc/systemd/system/ollama.service.d/environment.conf` and run `systemctl daemon-reload && systemctl restart ollama`)*.
  - **Windows (PowerShell):**
    ```powershell
    $env:OLLAMA_ORIGINS="*"
    ollama serve
    ```
  - **Windows (Command Prompt):**
    ```cmd
    set OLLAMA_ORIGINS=*
    ollama serve
    ```

---

### Error: `err-local-conn` — Local Model Server Connection Refused
- **Symptoms:** Network error connecting to `http://localhost:11434` or `http://localhost:1234/v1`.
- **Cause:** The local engine (Ollama, LM Studio, LocalAI, vLLM) is not running, or is listening on a different port.
- **Remedy:**
  1. Verify the daemon is running (`curl http://localhost:11434/api/tags` or `curl http://localhost:1234/v1/models`).
  2. For LM Studio: Open LM Studio, navigate to the **Local Server** tab, load a model, and click **Start Server**. Ensure **Cross-Origin-Resources-Sharing (CORS)** is enabled in the Server Settings sidebar.

---

### Error: `err-webgpu-unsupported` — WebGPU Not Supported on this Browser / Device
- **Symptoms:** Hardware capability check indicates WebGPU is not supported.
- **Cause:** Browser does not support WebGPU, hardware acceleration is disabled, or the device lacks a compatible GPU adapter.
- **Remedy:**
  1. Ensure you are using Google Chrome 113+ or Microsoft Edge 113+ on a PC.
  2. In Chrome, verify `chrome://settings/system` -> **Use graphics acceleration when available** is turned **ON**.
  3. If your hardware cannot run in-browser models, connect via **Ollama (local server)** or use a free cloud key (Google Gemini).

---

### Error: `err-mic-denied` — Microphone Access Blocked
- **Symptoms:** Voice input button shows disabled or browser error appears when starting audio.
- **Cause:** Microphone permission was previously denied or blocked in browser site permissions.
- **Remedy:** Click the tune/padlock icon in the browser address bar, set **Microphone** to **Allow**, and reload the tab. Alternatively, click **Switch to Text Mode** to continue typing.

---

### Error: `err-auth-failed` — API Key Invalid or Rejected
- **Symptoms:** 401 or 403 response during connection test.
- **Cause:** Incorrect API key, expired key, or missing provider permissions.
- **Remedy:** Verify your key in Google AI Studio or OpenAI platform console. Ensure no trailing whitespace or extra characters were copied.

---

### Error: `err-quota-exceeded` — Rate Limit or Quota Reached
- **Symptoms:** 429 response during interview practice.
- **Cause:** You have reached the provider's free-tier rate limit (e.g. 15 RPM for Gemini 1.5 Flash).
- **Remedy:** Wait 60 seconds before sending the next answer, or switch to an Ollama / local model with unlimited requests.

---

## 3. Redacted Diagnostics Generation

Abhyas provides an automated diagnostic export tool for troubleshooting without compromising privacy:
1. Open **Settings** -> **Data & Storage**.
2. Click **Generate Redacted Diagnostic Report**.
3. The report copies to your clipboard as JSON, including:
   - Operating system and browser user agent.
   - WebGPU availability and adapter vendor info.
   - Active provider type (e.g. `ollama`, `gemini`) with **API keys stripped and redaction tokens applied**.
   - Storage usage and session counts.
   - **Zero** questions, resumes, interview answers, or transcripts are included.
