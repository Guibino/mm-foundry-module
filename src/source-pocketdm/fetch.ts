/**
 * Baixa as traducoes PT do Pocket DM (https://pocketdm.com.br, CC-BY-4.0) para
 * data/pocketdm/pt.json. Indexa por NOME INGLES (da URL do token XMM) para casar
 * com os monstros do modulo (Monster Manual 2024). O conteudo e usado depois
 * apenas quando a mecanica confere (ver src/translate/pocketdm.ts).
 *
 * Rode por sua conta, respeitando os termos do site. Executar: npm run fetch:pocket
 * Variavel MM_POCKET_DELAY (ms entre requisicoes; padrao 120).
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { paths } from "../config.js";
import { makeLogger } from "../util/log.js";

const log = makeLogger("fetch:pocket");
const BASE = "https://pocketdm.com.br/monstros";
const DELAY = Number(process.env.MM_POCKET_DELAY ?? 120);
const UA = { "User-Agent": "Mozilla/5.0 (mm2024-foundry-builder; uso pessoal)" };
const SECTIONS = ["special_abilities", "actions", "bonus_actions", "reactions", "legendary_actions", "mythic_actions"];
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const unescape = (s: string) => s.replace(/\\"/g, '"').replace(/\\\\/g, "\\");

/** Nome ingles canonico vem da URL do token XMM: /api/token/XMM/<Nome>.webp */
function grabName(h: string): string | null {
  const m = h.match(/\/api\/token\/[A-Z]+\/([^"]+?)\.webp/) || h.match(/tokens\/XMM\/([^"]+?)\.webp/);
  return m ? decodeURIComponent(m[1]!) : null;
}
/** Extrai um dict JSON balanceado a partir de `"<key>":{` */
function grabDict(h: string, key: string): Record<string, string> | null {
  const i = h.indexOf(`"${key}":{`);
  if (i < 0) return null;
  let j = h.indexOf("{", i), depth = 0, k = j;
  for (; k < h.length; k++) { const c = h[k]; if (c === "{") depth++; else if (c === "}") { depth--; if (depth === 0) { k++; break; } } }
  try { const o = JSON.parse(h.slice(j, k)); return o && typeof o === "object" && !Array.isArray(o) ? o : null; } catch { return null; }
}

async function main() {
  const listHtml = unescape(await (await fetch(BASE, { headers: UA })).text());
  const slugs = [...new Set([...listHtml.matchAll(/\/monstros\/([a-z0-9-]{2,})/g)].map((m) => m[1]!))].filter((s) => s !== "undefined");
  log.info(`${slugs.length} paginas de monstro na lista`);

  const out: Record<string, any> = {};
  let ok = 0, miss = 0;
  for (let idx = 0; idx < slugs.length; idx++) {
    try {
      const r = await fetch(`${BASE}/${slugs[idx]}`, { headers: UA });
      if (!r.ok) { miss++; await sleep(DELAY); continue; }
      const h = unescape(await r.text());
      const name = grabName(h);
      if (!name) { miss++; await sleep(DELAY); continue; }
      const rec: Record<string, any> = { slug: slugs[idx] };
      for (const s of SECTIONS) { const d = grabDict(h, s); if (d && Object.keys(d).length) rec[s] = d; }
      out[name] = rec;
      ok++;
    } catch { miss++; }
    await sleep(DELAY);
    if ((idx + 1) % 100 === 0) log.info(`${idx + 1}/${slugs.length} (ok ${ok})`);
  }
  await mkdir(path.dirname(paths.pocketdm), { recursive: true });
  await writeFile(paths.pocketdm, JSON.stringify(out, null, 1), "utf8");
  log.ok(`${ok} monstros salvos (${miss} sem token XMM/ignorados) -> data/pocketdm/pt.json`);
}
main().catch((e) => { log.error(e); process.exit(1); });
