/**
 * Etapa 6 — Normalizacao / criacao dos Actors.
 * Le monsters.pt.json, gera um documento Actor npc do dnd5e por monstro e
 * grava em module/packs/_source/<slug>.json (formato consumido pelo
 * foundryvtt-cli compilePack). Executar: npm run normalize
 */
import { mkdir, readFile, writeFile, readdir, rm } from "node:fs/promises";
import path from "node:path";
import { paths } from "../config.js";
import { makeLogger } from "../util/log.js";
import { toActor } from "./dnd5e.js";
import { buildTypeFolders } from "./folders.js";
import { glossary } from "../translate/glossary.js";

const log = makeLogger("normalize");

const slug = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 60);

async function main() {
  const monsters = JSON.parse(await readFile(paths.monstersPt, "utf8"));
  await mkdir(paths.packSource, { recursive: true });
  // limpa _source anterior
  for (const f of await readdir(paths.packSource).catch(() => [])) {
    if (f.endsWith(".json")) await rm(path.join(paths.packSource, f));
  }
  // pastas por tipo de criatura (organizacao interna do compendio)
  const typeKeys = new Set<string>(monsters.map((m: any) => glossary.typeKeys[m.type] ?? "unknown"));
  const { docs: folders, byType } = buildTypeFolders(typeKeys);
  for (const f of folders) await writeFile(path.join(paths.packSource, `_folder-${f._id}.json`), JSON.stringify(f, null, 2), "utf8");

  const seen = new Set<string>();
  let n = 0;
  for (const m of monsters) {
    const key = glossary.typeKeys[m.type] ?? "unknown";
    const actor = toActor(m, byType.get(key));
    let s = slug(actor.flags.mm2024.nameEn || actor.name) || "monstro";
    while (seen.has(s)) s += "-2";
    seen.add(s);
    await writeFile(path.join(paths.packSource, `${s}.json`), JSON.stringify(actor, null, 2), "utf8");
    n++;
  }
  log.ok(`${n} atores em ${folders.length} pastas de tipo -> module/packs/_source/`);
}
main().catch((e) => { log.error(e); process.exit(1); });
