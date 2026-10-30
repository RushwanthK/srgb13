const int = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 0 });
const one = new Intl.NumberFormat("en-GB", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

const isNum = (v: number | null | undefined): v is number => v !== null && v !== undefined && Number.isFinite(v);

export const DASH = "—";

export const fmtMW = (v: number | null | undefined) => (isNum(v) ? `${int.format(v)} MW` : DASH);
export const fmtNum = (v: number | null | undefined) => (isNum(v) ? int.format(v) : DASH);
export const fmtSignedMW = (v: number | null | undefined) =>
  isNum(v) ? `${v > 0 ? "+" : v < 0 ? "−" : ""}${int.format(Math.abs(v))} MW` : DASH;
export const fmtPct = (v: number | null | undefined) => (isNum(v) ? `${one.format(v)}%` : DASH);
export const fmtSignedPct = (v: number | null | undefined) =>
  isNum(v) ? `${v > 0 ? "+" : v < 0 ? "−" : ""}${one.format(Math.abs(v))}%` : DASH;
export const fmtGW = (v: number | null | undefined) => (isNum(v) ? `${one.format(v / 1000)} GW` : DASH);
export const fmtAxisGW = (v: number) => `${one.format(v / 1000)}`;
