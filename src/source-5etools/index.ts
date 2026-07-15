/**
 * Converte o bestiario XMM baixado (data/raw/5etools-xmm.json) para o schema
 * intermediario Monster (data/intermediate/monsters.en.json). Depois disso o
 * pipeline segue igual: translate -> normalize -> build:pack -> report.
 *
 * Resolve _copy (heranca entre criaturas do 5e.tools) de forma simples.
 * Executar: npm run convert:5e
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { paths } from "../config.js";
import { makeLogger } from "../util/log.js";
import { convert5e } from "./convert.js";
import { Monster } from "../parse/schema.js";

const log = makeLogger("convert:5e");

async function main() {
  const src = path.join(paths.raw, "5etools-xmm.json");
  const data = JSON.parse(await readFile(src, "utf8"));
  const raw: any[] = data.monster ?? [];
  const byName = new Map(raw.map((m) => [`${m.name}|${m.source}`, m]));

  // resolve _copy (heranca) de forma rasa: mescla o base sob o override
  const resolve = (m: any): any => {
    if (!m._copy) return m;
    const base = byName.get(`${m._copy.name}|${m._copy.source}`);
    if (!base) return m;
    return { ...resolve(base), ...m, _copy: undefined };
  };

  const valid: Monster[] = [];
  let invalid = 0;
  for (const m of raw) {
    try {
      const conv = convert5e(resolve(m));
      const r = Monster.safeParse(conv);
      if (r.success) valid.push(r.data);
      else { invalid++; log.debug("invalido:", m.name, r.error.issues[0]?.message); }
    } catch (e) { invalid++; log.debug("erro:", m?.name, (e as Error).message); }
  }
  await mkdir(paths.intermediate, { recursive: true });
  await writeFile(paths.monstersEn, JSON.stringify(valid, null, 2), "utf8");
  log.ok(`${valid.length} criaturas convertidas (${invalid} invalidas) -> monsters.en.json`);
}
main().catch((e) => { log.error(e); process.exit(1); });
