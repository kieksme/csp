import OpenAI from 'openai';
import type { Env } from '@kieksme/csp-sdk';
export interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}
export interface ChatInput {
  messages: Message[];
  maxTokens: number;
  signal: AbortSignal;
}
export interface ChatProvider {
  stream(input: ChatInput): AsyncIterable<string>;
}
// Ollama NDJSON can split a Unicode character or record across network chunks.
export async function* readNDJSON(
  response: Response,
): AsyncGenerator<Record<string, unknown>> {
  if (!response.ok || !response.body)
    throw new Error('AI provider unavailable');
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      let newline: number;
      while ((newline = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, newline).trim();
        buffer = buffer.slice(newline + 1);
        if (line) yield JSON.parse(line);
      }
      if (done) break;
    }
    if (buffer.trim()) yield JSON.parse(buffer);
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}
export function createProvider(
  env: Env,
  fetcher: typeof fetch = fetch,
): ChatProvider {
  if (env.CSP_CHAT_PROVIDER === 'ollama')
    return {
      async *stream({ messages, maxTokens, signal }) {
        const base = (
          env.CSP_CHAT_OLLAMA_URL ?? 'http://localhost:11434'
        ).replace(/\/$/, '');
        const response = await fetcher(base + '/api/chat', {
          method: 'POST',
          signal,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: env.CSP_CHAT_MODEL,
            messages,
            stream: true,
            options: { num_predict: maxTokens },
          }),
        });
        for await (const event of readNDJSON(response)) {
          if (event.error) throw new Error('AI provider error');
          const message = event.message as { content?: string } | undefined;
          if (message?.content) yield message.content;
        }
      },
    };
  const azure = env.CSP_CHAT_PROVIDER === 'azure';
  const baseURL = azure
    ? env.CSP_CHAT_AZURE_ENDPOINT!.replace(/\/$/, '') + '/openai/v1/'
    : (env.CSP_CHAT_OPENAI_URL ?? 'https://api.openai.com/v1');
  const apiKey = azure
    ? env.CSP_CHAT_AZURE_API_KEY!
    : env.CSP_CHAT_OPENAI_API_KEY!;
  const client = new OpenAI({
    apiKey,
    baseURL,
    fetch: fetcher,
    maxRetries: 0,
    ...(azure ? { defaultHeaders: { 'api-key': apiKey } } : {}),
  });
  return {
    async *stream({ messages, maxTokens, signal }) {
      const response = await client.responses.create(
        {
          model: env.CSP_CHAT_MODEL!,
          input: messages,
          max_output_tokens: maxTokens,
          store: false,
          stream: true,
        },
        { signal },
      );
      for await (const event of response) {
        if (event.type === 'response.output_text.delta') yield event.delta;
        else if (
          event.type === 'error' ||
          event.type === 'response.failed' ||
          event.type === 'response.incomplete'
        )
          throw new Error('AI provider response incomplete');
      }
    },
  };
}
