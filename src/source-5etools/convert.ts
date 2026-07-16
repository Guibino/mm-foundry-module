/**
 * Conversor 5e.tools (bestiary XMM) -> schema intermediario Monster (schema.ts).
 * Reaproveita todo o restante do pipeline (translate -> normalize -> pack).
 * Os dados do 5e.tools sao estruturados (sem OCR), entao a fidelidade e alta.
 */
import type { Monster, NamedText } from "../parse/schema.js";
import { render5e, renderEntries } from "./tags.js";

const SIZE: Record<string, string> = { T: "Tiny", S: "Small", M: "Medium", L: "Large", H: "Huge", G: "Gargantuan" };
const ALIGN: Record<string, string> = {
  L: "Lawful", N: "Neutral", C: "Chaotic", G: "Good", E: "Evil", U: "Unaligned", A: "Any Alignment",
};

const mod = (score: number) => Math.floor((score - 10) / 2);
const sgn = (n: number) => (n >= 0 ? n : n);

function flattenStrings(v: any): string[] {
  if (v == null) return [];
  if (typeof v === "string") return [render5e(v)];
  if (Array.isArray(v)) return v.flatMap(flattenStrings);
  // objetos: {immune:[...], resist:[...], vulnerable:[...], note, special, cond}
  const out: string[] = [];
  for (const key of ["immune", "resist", "vulnerable", "conditionImmune"]) if (v[key]) out.push(...flattenStrings(v[key]));
  if (v.special) out.push(render5e(v.special));
  return out;
}

function parseAlignment(a: any): string {
  if (!a) return "Unaligned";
  if (Array.isArray(a)) {
    const codes = a.filter((x) => typeof x === "string").map((c: string) => ALIGN[c] ?? "").filter(Boolean);
    if (a.some((x: any) => x && x.special)) return render5e(a.find((x: any) => x.special).special);
    if (codes.length === 0) return "Unaligned";
    if (codes.length === 1) return codes[0]!;
    if (codes.includes("Unaligned")) return "Unaligned";
    return codes.join(" ");
  }
  return "Unaligned";
}

function parseType(t: any): { type: string; subtypes: string[] } {
  if (!t) return { type: "Unknown", subtypes: [] };
  if (typeof t === "string") return { type: cap(t), subtypes: [] };
  const base = typeof t.type === "string" ? t.type : (t.type?.choose?.[0] ?? "Unknown");
  const tags = (t.tags ?? []).map((x: any) => (typeof x === "string" ? x : x.tag)).filter(Boolean);
  return { type: cap(base), subtypes: tags };
}
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function parseAc(ac: any): { value: number; note?: string } {
  if (!Array.isArray(ac) || ac.length === 0) return { value: 10 };
  const first = ac[0];
  if (typeof first === "number") return { value: first };
  if (first && typeof first.ac === "number") return { value: first.ac, note: (first.from ?? []).map(render5e).join(", ") || undefined };
  return { value: 10 };
}

function parseHp(hp: any): { value: number; formula: string } {
  if (!hp) return { value: 1, formula: "" };
  if (typeof hp.average === "number") return { value: hp.average, formula: (hp.formula ?? "").trim() };
  if (hp.special) return { value: Number(String(hp.special).match(/\d+/)?.[0] ?? 1), formula: render5e(hp.special) };
  return { value: 1, formula: "" };
}

function parseSpeeds(sp: any): { speeds: Record<string, number>; hover: boolean } {
  const speeds: Record<string, number> = {};
  if (!sp) return { speeds, hover: false };
  for (const k of ["walk", "burrow", "climb", "fly", "swim"]) {
    const v = sp[k];
    if (typeof v === "number") speeds[k] = v;
    else if (v && typeof v.number === "number") speeds[k] = v.number;
  }
  return { speeds, hover: !!sp.canHover };
}

function parseSenses(senses: any, passive: any): Monster["senses"] {
  const s: Monster["senses"] = {};
  const arr = Array.isArray(senses) ? senses.map(render5e) : [];
  for (const line of arr) {
    const m = line.match(/(darkvision|blindsight|tremorsense|truesight)\s+(\d+)/i);
    if (m) (s as any)[m[1]!.toLowerCase()] = Number(m[2]);
  }
  if (typeof passive === "number") s.passivePerception = passive;
  return s;
}

