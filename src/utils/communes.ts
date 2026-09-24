// Communes d'Abidjan détectées dans les adresses libres des livraisons.
// Placées par ordre de spécificité (noms composés d'abord).
export const COMMUNES = [
  "Port-Bouët",
  "Port-Bouet",
  "Grand-Bassam",
  "Attécoubé",
  "Attecoube",
  "Bingerville",
  "Treichville",
  "Koumassi",
  "Marcory",
  "Plateau",
  "Yopougon",
  "Cocody",
  "Adjamé",
  "Adjame",
  "Abobo",
  "Anyama",
  "Songon",
];

const NORMALIZE: Record<string, string> = {
  "Port-Bouet": "Port-Bouët",
  Attecoube: "Attécoubé",
  Adjame: "Adjamé",
};

export function detectCommune(address?: string): string {
  const a = (address || "").toLowerCase();
  for (const commune of COMMUNES) {
    if (a.includes(commune.toLowerCase())) {
      return NORMALIZE[commune] || commune;
    }
  }
  return "Autre";
}
