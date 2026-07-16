/**
 * Configuração central do pipeline.
 *
 * O único caminho que o usuário costuma precisar ajustar é `SOURCE_PDF`.
 * Todos os artefatos intermediários (data/raw, data/intermediate) e o
 * conteúdo do módulo (module/packs, assets) são gerados localmente e NÃO
 * fazem parte do repositório — ver .gitignore.
 */
import { fileURLToPath } from "node:url";
import path from "node:path";

const __filename = fileURLToPath(import.meta.url);
export const ROOT = path.resolve(path.dirname(__filename), "..");

/** Caminho do PDF do Monster Manual 2024 (AI Upscaled recomendado — tem texto extraível). */
export const SOURCE_PDF =
  process.env.MM_PDF ??
  path.resolve(ROOT, "..", "4. MM (2024) - AI Upscaled + HQ [5e].pdf");

/** PDF do Livro do Jogador, usado apenas como referência de terminologia oficial. */
export const PHB_PDF =
  process.env.PHB_PDF ??
  path.resolve(ROOT, "..", "DnD 5.5 - Livro do Jogador (2024) - Erratas Agosto.pdf");

export const paths = {
  raw: path.join(ROOT, "data", "raw"),
  rawPages: path.join(ROOT, "data", "raw", "pages.json"),
  intermediate: path.join(ROOT, "data", "intermediate"),
  monstersEn: path.join(ROOT, "data", "intermediate", "monsters.en.json"),
  monstersPt: path.join(ROOT, "data", "intermediate", "monsters.pt.json"),
  actors: path.join(ROOT, "data", "intermediate", "actors"),
  glossary: path.join(ROOT, "data", "glossary", "pt-BR.json"),
  overrides: path.join(ROOT, "data", "glossary", "overrides.pt.json"),
  module: path.join(ROOT, "module"),
  packSource: path.join(ROOT, "module", "packs", "_source"),
  portraits: path.join(ROOT, "module", "assets", "portraits"),
  tokens: path.join(ROOT, "module", "assets", "tokens"),
  lang: path.join(ROOT, "module", "lang", "pt-BR.json"),
  report: path.join(ROOT, "data", "intermediate", "quality-report.json"),
};

/** ID do módulo no Foundry — usado em referências de caminho de assets. */
export const MODULE_ID = "mm2024-pt-br";
