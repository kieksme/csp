import { useEffect, useRef, useState } from 'react';
import { useAccount } from '@kieksme/csp-sdk/browser';

export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  const letters =
    parts.length > 1 ? [parts[0], parts[parts.length - 1]] : [parts[0]];
  return letters
    .map((part) => Array.from(part)[0])
    .join('')
    .toLocaleUpperCase('de-DE');
}

/** Round avatar in the header with a menu to sign out; hidden when nobody is signed in. */
export function AccountMenu() {
  const account = useAccount();
  const [open, setOpen] = useState(false);
  const [photoFailed, setPhotoFailed] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  useEffect(() => setPhotoFailed(false), [account?.photoUrl]);
  useEffect(() => {
    if (!open) return;
    const close = (event: Event) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setOpen(false);
      button.current?.focus();
    };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', escape);
    };
  }, [open]);
  if (!account) return null;
  const logout = account.logout;
  return (
    <div className="account-menu relative" ref={root}>
      <button
        ref={button}
        type="button"
        className="account-button grid place-items-center w-[36px] h-[36px] rounded-full overflow-hidden border border-line bg-accent text-accent-ink text-[0.75rem] font-bold p-0 cursor-pointer"
        aria-label={`Konto: ${account.name}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        {account.photoUrl && !photoFailed ? (
          <img
            className="w-full h-full object-cover"
            src={account.photoUrl}
            alt=""
            referrerPolicy="no-referrer"
            onError={() => setPhotoFailed(true)}
          />
        ) : (
          <span aria-hidden="true">{initials(account.name)}</span>
        )}
      </button>
      {open && (
        <div
          className="account-popover absolute right-0 top-[calc(100%_+_8px)] min-w-[200px] max-w-[280px] bg-card text-ink border border-line rounded-card p-2 z-[20] shadow-lg"
          role="menu"
          aria-label="Konto"
        >
          <p className="m-0 px-3 py-2 text-[0.8125rem] font-bold break-words">
            {account.name}
          </p>
          {logout && (
            <button
              type="button"
              role="menuitem"
              className="block w-full text-left [background:none] border-0 px-3 py-2 rounded text-[0.8125rem] text-ink cursor-pointer hover:bg-soft"
              autoFocus
              onClick={() => {
                setOpen(false);
                void logout();
              }}
            >
              Abmelden
            </button>
          )}
        </div>
      )}
    </div>
  );
}
