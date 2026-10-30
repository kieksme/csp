/**
 * Node `--import` entry for OpenTelemetry. Resolves through `@kieksme/csp-core`
 * so pnpm workspaces and customer installs find the SDK packages without
 * declaring them on every app package. Registers the ESM instrumentation hook,
 * then starts the Node SDK (traces + metrics via OTLP HTTP).
 *
 * Static import of the SDK runs while this module loads; `register()` then
 * installs the ESM hook before the application entrypoint is evaluated.
 */
import { register } from 'node:module';
import './dist/tracing.js';

try {
  register('@opentelemetry/instrumentation/hook.mjs', import.meta.url);
} catch {
  // Already registered or unavailable — SDK init above still applies.
}
