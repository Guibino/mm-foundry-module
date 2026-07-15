/**
 * Etapa 9 — Relatorio de qualidade.
 * Analisa monsters.en.json e gera data/intermediate/quality-report.json +
 * um resumo no console: cobertura, monstros com avisos, e possiveis anomalias
 * (secoes vazias/excessivas) que merecem revisao manual.
 * Executar: npm run report
 */
import { readFile, writeFile } from "node:fs/promises";
import { paths } from "../config.js";
import { makeLogger } from "../util/log.js";
import type { Monster } from "../parse/schema.js";

const log = makeLogger("report");

async function main() {
  const monsters: Monster[] = JSON.parse(await readFile(paths.monstersEn, "utf8"));
  const rows = monsters.map((m) => {
    const anomalies: string[] = [...m.warnings];
    if (m.actions.length === 0 && m.traits.length === 0) anomalies.push("sem acoes/traits");
    if (m.actions.length > 12) anomalies.push("acoes em excesso (possivel vazamento de coluna)");
    if (!m.cr || m.cr === "0") anomalies.push("CR ausente");
    return {
      name: m.name, page: m.page, cr: m.cr,
      traits: m.traits.length, actions: m.actions.length,
      legendary: m.legendaryActions.length, spellcasting: !!m.spellcasting,
      anomalies,
    };
  });
  const clean = rows.filter((r) => r.anomalies.length === 0).length;
  const report = {
    total: monsters.length,
    semAnomalias: clean,
    comAnomalias: monsters.length - clean,
    comSpellcasting: rows.filter((r) => r.spellcasting).length,
    comLendarias: rows.filter((r) => r.legendary > 0).length,
    detalhes: rows.filter((r) => r.anomalies.length > 0),
  };
  await writeFile(paths.report, JSON.stringify(report, null, 2), "utf8");
  log.ok(`Relatorio: ${clean}/${monsters.length} sem anomalias, ${report.comAnomalias} para revisao`);
  log.info(`Spellcasting: ${report.comSpellcasting} | Lendarias: ${report.comLendarias} -> quality-report.json`);
}
main().catch((e) => { log.error(e); process.exit(1); });
