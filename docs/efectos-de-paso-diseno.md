# Efectos de paso — lo que un paso le HACE al trabajo

**Estado: DISEÑO CERRADO** (2026-08-07) — listo para implementar F1. Convierte lo que hoy es exclusivo de la
familia `modificacion_pre` (agrandar la medida) en un **eje que cualquier
paso puede declarar**.

## 1. La decisión en una frase

Un paso de producción no sólo consume tiempo y materiales: a veces **le exige
algo al trabajo** — "para tensar esta lona necesito 100 mm más por lado". Eso
deja de ser una familia-artefacto y pasa a ser un **efecto declarado por el
paso real**, configurable en la ruta.

## 2. El diagnóstico: dos pasos para un solo hecho físico

La ruta del Cartel Backlight en dev, hoy:

| # | Familia | Nombre | ¿Es un trabajo? |
|---|---|---|---|
| 4 | `modificacion_pre` | **Demasía de tensado** (100 mm × 4 lados) | ❌ Nadie "hace" una demasía |
| 8 | `trabajo_manual` | **Tensado de lona** | ✅ El trabajo real (tiempo, tornillos) |

El paso 4 no existe en el taller: es un artefacto para que la lona se imprima
más grande. El hecho físico es uno solo — *tensar la lona exige material de
sobra* — y el modelo lo parte en dos.

**El costo real de esa partición**: los dos pasos son independientes, así que
nada impide activar "Tensado de lona" sin "Demasía de tensado". La lona sale
100 mm chica por lado y el trabajo se arruina — y el sistema **no puede
detectarlo**, porque no sabe que están relacionados.

## 3. Lo que YA existe (y por eso esto es más chico de lo que parece)

Al leer el motor aparecieron dos cosas que cambian el tamaño del trabajo:

### 3.1 El efecto ya es configurable POR PASO, no por familia

`parsearParamsModificacionPre` lee `lados`, `demasiaMm` y `subTipo` del
**`paramsPasoJson` del paso en la ruta**. O sea: la configuración del efecto
ya vive en el paso. Lo único que lo ata a una familia es el gate de la
pre-pasada:

```ts
if (!familiaMutaMedidasEnPrePasada(paso.familiaCodigo)) continue;  // ← esto
```

**El mecanismo ya es genérico; falta abrir la puerta.**

### 3.2 La acumulación ya está resuelta: SUMAN

`aplicarMutacionPre` escribe sobre `pieza.anchoMm`, que puede venir ya mutado
por otro paso PRE. Dos pasos con efecto sobre el mismo lado suman sus
milímetros — que es lo físicamente correcto (necesitás material para ambas
cosas). Matiz 3 de la charla: **cerrado, sin trabajo**.

## 4. El hallazgo de diseño: separar el EFECTO del PASO

Hoy `modificacion_pre` mezcla dos cosas: **es** la mutación *y* es un paso con
tiempo. Por eso arrastra restricciones duras (`validacion-pre-pasada.ts`): no
puede heredar outputs canónicos ni condicionar sobre ellos, porque corre antes
del bucle.

Si abrimos el efecto a cualquier paso, hay que **separarlos**:

```
PRE-PASADA (antes del bucle)     BUCLE (en su orden real)
─────────────────────────        ─────────────────────────
Recoge los EFECTOS de los        Cada paso corre normal:
pasos activos y los aplica       su tiempo, sus materiales,
sobre la medida.                 su cantidad (puede heredar
                                 outputs sin problema).
```

Con eso, "Tensado de lona" declara su efecto **y sigue siendo un paso normal**
que corre al final de la ruta, con su productividad y sus tornillos.

**La restricción que sí sobrevive**: para aplicar el efecto hay que saber si
el paso está activo, y eso se evalúa en la pre-pasada. Entonces **un paso con
efecto de medida no puede tener activación CONDICIONAL que dependa de outputs
canónicos** (no existen todavía). Es la misma regla de hoy, pero acotada al
efecto en vez de a la familia entera — y `validacion-pre-pasada.ts` ya la
sabe validar.

