import { useSyncExternalStore } from 'react';

/** Signed-in portal user, published by an authentication integration. */
export interface PortalAccount {
  /** Display name confirmed by the identity provider. */
  name: string;
  /** Optional profile picture (object or same-origin URL); initials are used when absent. */
  photoUrl?: string;
  /** Ends the session. Omit when the deployment offers no sign-out. */
  logout?: () => void | Promise<void>;
}

interface Store {
  account: PortalAccount | null;
  listeners: Set<() => void>;
}

// Kept on globalThis so plugins bundled separately still share one store.
const key = Symbol.for('@kieksme/csp-sdk/account');
const store: Store = ((globalThis as Record<symbol, unknown>)[key] ??= {
  account: null,
  listeners: new Set(),
}) as Store;

/** Publish (or clear with `null`) the signed-in account shown in the portal header. */
export function publishAccount(account: PortalAccount | null) {
  store.account = account;
  for (const listener of [...store.listeners]) listener();
}

export function getAccount() {
  return store.account;
}

function subscribe(listener: () => void) {
  store.listeners.add(listener);
  return () => void store.listeners.delete(listener);
}

/** React hook returning the currently published account, or `null`. */
export function useAccount(): PortalAccount | null {
  return useSyncExternalStore(subscribe, getAccount, () => null);
}
