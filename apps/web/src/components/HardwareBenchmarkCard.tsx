// FR-024, FR-022, ADR-013: Hardware capability check and speed benchmark card for local models.
import React, { useEffect, useState, useCallback } from "react";
import {
  detectHardwareCapabilities,
  runHardwareBenchmark,
  type BenchmarkResult,
  type HardwareCapabilityReport,
  type HardwareRuntime,
} from "@abhyas/core";
import { Button } from "./Button.js";
import { Callout } from "./Callout.js";

export interface HardwareBenchmarkCardProps {
  runtime?: HardwareRuntime | undefined;
  onBenchmarkComplete?: ((result: BenchmarkResult) => void) | undefined;
  autoRunBenchmark?: boolean | undefined;
  className?: string | undefined;
}

export const HardwareBenchmarkCard: React.FC<HardwareBenchmarkCardProps> = ({
  runtime,
  onBenchmarkComplete,
  autoRunBenchmark = false,
  className = "",
}) => {
  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState<HardwareCapabilityReport | null>(null);
  const [benchmarking, setBenchmarking] = useState(false);
  const [benchmarkResult, setBenchmarkResult] = useState<BenchmarkResult | null>(null);

  const handleRunBenchmark = useCallback(
    async (repToUse?: HardwareCapabilityReport) => {
      setBenchmarking(true);
      try {
        const rep = repToUse ?? (await detectHardwareCapabilities(runtime));
        const result = await runHardwareBenchmark(runtime, {
          report: rep,
        });
        setBenchmarkResult(result);
        onBenchmarkComplete?.(result);
      } finally {
        setBenchmarking(false);
      }
    },
    [runtime, onBenchmarkComplete]
  );

  // Initial capability detection
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      try {
        const rep = await detectHardwareCapabilities(runtime);
        if (!cancelled) {
          setReport(rep);
          setLoading(false);
          if (autoRunBenchmark && rep.supported) {
            void handleRunBenchmark(rep);
          }
        }
      } catch {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [runtime, autoRunBenchmark, handleRunBenchmark]);

  if (loading) {
    return (
      <div className={`abh-hw-card abh-hw-card--loading ${className}`} aria-busy="true">
        <p className="abh-hw-loading-text">
          <span className="abh-spinner" aria-hidden="true" />
          <span>Checking device hardware and WebGPU capabilities...</span>
        </p>
      </div>
    );
  }

  if (!report) {
    return null;
  }

  // Mobile device or WebGPU missing
  if (!report.supported) {
    return (
      <div className={`abh-hw-card abh-hw-card--unsupported ${className}`}>
        <Callout
          variant="warning"
          title={report.isMobile ? "Mobile device detected" : "WebGPU unavailable"}
        >
          {report.unsupportedReason ??
            "Local model execution requires a desktop computer with WebGPU hardware acceleration."}
        </Callout>
      </div>
    );
  }

  return (
    <div
      className={`abh-hw-card ${className}`}
      role="region"
      aria-label="Hardware capability check"
    >
      <div className="abh-hw-header">
        <div className="abh-hw-title-row">
          <h4 className="abh-hw-title">Hardware Capabilities &amp; WebGPU</h4>
          <span className="abh-hw-supported-pill" aria-label="WebGPU status: Supported">
            ✓ WebGPU Available
          </span>
        </div>
        <p className="abh-hw-subtitle">
          Measured hardware throughput determines the optimal model tier for fluid offline practice.
        </p>
      </div>

      <div className="abh-hw-specs-grid">
        <div className="abh-hw-spec-tile">
          <span className="abh-hw-spec-label">Adapter / GPU</span>
          <span className="abh-hw-spec-val" title={report.adapterInfo?.description}>
            {report.adapterInfo?.description ||
              report.adapterInfo?.vendor ||
              "WebGPU Hardware Accelerated"}
          </span>
        </div>

        <div className="abh-hw-spec-tile">
          <span className="abh-hw-spec-label">CPU Cores</span>
          <span className="abh-hw-spec-val">
            {report.hardwareConcurrency ? `${report.hardwareConcurrency} cores` : "Detected"}
          </span>
        </div>

        <div className="abh-hw-spec-tile">
          <span className="abh-hw-spec-label">Est. RAM</span>
          <span className="abh-hw-spec-val">
            {report.deviceMemoryGb ? `~${report.deviceMemoryGb} GB` : "Standard PC"}
          </span>
        </div>

        <div className="abh-hw-spec-tile">
          <span className="abh-hw-spec-label">Storage Quota</span>
          <span className="abh-hw-spec-val">
            {report.storageEstimateMb
              ? `${Math.round(report.storageEstimateMb / 1024)} GB free`
              : "Ample"}
          </span>
        </div>
      </div>

      <div className="abh-hw-benchmark-section" aria-live="polite">
        {!benchmarkResult && !benchmarking && (
          <div className="abh-hw-bench-cta-wrap">
            <Button
              variant="secondary"
              onClick={() => void handleRunBenchmark()}
              disabled={benchmarking}
            >
              Run Speed Benchmark
            </Button>
            <span className="abh-hw-bench-note">
              Takes ~500ms to measure token decoding throughput.
            </span>
          </div>
        )}

        {benchmarking && (
          <div className="abh-hw-bench-progress">
            <span className="abh-spinner" aria-hidden="true" />
            <span className="abh-hw-bench-progress-text">
              Measuring matrix compute throughput and latency...
            </span>
          </div>
        )}

        {benchmarkResult && !benchmarking && (
          <div className="abh-hw-result-box">
            <div className="abh-hw-result-header">
              <div className="abh-hw-result-metric">
                <span className="abh-hw-result-metric-val">{benchmarkResult.tokensPerSecond}</span>
                <span className="abh-hw-result-metric-unit">tokens / sec</span>
              </div>

              <div className="abh-hw-tier-badge-wrap">
                <span className="abh-hw-tier-label">Recommended Tier:</span>
                <span className={`abh-hw-tier-badge abh-hw-tier-badge--${benchmarkResult.tier}`}>
                  {benchmarkResult.recommendedModelTierLabel}
                </span>
              </div>
            </div>

            {benchmarkResult.notes.length > 0 && (
              <p className="abh-hw-result-notes">{benchmarkResult.notes.join(" ")}</p>
            )}

            <div className="abh-hw-recommended-models">
              <span className="abh-hw-models-heading">Recommended models for your device:</span>
              <ul className="abh-hw-models-list">
                {benchmarkResult.recommendedModels.map((m) => (
                  <li key={m} className="abh-hw-model-item">
                    <code>{m}</code>
                  </li>
                ))}
              </ul>
            </div>

            <div className="abh-hw-bench-footer">
              <span className="abh-hw-bench-disclaimer">
                Local model mode is text-only to dedicate all device resources to model execution
                (FR-022, ADR-013).
              </span>
              <Button
                variant="ghost"
                onClick={() => void handleRunBenchmark()}
                disabled={benchmarking}
              >
                Re-test Speed
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