## 5. Qué NO es este eje

**La demasía del acomodado no es esto.** En la card "Acomodado / nesting", la
*Demasía por lado* (típico: 2,5 mm) es **sangrado de corte**: agranda la pieza
*para el acomodo*, para que el refile no deje borde blanco. Afecta cuánto
material se consume.

El efecto de tensado son **100 mm** que agrandan la **medida del trabajo**: lo
tiene que ver todo lo que viene después — el m² impreso, el tiempo de
impresión, la tinta. Si se modelara con el campo del nesting, el costo de
impresión saldría corto.

Son campos distintos, con magnitudes distintas, por razones distintas.
**No se unifican.**

## 6. El eje

```ts
// En el paso de la ruta (paramsPasoJson), no en la familia:
efectos?: {
  /** Agranda la medida del trabajo antes de que nadie la lea. */
  demasiaMedida?: {
    lados: ('superior' | 'inferior' | 'izquierdo' | 'derecho')[];
    mm: number;
  };
};
```

Y en la **ficha de la familia**, un eje que declara qué efectos *puede* llevar
un paso de esa familia — para que el editor ofrezca la card sólo donde tiene
sentido, sin volver a atar el comportamiento al nombre:

```ts
efectosSoportados?: Array<'demasiaMedida'>;
```

`trabajo_manual` lo declararía (es la familia de tensado, refuerzo y bolsillo);
`impresion_por_hoja` no.

**Sin preset** (decisión Lucas, 2026-08-07). El `subTipo: bolsillo | refuerzo`
de hoy era un sustituto pobre: existía porque el tenant no tenía forma de
tener dos pasos manuales distintos. Con los pasos del tenant por plantilla
([pasos-tenant-por-plantilla-diseno.md](pasos-tenant-por-plantilla-diseno.md),
implementado el mismo día) eso ya no hace falta: "Bolsillo" y "Refuerzo" son
**dos instancias** de `trabajo_manual`, cada una con su nombre, sus lados,
sus milímetros y sus materiales, configuradas en la ruta de cada producto.
Un campo menos en el eje, y el paso se llama como se llama en el taller.

## 7. Decisiones a cerrar (los matices de la charla)

| # | Matiz | Estado |
|---|---|---|
| 1 | Demasía de nesting ≠ demasía de medida | **Cerrado** (§5): son cosas distintas, no se unifican |
| 2 | El efecto es POR LADO | **Cerrado**: el eje lo declara así, igual que hoy |
| 3 | Acumulación entre pasos | **Cerrado** (§3.2): suman, ya funciona así |
| 4 | El orden (efecto anterior al paso) | **Cerrado**: la pre-pasada se mantiene, es el mecanismo correcto |
| 5 | Cómo cuenta su tiempo el paso que hereda el efecto | **Cerrado** (Lucas): perímetro de los **lados afectados**, sobre la medida **VISIBLE** |

### El punto abierto: el tiempo de la costura

Hoy `modificacion_pre` calcula su cantidad con la primitiva
`ml_union_visible`: los metros lineales de costura sobre la medida **visible**
(la costura corre por el borde terminado, no crece con la demasía — es la
"regla de oro" del doc de modificaciones físicas).

Si el efecto se muda a "Tensado de lona" (`trabajo_manual`), ese paso necesita
contar sus metros. Tres caminos:

- **(a)** `trabajo_manual` declara la primitiva `ml_union_visible` y la usa
  cuando el paso tiene efecto de demasía configurado.
- **(b)** El paso usa la fuente de cantidad `perimetro_piezas_m`, que ya
  existe — pero mide el perímetro **completo**, y una costura puede ir sólo
  en dos lados.
- **(c)** Una fuente de cantidad nueva, "perímetro de los lados afectados",
  derivada del propio efecto declarado.

