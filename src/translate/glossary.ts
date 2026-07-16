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
    // Limites de palavra Unicode-aware: tratam letras acentuadas como parte da
    // palavra. Sem isso, "in"->"em" casaria dentro de "início" (o \b padrao ve
    // o "í" como nao-palavra). So exige limite quando a borda e uma letra.
    const startB = /^\p{L}/u.test(en) ? "(?<![\\p{L}])" : "";
    const endB = /\p{L}$/u.test(en) ? "(?![\\p{L}])" : "";
    return [new RegExp(`${startB}${esc}${endB}`, "gu"), pt] as [RegExp, string];
  });
}
const REPLACEMENTS = buildReplacements();

/** Converte distancias imperiais para metrico (5 ft = 1,5 m), padrao PT-BR oficial. */
function convertUnits(text: string): string {
  const m = (ft: number) => {
    const v = ft * 0.3; // 5 ft -> 1,5 m
    return (Number.isInteger(v) ? String(v) : v.toFixed(1)).replace(".", ",");
  };
  return text.replace(/(\d+)(?:\/(\d+))?[- ](?:ft\.?|feet|foot|pés|pé|pes)\b/giu, (_all, a, b) =>
    b ? `${m(Number(a))}/${m(Number(b))} m` : `${m(Number(a))} m`);
}

/**
 * Reordena formas de area para PT natural depois do glossario:
 * "em uma 9 m Cone" -> "em um Cone de 9 m"; trata Linha/Esfera/Cubo/Emanacao e
 * os sufixos -long/-wide/-radius/-diameter que sobram da conversao de unidades.
 */
function fixAreas(s: string): string {
  const N = "(\\d[\\d.,]*)";
  return s
    .replace(new RegExp(`em uma ${N} m-long, ${N} m-wide Linha`, "g"), "em uma Linha de $1 m de comprimento e $2 m de largura")
    .replace(new RegExp(`${N} m-long, ${N} m-wide Linha`, "g"), "Linha de $1 m de comprimento e $2 m de largura")
    .replace(new RegExp(`em uma ${N} m-radius Esfera`, "g"), "em uma Esfera de $1 m de raio")
    .replace(new RegExp(`${N} m-radius Esfera`, "g"), "Esfera de $1 m de raio")
    .replace(new RegExp(`em uma ${N} m Cone`, "g"), "em um Cone de $1 m")
    .replace(new RegExp(`${N} m Cone`, "g"), "Cone de $1 m")
    .replace(new RegExp(`em uma ${N} m Cubo`, "g"), "em um Cubo de $1 m")
    .replace(new RegExp(`${N} m Cubo`, "g"), "Cubo de $1 m")
    .replace(new RegExp(`em uma ${N} m Emanação`, "g"), "em uma Emanação de $1 m")
    .replace(new RegExp(`${N} m Emanação`, "g"), "Emanação de $1 m")
    .replace(/ m-long\b/g, " m de comprimento")
    .replace(/ m-wide\b/g, " m de largura")
    .replace(/ m-radius\b/g, " m de raio")
    .replace(/ m-diameter\b/g, " m de diâmetro");
}

/** Traduz terminologia mecanica de um texto (substituicao de termos oficiais). */
/** Contrai preposicao+artigo (de+a=da, em+o=no...) e limpa artefatos de traducao. */
function fixContractions(s: string): string {
  return s
    .replace(/\bde da\b/g, "da").replace(/\bde do\b/g, "do")
    .replace(/\bde a\b/g, "da").replace(/\bde o\b/g, "do")
    .replace(/\bde os\b/g, "dos").replace(/\bde as\b/g, "das")
    .replace(/\bem a\b/g, "na").replace(/\bem o\b/g, "no")
    .replace(/\bem os\b/g, "nos").replace(/\bem as\b/g, "nas")
    .replace(/\bpor a\b/g, "pela").replace(/\bpor o\b/g, "pelo");
}

export function translateText(text: string): string {
  let s = convertUnits(text);
  for (const [re, pt] of REPLACEMENTS) s = s.replace(re, pt);
  return fixContractions(fixAreas(s));
}

/** So converte unidades para metrico (para texto ja em PT, ex.: Pocket DM). */
export function metricize(text: string): string {
  return fixAreas(convertUnits(text));
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

/** Palavras genericas de nome que NAO servem como auto-referencia isolada. */
const NAME_STOPWORDS = new Set(["the", "of", "and", "lord", "lady", "master", "type"]);

/**
 * Candidatos de auto-referencia da criatura: nome completo e cada palavra
 * (separando tambem por hifen), p.ex. "Arch-hag" -> "arch","hag" e
 * "Vampire Umbral Lord" -> "vampire","umbral". So afeta a exibicao (fallback),
 * nao as chaves de override.
 */
function creatureCands(name: string): string[] {
  const clean = name.toLowerCase().replace(/[^a-z0-9 -]/g, "");
  const words = clean.split(/[\s-]+/).filter((w) => w.length > 2 && !NAME_STOPWORDS.has(w));
  return [...new Set([clean, ...words])].filter(Boolean).sort((a, b) => b.length - a.length);
}

/** Troca "the dragon"/"The dragon's"... por "a criatura"/"da criatura" (feminino). */
export function replaceSelfReference(text: string, name: string): string {
  let s = text;
  for (const c of creatureCands(name)) {
    const esc = c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    s = s.replace(new RegExp(`\\bThe ${esc}'s\\b`, "g"), "Da criatura")
         .replace(new RegExp(`\\bthe ${esc}'s\\b`, "g"), "da criatura")
         .replace(new RegExp(`\\bThe ${esc}\\b`, "g"), "A criatura")
         .replace(new RegExp(`\\bthe ${esc}\\b`, "g"), "a criatura");
  }
  return s;
}

/** Traduz o texto de um traco/acao: usa override humano se houver, senao glossario. */
export function translateEntryText(text: string, name: string): string {
  const key = normalizeSubject(text.trim(), name);
  if (overrides[key]) return overrides[key]!;
  return translateText(replaceSelfReference(text, name));
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
