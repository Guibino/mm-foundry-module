/**
 * Correcao de artefatos sistematicos de OCR no texto extraido.
 *
 * O PDF "AI Upscaled" tem texto extraivel, mas com erros recorrentes de OCR:
 *   - digitos trocados por letras em expressoes de dado (ldl0 -> 1d10);
 *   - ligaduras (Sai;ing -> Saving, lni.,,isibility -> Invisibility);
 *   - "+S" -> "+5"; "E1Jil" -> "Evil"; hifen suave;
 *   - letras isoladas do titulo vertical de capitulo vazando como linhas de 1 char.
 *
 * Regras conservadoras, aplicadas em ordem. O que sobrar e sinalizado no
 * relatorio de qualidade para revisao manual.
 */

const SOFT_HYPHEN = /­\s*\n?/g;

/** Remove linhas de ruido de margem (<=1 caractere alfanumerico). */
function dropNoiseLines(s: string): string {
  return s
    .split("\n")
    .filter((ln) => ln.trim() === "" || ln.replace(/[^A-Za-z0-9]/g, "").length >= 2)
    .join("\n");
}

/** Corrige expressoes de dados: l/I -> 1, O -> 0 dentro de padroes NdM. */
function fixDice(s: string): string {
  return s.replace(/\b([liI0-9]{1,3})\s*[dD]\s*([liIoO0-9]{1,3})\b/g, (m, a, b) => {
    const fix = (x: string) => x.replace(/[lI]/g, "1").replace(/[oO]/g, "0");
    const na = fix(a), nb = fix(b);
    return /^\d+$/.test(na) && /^\d+$/.test(nb) ? `${na}d${nb}` : m;
  });
}

const LITERALS: [RegExp, string][] = [
  [/E1Jil/g, "Evil"],
  [/Sai;ing/g, "Saving"],
  [/lni\.,,isibility|Inui sibility|lnvisibility/g, "Invisibility"],
  [/Imm ?unitie ?s|Imm unities/g, "Immunities"],
  [/Vulner ?abilities|Vulnera bilities/g, "Vulnerabilities"],
  [/Resis ?tances|Resist ances/g, "Resistances"],
  [/Condi ?tion Immunities/g, "Condition Immunities"],
  [/\bWis\b/g, "WIS"],
];

/** "+S" isolado -> "+5". */
function fixPlusS(s: string): string {
  return s.replace(/([+−-])\s?S\b/g, "$15");
}

export function cleanText(input: string): string {
  let s = input;
  s = dropNoiseLines(s);
  s = s.replace(SOFT_HYPHEN, "");
  s = s.replace(/’/g, "'").replace(/[“”]/g, '"');
  for (const [re, rep] of LITERALS) s = s.replace(re, rep);
  s = fixDice(s);
  s = fixPlusS(s);
  s = s.replace(/\b([1-9lI])\s*\/\s*Day\b/g, (_m, d) => `${String(d).replace(/[lI]/g, "1")}/Day`);
  s = s.replace(/[ \t]{2,}/g, " ");
  return s;
}
