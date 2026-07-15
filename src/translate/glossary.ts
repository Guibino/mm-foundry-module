/**
 * Carregador do glossario PT-BR e utilitarios de traducao de terminologia.
 *
 * A traducao e DETERMINISTICA: substituicao de termos/frases oficiais (mesma
 * traducao unica por termo, conforme Livro do Jogador 2024). Isso garante
 * consistencia mecanica. A traducao literaria de prosa longa nao e feita aqui
 * (ver README, secao "Traducao") — os termos mecanicos, porem, ficam corretos.
 */
import { readFileSync } from "node:fs";
import { paths } from "../config.js";

export interface Glossary {
  sizes: Record<string, string>;
  types: Record<string, string>;
  typeKeys: Record<string, string>;
  sizeKeys: Record<string, string>;
  alignments: Record<string, string>;
  abilities: Record<string, string>;
  abilityKeys: Record<string, string>;
  skills: Record<string, { pt: string; key: string }>;
  damageTypes: Record<string, { pt: string; key: string }>;
  conditions: Record<string, { pt: string; key: string }>;
  senses: Record<string, { pt: string; key: string }>;
  movement: Record<string, string>;
  languages: Record<string, string>;
  phrases: Record<string, string>;
}

export const glossary: Glossary = JSON.parse(readFileSync(paths.glossary, "utf8"));

/** Substituicoes de frase/termo, aplicadas da mais longa para a mais curta. */
function buildReplacements(): [RegExp, string][] {
  const pairs: [string, string][] = [];
  for (const [en, pt] of Object.entries(glossary.phrases)) pairs.push([en, pt]);
  for (const [en, v] of Object.entries(glossary.damageTypes)) pairs.push([en, v.pt]);
  for (const [en, v] of Object.entries(glossary.conditions)) pairs.push([en, v.pt]);
  for (const [en, v] of Object.entries(glossary.senses)) pairs.push([en, v.pt]);
  for (const [en, pt] of Object.entries(glossary.languages)) pairs.push([en, pt]);
  // ordena por comprimento decrescente para casar frases antes de palavras
  pairs.sort((a, b) => b[0].length - a[0].length);
  return pairs.map(([en, pt]) => [new RegExp(`\\b${en.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "g"), pt]);
}
const REPLACEMENTS = buildReplacements();

/** Traduz terminologia mecanica de um texto (substituicao de termos oficiais). */
export function translateText(text: string): string {
  let s = text;
  for (const [re, pt] of REPLACEMENTS) s = s.replace(re, pt);
  return s;
}

/** Traduz o nome do monstro por tokens comuns (aproximacao; nao substitui nomes oficiais). */
const NAME_TOKENS: Record<string, string> = {
  Adult: "Adulto", Young: "Jovem", Ancient: "Ancião", Wyrmling: "Filhote",
  Dragon: "Dragão", Giant: "Gigante", Greater: "Maior", Lesser: "Menor",
  Elder: "Ancião", Guard: "Guarda", Captain: "Capitão", Knight: "Cavaleiro",
  Priest: "Sacerdote", Warrior: "Guerreiro", Skeleton: "Esqueleto",
  Zombie: "Zumbi", Ghost: "Fantasma", Demon: "Demônio", Devil: "Diabo",
  Elemental: "Elemental", Golem: "Golem", Swarm: "Enxame", of: "de",
  Red: "Vermelho", Blue: "Azul", Green: "Verde", White: "Branco",
  Black: "Negro", Gold: "Dourado", Silver: "Prateado", Bronze: "Bronze",
  Brass: "Latão", Copper: "Cobre"
};
export function translateName(name: string): string {
  return name
    .toLowerCase()
    .split(" ")
    .map((w) => {
      const cap = w.charAt(0).toUpperCase() + w.slice(1);
      return NAME_TOKENS[cap] ?? cap;
    })
    .join(" ");
}
