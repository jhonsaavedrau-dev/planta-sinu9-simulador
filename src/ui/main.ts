import './estilo.css';
import planta from '../datos/planta.json';
import { entradasPorDefecto, COMPONENTES, NOMBRES_COMP, type Entradas, type Resultado, type ResultadoError, type Estado } from '../sim/planta';
import { SECCIONES, ESCENARIOS, PRESETS_COMPOSICION, type Control } from './controles';
import { ETAPAS, explicar, estadoEtapa, cifraEtapa, f, type Etapa } from './explicar';

// ───────────────────────── Tipos de la escena 3D ─────────────────────────
interface Escena {
  select(tag: string | null): void;
  setEstado(tag: string, e: Estado): void;
  setStreams(s: Record<string, { T: number; rel: number; activo: boolean }>): void;
  setColorMode(m: string): void;
  setFlow(on: boolean): void;
  setLabels(on: boolean): void;
  flyEq(tag: string, d?: number): void;
  flyMany(tags: string[], k?: number): void;
  home(): void;
  project(tag: string): { x: number; y: number; vis: boolean; d: number } | null;
  setInsets(i: Partial<Record<'left' | 'right' | 'top' | 'bottom', number>>): void;
  onPick: (tag: string | null) => void;
  onFrame: () => void;
}
interface EquipoPlanta { tag: string; name: string; system: string; info: Record<string, string>; planos?: string[] }
declare global {
  interface Window { PLANT: unknown; __escena: Escena; __sim: unknown }
}

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const EQUIPOS = (planta as unknown as { equipment: EquipoPlanta[] }).equipment;
const eqDe = (tag: string) => EQUIPOS.find((e) => e.tag === tag);
const movil = () => matchMedia('(max-width: 820px)').matches;
const guardar = (k: string, v?: string) => {
  try {
    if (v === undefined) return localStorage.getItem(k);
    localStorage.setItem(k, v);
  } catch {
    /* sin almacenamiento: no pasa nada */
  }
  return null;
};

const ICO = {
  check: '<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  x: '<svg viewBox="0 0 24 24"><path d="M7 7l10 10M17 7L7 17"/></svg>',
  alerta: '<svg viewBox="0 0 24 24"><path d="M12 4l9 16H3z"/><path d="M12 10v4M12 17h.01"/></svg>',
  flecha: '<svg viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg>',
  ir: '<svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
  ajuste: '<svg viewBox="0 0 24 24"><path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/></svg>',
  foco: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M3 12h3M18 12h3M12 3v3M12 18v3"/></svg>',
};

// ───────────────────────── Estado ─────────────────────────
let entradas: Entradas = (() => {
  const g = guardar('sinu9-sim-entradas');
  if (g) {
    try {
      const v = JSON.parse(g);
      return { ...entradasPorDefecto(), ...v, composicion: { ...entradasPorDefecto().composicion, ...(v.composicion ?? {}) } };
    } catch {
      /* se ignora */
    }
  }
  return entradasPorDefecto();
})();
let resultado: Resultado | null = null;
let escenarioActivo: string | null = null;
let seccionAbierta = 'entrada';
let tarjeta: { tipo: 'etapa'; id: string } | { tipo: 'equipo'; tag: string } | null = null;
let tabTarjeta = 'vivo';
let vista = 'resultado';
let avanzados = false;

// ───────────────────────── Cálculo en un Web Worker ─────────────────────────
const worker = new Worker(new URL('../sim/calculo.worker.ts', import.meta.url), { type: 'module' });
let pedido = 0;
let temporizador = 0;
let ocupado = false;
let pendiente = false;
worker.onmessage = (ev: MessageEvent<{ id: number; resultado: Resultado | ResultadoError }>) => {
  ocupado = false;
  if (pendiente) {
    pendiente = false;
    lanzar();
  } else $('calculando').hidden = true;
  if (ev.data.id !== pedido) return;
  const r = ev.data.resultado;
  if (!r.ok) {
    mostrarError(r.error);
    return;
  }
  const antes = resultado;
  resultado = r;
  window.__sim = r;
  pintarResultado(antes);
};
function lanzar() {
  if (ocupado) {
    pendiente = true;
    return;
  }
  ocupado = true;
  pedido++;
  worker.postMessage({ id: pedido, entradas: JSON.parse(JSON.stringify(entradas)) });
}
function recalcular(inmediato = false) {
  guardar('sinu9-sim-entradas', JSON.stringify(entradas));
  clearTimeout(temporizador);
  $('calculando').hidden = false;
  temporizador = window.setTimeout(lanzar, inmediato ? 0 : 140);
}

