// Clinic time (Morocco). Since 2026-09-20 01:00 UTC Morocco is permanently on UTC+0
// (IANA tzdata 2026c), but browsers, Node and Supabase still ship older tz data that
// keeps Africa/Casablanca on UTC+1. Clinic dates are therefore formatted with the
// historical Africa/Casablanca rules before the switch and with UTC afterwards.
// Mirrors private.clinic_local / private.clinic_instant in the database.

export const MOROCCO_PERMANENT_UTC_FROM = Date.UTC(2026, 8, 20, 1, 0, 0);
const LEGACY_ZONE = "Africa/Casablanca";

export function clinicTimeZoneAt(date: Date | number): "UTC" | typeof LEGACY_ZONE {
  return +date >= MOROCCO_PERMANENT_UTC_FROM ? "UTC" : LEGACY_ZONE;
}

// Drop-in replacement for Intl.DateTimeFormat that always renders clinic time.
export class ClinicDateTimeFormat {
  private readonly legacy: Intl.DateTimeFormat;
  private readonly current: Intl.DateTimeFormat;

  constructor(locale: string, options: Omit<Intl.DateTimeFormatOptions, "timeZone"> = {}) {
    this.legacy = new Intl.DateTimeFormat(locale, { ...options, timeZone: LEGACY_ZONE });
    this.current = new Intl.DateTimeFormat(locale, { ...options, timeZone: "UTC" });
  }

  private pick(date: Date | number) {
    return +date >= MOROCCO_PERMANENT_UTC_FROM ? this.current : this.legacy;
  }

  format(date: Date | number = Date.now()): string {
    return this.pick(date).format(date);
  }

  formatToParts(date: Date | number = Date.now()): Intl.DateTimeFormatPart[] {
    return this.pick(date).formatToParts(date);
  }
}
