import { useState } from 'react';
import type { PublicConfig } from '@kieksme/csp-sdk';
export function avatarUrl(
  config: PublicConfig,
  id: string,
  name: string,
  provider?: string,
) {
  return (
    config.avatarOverrides[id] ??
    config.avatarNames?.[
      name.normalize('NFKC').trim().toLocaleLowerCase('de')
    ] ??
    (provider ? config.apiUrl + '/api/v1' + provider : undefined)
  );
}
export function Avatar({
  config,
  id,
  name,
  provider,
}: {
  config: PublicConfig;
  id: string;
  name: string;
  provider?: string;
}) {
  const src = avatarUrl(config, id, name, provider);
  const [failed, setFailed] = useState<string>();
  const initials = name
    .trim()
    .split(/\s+/)
    .map((s) => s[0])
    .slice(0, 2)
    .join('');
  return src && failed !== src ? (
    <img
      className="avatar"
      src={src}
      alt={'Profilbild ' + name}
      onError={() => setFailed(src)}
    />
  ) : (
    <span className="avatar" aria-hidden="true">
      {initials}
    </span>
  );
}
