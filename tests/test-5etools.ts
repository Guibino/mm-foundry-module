/**
 * Teste do conversor 5e.tools usando uma criatura SINTETICA (inventada, sem
 * qualquer conteudo protegido). Valida o mapeamento de campos e o render de tags.
 * Executar: tsx tests/test-5etools.ts
 */
import assert from "node:assert";
import { convert5e } from "../src/source-5etools/convert.js";
import { render5e } from "../src/source-5etools/tags.js";
import { Monster } from "../src/parse/schema.js";

// Criatura ficticia no formato do 5e.tools (nao e do Monster Manual).
const fake = {
  name: "Testodonte Cintilante",
  source: "TESTE", page: 1,
  size: ["L"],
  type: { type: "dragon", tags: ["teste"] },
  alignment: ["C", "E"],
  ac: [{ ac: 18, from: ["armadura natural"] }],
  hp: { average: 133, formula: "14d10 + 56" },
  speed: { walk: 40, fly: 80, canHover: true },
  str: 22, dex: 12, con: 19, int: 8, wis: 14, cha: 16,
  save: { con: "+8", wis: "+6" },
  skill: { perception: "+9", stealth: "+5" },
  senses: ["darkvision 120 ft.", "blindsight 30 ft."],
  passive: 19,
  immune: ["fire"],
  vulnerable: ["cold"],
  conditionImmune: ["frightened"],
  languages: ["Common", "Draconic", "telepathy 60 ft."],
  cr: "9",
  trait: [{ name: "Iluminado", entries: ["Emite luz brilhante em um raio de {@dice 3d6} metros."] }],
  action: [
    { name: "Ataque Múltiplo", entries: ["A criatura faz duas Mordidas."] },
    { name: "Mordida", entries: ["{@atkr m} {@hit 8}, alcance 3 m. {@h}{@damage 2d10 + 6} de dano perfurante."] },
    { name: "Sopro Cintilante {@recharge 5}", entries: ["{@actSave dex} {@dc 16}, dano em cone."] },
  ],
  legendary: [{ name: "Investida", entries: ["A criatura se move até seu deslocamento."] }],
  legendaryHeader: ["A criatura pode realizar 3 ações lendárias."],
  spellcasting: [{ name: "Conjuração", ability: "cha", headerEntries: ["Conjura usando Carisma."], will: ["{@spell luz}"], daily: { "1e": ["{@spell voo}"] } }],
};

let n = 0; const ok = (c: boolean, m: string) => { assert.ok(c, m); n++; };

// render de tags
ok(render5e("{@atkr m} {@hit 8}").includes("Melee Attack Roll"), "atkr melee");
ok(render5e("{@damage 2d10 + 6}") === "2d10 + 6", "damage");
ok(render5e("{@dc 16}") === "DC 16", "dc");

const c = convert5e(fake);
Monster.parse(c);
ok(c.size === "Large", "size L->Large");
ok(c.type === "Dragon", "type");
ok(c.alignment === "Chaotic Evil", "alignment CE");
ok(c.ac.value === 18, "ac");
ok(c.hp.value === 133 && c.hp.formula.includes("14d10"), "hp");
ok(c.speeds.fly === 80 && c.hover === true, "speed+hover");
ok(c.abilities.str.score === 22 && c.abilities.str.mod === 6, "str mod");
ok(c.abilities.con.save === 8, "con save from save obj");
ok(c.abilities.int.save === -1, "int save from mod");
ok(c.skills.length === 2, "skills");
ok(c.damageImmunities.includes("fire"), "immune");
ok(c.vulnerabilities.includes("cold"), "vulnerable");
ok(c.conditionImmunities.includes("frightened"), "condImmune");
ok(c.telepathy === 60, "telepathy");
ok(c.senses.darkvision === 120 && c.senses.passivePerception === 19, "senses");
ok(c.cr === "9", "cr");
ok(c.actions.length === 3, "actions count");
ok(c.actions[1]!.text.includes("2d10 + 6"), "bite damage rendered");
ok(c.actions[2]!.recharge?.includes("5") ?? false, "recharge parsed");
ok(c.legendaryActions.length === 1 && !!c.legendaryIntro, "legendary + intro");
ok(!!c.spellcasting && c.spellcasting.ability === "cha", "spellcasting");

console.log(`\n✓ ${n} asserts do conversor 5e.tools passaram`);
