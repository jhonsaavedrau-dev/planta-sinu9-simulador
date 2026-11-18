import { COMPOSICION_SINU9, type Entradas } from '../sim/planta';

export type ClaveEntrada = Exclude<keyof Entradas, 'composicion'>;

export interface Control {
  id: ClaveEntrada;
  etiqueta: string;
  tipo: 'rango' | 'interruptor' | 'opciones';
  unidad?: string;
  min?: number;
  max?: number;
  paso?: number;
  decimales?: number;
  opciones?: { valor: number; etiqueta: string }[];
  ayuda: string;
  /** solo se muestra si esta condición se cumple */
  si?: (e: Entradas) => boolean;
  avanzado?: boolean;
}

export interface Seccion {
  id: string;
  titulo: string;
  sub: string;
  paso: number;
  controles: Control[];
}

export const SECCIONES: Seccion[] = [
  {
    id: 'entrada',
    titulo: 'Gas de entrada',
    sub: 'Lo que llega de los pozos',
    paso: 1,
    controles: [
      { id: 'caudal', etiqueta: 'Caudal', tipo: 'rango', unidad: 'MMSCFD', min: 2, max: 20, paso: 0.1, decimales: 1, ayuda: 'Millones de pies cúbicos estándar por día que entran a la planta. SINÚ 9 trabaja alrededor de 10.' },
      { id: 'presion', etiqueta: 'Presión', tipo: 'rango', unidad: 'psig', min: 300, max: 900, paso: 5, decimales: 0, ayuda: 'Presión con la que llega el gas al separador de entrada V-101. Normal: 450–500 psig.' },
      { id: 'temperatura', etiqueta: 'Temperatura', tipo: 'rango', unidad: '°F', min: 60, max: 130, paso: 1, decimales: 0, ayuda: 'Más caliente = más agua en el gas y más trabajo para el glicol. Normal: 95–97 °F.' },
      { id: 'aguaSaturado', etiqueta: 'El gas viene saturado de agua', tipo: 'interruptor', ayuda: 'El gas de pozo casi siempre sale saturado: trae toda el agua que puede cargar a esa presión y temperatura.' },
      { id: 'aguaValor', etiqueta: 'Agua en el gas', tipo: 'rango', unidad: 'lb/MMscf', min: 5, max: 200, paso: 1, decimales: 0, ayuda: 'Libras de agua por millón de pies cúbicos, si se conoce por análisis.', si: (e) => !e.aguaSaturado },
      { id: 'h2s', etiqueta: 'H₂S', tipo: 'rango', unidad: 'ppmv', min: 0, max: 20, paso: 0.5, decimales: 1, ayuda: 'Ácido sulfhídrico en el gas de pozo. La planta no lo quita.', avanzado: true },
    ],
  },
  {
    id: 'deshidratacion',
    titulo: 'Deshidratación con TEG',
    sub: 'Torres TC-201 / TC-202 y regeneradora GRU-210',
    paso: 2,
    controles: [
      { id: 'torres', etiqueta: 'Torres en servicio', tipo: 'opciones', opciones: [{ valor: 0, etiqueta: 'Ninguna' }, { valor: 1, etiqueta: 'Una' }, { valor: 2, etiqueta: 'Las dos' }], ayuda: 'Cada torre maneja unos 8 MMSCFD. Con 10 MMSCFD hacen falta las dos.' },
      { id: 'tRehervidor', etiqueta: 'Temperatura del rehervidor', tipo: 'rango', unidad: '°F', min: 320, max: 404, paso: 1, decimales: 0, ayuda: 'Más caliente = el glicol sale más puro y seca más. El TEG se degrada cerca de 404 °F. Normal: 350–375 °F.', si: (e) => e.torres > 0 },
      { id: 'gasDespojo', etiqueta: 'Gas de despojamiento', tipo: 'interruptor', ayuda: 'Un poco de gas seco que se pasa por el glicol caliente para arrastrar el agua que queda. Sube la pureza a 99,4 % o más.', si: (e) => e.torres > 0 },
      { id: 'circulacion', etiqueta: 'Circulación de glicol', tipo: 'rango', unidad: 'gal/lb agua', min: 1.5, max: 6, paso: 0.1, decimales: 1, ayuda: 'Galones de TEG por cada libra de agua que trae el gas. Lo normal es 3–4. Más glicol seca más, pero carga más el rehervidor.', si: (e) => e.torres > 0 },
    ],
  },
  {
    id: 'dewpoint',
    titulo: 'Control de punto de rocío',
    sub: 'Patín SK-300: E-301, E-302, chiller UE-101 y V-310',
    paso: 3,
    controles: [
      { id: 'chiller', etiqueta: 'Chiller UE-101 en servicio', tipo: 'interruptor', ayuda: 'Enfría el agua-MEG que a su vez enfría el gas en E-302. Sin chiller el gas no se enfría y los pesados siguen al gasoducto.' },
      { id: 'tFrio', etiqueta: 'Temperatura del separador frío', tipo: 'rango', unidad: '°F', min: 15, max: 70, paso: 1, decimales: 0, ayuda: 'A qué temperatura sale el gas de E-302 hacia V-310. Más frío = se condensan más pesados y baja el punto de rocío del gas de venta.', si: (e) => e.chiller },
      { id: 'aproximacion', etiqueta: 'Aproximación de E-301', tipo: 'rango', unidad: '°F', min: 5, max: 30, paso: 1, decimales: 0, ayuda: 'Diferencia mínima de temperatura en el intercambiador gas-gas. Más pequeña = más calor recuperado y menos trabajo del chiller.', si: (e) => e.chiller, avanzado: true },
    ],
  },
  {
    id: 'compresion',
    titulo: 'Compresión y venta',
    sub: 'Motocompresores C-401 / C-402 y gas combustible',
    paso: 4,
    controles: [
      { id: 'compresores', etiqueta: 'Compresores en servicio', tipo: 'opciones', opciones: [{ valor: 1, etiqueta: 'Uno' }, { valor: 2, etiqueta: 'Dos' }], ayuda: 'Cada motocompresor Ariel-CAT mueve hasta 15 MMSCFD con 500 psig de succión y 1200 de descarga.' },
      { id: 'pDescarga', etiqueta: 'Presión de entrega', tipo: 'rango', unidad: 'psig', min: 600, max: 1300, paso: 10, decimales: 0, ayuda: 'Presión a la que se entrega al gasoducto hacia Jobo. El límite de los compresores es 1200 psig.' },
      { id: 'tEnfriador', etiqueta: 'Temperatura después del enfriador', tipo: 'rango', unidad: '°F', min: 95, max: 160, paso: 1, decimales: 0, ayuda: 'El aeroenfriador del compresor baja el gas caliente de la descarga. El RUT pide máximo 120 °F.' },
      { id: 'combustible', etiqueta: 'Gas combustible', tipo: 'rango', unidad: 'MMSCFD', min: 0, max: 1, paso: 0.01, decimales: 2, ayuda: 'Gas que se queda en la planta para los motores de los compresores y el generador Waukesha.' },
      { id: 'eficiencia', etiqueta: 'Eficiencia del compresor', tipo: 'rango', unidad: '%', min: 60, max: 92, paso: 1, decimales: 0, ayuda: 'Eficiencia adiabática. Un compresor reciprocante en buen estado está en 80–88 %.', avanzado: true },
      { id: 'tAmbiente', etiqueta: 'Temperatura ambiente', tipo: 'rango', unidad: '°F', min: 70, max: 105, paso: 1, decimales: 0, ayuda: 'Con más calor afuera, el aeroenfriador deja el gas más caliente.', avanzado: true },
    ],
  },
];

