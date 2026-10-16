export const analyticsEvents = [
  'PORTAL_VIEW',
  'SECTION_VIEW',
  'FAQ_OPEN',
  'TICKET_CLICK',
  'PROCESS_CLICK',
  'STATUS_CLICK',
  'CONTACT_CLICK',
  'CHAT_OPEN',
  'CHAT_MESSAGE_SENT',
  'CHAT_REPLY_RECEIVED',
  'HUMAN_SUPPORT_REQUESTED',
  'CONVERSATION_RESOLVED',
] as const;
export type AnalyticsEvent = (typeof analyticsEvents)[number];
export interface AnalyticsMeta {
  section?: string;
  faqId?: string;
  processId?: string;
  channel?: 'phone' | 'email' | 'vcard';
  chatMode?: 'bot' | 'teams' | 'slack' | 'telegram' | 'demo';
}
export const ANALYTICS_EVENT = 'csp:analytics';
/** Emit only semantic, content-free analytics; no provider dependency. */
export function emitAnalytics(event: AnalyticsEvent, meta: AnalyticsMeta = {}) {
  if (typeof window !== 'undefined')
    window.dispatchEvent(
      new CustomEvent(ANALYTICS_EVENT, { detail: { event, meta } }),
    );
}
