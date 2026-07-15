/**
 * Pastas internas do Compendium, organizando os monstros por TIPO de criatura
 * (Aberração, Besta, Dragão, ...), no estilo de organizacao do projeto
 * dnd-pt-br/livro-jogador. Gera os documentos "!folders!" e o mapa tipo->pasta.
 */
import { createHash } from "node:crypto";
import { glossary } from "../translate/glossary.js";

function fid(seed: string): string {
  const AB = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const h = createHash("sha1").update("folder:" + seed).digest();
  let o = ""; for (let i = 0; i < 16; i++) o += AB[h[i]! % AB.length];
  return o;
}

/** cor por tipo (paleta simples e estavel). */
const COLORS: Record<string, string> = {
  aberration: "#6b3fa0", beast: "#4c7a34", celestial: "#c9a227", construct: "#7a7a7a",
  dragon: "#a4262c", elemental: "#2f7d9c", fey: "#2e8b57", fiend: "#7d1f1f",
  giant: "#8a5a2b", humanoid: "#3a6ea5", monstrosity: "#804e2d", ooze: "#5a7d2a",
  plant: "#3f7d3f", undead: "#4a4a55", unknown: "#555555",
};

export interface FolderDoc {
  _id: string; _key: string; name: string; type: "Actor";
  sorting: "a"; color: string; folder: null; sort: number; flags: Record<string, unknown>;
}

/** Constroi as pastas para os tipos presentes e um mapa typeKey -> folderId. */
export function buildTypeFolders(typeKeys: Set<string>): { docs: FolderDoc[]; byType: Map<string, string> } {
  // key(en) -> nome PT via glossario
  const keyToPt = new Map<string, string>();
  for (const [en, key] of Object.entries(glossary.typeKeys)) keyToPt.set(key, glossary.types[en] ?? en);
  const byType = new Map<string, string>();
  const docs: FolderDoc[] = [];
  let sort = 0;
  for (const key of [...typeKeys].sort()) {
    const name = keyToPt.get(key) ?? "Outros";
    const id = fid(key || "unknown");
    byType.set(key, id);
    docs.push({
      _id: id, _key: `!folders!${id}`, name, type: "Actor",
      sorting: "a", color: COLORS[key] ?? COLORS.unknown!, folder: null, sort: (sort += 100), flags: {},
    });
  }
  return { docs, byType };
}
