import { describe, expect, test } from 'vitest';
import { simular, entradasPorDefecto, type Entradas, type Resultado } from '../src/sim/planta';
import { aguaSaturacion, rocioAgua, contactorTEG, purezaTEG, temperaturaHidratos, poderCalorifico } from '../src/sim/correlaciones';

const correr = (c: Partial<Entradas> = {}) => {
  const r = simular({ ...entradasPorDefecto(), ...c });
  if (!r.ok) throw new Error(r.error);
  return r as Resultado;
};

describe('Correlaciones contra el GPSA', () => {
  test('agua de saturación (McKetta-Wehe): 100 °F y 1000 psia ≈ 60 lb/MMscf', () => {
    expect(aguaSaturacion(100, 1014.7)).toBeGreaterThan(55);
    expect(aguaSaturacion(100, 1014.7)).toBeLessThan(66);
  });
  test('agua de saturación: 60 °F y 1000 psia ≈ 17 lb/MMscf', () => {
    expect(aguaSaturacion(60, 1014.7)).toBeGreaterThan(15.5);
    expect(aguaSaturacion(60, 1014.7)).toBeLessThan(19);
  });
  test('rocío de agua es la inversa del contenido de agua', () => {
    const W = aguaSaturacion(40, 500);
    expect(rocioAgua(W, 500)).toBeCloseTo(40, 1);
  });
  test('TEG al 99 % a 100 °F: rocío de equilibrio ≈ 18 °F (fig. 20-68)', () => {
    const r = contactorTEG({ Win: 100, Qmmscfd: 10, Tf: 100, Ppsia: 500, pureza: 99, galPorLb: 3, etapas: 2 });
    const dew = rocioAgua(r.Wequilibrio, 500);
    expect(dew).toBeGreaterThan(13);
    expect(dew).toBeLessThan(23);
  });
  test('Kremser: más circulación y más etapas secan más', () => {
    const base = { Win: 90, Qmmscfd: 10, Tf: 96, Ppsia: 480, pureza: 99, galPorLb: 3, etapas: 2 };
    expect(contactorTEG({ ...base, galPorLb: 5 }).Wsalida).toBeLessThan(contactorTEG(base).Wsalida);
    expect(contactorTEG({ ...base, etapas: 3 }).Wsalida).toBeLessThan(contactorTEG(base).Wsalida);
  });
  test('pureza del TEG sube con la temperatura del rehervidor y con gas de despojo', () => {
    expect(purezaTEG(375, false)).toBeCloseTo(98.7, 1);
    expect(purezaTEG(400, false)).toBeGreaterThan(purezaTEG(350, false));
    expect(purezaTEG(375, true)).toBeGreaterThan(99.2);
  });
  test('hidratos de gas pobre a 500 psia: entre 40 y 55 °F', () => {
    const t = temperaturaHidratos(500, 0.58);
    expect(t).toBeGreaterThan(40);
    expect(t).toBeLessThan(55);
  });
  test('metano puro: poder calorífico real ≈ 1012 BTU/pie³', () => {
    const r = poderCalorifico(['C1'], [1], 16.043);
    expect(r.btuScf).toBeGreaterThan(1010);
    expect(r.btuScf).toBeLessThan(1014);
  });
});

describe('Planta SINÚ 9', () => {
  const normal = correr();

  test('en operación normal el gas cumple el RUT', () => {
    expect(normal.rut.filter((x) => !x.cumple).map((x) => x.id)).toEqual([]);
  });
  test('balance de gas: entra = venta + combustible + lo que se condensa (encogimiento < 1 %)', () => {
    const k = normal.claves;
    const cierre = k.entradaMmscfd - k.ventaMmscfd - k.combustibleMmscfd;
    expect(cierre).toBeGreaterThanOrEqual(0);
    expect(cierre / k.entradaMmscfd).toBeLessThan(0.01);
  });
  test('sin chiller el rocío de hidrocarburos se pasa de 45 °F', () => {
    const r = correr({ chiller: false });
    expect(r.rut.find((x) => x.id === 'rocio')!.cumple).toBe(false);
    expect(r.claves.condensadoBpd).toBeLessThan(normal.claves.condensadoBpd);
  });
  test('más frío en V-310 → más condensado y menor rocío', () => {
    const a = correr({ tFrio: 40 });
    const b = correr({ tFrio: 25 });
    expect(b.claves.condensadoBpd).toBeGreaterThan(a.claves.condensadoBpd);
    expect(b.claves.cricondenterma).toBeLessThan(a.claves.cricondenterma);
  });
  test('sin torres de TEG el agua no cumple y hay riesgo de hidratos en el patín frío', () => {
    const r = correr({ torres: 0 });
    expect(r.rut.find((x) => x.id === 'agua')!.cumple).toBe(false);
    expect(r.equipos['V-310'].estado).toBe('falla');
  });
  test('una sola torre con 10 MMSCFD se sobrecarga', () => {
    const r = correr({ torres: 1 });
    expect(r.claves.cargaTorre).toBeGreaterThan(1);
    expect(r.equipos['TC-201'].estado).toBe('falla');
    expect(r.equipos['TC-202'].estado).toBe('apagado');
  });
  test('compresor: más presión de descarga pide más potencia y calienta más', () => {
    const a = correr({ pDescarga: 900 });
    const b = correr({ pDescarga: 1200 });
    expect(b.claves.potenciaHp).toBeGreaterThan(a.claves.potenciaHp);
    expect(b.claves.tDescargaF).toBeGreaterThan(a.claves.tDescargaF);
  });
  test('14 MMSCFD con un compresor lo sobrecarga; con dos no', () => {
    expect(correr({ caudal: 14 }).equipos['C-401'].estado).toBe('falla');
    expect(correr({ caudal: 14, compresores: 2 }).equipos['C-401'].estado).not.toBe('falla');
  });
  test('gas con mucho CO₂ y N₂ incumple inertes', () => {
    const r = correr({ composicion: { C1: 93, C2: 1, C3: 0.3, iC4: 0.09, nC4: 0.08, iC5: 0.05, nC5: 0.04, nC6: 0.07, nC7: 0.06, nC8: 0.04, N2: 3.5, CO2: 2.77, O2: 0 } });
    const fallan = r.rut.filter((x) => !x.cumple).map((x) => x.id);
    expect(fallan).toContain('co2');
    expect(fallan).toContain('n2');
  });
  test('errores claros con datos imposibles', () => {
    expect(simular({ ...entradasPorDefecto(), pDescarga: 300 }).ok).toBe(false);
    expect(simular({ ...entradasPorDefecto(), combustible: 50 }).ok).toBe(false);
  });
});
