/**
 * Carregador do glossario PT-BR e utilitarios de traducao de terminologia.
 *
 * A traducao e DETERMINISTICA: substituicao de termos/frases oficiais (mesma
 * traducao unica por termo, conforme Livro do Jogador 2024). Isso garante
 * consistencia mecanica. A traducao literaria de prosa longa nao e feita aqui
 * (ver README, secao "Traducao") — os termos mecanicos, porem, ficam corretos.
 */
import { readFileSync, existsSync } from "node:fs";
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
  /** Nomes de acoes/tracos/armas (Bite, Rend, Magic Resistance, Longsword...). */
  names?: Record<string, string>;
}

export const glossary: Glossary = JSON.parse(readFileSync(paths.glossary, "utf8"));

/** Frases que NAO devem exigir limite de palavra ao final (terminam em `:`). */
const NO_END_BOUNDARY = /[^\w]$/;

/** Substituicoes de frase/termo, aplicadas da mais longa para a mais curta. */
function buildReplacements(): [RegExp, string][] {
  const pairs: [string, string][] = [];
  for (const [en, pt] of Object.entries(glossary.phrases)) pairs.push([en, pt]);
  for (const [en, pt] of Object.entries(glossary.names ?? {})) pairs.push([en, pt]);
  for (const [en, pt] of Object.entries(glossary.abilities)) if (en.length > 3) pairs.push([en, pt]);
  for (const [en, v] of Object.entries(glossary.damageTypes)) pairs.push([en, v.pt]);
  for (const [en, v] of Object.entries(glossary.conditions)) pairs.push([en, v.pt]);
  for (const [en, v] of Object.entries(glossary.senses)) pairs.push([en, v.pt]);
  for (const [en, pt] of Object.entries(glossary.languages)) pairs.push([en, pt]);
  // ordena por comprimento decrescente para casar frases antes de palavras
  pairs.sort((a, b) => b[0].length - a[0].length);
  return pairs.map(([en, pt]) => {
    const esc = en.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    // limite de palavra no fim so quando o termo termina em caractere de palavra
    // (evita "Ram" casar dentro de "Rampage"); frases como "Hit:" ficam livres.
    const end = NO_END_BOUNDARY.test(en) ? "" : "\\b";
    return [new RegExp(`\\b${esc}${end}`, "g"), pt] as [RegExp, string];
  });
}
const REPLACEMENTS = buildReplacements();

/** Converte distancias imperiais para metrico (5 ft = 1,5 m), padrao PT-BR oficial. */
function convertUnits(text: string): string {
  const m = (ft: number) => {
    const v = ft * 0.3; // 5 ft -> 1,5 m
    return (Number.isInteger(v) ? String(v) : v.toFixed(1)).replace(".", ",");
  };
  return text.replace(/(\d+)(?:\/(\d+))?[- ](?:ft\.?|feet|foot)\b/gi, (_all, a, b) =>
    b ? `${m(Number(a))}/${m(Number(b))} m` : `${m(Number(a))} m`);
}

/** Traduz terminologia mecanica de um texto (substituicao de termos oficiais). */
export function translateText(text: string): string {
  let s = convertUnits(text);
  for (const [re, pt] of REPLACEMENTS) s = s.replace(re, pt);
  return s;
}

/**
 * Overrides de prosa: traducao humana completa de tracos/acoes, indexada pela
 * frase em ingles com a auto-referencia da criatura normalizada para «C».
 * Assim uma unica traducao (usando "a criatura") cobre todos os monstros que
 * compartilham a mesma habilidade (ex.: Resistencia a Magia, Anfibio...).
 */
export const overrides: Record<string, string> =
  existsSync(paths.overrides) ? JSON.parse(readFileSync(paths.overrides, "utf8")) : {};

/** Substitui a auto-referencia da criatura ("the dragon", "aboleth"...) por «C». */
export function normalizeSubject(text: string, name: string): string {
  const words = name.toLowerCase().replace(/[^a-z0-9 -]/g, "").split(/\s+/).filter(Boolean);
  const cands = [...new Set([name.toLowerCase(), words[words.length - 1]!, words[0]!])]
    .filter(Boolean).sort((a, b) => b.length - a.length);
  let s = text;
  for (const c of cands) {
    const esc = c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    s = s.replace(new RegExp(`\\b${esc}\\b`, "gi"), "«C»");
  }
  return s;
}

/** Traduz o texto de um traco/acao: usa override humano se houver, senao glossario. */
export function translateEntryText(text: string, name: string): string {
  const key = normalizeSubject(text.trim(), name);
  if (overrides[key]) return overrides[key]!;
  return translateText(text);
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
