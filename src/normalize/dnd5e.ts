/**
 * Mapeia o JSON intermediario (traduzido) para o schema de Actor "npc" do
 * sistema dnd5e (v4+/Foundry v13-14). Gera documentos prontos para o pack.
 *
 * Decisoes de escopo:
 *  - Cabecalho (AC/HP/atributos/saves/pericias/sentidos/CR/imunidades) e
 *    totalmente estruturado nos campos nativos.
 *  - Cada trait/action/reaction/legendaria/mitica vira um Item "feat" com
 *    descricao, tipo de ativacao e usos/recarga configurados nativamente.
 *  - Os dados mecanicos de ataque/resistencia detectados ficam tambem em
 *    flags.mm2024 para futura conversao em "activities" completas.
 */
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import path from "node:path";
import { paths, MODULE_ID } from "../config.js";
import { glossary } from "../translate/glossary.js";

const ID_ALPHABET = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
/** ID deterministico de 16 chars no estilo Foundry a partir de uma seed. */
export function makeId(seed: string): string {
  const h = createHash("sha1").update(seed).digest();
  let out = "";
  for (let i = 0; i < 16; i++) out += ID_ALPHABET[h[i]! % ID_ALPHABET.length];
  return out;
}

const SKILL_ABILITY: Record<string, string> = {
  acr: "dex", ani: "wis", arc: "int", ath: "str", dec: "cha", his: "int",
  ins: "wis", itm: "cha", inv: "int", med: "wis", nat: "int", prc: "wis",
  prf: "cha", per: "cha", rel: "int", slt: "dex", ste: "dex", sur: "wis",
};

function crToNumber(cr: string): number {
  if (cr.includes("/")) {
    const [a, b] = cr.split("/").map(Number);
    return (a ?? 0) / (b ?? 1);
  }
  return Number(cr) || 0;
}

/** Mapeia lista EN (dano/condicao) para {value:[keys], custom} do dnd5e. */
function mapTraitList(items: string[], dict: Record<string, { key: string }>): { value: string[]; custom: string } {
  const value: string[] = [];
  const custom: string[] = [];
  for (const raw of items) {
    const t = raw.trim();
    const found = Object.entries(dict).find(([en]) => new RegExp(`^${en}$`, "i").test(t));
    if (found) value.push(found[1].key);
    else if (t) custom.push(t);
  }
  return { value, custom: custom.join("; ") };
}

interface Entry { name: string; text: string; textEn?: string; uses?: string; recharge?: string }

/** Detecta metadados de ataque/save/dano no texto EN (para flags e activities). */
function detectMechanics(textEn: string) {
  // Ataque: "Melee/Ranged Attack Roll: +N" (MM 2024) ou "+N to hit" (legado).
  const atk = textEn.match(/(Melee|Ranged)\s+Attack Roll:\s*([+-]\d+)/i);
  const atkOld = textEn.match(/([+-]\d+)\s*to hit/i);
  const toHit = atk ? Number(atk[2]) : atkOld ? Number(atkOld[1]) : undefined;
  const attackType = atk ? atk[1]!.toLowerCase() : undefined; // "melee" | "ranged"
  // Dano: "Hit: 5 (1d6 + 2) Slashing damage" (ataque) ou
  // "Failure: 24 (4d10 + 2) Thunder damage" (save). Primeira instancia.
  const dmg = textEn.match(/(?:Hit|Failure):\s*\d+\s*\(([^)]+)\)\s*(\w+)\s*damage/i);
  // Save: "Strength Saving Throw: DC 13" (MM 2024) ou "DC 13 Strength" (legado).
  let saveDc: number | undefined, saveAbility: string | undefined;
  const s1 = textEn.match(/(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma)\s+Saving Throw:\s*DC\s*(\d+)/i);
  const s2 = textEn.match(/DC\s*(\d+)\s+(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma)/i);
  if (s1) { saveDc = Number(s1[2]); saveAbility = s1[1]!.slice(0, 3).toLowerCase(); }
  else if (s2) { saveDc = Number(s2[1]); saveAbility = s2[2]!.slice(0, 3).toLowerCase(); }
  return {
    toHit, attackType,
    damageFormula: dmg?.[1]?.replace(/\s/g, ""),
    damageType: dmg?.[2]?.toLowerCase(),
    saveDc, saveAbility,
  };
}

