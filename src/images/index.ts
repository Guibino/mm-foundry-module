/**
 * Etapa 5 — Download de imagens (token + retrato) do 5e.tools.
 *
 * IMPORTANTE (direitos autorais): as imagens sao arte da Wizards of the Coast
 * (hospedadas no 5e.tools). Este script baixa para uso LOCAL/pessoal no SEU
 * ambiente e NAO inclui nada no repositorio (module/assets/* e gitignored).
 * Rode por sua conta, respeitando os termos do 5e.tools.
 *
 * Padrao de URL (fonte XMM = Monster Manual 2024/2025):
 *   token:   https://5e.tools/img/bestiary/tokens/XMM/<Nome>.webp
 *   retrato: https://5e.tools/img/bestiary/XMM/<Nome>.webp
 *
 * O download e resumivel: arquivos ja baixados sao pulados. Nomes que faltarem
 * (404) sao listados em module/assets/faltantes.json para ajuste manual.
 *
 * Executar: npm run images        (variavel MM5E_IMG_SOURCE p/ trocar "XMM")
 * Depois:   npm run relink        (vincula as imagens e recompila o pack)
 */
import { mkdir, readFile, writeFile, access } from "node:fs/promises";
import path from "node:path";
import { paths } from "../config.js";
import { makeLogger } from "../util/log.js";
import type { Monster } from "../parse/schema.js";

const log = makeLogger("images");
const SOURCE = process.env.MM5E_IMG_SOURCE ?? "XMM";
const BASE = "https://5e.tools/img/bestiary";
const DELAY = Number(process.env.MM5E_DELAY ?? 120); // ms entre requisicoes (educado)

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
  Referer: "https://5e.tools/bestiary.html",
  Accept: "image/webp,image/*,*/*;q=0.8",
};

const slug = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 60);

/**
 * Correcao de nomes para casar com o nome de arquivo do 5e.tools quando o nome
 * do monstro veio com ruido de OCR ou foi traduzido para PT. Chave = nome atual
 * do monstro; valor = nome canonico (ingles) usado na URL do 5e.tools.
 */
const NAME_OVERRIDES: Record<string, string> = {
  "VAMPIRE FAMILIAR": "Vampire Familiar",
  "SUCCUBUS": "Succubus",
  "SWARM OF VENOMOUS SNAKES": "Swarm of Venomous Snakes",
  "Venomous Snakes": "Swarm of Venomous Snakes",
  "Smothering": "Rug of Smothering",
  "Rug of Smothering Animado": "Rug of Smothering",
  "Ax.e Beak": "Axe Beak",
  "Bal or": "Balor",
  "Gulthlas Blight": "Gulthias Blight",
  "Bone N aga": "Bone Naga",
  "Dark.mantle": "Darkmantle",
  "Death l(night Aspirant": "Death Knight Aspirant",
  "Ga . rgoyle": "Gargoyle",
  "Goblin Mjruon": "Goblin Minion",
  "Guardian N aga": "Guardian Naga",
  "Hidra": "Hydra",
  "Jackal were": "Jackalwere",
  "Enxame de Larvas": "Swarm of Larvae",
  "Salamander Modron Qu