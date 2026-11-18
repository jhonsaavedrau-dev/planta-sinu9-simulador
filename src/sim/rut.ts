/**
 * Especificaciones de calidad del gas natural para el Sistema Nacional de Transporte de Colombia
 * (Reglamento Único de Transporte, RUT: Res. CREG 071 de 1999 y sus modificaciones).
 * Valores de referencia: hay que confirmarlos con la edición vigente antes de usarlos en un documento oficial.
 */

export interface Especificacion {
  id: string;
  nombre: string;
  corto: string;
  valor: number | boolean;
  unidad: string;
  limite: string;
  /** mínimo y máximo para dibujar la barra (null = sin límite por ese lado) */
  min: number | null;
  max: number | null;
  cumple: boolean;
  /** Qué significa y por qué importa */
  porQue: string;
  /** Qué mover en la planta si falla (o qué la mantiene en especificación) */
  palanca: string;
}

export interface CalidadVenta {
  pcb: number; // BTU/pie³
  rocioHC: number; // °F
  agua: number; // lb/MMscf
  co2: number; // % mol
  n2: number;
  o2: number;
  h2s: number; // mg/m³
  azufre: number; // mg/m³
  temperatura: number; // °F
  liquidosLibres: boolean;
}

export const LIMITES = {
  pcbMin: 950,
  pcbMax: 1150,
  rocioHC: 45,
  agua: 6,
  co2: 2,
  n2: 3,
  inertes: 5,
  o2: 0.1,
  h2s: 6,
  azufre: 23,
  temperatura: 120,
};