// ───────────────────────── Entradas ─────────────────────────
function htmlControl(c: Control): string {
  const v = entradas[c.id] as number | boolean;
  const ay = `<button type="button" class="ayuda" data-ay="${c.id}" aria-label="Qué es">?</button>`;
  const cab = `<div class="ctl-cab"><label for="in-${c.id}">${c.etiqueta}${ay}</label>`;
  const txtAyuda = `<div class="ctl-ayuda" id="ay-${c.id}" hidden>${c.ayuda}</div>`;
  if (c.tipo === 'interruptor')
    return `<div class="ctl" data-c="${c.id}"><div class="interruptor">${cab}</div><button type="button" class="sw" role="switch" id="in-${c.id}" aria-checked="${!!v}"></button></div>${txtAyuda}</div>`;
  if (c.tipo === 'opciones')
    return `<div class="ctl" data-c="${c.id}">${cab}</div>${txtAyuda}<div class="opciones" role="group">${c.opciones!.map((o) => `<button type="button" data-v="${o.valor}" class="${o.valor === v ? 'on' : ''}">${o.etiqueta}</button>`).join('')}</div></div>`;
  const n = v as number;
  return `<div class="ctl" data-c="${c.id}">${cab}<span class="campo"><input id="in-${c.id}" type="number" inputmode="decimal" step="${c.paso}" min="${c.min}" max="${c.max}" value="${n.toFixed(c.decimales)}"><span>${c.unidad}</span></span></div>${txtAyuda}
    <input type="range" min="${c.min}" max="${c.max}" step="${c.paso}" value="${n}" aria-label="${c.etiqueta}" data-r="${c.id}">
    <div class="rango-lim"><span>${c.min}</span><span>${c.max}</span></div></div>`;
}

function htmlComposicion(): string {
  const suma = COMPONENTES.reduce((a, k) => a + (entradas.composicion[k] ?? 0), 0);
  const actual = PRESETS_COMPOSICION.find((p) => COMPONENTES.every((k) => Math.abs((p.comp[k] ?? 0) - (entradas.composicion[k] ?? 0)) < 1e-9));
  return `<div class="comp"><div class="comp-cab"><b>Composición (% molar, base seca)</b>
    <select id="presetComp" aria-label="Composición predefinida">${PRESETS_COMPOSICION.map((p) => `<option value="${p.id}" ${actual?.id === p.id ? 'selected' : ''}>${p.nombre}</option>`).join('')}${actual ? '' : '<option selected disabled>Personalizada</option>'}</select></div>
    <div class="comp-tabla">${COMPONENTES.map((k) => `<div class="comp-fila"><label for="cp-${k}" title="${NOMBRES_COMP[k]}">${NOMBRES_COMP[k]}</label><input id="cp-${k}" data-cp="${k}" type="number" step="0.01" min="0" max="100" value="${(entradas.composicion[k] ?? 0).toFixed(3).replace(/0+$/, '').replace(/\.$/, '')}"></div>`).join('')}</div>
    <div class="comp-suma"><span>Use la cromatografía real del gas</span><b class="${Math.abs(suma - 100) > 0.05 ? 'mal' : ''}">Suma ${f(suma, 2)} %</b></div></div>`;
}

function pintarEntradas() {
  const cont = $('secciones');
  const scroll = cont.scrollTop;
  cont.innerHTML = SECCIONES.map((s) => {
    const visibles = s.controles.filter((c) => !c.si || c.si(entradas));
    const basicos = visibles.filter((c) => !c.avanzado);
    const avz = visibles.filter((c) => c.avanzado);
    return `<section class="sec ${s.id === seccionAbierta ? 'abierta' : ''}" data-s="${s.id}">
      <button type="button" class="sec-cab" aria-expanded="${s.id === seccionAbierta}"><span class="sec-n" data-s-n="${s.id}">${s.paso}</span><span class="sec-t"><b>${s.titulo}</b><small>${s.sub}</small></span><span class="sec-flecha">${ICO.flecha}</span></button>
      <div class="sec-c">${basicos.map(htmlControl).join('')}
        ${avz.length ? `<button type="button" class="mas ${avanzados ? 'on' : ''}">${ICO.flecha}${avanzados ? 'Menos opciones' : 'Más opciones'}</button><div class="avz ${avanzados ? 'on' : ''}">${avz.map(htmlControl).join('')}</div>` : ''}
        ${s.id === 'entrada' ? htmlComposicion() : ''}
      </div></section>`;
  }).join('');
  cont.scrollTop = scroll;
  cont.querySelectorAll<HTMLInputElement>('input[type=range]').forEach(pintarRango);
  marcarSecciones();
}

function pintarRango(r: HTMLInputElement) {
  const p = ((+r.value - +r.min) / (+r.max - +r.min)) * 100;
  r.style.setProperty('--p', `${p}%`);
}

function ctlDe(id: string) {
  for (const s of SECCIONES) for (const c of s.controles) if (c.id === id) return { s, c };
  return null;
}

function poner(id: string, v: number | boolean, repintar = false) {
  (entradas as unknown as Record<string, unknown>)[id] = v;
  escenarioActivo = null;
  pintarEscenarios();
  if (repintar) pintarEntradas();
  recalcular();
}