/** Converte "1d6+2" | "2d6" | "7" numa parte de dano do dnd5e (v4). */
function damagePart(formula?: string, type?: string): any | null {
  if (!formula) return null;
  const f = formula.replace(/\s+/g, "");
  const types = type ? [type] : [];
  const m = f.match(/^(\d+)d(\d+)([+-]\d+)?$/i);
  if (m) {
    return {
      number: Number(m[1]),
      denomination: Number(m[2]),
      bonus: m[3] ? m[3].replace(/^\+/, "") : "",
      types,
      custom: { enabled: false, formula: "" },
      scaling: { mode: "", number: 1, formula: "" },
    };
  }
  // formula nao-padrao (ex.: "1d8+1d6" ou dano fixo) -> parte custom.
  return {
    number: null, denomination: null, bonus: "",
    types,
    custom: { enabled: true, formula: f },
    scaling: { mode: "", number: 1, formula: "" },
  };
}

/**
 * Constroi o mapa `system.activities` do dnd5e (v4) a partir das mechanics.
 *  - to-hit presente  -> activity "attack" (bonus fixo + parte de dano);
 *  - senao CD de save -> activity "save" (habilidade + CD + dano com meio-dano).
 * Retorna {} quando nao ha mecanica acionavel (o item continua sendo um feat).
 */
function buildActivities(mech: any, activation: string, seed: string): Record<string, any> {
  const acts: Record<string, any> = {};
  const part = damagePart(mech.damageFormula, mech.damageType);
  const activationNode = {
    type: activation,
    value: activation === "legendary" ? 1 : null,
    override: true,
    condition: "",
  };
  if (mech.toHit !== undefined && mech.toHit !== null) {
    const id = makeId(`atk:${seed}`);
    acts[id] = {
      _id: id,
      type: "attack",
      activation: activationNode,
      attack: {
        ability: "",
        bonus: String(mech.toHit),
        flat: true, // NPC: o bonus ja e o total de acerto
        type: { value: mech.attackType ?? "melee", classification: "weapon" },
      },
      damage: { includeBase: false, parts: part ? [part] : [] },
    };
  } else if (mech.saveDc !== undefined && mech.saveDc !== null) {
    const id = makeId(`sav:${seed}`);
    acts[id] = {
      _id: id,
      type: "save",
      activation: activationNode,
      save: {
        ability: mech.saveAbility ? [mech.saveAbility] : [],
        dc: { calculation: "", formula: String(mech.saveDc) },
      },
      damage: { onSave: "half", parts: part ? [part] : [] },
    };
  }
  return acts;
}

/** Constroi usos/recarga nativos a partir do texto do parenteses. */
function buildUses(entry: Entry): any {
  if (entry.recharge) {
    const m = entry.recharge.match(/(\d)/);
    return { spent: 0, max: "1", recovery: [{ period: "recharge", type: "recoverAll", formula: m?.[1] ?? "6" }] };
  }
  if (entry.uses) {
    const per = entry.uses.match(/(\d+)\s*\/\s*(Day|Dia)/i);
    if (per) return { spent: 0, max: per[1]!, recovery: [{ period: "day", type: "recoverAll" }] };
  }
  return undefined;
}

function featItem(entry: Entry, entryEn: Entry, activation: string, seed: string): any {
  const mech = detectMechanics(entryEn.textEn ?? entryEn.text);
  const uses = buildUses(entry);
  const nameSuffix = entry.recharge ? ` (${entry.recharge})` : entry.uses ? ` (${entry.uses})` : "";
  // Activities nativas so para entradas acionaveis (acoes/bonus/reacoes/lendarias);
  // traits passivos (activation vazio) permanecem apenas descritivos.
  const activities = activation ? buildActivities(mech, activation, seed) : {};
  return {
    _id: makeId(seed),
    name: (entry.name || "Habilidade") + nameSuffix,
    type: "feat",
    img: "icons/svg/aura.svg",
    system: {
      description: { value: `<p>${entry.text}</p>`, chat: "" },
      activation: activation ? { type: activation, value: activation === "legendary" ? 1 : null, condition: "" } : { type: "", value: null },
      uses: uses ?? { spent: 0, max: "", recovery: [] },
      type: { value: "monster", subtype: "" },
      activities,
    },
    flags: { mm2024: { mechanics: mech, source: "MM2024" } },
  };
}

const slugify = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 60);

/** Retorna o caminho do asset no modulo se o arquivo existir localmente. */
function assetPath(dir: string, kind: "portraits" | "tokens", slug: string): string | null {
  const file = path.join(dir, `${slug}.webp`);
  return existsSync(file) ? `modules/${MODULE_ID}/assets/${kind}/${slug}.webp` : null;
}

