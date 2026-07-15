/**
 * Etapa 7 — Build do Compendium.
 * Compila module/packs/_source/*.json em um pack LevelDB (module/packs/monsters)
 * usando o foundryvtt-cli oficial. Executar: npm run build:pack
 */
import { rm, mkdir } from "node:fs/promises";
import path from "node:path";
// @ts-ignore - pacote sem tipos
import { compilePack } from "@foundryvtt/foundryvtt-cli";
import { paths } from "../config.js";
import { makeLogger } from "../util/log.js";

const log = makeLogger("build:pack");
const dest = path.join(paths.module, "packs", "monsters");

async function main() {
  await rm(dest, { recursive: true, force: true });
  await mkdir(dest, { recursive: true });
  await compilePack(paths.packSource, dest, { log: false });
  log.ok(`Compendium compilado -> module/packs/monsters (LevelDB)`);
}
main().catch((e) => { log.error(e); process.exit(1); });