function engancharEntradas() {
  const cont = $('secciones');
  cont.addEventListener('click', (ev) => {
    const t = ev.target as HTMLElement;
    const cab = t.closest('.sec-cab');
    if (cab) {
      const id = (cab.parentElement as HTMLElement).dataset.s!;
      seccionAbierta = seccionAbierta === id ? '' : id;
      pintarEntradas();
      return;
    }
    const ay = t.closest<HTMLElement>('.ayuda');
    if (ay) {
      ev.preventDefault();
      const caja = $(`ay-${ay.dataset.ay}`);
      caja.hidden = !caja.hidden;
      ay.classList.toggle('on', !caja.hidden);
      return;
    }
    if (t.closest('.mas')) {
      avanzados = !avanzados;
      pintarEntradas();
      return;
    }
    const sw = t.closest<HTMLElement>('.sw') ?? (t.closest('.interruptor') ? t.closest('.ctl')?.querySelector<HTMLElement>('.sw') : null);
    if (sw) {
      const id = sw.id.slice(3);
      const nv = sw.getAttribute('aria-checked') !== 'true';
      sw.setAttribute('aria-checked', String(nv));
      poner(id, nv, true);
      return;
    }
    const op = t.closest<HTMLElement>('.opciones button');
    if (op) {
      const id = (op.closest('.ctl') as HTMLElement).dataset.c!;
      poner(id, +op.dataset.v!, true);
    }
  });
  cont.addEventListener('input', (ev) => {
    const t = ev.target as HTMLInputElement;
    if (t.dataset.r) {
      const c = ctlDe(t.dataset.r)!.c;
      const v = +t.value;
      pintarRango(t);
      const campo = $<HTMLInputElement>(`in-${c.id}`);
      if (campo) campo.value = v.toFixed(c.decimales);
      poner(c.id, v);
    } else if (t.dataset.cp) {
      const v = Math.max(0, +t.value || 0);
      entradas.composicion[t.dataset.cp] = v;
      escenarioActivo = null;
      const suma = COMPONENTES.reduce((a, k) => a + (entradas.composicion[k] ?? 0), 0);
      const b = cont.querySelector('.comp-suma b')!;
      b.textContent = `Suma ${f(suma, 2)} %`;
      b.classList.toggle('mal', Math.abs(suma - 100) > 0.05);
      recalcular();
    }
  });
  cont.addEventListener('change', (ev) => {
    const t = ev.target as HTMLInputElement | HTMLSelectElement;
    if (t.id === 'presetComp') {
      const p = PRESETS_COMPOSICION.find((x) => x.id === t.value)!;
      entradas.composicion = { ...p.comp };
      escenarioActivo = null;
      pintarEscenarios();
      pintarEntradas();
      recalcular(true);
      return;
    }
    if (t.id?.startsWith('in-') && t instanceof HTMLInputElement && t.type === 'number') {
      const c = ctlDe(t.id.slice(3))!.c;
      let v = +t.value;
      if (!Number.isFinite(v)) v = entradas[c.id] as number;
      v = Math.min(c.max!, Math.max(c.min!, v));
      t.value = v.toFixed(c.decimales);
      const r = cont.querySelector<HTMLInputElement>(`input[data-r="${c.id}"]`);
      if (r) {
        r.value = String(v);
        pintarRango(r);
      }
      poner(c.id, v);
    }
  });
}

function marcarSecciones() {
  if (!resultado) return;
  for (const s of SECCIONES) {
    const ets = ETAPAS.filter((e) => e.seccion === s.id);
    const est = ets.map((e) => estadoEtapa(resultado!, e));
    const e = est.includes('falla') ? 'falla' : est.includes('aviso') ? 'aviso' : 'ok';
    const n = document.querySelector<HTMLElement>(`[data-s-n="${s.id}"]`);
    if (n) n.dataset.e = s.id === 'entrada' ? '' : e;
  }
}

/** Abre la sección del control, lo resalta y lo trae a la vista */
function irAControl(id: string) {
  const c = ctlDe(id);
  if (!c) return;
  if (c.c.avanzado) avanzados = true;
  seccionAbierta = c.s.id;
  pintarEntradas();
  if (movil()) cambiarVista('entradas');
  const el = document.querySelector<HTMLElement>(`.ctl[data-c="${id}"]`);
  if (!el) return;
  el.scrollIntoView({ block: 'center', behavior: 'smooth' });
  el.classList.remove('resalta');
  void el.offsetWidth;
  el.classList.add('resalta');
  const sec = el.closest('.sec')!;
  sec.classList.add('foco');
  setTimeout(() => sec.classList.remove('foco'), 1600);
}

function pintarEscenarios() {
  $('escenarios').innerHTML = ESCENARIOS.map((s) => `<button type="button" class="chip ${escenarioActivo === s.id ? 'on' : ''}" data-e="${s.id}" title="${s.descripcion}">${s.nombre}</button>`).join('');
}
$('escenarios').addEventListener('click', (ev) => {
  const b = (ev.target as HTMLElement).closest<HTMLElement>('.chip');
  if (!b) return;
  const s = ESCENARIOS.find((x) => x.id === b.dataset.e)!;
  entradas = { ...entradasPorDefecto(), ...JSON.parse(JSON.stringify(s.cambios)) };
  escenarioActivo = s.id;
  pintarEscenarios();
  pintarEntradas();
  recalcular(true);
});
$('bRestablecer').onclick = () => {
  entradas = entradasPorDefecto();
  escenarioActivo = 'normal';
  pintarEscenarios();
  pintarEntradas();
  recalcular(true);
};

