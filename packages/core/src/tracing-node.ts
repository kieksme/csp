/**
 * Pure Node helpers for Datadog APM. Safe to import from the CLI and tests
 * without loading `dd-trace` (which must only run in API processes).
 */

/**
 * Node `--import` specifier resolved through `@kieksme/csp-core` so pnpm and
 * customer installs find `dd-trace` without a direct app dependency.
 */
export const DD_TRACE_NODE_IMPORT = '@kieksme/csp-core/tracing-register';

/** True unless `DD_TRACE_ENABLED` is explicitly `false`. */
export function isDatadogTracingEnabled(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return env.DD_TRACE_ENABLED !== 'false';
}

/**
 * Build `node` argv that loads the Datadog ESM initializer before the entry.
 * `DD_TRACE_ENABLED=false` disables tracing inside dd-trace without removing
 * this flag. Missing or unreachable agents do not crash the process.
 */
export function nodeArgsWithDatadogTracing(...entryArgs: string[]): string[] {
  return ['--import', DD_TRACE_NODE_IMPORT, ...entryArgs];
}
