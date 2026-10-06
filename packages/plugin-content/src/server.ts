import { z } from 'zod';
import type { ServerPlugin } from '@kieksme/csp-sdk';
export default {
  id: 'content',
  sdkVersion: '^0.1.0',
  configSchema: z.object({ CSP_CONTENT_PATH: z.string().min(1) }),
  setup(ctx) {
    ctx.knowledge.set('content', async () => [
      ...ctx.config.content.faq.map((f) => ({
        id: 'faq:' + f.id,
        title: f.question,
        text: f.answer,
        href: '#faq',
      })),
      ...ctx.config.content.processes.map((p) => ({
        id: 'process:' + p.id,
        title: p.title,
        text: p.text,
        href: p.href ?? '#help',
      })),
      ...ctx.config.content.tickets.map((t, i) => ({
        id: 'ticket:' + i,
        title: t.title,
        text: t.description + '\n' + (t.template ?? ''),
        href: t.href,
      })),
    ]);
  },
} satisfies ServerPlugin;