// ───────────────────────── Resultado ─────────────────────────
const KPI_ANT: Record<string, string> = {};
function kpi(id: string, etq: string, valor: string, unidad: string) {
  const cambio = KPI_ANT[id] !== undefined && KPI_ANT[id] !== valor;
  KPI_ANT[id] = valor;
  return `<div class="kpi ${cambio ? 'cambio' : ''}"><small>${etq}</small><b>${valor}<em>${unidad}</em></b></div>`;
}

function mostrarError(msg: string) {
  $('veredicto').className = 'veredicto error';
  $('veredicto').innerHTML = `<span class="ver-ico">${ICO.alerta}</span><span class="ver-t"><small>No se pudo calcular</small><b>Revise los datos</b><span>${msg}</span></span>`;
}

function pintarResultado(antes: Resultado | null) {
  const r = resultado!;
  const k = r.claves;
  const fallas = r.rut.filter((x) => !x.cumple);
  const malos = Object.entries(r.equipos).filter(([, x]) => x.estado === 'falla').map(([t]) => t);
  const v = $('veredicto');
  v.className = `veredicto ${r.cumple ? (malos.length ? 'ok alerta' : 'ok') : 'falla'}`;
  v.innerHTML = r.cumple
    ? `<span class="ver-ico">${ICO.check}</span><span class="ver-t"><small>Gas de venta</small><b>Cumple el RUT</b><span>${malos.length ? `Pero ${malos.length === 1 ? 'un equipo trabaja' : malos.length + ' equipos trabajan'} fuera de rango: ${malos.join(', ')}` : 'Las 11 especificaciones de calidad están dentro del límite'}</span></span>`
    : `<span class="ver-ico">${ICO.x}</span><span class="ver-t"><small>Gas de venta</small><b>Fuera de especificación</b><span>No cumple en ${fallas.map((x) => x.corto).join(', ')}</span></span>`;
  $('kpis').innerHTML =
    kpi('venta', 'Gas a venta', f(k.ventaMmscfd, 2), 'MMSCFD') +
    kpi('energia', 'Energía entregada', f(k.ventaMmscfd * k.pcb, 0), 'MMBTU/d') +
    kpi('cond', 'Condensado', f(k.condensadoBpd, 1), 'BPD') +
    kpi('hp', 'Compresión', f(k.potenciaHp, 0), 'hp');

  // Especificaciones RUT, las que fallan primero
  const orden = [...r.rut].sort((a, b) => Number(a.cumple) - Number(b.cumple));
  const abiertas = new Set([...document.querySelectorAll<HTMLElement>('.spec.abierta')].map((x) => x.dataset.id));
  $('tRut').innerHTML =
    orden
      .map((s) => {
        const val = typeof s.valor === 'boolean' ? (s.valor ? 'Sí' : 'No') : f(s.valor, s.id === 'o2' || s.id === 'co2' || s.id === 'n2' || s.id === 'inertes' ? 2 : s.id === 'pcb' || s.id === 'temperatura' ? 0 : 1);
        let barra = '';
        if (typeof s.valor === 'number') {
          const lo = s.min !== null ? s.min * 0.85 : Math.min(0, s.valor);
          const hi = Math.max((s.max ?? s.min!) * 1.6, s.valor * 1.08, s.max ?? 0);
          const pos = (x: number) => Math.max(0, Math.min(100, ((x - lo) / (hi - lo)) * 100));
          const z0 = s.min !== null ? pos(s.min) : 0;
          const z1 = s.max !== null ? pos(s.max) : 100;
          barra = `<div class="barra-spec"><span class="zona" style="left:${z0}%;width:${z1 - z0}%"></span>${s.min !== null ? `<span class="lim" style="left:${z0}%"></span>` : ''}${s.max !== null ? `<span class="lim" style="left:${z1}%"></span>` : ''}<span class="pto" style="left:${pos(s.valor)}%"></span></div>`;
        }
        const ctl = s.id === 'agua' ? 'circulacion' : s.id === 'rocio' ? (entradas.chiller ? 'tFrio' : 'chiller') : s.id === 'temperatura' ? 'tEnfriador' : s.id === 'h2s' || s.id === 'azufre' ? 'h2s' : '';
        return `<div class="spec ${s.cumple ? 'ok' : 'falla'} ${abiertas.has(s.id) || (!s.cumple && !antes) ? 'abierta' : ''}" data-id="${s.id}">
        <button type="button" class="spec-cab"><span class="spec-ico">${s.cumple ? ICO.check : ICO.x}</span><span class="spec-n">${s.nombre}<small>${s.limite}</small></span><span class="spec-v">${val}<small>${s.unidad}</small></span></button>${barra}
        <div class="spec-det"><p>${s.porQue}</p><p><span class="lim-t">${s.cumple ? 'Qué lo mantiene así:' : 'Cómo corregirlo:'}</span> ${s.palanca}</p>${ctl && !s.cumple ? `<button type="button" class="ir" data-ctl="${ctl}">${ICO.ajuste}Ir al control</button>` : ''}</div></div>`;
      })
      .join('') + `<p class="nota-rut">Límites de referencia del RUT (Res. CREG 071 de 1999 y modificaciones); confírmelos con la edición vigente. El punto de rocío se evalúa en la cricondenterma.</p>`;

  // Corrientes (libro de trabajo)
  const col = (t: string) => (planta as { streams: Record<string, { color: string }> }).streams[t]?.color ?? '#999';
  $('tCorrientes').innerHTML = `<table class="tabla"><thead><tr><th>Corriente</th><th>°F</th><th>psig</th><th>Caudal</th><th>Agua</th></tr></thead><tbody>${r.corrientes
    .map((c) => `<tr><td><i style="background:${col(c.tipo3d)}"></i>${c.nombre}<br><small>${c.fase}</small></td><td>${f(c.T, 0)}</td><td>${f(c.P, 0)}</td><td>${f(c.Q, c.unidadQ === 'MMSCFD' ? 2 : 1)}<br><small>${c.unidadQ}</small></td><td>${c.agua !== undefined ? f(c.agua, 1) + '<br><small>lb/MMscf</small>' : '—'}</td></tr>`)
    .join('')}</tbody></table>
    <table class="tabla" style="margin-top:14px"><thead><tr><th>Balance</th><th>MMSCFD</th><th>%</th></tr></thead><tbody>
    <tr><td>Entra de pozos</td><td>${f(k.entradaMmscfd, 3)}</td><td>100</td></tr>
    <tr><td>Sale a venta</td><td>${f(k.ventaMmscfd, 3)}</td><td>${f((k.ventaMmscfd / k.entradaMmscfd) * 100, 1)}</td></tr>
    <tr><td>Gas combustible</td><td>${f(k.combustibleMmscfd, 3)}</td><td>${f((k.combustibleMmscfd / k.entradaMmscfd) * 100, 1)}</td></tr>
    <tr><td>Se va como condensado</td><td>${f(k.entradaMmscfd - k.ventaMmscfd - k.combustibleMmscfd, 3)}</td><td>${f(k.encogimiento, 2)}</td></tr>
    </tbody></table>
    <p class="nota-rut">Peso molecular del gas tratado ${f(k.mw, 2)} · Índice de Wobbe ${f(k.wobbe, 0)} BTU/pie³ · ${f(k.pcbMj, 2)} MJ/m³ · cálculo en ${f(r.ms, 0)} ms.</p>`;

  $('nAvisos').textContent = r.avisos.length ? String(r.avisos.length) : '';
  $('tAvisos').innerHTML = r.avisos.length ? r.avisos.map((a) => `<div class="aviso">${ICO.alerta}<span>${a}</span></div>`).join('') : `<div class="vacio">Sin avisos: todos los equipos trabajan dentro de su rango.</div>`;

  // 3D: estado de cada equipo y de cada corriente
  const esc = window.__escena;
  if (esc) {
    for (const e of EQUIPOS) if (e.tag !== 'RACK') esc.setEstado(e.tag, r.equipos[e.tag]?.estado ?? 'ok');
    esc.setStreams(r.flujo3d);
  }
  pintarEtiquetas();
  pintarRuta();
  pintarTarjeta();
  marcarSecciones();
}

