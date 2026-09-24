// Pure helpers for the doctor's monthly statistics page.

export type MonthFigures = { month: string; production: number; received: number; newPatients: number; completed: number; noShow: number; cancelled: number; scheduled: number };
export type NatureFigure = { nature: string; amount: number; count: number };
export type CareTypeFigure = { careType: string; amount: number; count: number; share: number };

// Intervention wording is free text; keywords fold it into care types (accents and case ignored).
const careTypeRules: [string, RegExp][] = [
  ["Implantologie", /implant|pilier|greffe|sinus/],
  ["Orthodontie", /orthodon|appareil|aligneur|bague|gouttiere|contention/],
  ["Prothèse et couronnes", /couronne|prothese|bridge|facette|inlay|onlay|dentier|stellite/],
  ["Endodontie", /endodon|devitalis|canal|pulp/],
  ["Parodontie et détartrage", /detartr|parodon|surfacage|curetage|nettoyage/],
  ["Chirurgie et extractions", /extract|chirurg|dent de sagesse|kyste/],
  ["Soins conservateurs", /carie|composite|obtur|amalgame|soin/],
  ["Esthétique", /blanchi|esthet/],
  ["Radiologie", /radio|panoramique|scanner|cone beam/],
  ["Consultations et contrôles", /consult|control|bilan|urgence|examen|suivi/],
];
export const OTHER_CARE_TYPE = "Autres soins";

export function careTypeOf(nature: string): string {
  const folded = nature.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
  return careTypeRules.find(([, pattern]) => pattern.test(folded))?.[0] ?? OTHER_CARE_TYPE;
}

export function groupByCareType(natures: NatureFigure[]): CareTypeFigure[] {
  const totals = new Map<string, { cents: number; count: number }>();
  for (const item of natures) {
    const type = careTypeOf(item.nature);
    const current = totals.get(type) ?? { cents: 0, count: 0 };
    totals.set(type, { cents: current.cents + Math.round(item.amount * 100), count: current.count + item.count });
  }
  const grand = [...totals.values()].reduce((sum, value) => sum + value.cents, 0);
  return [...totals.entries()]
    .map(([careType, value]) => ({ careType, amount: value.cents / 100, count: value.count, share: grand ? value.cents / grand : 0 }))
    .sort((a, b) => b.amount - a.amount || a.careType.localeCompare(b.careType, "fr"));
}

// Missed visits among visits whose outcome is known; null when there is nothing to measure.
export function noShowRate(figures: Pick<MonthFigures, "completed" | "noShow">): number | null {
  const known = figures.completed + figures.noShow;
  return known ? figures.noShow / known : null;
}

// Relative change against the previous month; null when the previous value is zero.
export function relativeChange(current: number, previous: number): number | null {
  return previous ? (current - previous) / previous : null;
}

export function shiftMonth(month: string, delta: number): string {
  const [year, value] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, value - 1 + delta, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

// ?month=YYYY-MM, between January 2020 and the current clinic month; otherwise the current month.
export function parseStatisticsMonth(value: unknown, currentMonth: string): string {
  if (typeof value !== "string" || !/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) return currentMonth;
  return value >= "2020-01" && value <= currentMonth ? value : currentMonth;
}

export function monthLabel(month: string, style: "long" | "short" = "long"): string {
  const [year, value] = month.split("-").map(Number);
  return new Intl.DateTimeFormat("fr-FR", { month: style, year: style === "long" ? "numeric" : "2-digit", timeZone: "UTC" }).format(new Date(Date.UTC(year, value - 1, 15)));
}
