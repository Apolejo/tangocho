/**
 * Persistent storage (SPEC §10.1): asks the browser not to clear the log when space runs low or
 * the site goes unused. Asked once there is progress, never on a blank first visit. Every API is
 * feature-detected: none exists outside a secure context (the phone over LAN http in dev).
 */

export type PersistStatus = 'persisted' | 'not-persisted' | 'unsupported';

function storageManager(): StorageManager | undefined {
  try {
    return typeof navigator === 'undefined' ? undefined : navigator.storage;
  } catch {
    return undefined;
  }
}

/** Whether the browser has granted persistent storage. */
export async function persistStatus(): Promise<PersistStatus> {
  const storage = storageManager();
  if (typeof storage?.persisted !== 'function') return 'unsupported';
  try {
    return (await storage.persisted()) ? 'persisted' : 'not-persisted';
  } catch {
    return 'unsupported';
  }
}

let asked = false;

/** Asks once per launch, and only if it isn't granted yet. Never throws. */
export async function requestPersistence(): Promise<PersistStatus> {
  const status = await persistStatus();
  if (status !== 'not-persisted' || asked) return status;
  asked = true;
  const storage = storageManager();
  try {
    return (await storage?.persist()) === true ? 'persisted' : 'not-persisted';
  } catch {
    return 'not-persisted';
  }
}
