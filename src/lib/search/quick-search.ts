// Pure helpers for the Ctrl+K command palette: term validation and page/action matching.

export const QUICK_SEARCH_MIN_LENGTH = 2;
export const QUICK_SEARCH_MAX_LENGTH = 80;
export const QUICK_SEARCH_PATIENT_LIMIT = 8;

export type QuickCommand = { href: string; label: string; keywords: string; section: "Pages" | "Actions" };

// Mirrors the constraints enforced by public.search_patients so invalid terms never reach the database.
export function normalizeQuickSearchTerm(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const term = value.trim().replace(/\s+/g, " ");
  if (term.length < QUICK_SEARCH_MIN_LENGTH || term.length > QUICK_SEARCH_MAX_LENGTH) return null;
  if (term.includes("%") || term.includes("_")) return null;
  return term;
}

export function foldForSearch(value: string): string {
  return value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();
}

// Every word of the query must appear in the label or keywords (accent- and case-insensitive).
export function filterQuickCommands(commands: readonly QuickCommand[], query: string): QuickCommand[] {
  const words = foldForSearch(query).split(/\s+/).filter(Boolean);
  if (!words.length) return [...commands];
  return commands.filter((command) => {
    const haystack = foldForSearch(`${command.label} ${command.keywords}`);
    return words.every((word) => haystack.includes(word));
  });
}

export function patientSearchHref(term: string): string {
  return `/patients?query=${encodeURIComponent(term)}`;
}
