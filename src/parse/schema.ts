/**
 * Schema do JSON intermediário (uma estrutura por monstro), independente do
 * schema do Foundry. Validado com Zod. É a "fonte de verdade" neutra entre o
 * parser e o normalizador dnd5e.
 */
import { z } from "zod";

export const NamedText = z.object({
  name: z.string(),
  text: z.string(),
  /** usos limitados detectados no nome, ex.: "(3/Day)" ou "(Recharge 5-6)" */
  uses: z.string().optional(),
  recharge: z.string().optional(),
});
export type NamedText = z.infer<typeof NamedText>;

export const AbilityBlock = z.object({
  score: z.number(),
  mod: z.number(),
  save: z.number(),
});

export const SpellGroup = z.object({
  /** "At Will", "1/Day Each", "2/Day Each", "Cantrips", "1st Level (4 Slots)"... */
  freq: z.string(),
  spells: z.array(z.string()),
});

export const Spellcasting = z.object({
  intro: z.string(),
  ability: z.enum(["int", "wis", "cha"]).optional(),
  saveDc: z.number().optional(),
  attack: z.number().optional(),
  groups: z.array(SpellGroup),
});

export const Monster = z.object({
  name: z.string(),
  size: z.string(),
  type: z.string(),
  subtypes: z.array(z.string()).default([]),
  alignment: z.string(),
  ac: z.object({ value: z.number(), note: z.string().optional() }),
  initiative: z.number().optional(),
  hp: z.object({ value: z.number(), formula: z.string() }),
  speeds: z.record(z.string(), z.number()).default({}),
  hover: z.boolean().default(false),
  abilities: z.object({
    str: AbilityBlock, dex: AbilityBlock, con: AbilityBlock,
    int: AbilityBlock, wis: AbilityBlock, cha: AbilityBlock,
  }),
  skills: z.array(z.object({ name: z.string(), mod: z.number() })).default([]),
  vulnerabilities: z.array(z.string()).default([]),
  resistances: z.array(z.string()).default([]),
  damageImmunities: z.array(z.string()).default([]),
  conditionImmunities: z.array(z.string()).default([]),
  gear: z.array(z.string()).default([]),
  senses: z.object({
    darkvision: z.number().optional(),
    blindsight: z.number().optional(),
    tremorsense: z.number().optional(),
    truesight: z.number().optional(),
    passivePerception: z.number().optional(),
  }).default({}),
  languages: z.array(z.string()).default([]),
  telepathy: z.number().optional(),
  cr: z.string(),
  xp: z.number().optional(),
  pb: z.number().optional(),
  habitat: z.string().optional(),
  treasure: z.string().optional(),
  description: z.string().optional(),
  traits: z.array(NamedText).default([]),
  actions: z.array(NamedText).default([]),
  bonusActions: z.array(NamedText).default([]),
  reactions: z.array(NamedText).default([]),
  legendaryIntro: z.string().optional(),
  legendaryActions: z.array(NamedText).default([]),
  mythicIntro: z.string().optional(),
  mythicActions: z.array(NamedText).default([]),
  lairActions: z.array(NamedText).default([]),
  regionalEffects: z.array(NamedText).default([]),
  spellcasting: Spellcasting.optional(),
  /** metadados de qualidade preenchidos pelo parser */
  page: z.number().optional(),
  warnings: z.array(z.string()).default([]),
});
export type Monster = z.infer<typeof Monster>;