document.querySelector('#pResultado .tabs')!.addEventListener('click', (ev) => {
  const b = (ev.target as HTMLElement).closest<HTMLElement>('button');
  if (!b) return;
  document.querySelectorAll('#pResultado .tabs button').forEach((x) => x.classList.toggle('on', x === b));
  document.querySelectorAll<HTMLElement>('#pResultado .tab-c').forEach((x) => x.classList.toggle('on', x.dataset.t === b.dataset.t));
});
$('tRut').addEventListener('click', (ev) => {
  const t = ev.target as HTMLElement;
  const ir = t.closest<HTMLElement>('.ir');
  if (ir) return irAControl(ir.dataset.ctl!);
  const cab = t.closest('.spec-cab');
  if (cab) cab.parentElement!.classList.toggle('abierta');
});

// ───────────────────────── Etiquetas con valores sobre la planta ─────────────────────────
const ETQ: { tag: string; texto: (r: Resultado) => string; movil?: boolean }[] = [
  { tag: 'FTIQ-101', texto: () => `${f(entradas.caudal, 1)} MMSCFD`, movil: true },
  { tag: 'TC-201', texto: (r) => (entradas.torres ? `${f(r.claves.aguaTEG, 1)} lb agua` : 'Fuera de servicio'), movil: true },
  { tag: 'GRU-210', texto: (r) => (entradas.torres ? `TEG ${f(r.claves.purezaTEG, 1)} %` : 'Detenida') },
  { tag: 'UE-101', texto: (r) => (entradas.chiller ? `${f(r.claves.chillerTR, 1)} TR` : 'Apagado') },
  { tag: 'V-310', texto: (r) => `${f(r.claves.tFrio, 0)} °F · ${f(r.claves.condensadoBpd, 1)} BPD`, movil: true },
  { tag: 'C-401', texto: (r) => `${f(entradas.pDescarga, 0)} psig · ${f(r.claves.potenciaHp, 0)} hp`, movil: true },
  { tag: 'CONDUMAX', texto: (r) => `Rocío ${f(r.claves.cricondenterma, 0)} °F` },
  { tag: 'FT-VENTA', texto: (r) => `${f(r.claves.ventaMmscfd, 2)} MMSCFD ${r.cumple ? '✓' : '✕'}`, movil: true },
];
let etiquetasOn = true;
const elsEtq: Record<string, HTMLElement> = {};
function pintarEtiquetas() {
  const cont = $('etiquetas');
  if (!resultado) return;
  for (const e of ETQ) {
    let el = elsEtq[e.tag];
    if (!el) {
      el = document.createElement('div');
      el.className = 'etq';
      el.dataset.tag = e.tag;
      el.innerHTML = '<i></i><b></b><span></span>';
      el.onclick = () => abrirEquipo(e.tag);
      cont.appendChild(el);
      elsEtq[e.tag] = el;
    }
    el.dataset.e = resultado.equipos[e.tag]?.estado ?? 'ok';
    el.querySelector('b')!.textContent = e.tag === 'CONDUMAX' ? 'CONDUMAX' : e.tag;
    el.querySelector('span')!.textContent = e.texto(resultado);
    el.classList.toggle('sel', tarjeta?.tipo === 'equipo' && tarjeta.tag === e.tag);
  }
}
let zona = { izq: 0, der: innerWidth, arriba: 0, abajo: innerHeight };
function moverEtiquetas() {
  const esc = window.__escena;
  const m = movil();
  for (const e of ETQ) {
    const el = elsEtq[e.tag];
    if (!el) continue;
    const p = esc.project(e.tag);
    const ver = etiquetasOn && p && p.vis && p.d < 150 && (!m || e.movil) && p.x > zona.izq + 50 && p.x < zona.der - 50 && p.y > zona.arriba + 40 && p.y < zona.abajo;
    el.classList.toggle('lejos', !ver);
    if (ver) el.style.transform = `translate(${p!.x.toFixed(1)}px, ${p!.y.toFixed(1)}px) translate(-50%, calc(-100% - 6px))`;
  }
}