export function toActor(m: any, folderId?: string): any {
  const id = makeId(`actor:${m.name}|${m.page ?? ""}|${m.hp?.value ?? ""}|${m.cr ?? ""}`);
  const slug = slugify(m.name);
  const portraitAsset = assetPath(paths.portraits, "portraits", slug);
  const tokenAsset = assetPath(paths.tokens, "tokens", slug);
  // Sem retrato mas com token: usa a arte do token como retrato (img), em vez
  // do icone padrao do Foundry (mystery-man).
  const portrait = portraitAsset ?? tokenAsset ?? "icons/svg/mystery-man.svg";
  const token = tokenAsset ?? portrait;
  const abil = (a: any) => ({ value: a.score, proficient: a.save > a.mod ? 1 : 0 });
  const skills: Record<string, any> = {};
  for (const s of m.skills) {
    const g = Object.values(glossary.skills).find((x: any) => x); // placeholder
  }
  // pericias: casa nome EN -> key e define proficiencia
  for (const s of m.skills) {
    const entry = Object.entries(glossary.skills).find(([en]) => new RegExp(`^${en}$`, "i").test(s.name.trim()));
    if (!entry) continue;
    const key = (entry[1] as any).key as string;
    const abilityKey = SKILL_ABILITY[key] ?? "int";
    const abilityMod = m.abilities[abilityKey].mod;
    const pb = m.pb ?? 2;
    const mult = pb ? Math.max(0, Math.round((s.mod - abilityMod) / pb)) : 1;
    skills[key] = { value: Math.min(2, mult || 1), ability: abilityKey };
  }

  const di = mapTraitList(m.damageImmunities, Object.fromEntries(Object.entries(glossary.damageTypes)) as any);
  const dr = mapTraitList(m.resistances, Object.fromEntries(Object.entries(glossary.damageTypes)) as any);
  const dv = mapTraitList(m.vulnerabilities, Object.fromEntries(Object.entries(glossary.damageTypes)) as any);
  const ci = mapTraitList(m.conditionImmunities, Object.fromEntries(Object.entries(glossary.conditions)) as any);

  const movement: any = { units: "ft", hover: !!m.hover };
  for (const [k, v] of Object.entries(m.speeds)) movement[k] = v;
  const senses: any = { units: "ft" };
  for (const [k, v] of Object.entries(m.senses)) if (k !== "passivePerception") senses[k] = v;

  const items: any[] = [];
  const push = (arr: Entry[], arrEn: Entry[], act: string, tag: string) =>
    arr.forEach((e, i) => items.push(featItem(e, arrEn[i] ?? e, act, `${m.name}:${tag}:${i}:${e.name}`)));
  push(m.traits, m.traits, "", "trait");
  push(m.actions, m.actions, "action", "action");
  push(m.bonusActions, m.bonusActions, "bonus", "bonus");
  push(m.reactions, m.reactions, "reaction", "reaction");
  push(m.legendaryActions, m.legendaryActions, "legendary", "legendary");
  push(m.mythicActions, m.mythicActions, "legendary", "mythic");
  push(m.lairActions, m.lairActions, "", "lair");
  if (m.spellcasting) {
    items.push(featItem({ name: "Conjuração", text: m.spellcasting.intro }, { name: "Spellcasting", text: m.spellcasting.intro }, "action", `${m.name}:spellcasting`));
  }

  // Cada Item embarcado precisa de _key no formato do LevelDB do Foundry.
  for (const it of items) it._key = `!actors.items!${id}.${it._id}`;

  const typeKey = glossary.typeKeys[m.type] ?? "";
  const sizeKey = glossary.sizeKeys[m.size] ?? "med";

  return {
    _id: id,
    _key: `!actors!${id}`,
    folder: folderId ?? null,
    name: m.namePt || m.name,
    type: "npc",
    img: portrait,
    system: {
      abilities: {
        str: abil(m.abilities.str), dex: abil(m.abilities.dex), con: abil(m.abilities.con),
        int: abil(m.abilities.int), wis: abil(m.abilities.wis), cha: abil(m.abilities.cha),
      },
      attributes: {
        ac: { calc: "flat", flat: m.ac.value, formula: "" },
        hp: { value: m.hp.value, max: m.hp.value, formula: m.hp.formula, temp: null, tempmax: null },
        movement, senses,
        init: { ability: "dex", bonus: "" },
      },
      details: {
        type: { value: typeKey, subtype: m.subtypes.join(", "), swarm: "", custom: typeKey ? "" : m.type },
        alignment: m.alignmentPt ?? m.alignment,
        cr: crToNumber(m.cr),
        xp: { value: m.xp ?? 0 },
        source: { custom: "Monster Manual 2024" },
        biography: { value: m.description ? `<p>${m.description}</p>` : "" },
      },
      traits: {
        size: sizeKey,
        di, dr, dv, ci,
        languages: { value: [], custom: (m.languages ?? []).map((l: string) => glossary.languages[l] ?? l).join(", ") },
      },
      skills,
    },
    prototypeToken: {
      name: m.namePt || m.name,
      actorLink: false,
      sight: { enabled: true },
      texture: { src: token },
      disposition: -1,
    },
    items,
    flags: { mm2024: { nameEn: m.name, page: m.page, cr: m.cr, warnings: m.warnings ?? [] } },
  };
}
