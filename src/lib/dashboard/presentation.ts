const quotes = [
  "Chaque sourire soigné construit une confiance durable.",
  "La précision d’aujourd’hui fait le confort de demain.",
  "Une journée bien organisée laisse plus de place au soin.",
  "L’attention portée aux détails transforme l’expérience patient.",
  "Prendre soin, c’est aussi anticiper avec sérénité.",
] as const;

const dashboardMoney = new Intl.NumberFormat("fr-MA", {
  style: "currency",
  currency: "MAD",
  maximumFractionDigits: 0,
});

export function formatDashboardMoney(value: number): string {
  return dashboardMoney.format(value);
}

export function dashboardQuote(clinicDate: string): string {
  const numericDate = Number(clinicDate.replaceAll("-", ""));
  return quotes[Number.isFinite(numericDate) ? numericDate % quotes.length : 0];
}

export function frenchClinicDate(clinicDate: string): string {
  const date = new Date(`${clinicDate}T12:00:00.000Z`);
  const value = new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
  return value.charAt(0).toUpperCase() + value.slice(1);
}