// ───────────────────────── Proceso paso a paso ─────────────────────────
function pintarRuta() {
  if (!resultado) return;
  const activa = tarjeta?.tipo === 'etapa' ? tarjeta.id : null;
  $('ruta').innerHTML = ETAPAS.map((et, i) => `<button type="button" class="etapa ${activa === et.id ? 'on' : ''}" data-et="${et.id}" data-e="${estadoEtapa(resultado!, et)}"><span class="et-n">${i + 1}</span><span class="et-t"><b>${et.corto}</b><small>${cifraEtapa(resultado!, et, entradas)}</small></span></button>`).join('');
}
$('ruta').addEventListener('click', (ev) => {
  const b = (ev.target as HTMLElement).closest<HTMLElement>('.etapa');
  if (!b) return;
  if (tarjeta?.tipo === 'etapa' && tarjeta.id === b.dataset.et) cerrarTarjeta();
  else abrirEtapa(b.dataset.et!);
});

function abrirEtapa(id: string) {
  const et = ETAPAS.find((x) => x.id === id)!;
  tarjeta = { tipo: 'etapa', id };
  window.__escena?.select(null);
  pintarRuta();
  pintarTarjeta();
  pintarEtiquetas();
  window.__escena?.flyMany(et.foco, 1.3);
}
function abrirEquipo(tag: string) {
  if (!eqDe(tag)) return;
  tarjeta = { tipo: 'equipo', tag };
  tabTarjeta = 'vivo';
  window.__escena?.select(tag);
  if (movil() && vista !== 'proceso') cambiarVista('proceso');
  pintarRuta();
  pintarTarjeta();
  pintarEtiquetas();
  window.__escena?.flyEq(tag);
}
function cerrarTarjeta() {
  tarjeta = null;
  window.__escena?.select(null);
  pintarRuta();
  pintarTarjeta();
  pintarEtiquetas();
}

function htmlDatos(datos: { etiqueta: string; valor: string; unidad?: string }[]) {
  return `<div class="datos">${datos.map((d) => `<div class="dato"><small>${d.etiqueta}</small><b>${d.valor}${d.unidad ? `<em>${d.unidad}</em>` : ''}</b></div>`).join('')}</div>`;
}

