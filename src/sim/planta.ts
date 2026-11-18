/**
 * Simulación en estado estable de la planta SINÚ 9 (Tren B), en el orden real del gas:
 *
 *   Pozos → V-101 separador de entrada → TC-201/TC-202 contactoras de TEG (GRU-210 regenera)
 *        → SK-300 dew point: E-301 gas-gas → E-302 gas-agua (chiller UE-101) → V-310 separador frío
 *        → E-301 (lado frío) → gas combustible (V-601) → C-401/C-402 motocompresores + enfriador
 *        → CONDUMAX II → FT-VENTA → gasoducto a Jobo
 *
 * Hidrocarburos: ecuación de Peng-Robinson del motor del Simulador de Procesos (validado contra
 * la librería thermo y NIST). Agua y glicol: correlaciones del GPSA (ver correlaciones.ts).
 */
import { PaqueteFluidos } from '@motor/termo/paquete';
import { definicion, corrienteTP, BAR, KELVIN } from '@motor/equipos/catalogo';
import type { EstadoCorriente } from '@motor/diagrama/modelo';
import {
  aguaSaturacion,
  contactorTEG,
  fToK,
  kToF,
  mmscfdAMolS,
  molSAMmscfd,
  paToPsig,
  poderCalorifico,
  psigToPa,
  purezaTEG,
  rocioAgua,
  temperaturaHidratos,
  PSI,
} from './correlaciones';
import { evaluarRUT, type Especificacion } from './rut';

export const COMPONENTES = ['C1', 'C2', 'C3', 'iC4', 'nC4', 'iC5', 'nC5', 'nC6', 'nC7', 'nC8', 'N2', 'CO2', 'O2'] as const;
export const NOMBRES_COMP: Record<string, string> = {
  C1: 'Metano',
  C2: 'Etano',
  C3: 'Propano',
  iC4: 'i-Butano',
  nC4: 'n-Butano',
  iC5: 'i-Pentano',
  nC5: 'n-Pentano',
  nC6: 'Hexano',
  nC7: 'Heptano',
  nC8: 'Octano',
  N2: 'Nitrógeno',
  CO2: 'CO₂',
  O2: 'Oxígeno',
};

export interface Entradas {
  // 1 · Gas de entrada
  caudal: number; // MMSCFD
  presion: number; // psig
  temperatura: number; // °F
  composicion: Record<string, number>; // % molar en base seca
  aguaSaturado: boolean;
  aguaValor: number; // lb/MMscf si no está saturado
  h2s: number; // ppmv
  // 2 · Deshidratación
  torres: 0 | 1 | 2;
  tRehervidor: number; // °F
  gasDespojo: boolean;
  circulacion: number; // gal TEG / lb de agua
  // 3 · Dew point
  chiller: boolean;
  tFrio: number; // °F a la salida de E-302 (V-310)
  aproximacion: number; // °F en E-301
  // 4 · Compresión y venta
  compresores: 1 | 2;
  pDescarga: number; // psig
  eficiencia: number; // %
  tEnfriador: number; // °F
  tAmbiente: number; // °F
  combustible: number; // MMSCFD
}

export const COMPOSICION_SINU9: Record<string, number> = {
  C1: 97.0, C2: 1.0, C3: 0.3, iC4: 0.09, nC4: 0.08, iC5: 0.05, nC5: 0.04, nC6: 0.07, nC7: 0.06, nC8: 0.04, N2: 0.85, CO2: 0.42, O2: 0,
};

export function entradasPorDefecto(): Entradas {
  return {
    caudal: 10,
    presion: 470,
    temperatura: 96,
    composicion: { ...COMPOSICION_SINU9 },
    aguaSaturado: true,
    aguaValor: 60,
    h2s: 1,
    torres: 2,
    tRehervidor: 375,
    gasDespojo: true,
    circulacion: 3.5,
    chiller: true,
    tFrio: 35,
    aproximacion: 10,
    compresores: 1,
    pDescarga: 1100,
    eficiencia: 80,
    tEnfriador: 115,
    tAmbiente: 90,
    combustible: 0.3,
  };
}

export type Estado = 'ok' | 'aviso' | 'falla' | 'apagado';

export interface Dato {
  etiqueta: string;
  valor: string;
  unidad?: string;
}

export interface ResultadoEquipo {
  estado: Estado;
  titular: string;
  datos: Dato[];
}

export interface Corriente {
  id: string;
  nombre: string;
  /** clave de la corriente en el modelo 3D (color y tubería) */
  tipo3d: string;
  T: number; // °F
  P: number; // psig
  Q: number; // MMSCFD (gas) o BPD/gal/h para líquidos
  unidadQ: string;
  agua?: number; // lb/MMscf
  fase: string;
}

