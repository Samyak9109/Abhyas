import { describe, expect, it, vi } from "vitest";
import { VadEngine, calculateRms, rmsToMeterLevel } from "./vad.js";

describe("Voice Activity Detection (VAD) Engine (ADR-014, M7.3)", () => {
  it("computes RMS and normalized visual meter level", () => {
    const silence = new Float32Array([0, 0, 0, 0]);
    expect(calculateRms(silence)).toBe(0);
    expect(rmsToMeterLevel(0)).toBe(0);

    const uniformSignal = new Float32Array([0.1, -0.1, 0.1, -0.1]);
    expect(calculateRms(uniformSignal)).toBeCloseTo(0.1);
    expect(rmsToMeterLevel(0.1, 5)).toBeCloseTo(0.5);

    const loudSignal = new Float32Array([0.8, -0.8, 0.9, -0.9]);
    expect(rmsToMeterLevel(calculateRms(loudSignal), 5)).toBe(1.0); // Clamped to 1
  });

  it("handles idle state without triggering callbacks", () => {
    const onSpeechStart = vi.fn();
    const onSpeechEnd = vi.fn();
    const vad = new VadEngine({ onSpeechStart, onSpeechEnd });

    const loudChunk = new Float32Array(512).fill(0.3);
    const result = vad.processFrame(loudChunk, 1000);

    expect(result.state).toBe("idle");
    expect(onSpeechStart).not.toHaveBeenCalled();
    expect(onSpeechEnd).not.toHaveBeenCalled();
  });

  it("requires consecutive speech frames before declaring speech start", () => {
    const onSpeechStart = vi.fn();
    const onAudioLevel = vi.fn();
    const vad = new VadEngine({
      speechThreshold: 0.05,
      speechMinFrames: 2,
      onSpeechStart,
      onAudioLevel,
    });

    vad.startListening();
    expect(vad.getState()).toBe("listening");

    const loudChunk = new Float32Array(512).fill(0.1);
    const quietChunk = new Float32Array(512).fill(0.001);

    // 1st loud frame
    vad.processFrame(loudChunk, 100);
    expect(vad.getState()).toBe("listening");
    expect(onSpeechStart).not.toHaveBeenCalled();

    // Sudden quiet frame resets count
    vad.processFrame(quietChunk, 150);
    expect(vad.getState()).toBe("listening");

    // Two consecutive loud frames trigger speech start
    vad.processFrame(loudChunk, 200);
    expect(onSpeechStart).not.toHaveBeenCalled();
    vad.processFrame(loudChunk, 250);
    expect(vad.getState()).toBe("speaking");
    expect(onSpeechStart).toHaveBeenCalledTimes(1);
    expect(onAudioLevel).toHaveBeenCalled();
  });

  it("triggers silence countdown and speech end after configured timeout", () => {
    const onSpeechStart = vi.fn();
    const onSpeechEnd = vi.fn();
    const onSilenceCountdown = vi.fn();

    const vad = new VadEngine({
      speechThreshold: 0.05,
      speechMinFrames: 2,
      silenceTimeoutMs: 1500,
      minSpeechDurationMs: 300,
      onSpeechStart,
      onSpeechEnd,
      onSilenceCountdown,
    });

    vad.startListening();

    const loudChunk = new Float32Array(512).fill(0.1);
    const quietChunk = new Float32Array(512).fill(0.001);

    // Enter speaking state at t=1000
    vad.processFrame(loudChunk, 1000);
    vad.processFrame(loudChunk, 1050);
    expect(vad.getState()).toBe("speaking");

    // Continue speaking until t=1500 (exceeds minSpeechDurationMs of 300ms)
    vad.processFrame(loudChunk, 1500);

    // Silence begins at t=1600
    const frame1 = vad.processFrame(quietChunk, 1600);
    expect(frame1.state).toBe("silence_waiting");
    expect(onSilenceCountdown).toHaveBeenCalledWith(1500, 1500);

    // Halfway through silence (t=2350, elapsed 750ms, remaining 750ms)
    const frame2 = vad.processFrame(quietChunk, 2350);
    expect(frame2.state).toBe("silence_waiting");
    expect(frame2.remainingSilenceMs).toBe(750);
    expect(onSpeechEnd).not.toHaveBeenCalled();

    // Timeout reached at t=3100 (elapsed 1500ms)
    const frame3 = vad.processFrame(quietChunk, 3100);
    expect(frame3.state).toBe("idle");
    expect(frame3.remainingSilenceMs).toBe(0);
    expect(onSpeechEnd).toHaveBeenCalledTimes(1);
  });

  it("resumes speaking state if voice activity returns before timeout", () => {
    const onSpeechEnd = vi.fn();
    const vad = new VadEngine({
      speechThreshold: 0.05,
      speechMinFrames: 1,
      silenceTimeoutMs: 1000,
      minSpeechDurationMs: 100,
      onSpeechEnd,
    });

    vad.startListening();
    const loudChunk = new Float32Array(512).fill(0.1);
    const quietChunk = new Float32Array(512).fill(0.001);

    vad.processFrame(loudChunk, 1000);
    expect(vad.getState()).toBe("speaking");

    // Pause briefly
    vad.processFrame(quietChunk, 1200);
    expect(vad.getState()).toBe("silence_waiting");

    // Resume speaking at 500ms into pause
    vad.processFrame(loudChunk, 1500);
    expect(vad.getState()).toBe("speaking");
    expect(onSpeechEnd).not.toHaveBeenCalled();
  });
});
