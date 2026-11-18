/**
 * Explicaciones en lenguaje de planta, armadas con los números de la simulación.
 * Cada etapa dice qué pasa, con qué equipos, y qué mover si algo no cumple.
 */
import type { Entradas, Resultado, Estado } from '../sim/planta';
import { LIMITES } from '../sim/rut';

export interface Etapa {
  id: string;
  titulo: string;
  corto: string;
  equipos: string[];
  /** equipo que se encuadra al abrir la etapa */
  foco: string[];
  seccion: string;
}

export const ETAPAS: Etapa[] = [
  { id: 'entrada', titulo: 'Llegada y separación', corto: 'Entrada', equipos: ['FTIQ-101', 'V-101'], foco: ['V-101', 'FTIQ-101'], seccion: 'entrada' },
  { id: 'deshidratacion', titulo: 'Deshidratación con glicol', corto: 'Deshidratación', equipos: ['TC-201', 'TC-202', 'GRU-210'], foco: ['TC-201', 'TC-202', 'GRU-210'], seccion: 'deshidratacion' },
  { id: 'dewpoint', titulo: 'Control de punto de rocío', corto: 'Punto de rocío', equipos: ['SK-300', 'E-301', 'E-302', 'UE-101', 'V-310'], foco: ['SK-300', 'UE-101'], seccion: 'dewpoint' },
  { id: 'compresion', titulo: 'Compresión', corto: 'Compresión', equipos: ['V-601', 'C-401'], foco: ['C-401', 'V-601'], seccion: 'compresion' },
  { id: 'venta', titulo: 'Medición y venta', corto: 'Venta', equipos: ['CONDUMAX', 'FT-VENTA'], foco: ['CONDUMAX', 'FT-VENTA'], seccion: 'compresion' },
];

export const f = (v: number, d = 1) => (Number.isFinite(v) ? v.toLocaleString('es-CO', { maximumFractionDigits: d, minimumFractionDigits: d }) : '—');
const b = (s: string) => `<b>${s}</b>`;

export function estadoEtapa(r: Resultado, et: Etapa): Estado {
  const est = et.equipos.map((t) => r.equipos[t]?.estado).filter(Boolean) as Estado[];
  if (et.id === 'venta') return r.cumple ? 'ok' : 'falla';
  const spec = (id: string) => r.rut.find((x) => x.id === id)?.cumple ?? true;
  if (et.id === 'deshidratacion' && !spec('agua')) return 'falla';
  if (et.id === 'dewpoint' && !spec('rocio')) return 'falla';
  if (et.id === 'compresion' && !spec('temperatura')) return 'falla';
  if (est.includes('falla')) return 'falla';
  if (est.includes('aviso')) return 'aviso';
  if (est.length && est.every((x) => x === 'apagado')) return 'apagado';
  return 'ok';
}

export function cifraEtapa(r: Resultado, et: Etapa, e: Entradas): string {
  const k = r.claves;
  switch (et.id) {
    case 'entrada': return `${f(e.caudal)} MMSCFD`;
    case 'deshidratacion': return e.torres ? `${f(k.aguaTEG)} lb agua` : 'Sin TEG';
    case 'dewpoint': return e.chiller ? `${f(k.tFrio, 0)} °F` : 'Chiller apagado';
    case 'compresion': return `${f(e.pDescarga, 0)} psig`;
    default: return `${f(k.ventaMmscfd, 2)} MMSCFD`;
  }
}

export interface Explicacion {
  html: string;
  /** sugerencias para corregir lo que no cumple, con el control al que llevan */
  sugerencias: { texto: string; control: string }[];
}

