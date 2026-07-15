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

  console.log(`\n✓ ${passed} asserts passaram`);
}
main().catch((e) => { console.error("✗ TESTE FALHOU:", e.message); process.exit(1); });
