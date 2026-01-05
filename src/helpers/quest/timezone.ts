/**
 * Timezone utilities for quest generation
 */
import logger from '../logger';

/**
 * Get user's local date components with timezone support
 * Falls back to UTC if timezone is invalid
 */
export function getUserLocalComponents(tz: string, logPrefix = '[Quest]') {
  try {
    const now = new Date();
    const dateKey = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(now); // YYYY-MM-DD

    const hourStr = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hour12: false,
      hour: '2-digit',
    }).format(now);

    return { dateKey, hour: parseInt(hourStr, 10) };
  } catch (error) {
    // Invalid timezone - fallback to UTC
    logger.warn(`${logPrefix} Invalid timezone, using UTC`, { timezone: tz });
    return getUserLocalComponents('UTC', logPrefix);
  }
}

/**
 * Get user's local date components with weekday information
 * Used for weekly quest generation
 */
export function getUserLocalComponentsWithWeekday(tz: string, logPrefix = '[Quest]') {
  try {
    const now = new Date();
    const dateKey = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(now);

    const weekdayStr = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      weekday: 'short',
    }).format(now);

    const hourStr = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hour: '2-digit',
      hour12: false,
    }).format(now);

    const weekdayMap: Record<string, number> = {
      Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
    };

    return {
      dateKey,
      hour: parseInt(hourStr, 10),
      weekday: weekdayMap[weekdayStr] ?? 0,
    };
  } catch (error) {
    logger.warn(`${logPrefix} Invalid timezone, using UTC`, { timezone: tz });
    return getUserLocalComponentsWithWeekday('UTC', logPrefix);
  }
}

/**
 * Compute the Monday date (week key) from a local date
 */
export function computeWeekKeyFromLocal(dateKey: string, weekday: number): string {
  // convert Mon=1 → offset=0, Sun=0 → offset=6
  const daysToMonday = (weekday + 6) % 7;

  const [y, m, d] = dateKey.split('-').map(n => parseInt(n, 10));
  const utc = new Date(Date.UTC(y, m - 1, d));
  const shift = utc.getTime() - daysToMonday * 86400000;

  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'UTC',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(shift));
}
