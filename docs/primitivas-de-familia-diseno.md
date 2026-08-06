# Primitivas de familia — diseño del registro

**Estado: EN REVISIÓN** (2026-08-06). Cierra la etapa 4.d de
[ficha-familia-pasos.md](ficha-familia-pasos.md). Mismo patrón que
[derivadores-geometricos-diseno.md](derivadores-geometricos-diseno.md):
catálogo de funciones con nombre + la ficha declara cuáles usa.

## 1. La decisión en una frase

Los algoritmos que HOY son ramas `if familiaCodigo === X` dentro del motor
(el oficio propio de guillotina, impresión por hoja y modificación pre) se
mudan a un **catálogo de primitivas** con nombre, y la ficha de la familia
declara cuáles usa en un eje nuevo: `primitivas`. El motor pierde sus últimos
`if` por nombre; una familia nueva (una cizalla, otra digital de pliego)
hereda un oficio existente declarándolo.

## 2. Qué es una primitiva (y qué no)

- Un **derivador** calcula geometría de la pieza (ml de perfil, módulos).
- Una **estrategia de nesting** acomoda piezas en un material.
- Una **primitiva** es cualquier otro algoritmo propio del oficio de una
  familia, enganchado en un punto específico del motor: cómo calcula su
  tiempo, cómo elige perfil, cómo cuenta desgaste, cómo convierte su consumo
  en compra.

Lo declarativo es **el puntero** (`primitivas.tiempoRun: 'guillotina_por_cortes'`),
no el algoritmo: el código se muda intacto de `motor.service.ts` a
`motor-universal/primitivas/`, con los goldens como juez de que nada se movió.

## 3. El eje en la ficha

```ts
// DefinicionFamilia
primitivas?: {
  /** T-3: el run NO sale de productividad×cantidad sino de un cálculo
   *  propio. null del registro → sigue la vía genérica. */
  tiempoRun?: string;                // 'guillotina_por_cortes'
  /** CALCULADO_POR_PASO sin nesting ni derivador: cantidad propia. */
  cantidadPropia?: string;           // 'ml_union_visible'
  /** Multiplicador de la velocidad del perfil según el trabajo (PPM). */
  factorVelocidad?: string;          // 'a4_equivalente'
  /** Unidades de desgaste (clicks) que el paso consume de la máquina. */
  desgaste?: string;                 // 'clicks_a4'
  /** Consumo del slot → unidades de COMPRA del material. */
  compraSustrato?: string;           // 'pliegos_a_hojas'
  /** Selección de perfil cuando hay varios candidatos. Corre DESPUÉS del
   *  filtro genérico de modo color (ese es del motor, no de la familia). */
  seleccionPerfil?: string;          // 'cadena_caras_gramaje' | 'escalon_gramaje'
  /** Diagnósticos propios (warnings que no cortan). */
  avisos?: string[];                 // ['perfil_doble_faz']
};
```

Reglas del eje:
- Cada campo apunta a un **registro tipado por gancho** en
  `apps/api/src/motor-universal/primitivas/` (un archivo `tipos.ts` con el
  contrato de cada gancho + `index.ts` con los registros, como derivadores).
- Sin declaración → el motor sigue su vía genérica (idéntico a hoy).
- Nombre desconocido → se ignora con warning en dev (no rompe cotización).

## 4. Contratos por gancho (lo que existe HOY, mudado tal cual)

Las primitivas son funciones puras salvo por `deps`: un objeto que el motor
arma con los callbacks que hoy usan como métodos privados (así la primitiva
no conoce el motor entero, sólo lo que pide su contrato).

### 4.1 `tiempoRun` — `guillotina_por_cortes` (motor ~2871)
```
(paso, jobContext, deps: { resolverCantidad }) → runMin: number
```
Lee del perfil `pliegosMaxPorTanda`, `tiempoPorCorteSeg` (con respaldo en la
máquina), `feedReloadMin`; del JobContext `cortes_calculados` (publicado por
el plan de corte). tandas = ⌈pliegos/máxPorTanda⌉; run = tandas × cortes ×
seg/60 + recargas. Declara: `corte_guillotina`.

### 4.2 `cantidadPropia` — `ml_union_visible` (motor ~5485)
```
(paso, jobContext, deps: { paramsEfectivos }) → number | null
```
Metros lineales de unión sobre la medida VISIBLE (la costura corre por el
borde terminado, no crece con demasía). Ya vive en helpers puros
(`parsearParamsModificacionPre` + `calcularMetrosLinealesUnion`) — la
primitiva sólo los envuelve. Declara: `modificacion_pre`.

