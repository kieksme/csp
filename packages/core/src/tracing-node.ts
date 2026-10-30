/**
 * Pure Node helpers for OpenTelemetry. Safe to import from the CLI and tests
 * without loading the OpenTelemetry SDK (which must only run in API processes).
 */

/**
 * Node `--import` specifier resolved through `@kieksme/csp-core` so pnpm and
 * customer installs find the OpenTelemetry packages without a direct app
 * dependency.
 */
export const OTEL_NODE_IMPORT = '@kieksme/csp-core/tracing-register';

/** Default OTLP HTTP base URL when `OTEL_EXPORTER_OTLP_ENDPOINT` is unset. */
export const DEFAULT_OTLP_ENDPOINT = 'http://otel-collector:4318';

/** Default service name when `OTEL_SERVICE_NAME` is unset. */
export const DEFAULT_OTEL_SERVICE_NAME = 'csp-api';

/**
 * True unless `OTEL_SDK_DISABLED` is explicitly `true` (OpenTelemetry spec).
 */
export function isOpenTelemetryEnabled(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return env.OTEL_SDK_DISABLED !== 'true';
}

/**
 * Build `node` argv that loads the OpenTelemetry ESM initializer before the
 * entry. `OTEL_SDK_DISABLED=true` disables the SDK without removing this flag.
 * A missing or unreachable collector does not crash the process.
 */
export function nodeArgsWithOpenTelemetry(...entryArgs: string[]): string[] {
  return ['--import', OTEL_NODE_IMPORT, ...entryArgs];
}

/**
 * Apply CSP defaults for standard `OTEL_*` variables without overriding
 * explicit values. Mutates and returns `env` for chaining into SDK init.
 */
export function applyOpenTelemetryDefaults(
  env: NodeJS.ProcessEnv = process.env,
): NodeJS.ProcessEnv {
  if (!env.OTEL_SERVICE_NAME) env.OTEL_SERVICE_NAME = DEFAULT_OTEL_SERVICE_NAME;
  if (!env.OTEL_EXPORTER_OTLP_ENDPOINT) {
    env.OTEL_EXPORTER_OTLP_ENDPOINT = DEFAULT_OTLP_ENDPOINT;
  }
  // Prefer OTLP/HTTP (collector port 4318) over gRPC when unset.
  if (!env.OTEL_EXPORTER_OTLP_PROTOCOL) {
    env.OTEL_EXPORTER_OTLP_PROTOCOL = 'http/protobuf';
  }
  return env;
}
