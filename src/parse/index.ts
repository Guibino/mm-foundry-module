/**
 * Etapa 2/3 — Parser.
 * Le data/raw/pages.json, extrai os stat blocks e grava
 * data/intermediate/monsters.en.json (validado por Zod).
 * Executar: npm run parse
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { paths } from "../config.js";
import { makeLogger } from "../util/log.js";
import { parseMonsters } from "./parser.js";
import { Monster } from "./schema.js";

const log = makeLogger("parse");

async function main() {
  const pages = JSON.parse(await readFile(paths.rawPages, "utf8"));
  const raw = parseMonsters(pages);
  const valid: Monster[] = [];
  let invalid = 0;
  for (const m of raw) {
    const r = Monster.safeParse(m);
    if (r.success) valid.push(r.data);
    else { invalid++; log.debug("invalido:", m.name, r.error.issues[0]?.message); }
  }
  await mkdir(paths.intermediate, { recursive: true });
  await writeFile(paths.monstersEn, JSON.stringify(valid, null, 2), "utf8");
  const withWarn = valid.filter((m) => m.warnings.length).length;
  log.ok(`${valid.length} monstros parseados (${invalid} invalidos, ${withWarn} com avisos) -> monsters.en.json`);
}
main().catch((e) => { log.error(e); process.exit(1); });