function pintarTarjeta() {
  const el = $('tarjeta');
  if (!tarjeta || !resultado) {
    el.hidden = true;
    encuadrar();
    return;
  }
  const r = resultado;
  if (tarjeta.tipo === 'etapa') {
    const i = ETAPAS.findIndex((x) => x.id === (tarjeta as { id: string }).id);
    const et = ETAPAS[i];
    const ex = explicar(r, et, entradas);
    const est = estadoEtapa(r, et);
    el.innerHTML = `<div class="tj-cab"><span class="et-n" style="background:var(--${est === 'ok' ? 'ok' : est === 'aviso' ? 'aviso' : est === 'falla' ? 'falla' : 'apagado'})">${i + 1}</span><div class="tj-t"><small>Etapa ${i + 1} de ${ETAPAS.length}</small><h3>${et.titulo}</h3></div><button type="button" class="cerrar" aria-label="Cerrar">${ICO.x}</button></div>
      <div class="tj-c"><div class="eqs">${et.equipos.filter((t) => eqDe(t)).map((t) => `<button type="button" class="eq-chip" data-eq="${t}" data-e="${r.equipos[t]?.estado ?? 'ok'}"><i></i>${t}</button>`).join('')}</div>
      ${ex.html}
      ${ex.sugerencias.length ? `<div class="sugs">${ex.sugerencias.map((s) => `<div class="sug"><span class="sug-t">${ICO.ajuste}<span>${s.texto}</span></span><button type="button" class="ir" data-ctl="${s.control}">Ajustar${ICO.ir}</button></div>`).join('')}</div>` : ''}</div>
      <div class="tj-pie"><button type="button" class="btn" data-nav="-1" ${i === 0 ? 'disabled style="visibility:hidden"' : ''}>Anterior</button><button type="button" class="btn prim" data-nav="1">${i < ETAPAS.length - 1 ? `Siguiente: ${ETAPAS[i + 1].corto}` : 'Ver toda la planta'}${ICO.ir}</button></div>`;
  } else {
    const tag = tarjeta.tag;
    const eq = eqDe(tag)!;
    const vivo = r.equipos[tag];
    const planos = (eq.planos ?? []).filter(Boolean);
    const tabs = [['vivo', 'En operación'], ['ficha', 'Ficha técnica'], ...(planos.length ? [['planos', `Planos (${planos.length})`]] : [])];
    if (!tabs.some((t) => t[0] === tabTarjeta)) tabTarjeta = 'vivo';
    const limpiar = (v: string) => v.replace(/\s*[—–-]?\s*ESTIMAD[OA]S?/g, ' (estimado)');
    let cuerpo = '';
    if (tabTarjeta === 'vivo')
      cuerpo = vivo
        ? `<p><b>${vivo.titular}.</b></p>${htmlDatos(vivo.datos)}`
        : `<p>${eq.info['Función'] ?? 'Equipo de apoyo de la planta.'}</p><p style="color:var(--suave)">Este equipo no cambia con las variables de la simulación.</p>`;
    else if (tabTarjeta === 'ficha') cuerpo = `<dl class="ficha">${Object.entries(eq.info).map(([k2, v]) => `<dt>${k2}</dt><dd>${limpiar(v)}</dd>`).join('')}</dl>`;
    else cuerpo = `<div class="planos">${planos.map((p) => `<button type="button" class="plano" data-plano="${p}"><img src="./planos/${p}.jpg" alt="" loading="lazy"><span>Ver plano</span></button>`).join('')}</div>`;
    const est = vivo?.estado ?? 'ok';
    el.innerHTML = `<div class="tj-cab"><span class="et-n" style="background:var(--${est === 'ok' ? 'ok' : est === 'aviso' ? 'aviso' : est === 'falla' ? 'falla' : 'apagado'})">${ICO.foco}</span><div class="tj-t"><small>${tag}</small><h3>${eq.name}</h3></div><button type="button" class="cerrar" aria-label="Cerrar">${ICO.x}</button></div>
      <div class="tj-tabs">${tabs.map(([k2, t]) => `<button type="button" data-tt="${k2}" class="${tabTarjeta === k2 ? 'on' : ''}">${t}</button>`).join('')}</div>
      <div class="tj-c">${cuerpo}</div>`;
  }
  el.hidden = false;
  encuadrar();
}
$('tarjeta').addEventListener('click', (ev) => {
  const t = ev.target as HTMLElement;
  if (t.closest('.cerrar')) return cerrarTarjeta();
  const ir = t.closest<HTMLElement>('.ir');
  if (ir) return irAControl(ir.dataset.ctl!);
  const ch = t.closest<HTMLElement>('.eq-chip');
  if (ch) return abrirEquipo(ch.dataset.eq!);
  const tt = t.closest<HTMLElement>('[data-tt]');
  if (tt) {
    tabTarjeta = tt.dataset.tt!;
    return pintarTarjeta();
  }
  const pl = t.closest<HTMLElement>('[data-plano]');
  if (pl) {
    $('visor').querySelector('img')!.src = `./planos/${pl.dataset.plano}.jpg`;
    $('visor').querySelector('b')!.textContent = `${(tarjeta as { tag: string }).tag} · plano`;
    $('visor').hidden = false;
    return;
  }
  const nav = t.closest<HTMLElement>('[data-nav]');
  if (nav && tarjeta?.tipo === 'etapa') {
    const i = ETAPAS.findIndex((x) => x.id === (tarjeta as { id: string }).id) + +nav.dataset.nav!;
    if (i >= ETAPAS.length) {
      cerrarTarjeta();
      window.__escena.home();
    } else abrirEtapa(ETAPAS[Math.max(0, i)].id);
  }
});
$('visor').addEventListener('click', (ev) => {
  if ((ev.target as HTMLElement).closest('.txt') || (ev.target as HTMLElement).classList.contains('visor-img')) $('visor').hidden = true;
});