function toEntries(arr: any): NamedText[] {
  if (!Array.isArray(arr)) return [];
  return arr.map((a) => {
    const name: string = render5e(a.name ?? "");
    let text = renderEntries(a.entries ?? a);
    const rech = name.match(/\(Recharge\s*([\d–\-]+)\)/i) || text.match(/\(Recharge\s*([\d–\-]+)\)/i);
    const uses = name.match(/\((\d+\/(?:Day|Turn|Round|Rest))\)/i);
    const out: NamedText = { name: name.replace(/\s*\([^)]*\)\s*$/, "").trim() || name, text };
    if (rech) out.recharge = `Recharge ${rech[1]}`;
    else if (uses) out.uses = uses[1]!;
    return out;
  });
}

function parseSpellcasting(sc: any): Monster["spellcasting"] | undefined {
  if (!Array.isArray(sc) || sc.length === 0) return undefined;
  const first = sc[0];
  const intro = [renderEntries(first.headerEntries)].filter(Boolean).join(" ");
  const groups: { freq: string; spells: string[] }[] = [];
  if (first.will) groups.push({ freq: "At Will", spells: flattenStrings(first.will) });
  if (first.daily) for (const [k, v] of Object.entries(first.daily)) groups.push({ freq: `${k.replace("e", "")}/Day`, spells: flattenStrings(v) });
  if (first.spells) for (const [lvl, obj] of Object.entries<any>(first.spells)) groups.push({ freq: lvl === "0" ? "Cantrips" : `Level ${lvl}`, spells: flattenStrings(obj.spells) });
  const abil = first.ability as string | undefined;
  return { intro, ability: (abil as any) ?? undefined, saveDc: undefined, groups };
}

export function convert5e(m: any): Monster {
  const abScore = (k: string) => Number(m[k] ?? 10);
  const saveOf = (k: string) => {
    const s = m.save?.[k];
    if (typeof s === "string") return Number(s.replace(/[^\d-]/g, ""));
    return mod(abScore(k));
  };
  const ability = (k: string) => ({ score: abScore(k), mod: mod(abScore(k)), save: saveOf(k) });
  const { type, subtypes } = parseType(m.type);
  const { speeds, hover } = parseSpeeds(m.speed);
  const skills = m.skill
    ? Object.entries<any>(m.skill).map(([name, v]) => ({ name: cap(name), mod: Number(String(v).replace(/[^\d-]/g, "")) }))
    : [];
  const crRaw = typeof m.cr === "object" ? (m.cr?.cr ?? "0") : (m.cr ?? "0");
  const langs = Array.isArray(m.languages) ? m.languages.map(render5e) : [];
  const telep = langs.join(" ").match(/telepathy\s+(\d+)/i);
  // Bonus de Proficiencia por CR e Iniciativa 2024 (mod DES + proficiency x PB).
  const crNum = crRaw === "1/8" ? 0.125 : crRaw === "1/4" ? 0.25 : crRaw === "1/2" ? 0.5 : Number(crRaw) || 0;
  const pb = Math.max(2, Math.ceil(crNum / 4) + 1);
  const initProf = (m.initiative && typeof m.initiative.proficiency === "number") ? m.initiative.proficiency : 0;
  const initiative = mod(abScore("dex")) + initProf * pb;

  return {
    name: render5e(m.name),
    size: SIZE[Array.isArray(m.size) ? m.size[0] : m.size] ?? "Medium",
    type, subtypes, alignment: parseAlignment(m.alignment),
    ac: parseAc(m.ac),
    hp: parseHp(m.hp),
    speeds, hover,
    abilities: {
      str: ability("str"), dex: ability("dex"), con: ability("con"),
      int: ability("int"), wis: ability("wis"), cha: ability("cha"),
    },
    skills,
    vulnerabilities: flattenStrings(m.vulnerable),
    resistances: flattenStrings(m.resist),
    damageImmunities: flattenStrings(m.immune),
    conditionImmunities: flattenStrings(m.conditionImmune),
    gear: Array.isArray(m.gear) ? m.gear.map((g: any) => render5e(typeof g === "string" ? g : g.item)) : [],
    senses: parseSenses(m.senses, m.passive),
    languages: langs.filter((l) => !/telepathy/i.test(l)),
    telepathy: telep ? Number(telep[1]) : undefined,
    cr: String(crRaw),
    initiative,
    xp: undefined, pb,
    habitat: undefined, treasure: undefined,
    description: undefined,
    traits: toEntries(m.trait),
    actions: toEntries(m.action),
    bonusActions: toEntries(m.bonus),
    reactions: toEntries(m.reaction),
    legendaryIntro: renderEntries(m.legendaryHeader) || undefined,
    legendaryActions: toEntries(m.legendary),
    mythicIntro: renderEntries(m.mythicHeader) || undefined,
    mythicActions: toEntries(m.mythic),
    lairActions: [], regionalEffects: [],
    spellcasting: parseSpellcasting(m.spellcasting),
    page: m.page, warnings: [],
  };
}
