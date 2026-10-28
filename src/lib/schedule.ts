import { atHour, isSameDay, toLocalInputValue } from "./dates";

/**
 * Starting date/time for a new post (as a datetime-local value): 10:00 on the
 * chosen day, or the next full hour when that day is today and 10:00 has passed.
 * This keeps "Approve & schedule" usable straight away.
 */
export function defaultSchedule(defaultDate?: Date, now: Date = new Date()): string {
  const nextHour = new Date(now);
  nextHour.setMinutes(0, 0, 0);
  nextHour.setHours(nextHour.getHours() + 1);

  if (!defaultDate) return toLocalInputValue(nextHour);

  const morning = atHour(defaultDate, 10);
  const isToday = isSameDay(defaultDate, now);
  return toLocalInputValue(isToday && morning.getTime() <= now.getTime() ? nextHour : morning);
}
