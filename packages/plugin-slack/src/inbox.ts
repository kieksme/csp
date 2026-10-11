import { PostgresStore, type Store } from '@kieksme/csp-core/support';
export interface Incoming {
  id: string;
  conversationId: string;
  rootId: string;
  user: string;
  timestamp: number;
  action?: 'take' | 'release' | 'close';
  text?: string;
}
export interface Inbox {
  init(): Promise<void>;
  put(job: Incoming): Promise<void>;
  drain(process: (job: Incoming) => Promise<void>): Promise<void>;
}
// Synthetic tests only; live callbacks always use the same PostgreSQL database as conversations.
export class MemoryInbox implements Inbox {
  jobs = new Map<string, Incoming | undefined>();
  async init() {}
  async put(job: Incoming) {
    if (!this.jobs.has(job.id)) this.jobs.set(job.id, structuredClone(job));
  }
  async drain(process: (job: Incoming) => Promise<void>) {
    for (const [id, job] of this.jobs)
      if (job) {
        await process(job);
        this.jobs.set(id, undefined);
      }
  }
}
export class PostgresInbox implements Inbox {
  constructor(private store: PostgresStore) {}
  async init() {
    await this.store.pool.query(`CREATE TABLE IF NOT EXISTS csp_slack_inbox (
      seq bigserial PRIMARY KEY, id text UNIQUE NOT NULL, conversation_id uuid NOT NULL REFERENCES csp_conversations(id) ON DELETE CASCADE,
      body jsonb, attempts integer NOT NULL DEFAULT 0, next_at timestamptz NOT NULL DEFAULT now());`);
  }
  async put(job: Incoming) {
    // A unique receipt survives completion and prevents delayed Slack retries from replaying actions.
    await this.store.pool.query({
      text: 'INSERT INTO csp_slack_inbox(id,conversation_id,body) VALUES ($1,$2,$3) ON CONFLICT(id) DO NOTHING',
      values: [job.id, job.conversationId, job],
    });
  }
  async drain(process: (job: Incoming) => Promise<void>) {
    // Preserve callback order within a conversation when Slack is temporarily unavailable.
    const rows = await this.store.pool
      .query(`SELECT o.* FROM csp_slack_inbox o WHERE body IS NOT NULL AND next_at<=now()
      AND NOT EXISTS(SELECT 1 FROM csp_slack_inbox p WHERE p.conversation_id=o.conversation_id AND p.seq<o.seq AND p.body IS NOT NULL) ORDER BY seq LIMIT 20`);
    for (const row of rows.rows) {
      try {
        // Store.change checks the existing runtime lease before any inbound mutation.
        await process(row.body);
        await this.store.pool.query(
          'UPDATE csp_slack_inbox SET body=NULL WHERE seq=$1',
          [row.seq],
        );
      } catch {
        await this.store.pool.query(
          "UPDATE csp_slack_inbox SET attempts=attempts+1,next_at=now()+$2 * interval '1 second' WHERE seq=$1",
          [row.seq, Math.min(300, 2 ** Math.min(row.attempts + 1, 8))],
        );
      }
    }
  }
}
export function inboxFor(store: Store): Inbox {
  if (!(store instanceof PostgresStore))
    throw new Error('Live Slack support requires PostgreSQL');
  return new PostgresInbox(store);
}