// ───────────────────────── Barra superior y vistas ─────────────────────────
$('modoColor').addEventListener('click', (ev) => {
  const b = (ev.target as HTMLElement).closest<HTMLElement>('button');
  if (!b) return;
  $('modoColor').querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
  window.__escena.setColorMode(b.dataset.m!);
  $('leyendaT').hidden = b.dataset.m !== 'temperatura';
});
$('bValores').onclick = () => {
  etiquetasOn = !etiquetasOn;
  $('bValores').classList.toggle('on', etiquetasOn);
  $('bValores').setAttribute('aria-pressed', String(etiquetasOn));
};
let flujoOn = true;
$('bFlujo').onclick = () => {
  flujoOn = !flujoOn;
  $('bFlujo').classList.toggle('on', flujoOn);
  window.__escena.setFlow(flujoOn);
};
$('bInicio').onclick = () => {
  cerrarTarjeta();
  window.__escena.home();
};
$('bAyuda').onclick = () => ($('guia').hidden = false);
$('guiaOk').onclick = () => {
  $('guia').hidden = true;
  guardar('sinu9-sim-guia', '1');
};

function cambiarVista(v: string) {
  vista = v;
  document.body.dataset.v = v;
  document.querySelectorAll<HTMLElement>('#tabsMovil button').forEach((b) => b.classList.toggle('on', b.dataset.v === v));
  if (v === 'proceso' && !tarjeta) abrirEtapa('entrada');
  encuadrar();
}
$('tabsMovil').addEventListener('click', (ev) => {
  const b = (ev.target as HTMLElement).closest<HTMLElement>('button');
  if (b) cambiarVista(b.dataset.v!);
});

function encuadrar() {
  const esc = window.__escena;
  if (!esc) return;
  if (movil()) {
    const h = innerHeight * 0.52;
    const tj = $('tarjeta');
    const abajo = vista === 'proceso' ? (tj.hidden ? 140 : innerHeight - tj.getBoundingClientRect().top + 6) : h;
    esc.setInsets({ left: 0, right: 0, top: 58, bottom: Math.min(abajo, innerHeight - 200) });
    zona = { izq: 20, der: innerWidth - 20, arriba: 40, abajo: innerHeight - Math.min(abajo, innerHeight - 200) };
  } else {
    const izq = $('pEntradas').getBoundingClientRect().right + 8;
    const der = innerWidth - $('pResultado').getBoundingClientRect().left + 8;
    const tj = $('tarjeta');
    const abajo = tj.hidden ? 70 : innerHeight - tj.getBoundingClientRect().top + 8;
    esc.setInsets({ left: izq, right: der, top: 70, bottom: Math.min(abajo, innerHeight * 0.62) });
    zona = { izq: izq - 8, der: innerWidth - der + 8, arriba: 50, abajo: innerHeight - (tj.hidden ? 70 : abajo) };
  }
}
addEventListener('resize', encuadrar);

// ───────────────────────── Arranque ─────────────────────────
// Enlaces directos (también sirven para capturas): ?escenario=sinchiller · ?vista=entradas · ?etapa=dewpoint · ?equipo=V-310 · ?color=temperatura · ?guia=0
const URLP = new URLSearchParams(location.search);
const escURL = ESCENARIOS.find((s) => s.id === URLP.get('escenario'));
if (escURL) {
  entradas = { ...entradasPorDefecto(), ...JSON.parse(JSON.stringify(escURL.cambios)) };
  escenarioActivo = escURL.id;
}
if (URLP.get('vista') && movil()) vista = URLP.get('vista')!;
document.body.dataset.v = vista;
pintarEscenarios();
pintarEntradas();
engancharEntradas();
recalcular(true);

window.PLANT = planta;
addEventListener('escena-lista', () => {
  const esc = window.__escena;
  esc.onPick = (tag) => (tag ? abrirEquipo(tag) : null);
  esc.onFrame = moverEtiquetas;
  esc.setLabels(false);
  encuadrar();
  if (resultado) pintarResultado(null);
  $('cargando').classList.add('fuera');
  setTimeout(() => $('cargando').remove(), 600);
  if (!guardar('sinu9-sim-guia') && URLP.get('guia') !== '0') $('guia').hidden = false;
  if (URLP.get('color') === 'temperatura') ($('modoColor').querySelector('[data-m=temperatura]') as HTMLElement).click();
  const abrir = () => {
    if (!resultado) return setTimeout(abrir, 100);
    if (URLP.get('etapa')) abrirEtapa(URLP.get('etapa')!);
    else if (URLP.get('equipo')) abrirEquipo(URLP.get('equipo')!);
    else if (vista === 'proceso') abrirEtapa('entrada');
  };
  abrir();
});
import('../escena3d/escena.js');