export interface Resultado {
  ok: true;
  ms: number;
  rut: Especificacion[];
  cumple: boolean;
  corrientes: Corriente[];
  equipos: Record<string, ResultadoEquipo>;
  claves: {
    entradaMmscfd: number;
    ventaMmscfd: number;
    combustibleMmscfd: number;
    condensadoBpd: number;
    aguaRemovidaLbDia: number;
    aguaEntrada: number;
    aguaTEG: number;
    aguaVenta: number;
    rocioAguaVentaF: number;
    rocioHcVentaF: number;
    cricondenterma: number;
    pcb: number;
    pcbMj: number;
    wobbe: number;
    potenciaHp: number;
    tDescargaF: number;
    chillerTR: number;
    tHidratosF: number;
    purezaTEG: number;
    tegGalH: number;
    cargaRehervidor: number;
    cargaTorre: number;
    cargaCompresor: number;
    pSuccion: number;
    tFrio: number;
    tE301: number;
    encogimiento: number;
    mw: number;
  };
  /** Estado de cada corriente del 3D: temperatura (°F) y flujo relativo al de diseño */
  flujo3d: Record<string, { T: number; rel: number; activo: boolean }>;
  avisos: string[];
}

export interface ResultadoError {
  ok: false;
  error: string;
}

const fmt = (v: number, d = 1) => (Number.isFinite(v) ? v.toLocaleString('es-CO', { maximumFractionDigits: d, minimumFractionDigits: d }) : '—');

let pqCache: PaqueteFluidos | null = null;
function paquete() {
  return (pqCache ??= new PaqueteFluidos([...COMPONENTES], { ecuacion: 'PR' }));
}

const dPsi = (psi: number) => (psi * PSI) / BAR; // psi → bar (para los parámetros del motor)

/** Punto de rocío de hidrocarburos a una presión, °F; null si no hay (por encima de la cricondenbara). */
function rocioHC(pq: PaqueteFluidos, z: number[], Ppa: number): number | null {
  try {
    const r = pq.flashPVF(z, Ppa, 1);
    return Number.isFinite(r.T) ? kToF(r.T) : null;
  } catch {
    return null;
  }
}

/** Cricondenterma: la mayor temperatura de rocío en cualquier presión (así se entiende el límite del RUT). */
function cricondenterma(pq: PaqueteFluidos, z: number[]): { T: number; P: number } {
  let best = { T: -400, P: 0 };
  const puntos: number[] = [];
  for (let p = 100; p <= 1500; p += 140) puntos.push(p);
  for (const p of puntos) {
    const t = rocioHC(pq, z, psigToPa(p));
    if (t !== null && t > best.T) best = { T: t, P: p };
  }
  if (best.T < -399) return best;
  // refinamiento por sección dorada alrededor del mejor punto
  let a = Math.max(20, best.P - 140);
  let b = best.P + 140;
  const g = 0.618;
  const f = (p: number) => rocioHC(pq, z, psigToPa(p)) ?? -400;
  let c = b - g * (b - a);
  let d = a + g * (b - a);
  let fc = f(c);
  let fd = f(d);
  for (let i = 0; i < 14; i++) {
    if (fc > fd) {
      b = d; d = c; fd = fc; c = b - g * (b - a); fc = f(c);
    } else {
      a = c; c = d; fc = fd; d = a + g * (b - a); fd = f(d);
    }
  }
  const pm = (a + b) / 2;
  const tm = f(pm);
  return tm > best.T ? { T: tm, P: pm } : best;
}

function partirSeparador(pq: PaqueteFluidos, s: EstadoCorriente) {
  const r = definicion('separador').calcular({ pq, entradas: { entrada: [s] }, params: { dP: 0, Q: 0 } });
  return { vapor: r.salidas.vapor, liquido: r.salidas.liquido };
}

/** Barriles por día de líquido estabilizado (flash a 60 °F y presión atmosférica). */
function barrilesEstabilizados(pq: PaqueteFluidos, liq: EstadoCorriente): number {
  if (liq.F <= 1e-9) return 0;
  const f = pq.flashPT(liq.z, fToK(60), 101325);
  const l = f.fases.find((x) => x.tipo === 'liquido');
  if (!l) return 0;
  return liq.F * l.beta * l.V * 86400 * 6.28981;
}

