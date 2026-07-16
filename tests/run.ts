/**
 * Testes de validacao do pipeline (sem framework externo — asserts nativos).
 * Executar: npm test
 */
import assert from "node:assert";
import { readFile } from "node:fs/promises";
import { paths } from "../src/config.js";
import { Monster } from "../src/parse/schema.js";
import { toActor } from "../src/normalize/dnd5e.js";
import { translateText } from "../src/translate/glossary.js";

let passed = 0;
function ok(cond: boolean, msg: string) { assert.ok(cond, msg); passed++; }

async function main() {
  const monsters: Monster[] = JSON.parse(await readFile(paths.monstersEn, "utf8"));
  ok(monsters.length > 250, `esperado > 250 monstros, obtido ${monsters.length}`);

  // 1) todo monstro valida no schema Zod
  for (const m of monsters) Monster.parse(m);
  ok(true, "todos os monstros validam no schema Zod");

  // 2) invariantes de cabecalho
  const badHp = monsters.filter((m) => !(m.hp.value >= 1));
  ok(badHp.length === 0, `HP invalido em ${badHp.length} monstros`);
  const badAb = monsters.filter((m) => m.abilities.str.score < 1 || m.abilities.str.score > 40);
  ok(badAb.length < monsters.length * 0.10, `muitos scores de FOR fora de faixa: ${badAb.length}`);

  // 3) traducao de terminologia
  ok(translateText("Melee Attack Roll: +5").startsWith("Rolagem de Ataque"), "traducao de frase mecanica");
  ok(translateText("Fire damage").includes("de dano"), "traducao de 'damage'");

  // 4) normalizacao produz Actor npc valido
  const pt = JSON.parse(await readFile(paths.monstersPt, "utf8"));
  const actor = toActor(pt[0]);
  ok(actor.type === "npc", "actor e do tipo npc");
  ok(typeof actor._id === "string" && actor._id.length === 16, "actor tem _id de 16 chars");
  ok(actor.system.attributes.hp.max >= 1, "actor tem HP");
  ok(Array.isArray(actor.items), "actor tem array de items");
  ok(actor.items.every((i: any) => i._key?.startsWith("!actors.items!")), "items tem _key valido");

  // 5) activities nativas do dnd5e a partir de flags.mm2024.mechanics
  const actors = pt.map((m: any) => toActor(m));
  let attackAct = 0, saveAct = 0;
  for (const a of actors)
    for (const it of a.items)
      for (const act of Object.values(it.system.activities ?? {}) as any[]) {
        if (act.type === "attack") attackAct++;
        if (act.type === "save") saveAct++;
      }
  ok(attackAct > 200, `esperado > 200 activities de ataque, obtido ${attackAct}`);
  ok(saveAct > 80, `esperado > 80 activities de save, obtido ${saveAct}`);

  // 5b) uma activity de ataque bem-formada (Goblin Warrior: Scimitar +4)
  const goblin = actors.find((a: any) => a.flags.mm2024.nameEn === "Goblin Warrior");
  ok(!!goblin, "Goblin Warrior presente");
  const scimitar = goblin?.items.find((i: any) => /Scimitar|Cimitarra/i.test(i.name));
  const atk = scimitar && (Object.values(scimitar.system.activities) as any[]).find((x) => x.type === "attack");
  ok(!!atk, "Scimitar tem activity de ataque");
  ok(atk?.attack?.flat === true && atk?.attack?.bonus === "4", "ataque tem bonus fixo +4");
  ok(atk?.damage?.parts?.length === 1 && atk.damage.parts[0].denomination === 6, "dano d6 na parte");

  // 5c) uma activity de save bem-formada (Air Elemental: Whirlwind, CD 13 FOR)
  const air = actors.find((a: any) => a.flags.mm2024.nameEn === "Air Elemental");
  const wh = air?.items.map((i: any) => Object.values(i.system.activities) as any[]).flat()
    .find((x: any) => x?.type === "save");
  ok(!!wh, "Air Elemental tem activity de save");
  ok(wh?.save?.dc?.formula === "13" && wh?.save?.ability?.[0] === "str", "save CD 13 Forca");

  console.log(`\n✓ ${passed} asserts passaram`);
}
main().catch((e) => { console.error("✗ TESTE FALHOU:", e.message); process.exit(1); });