export function evaluarRUT(c: CalidadVenta): Especificacion[] {
  const L = LIMITES;
  const inertes = c.co2 + c.n2 + c.o2;
  return [
    {
      id: 'agua',
      nombre: 'Contenido de agua',
      corto: 'agua',
      valor: c.agua,
      unidad: 'lb/MMscf',
      limite: `≤ ${L.agua} lb/MMscf (97 mg/m³)`,
      min: null,
      max: L.agua,
      cumple: c.agua <= L.agua,
      porQue: 'Con agua en el gasoducto se forman hidratos (hielo de gas) que tapan la tubería, y el agua con CO₂ corroe el acero.',
      palanca: 'Lo controlan las torres de TEG: más temperatura en el rehervidor (más pureza), gas de despojamiento, más circulación de glicol, las dos torres en servicio o gas de entrada más frío.',
    },
    {
      id: 'rocio',
      nombre: 'Punto de rocío de hidrocarburos',
      corto: 'rocío de HC',
      valor: c.rocioHC,
      unidad: '°F',
      limite: `≤ ${L.rocioHC} °F (7,2 °C)`,
      min: null,
      max: L.rocioHC,
      cumple: c.rocioHC <= L.rocioHC,
      porQue: 'Es la temperatura a la que el gas empieza a soltar líquido. Si es alta, en el gasoducto se condensan hidrocarburos pesados que llegan como líquido a los clientes.',
      palanca: 'Lo controla el patín de dew point: bajar la temperatura del separador frío V-310 condensa más pesados y baja el rocío del gas de venta.',
    },
    {
      id: 'pcb',
      nombre: 'Poder calorífico bruto',
      corto: 'poder calorífico',
      valor: c.pcb,
      unidad: 'BTU/pie³',
      limite: `${L.pcbMin}–${L.pcbMax} BTU/pie³ (35,4–42,8 MJ/m³)`,
      min: L.pcbMin,
      max: L.pcbMax,
      cumple: c.pcb >= L.pcbMin && c.pcb <= L.pcbMax,
      porQue: 'Es la energía que trae cada pie cúbico. Los quemadores de los clientes están ajustados a ese rango.',
      palanca: 'Depende sobre todo de la composición del gas de pozo. Los inertes (N₂, CO₂) lo bajan; quitar mucho propano y butano en el dew point también lo baja un poco.',
    },
    {
      id: 'co2',
      nombre: 'Dióxido de carbono (CO₂)',
      corto: 'CO₂',
      valor: c.co2,
      unidad: '% vol',
      limite: `≤ ${L.co2} %`,
      min: null,
      max: L.co2,
      cumple: c.co2 <= L.co2,
      porQue: 'Con agua forma ácido carbónico que corroe la tubería y además no aporta energía.',
      palanca: 'SINÚ 9 no tiene unidad de endulzamiento: el CO₂ pasa tal como viene del pozo.',
    },
    {
      id: 'n2',
      nombre: 'Nitrógeno (N₂)',
      corto: 'N₂',
      valor: c.n2,
      unidad: '% vol',
      limite: `≤ ${L.n2} %`,
      min: null,
      max: L.n2,
      cumple: c.n2 <= L.n2,
      porQue: 'Es un gas inerte: ocupa espacio en el gasoducto sin aportar energía.',
      palanca: 'Pasa sin cambio desde el pozo; la planta no lo quita.',
    },
    {
      id: 'inertes',
      nombre: 'Inertes totales (N₂ + CO₂ + O₂)',
      corto: 'inertes',
      valor: inertes,
      unidad: '% vol',
      limite: `≤ ${L.inertes} %`,
      min: null,
      max: L.inertes,
      cumple: inertes <= L.inertes,
      porQue: 'La suma de lo que no se quema. Mucho inerte baja el poder calorífico.',
      palanca: 'Depende del pozo.',
    },
    {
      id: 'o2',
      nombre: 'Oxígeno (O₂)',
      corto: 'O₂',
      valor: c.o2,
      unidad: '% vol',
      limite: `≤ ${L.o2} %`,
      min: null,
      max: L.o2,
      cumple: c.o2 <= L.o2,
      porQue: 'El oxígeno acelera la corrosión y degrada el glicol. Si aparece, suele ser por entrada de aire en succiones con vacío.',
      palanca: 'Revisar entradas de aire en líneas de baja presión.',
    },
    {
      id: 'h2s',
      nombre: 'Ácido sulfhídrico (H₂S)',
      corto: 'H₂S',
      valor: c.h2s,
      unidad: 'mg/m³',
      limite: `≤ ${L.h2s} mg/m³`,
      min: null,
      max: L.h2s,
      cumple: c.h2s <= L.h2s,
      porQue: 'Es tóxico (letal en pocos cientos de ppm) y corrosivo.',
      palanca: 'SINÚ 9 no tiene endulzamiento: si el pozo trae H₂S habría que usar secuestrante (triazina).',
    },
    {
      id: 'azufre',
      nombre: 'Azufre total',
      corto: 'azufre',
      valor: c.azufre,
      unidad: 'mg/m³',
      limite: `≤ ${L.azufre} mg/m³`,
      min: null,
      max: L.azufre,
      cumple: c.azufre <= L.azufre,
      porQue: 'Al quemarse produce SO₂ (lluvia ácida) y daña catalizadores de los clientes.',
      palanca: 'Se estima solo con el H₂S digitado (sin mercaptanos).',
    },
    {
      id: 'temperatura',
      nombre: 'Temperatura de entrega',
      corto: 'temperatura',
      valor: c.temperatura,
      unidad: '°F',
      limite: `≤ ${L.temperatura} °F (49 °C)`,
      min: null,
      max: L.temperatura,
      cumple: c.temperatura <= L.temperatura,
      porQue: 'El gas muy caliente daña el revestimiento del gasoducto y altera la medición.',
      palanca: 'La fija el enfriador del motocompresor (aeroenfriador); con más ambiente, más caliente sale.',
    },
    {
      id: 'liquidos',
      nombre: 'Libre de líquidos',
      corto: 'líquidos libres',
      valor: !c.liquidosLibres,
      unidad: '',
      limite: 'Sin agua ni hidrocarburos líquidos',
      min: null,
      max: null,
      cumple: !c.liquidosLibres,
      porQue: 'El gas debe entregarse 100 % en fase gas a la presión y temperatura de entrega.',
      palanca: 'Se cumple si el gas sale más caliente que sus puntos de rocío de agua y de hidrocarburos.',
    },
  ];
}
