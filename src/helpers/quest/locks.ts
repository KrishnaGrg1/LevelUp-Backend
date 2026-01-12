/**
 * Lock mechanism to prevent concurrent quest generation for the same user
 */

const locks = new Map<string, number>();

export async function acquireLock(
  key: string,
  timeoutSeconds: number
): Promise<boolean> {
  const now = Date.now();
  const existingLock = locks.get(key);

  if (existingLock && existingLock > now) {
    return false; // Lock already held
  }

  locks.set(key, now + timeoutSeconds * 1000);
  return true;
}

export async function releaseLock(key: string): Promise<void> {
  locks.delete(key);
}
