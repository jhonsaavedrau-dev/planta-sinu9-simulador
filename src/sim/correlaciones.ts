/**
 * Correlaciones de ingeniería de gas que el motor de ecuación de estado no cubre bien.
 * Cada una dice de dónde sale. Son las mismas que se usan a mano con el GPSA Engineering Data Book.
 */

// ───────────────────────── Unidades ─────────────────────────
export const PSI = 6894.757; // Pa
export const PATM_PSI = 14.696;
export const fToK = (f: number) => (f - 32) / 1.8 + 273.15;
export const kToF = (k: number) => (k - 273.15) * 1.8 + 32;
export const psigToPa = (psig: number) => (psig + PATM_PSI) * PSI;
export const paToPsig = (pa: number) => pa / PSI - PATM_PSI;
/** pie³ estándar por mol (60 °F, 14,696 psia, gas ideal) */
export const SCF_POR_MOL = (8.314462618 * 288.7056) / 101325 / 0.028316846592;
export const mmscfdAMolS = (q: number) => (q * 1e6) / SCF_POR_MOL / 86400;
export const molSAMmscfd = (f: number) => (f * 86400 * SCF_POR_MOL) / 1e6;
/** lb de agua por MMscf ↔ fracción molar (379,5 scf/lbmol a 60 °F) */
export const LB_MMSCF_POR_Y = (18.015 * 1e6) / 379.49;

// ───────────────────────── Agua ─────────────────────────

/** Presión de saturación del agua líquida (Wagner y Pruss, 1993), Pa. Se extrapola algo bajo 0 °C (agua subenfriada). */
export function presionVaporAgua(T: number): number {
  const Tc = 647.096;
  const pc = 22.064e6;
  const t = 1 - T / Tc;
  const a = [-7.85951783, 1.84408259, -11.7866497, 22.6807411, -15.9618719, 1.80122502];
  const s = a[0] * t + a[1] * t ** 1.5 + a[2] * t ** 3 + a[3] * t ** 3.5 + a[4] * t ** 4 + a[5] * t ** 7.5;
  return pc * Math.exp((Tc / T) * s);
}

/**
 * Contenido de agua de saturación del gas natural dulce, lb/MMscf (Bukacek, 1955).
 * Reproduce la carta de McKetta-Wehe del GPSA (fig. 20-4) dentro de ±5 % en gas de planta.
 */
export function aguaSaturacion(Tf: number, Ppsia: number): number {
  const pv = presionVaporAgua(fToK(Tf)) / PSI;
  const B = 10 ** (-3083.87 / (459.6 + Tf) + 6.69449);
  return (47484 * pv) / Ppsia + B;
}

/** Punto de rocío de agua (°F) del gas con W lb/MMscf a la presión dada. Bajo 32 °F es rocío de agua subenfriada. */
export function rocioAgua(W: number, Ppsia: number): number {
  if (!(W > 0)) return -100;
  let lo = -80;
  let hi = 350;
  for (let i = 0; i < 60; i++) {
    const m = (lo + hi) / 2;
    if (aguaSaturacion(m, Ppsia) > W) hi = m;
    else lo = m;
  }
  return (lo + hi) / 2;
}

// ───────────────────────── Glicol (TEG) ─────────────────────────

/**
 * Pureza del TEG pobre (% en peso) según la temperatura del rehervidor a presión atmosférica,
 * leída de la fig. 20-59 del GPSA. Con gas de despojamiento la pureza sube hacia 99,5–99,9 %.
 */
export function purezaTEG(TrebF: number, gasDespojo: boolean): number {
  const tabla: [number, number][] = [
    [300, 96.0],
    [325, 97.2],
    [350, 98.1],
    [375, 98.7],
    [400, 99.1],
    [410, 99.2],
  ];
  let w: number;
  if (TrebF <= tabla[0][0]) w = tabla[0][1];
  else if (TrebF >= tabla[tabla.length - 1][0]) w = tabla[tabla.length - 1][1];
  else {
    let i = 0;
    while (tabla[i + 1][0] < TrebF) i++;
    const [t0, w0] = tabla[i];
    const [t1, w1] = tabla[i + 1];
    w = w0 + ((w1 - w0) * (TrebF - t0)) / (t1 - t0);
  }
  if (gasDespojo) w = w + (99.85 - w) * 0.6;
  return w;
}

/**
 * Coeficiente de actividad del agua en TEG del lado pobre. Calibrado para que el modelo reproduzca
 * la carta de punto de rocío de equilibrio agua-TEG del GPSA (fig. 20-68): TEG al 99,0 % a 100 °F → ≈18 °F.
 */
export const GAMMA_AGUA_TEG = 0.76;

export interface ResultadoTEG {
  Wsalida: number;
  Wequilibrio: number;
  purezaPobre: number;
  xAguaPobre: number;
  galonesHora: number;
  absorcion: number;
  etapas: number;
  aguaRemovidaLbDia: number;
  cargaRehervidor: number; // BTU/h
  purezaRica: number;
}