export function explicar(r: Resultado, et: Etapa, e: Entradas): Explicacion {
  const k = r.claves;
  const sug: Explicacion['sugerencias'] = [];
  let html = '';
  switch (et.id) {
    case 'entrada': {
      const galAgua = (k.aguaEntrada * e.caudal) / 8.34;
      html = `<p>De los pozos llegan ${b(f(e.caudal) + ' MMSCFD')} a ${b(f(e.presion, 0) + ' psig')} y ${b(f(e.temperatura, 0) + ' °F')}. El medidor FTIQ-101 registra el caudal.</p>
        <p>El gas viene ${e.aguaSaturado ? 'saturado' : 'húmedo'}: trae ${b(f(k.aguaEntrada) + ' lb de agua por millón de pies cúbicos')}, unos ${b(f(galAgua, 0) + ' galones de agua al día')} disueltos como vapor. El RUT permite solo ${LIMITES.agua} lb/MMscf, así que hay que sacarle casi toda.</p>
        <p>En el separador vertical V-101 cae cualquier líquido que venga arrastrado (agua libre o condensado) antes de que el gas siga a las torres.</p>`;
      if (e.temperatura > 105) sug.push({ texto: 'El gas llega caliente y trae más agua. Si se puede, enfriarlo antes de las torres ayuda al glicol.', control: 'temperatura' });
      break;
    }
    case 'deshidratacion': {
      if (!e.torres) {
        html = `<p>Las dos torres contactoras están ${b('fuera de servicio')}. El gas sigue con sus ${b(f(k.aguaEntrada) + ' lb/MMscf')} de agua hacia el patín frío, donde al enfriarse suelta agua libre y puede formar hidratos.</p>`;
        sug.push({ texto: 'Ponga al menos una torre en servicio.', control: 'torres' });
        break;
      }
      const ok = k.aguaTEG <= LIMITES.agua;
      html = `<p>El gas entra por abajo de ${e.torres === 2 ? 'las torres TC-201 y TC-202 (en paralelo)' : 'la torre TC-201'} y sube por 8 platos de burbujeo. Por arriba baja el ${b('trietilenglicol (TEG)')}, que tiene mucha afinidad con el agua y se la va quitando al gas plato a plato.</p>
        <p>El agua baja de ${b(f(k.aguaEntrada) + '')} a ${b(f(k.aguaTEG, 2) + ' lb/MMscf')} ${ok ? `<span class="ok">bajo el límite de ${LIMITES.agua}</span>` : `<span class="mal">por encima del límite de ${LIMITES.agua}</span>`}. Cada torre va al ${b(f(k.cargaTorre * 100, 0) + ' %')} de su capacidad.</p>
        <p>El glicol cargado de agua (rico) pasa a la regeneradora ${b('GRU-210')}: el rehervidor lo calienta a ${b(f(e.tRehervidor, 0) + ' °F')}, el agua se evapora por la chimenea y el TEG vuelve a las torres al ${b(f(k.purezaTEG, 2) + ' %')} de pureza${e.gasDespojo ? ', ayudado por el gas de despojamiento' : ''}. Circulan ${b(f(k.tegGalH, 0) + ' gal/h')}.</p>`;
      if (!ok) {
        if (k.cargaTorre > 1) sug.push({ texto: 'Las torres están sobrecargadas: ponga las dos en servicio o baje el caudal.', control: 'torres' });
        if (!e.gasDespojo) sug.push({ texto: 'Abra el gas de despojamiento: el TEG sale más puro.', control: 'gasDespojo' });
        if (e.tRehervidor < 395) sug.push({ texto: 'Suba la temperatura del rehervidor (sin pasar de 400 °F).', control: 'tRehervidor' });
        if (e.circulacion < 5) sug.push({ texto: 'Aumente la circulación de glicol.', control: 'circulacion' });
      }
      break;
    }
    case 'dewpoint': {
      if (!e.chiller) {
        html = `<p>El chiller está ${b('apagado')}: el gas pasa por el patín sin enfriarse y los hidrocarburos pesados (hexano, heptano, octano) siguen con él.</p>
          <p>El punto de rocío de hidrocarburos del gas queda en ${b(f(k.cricondenterma) + ' °F')}; el RUT pide máximo ${LIMITES.rocioHC} °F. Si el gasoducto se enfría por debajo de esa temperatura, el gas suelta líquido en la tubería.</p>`;
        if (k.cricondenterma > LIMITES.rocioHC) sug.push({ texto: 'Encienda el chiller UE-101.', control: 'chiller' });
        break;
      }
      const libre = r.equipos['V-310']?.estado !== 'ok';
      html = `<p>Primero el gas se pre-enfría en ${b('E-301')} (gas-gas) con el gas frío que ya salió del separador: así se recupera el frío y el chiller trabaja menos. Sale a ${b(f(k.tE301, 0) + ' °F')}.</p>
        <p>Luego ${b('E-302')} lo baja a ${b(f(k.tFrio, 0) + ' °F')} con agua-monoetilenglicol que enfría el chiller ${b('UE-101')} (${f(k.chillerTR, 1)} toneladas de refrigeración). Al enfriarse, los hidrocarburos pesados se condensan.</p>
        <p>En el separador frío ${b('V-310')} se recogen ${b(f(k.condensadoBpd, 1) + ' barriles por día')} de condensado que van al tanque TK-101. El gas que sigue queda con un punto de rocío de ${b(f(k.cricondenterma) + ' °F')} (límite ${LIMITES.rocioHC} °F).</p>
        ${libre ? `<p class="mal">Ojo: a ${f(k.tFrio, 0)} °F el gas suelta agua libre${r.equipos['V-310'].estado === 'falla' ? ` y está por debajo de la temperatura de hidratos (${f(k.tHidratosF, 0)} °F): pueden taparse los intercambiadores` : ''}. Hay que secar mejor el gas antes del frío.</p>` : `<p>Como el gas ya viene seco del TEG, no hay agua libre y no hay riesgo de hidratos (se formarían bajo ${f(k.tHidratosF, 0)} °F si hubiera agua).</p>`}`;
      if (k.cricondenterma > LIMITES.rocioHC) sug.push({ texto: `Baje la temperatura del separador frío por debajo de ${LIMITES.rocioHC} °F.`, control: 'tFrio' });
      break;
    }
    case 'compresion': {
      html = `<p>Antes de comprimir se separan ${b(f(e.combustible, 2) + ' MMSCFD')} de ${b('gas combustible')}: pasan por el depurador V-601, se regulan a 45–60 psig y alimentan los motores CAT de los compresores y el generador Waukesha.</p>
        <p>El resto entra ${e.compresores === 2 ? 'a los motocompresores C-401 y C-402' : 'al motocompresor C-401'} a ${b(f(k.pSuccion, 0) + ' psig')} y sale a ${b(f(e.pDescarga, 0) + ' psig')}: una relación de compresión de ${f((e.pDescarga + 14.7) / (k.pSuccion + 14.7), 2)} que necesita ${b(f(k.potenciaHp, 0) + ' hp')}. Va al ${f(k.cargaCompresor * 100, 0)} % de su capacidad.</p>
        <p>Al comprimirse el gas se calienta hasta ${b(f(k.tDescargaF, 0) + ' °F')}; el aeroenfriador del paquete lo deja en ${b(f(Math.max(e.tEnfriador, e.tAmbiente + 10), 0) + ' °F')} para el gasoducto.</p>`;
      if (k.cargaCompresor > 1) sug.push({ texto: 'El compresor no da: ponga en servicio el C-402.', control: 'compresores' });
      if (e.pDescarga > 1200) sug.push({ texto: 'Baje la presión de entrega a 1200 psig o menos.', control: 'pDescarga' });
      if (Math.max(e.tEnfriador, e.tAmbiente + 10) > LIMITES.temperatura) sug.push({ texto: 'El gas sale muy caliente: baje la temperatura del enfriador.', control: 'tEnfriador' });
      break;
    }
    default: {
      const fallas = r.rut.filter((x) => !x.cumple);
      html = `<p>El analizador ${b('Condumax II')} mide sin parar el punto de rocío de hidrocarburos y de agua del gas de venta, y el medidor ${b('FT-VENTA')} registra lo que se entrega al gasoducto hacia Jobo (Sahagún).</p>
        <p>Se entregan ${b(f(k.ventaMmscfd, 2) + ' MMSCFD')} con ${b(f(k.pcb, 0) + ' BTU/pie³')}: ${b(f(k.ventaMmscfd * k.pcb, 0) + ' MMBTU por día')} de energía. De cada 100 pies cúbicos que entraron salen ${f((k.ventaMmscfd / k.entradaMmscfd) * 100, 1)} a venta; el resto es combustible y condensado.</p>
        ${fallas.length ? `<p class="mal">El gas ${b('no cumple el RUT')} en: ${fallas.map((x) => x.nombre.toLowerCase()).join(', ')}. El transportador puede rechazarlo.</p>` : `<p class="ok">${b('El gas cumple las 11 especificaciones del RUT.')}</p>`}`;
      for (const x of fallas) {
        const ctrl = x.id === 'agua' ? 'circulacion' : x.id === 'rocio' ? (e.chiller ? 'tFrio' : 'chiller') : x.id === 'temperatura' ? 'tEnfriador' : '';
        if (ctrl) sug.push({ texto: x.palanca, control: ctrl });
      }
    }
  }
  return { html, sugerencias: sug };
}
