/**
 * Etapa 5 — Download de imagens (retrato + token).
 *
 * IMPORTANTE (direitos autorais): as imagens do 5e.tools sao arte da Wizards of
 * the Coast. Este script baixa para uso LOCAL/pessoal no seu ambiente e NAO
 * inclui nada no repositorio (assets/portraits e assets/tokens sao gitignored).
 * Rode por sua conta e risco, respeitando os termos do 5e.tools.
 *
 * As imagens do Monster Manual 2024 usam o codigo de fonte "XMM" no 5e.tools.
 * Convencao de URL (pode mudar): 
 *   retrato: https://5e.tools/img/bestiary/XMM/<Nome>.webp
 *   token:   https://5e.tools/img/bestiary/tokens/XMM/<Nome>.webp
 *
 * Executar: npm run images   (variavel MM_IMG_SOURCE p/ trocar "XMM")
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { paths } from "../config.js";
import { makeLogger } from "../util/log.js";
import type { Monster } from "../parse/schema.js";

const log = makeLogger("images");
const SOURCE = process.env.MM_IMG_SOURCE ?? "XMM";
const BASE = "https://5e.tools/img/bestiary";

const slug = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 60);

/** Nome no padrao 5e.tools (Title Case, espacos preservados). */
function toolsName(nameEn: string): string {
  return nameEn.trim().split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

async function tryDownload(url: string, dest: string): Promise<boolean> {
  try {
    const res = await fetch(url);
    if (!res.ok) return false;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 100) return false;
    await writeFile(dest, buf);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const monsters: Monster[] = JSON.parse(await readFile(paths.monstersEn, "utf8"));
  await mkdir(paths.portraits, { recursive: true });
  await mkdir(paths.tokens, { recursive: true });
  let okP = 0, okT = 0;
  for (const m of monsters) {
    const enc = encodeURIComponent(toolsName(m.name));
    const s = slug(m.name);
    const portraitUrl = `${BASE}/${SOURCE}/${enc}.webp`;
    const tokenUrl = `${BASE}/tokens/${SOURCE}/${enc}.webp`;
    if (await tryDownload(portraitUrl, path.join(paths.portraits, `${s}.webp`))) okP++;
    if (await tryDownload(tokenUrl, path.join(paths.tokens, `${s}.webp`))) okT++;
    log.debug(m.name, "retrato/token tentados");
  }
  log.ok(`Retratos: ${okP}/${monsters.length} | Tokens: ${okT}/${monsters.length}`);
  log.info("Rode 'npm run normalize' e 'npm run build:pack' para vincular as imagens.");
}
main().catch((e) => { log.error(e); process.exit(1); });
