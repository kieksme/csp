/**
 * OpenTelemetry bootstrap for CSP API processes.
 *
 * Import this module before any other application imports so auto-
 * instrumentations can patch libraries. Prefer starting Node with
 * `--import @kieksme/csp-core/tracing-register` for full ESM instrumentation
 * (required for ESM apps on Node 20.6+).
 *
 * Configuration uses standard OpenTelemetry environment variables:
 * `OTEL_SDK_DISABLED`, `OTEL_SERVICE_NAME`, `OTEL_RESOURCE_ATTRIBUTES`,
 * `OTEL_EXPORTER_OTLP_ENDPOINT`, and related `OTEL_*` settings. Traces (and
 * metrics) are exported via OTLP HTTP to an OpenTelemetry Collector
 * (`otel-collector`); the collector may forward to Datadog or any other
 * backend. When `OTEL_SDK_DISABLED=true`, initialization is a no-op. When
 * the SDK is enabled but the collector is unreachable, the process continues
 * and spans/metrics are dropped.
 */
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import {
  applyOpenTelemetryDefaults,
  isOpenTelemetryEnabled,
  OTEL_NODE_IMPORT,
  nodeArgsWithOpenTelemetry,
  DEFAULT_OTLP_ENDPOINT,
  DEFAULT_OTEL_SERVICE_NAME,
} from './tracing-node.js';

export {
  OTEL_NODE_IMPORT,
  nodeArgsWithOpenTelemetry,
  isOpenTelemetryEnabled,
  applyOpenTelemetryDefaults,
  DEFAULT_OTLP_ENDPOINT,
  DEFAULT_OTEL_SERVICE_NAME,
};

let sdk: NodeSDK | undefined;

function otlpHttpUrl(endpoint: string, signalPath: string): string {
  const base = endpoint.replace(/\/$/, '');
  return `${base}${signalPath}`;
}

/**
 * Initialize the OpenTelemetry Node SDK from `OTEL_*` env vars.
 * Safe to call more than once; returns the started SDK or `undefined` when
 * disabled.
 */
export function initOpenTelemetry(
  env: NodeJS.ProcessEnv = process.env,
): NodeSDK | undefined {
  if (!isOpenTelemetryEnabled(env)) return undefined;
  if (sdk) return sdk;

  applyOpenTelemetryDefaults(env);

  const endpoint = env.OTEL_EXPORTER_OTLP_ENDPOINT || DEFAULT_OTLP_ENDPOINT;
  const serviceName = env.OTEL_SERVICE_NAME || DEFAULT_OTEL_SERVICE_NAME;

  sdk = new NodeSDK({
    serviceName,
    traceExporter: new OTLPTraceExporter({
      url: otlpHttpUrl(endpoint, '/v1/traces'),
    }),
    metricReaders: [
      new PeriodicExportingMetricReader({
        exporter: new OTLPMetricExporter({
          url: otlpHttpUrl(endpoint, '/v1/metrics'),
        }),
      }),
    ],
    instrumentations: [
      getNodeAutoInstrumentations({
        // Filesystem spans are noisy for a Fastify API and rarely useful.
        '@opentelemetry/instrumentation-fs': { enabled: false },
      }),
    ],
  });

  try {
    sdk.start();
  } catch {
    // Collector/network issues must not prevent the API from starting.
  }

  const shutdown = () => {
    void sdk?.shutdown().catch(() => undefined);
  };
  process.once('SIGTERM', shutdown);
  process.once('beforeExit', shutdown);

  return sdk;
}

initOpenTelemetry();