/**
 * Contactor de TEG con la ecuación de Kremser (GPSA, cap. 20): etapas teóricas, factor de absorción
 * A = L/(K·V) y equilibrio y* = γ·x·y_sat. 8 platos de burbujeo ≈ 2 etapas teóricas (eficiencia 25 %).
 */
export function contactorTEG(p: {
  Win: number;
  Qmmscfd: number;
  Tf: number;
  Ppsia: number;
  pureza: number;
  galPorLb: number;
  etapas: number;
}): ResultadoTEG {
  const wAgua = 100 - p.pureza;
  const aguaLbH = (p.Win * p.Qmmscfd) / 24;
  const galH = p.galPorLb * aguaLbH;
  const masa = galH * 9.33; // lb/h de solución (densidad del TEG ≈ 1,12)
  const molTEG = (masa * (p.pureza / 100)) / 150.17;
  const molAgua = (masa * (wAgua / 100)) / 18.015;
  const L = molTEG + molAgua;
  const x = L > 0 ? molAgua / L : 0;
  const V = (p.Qmmscfd * 1e6) / 379.49 / 24; // lbmol/h de gas
  const ySat = aguaSaturacion(p.Tf, p.Ppsia) / LB_MMSCF_POR_Y;
  const K = GAMMA_AGUA_TEG * ySat;
  const yIn = p.Win / LB_MMSCF_POR_Y;
  const yEq = K * x;
  const A = V > 0 && L > 0 ? L / (K * V) : 0;
  const N = p.etapas;
  let frac: number;
  if (A <= 0) frac = 0;
  else if (Math.abs(A - 1) < 1e-6) frac = N / (N + 1);
  else frac = (A ** (N + 1) - A) / (A ** (N + 1) - 1);
  const yOut = Math.max(yEq, yIn - frac * Math.max(0, yIn - yEq));
  const Wsalida = yOut * LB_MMSCF_POR_Y;
  const removidaLbH = ((p.Win - Wsalida) * p.Qmmscfd) / 24;
  // Glicol rico: el agua absorbida diluye el TEG
  const masaAguaRica = masa * (wAgua / 100) + removidaLbH;
  const purezaRica = masa > 0 ? (100 * masa * (p.pureza / 100)) / (masa + removidaLbH) : 0;
  void masaAguaRica;
  return {
    Wsalida,
    Wequilibrio: yEq * LB_MMSCF_POR_Y,
    purezaPobre: p.pureza,
    xAguaPobre: x,
    galonesHora: galH,
    absorcion: A,
    etapas: N,
    aguaRemovidaLbDia: removidaLbH * 24,
    // Regla de diseño del GPSA para el rehervidor: ≈ 2000 BTU por galón de TEG circulado (sensible + agua + reflujo)
    cargaRehervidor: galH * 2000,
    purezaRica,
  };
}

// ───────────────────────── Hidratos ─────────────────────────

/** Temperatura de formación de hidratos (°F) para gas dulce (Motiee, 1991), con P en psia y gravedad específica γ. */
export function temperaturaHidratos(Ppsia: number, sg: number): number {
  const l = Math.log10(Ppsia);
  return -238.24469 + 78.99667 * l - 5.352544 * l * l + 349.473877 * sg - 150.854675 * sg * sg - 27.604065 * sg * l;
}

// ───────────────────────── Poder calorífico ─────────────────────────

/** Poder calorífico bruto ideal, BTU/scf a 60 °F y 14,696 psia (GPA 2145), y factor de suma b (GPA 2172). */
export const PCB: Record<string, { hv: number; b: number }> = {
  C1: { hv: 1010.0, b: 0.0116 },
  C2: { hv: 1769.7, b: 0.0239 },
  C3: { hv: 2516.1, b: 0.0344 },
  iC4: { hv: 3251.9, b: 0.0458 },
  nC4: { hv: 3262.3, b: 0.0478 },
  iC5: { hv: 4000.9, b: 0.0581 },
  nC5: { hv: 4008.9, b: 0.0631 },
  nC6: { hv: 4755.9, b: 0.0802 },
  nC7: { hv: 5502.5, b: 0.0944 },
  nC8: { hv: 6248.9, b: 0.1137 },
  N2: { hv: 0, b: 0.0044 },
  CO2: { hv: 0, b: 0.0197 },
  O2: { hv: 0, b: 0.0073 },
};

export function poderCalorifico(claves: string[], y: number[], MW: number) {
  let hv = 0;
  let sb = 0;
  claves.forEach((k, i) => {
    const d = PCB[k];
    if (!d) return;
    hv += y[i] * d.hv;
    sb += y[i] * d.b;
  });
  const Z = 1 - sb * sb;
  const real = hv / Z;
  const sg = MW / 28.9625;
  return { btuScf: real, mjM3: real * 0.0372589, Z, sg, wobbe: real / Math.sqrt(sg) };
}