export const PRESETS_COMPOSICION: { id: string; nombre: string; comp: Record<string, number> }[] = [
  { id: 'sinu9', nombre: 'SINÚ 9 (estimada)', comp: COMPOSICION_SINU9 },
  { id: 'rico', nombre: 'Gas más rico', comp: { C1: 92.4, C2: 3.5, C3: 1.6, iC4: 0.35, nC4: 0.45, iC5: 0.2, nC5: 0.15, nC6: 0.15, nC7: 0.12, nC8: 0.08, N2: 0.6, CO2: 0.4, O2: 0 } },
  { id: 'pobre', nombre: 'Gas muy pobre', comp: { C1: 98.2, C2: 0.7, C3: 0.15, iC4: 0.04, nC4: 0.04, iC5: 0.02, nC5: 0.02, nC6: 0.02, nC7: 0.01, nC8: 0, N2: 0.6, CO2: 0.2, O2: 0 } },
  { id: 'inertes', nombre: 'Con mucho CO₂ y N₂', comp: { C1: 93.0, C2: 1.0, C3: 0.3, iC4: 0.09, nC4: 0.08, iC5: 0.05, nC5: 0.04, nC6: 0.07, nC7: 0.06, nC8: 0.04, N2: 3.0, CO2: 2.27, O2: 0 } },
];

export interface Escenario {
  id: string;
  nombre: string;
  descripcion: string;
  cambios: Partial<Entradas>;
}

export const ESCENARIOS: Escenario[] = [
  { id: 'normal', nombre: 'Operación normal', descripcion: 'La planta como trabaja hoy', cambios: {} },
  { id: 'caliente', nombre: 'Gas caliente', descripcion: 'Llega a 112 °F: trae más agua', cambios: { temperatura: 112 } },
  { id: 'unatorre', nombre: 'Una sola torre', descripcion: 'TC-202 en mantenimiento', cambios: { torres: 1 } },
  { id: 'sindespojo', nombre: 'Sin gas de despojo', descripcion: 'El TEG sale menos puro', cambios: { gasDespojo: false } },
  { id: 'sinchiller', nombre: 'Chiller apagado', descripcion: 'Sin control de rocío', cambios: { chiller: false } },
  { id: 'masgas', nombre: 'Más gas', descripcion: '14 MMSCFD con un compresor', cambios: { caudal: 14 } },
  { id: 'rico', nombre: 'Gas más rico', descripcion: 'Más propano y pesados', cambios: { composicion: { ...PRESETS_COMPOSICION[1].comp } } },
];
