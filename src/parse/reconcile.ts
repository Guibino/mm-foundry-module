/**
 * Etapa 3b — Reconciliacao de nomes contra o INDEX OF STAT BLOCKS do livro.
 *
 * O indice (nome + pagina) e a fonte de verdade dos NOMES (tem menos ruido de
 * OCR que alguns stat blocks densos do Apendice A). Fazemos um casamento
 * guloso "melhor primeiro" por (distancia de nome + distancia de pagina) e
 * adotamos o nome canonico do indice para cada monstro. O nome de OCR original
 * fica preservado em `nameOcr`. Entradas do indice sem par sao reportadas.
 *
 * Executar: npm run reconcile   (depois de parse; antes de translate)
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { paths } from "../config.js";
import { makeLogger } from "../util/log.js";
import type { Monster } from "./schema.js";

const log = makeLogger("reconcile");
const INDEX = path.join(paths.intermediate, "book-index.json");

/** Correcoes de OCR frequentes nos nomes do indice + limpeza generica. */
const INDEX_FIXES: [RegExp, string][] = [
  [/l<|I<|!\(|\(</g, "k"], [/IGUer Whale/gi, "Killer Whale"], [/Hawl</gi, "Hawk"],
  [/ChuuJ/gi, "Chuul"], [/Madron/gi, "Modron"], [/Whjte/gi, "White"],
  [/WyrmJing/gi, "Wyrmling"], [/Ettjn/gi, "Ettin"], [/Lamja/gi, "Lamia"],
  [/Mephlt/gi, "Mephit"], [/NycaJoth/gi, "Nycaloth"], [/GulthJas|GulthИas/gi, "Gulthias"],
  [/Blinl< Dog/gi, "Blink Dog"], [/\bRoe\b/g, "Roc"], [/Pix\.ie/gi, "Pixie"],
  [/GithyanJci/gi, "Githyanki"], [/\bElle\b/g, "Elk"], [/Empyrean lota/gi, "Empyrean"],
  [/Madron/gi, "Modron"], [/Duodrone/gi, "Duodrone"],
];
function cleanIndexName(raw: string): string {
  let n = raw;
  for (const [re, rep] of INDEX_FIXES) n = n.replace(re, rep);
  return n.replace(/\s+/g, " ").trim();
}

const norm = (s: string) =>
  s.toUpperCase().replace(/[^A-Z0-9]/g, "")
    .replace(/[0OQ]/g, "O").replace(/[1LIJ|]/g, "I").replace(/5/g, "S").replace(/8/g, "B");

function lev(a: string, b: string): number {
  if (a === b) return 0;
  const dp = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0]!; dp[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cur = dp[j]!;
      dp[j] = Math.min(dp[j]! + 1, dp[j - 1]! + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = cur;
    }
  }
  return dp[b.length]!;
}

async function main() {
  const monsters: Monster[] = JSON.parse(await readFile(paths.monstersEn, "utf8"));
  const index: { name: string; page: number }[] = JSON.parse(await readFile(INDEX, "utf8"));
  const idx = index.map((e) => ({ name: cleanIndexName(e.name), page: e.page, n: norm(cleanIndexName(e.name)) }));
  const mon = monsters.map((m, k) => ({ k, n: norm(m.name), page: m.page ?? 0 }));

  // custo de todos os pares plausiveis
  type Pair = { i: number; j: number; cost: number };
  const pairs: Pair[] = [];
  for (let i = 0; i < idx.length; i++) {
    for (let j = 0; j < mon.length; j++) {
      const a = idx[i]!.n, b = mon[j]!.n;
      if (Math.abs(a.length - b.length) > 6) continue;
      let d = lev(a, b);
      if (a.length >= 4 && (a.includes(b) || b.includes(a))) d = Math.min(d, 1);
      const dp = Math.abs(idx[i]!.page - mon[j]!.page);
      const pen = dp <= 2 ? 0 : dp <= 6 ? 3 : 8;
      const cost = d + pen;
      if (cost <= 12) pairs.push({ i, j, cost });
    }
  }
  pairs.sort((x, y) => x.cost - y.cost);
  const idxUsed = new Array(idx.length).fill(false);
  const monUsed = new Array(mon.length).fill(false);
  const assign = new Map<number, number>(); // monsterIndex -> idxIndex
  for (const p of pairs) {
    if (idxUsed[p.i] || monUsed[mon[p.j]!.k]) continue;
    if (monUsed[p.j]) continue;
    idxUsed[p.i] = true; monUsed[p.j] = true;
    assign.set(p.j, p.i);
  }

  // 2o passe: casa remanescentes SO por proximidade de pagina (sinal forte:
  // cada pagina tem poucos monstros). Resolve nomes muito garbled/mesclados.
  {
    const leftoverIdx = idx.map((e, i) => ({ e, i })).filter((x) => !idxUsed[x.i]);
    const leftoverMon = mon.filter((m) => !monUsed[m.k] && !assign.has(m.k));
    const fpairs: { i: number; j: number; d: number }[] = [];
    for (const { e, i } of leftoverIdx)
      for (const m of leftoverMon) {
        const d = Math.abs(e.page - m.page);
        if (d <= 2) fpairs.push({ i, j: m.k, d });
      }
    fpairs.sort((a, b) => a.d - b.d);
    for (const p of fpairs) {
      if (idxUsed[p.i] || monUsed[p.j]) continue;
      idxUsed[p.i] = true; monUsed[p.j] = true; assign.set(p.j, p.i);
    }
  }

  let fixed = 0;
  for (let j = 0; j < monsters.length; j++) {
    const i = assign.get(j);
    if (i === undefined) continue;
    const canonical = idx[i]!.name;
    const cur = monsters[j]!.name;
    (monsters[j] as any).nameOcr = cur;
    if (norm(cur) !== norm(canonical) || cur !== canonical) {
      monsters[j]!.name = canonical;
      fixed++;
    }
  }
  // Correcao manual final para nomes muito garbled de monstros presentes
  // (OCR de nomes; correcao factual, nao de conteudo). Casa por subtrecho.
  const MANUAL: [RegExp, string][] = [
    [/ANIMATED.*SMOTHER/i, "Rug of Smothering Animado"],
    [/Medicine check HYDRA|^HYDRA/i, "Hidra"],
    [/IRON GOLEM.*JACKAL|JACKALWERE/i, "Jackalwere"],
    [/LARV\s*A\s*E|SWARM OF LAR/i, "Enxame de Larvas"],
    [/STIRGES.*STONE GIANT|STONE GIANT/i, "Gigante de Pedra"],
    [/VAMPIRE UMBRAL/i, "Lorde Umbral Vampiro"],
    [/CO\s*NSTRICTOR|CONSTRICTOR/i, "Serpente Constritora"],
  ];
  for (const m of monsters) {
    if (assign.has(monsters.indexOf(m))) continue;
    for (const [re, nm] of MANUAL) if (re.test(m.name)) { (m as any).nameOcr = m.name; m.name = nm; break; }
  }

  const unmatchedIdx = idx.filter((_, i) => !idxUsed[i]).map((e) => `${e.name} (p${e.page})`);
  const unmatchedMon = monsters.filter((_, j) => !assign.has(j)).map((m) => m.name);

  await writeFile(paths.monstersEn, JSON.stringify(monsters, null, 2), "utf8");
  log.ok(`${assign.size}/${monsters.length} casados com o indice; ${fixed} nomes ajustados`);
  if (unmatchedIdx.length) log.warn(`indice sem par (${unmatchedIdx.length}): ${unmatchedIdx.join(", ")}`);
  if (unmatchedMon.length) log.warn(`monstros sem par no indice (${unmatchedMon.length}): ${unmatchedMon.slice(0, 20).map((s) => JSON.stringify(s.slice(0, 24))).join(", ")}`);
}
main().catch((e) => { log.error(e); process.exit(1); });
