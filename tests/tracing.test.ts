import { describe, it, expect } from 'vitest';
import {
  OTEL_NODE_IMPORT,
  DEFAULT_OTLP_ENDPOINT,
  DEFAULT_OTEL_SERVICE_NAME,
  isOpenTelemetryEnabled,
  applyOpenTelemetryDefaults,
  nodeArgsWithOpenTelemetry,
} from '../packages/core/src/tracing-node.js';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('OpenTelemetry tracing helpers', () => {
  it('builds node argv with the OpenTelemetry ESM initializer first', () => {
    expect(OTEL_NODE_IMPORT).toBe('@kieksme/csp-core/tracing-register');
    expect(nodeArgsWithOpenTelemetry('dist-api/server.js')).toEqual([
      '--import',
      '@kieksme/csp-core/tracing-register',
      'dist-api/server.js',
    ]);
  });

  it('treats only OTEL_SDK_DISABLED=true as disabled', () => {
    expect(isOpenTelemetryEnabled({})).toBe(true);
    expect(isOpenTelemetryEnabled({ OTEL_SDK_DISABLED: 'false' })).toBe(true);
    expect(isOpenTelemetryEnabled({ OTEL_SDK_DISABLED: 'true' })).toBe(false);
  });

  it('applies CSP OTLP defaults without overriding explicit values', () => {
    const env: NodeJS.ProcessEnv = {};
    applyOpenTelemetryDefaults(env);
    expect(env.OTEL_SERVICE_NAME).toBe(DEFAULT_OTEL_SERVICE_NAME);
    expect(env.OTEL_EXPORTER_OTLP_ENDPOINT).toBe(DEFAULT_OTLP_ENDPOINT);
    expect(env.OTEL_EXPORTER_OTLP_PROTOCOL).toBe('http/protobuf');

    const custom: NodeJS.ProcessEnv = {
      OTEL_SERVICE_NAME: 'other-api',
      OTEL_EXPORTER_OTLP_ENDPOINT: 'http://localhost:4318',
      OTEL_EXPORTER_OTLP_PROTOCOL: 'grpc',
    };
    applyOpenTelemetryDefaults(custom);
    expect(custom.OTEL_SERVICE_NAME).toBe('other-api');
    expect(custom.OTEL_EXPORTER_OTLP_ENDPOINT).toBe('http://localhost:4318');
    expect(custom.OTEL_EXPORTER_OTLP_PROTOCOL).toBe('grpc');
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

  it('does not depend on dd-trace or DD_* APM configuration', () => {
    const corePkg = JSON.parse(
      readFileSync(join(process.cwd(), 'packages/core/package.json'), 'utf8'),
    ) as { dependencies: Record<string, string> };
    expect(corePkg.dependencies['dd-trace']).toBeUndefined();
    expect(corePkg.dependencies['@opentelemetry/sdk-node']).toBeDefined();
    expect(
      corePkg.dependencies['@opentelemetry/auto-instrumentations-node'],
    ).toBeDefined();
    expect(
      readFileSync(join(process.cwd(), 'packages/core/src/tracing.ts'), 'utf8'),
    ).not.toMatch(/dd-trace|DD_TRACE|DD_AGENT|DD_SERVICE/);
  });
});
