/**
 * Utilitario: aplica cleanText sobre um pages.merged.json ja extraido e grava
 * data/raw/pages.json. Usado quando a extracao foi feita em blocos (ambientes
 * com limite de tempo por processo). No ambiente do usuario basta `npm run
 * extract`, que processa o PDF inteiro de uma vez.
 */
import { readFile, writeFile } from "node:fs/promises";
import { paths } from "../config.js";
import { cleanText } from "./clean.js";
import { makeLogger } from "../util/log.js";

const log = makeLogger("extract:merge");
const src = paths.rawPages.replace("pages.json", "pages.merged.json");

async function main() {
  const pages = JSON.parse(await readFile(src, "utf8")) as { page: number; columns: string[]; text: string }[];
  const cleaned = pages.map((p) => ({
    page: p.page,
    columns: p.columns.map(cleanText),
    text: cleanText(p.text),
  }));
  await writeFile(paths.rawPages, JSON.stringify(cleaned, null, 2), "utf8");
  log.ok(`${cleaned.length} paginas limpas -> data/raw/pages.json`);
}
main().catch((e) => { log.error(e); process.exit(1); });
