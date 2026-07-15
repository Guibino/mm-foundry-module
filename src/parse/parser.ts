/**
 * Parser dos stat blocks do Monster Manual 2024 -> JSON intermediario (schema.ts).
 *
 * ANCORA = a GRADE DE ATRIBUTOS (linha STR/DEX/CON seguida de INT/WIS/CHA):
 * e a assinatura mais confiavel de um stat block (uma por monstro), muito mais
 * robusta que a linha "AC". A partir da grade:
 *   - o CABECALHO (nome, meta, AC, HP, Speed) fica ACIMA;
 *   - as SECOES (TRAITS/ACTIONS/...) ficam ABAIXO, ate o inicio do fluff do
 *     proximo monstro (linha "Habitat:"/"Treasure:" ou proximo nome), evitando
 *     o vazamento de texto entre colunas/entradas.
 */
import type { Monster, NamedText } from "./schema.js";

const SIZES = ["Tiny", "Small", "Medium", "Large", "Huge", "Gargantuan"];
const denoise = (s: string) => s.replace(/\s+/g, "");
const denoUp = (s: string) => denoise(s).toUpperCase();

interface Line { page: number; text: string }

// ---------- deteccao da grade de atributos ----------
function isStrRow(text: string): boolean {
  const d = denoUp(text);
  return /STR\d/.test(d) && d.includes("DEX") && d.includes("CON");
}
function isIntRow(text: string): boolean {
  const d = denoUp(text);
  return d.includes("INT") && d.includes("CHA");
}
function isMetaLine(text: string): boolean {
  const t = text.trim();
  return SIZES.some((s) => new RegExp(`^${s}(\\s|$)`).test(t)) && /,/.test(t);
}
function isAcAnchor(text: string): boolean {
  return /^AC\d+I/i.test(denoise(text));
}
function looksLikeName(text: string): boolean {
  const t = text.trim();
  if (t.length < 2 || t.length > 60) return false;
  const letters = t.replace(/[^A-Za-z]/g, "");
  if (letters.length < 2) return false;
  const upper = t.replace(/[^A-Z]/g, "").length;
  return upper / letters.length > 0.7;
}
/** Linha de NOME de monstro: maiuscula, curta e sem cara de citacao. */
function isNameLine(text: string): boolean {
  const t = text.trim();
  if (!looksLikeName(t)) return false;
  if (/["'“”]/.test(t)) return false;              // citacao
  if (/^[-—]/.test(t)) return false;                // atribuicao "- FULANO"
  const words = t.split(/\s+/).filter(Boolean);
  return words.length <= 5;                          // nomes reais sao curtos
}

/** Linha de fluff-boundary: comeca o texto de ambientacao do proximo monstro. */
function isFluffBoundary(text: string): boolean {
  return /^Habitat\b/i.test(text.trim()) || /\bTreasure:/i.test(text);
}

function flatten(pages: { page: number; text: string }[]): Line[] {
  const out: Line[] = [];
  for (const p of pages) for (const l of p.text.split("\n")) out.push({ page: p.page, text: l });
  return out;
}

/** Indices (i) onde lines[i] e a linha STR e existe uma linha INT logo abaixo. */
function findGrids(lines: Line[]): { strIdx: number; intIdx: number }[] {
  const grids: { strIdx: number; intIdx: number }[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (!isStrRow(lines[i]!.text)) continue;
    let intIdx = -1;
    for (let j = i + 1; j <= i + 3 && j < lines.length; j++) {
      if (isIntRow(lines[j]!.text)) { intIdx = j; break; }
    }
    if (intIdx >= 0) grids.push({ strIdx: i, intIdx });
  }
  return grids;
}

// ---------- parsers de campo ----------
function parseAbilities(strLine: string, intLine: string): Monster["abilities"] | null {
  const normNum = (s: string) =>
    s.replace(/[OoQ]/g, "0").replace(/[lI|]/g, "1").replace(/S/g, "5").replace(/[Zz]/g, "2");
  const triple = /(\d{1,2})\s+([+-]\s?\d+)\s+([+-]\s?\d+)/g;
  const parseRow = (line: string) => {
    const norm = normNum(line);
    const out: { score: number; mod: number; save: number }[] = [];
    let m: RegExpExecArray | null; triple.lastIndex = 0;
    while ((m = triple.exec(norm)) && out.length < 3)
      out.push({ score: Number(m[1]), mod: Number(m[2]!.replace(/\s/g, "")), save: Number(m[3]!.replace(/\s/g, "")) });
    return out;
  };
  const a = parseRow(strLine), b = parseRow(intLine);
  if (a.length < 3 || b.length < 3) return null;
  return { str: a[0]!, dex: a[1]!, con: a[2]!, int: b[0]!, wis: b[1]!, cha: b[2]! };
}

function num(s: string | undefined): number | undefined {
  if (!s) return undefined;
  const n = Number(s.replace(/[^\d-]/g, ""));
  return Number.isFinite(n) ? n : undefined;
}
function parseSpeeds(line: string): { speeds: Record<string, number>; hover: boolean } {
  const speeds: Record<string, number> = {};
  const hover = /hover/i.test(line);
  const body = line.replace(/^Speed\s*/i, "");
  const walk = body.match(/^(\d+)\s*ft/i);
  if (walk) speeds.walk = Number(walk[1]);
  for (const m of body.matchAll(/\b(Burrow|Climb|Fly|Swim)\s+(\d+)\s*ft/gi)) speeds[m[1]!.toLowerCase()] = Number(m[2]);
  return { speeds, hover };
}
function parseSenses(line: string): Monster["senses"] {
  const s: Monster["senses"] = {};
  for (const m of line.matchAll(/\b(Darkvision|Blindsight|Tremorsense|Truesight)\s+(\d+)\s*ft/gi)) (s as any)[m[1]!.toLowerCase()] = Number(m[2]);
  const pp = line.match(/Passive Perception\s+(\d+)/i);
  if (pp) s.passivePerception = Number(pp[1]);
  return s;
}
function splitList(s: string): string[] {
  return s.replace(/["`]/g, "").split(/[,;]/).map((x) => x.trim()).filter((x) => x && x.length > 1);
}

const SECTIONS: Record<string, string> = {
  TRAITS: "traits", ACTIONS: "actions", BONUSACTIONS: "bonusActions",
  REACTIONS: "reactions", LEGENDARYACTIONS: "legendaryActions", MYTHICACTIONS: "mythicActions",
};
function matchSection(text: string): string | null {
  const d = denoUp(text);
  for (const key of Object.keys(SECTIONS)) if (d === key) return key;
  return null;
}
function splitEntries(block: string[]): NamedText[] {
  const entries: NamedText[] = [];
  const START = /^([A-Z][A-Za-z0-9'’,\- ]{0,44}?)(\s*\(([^)]*)\))?\.\s+(.*)$/;
  let cur: NamedText | null = null;
  for (const raw of block) {
    const line = raw.trim(); if (!line) continue;
    const m = line.match(START);
    if (m && m[1] && m[1].split(" ").length <= 6) {
      if (cur) entries.push(cur);
      const paren = m[3];
      cur = { name: m[1].trim(), text: (m[4] ?? "").trim() };
      if (paren) { if (/recharge/i.test(paren)) cur.recharge = paren.trim(); else cur.uses = paren.trim(); }
    } else if (cur) cur.text += " " + line;
    else cur = { name: "", text: line };
  }
  if (cur) entries.push(cur);
  const HEADER = /^(Senses|Languages|Skills|Immunities|Resistances|Vulnerabilities|CR|Gear|Speed|HP|AC|Passive|Initiative|MOD|SAVE|Habitat|Treasure)\b/i;
  return entries
    .map((e) => ({ ...e, text: e.text.replace(/\s+/g, " ").trim() }))
    .filter((e) => (e.name === "" ? e.text.length > 0 : !HEADER.test(e.name) && !/^[A-Z0-9 '-]{4,}$/.test(e.name)));
}
function cleanName(raw: string): string {
  let n = raw.replace(/["'`.,;:~]+/g, " ").replace(/\s+/g, " ").trim();
  const words = n.split(" ");
  const half = words.length / 2;
  if (words.length % 2 === 0 && words.slice(0, half).join(" ") === words.slice(half).join(" ")) n = words.slice(0, half).join(" ");
  return n.trim();
}

// ---------- montagem por grade ----------
export function parseMonsters(pages: { page: number; text: string }[]): Monster[] {
  const lines = flatten(pages);
  const grids = findGrids(lines);
  const monsters: Monster[] = [];
  for (let k = 0; k < grids.length; k++) {
    const g = grids[k]!;
    const nextGridStr = k + 1 < grids.length ? grids[k + 1]!.strIdx : lines.length;
    const m = parseBlockAt(lines, g.strIdx, g.intIdx, nextGridStr);
    if (m) monsters.push(m);
  }
  return dedupe(monsters);
}

/** remove entradas duplicadas (mesmo nome + mesmo PV) mantendo a mais completa. */
function dedupe(list: Monster[]): Monster[] {
  const seen = new Map<string, Monster>();
  for (const m of list) {
    const key = `${m.name}|${m.hp.value}|${m.cr}`;
    const prev = seen.get(key);
    if (!prev) { seen.set(key, m); continue; }
    const score = (x: Monster) => x.actions.length + x.traits.length + x.legendaryActions.length;
    if (score(m) > score(prev)) seen.set(key, m);
  }
  return [...seen.values()];
}

function parseBlockAt(lines: Line[], strIdx: number, intIdx: number, nextGridStr: number): Monster | null {
  const warnings: string[] = [];
  const at = (i: number) => (i >= 0 && i < lines.length ? lines[i]!.text : "");

  // ----- cabecalho ACIMA da grade -----
  let acIdx = -1;
  for (let i = strIdx - 1; i >= Math.max(0, strIdx - 8); i--) { if (isAcAnchor(at(i))) { acIdx = i; break; } }
  let metaIdx = -1;
  const upFrom = acIdx >= 0 ? acIdx - 1 : strIdx - 1;
  for (let i = upFrom; i >= Math.max(0, strIdx - 12); i--) { if (isMetaLine(at(i))) { metaIdx = i; break; } }
  // nome: a(s) linha(s) de NOME (curtas, maiusculas, sem cara de citacao)
  // imediatamente acima da meta. Ignora citacoes em maiusculas do MM 2024.
  const nameEnd = metaIdx >= 0 ? metaIdx : acIdx >= 0 ? acIdx : strIdx;
  let nameStart = nameEnd - 1;
  // pula linhas em branco e desce ate a primeira linha-nome (dentro de ~5 linhas)
  while (nameStart >= 0 && nameEnd - nameStart <= 6 && !isNameLine(at(nameStart))) nameStart--;
  const nameLines: string[] = [];
  if (nameStart >= 0 && isNameLine(at(nameStart))) {
    let ns = nameStart;
    // agrega no maximo mais 2 linhas-nome acima (nomes de 2-3 linhas)
    while (ns - 1 >= 0 && nameStart - ns < 2 && isNameLine(at(ns - 1)) && !isMetaLine(at(ns - 1))) ns--;
    for (let i = ns; i <= nameStart; i++) if (isNameLine(at(i))) nameLines.push(at(i).trim());
  }
  const name = cleanName(nameLines.join(" ")) || "Sem Nome";

  // meta
  const meta = metaIdx >= 0 ? at(metaIdx).trim() : "Medium Unknown, Unaligned";
  const sizeM = meta.match(new RegExp(`^(${SIZES.join("|")})`, "i"));
  const size = sizeM ? sizeM[1]! : "Medium";
  const afterSize = meta.replace(new RegExp(`^(${SIZES.join("|")})\\s*`, "i"), "");
  const commaIdx = afterSize.lastIndexOf(",");
  const typePart = commaIdx >= 0 ? afterSize.slice(0, commaIdx) : afterSize;
  const alignment = commaIdx >= 0 ? afterSize.slice(commaIdx + 1).trim() : "Unaligned";
  const subM = typePart.match(/\(([^)]*)\)/);
  const subtypes = subM ? splitList(subM[1]!) : [];
  const type = typePart.replace(/\([^)]*\)/, "").trim() || "Unknown";

  // AC / init
  const acLine = acIdx >= 0 ? denoise(at(acIdx)) : "";
  const ac = Number((acLine.match(/AC(\d+)/) || [])[1] ?? 10);
  const initM = acLine.match(/Initiative([+-]\d+)/);
  const initiative = initM ? Number(initM[1]) : undefined;

  // HP / Speed: entre AC e a grade
  const headerLo = acIdx >= 0 ? acIdx : Math.max(0, strIdx - 6);
  let hpLine = "", speedLine = "";
  for (let i = headerLo; i < strIdx; i++) {
    const t = at(i);
    if (!hpLine && /^HP/i.test(t.trim())) hpLine = t;
    if (!speedLine && /^S\s?peed/i.test(t.trim())) speedLine = t;
  }
  const hpM = hpLine.match(/HP\s*(\d+)\s*\(([^)]*)\)/i) || denoise(hpLine).match(/HP(\d+)\(([^)]*)\)/);
  const hp = { value: Number(hpM?.[1] ?? 1), formula: (hpM?.[2] ?? "").replace(/\s+/g, " ").trim() };
  if (!hpM) warnings.push("HP nao reconhecido");
  const { speeds, hover } = parseSpeeds(speedLine || "Speed 30 ft.");

  // atributos
  const abilities = parseAbilities(at(strIdx), at(intIdx));
  if (!abilities) warnings.push("Atributos nao reconhecidos");

  // ----- linhas rotuladas + secoes ABAIXO da grade -----
  // varre de intIdx+1 ate nextGridStr, cortando no fluff do proximo monstro
  const labeled: string[] = [];
  const sectionLines: { key: string; buf: string[] }[] = [];
  let curSec: { key: string; buf: string[] } | null = null;
  let crLine = "";
  let started = false; // ja passou pelos rotulos e entrou nas secoes
  for (let i = intIdx + 1; i < nextGridStr; i++) {
    const t = at(i);
    if (isFluffBoundary(t)) break; // comeca o fluff do proximo monstro
    const sec = matchSection(t);
    if (sec) { curSec = { key: sec, buf: [] }; sectionLines.push(curSec); started = true; continue; }
    if (curSec) { curSec.buf.push(t); continue; }
    // ainda nos rotulos do cabecalho (Skills/Immunities/Senses/Languages/CR/Gear)
    if (!started) {
      labeled.push(t);
      if (/^CR\b/i.test(t.trim())) crLine = t;
    }
  }

  const sectionData: Record<string, NamedText[]> = {};
  for (const s of sectionLines) sectionData[s.key] = splitEntries(s.buf);

  // rotulos do cabecalho
  const findL = (re: RegExp) => labeled.find((l) => re.test(l.trim()));
  const skillsLine = findL(/^Skills\b/i);
  const skills = skillsLine
    ? [...skillsLine.replace(/^Skills\s*/i, "").matchAll(/([A-Za-z ]+?)\s*([+-]\s?\d+)/g)].map((mm) => ({ name: mm[1]!.trim(), mod: Number(mm[2]!.replace(/\s/g, "")) }))
    : [];
  const vulnerabilities = splitList((findL(/^Vulnerabilities\b/i)?.replace(/^Vulnerabilities\s*/i, "")) ?? "");
  const resistances = splitList((findL(/^Resistances\b/i)?.replace(/^Resistances\s*/i, "")) ?? "");
  const immLine = findL(/^Immunities\b/i)?.replace(/^Immunities\s*/i, "") ?? "";
  const immParts = immLine.split(";");
  const dmgImm = splitList(immParts[0] ?? "");
  const condImm = splitList(immParts.slice(1).join(";"));
  const gear = splitList((findL(/^Gear\b/i)?.replace(/^Gear\s*/i, "")) ?? "");
  const senses = parseSenses(findL(/^Senses\b/i) ?? "");
  const langLine = findL(/^Languages\b/i)?.replace(/^Languages\s*/i, "") ?? "";
  const telepathyM = langLine.match(/telepathy\s+(\d+)/i);
  const languages = splitList(langLine.replace(/;?\s*telepathy[^,;]*/i, ""));
  if (!crLine) crLine = findL(/^CR\b/i) ?? "";
  const crM = crLine.match(/CR\s*([\d/]+)/i);
  const cr = crM ? crM[1]! : "0";
  const xp = num((crLine.match(/XP\s*([\d,]+)/i) || [])[1]);
  const pb = num((crLine.match(/PB\s*\+?(\d+)/i) || [])[1]);

  // intro lendaria/mitica
  const extractIntro = (arr?: NamedText[]) => {
    if (!arr || !arr.length) return { intro: undefined as string | undefined, items: [] as NamedText[] };
    if (/Legendary Action Uses|can take|expend a use|Mythic/i.test(arr[0]!.text) && arr[0]!.name.length < 3)
      return { intro: arr[0]!.text, items: arr.slice(1) };
    return { intro: undefined, items: arr };
  };
  const leg = extractIntro(sectionData.LEGENDARYACTIONS);
  const myth = extractIntro(sectionData.MYTHICACTIONS);

  // spellcasting
  let spellcasting: Monster["spellcasting"];
  const findSpell = (arr?: NamedText[]) => arr?.find((e) => /^Spellcasting/i.test(e.name));
  const spEntry = findSpell(sectionData.TRAITS) || findSpell(sectionData.ACTIONS);
  if (spEntry) {
    const dc = num((spEntry.text.match(/save DC\s*(\d+)/i) || [])[1]);
    const abil = /Charisma/i.test(spEntry.text) ? "cha" : /Wisdom/i.test(spEntry.text) ? "wis" : /Intelligence/i.test(spEntry.text) ? "int" : undefined;
    spellcasting = { intro: spEntry.text, ability: abil as any, saveDc: dc, groups: [] };
  }

  if (!abilities && hp.value <= 1) return null; // degenerado

  return {
    name, size, type, subtypes, alignment,
    ac: { value: ac }, initiative, hp, speeds, hover,
    abilities: abilities ?? { str: z(), dex: z(), con: z(), int: z(), wis: z(), cha: z() },
    skills, vulnerabilities, resistances, damageImmunities: dmgImm, conditionImmunities: condImm,
    gear, senses, languages, telepathy: telepathyM ? Number(telepathyM[1]) : undefined,
    cr, xp, pb,
    traits: (sectionData.TRAITS ?? []).filter((e) => !/^Spellcasting/i.test(e.name)),
    actions: (sectionData.ACTIONS ?? []).filter((e) => !/^Spellcasting/i.test(e.name)),
    bonusActions: sectionData.BONUSACTIONS ?? [],
    reactions: sectionData.REACTIONS ?? [],
    legendaryIntro: leg.intro, legendaryActions: leg.items,
    mythicIntro: myth.intro, mythicActions: myth.items,
    lairActions: [], regionalEffects: [],
    spellcasting,
    page: lines[strIdx]!.page, warnings,
  };
}
function z() { return { score: 10, mod: 0, save: 0 }; }
