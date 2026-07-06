// Pays supportés à la création de compte et opérateurs Mobile Money par pays.
// Partagé client/serveur — ne rien importer de spécifique au serveur ici.

export type CountryIso = "CM" | "BJ" | "CI" | "GA";
export type MomoOperator = "ORANGE" | "MTN" | "WAVE" | "MOOV" | "AIRTEL";

export const SUPPORTED_COUNTRIES: { iso: CountryIso; flag: string; name: string }[] = [
  { iso: "CM", flag: "🇨🇲", name: "Cameroun" },
  { iso: "BJ", flag: "🇧🇯", name: "Bénin" },
  { iso: "CI", flag: "🇨🇮", name: "Côte d'Ivoire" },
  { iso: "GA", flag: "🇬🇦", name: "Gabon" },
];

export const SUPPORTED_COUNTRY_ISOS = SUPPORTED_COUNTRIES.map((c) => c.iso) as [
  CountryIso,
  ...CountryIso[],
];

export const OPERATOR_LABELS: Record<MomoOperator, string> = {
  ORANGE: "Orange Money",
  MTN: "MTN MoMo",
  WAVE: "Wave",
  MOOV: "Moov Money",
  AIRTEL: "Airtel Money",
};

export const OPERATORS_BY_COUNTRY: Record<CountryIso, MomoOperator[]> = {
  CM: ["ORANGE", "MTN"],
  BJ: ["MOOV", "MTN"],
  CI: ["ORANGE", "WAVE", "MTN"],
  GA: ["AIRTEL", "MOOV"],
};

/** Opérateurs du pays ; tous les opérateurs si le pays est inconnu (anciens comptes). */
export function operatorsForCountry(iso: string | null | undefined): MomoOperator[] {
  if (iso && iso in OPERATORS_BY_COUNTRY) return OPERATORS_BY_COUNTRY[iso as CountryIso];
  return Object.keys(OPERATOR_LABELS) as MomoOperator[];
}
