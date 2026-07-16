/**
 * Etapa 4 — Traducao.
 * Le monsters.en.json e grava monsters.pt.json com a terminologia mecanica
 * traduzida de forma consistente (glossario oficial PT-BR). Campos estruturais
 * em ingles sao preservados para o mapeamento de chaves do dnd5e.
 * Executar: npm run translate
 */
import { readFile, writeFile } from "node:fs/promises";
import { paths } from "../config.js";
import { makeLogger } from "../util/log.js";
import { glossary, translateText, translateName, translateEntryText } from "./glossary.js";
import type { Monster, NamedText } from "../parse/schema.js";

const log = makeLogger("translate");

/** Traduz o nome de uma habilidade: usa frase oficial se existir, senao mantem. */
function translateEntryName(name: string): string {
  if (glossary.names?.[name]) return glossary.names[name]!;
  if (glossary.phrases[name]) return glossary.phrases[name]!;
  // remove sufixo de recarga/uso ja extraido; traduz tokens conhecidos
  return translateText(name);
}

function translateEntries(entries: NamedText[], monsterName: string): NamedText[] {
  return entries.map((e) => ({
    ...e,
    name: translateEntryName(e.name),
    text: translateEntryText(e.text, monsterName),
    // preserva o texto EN para deteccao de mecanica (to-hit/dano/CD) no normalize
    textEn: e.text,
  }));
}

async function main() {
  const monsters: Monster[] = JSON.parse(await readFile(paths.monstersEn, "utf8"));
  const out = monsters.map((m) => ({
    ...m,
    namePt: translateName(m.name),
    alignmentPt: glossary.alignments[m.alignment] ?? m.alignment,
    sizePt: glossary.sizes[m.size] ?? m.size,
    typePt: glossary.types[m.type] ?? m.type,
    description: m.description ? translateText(m.description) : undefined,
    traits: translateEntries(m.traits, m.name),
    actions: translateEntries(m.actions, m.name),
    bonusActions: translateEntries(m.bonusActions, m.name),
    reactions: translateEntries(m.reactions, m.name),
    legendaryActions: translateEntries(m.legendaryActions, m.name),
    mythicActions: translateEntries(m.mythicActions, m.name),
    lairActions: translateEntries(m.lairActions, m.name),
    regionalEffects: translateEntries(m.regionalEffects, m.name),
    legendaryIntro: m.legendaryIntro ? translateText(m.legendaryIntro) : undefined,
    mythicIntro: m.mythicIntro ? translateText(m.mythicIntro) : undefined,
    spellcasting: m.spellcasting
      ? { ...m.spellcasting, intro: translateText(m.spellcasting.intro) }
      : undefined,
  }));
  await writeFile(paths.monstersPt, JSON.stringify(out, null, 2), "utf8");
  log.ok(`${out.length} monstros traduzidos -> monsters.pt.json`);
}
main().catch((e) => { log.error(e); process.exit(1); });
