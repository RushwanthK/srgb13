// All timestamps arrive as UTC ISO strings and are displayed in UK local time.
const TZ = "Europe/London";

const timeFmt = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });
const hourFmt = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "numeric", hourCycle: "h23" });
const axisDayFmt = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, day: "numeric", month: "short" });
// Plain dates (YYYY-MM-DD) are calendar days, so format them in UTC to avoid shifting.
const dayFmt = new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" });
const longDayFmt = new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", day: "numeric", month: "short", year: "numeric" });

const toDate = (v: string | number) => new Date(v);

export const fmtTime = (v: string | number) => timeFmt.format(toDate(v));
/** e.g. "27 Jan 09:30" (UK time) */
export const fmtDateTime = (v: string | number) => `${axisDayFmt.format(toDate(v))} ${timeFmt.format(toDate(v))}`;
export const fmtAxisDay = (v: string | number) => axisDayFmt.format(toDate(v));
export const fmtDay = (day: string) => dayFmt.format(new Date(`${day}T00:00:00Z`));
export const fmtLongDay = (day: string) => longDayFmt.format(new Date(`${day}T00:00:00Z`));
export const londonHour = (iso: string) => Number(hourFmt.format(toDate(iso)));

/** ISO timestamp -> UTC epoch ms, for numeric chart axes. */
export const toMs = (iso: string) => Date.parse(iso);

export const fmtHours = (h: number | null | undefined) =>
  h === null || h === undefined ? "—" : `${h.toFixed(1).replace(/\.0$/, "")} h`;
