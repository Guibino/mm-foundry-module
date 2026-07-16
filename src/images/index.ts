/**
 * Etapa 5 — Download de imagens (token + retrato) do 5e.tools.
 *
 * IMPORTANTE (direitos autorais): as imagens sao arte da Wizards of the Coast
 * (hospedadas no 5e.tools). Este script baixa para uso LOCAL/pessoal no SEU
 * ambiente e NAO inclui nada no repositorio (module/assets/* e gitignored).
 * Rode por sua conta, respeitando os termos do 5e.tools.
 *
 * Padrao de URL (fonte XMM = Monster Manual 2024/2025):
 *   token:   https://5e.tools/img/bestiary/tokens/XMM/<Nome>.webp
 *   retrato: https://5e.tools/img/bestiary/XMM/<Nome>.webp
 *
 * O download e resumivel: arquivos ja baixados sao pulados. Nomes que faltarem
 * (404) sao listados em module/assets/faltantes.json para ajuste manual.
 *
 * Executar: npm run images        (variavel MM5E_IMG_SOURCE p/ trocar "XMM")
 * Depois:   npm run relink        (vincula as imagens e recompila o pack)
 */
import { mkdir, readFile, writeFile, access } from "node:fs/promises";
import path from "node:path";
import { paths } from "../config.js";
import { makeLogger } from "../util/log.js";
import type { Monster } from "../parse/schema.js";

const log = makeLogger("images");
const SOURCE = process.env.MM5E_IMG_SOURCE ?? "XMM";
const BASE = "https://5e.tools/img/bestiary";
const DELAY = Number(process.env.MM5E_DELAY ?? 120); // ms entre requisicoes (educado)

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
  Referer: "https://5e.tools/bestiary.html",
  Accept: "image/webp,image/*,*/*;q=0.8",
};

const slug = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 60);

/**
 * Correcao de nomes para casar com o nome de arquivo do 5e.tools quando o nome
 * do monstro veio com ruido de OCR ou foi traduzido para PT. Chave = nome atual
 * do monstro; valor = nome canonico (ingles) usado na URL do 5e.tools.
 */
const NAME_OVERRIDES: Record<string, string> = {
  // Variantes em CAIXA ALTA / OCR / PT que precisam do nome canonico do 5e.tools.
  "VAMPIRE FAMILIAR": "Vampire Familiar",
  "SUCCUBUS": "Succubus",
  "SWARM OF VENOMOUS SNAKES": "Swarm of Venomous Snakes",
  "Venomous Snakes": "Swarm of Venomous Snakes",
  "Ax.e Beak": "Axe Beak",
  "Bal or": "Balor",
  "Gulthlas Blight": "Gulthias Blight",
  "Dark.mantle": "Darkmantle",
  "Ga . rgoyle": "Gargoyle",
  "Hidra": "Hydra",
  "Jackal were": "Jackalwere",
  "Enxame de Larvas": "Swarm of Larvae",
  "Gigante de Pedra": "Stone Giant",
  "Vampire Umbra.I Lord": "Vampire Umbral Lord",
  "Lorde Umbral Vampiro": "Vampire Umbral Lord",
  "Were bear": "Werebear",
  "Serpente Constritora": "Constrictor Snake",
  // O arquivo do 5e.tools para o "Fire Snake" (XMM) esta agrupado sob o
  // salamandra: "Salamander Fire Snake".
  "Fire Snake": "Salamander Fire Snake",
  // O bestiario nao tem token do enxame; usa a arte da criatura individual.
  "Swarm of Primeval Owlbear": "Primeval Owlbear",
};

/**
 * Overrides que tambem trocam a FONTE (source) do 5e.tools — alguns monstros do
 * MM 2024 so tem token/retrato sob o pack legado "MM", nao no "XMM".
 * Chave = nome do monstro; valor = { source?, name? } aplicados na URL.
 */
const IMG_SOURCE_OVERRIDES: Record<string, { source?: string; name?: string }> = {
  // Rug of Smothering (Animado): token+retrato existem apenas no pack "MM".
  "Rug of Smothering Animado": { source: "MM", name: "Rug of Smothering" },
};

/** Nome no padrao 5e.tools: aplica override, tira ruido de OCR e Title Case. */
function toolsName(name: string): string {
  if (NAME_OVERRIDES[name]) return NAME_OVERRIDES[name]!;
  // limpa ruido de OCR: pontos/aspas soltos e espacos internos duplicados
  let n = name.replace(/\s*\.{2,}\s*.*$/, "").replace(/["'`]+/g, "").replace(/\s+/g, " ").trim();
  // Title Case com minusculas para palavras pequenas (of, the, and...)
  const small = new Set(["of", "the", "and", "a", "to", "in", "on", "or"]);
  return n.split(" ").map((w, i) => {
    const lw = w.toLowerCase();
    if (i > 0 && small.has(lw)) return lw;
    return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
  }).join(" ");
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const exists = (p: string) => access(p).then(() => true).catch(() => false);

async function download(url: string, dest: string): Promise<boolean> {
  if (await exists(dest)) return true; // resume
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(url, { headers: HEADERS });
      if (res.status === 404) return false;
      if (!res.ok) { if (attempt === 0) { await sleep(500); continue; } return false; }
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length < 100) return false;
      await writeFile(dest, buf);
      return true;
    } catch {
      if (attempt === 0) { await sleep(500); continue; }
      return false;
    }
  }
  return false;
}

async function main() {
  const monsters: Monster[] = JSON.parse(await readFile(paths.monstersEn, "utf8"));
  await mkdir(paths.portraits, { recursive: true });
  await mkdir(paths.tokens, { recursive: true });
  let okT = 0, okP = 0;
  const misses: { name: string; token: boolean; portrait: boolean }[] = [];

  for (let i = 0; i < monsters.length; i++) {
    const m = monsters[i]!;
    const ov = IMG_SOURCE_OVERRIDES[m.name];
    const src = ov?.source ?? SOURCE;
    const enc = encodeURIComponent(ov?.name ?? toolsName(m.name));
    const s = slug(m.name);
    const tOk = await download(`${BASE}/tokens/${src}/${enc}.webp`, path.join(paths.tokens, `${s}.webp`));
    await sleep(DELAY);
    const pOk = await download(`${BASE}/${src}/${enc}.webp`, path.join(paths.portraits, `${s}.webp`));
    await sleep(DELAY);
    if (tOk) okT++;
    if (pOk) okP++;
    if (!tOk || !pOk) misses.push({ name: m.name, token: tOk, portrait: pOk });
    if ((i + 1) % 25 === 0) log.info(`${i + 1}/${monsters.length} | tokens ${okT} retratos ${okP}`);
  }

  await writeFile(path.join(paths.module, "assets", "faltantes.json"), JSON.stringify(misses, null, 2), "utf8");
  log.ok(`Tokens: ${okT}/${monsters.length} | Retratos: ${okP}/${monsters.length}`);
  if (misses.length) log.warn(`${misses.length} com algo faltando -> module/assets/faltantes.json`);
  log.info("Agora rode: npm run relink (vincula as imagens e recompila o pack)");
}
main().catch((e) => { log.error(e); process.exit(1); });
