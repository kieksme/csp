import semver from 'semver';
import { version } from '../package.json';
import { z } from 'zod';
import type { ComponentType } from 'react';
import type { FastifyInstance } from 'fastify';

export const SDK_VERSION = version;
export type Env = Record<string, string | undefined>;
export interface Source {
  id: string;
  title: string;
  text: string;
  href?: string;
  updatedAt?: string;
  stale?: boolean;
}
export interface LiveData<T> {
  data: T | null;
  updatedAt: string | null;
  stale: boolean;
  error?: string;
}
export interface Person {
  id: string;
  name: string;
  email?: string;
  phones: string[];
  avatar?: string;
  role?: string;
}
export interface Shift {
  userId: string;
  name: string;
  start: string;
  end: string;
}
export interface Schedule {
  timezone: string;
  shifts: Shift[];
}
export interface Alert {
  id: string;
  title: string;
  description: string;
  status: string;
  createdAt: string;
  severity: number;
}
export interface Monitor {
  id: string;
  name: string;
  status: 'up' | 'down' | 'maintenance' | 'unknown';
  uptime?: number;
}
export interface Status {
  monitors: Monitor[];
  incident?: string;
  url: string;
}
export const contentSchema = z.object({
  processes: z
    .array(
      z.object({
        id: z.string(),
        title: z.string(),
        text: z.string(),
        href: z.string().url().optional(),
      }),
    )
    .default([]),
  tickets: z
    .array(
      z.object({
        title: z.string(),
        description: z.string(),
        href: z.string().url(),
        template: z.string().optional(),
      }),
    )
    .default([]),
  faq: z
    .array(
      z.object({
        id: z.string(),
        category: z.string(),
        question: z.string(),
        answer: z.string(),
      }),
    )
    .default([]),
});
export type Content = z.infer<typeof contentSchema>;
export interface ThemeTokens {
  accent?: string;
  accentSecondary?: string;
  hero?: string;
  paper?: string;
  card?: string;
  ink?: string;
  muted?: string;
  line?: string;
  soft?: string;
  success?: string;
  danger?: string;
  warning?: string;
  warningSurface?: string;
  warningInk?: string;
  neutral?: string;
  heroLine?: string;
  radius?: string;
  spacing?: string;
  contentWidth?: string;
  heroWidth?: string;
  fontSize?: string;
  fontMono?: string;
  fontFamily?: string;
}
export interface PublicConfig {
  theme?: {
    mode: 'light' | 'dark' | 'system';
    tokens?: ThemeTokens;
    darkTokens?: ThemeTokens;
  };
  avatarNames?: Record<string, string>;
  customerVersion?: string;
  staticDemo?: boolean;
  name: string;
  tagline: string;
  description: string;
  color: string;
  background: string;
  logo?: string;
  icon?: string;
  domain?: string;
  basePath: string;
  apiUrl: string;
  phone: string;
  phoneLabel: string;
  demo: boolean;
  pollMs: number;
  content: Content;
  avatarOverrides: Record<string, string>;
}
export interface BrowserContext {
  request?: typeof fetch;
  config: PublicConfig;
  api: <T>(path: string, init?: RequestInit) => Promise<T>;
}
export interface Section {
  id: string;
  title: string;
  label: string;
  order: number;
  component: ComponentType<BrowserContext>;
}
export interface PluginMeta {
  id: string;
  sdkVersion: string;
  requires?: string[];
}
export interface BrowserPlugin extends PluginMeta {
  sections: Section[];
}
export interface ServerContext {
  app: FastifyInstance;
  env: Env;
  config: PublicConfig;
  fetch: typeof fetch;
  demo: boolean;
  cache: LiveCache;
  knowledge: Map<string, () => Promise<Source[]>>;
}
export interface ServerPlugin extends PluginMeta {
  configSchema: z.ZodTypeAny;
  setup: (ctx: ServerContext) => Promise<void> | void;
}
export function validatePlugins(plugins: PluginMeta[]) {
  const ids = new Set<string>();
  for (const p of plugins) {
    if (!/^[a-z][a-z0-9-]*$/.test(p.id) || ids.has(p.id))
      throw new Error(`Invalid or duplicate plugin: ${p.id}`);
    if (!semver.satisfies(SDK_VERSION, p.sdkVersion))
      throw new Error(
        `Plugin ${p.id} needs SDK ${p.sdkVersion}; running ${SDK_VERSION}`,
      );
    ids.add(p.id);
  }
  for (const p of plugins)
    for (const dep of p.requires ?? [])
      if (!ids.has(dep)) throw new Error(`Plugin ${p.id} requires ${dep}`);
}
export function safeUrl(value: string): string {
  if (value.startsWith('/') && !value.startsWith('//')) return value;
  const u = new URL(value);
  if (u.username || u.password)
    throw new Error('Public URLs must not contain credentials');
  if (!['http:', 'https:'].includes(u.protocol))
    throw new Error('Only HTTP(S) URLs are allowed');
  return value;
}
export function activeShifts(shifts: Shift[], now = Date.now()) {
  return shifts.filter(
    (s) =>
      Number.isFinite(Date.parse(s.start)) &&
      Date.parse(s.start) <= now &&
      now < Date.parse(s.end),
  );
}
export function safeTimezone(tz: string) {
  const map: Record<string, string> = {
    'W. Europe Standard Time': 'Europe/Berlin',
    'GMT Standard Time': 'Europe/London',
    'Eastern Standard Time': 'America/New_York',
    'Pacific Standard Time': 'America/Los_Angeles',
    UTC: 'UTC',
  };
  try {
    const value = map[tz] ?? tz;
    new Intl.DateTimeFormat('de', { timeZone: value });
    return value;
  } catch {
    return 'Europe/Berlin';
  }
}
export function vCard(person: Person, organization: string) {
  const esc = (s: string) =>
    s
      .replace(/\\/g, '\\\\')
      .replace(/\r?\n|\r/g, '\\n')
      .replace(/;/g, '\\;')
      .replace(/,/g, '\\,');
  const lines = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `FN:${esc(person.name)}`,
    `ORG:${esc(organization)}`,
    ...(person.role ? [`TITLE:${esc(person.role)}`] : []),
    ...(person.email ? [`EMAIL:${esc(person.email)}`] : []),
    ...person.phones.map((p) => `TEL;TYPE=WORK:${esc(p)}`),
    'END:VCARD',
  ];
  // RFC 2425: fold by UTF-8 octets, never through a multi-byte character.
  return (
    lines
      .map((line) => {
        let out = '',
          bytes = 0;
        for (const c of line) {
          const n = new TextEncoder().encode(c).length;
          if (bytes + n > 75) {
            out += '\r\n ';
            bytes = 1;
          }
          out += c;
          bytes += n;
        }
        return out;
      })
      .join('\r\n') + '\r\n'
  );
}
export class LiveCache {
  private values = new Map<string, { data: unknown; at: number }>();
  private pending = new Map<string, Promise<LiveData<unknown>>>();
  private failures = new Map<string, number>();
  constructor(
    public ttl = 30000,
    private clock = () => Date.now(),
  ) {}
  async get<T>(key: string, load: () => Promise<T>): Promise<LiveData<T>> {
    const current = this.values.get(key);
    const now = this.clock();
    if (current && now - current.at < this.ttl)
      return {
        data: current.data as T,
        updatedAt: new Date(current.at).toISOString(),
        stale: false,
      };
    if (now - (this.failures.get(key) ?? -Infinity) < this.ttl)
      return {
        data: (current?.data as T) ?? null,
        updatedAt: current ? new Date(current.at).toISOString() : null,
        stale: true,
        error: 'Datenquelle derzeit nicht erreichbar',
      };
    const pending = this.pending.get(key);
    if (pending) return pending as Promise<LiveData<T>>;
    const request = (async (): Promise<LiveData<T>> => {
      try {
        const data = await load();
        const at = this.clock();
        this.values.set(key, { data, at });
        this.failures.delete(key);
        return { data, updatedAt: new Date(at).toISOString(), stale: false };
      } catch {
        this.failures.set(key, this.clock());
        return {
          data: (current?.data as T) ?? null,
          updatedAt: current ? new Date(current.at).toISOString() : null,
          stale: true,
          error: 'Datenquelle derzeit nicht erreichbar',
        };
      }
    })();
    this.pending.set(key, request);
    try {
      return await request;
    } finally {
      this.pending.delete(key);
    }
  }
}
export async function jsonRequest<T>(
  fetcher: typeof fetch,
  url: string,
  init: RequestInit = {},
): Promise<T> {
  const response = await fetcher(url, {
    ...init,
    signal: init.signal ?? AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`Provider HTTP ${response.status}`);
  return response.json() as Promise<T>;
}
