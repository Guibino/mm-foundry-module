/** Logger minimalista com níveis e prefixo de etapa. */
const COLORS = { gray: "\x1b[90m", red: "\x1b[31m", yellow: "\x1b[33m", green: "\x1b[32m", cyan: "\x1b[36m", reset: "\x1b[0m" };

export function makeLogger(stage: string) {
  const p = `${COLORS.cyan}[${stage}]${COLORS.reset}`;
  return {
    info: (...a: unknown[]) => console.log(p, ...a),
    ok: (...a: unknown[]) => console.log(p, COLORS.green + "✓" + COLORS.reset, ...a),
    warn: (...a: unknown[]) => console.warn(p, COLORS.yellow + "⚠" + COLORS.reset, ...a),
    error: (...a: unknown[]) => console.error(p, COLORS.red + "✗" + COLORS.reset, ...a),
    debug: (...a: unknown[]) => { if (process.env.DEBUG) console.log(p, COLORS.gray + "·" + COLORS.reset, ...a); },
  };
}
