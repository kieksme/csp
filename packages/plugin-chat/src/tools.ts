import {
  UNTRUSTED_NOTE,
  webMcpError,
  webMcpJson,
  type BrowserContext,
  type ChatResponder,
  type Source,
  type WebMcpTool,
} from '@kieksme/csp-sdk';
import { sourceHref } from './answer.js';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}
/** Same limits as the API (`POST /api/v1/chat`), reported before any request. */
export function parseMessages(value: unknown): ChatMessage[] | string {
  if (!Array.isArray(value) || value.length < 1 || value.length > 20)
    return 'messages muss 1 bis 20 Einträge enthalten.';
  let total = 0;
  const messages: ChatMessage[] = [];
  for (const item of value) {
    const { role, content } = (item ?? {}) as Record<string, unknown>;
    if (
      (role !== 'user' && role !== 'assistant') ||
      typeof content !== 'string' ||
      content.length < 1 ||
      content.length > 4000
    )
      return 'Jede Nachricht braucht role (user|assistant) und content (1 bis 4000 Zeichen).';
    total += content.length;
    messages.push({ role, content });
  }
  if (messages.at(-1)!.role !== 'user')
    return 'Die letzte Nachricht muss von user stammen.';
  if (total > 16000)
    return 'Der Verlauf darf höchstens 16000 Zeichen enthalten.';
  return messages;
}

/** Reads the SSE stream of the chat API into one answer. */
export async function askChat(
  ctx: BrowserContext,
  messages: ChatMessage[],
  signal?: AbortSignal,
) {
  const response = await (ctx.request ?? fetch)(
    ctx.config.apiUrl + '/api/v1/chat',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages }),
      signal,
    },
  );
  if (!response.ok || !response.body)
    throw new Error(
      response.status === 429
        ? 'Zu viele Anfragen. Bitte eine Minute warten.'
        : 'Chat derzeit nicht erreichbar.',
    );
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let answer = '';
  let complete = false;
  let responder: ChatResponder | undefined;
  let sources: Omit<Source, 'text'>[] = [];
  try {
    while (true) {
      const { done, value } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      let boundary: number;
      while ((boundary = buffer.indexOf('\n\n')) >= 0) {
        const block = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        const type = block.match(/^event: (.+)$/m)?.[1];
        const payload = block.match(/^data: (.+)$/m)?.[1];
        if (!payload) continue;
        const event = JSON.parse(payload);
        if (type === 'delta') answer += event.text;
        if (type === 'responder') responder = event;
        if (type === 'sources') sources = event;
        if (type === 'error') throw new Error(event.message);
        if (type === 'done') complete = true;
      }
      if (done) break;
    }
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
  if (!complete)
    throw new Error(
      'Die Verbindung wurde unterbrochen. Antwort unvollständig.',
    );
  return { answer, responder, sources };
}

export const chatTools: WebMcpTool[] = [
  {
    name: 'chat_ask',
    description:
      'Fragt den digitalen Assistenten des Portals (kennt Hilfe-Inhalte, Team, Schichten und Status). Verbraucht Chat-Kontingent (Rate-Limit pro IP) und ruft einen KI-Anbieter auf; nur nutzen, wenn die anderen Tools nicht reichen. Ändert keine Daten. Die letzte Nachricht muss von user stammen.',
    inputSchema: {
      type: 'object',
      properties: {
        messages: {
          type: 'array',
          minItems: 1,
          maxItems: 20,
          items: {
            type: 'object',
            properties: {
              role: { type: 'string', enum: ['user', 'assistant'] },
              content: { type: 'string', minLength: 1, maxLength: 4000 },
            },
            required: ['role', 'content'],
            additionalProperties: false,
          },
        },
      },
      required: ['messages'],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false },
    execute: async (args, ctx) => {
      // Support mode (Teams plugin) locks the public chat route with 409.
      if (ctx.config.chatSupport)
        return webMcpError(
          'Der Chat läuft im Supportmodus mit Anmeldung und ist per Tool nicht verfügbar. Bitte die Hotline nutzen.',
        );
      const messages = parseMessages(args.messages);
      if (typeof messages === 'string') return webMcpError(messages);
      try {
        const { answer, responder, sources } = await askChat(
          ctx,
          messages,
          AbortSignal.timeout(90000),
        );
        return webMcpJson({
          notice: UNTRUSTED_NOTE,
          responder:
            responder?.role === 'on-duty' ? responder.name : 'Service-Team',
          answer,
          sources: sources.map((s) => ({
            id: s.id,
            title: s.title,
            href: sourceHref(s.href),
            stale: s.stale ?? false,
          })),
        });
      } catch (error) {
        return webMcpError(
          error instanceof Error ? error.message : 'Chat nicht verfügbar.',
        );
      }
    },
  },
];
