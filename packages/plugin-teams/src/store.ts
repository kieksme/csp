import { Pool, type PoolClient } from 'pg';
import {
  ChatError,
  type Conversation,
  type Delivery,
  type Identity,
} from './conversations.js';
export interface Store {
  init(): Promise<void>;
  create(c: Conversation): Promise<void>;
  get(id: string): Promise<Conversation | undefined>;
  findThread(
    conversationId: string,
    rootId: string,
  ): Promise<Conversation | undefined>;
  list(owner?: Identity): Promise<Conversation[]>;
  change<T>(
    id: string,
    mutate: (c: Conversation, queue: Delivery[]) => T,
  ): Promise<T>;
  drain(send: (job: Delivery, c: Conversation) => Promise<void>): Promise<void>;
  purge(days: number): Promise<void>;
  close(): Promise<void>;
}
// Demo only. Serial mutations mirror PostgreSQL's row lock.
export class MemoryStore implements Store {
  rows = new Map<string, Conversation>();
  jobs: Delivery[] = [];
  private lock: Promise<unknown> = Promise.resolve();
  async init() {}
  async close() {}
  async create(c: Conversation) {
    this.rows.set(c.id, structuredClone(c));
    this.jobs.push({ id: c.id, conversationId: c.id, kind: 'create' });
  }
  async get(id: string) {
    const c = this.rows.get(id);
    return c && structuredClone(c);
  }
  async list(owner?: Identity) {
    return [...this.rows.values()]
      .filter(
        (c) =>
          !owner ||
          (c.owner.tenantId === owner.tenantId &&
            c.owner.userId === owner.userId),
      )
      .map((c) => structuredClone(c));
  }
  async findThread(conversationId: string, rootId: string) {
    return (await this.list()).find(
      (c) =>
        c.thread?.conversationId === conversationId &&
        c.thread?.rootId === rootId,
    );
  }
  async change<T>(
    id: string,
    mutate: (c: Conversation, queue: Delivery[]) => T,
  ): Promise<T> {
    const operation = this.lock.then(() => {
      const c = this.rows.get(id);
      if (!c) throw new ChatError(404, 'Gespräch nicht gefunden');
      const copy = structuredClone(c),
        queue: Delivery[] = [];
      const result = mutate(copy, queue);
      this.rows.set(id, copy);
      this.jobs.push(...queue);
      return result;
    });
    this.lock = operation.catch(() => {});
    return operation;
  }
  async drain(send: (job: Delivery, c: Conversation) => Promise<void>) {
    while (this.jobs.length) {
      const job = this.jobs[0];
      const c = await this.get(job.conversationId);
      if (c) await send(job, c);
      this.jobs.shift();
    }
  }
  async purge(days: number) {
    for (const c of await this.list())
      if (c.updatedAt < Date.now() - days * 86400000) {
        this.rows.delete(c.id);
        this.jobs = this.jobs.filter((j) => j.conversationId !== c.id);
      }
  }
}
export class PostgresStore implements Store {
  readonly pool: Pool;
  private lease?: PoolClient;
  private leaseLost = false;
  constructor(url: string) {
    this.pool = new Pool({
      connectionString: url,
      max: 5,
      connectionTimeoutMillis: 10000,
      statement_timeout: 15000,
    });
  }
  async init() {
    this.lease = await this.pool.connect();
    const lock = await this.lease.query(
      'SELECT pg_try_advisory_lock(193674531, 1) AS acquired',
    );
    if (!lock.rows[0].acquired) {
      this.lease.release();
      this.lease = undefined;
      throw new Error('Only one CSP Teams runtime may use this database');
    }
    this.lease.on('error', () => {
      this.leaseLost = true;
    });
    this.pool.on('error', () => {});
    await this.pool.query(`CREATE TABLE IF NOT EXISTS csp_conversations (
      id uuid PRIMARY KEY, tenant_id text NOT NULL, user_id text NOT NULL, updated_at timestamptz NOT NULL, body jsonb NOT NULL);
      CREATE INDEX IF NOT EXISTS csp_conversations_owner ON csp_conversations(tenant_id,user_id,updated_at);
      CREATE TABLE IF NOT EXISTS csp_teams_outbox (
      seq bigserial PRIMARY KEY, id text UNIQUE NOT NULL, conversation_id uuid NOT NULL REFERENCES csp_conversations(id) ON DELETE CASCADE,
      body jsonb NOT NULL, attempts integer NOT NULL DEFAULT 0, next_at timestamptz NOT NULL DEFAULT now());`);
  }
  async create(c: Conversation) {
    if (this.leaseLost) throw new Error('Database runtime lease lost');
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        'INSERT INTO csp_conversations VALUES ($1,$2,$3,$4,$5)',
        [c.id, c.owner.tenantId, c.owner.userId, new Date(c.updatedAt), c],
      );
      await client.query(
        'INSERT INTO csp_teams_outbox(id,conversation_id,body) VALUES ($1::text,$1::uuid,$2)',
        [c.id, { id: c.id, conversationId: c.id, kind: 'create' }],
      );
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }
  async get(id: string): Promise<Conversation | undefined> {
    const r = await this.pool.query(
      'SELECT body FROM csp_conversations WHERE id=$1',
      [id],
    );
    return r.rows[0]?.body;
  }
  async list(owner?: Identity): Promise<Conversation[]> {
    const r = await this.pool.query(
      owner
        ? 'SELECT body FROM csp_conversations WHERE tenant_id=$1 AND user_id=$2 ORDER BY updated_at DESC LIMIT 100'
        : 'SELECT body FROM csp_conversations',
      owner ? [owner.tenantId, owner.userId] : [],
    );
    return r.rows.map((r) => r.body);
  }
  async findThread(
    conversationId: string,
    rootId: string,
  ): Promise<Conversation | undefined> {
    const r = await this.pool.query(
      "SELECT body FROM csp_conversations WHERE body->'thread'->>'conversationId'=$1 AND body->'thread'->>'rootId'=$2",
      [conversationId, rootId],
    );
    return r.rows[0]?.body;
  }
  async change<T>(
    id: string,
    mutate: (c: Conversation, queue: Delivery[]) => T,
  ): Promise<T> {
    if (this.leaseLost) throw new Error('Database runtime lease lost');
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const r = await client.query(
        'SELECT body FROM csp_conversations WHERE id=$1 FOR UPDATE',
        [id],
      );
      if (!r.rows[0]) throw new ChatError(404, 'Gespräch nicht gefunden');
      const c: Conversation = r.rows[0].body,
        queue: Delivery[] = [];
      const result = mutate(c, queue);
      await client.query(
        'UPDATE csp_conversations SET body=$2,updated_at=$3 WHERE id=$1',
        [id, c, new Date(c.updatedAt)],
      );
      for (const job of queue)
        await client.query(
          'INSERT INTO csp_teams_outbox(id,conversation_id,body) VALUES ($1,$2,$3) ON CONFLICT(id) DO NOTHING',
          [job.id, id, job],
        );
      await client.query('COMMIT');
      return result;
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }
  async drain(send: (job: Delivery, c: Conversation) => Promise<void>) {
    if (this.leaseLost) throw new Error('Database runtime lease lost');
    // One worker per deployment. The per-conversation head prevents later messages overtaking retries.
    const r = await this.pool
      .query(`SELECT o.* FROM csp_teams_outbox o WHERE next_at<=now()
      AND NOT EXISTS(SELECT 1 FROM csp_teams_outbox p WHERE p.conversation_id=o.conversation_id AND p.seq<o.seq) ORDER BY seq LIMIT 20`);
    for (const row of r.rows) {
      try {
        const c = await this.get(row.conversation_id);
        if (c) await send(row.body, c);
        await this.pool.query('DELETE FROM csp_teams_outbox WHERE seq=$1', [
          row.seq,
        ]);
      } catch {
        await this.pool.query(
          "UPDATE csp_teams_outbox SET attempts=attempts+1,next_at=now()+$2 * interval '1 second' WHERE seq=$1",
          [row.seq, Math.min(300, 2 ** Math.min(row.attempts + 1, 8))],
        );
      }
    }
  }
  async purge(days: number) {
    await this.pool.query(
      "DELETE FROM csp_conversations WHERE updated_at<now()-$1 * interval '1 day'",
      [days],
    );
  }
  async close() {
    if (this.lease) {
      if (!this.leaseLost)
        await this.lease
          .query('SELECT pg_advisory_unlock(193674531, 1)')
          .catch(() => {});
      this.lease.release();
      this.lease = undefined;
    }
    await this.pool.end();
  }
}
