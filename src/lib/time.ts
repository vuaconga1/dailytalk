/** Learning days follow Vietnam time (UTC+7, no DST). */
const VN_OFFSET_MS = 7 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** YYYY-MM-DD in Asia/Ho_Chi_Minh. */
export function vnDate(at: Date | number = Date.now()): string {
  return new Date(+at + VN_OFFSET_MS).toISOString().slice(0, 10);
}

export function vnDayStart(at: Date | number = Date.now()): Date {
  return new Date(Date.parse(vnDate(at)) - VN_OFFSET_MS);
}

export function vnNextMidnight(at: Date | number = Date.now()): Date {
  return new Date(vnDayStart(at).getTime() + DAY_MS);
}

export function shiftDays(date: string, days: number): string {
  return new Date(Date.parse(date) + days * DAY_MS).toISOString().slice(0, 10);
}

const WEEKDAYS = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

export function vnWeekday(date: string): string {
  return WEEKDAYS[new Date(Date.parse(date)).getUTCDay()];
}

export function formatVnDate(date: string): string {
  return date.split("-").reverse().join("/");
}

/** Minutes since Vietnam midnight. */
export function vnMinuteOfDay(at: Date | number = Date.now()): number {
  return Math.floor(((+at + VN_OFFSET_MS) % DAY_MS) / 60_000);
}

/** "HH:MM" → minutes since midnight. */
export function minutesOf(studyTime: string): number {
  const [h, m] = studyTime.split(":").map(Number);
  return h * 60 + m;
}

/** Monday (YYYY-MM-DD) of the Vietnam week containing `date`. */
export function weekStartOf(date: string): string {
  const weekday = new Date(Date.parse(date)).getUTCDay();
  return shiftDays(date, -((weekday + 6) % 7));
}

export function isStudyTime(value: unknown): value is string {
  return typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}
