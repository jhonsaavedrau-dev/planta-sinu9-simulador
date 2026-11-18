# Planta SINÚ 9 · Simulador de proceso

Plataforma para simular la planta de gas SINÚ 9 (Tren B) en 3D. Se ingresan los datos de entrada (caudal, presión, temperatura, composición, glicol, chiller, compresores), la planta se recalcula y muestra en el modelo 3D el estado de cada equipo, el valor clave encima de cada uno y una explicación de cada etapa. El gas de venta se compara con las 11 especificaciones del RUT.

Ver en línea: https://jhonsaavedrau-dev.github.io/planta-sinu9-simulador/

**Publicar de nuevo:** `npm run build`, y subir el contenido de `dist/` a la rama `gh-pages` (el build necesita la carpeta hermana `../simulacion-procesos`, por eso no se arma en GitHub).

```
npm install
npm run dev      # http://localhost:4830
npm test         # 18 pruebas: correlaciones contra el GPSA y comportamiento de la planta
npm run build    # dist/ (sitio estático, se publica tal cual)
```

## Cómo calcula

| Parte | Método | Archivo |
|---|---|---|
| Hidrocarburos: flash, intercambiadores, compresor, separador frío, punto de rocío (cricondenterma) | Peng-Robinson del motor de `../simulacion-procesos/app/src` (validado contra `thermo` y NIST); se importa con el alias `@motor` | `src/sim/planta.ts` |
| Agua en el gas | Bukacek (carta McKetta-Wehe, GPSA fig. 20-4) | `src/sim/correlaciones.ts` |
| Contactoras de TEG | Kremser con 8 platos × 30 % ≈ 2,4 etapas, γ del agua calibrado con la fig. 20-68 del GPSA | `src/sim/correlaciones.ts` |
| Pureza del TEG | GPSA fig. 20-59 según la T del rehervidor, con o sin gas de despojamiento | `src/sim/correlaciones.ts` |
| Hidratos | Motiee (1991) | `src/sim/correlaciones.ts` |
| Poder calorífico | GPA 2145 / 2172 | `src/sim/correlaciones.ts` |
| Especificaciones RUT | Res. CREG 071/1999 (verificar edición vigente) | `src/sim/rut.ts` |

El cálculo corre en un Web Worker (`src/sim/calculo.worker.ts`) para que el 3D no se trabe.

**Datos de la planta** (de los instructivos y del modelo 3D): 10 MMSCFD, 450–500 psig, 95–97 °F; dos torres Valerus de 8 platos (≈ 8 MMSCFD c/u); rehervidor a 350–375 °F; motocompresores Ariel-CAT de 15 MMSCFD a 1200 psig con 500 de succión; gas combustible a 45–60 psig.
**Lo estimado:** la composición del gas (falta la cromatografía) y la presión de entrega (1100 psig).

## 3D

`src/escena3d/escena.js` es la escena del modelo 3D del 26-oct-2026 (`3 - PERSONAL/FAMILIA/PAPÁ - PLANTA DE GAS…/9 - MODELO 3D SINU 9/fuente/escena.js`) sin el recorrido ni el operador. La interfaz la maneja con `window.__escena`: `setEstado(tag, 'ok'|'aviso'|'falla'|'apagado')`, `setStreams`, `setColorMode('proceso'|'temperatura')`, `flyEq`, `flyMany`, `project`, `setInsets`.

## Enlaces directos

`?escenario=sinchiller` · `?etapa=dewpoint` · `?equipo=C-401` · `?color=temperatura` · `?vista=entradas` (celular) · `?guia=0`
