import { safeUrl, type Source } from '@kieksme/csp-sdk';
export type AnswerPart = { text: string; href?: string };
export function sourceHref(href: string | undefined) {
  if (!href) return undefined;
  if (/^#[a-zA-Z][\w-]*$/.test(href)) return href;
  try {
    return safeUrl(href);
  } catch {
    return undefined;
  }
}
export function answerParts(
  text: string,
  sources: Omit<Source, 'text'>[],
  streaming = false,
): AnswerPart[] {
  // Hide a marker while its final chunk is still arriving.
  const complete = streaming ? text.replace(/\[[^\[\]\r\n]*$/, '') : text;
  return complete
    .split(/(\[[^\[\]\r\n]+\])/g)
    .filter(Boolean)
    .flatMap((part) => {
      const marker = /^\[([^\[\]\r\n]+)\]$/.exec(part);
      if (!marker) return [{ text: part }];
      const source = sources.find((s) => s.id === marker[1]);
      if (!source) return [];
      const label =
        source.id.startsWith('ticket:') && /support/i.test(source.title)
          ? 'Support-Ticket erstellen'
          : source.title;
      return [
        {
          text: label + (source.stale ? ' (veraltet)' : ''),
          href: sourceHref(source.href),
        },
      ];
    });
}
