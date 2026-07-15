/**
 * Etapa 1 — Extração.
 *
 * Invoca o helper Python (pdfplumber) que devolve as páginas já separadas em
 * colunas e em ordem de leitura, aplica a limpeza de OCR (cleanText) e grava
 * data/raw/pages.json.
 *
 * Backend Python é usado só aqui, por robustez (pdfjs-dist falha neste
 * ambiente). Todo o restante do pipeline é TypeScript e consome o JSON.
 *
 * Executar: npm run extract
 *   Variáveis: MM_PDF (caminho do PDF), MM_START / MM_END (faixa de páginas).
 */
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SOURCE_PDF, paths } from "../config.js";
import { makeLogger } from "../util/log.js";
import { cleanText } from "./clean.js";

const log = makeLogger("extract");
const HERE = path.dirname(fileURLToPath(import.meta.url));
const PY = path.join(HERE, "extract_pdf.py");

interface RawPage { page: number; columns: string[]; text: string }

function runPython(): Promise<RawPage[]> {
  return new Promise((resolve, reject) => {
    const args = [PY, SOURCE_PDF];
    if (process.env.MM_START) args.push(process.env.MM_START);
    if (process.env.MM_END) args.push(process.env.MM_END ?? "");
    const proc = spawn("python3", args, { maxBuffer: 1024 * 1024 * 512 });
    let out = "";
    let err = "";
    proc.stdout.setEncoding("utf8");
    proc.stdout.on("data", (d) => (out += d));
    proc.stderr.on("data", (d) => {
      err += d;
      const m = String(d).match(/PROGRESS (\d+)\/(\d+)/g);
      if (m) { const last = m[m.length - 1]!; log.info(last.replace("PROGRESS ", "página ")); }
    });
    proc.on("error", reject);
    proc.on("close", (code) => {
      if (code !== 0) return reject(new Error(`python saiu com código ${code}: ${err.slice(-500)}`));
      try { resolve(JSON.parse(out)); } catch (e) { reject(e); }
    });
  });
}

async function main() {
  log.info("PDF:", SOURCE_PDF);
  await mkdir(paths.raw, { recursive: true });
  const pages = await runPython();
  const cleaned = pages.map((pg) => ({
    page: pg.page,
    columns: pg.columns.map(cleanText),
    text: cleanText(pg.text),
  }));
  await writeFile(paths.rawPages, JSON.stringify(cleaned, null, 2), "utf8");
  log.ok(`${cleaned.length} páginas extraídas → data/raw/pages.json`);
}

main().catch((e) => { log.error(e); process.exit(1); });
