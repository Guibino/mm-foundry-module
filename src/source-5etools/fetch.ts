/**
 * Baixa o bestiario XMM (Monster Manual 2024/2025) do 5e.tools para uso LOCAL.
 * Roda no SEU ambiente (usa fetch nativo do Node). Grava data/raw/5etools-xmm.json.
 *
 * IMPORTANTE: os dados sao da Wizards of the Coast (hospedados no 5e.tools).
 * O download e para uso pessoal no seu ambiente; nada disso vai para o
 * repositorio (data/raw e gitignored). Respeite os termos do 5e.tools.
 *
 * Executar: npm run fetch:5e   (variavel MM5E_SOURCE p/ trocar "XMM")
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { paths } from "../config.js";
import { makeLogger } from "../util/log.js";

const log = makeLogger("fetch:5e");
const SOURCE = (process.env.MM5E_SOURCE ?? "xmm").toLowerCase();
const BASE = "https://5e.tools/data/bestiary";

async function getJson(url: string): Promise<any> {
  const r = await fetch(url, { headers: { "User-Agent": "mm2024-foundry-builder (uso pessoal)" } });
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return r.json();
}

async function main() {
  log.info(`Fonte: ${SOURCE.toUpperCase()} (${BASE}/bestiary-${SOURCE}.json)`);
  const data = await getJson(`${BASE}/bestiary-${SOURCE}.json`);
  const monsters = (data.monster ?? []).filter((m: any) => !m._copy || m._copy);
  await mkdir(paths.raw, { recursive: true });
  const out = path.join(paths.raw, "5etools-xmm.json");
  await writeFile(out, JSON.stringify(data, null, 2), "utf8");
  log.ok(`${monsters.length} criaturas baixadas -> data/raw/5etools-xmm.json`);
  log.info("Agora rode: npm run build:5e");
}
main().catch((e) => { log.error(e); process.exit(1); });
