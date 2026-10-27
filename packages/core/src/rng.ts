export interface Rng {
  /** 0 이상 1 미만 */
  next(): number;
  /** min 이상 max 미만 */
  range(min: number, max: number): number;
  /** 원본을 바꾸지 않고 섞은 사본을 돌려준다 */
  shuffle<T>(items: readonly T[]): T[];
}

function hashParts(parts: readonly (string | number)[]): number {
  let h = 2166136261;
  for (const ch of parts.join("|")) {
    h ^= ch.codePointAt(0)!;
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** 부분들(매치 시드, 턴, 용도 등)에서 결정적인 난수열을 만든다(mulberry32). */
export function createRng(...parts: (string | number)[]): Rng {
  let a = hashParts(parts);
  const next = (): number => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    range: (min, max) => min + (max - min) * next(),
    shuffle: (items) => {
      const out = [...items];
      for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
      }
      return out;
    },
  };
}
