/** PRNG determinístico (mulberry32) e amostradores. Núcleo puro, sem DOM. */
export class Rng {
  private s: number;
  private z2: number | null = null;

  constructor(seed: number) {
    this.s = seed >>> 0;
  }

  /** Uniforme em [0, 1). */
  uniforme(): number {
    this.s = (this.s + 0x6d2b79f5) >>> 0;
    let t = this.s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Normal padrão (Box-Muller, aproveitando o par). */
  normal(): number {
    if (this.z2 !== null) {
      const z = this.z2;
      this.z2 = null;
      return z;
    }
    let u = this.uniforme();
    while (u <= 1e-300) u = this.uniforme();
    const v = this.uniforme();
    const r = Math.sqrt(-2 * Math.log(u));
    this.z2 = r * Math.sin(2 * Math.PI * v);
    return r * Math.cos(2 * Math.PI * v);
  }

  /** Lognormal com parâmetros (mu, sigma) do log. */
  lognormal(mu: number, sigma: number): number {
    return Math.exp(mu + sigma * this.normal());
  }

  /** Poisson: Knuth para λ < 30; aproximação normal (arredondada, ≥ 0) acima disso. */
  poisson(lam: number): number {
    if (lam <= 0) return 0;
    if (lam < 30) {
      const L = Math.exp(-lam);
      let k = 0;
      let p = 1;
      do {
        k++;
        p *= this.uniforme();
      } while (p > L);
      return k - 1;
    }
    return Math.max(0, Math.round(lam + Math.sqrt(lam) * this.normal()));
  }
}