export function simular(e: Entradas): Resultado | ResultadoError {
  const t0 = performance.now();
  try {
    return simularInterno(e, t0);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

function simularInterno(e: Entradas, t0: number): Resultado {
  const pq = paquete();
  const avisos: string[] = [];
  const equipos: Record<string, ResultadoEquipo> = {};
  const corrientes: Corriente[] = [];
  const claves = [...COMPONENTES];

  if (!(e.caudal > 0)) throw new Error('El caudal de entrada debe ser mayor que cero');
  const suma = claves.reduce((a, k) => a + Math.max(0, e.composicion[k] ?? 0), 0);
  if (suma <= 0) throw new Error('La composición del gas está vacía');
  const z = claves.map((k) => Math.max(0, e.composicion[k] ?? 0) / suma);
  if (Math.abs(suma - 100) > 0.5) avisos.push(`La composición sumaba ${fmt(suma, 2)} %; se normalizó a 100 %.`);

  const F = mmscfdAMolS(e.caudal);
  const Pin = psigToPa(e.presion);
  const Tin = fToK(e.temperatura);
  const psia = (psig: number) => psig + 14.696;

  // ── 1 · Entrada y separador V-101 ──
  const Wsat = aguaSaturacion(e.temperatura, psia(e.presion));
  const Win = e.aguaSaturado ? Wsat : Math.min(e.aguaValor, Wsat);
  if (!e.aguaSaturado && e.aguaValor > Wsat) avisos.push(`El agua digitada (${fmt(e.aguaValor)} lb/MMscf) pasa la de saturación (${fmt(Wsat)}); el exceso cae como agua libre en V-101.`);
  const gasPozo = corrienteTP(pq, F, z, Tin, Pin);
  const P101 = Pin - 3 * PSI;
  const s101 = partirSeparador(pq, corrienteTP(pq, F, z, Tin, P101));
  const bblEntrada = barrilesEstabilizados(pq, s101.liquido);
  const gasEntrada = s101.vapor;
  const qEntrada = molSAMmscfd(gasEntrada.F);
  const mwEntrada = pq.pesoMolecular(z);
  equipos['V-101'] = {
    estado: 'ok',
    titular: bblEntrada > 0.05 ? `Separa ${fmt(bblEntrada)} BPD de condensado del gas de pozo` : 'El gas llega sin líquidos de hidrocarburo',
    datos: [
      { etiqueta: 'Presión', valor: fmt(paToPsig(P101), 0), unidad: 'psig' },
      { etiqueta: 'Temperatura', valor: fmt(e.temperatura, 0), unidad: '°F' },
      { etiqueta: 'Agua en el gas', valor: fmt(Win), unidad: 'lb/MMscf' },
      { etiqueta: 'Condensado', valor: fmt(bblEntrada), unidad: 'BPD' },
    ],
  };
  equipos['FTIQ-101'] = {
    estado: 'ok',
    titular: `Mide ${fmt(e.caudal, 2)} MMSCFD de gas de pozos`,
    datos: [
      { etiqueta: 'Caudal', valor: fmt(e.caudal, 2), unidad: 'MMSCFD' },
      { etiqueta: 'Presión', valor: fmt(e.presion, 0), unidad: 'psig' },
      { etiqueta: 'Temperatura', valor: fmt(e.temperatura, 0), unidad: '°F' },
    ],
  };
  corrientes.push({ id: 'pozo', nombre: 'Gas de pozos', tipo3d: 'humedo', T: e.temperatura, P: e.presion, Q: e.caudal, unidadQ: 'MMSCFD', agua: Win, fase: gasPozo.flash.VF >= 0.9999 ? 'Gas' : 'Gas + líquido' });

  // ── 2 · Deshidratación con TEG ──
  const Ptorre = P101 - 5 * PSI;
  const pTorrePsig = paToPsig(Ptorre);
  const pureza = purezaTEG(e.tRehervidor, e.gasDespojo);
  // Capacidad de cada torre: 8 MMSCFD a ≈470 psig (dato de operación); escala con √P por la densidad del gas
  const capTorre = 8 * Math.sqrt(psia(pTorrePsig) / psia(465));
  let Wteg = Win;
  let teg: ReturnType<typeof contactorTEG> | null = null;
  let cargaTorre = 0;
  if (e.torres > 0) {
    const qTorre = qEntrada / e.torres;
    cargaTorre = qTorre / capTorre;
    // por encima de su capacidad los platos se inundan: menos etapas efectivas y arrastre de glicol
    // 8 platos de burbujeo (plano Valerus) con ≈30 % de eficiencia ≈ 2,4 etapas teóricas
    const N0 = 8 * 0.3;
    const etapas = cargaTorre <= 1 ? N0 : Math.max(0.6, N0 / (cargaTorre * cargaTorre));
    teg = contactorTEG({ Win, Qmmscfd: qEntrada, Tf: e.temperatura, Ppsia: psia(pTorrePsig), pureza, galPorLb: e.circulacion, etapas });
    Wteg = teg.Wsalida;
    if (cargaTorre > 1) avisos.push(`Cada torre lleva ${fmt(qTorre, 1)} MMSCFD y su capacidad es ≈${fmt(capTorre, 1)}: se inunda y pierde eficiencia${e.torres === 1 ? '. Ponga la segunda torre en servicio.' : '.'}`);
    if (e.temperatura > 120) avisos.push('Gas a más de 120 °F en las contactoras: el TEG pierde capacidad y aumentan las pérdidas de glicol.');
    if (e.tRehervidor > 400) avisos.push('Rehervidor por encima de 400 °F: el TEG empieza a degradarse (≈404 °F).');
  } else {
    avisos.push('Las dos torres contactoras están fuera de servicio: el gas pasa con toda su agua.');
  }
  const estTorre = (i: number): ResultadoEquipo => {
    const activa = e.torres > i;
    if (!activa) return { estado: 'apagado', titular: 'En espera (sin flujo)', datos: [{ etiqueta: 'Estado', valor: 'Fuera de servicio' }] };
    const q = qEntrada / e.torres;
    return {
      estado: cargaTorre > 1.05 ? 'falla' : cargaTorre > 0.9 ? 'aviso' : 'ok',
      titular: `Seca ${fmt(q, 1)} MMSCFD: el agua baja de ${fmt(Win, 0)} a ${fmt(Wteg, 1)} lb/MMscf`,
      datos: [
        { etiqueta: 'Gas por la torre', valor: fmt(q, 2), unidad: 'MMSCFD' },
        { etiqueta: 'Carga', valor: fmt(cargaTorre * 100, 0), unidad: '% de capacidad' },
        { etiqueta: 'Agua a la entrada', valor: fmt(Win), unidad: 'lb/MMscf' },
        { etiqueta: 'Agua a la salida', valor: fmt(Wteg, 2), unidad: 'lb/MMscf' },
        { etiqueta: 'Presión', valor: fmt(pTorrePsig, 0), unidad: 'psig' },
      ],
    };
  };
  equipos['TC-201'] = estTorre(0);
  equipos['TC-202'] = estTorre(1);
  equipos['GRU-210'] = teg
    ? {
        estado: teg.cargaRehervidor > 300000 || e.tRehervidor > 400 ? 'aviso' : 'ok',
        titular: `Regenera ${fmt(teg.galonesHora, 0)} gal/h de TEG al ${fmt(pureza, 2)} %`,
        datos: [
          { etiqueta: 'Temperatura del rehervidor', valor: fmt(e.tRehervidor, 0), unidad: '°F' },
          { etiqueta: 'Pureza del TEG pobre', valor: fmt(pureza, 2), unidad: '% peso' },
          { etiqueta: 'Pureza del TEG rico', valor: fmt(teg.purezaRica, 2), unidad: '% peso' },
          { etiqueta: 'Circulación', valor: fmt(teg.galonesHora, 0), unidad: 'gal/h' },
          { etiqueta: 'Agua que saca del gas', valor: fmt(teg.aguaRemovidaLbDia, 0), unidad: 'lb/día' },
          { etiqueta: 'Carga del rehervidor', valor: fmt(teg.cargaRehervidor / 1000, 0), unidad: 'MBTU/h de 300' },
          { etiqueta: 'Gas de despojamiento', valor: e.gasDespojo ? 'Sí' : 'No' },
        ],
      }
    : { estado: 'apagado', titular: 'Sin circulación de glicol', datos: [{ etiqueta: 'Estado', valor: 'Detenida' }] };
  if (teg && teg.cargaRehervidor > 300000) avisos.push(`El rehervidor necesita ≈${fmt(teg.cargaRehervidor / 1000, 0)} MBTU/h y el GRU-210 (modelo 300M) da 300: baje la circulación.`);
  const gasSeco = corrienteTP(pq, gasEntrada.F, gasEntrada.z, Tin, Ptorre);
  corrientes.push({ id: 'seco', nombre: 'Gas deshidratado', tipo3d: 'seco', T: e.temperatura, P: pTorrePsig, Q: qEntrada, unidadQ: 'MMSCFD', agua: Wteg, fase: 'Gas' });
  if (teg) corrientes.push({ id: 'teg', nombre: 'TEG pobre a las torres', tipo3d: 'teg_pobre', T: 110, P: pTorrePsig, Q: teg.galonesHora, unidadQ: 'gal/h', fase: 'Líquido' });

  // ── 3 · Control de punto de rocío (SK-300) ──
  const Pe301 = Ptorre - 5 * PSI;
  const P310 = Pe301 - 5 * PSI;
  const p310 = paToPsig(P310);
  const tFrio = e.chiller ? e.tFrio : e.temperatura;
  const sg = mwEntrada / 28.9625;
  const tHidr = temperaturaHidratos(psia(p310), sg);
  const s310 = partirSeparador(pq, corrienteTP(pq, gasSeco.F, gasSeco.z, fToK(tFrio), P310));
  const vapor310 = s310.vapor;
  const bbl310 = barrilesEstabilizados(pq, s310.liquido);
  // agua: lo que pase de la saturación a la T fría cae como agua libre en V-310 (separador trifásico)
  const Wsat310 = aguaSaturacion(tFrio, psia(p310));
  const aguaLibre310 = Wteg > Wsat310;
  const Wfrio = Math.min(Wteg, Wsat310);
  const riesgoHidratos = aguaLibre310 && tFrio < tHidr + 5;
  // E-301: gas seco caliente contra el gas frío de V-310, con aproximación mínima
  let e301Q = 0;
  let tE301Caliente = e.temperatura;
  let gasResidual: EstadoCorriente = vapor310;
  let e302Q = 0;
  if (e.chiller) {
    const r = definicion('intercambiador').calcular({
      pq,
      entradas: { caliente: [corrienteTP(pq, gasSeco.F, gasSeco.z, Tin, Ptorre)], fria: [vapor310] },
      params: { T_caliente_salida: null, T_fria_salida: null, Q: null, aproximacion: e.aproximacion / 1.8, dP_caliente: dPsi(5), dP_fria: dPsi(5) },
    });
    e301Q = (r.resultado.valores.Q?.valor ?? 0) * 1000; // W
    tE301Caliente = kToF(r.salidas.caliente.T);
    gasResidual = r.salidas.fria;
    // E-302: del gas pre-enfriado hasta la temperatura fría (lo pone el chiller con agua-MEG)
    e302Q = r.salidas.caliente.F * (r.salidas.caliente.flash.H - pq.flashPT(gasSeco.z, fToK(tFrio), P310).H);
    if (e302Q < 0) e302Q = 0;
  } else {
    gasResidual = corrienteTP(pq, vapor310.F, vapor310.z, vapor310.T, vapor310.P - 5 * PSI);
  }
  const chillerTR = e302Q / 3516.85;
  const tRes = kToF(gasResidual.T);
  const pRes = paToPsig(gasResidual.P);
  const qRes = molSAMmscfd(gasResidual.F);
  const mwRes = pq.pesoMolecular(gasResidual.z);
  const crit = cricondenterma(pq, vapor310.z);

  equipos['SK-300'] = {
    estado: e.chiller ? 'ok' : 'apagado',
    titular: e.chiller ? `Enfría el gas a ${fmt(tFrio, 0)} °F para sacarle los pesados` : 'Chiller apagado: el gas pasa sin enfriarse',
    datos: [
      { etiqueta: 'Temperatura fría', valor: fmt(tFrio, 0), unidad: '°F' },
      { etiqueta: 'Condensado recuperado', valor: fmt(bbl310 + bblEntrada, 1), unidad: 'BPD' },
      { etiqueta: 'Cricondenterma del gas', valor: fmt(crit.T, 1), unidad: '°F' },
    ],
  };
  equipos['E-301'] = {
    estado: e.chiller ? 'ok' : 'apagado',
    titular: e.chiller ? `Pre-enfría el gas de ${fmt(e.temperatura, 0)} a ${fmt(tE301Caliente, 0)} °F con el gas frío que sale` : 'Sin intercambio (chiller apagado)',
    datos: [
      { etiqueta: 'Calor intercambiado', valor: fmt(e301Q / 1000, 0), unidad: 'kW' },
      { etiqueta: 'Gas caliente sale a', valor: fmt(tE301Caliente, 1), unidad: '°F' },
      { etiqueta: 'Gas frío sale a', valor: fmt(tRes, 1), unidad: '°F' },
      { etiqueta: 'Aproximación', valor: fmt(e.aproximacion, 0), unidad: '°F' },
    ],
  };
  equipos['E-302'] = {
    estado: e.chiller ? 'ok' : 'apagado',
    titular: e.chiller ? `Baja el gas a ${fmt(tFrio, 0)} °F con agua-MEG del chiller` : 'Sin enfriamiento',
    datos: [
      { etiqueta: 'Calor retirado', valor: fmt(e302Q / 1000, 0), unidad: 'kW' },
      { etiqueta: 'Gas sale a', valor: fmt(tFrio, 0), unidad: '°F' },
    ],
  };
  equipos['UE-101'] = {
    estado: e.chiller ? (tFrio < 25 ? 'aviso' : 'ok') : 'apagado',
    titular: e.chiller ? `Refrigeración de ${fmt(chillerTR, 1)} toneladas` : 'Apagado',
    datos: [
      { etiqueta: 'Carga', valor: fmt(chillerTR, 1), unidad: 'TR' },
      { etiqueta: 'Carga', valor: fmt(e302Q / 1000, 0), unidad: 'kW' },
      { etiqueta: 'Agua-MEG a E-302', valor: fmt(tFrio - 8, 0), unidad: '°F (aprox.)' },
    ],
  };
  if (e.chiller && tFrio < 25) avisos.push('Por debajo de ≈25 °F el chiller con agua-MEG trabaja al límite; revise la concentración de MEG.');
  equipos['V-310'] = {
    estado: riesgoHidratos ? 'falla' : aguaLibre310 ? 'aviso' : 'ok',
    titular: bbl310 > 0.05 ? `Recoge ${fmt(bbl310, 1)} BPD de condensado a ${fmt(tFrio, 0)} °F` : `A ${fmt(tFrio, 0)} °F casi no condensa nada`,
    datos: [
      { etiqueta: 'Temperatura', valor: fmt(tFrio, 0), unidad: '°F' },
      { etiqueta: 'Presión', valor: fmt(p310, 0), unidad: 'psig' },
      { etiqueta: 'Condensado', valor: fmt(bbl310, 2), unidad: 'BPD' },
      { etiqueta: 'Agua libre', valor: aguaLibre310 ? fmt(((Wteg - Wsat310) * qEntrada) / 24, 1) + ' lb/h' : 'No' },
      { etiqueta: 'Formación de hidratos', valor: fmt(tHidr, 0), unidad: '°F' },
    ],
  };
  if (riesgoHidratos) avisos.push(`Riesgo de hidratos en el patín frío: hay agua libre a ${fmt(tFrio, 0)} °F y los hidratos se forman bajo ≈${fmt(tHidr, 0)} °F. Revise la deshidratación.`);
  equipos['TK-1000'] = { estado: e.chiller ? 'ok' : 'apagado', titular: 'Pulmón del agua-MEG del chiller', datos: [{ etiqueta: 'Circuito', valor: e.chiller ? 'En servicio' : 'Detenido' }] };
  equipos['P-301/302'] = { estado: e.chiller ? 'ok' : 'apagado', titular: 'Mueven el agua-MEG entre el chiller y E-302', datos: [{ etiqueta: 'Estado', valor: e.chiller ? 'Una en servicio' : 'Detenidas' }] };
  const bblTotal = bbl310 + bblEntrada;
  equipos['TK-101'] = { estado: 'ok', titular: `Recibe ≈${fmt(bblTotal, 1)} BPD de condensado`, datos: [{ etiqueta: 'Condensado', valor: fmt(bblTotal, 2), unidad: 'BPD' }] };
  corrientes.push({ id: 'frio', nombre: 'Gas frío de V-310', tipo3d: 'frio', T: tFrio, P: p310, Q: molSAMmscfd(vapor310.F), unidadQ: 'MMSCFD', agua: Wfrio, fase: 'Gas' });
  corrientes.push({ id: 'cond', nombre: 'Condensado a TK-101', tipo3d: 'cond', T: tFrio, P: 50, Q: bblTotal, unidadQ: 'BPD', fase: 'Líquido' });

  // ── 4 · Gas combustible ──
  if (e.combustible >= qRes) throw new Error('El gas combustible no puede ser mayor que el gas tratado');
  const fComb = Math.max(0, e.combustible) / qRes;
  const Fventa = gasResidual.F * (1 - fComb);
  equipos['FT-COMB + PCV'] = {
    estado: 'ok',
    titular: `Entrega ${fmt(e.combustible, 2)} MMSCFD de gas combustible a 45–60 psig`,
    datos: [
      { etiqueta: 'Caudal', valor: fmt(e.combustible, 3), unidad: 'MMSCFD' },
      { etiqueta: 'Presión regulada', valor: '45–60', unidad: 'psig' },
    ],
  };
  equipos['V-601'] = { estado: 'ok', titular: 'Depura el gas combustible antes de los motores', datos: [{ etiqueta: 'Caudal', valor: fmt(e.combustible, 3), unidad: 'MMSCFD' }] };
  equipos['G-101'] = { estado: 'ok', titular: 'Genera la energía de la planta con gas', datos: [{ etiqueta: 'Combustible', valor: 'Gas de V-601' }] };
  corrientes.push({ id: 'comb', nombre: 'Gas combustible', tipo3d: 'comb', T: tRes, P: 55, Q: e.combustible, unidadQ: 'MMSCFD', fase: 'Gas' });

  // ── 5 · Compresión C-401/C-402 y enfriador ──
  const succion = corrienteTP(pq, Fventa, gasResidual.z, gasResidual.T, gasResidual.P);
  const pSuc = paToPsig(succion.P);
  if (e.pDescarga <= pSuc) throw new Error(`La presión de descarga (${fmt(e.pDescarga, 0)} psig) debe ser mayor que la de succión (${fmt(pSuc, 0)} psig)`);
  const rc = definicion('compresor').calcular({
    pq,
    entradas: { entrada: [succion] },
    params: { P_salida: psigToPa(e.pDescarga) / BAR, dP: null, eficiencia: e.eficiencia },
  });
  const desc = rc.salidas.salida;
  const hp = rc.resultado.valores.hp?.valor ?? 0;
  const tDesc = kToF(desc.T);
  const qVenta = molSAMmscfd(Fventa);
  // Capacidad: 15 MMSCFD por unidad a 1200 psig con 500 psig de succión (instructivo C-401/C-402); escala con la succión
  const capComp = 15 * (psia(pSuc) / psia(500)) * e.compresores;
  const cargaComp = qVenta / capComp;
  if (e.pDescarga > 1200) avisos.push('La presión de descarga pasa de 1200 psig, el límite de los motocompresores.');
  if (cargaComp > 1) avisos.push(`Los compresores en servicio mueven hasta ≈${fmt(capComp, 1)} MMSCFD con esta succión y llegan ${fmt(qVenta, 1)}: el exceso tendría que ir a tea o a reciclo.`);
  const tEnf = Math.max(e.tEnfriador, e.tAmbiente + 10);
  if (e.tEnfriador < e.tAmbiente + 10) avisos.push(`El enfriador del compresor (aire) no baja de ≈${fmt(e.tAmbiente + 10, 0)} °F con ${fmt(e.tAmbiente, 0)} °F de ambiente; se usó ese valor.`);
  const re = definicion('enfriador').calcular({ pq, entradas: { entrada: [desc] }, params: { T_salida: fToK(tEnf) - KELVIN, Q: null, dP: dPsi(10) } });
  const venta = re.salidas.salida;
  const pVenta = paToPsig(venta.P);
  const unidades = e.compresores === 2 ? 'C-401 y C-402' : 'C-401';
  equipos['C-401'] = {
    estado: cargaComp > 1 || e.pDescarga > 1200 || tDesc > 300 ? 'falla' : cargaComp > 0.9 ? 'aviso' : 'ok',
    titular: `${unidades}: de ${fmt(pSuc, 0)} a ${fmt(e.pDescarga, 0)} psig con ${fmt(hp, 0)} hp`,
    datos: [
      { etiqueta: 'Succión', valor: fmt(pSuc, 0), unidad: 'psig' },
      { etiqueta: 'Descarga', valor: fmt(e.pDescarga, 0), unidad: 'psig' },
      { etiqueta: 'Relación de compresión', valor: fmt(psia(e.pDescarga) / psia(pSuc), 2) },
      { etiqueta: 'Temperatura de descarga', valor: fmt(tDesc, 0), unidad: '°F' },
      { etiqueta: 'Potencia de gas', valor: fmt(hp, 0), unidad: e.compresores === 2 ? `hp (${fmt(hp / 2, 0)} c/u)` : 'hp' },
      { etiqueta: 'Carga', valor: fmt(cargaComp * 100, 0), unidad: '% de capacidad' },
      { etiqueta: 'Sale del enfriador a', valor: fmt(tEnf, 0), unidad: '°F' },
    ],
  };
  corrientes.push({ id: 'venta', nombre: 'Gas a venta', tipo3d: 'venta', T: tEnf, P: pVenta, Q: qVenta, unidadQ: 'MMSCFD', agua: Wfrio, fase: venta.flash.VF >= 0.9999 ? 'Gas' : 'Gas + líquido' });

  // ── 6 · Calidad del gas de venta ──
  const zv = venta.z;
  const mwVenta = pq.pesoMolecular(zv);
  const hv = poderCalorifico(claves, zv, mwVenta);
  const rocioVentaP = rocioHC(pq, zv, venta.P);
  const Wventa = Wfrio;
  const rocioAguaVenta = rocioAgua(Wventa, psia(pVenta));
  const WsatVenta = aguaSaturacion(tEnf, psia(pVenta));
  const liquidosLibres = venta.flash.VF < 0.9999 || Wventa > WsatVenta;
  const iN2 = claves.indexOf('N2');
  const iCO2 = claves.indexOf('CO2');
  const iO2 = claves.indexOf('O2');
  const rut = evaluarRUT({
    pcb: hv.btuScf,
    rocioHC: crit.T,
    agua: Wventa,
    co2: zv[iCO2] * 100,
    n2: zv[iN2] * 100,
    o2: zv[iO2] * 100,
    h2s: (e.h2s * 34.08) / 23.69,
    azufre: (e.h2s * 32.06) / 23.69,
    temperatura: tEnf,
    liquidosLibres,
  });
  const cumple = rut.every((r) => r.cumple);
  const fallas = rut.filter((r) => !r.cumple);

  equipos['CONDUMAX'] = {
    estado: rut.find((r) => r.id === 'rocio')!.cumple && rut.find((r) => r.id === 'agua')!.cumple ? 'ok' : 'falla',
    titular: `Rocío de HC ${fmt(crit.T, 0)} °F · agua ${fmt(Wventa, 1)} lb/MMscf`,
    datos: [
      { etiqueta: 'Rocío de hidrocarburos (cricondenterma)', valor: fmt(crit.T, 1), unidad: '°F' },
      { etiqueta: 'Rocío de HC a presión de venta', valor: rocioVentaP === null ? 'No hay' : fmt(rocioVentaP, 1), unidad: rocioVentaP === null ? '' : '°F' },
      { etiqueta: 'Agua', valor: fmt(Wventa, 2), unidad: 'lb/MMscf' },
      { etiqueta: 'Rocío de agua', valor: fmt(rocioAguaVenta, 0), unidad: '°F' },
    ],
  };
  equipos['FT-VENTA'] = {
    estado: cumple ? 'ok' : 'falla',
    titular: cumple ? `Entrega ${fmt(qVenta, 2)} MMSCFD en especificación RUT` : `${fmt(qVenta, 2)} MMSCFD fuera de especificación (${fallas.map((f) => f.corto).join(', ')})`,
    datos: [
      { etiqueta: 'Caudal de venta', valor: fmt(qVenta, 3), unidad: 'MMSCFD' },
      { etiqueta: 'Presión', valor: fmt(pVenta, 0), unidad: 'psig' },
      { etiqueta: 'Temperatura', valor: fmt(tEnf, 0), unidad: '°F' },
      { etiqueta: 'Poder calorífico', valor: fmt(hv.btuScf, 0), unidad: 'BTU/pie³' },
      { etiqueta: 'Energía entregada', valor: fmt(qVenta * hv.btuScf, 0), unidad: 'MMBTU/día' },
    ],
  };

  const pesoRel = (q: number) => q / 10;
  const flujo3d: Resultado['flujo3d'] = {
    humedo: { T: e.temperatura, rel: pesoRel(e.caudal), activo: true },
    seco: { T: e.temperatura, rel: pesoRel(qEntrada), activo: true },
    frio: { T: e.chiller ? (tFrio + tRes) / 2 : e.temperatura, rel: pesoRel(qRes), activo: true },
    venta: { T: tEnf, rel: pesoRel(qVenta), activo: true },
    comb: { T: tRes, rel: e.combustible / 0.3, activo: e.combustible > 0 },
    teg_pobre: { T: 200, rel: teg ? teg.galonesHora / 95 : 0, activo: !!teg },
    teg_rico: { T: 110, rel: teg ? teg.galonesHora / 95 : 0, activo: !!teg },
    agua: { T: tFrio - 8, rel: e.chiller ? 1 : 0, activo: e.chiller },
    cond: { T: 80, rel: Math.min(2, bblTotal / 2 + 0.2), activo: bblTotal > 0.01 },
    tea: { T: 90, rel: 0.3, activo: true },
    aire: { T: 90, rel: 0.5, activo: true },
  };

  return {
    ok: true,
    ms: performance.now() - t0,
    rut,
    cumple,
    corrientes,
    equipos,
    claves: {
      entradaMmscfd: e.caudal,
      ventaMmscfd: qVenta,
      combustibleMmscfd: e.combustible,
      condensadoBpd: bblTotal,
      aguaRemovidaLbDia: ((Win - Wventa) * qEntrada),
      aguaEntrada: Win,
      aguaTEG: Wteg,
      aguaVenta: Wventa,
      rocioAguaVentaF: rocioAguaVenta,
      rocioHcVentaF: rocioVentaP ?? NaN,
      cricondenterma: crit.T,
      pcb: hv.btuScf,
      pcbMj: hv.mjM3,
      wobbe: hv.wobbe,
      potenciaHp: hp,
      tDescargaF: tDesc,
      chillerTR,
      tHidratosF: tHidr,
      purezaTEG: pureza,
      tegGalH: teg?.galonesHora ?? 0,
      cargaRehervidor: teg?.cargaRehervidor ?? 0,
      cargaTorre,
      cargaCompresor: cargaComp,
      pSuccion: pSuc,
      tFrio,
      tE301: tE301Caliente,
      encogimiento: (1 - (qRes / e.caudal)) * 100,
      mw: mwRes,
    },
    flujo3d,
    avisos,
  };
}
