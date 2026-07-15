/**
 * Renderizador das marcacoes do 5e.tools ({@tag ...}) para texto legivel.
 *
 * O 5e.tools usa marcacao propria dentro das descricoes. Aqui convertemos para
 * texto limpo (a traducao PT-BR dos termos e feita depois pelo glossario).
 * Cobre as tags mais comuns do bestiario; tags desconhecidas caem no fallback
 * generico (usa o texto de exibicao ou a primeira parte antes de "|").
 */

const SIMPLE: Record<string, string> = {
  h: "Hit: ",
  hom: "",
};

function renderTag(tag: string, body: string): string {
  if (!body) return SIMPLE[tag] ?? "";
  const parts = body.split("|");
  const ABIL: Record<string, string> = { str: "Strength", dex: "Dexterity", con: "Constitution", int: "Intelligence", wis: "Wisdom", cha: "Charisma" };
  switch (tag) {
    case "atk":
    case "atkr": {
      const t = body.toLowerCase();
      const melee = t.includes("m");
      const ranged = t.includes("r");
      if (melee && ranged) return "Melee or Ranged Attack Roll:";
      if (ranged) return "Ranged Attack Roll:";
      return "Melee Attack Roll:";
    }
    case "actSave": return `${ABIL[parts[0]?.toLowerCase() ?? ""] ?? ""} Saving Throw:`;
    case "actSaveSuccess": return "Success:";
    case "actSaveFail": return "Failure:";
    case "hit": return `+${parts[0]}`;
    case "dc": return `DC ${parts[0]}`;
    case "damage":
    case "dice":
    case "d20":
    case "scaledamage":
    case "scaledice": return (parts[1] || parts[0]) ?? "";
    case "recharge": return `(Recharge ${parts[0] || "6"})`;
    case "condition":
    case "status":
    case "skill":
    case "sense":
    case "spell":
    case "item":
    case "creature":
    case "damageType": return parts[2] || parts[0] || "";
    case "b":
    case "bold":
    case "i":
    case "italic":
    case "note":
    case "book":
    case "filter":
    case "quickref":
    case "5etools":
    case "adventure": return parts[0] ?? "";
    default: return parts[2] || parts[0] || "";
  }
}

/** Converte texto com {@tags} do 5e.tools em texto limpo. */
export function render5e(input: unknown): string {
  if (input == null) return "";
  let s = String(input);
  // resolve tags aninhadas iterativamente
  for (let i = 0; i < 6 && s.includes("{@"); i++) {
    s = s.replace(/\{@(\w+)\s*([^{}]*)\}/g, (_m, tag, body) => renderTag(tag, body));
  }
  return s.replace(/\s+/g, " ").trim();
}

/** Renderiza uma lista de "entries" do 5e.tools (strings ou objetos) em texto. */
export function renderEntries(entries: unknown): string {
  if (entries == null) return "";
  if (typeof entries === "string") return render5e(entries);
  if (Array.isArray(entries)) return entries.map(renderEntries).filter(Boolean).join("\n");
  const e = entries as any;
  if (e.entries) return renderEntries(e.entries);
  if (e.items) return renderEntries(e.items);
  if (typeof e.entry === "string") return render5e(e.entry);
  return "";
}
