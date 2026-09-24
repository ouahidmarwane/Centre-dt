// Motivational lines for the doctor and the assistant; one per clinic hour.
export const motivationalQuotes = [
  "L’excellence au service de votre sourire.",
  "Chaque sourire soigné construit une confiance durable.",
  "La précision d’aujourd’hui fait le confort de demain.",
  "Une journée bien organisée laisse plus de place au soin.",
  "L’attention portée aux détails transforme l’expérience patient.",
  "Prendre soin, c’est aussi anticiper avec sérénité.",
  "Un patient rassuré est déjà à moitié soigné.",
  "Votre douceur rend les soins plus faciles à vivre.",
  "Chaque rendez-vous tenu est une promesse respectée.",
  "Un geste sûr, une parole claire, un patient serein.",
  "Le sourire que vous redonnez accompagne vos patients partout.",
  "La qualité se construit un patient après l’autre.",
  "Une équipe unie fait un cabinet d’exception.",
  "L’écoute est le premier instrument du soin.",
  "Bien expliquer, c’est déjà bien soigner.",
  "Chaque détail compte, et vous faites la différence.",
  "La constance fait la réputation du cabinet.",
  "Un accueil chaleureux donne envie de revenir.",
  "Soigner avec rigueur, accueillir avec le sourire.",
  "Votre patience d’aujourd’hui devient la confiance de demain.",
  "Une hygiène irréprochable est la base de tout soin.",
  "Chaque dossier bien tenu protège le patient et l’équipe.",
  "Le calme de l’équipe rassure la salle d’attente.",
  "Petit progrès chaque jour, grand cabinet chaque année.",
  "Faire simple et bien fait, c’est déjà l’excellence.",
  "Votre énergie donne le ton de toute la journée.",
  "La confiance d’un patient se gagne à chaque visite.",
  "Un sourire soigné, c’est une personne plus confiante.",
  "Prenez soin de vous pour mieux prendre soin des autres.",
  "Fiers du travail accompli, prêts pour le prochain sourire.",
] as const;

const dashboardMoney = new Intl.NumberFormat("fr-MA", {
  style: "currency",
  currency: "MAD",
  maximumFractionDigits: 0,
});

export function formatDashboardMoney(value: number): string {
  return dashboardMoney.format(value);
}

// Changes every clinic hour. Hours are numbered continuously across days so the
// sequence never restarts at midnight and consecutive hours always differ.
export function hourlyQuote(clinicDate: string, clinicHour: number): string {
  const day = Math.floor(Date.parse(`${clinicDate}T00:00:00Z`) / 86_400_000);
  const slot = Number.isFinite(day) && Number.isInteger(clinicHour) ? day * 24 + clinicHour : 0;
  return motivationalQuotes[((slot % motivationalQuotes.length) + motivationalQuotes.length) % motivationalQuotes.length];
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
