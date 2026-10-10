import { randomUUID } from 'node:crypto';
import type { ChatResponder, Source } from '@kieksme/csp-sdk';
export interface Identity {
  tenantId: string;
  userId: string;
  name: string;
  email?: string;
}
export interface SupportPerson {
  id: string;
  name: string;
}
export interface Message {
  id: string;
  kind: 'user' | 'bot' | 'support' | 'system';
  content: string;
  name?: string;
  complete: boolean;
  responder?: ChatResponder;
  sources?: Omit<Source, 'text'>[];
}
export interface Event {
  seq: number;
  type: 'message' | 'status';
  data: Message | { status: Conversation['status']; support?: SupportPerson };
}
export interface Conversation {
  id: string;
  owner: Identity;
  status: 'bot' | 'support' | 'closed';
  support?: SupportPerson;
  messages: Message[];
  events: Event[];
  updatedAt: number;
  generation?: string;
  thread?: { conversationId: string; rootId: string; serviceUrl?: string };
  seen: string[];
}
export interface Delivery {
  id: string;
  conversationId: string;
  message?: Message;
  kind: 'create' | 'message' | 'card';
}
export class ChatError extends Error {
  constructor(
    public statusCode: number,
    message: string,
  ) {
    super(message);
  }
}
export function conversation(owner: Identity): Conversation {
  return {
    id: randomUUID(),
    owner,
    status: 'bot',
    messages: [],
    events: [],
    updatedAt: Date.now(),
    seen: [],
  };
}
export function emit(
  c: Conversation,
  type: Event['type'],
  data: Event['data'],
) {
  c.events.push({
    seq: (c.events.at(-1)?.seq ?? 0) + 1,
    type,
    data: structuredClone(data),
  });
  if (c.events.length > 64) c.events.splice(0, c.events.length - 64);
  c.updatedAt = Date.now();
}
export function status(c: Conversation) {
  emit(c, 'status', { status: c.status, support: c.support });
}
export function append(c: Conversation, message: Message) {
  c.messages.push(message);
  emit(c, 'message', message);
}
export function delivery(
  c: Conversation,
  kind: Delivery['kind'],
  message?: Message,
): Delivery {
  return {
    id: randomUUID(),
    conversationId: c.id,
    kind,
    message: message && structuredClone(message),
  };
}
export function interrupt(c: Conversation, queue: Delivery[]) {
  const message = c.messages.find((m) => m.id === c.generation);
  if (message && !message.complete) {
    message.complete = true;
    message.content += '\n(Antwort unterbrochen)';
    emit(c, 'message', message);
    queue.push(delivery(c, 'message', message));
  }
  delete c.generation;
}
export function action(
  c: Conversation,
  name: 'take' | 'release' | 'close',
  person: SupportPerson,
  queue: Delivery[],
) {
  if (c.status === 'closed')
    throw new ChatError(409, 'Gespräch bereits abgeschlossen');
  if (name === 'take') {
    if (c.status === 'support') {
      if (c.support?.id === person.id) return;
      throw new ChatError(409, 'Das Gespräch wurde bereits übernommen.');
    }
    interrupt(c, queue);
    c.status = 'support';
    c.support = person;
  } else {
    if (c.status !== 'support' || c.support?.id !== person.id)
      throw new ChatError(
        403,
        'Nur die zuständige Supportperson darf diese Aktion ausführen.',
      );
    c.status = name === 'release' ? 'bot' : 'closed';
    delete c.support;
  }
  status(c);
  const message: Message = {
    id: randomUUID(),
    kind: 'system',
    complete: true,
    content:
      name === 'take'
        ? `${person.name} hat übernommen. Sie chatten jetzt mit einem echten Menschen.`
        : name === 'release'
          ? `${person.name} hat das Gespräch an den digitalen Assistenten zurückgegeben.`
          : `${person.name} hat das Gespräch abgeschlossen.`,
  };
  append(c, message);
  queue.push(delivery(c, 'message', message), delivery(c, 'card'));
}
export function supportReply(
  c: Conversation,
  person: SupportPerson,
  id: string,
  text: string,
  queue: Delivery[],
) {
  if (c.seen.includes(id)) return;
  if (c.status !== 'support' || c.support?.id !== person.id) return;
  if (!text.trim() || text.length > 4000)
    throw new ChatError(400, 'Antwort muss 1 bis 4000 Zeichen enthalten.');
  if (
    c.messages.length >= 500 ||
    c.messages.reduce((n, m) => n + m.content.length, 0) + text.length > 200000
  )
    throw new ChatError(
      409,
      'Gesprächslimit erreicht. Bitte abschließen und einen neuen Chat starten.',
    );
  c.seen.push(id);
  append(c, {
    id: randomUUID(),
    kind: 'support',
    name: person.name,
    content: text.trim(),
    complete: true,
  });
  // The original Teams message is already in the thread; do not echo it back.
}
export function owned(
  c: Conversation | undefined,
  owner: Identity,
): Conversation {
  if (
    !c ||
    c.owner.tenantId !== owner.tenantId ||
    c.owner.userId !== owner.userId
  )
    throw new ChatError(404, 'Gespräch nicht gefunden');
  return c;
}
