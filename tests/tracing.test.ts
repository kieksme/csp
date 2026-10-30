import { describe, it, expect } from 'vitest';
import {
  DD_TRACE_NODE_IMPORT,
  isDatadogTracingEnabled,
  nodeArgsWithDatadogTracing,
} from '../packages/core/src/tracing-node.js';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('Datadog APM tracing helpers', () => {
  it('builds node argv with the dd-trace ESM initializer first', () => {
    expect(DD_TRACE_NODE_IMPORT).toBe('@kieksme/csp-core/tracing-register');
    expect(nodeArgsWithDatadogTracing('dist-api/server.js')).toEqual([
      '--import',
      '@kieksme/csp-core/tracing-register',
      'dist-api/server.js',
    ]);
  });

  it('treats only explicit false as disabled', () => {
    expect(isDatadogTracingEnabled({})).toBe(true);
    expect(isDatadogTracingEnabled({ DD_TRACE_ENABLED: 'true' })).toBe(true);
    expect(isDatadogTracingEnabled({ DD_TRACE_ENABLED: 'false' })).toBe(false);
  });

  it('keeps Docker and demo entrypoints wired for early tracer load', () => {
    const rootDocker = readFileSync(join(process.cwd(), 'Dockerfile'), 'utf8');
    const cliDocker = readFileSync(
      join(process.cwd(), 'packages/cli/runtime/Dockerfile'),
      'utf8',
    );
    expect(rootDocker).toContain('--import');
    expect(rootDocker).toContain('@kieksme/csp-core/tracing-register');
    expect(cliDocker).toContain('@kieksme/csp-core/tracing-register');
    expect(
      readFileSync(join(process.cwd(), 'apps/demo/server.ts'), 'utf8'),
    ).toMatch(/^import '@kieksme\/csp-core\/tracing';/m);
    expect(
      readFileSync(join(process.cwd(), 'apps/northstar/server.ts'), 'utf8'),
    ).toMatch(/^import '@kieksme\/csp-core\/tracing';/m);
  });
});