### 4.3 `factorVelocidad` — `a4_equivalente` (motor ~5944)
```
(paso, jobContext, nestingDispatch) → factor: number   // ≥ 1
```
Área del pliego ÷ área A4 (mín. 1): una SRA3 cuenta ~2 páginas A4 de PPM.
Declara: `impresion_por_hoja`. Nota: la memoria del factor PPM ya anticipa
una futura variante "por recorrido" — con este eje, esa variante es una
primitiva nueva que se declara, no un if.

### 4.4 `desgaste` — `clicks_a4` (motor ~4362)
```
(paso, jobContext, nestingDispatch,
 deps: { resolverCantidad, carasConsumible, factorVelocidad }) → clicks: number
```
⌈pliegos⌉ × caras × ⌈factor A4⌉. Hoy el gate es "familia === hoja"; pasa a
"familia declara desgaste". Sin declarar → los componentes de desgaste de la
máquina no clickean (igual que hoy para el resto). Declara: `impresion_por_hoja`.

### 4.5 `compraSustrato` — `pliegos_a_hojas` (motor ~4125)
```
(cantidadPliegos, slotCodigo, paso, jobContext, nestingDispatch,
 materialResuelto) → cantidadCompra: number
```
Sólo actúa sobre `sustrato_principal` cuando la variante se stockea en HOJA:
convierte pliegos de impresión en hojas de compra vía el tamaño real del
pliego del nesting. Declara: `impresion_por_hoja`.

### 4.6 `seleccionPerfil` — dos primitivas (motor ~6327 y ~6392)
```
(paso, jobContext, candidatos: Perfil[],
 deps: { carasEfectivas, numeroPositivo }) → Perfil | null
```
- `cadena_caras_gramaje` (hoja): sobre los candidatos YA filtrados por modo
  color (filtro genérico del motor, no se toca), encadena caras → escalón de
  gramaje. **Cuidado de diseño**: hoy el bloque es
  `if (modoColor || esImpresionPorHoja)` — la parte modoColor es genérica y
  queda en el motor; la primitiva recibe el resultado y aplica SU cadena.
- `escalon_gramaje` (guillotina): elige el perfil cuyo escalón de gramaje
  cubre el papel (`elegirPorEscalonDeGramaje`, ya es un helper).
`null` → heurística genérica de siempre (primer candidato válido).

### 4.7 `avisos` — `perfil_doble_faz` (motor ~6457)
```
(paso, jobContext, perfilResuelto, errores: ErrorMotor[],
 deps: { carasEfectivas, perfilesCompatibles }) → void
```
El warning "vas a imprimir doble faz sin perfil DOBLE" (no corta, subestima
tiempo). Declara: `impresion_por_hoja`. (Corrección del censo: este sitio
figuraba como "publicación de outputs"; es un diagnóstico.)

## 5. Qué NO entra en este eje

- **El fallback m² crudos y el guard sin layout**: ya son declarativos
  (`fallbackSinLayout`, `guardSinLayout`, Tandas A/F2).
- **La conversión rollo m²↔ml del T-3** (motor ~2900): es genérica de
  cualquier nesting en rollo, no de una familia.
- **Centro de copiado** (4.e del doc madre) y **validaciones de params**
  (pendiente de 4.b): otros ejes, otros docs.

## 6. Plan por etapas (protocolo golden en cada una)

Cada etapa: baseline → mudar el algoritmo al catálogo + declarar → el motor
llama al registro → goldens idénticos (152 + 7) + jest sin regresiones.

- **P1 — andamiaje + los 2 simples**: `primitivas/tipos.ts` + `index.ts`;
  `tiempoRun: guillotina_por_cortes` y `cantidadPropia: ml_union_visible`.
  Riesgo bajo (helpers ya casi puros).
- **P2 — el clúster de hoja**: `factorVelocidad`, `desgaste`,
  `compraSustrato`. Comparten deps; salen juntos.
- **P3 — selección de perfil**: `cadena_caras_gramaje` + `escalon_gramaje`,
  con el split modoColor-genérico / cadena-propia. La más delicada (toca la
  resolución de perfil de TODAS las familias) — golden + jest de perfil.
- **P4 — avisos**: `perfil_doble_faz`. Trivial tras P3.
- **P5 — cierre**: censo final `familiaCodigo` en motor-universal = sólo
  autoría de datos y labels; actualizar ficha-familia-pasos.md (§2 tabla +
  §6 universo con la columna Primitivas) y el memory.

## 7. Criterio de éxito

`grep "familiaCodigo === '" apps/api/src/motor-universal/*.ts` devuelve CERO
ramas de comportamiento (sólo comentarios/labels si quedaran), y la tabla del
universo muestra el eje `primitivas` como una columna más: guillotina e
impresión por hoja dejan de ser especiales — son familias con más campos.
