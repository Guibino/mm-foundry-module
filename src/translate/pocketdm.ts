/**
 * Fonte de traducao PT do Pocket DM (https://pocketdm.com.br, CC-BY-4.0).
 * Casa por monstro + nome da habilidade (ambos em ingles) e SO usa a descricao
 * PT quando a assinatura mecanica (dados, CD, bonus de acerto, alcances) confere
 * com o texto 2024 do proprio modulo — evitando injetar numeros de outra edicao.
 * As distancias sao convertidas para metros no chamador (convertUnits).
 */
import { readFileSync, existsSync } from "node:fs";
import { paths } from "../config.js";

type Section = "special_abilities" | "actions" | "bonus_actions" | "reactions" | "legendary_actions" | "mythic_actions";
type MonsterPt = Partial<Record<Section, Record<string, string>>> & { slug?: string };

const data: Record<string, MonsterPt> =
  existsSync(paths.pocketdm) ? JSON.parse(readFileSync(paths.pocketdm, "utf8")) : {};

/** grp do pipeline -> secao do pocketdm */
const SECTION: Record<string, Section> = {
  traits: "special_abilities",
  actions: "actions",
  bonusActions: "bonus_actions",
  reactions: "reactions",
  legendaryActions: "legendary_actions",
  mythicActions: "mythic_actions",
};

/** normaliza nome de habilidade p/ casar (tira parenteticos, caixa, espacos) */
const normName = (s: string) => s.replace(/\([^)]*\)/g, "").replace(/[^a-z0-9 ]/gi, "").trim().toLowerCase();

/** assinatura mecanica: dados, CD, bonus de acerto e distancias (em pes/ft) */
function signature(text: string) {
  const dice = [...text.matchAll(/\d+d\d+/g)].map((x) => x[0]).sort();
  const dc = [...text.matchAll(/(?:DC|CD)\s*(\d+)/gi)].map((x) => x[1]).sort();
  const hit = [...text.matchAll(/(?:^|[\s(])\+(\d+)\b/g)].map((x) => x[1]).sort();
  const dist = [...text.matchAll(/(\d+)[- ]?(?:ft|feet|foot|pés|pé|pes)\b/giu)].map((x) => x[1]).sort();
  return { dice, dc, hit, dist };
}
const eq = (a: string[], b: string[]) => a.length === b.length && a.every((v, i) => v === b[i]);

/**
 * Retorna a descricao PT do pocketdm para a habilidade, ou null se nao existir
 * ou se a assinatura mecanica nao bater com `textEn` (texto 2024 do modulo).
 * Exige pelo menos um dado ou CD para aceitar (evita prosa/contagens ambiguas).
 */
export function pocketPt(monster: string, grp: string, abilityName: string, textEn: string): string | null {
  const mon = data[monster];
  const section = SECTION[grp];
  if (!mon || !section || !mon[section]) return null;
  const dict = mon[section]!;
  const want = normName(abilityName);
  const key = Object.keys(dict).find((k) => normName(k) === want);
  if (!key) return null;
  const pt = dict[key]!;

  const se = signature(textEn);
  const sp = signature(pt);
  if (se.dice.length + se.dc.length === 0) return null; // sem ancora numerica -> nao arrisca
  if (eq(se.dice, sp.dice) && eq(se.dc, sp.dc) && eq(se.hit, sp.hit) && eq(se.dist, sp.dist)) return pt;
  return null;
}

export const pocketdmLoaded = Object.keys(data).length;
