/**
 * Node `--import` entry for Datadog APM. Resolves through `@kieksme/csp-core`
 * so pnpm workspaces and customer installs find `dd-trace` without declaring
 * it on every app package. Loads the official ESM initializer (init + loader).
 */
import 'dd-trace/initialize.mjs';
