/**
 * Datadog APM bootstrap for CSP API processes.
 *
 * Import this module before any other application imports so `dd-trace` can
 * patch libraries. Prefer starting Node with
 * `--import @kieksme/csp-core/tracing-register` for full ESM instrumentation
 * (required for ESM apps on Node 20.6+).
 *
 * Configuration uses the standard Datadog environment variables:
 * `DD_TRACE_ENABLED`, `DD_AGENT_HOST`, `DD_TRACE_AGENT_PORT`, `DD_SERVICE`,
 * `DD_ENV`, and `DD_VERSION`. Traces are sent to the Datadog agent (not
 * agentlessly). When `DD_TRACE_ENABLED=false`, initialization is a no-op.
 * When tracing is enabled but the agent is unreachable, the process continues
 * and spans are dropped.
 */
import tracer from 'dd-trace';
import {
  isDatadogTracingEnabled,
  DD_TRACE_NODE_IMPORT,
  nodeArgsWithDatadogTracing,
} from './tracing-node.js';

export {
  DD_TRACE_NODE_IMPORT,
  nodeArgsWithDatadogTracing,
  isDatadogTracingEnabled,
};

/** Initialize the tracer from `DD_*` env vars. Safe to call more than once. */
export function initDatadogTracing(
  env: NodeJS.ProcessEnv = process.env,
): typeof tracer {
  // Honor DD_TRACE_ENABLED without a typed `enabled` init option.
  if (!isDatadogTracingEnabled(env)) return tracer;
  return tracer.init({
    startupLogs: false,
    // Prefer explicit DD_* when set; otherwise keep a stable product default.
    service: env.DD_SERVICE || 'csp-api',
    env: env.DD_ENV || undefined,
    version: env.DD_VERSION || undefined,
    hostname: env.DD_AGENT_HOST || undefined,
    port: env.DD_TRACE_AGENT_PORT ? Number(env.DD_TRACE_AGENT_PORT) : undefined,
  });
}

initDatadogTracing();

export default tracer;