**DECISIÓN (Lucas, 2026-08-07): opción (c)** — perímetro de los lados que el
efecto declara afectados, medido sobre la **medida VISIBLE**. Con la lona de
2 × 1 m y 100 mm por lado: tensado en los 4 lados = **6,00 m** (no 6,80 de la
lona agrandada); un bolsillo arriba y abajo = 4,00 m.

**Hallazgo del relevamiento**: hoy "Tensado de lona" cuenta
`perimetro_piezas_m`, que se calcula DESPUÉS de la pre-pasada — o sea sobre la
lona ya agrandada: 6,80 m en vez de 6,00. Un 13 % de más, y contradice la
regla de oro. La fusión lo corrige de paso.

## 8. Migración

- La ruta del Backlight pierde el paso 4: "Tensado de lona" (paso 8) hereda
  el efecto con sus 100 mm × 4 lados. **La cotización debe dar idéntica** —
  golden master como juez.
- **`modificacion_pre` SE PODA del catálogo** (decisión Lucas). La absorbe
  `trabajo_manual` + efecto, y la comparación de fichas muestra que sale
  ganando:

  | | `modificacion_pre` | `trabajo_manual` |
  |---|---|---|
  | Slots de material | **ninguno** — no se puede cargar el hilo ni los tornillos | `insumo_manual` |
  | Mecanismos | CALCULADO, DIRECT | DIRECT, HEREDAR, CONVERSION |

  Lo único que tenía de más era `CALCULADO_POR_PASO` para su primitiva de
  metros; con la fuente de cantidad de §7 ya no hace falta (es un T-2 normal).
  No queda ningún caso donde sea insustituible: una lona que sólo se refuerza
  es un `trabajo_manual` llamado "Dobladillo perimetral" con su efecto.

  **Se poda al FINAL** (F4), después de migrar sus dos pasos en dev (el
  backlight y el Frontlight, que la tiene sin configurar): podarla antes deja
  esos pasos sin resolver. Hay precedente del procedimiento en la poda de las
  9 familias de 2026-08.

  El **preset no se preserva** (decisión Lucas): `subTipo` desaparece — lo
  reemplazan pasos del tenant con nombre propio. Sí queda por revisar quién
  hereda sus **outputs** (`metros_lineales_union`, `mutacion_aplicada`) antes
  de podarla.
- `mutaMedidasEnPrePasada` de la ficha se reemplaza por `efectosSoportados`.

## 9. Plan por etapas (protocolo golden en cada una)

- **F1** — el eje: `efectos` en el paso + `efectosSoportados` en la ficha; la
  pre-pasada recoge efectos en vez de familias. Sin cambiar ninguna ruta:
  `modificacion_pre` declara el efecto y todo sigue igual.
- **F2** — el editor: card "¿Este paso le exige algo al trabajo?" en los pasos
  cuya familia lo soporte, con lados + mm.
- **F3** — el tiempo: resolver el punto abierto §7 y darle al paso su magnitud.
- **F4** — migración y poda: la ruta del Backlight pasa a 8 pasos ("Tensado
  de lona" absorbe el efecto y sus 100 mm × 4 lados); el Frontlight suelta su
  paso sin configurar; y recién ahí `modificacion_pre` sale del catálogo.
  Golden master idéntico como juez de toda la migración.

## 10. Lo que queda por definir

1. **El nombre del eje**: dijiste "un paso *necesita* ciertos requerimientos".
   ¿`efectos` (lo que el paso le hace al trabajo) o `requerimientos` (lo que
   el paso necesita)? Me inclino por el primero porque describe la mecánica,
   pero el segundo describe mejor la intuición. **Sin definir** — el doc usa
   `efectos` provisoriamente.
2. ~~El punto abierto §7~~ **RESUELTO**: medida visible, lados afectados.
3. ~~El destino de `modificacion_pre`~~ **RESUELTO**: se poda en F4.
4. **¿Otros efectos** además de agrandar la medida? Se me ocurren: forzar un
   material, exigir doble faz, imponer un mínimo de cantidad. No se diseñan
   ahora — pero si alguno es real, conviene que el eje nazca con la forma
   correcta. **Sin definir.**
