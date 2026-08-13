# Efectos entre pasos — modelo general (pre / post)

> **Estado: DOCUMENTO VIVO** (arrancado 2026-08-13). Un paso muchas veces
> **afecta** a otro: le exige una demasía, le publica una geometría, le fija la
> cantidad. Hoy eso vive en **tres mecanismos separados y cableados por caso**.
> Este cuaderno los unifica bajo un concepto: **un efecto entre pasos, con una
> dirección que el sistema resuelve por la posición en la ruta**. No hay código
> planificado todavía: primero se cierra el modelo.
>
> Hermanos: [estructura-bastidor-outputs-diseno.md](estructura-bastidor-outputs-diseno.md)
> (el disparador: la lona del bastidor) ·
> [modificaciones-fisicas-lona-diseno.md](modificaciones-fisicas-lona-diseno.md)
> (la "regla de oro" y la demasía de tensado) ·
> [derivadores-geometricos-diseno.md](derivadores-geometricos-diseno.md).

## 1. El problema — el mismo concepto, implementado tres veces

"Un paso emite algo que otro paso absorbe" hoy tiene **tres implementaciones
distintas**, cada una con su propia declaración:

| Hoy | Qué hace | Dónde |
|---|---|---|
| **`modificaciones-pre`** | un paso **crece las `piezas`** (demasía de tensado, ojal, refuerzo) antes de que otro las consuma | `motor-universal/modificaciones-pre.ts:105` (`aplicarMutacionPre`), declaración en `efectos-paso.ts:55` (`leerEfectoDemasia`, `efectos.demasiaMedida`) |
| **`publicaCanon`** | un derivador **publica geometría** al JobContext para que un paso posterior la lea | `productos-servicios/pasos/types.ts` (`derivador.publicaCanon`), `motor.service.ts` (`promoverCanonDerivador`) — recién hecho (Ola #2 del bastidor) |
| **`outputsCanonicos` / `HEREDAR_DEL_OUTPUT_CANONICO`** | un paso **publica una magnitud** que otro toma como su cantidad | `outputs-canonicos.ts:184`, declaración `familias.ts:outputsCanonicos[]` |

Son el **mismo concepto** —un paso EMISOR declara algo, un paso ABSORBEDOR lo
usa— resuelto tres veces. La consecuencia: cada caso nuevo elige a mano un
mecanismo, y la diferencia entre ellos parece de fondo cuando en realidad es
**sólo la dirección**.

## 2. La idea — un efecto con dirección, resuelta por la ruta

Un **efecto entre pasos** es: un paso EMISOR declara un efecto (una demasía, una
dimensión, una magnitud) que un paso ABSORBEDOR consume. La **dirección** la da
la **posición relativa en la ruta**:

- **Efecto POST (hacia adelante)** — el emisor está **antes** del absorbedor.
  Es **secuencial**: cuando el absorbedor corre, el efecto ya está publicado en
  el JobContext. No hace falta nada especial.
- **Efecto PRE (hacia atrás / retroactivo)** — el emisor está **después** del
  absorbedor. El absorbedor ya consumió lo compartido (las `piezas`), así que
  hay que **mutarlo en una pasada previa**.

> **Regla de oro del modelo:** declarar el efecto **lo más temprano posible**,
> por quien de verdad lo "posee". PRE es el **fallback** para cuando el dueño del
> requerimiento es genuinamente un paso posterior — no el mecanismo por defecto.

Esto explica el hallazgo que disparó el cuaderno (docs
estructura-bastidor §7.1): la demasía de la lona de un **backlight** hoy la
declara el paso **Tensado** (posterior a impresión) → por eso es PRE. Pero
**quien la exige es la estructura** (el bastidor, paso 1, ANTES de impresión):
declarada ahí, es un **efecto POST secuencial** y el PRE **desaparece**.

## 3. Las dos implementaciones — mismo concepto, distinta mecánica

La dirección no es sólo una etiqueta: cambia **cómo** se aplica el efecto.

| | POST (forward) | PRE (retroactivo) |
|---|---|---|
| Posición | emisor antes del absorbedor | emisor después del absorbedor |
| Mecánica | **publica una dimensión/magnitud** al JobContext; el absorbedor la lee | **muta las `piezas` compartidas** en una pre-pasada |
| Efecto colateral | ninguno: **no toca `piezas`** → el material crece **sólo donde se usa** (regla de oro) | agranda las `piezas` para todos los que las lean después |
| Ejemplo | bastidor → LED (interior), bastidor → impresión (lona bruta), pre-prensa → impresión | tensado → impresión, ojal → impresión, refuerzo → impresión |

**Matiz clave:** el POST es más limpio porque **no muta un estado compartido**.
La lona bruta del bastidor se publica como dimensión y **sólo** la impresión la
lee; las demás `piezas` siguen midiendo lo visible. El PRE **tiene** que mutar
`piezas` porque el absorbedor ya las consumió — no le queda otra.

## 4. Mapa: lo que existe hoy → al modelo

Nada se tira. Los tres mecanismos actuales son **instancias** del modelo:

- `modificaciones-pre` = **efecto PRE** (demasía retroactiva).
- `publicaCanon` = **efecto POST** de **geometría**.
- `outputsCanonicos` / `HEREDAR` = **efecto POST** de **magnitud** (alimenta la
  cantidad del absorbedor).

Es decir: **el "efecto post" ya existe** —es el canon + los outputs—. Lo que
falta **no** es inventar "post", sino:
1. **Unificar la declaración**: que cualquier familia declare sus efectos de
   forma uniforme (qué emite, sobre qué material/output, opcional el target),
   en vez de un `efectos.demasiaMedida` para tensado y un `publicaCanon` para
   bastidor.
2. **Resolver la dirección por posición**, no cablearla por caso: emisor antes
   del absorbedor → post; después → pre.

## 5. Casos de referencia

| Caso | Emisor | Absorbedor | Posición | Dirección | Mecanismo hoy |
|---|---|---|---|---|---|
| Interior para LED | bastidor (p1) | LED (p6) | antes | POST | `publicaCanon` ✅ hecho |
| Lona bruta (backlight) | bastidor (p1) | impresión (p4) | antes | **POST** | hoy PRE en Tensado (p7) ← a corregir |
| Cenefa/chapa a nestear | bastidor (p1) | cenefa (p8) / chapa (p5) | antes | POST | pendiente |
| Ojal en lona mesh | ojal | impresión | **después** | **PRE** | `modificaciones-pre` ✅ correcto |
| Refuerzo perimetral | refuerzo | impresión | después | PRE | `modificaciones-pre` ✅ correcto |
| Cantidad heredada (soldadura) | bastidor | soldadura | antes | POST | `outputsCanonicos` ✅ |

## 6. La declaración uniforme (boceto, a cerrar)

Una familia declararía sus efectos como **datos** (no un `if` ni un mecanismo
elegido a mano). Forma tentativa:

```
efectos: [
  { emite: 'demasia',   sobre: 'material', lados: [...], mm: <valor|deriva> },
  { emite: 'dimension', clave: 'lonaBrutaMm', desde: 'traza.lonaBruta' },
  { emite: 'magnitud',  output: 'puntos_soldadura', desde: 'puntosSoldadura' },
]
```

El motor, al correr el paso, para cada efecto:
- ubica al **absorbedor** (por material, por output canónico que consume, o por
  target explícito),
- compara posiciones → **post** (publica al JobContext) o **pre** (agenda la
  mutación),
- aplica la mecánica que corresponde (§3).

`demasiaAcumuladaPorLado` (`modificaciones-pre.ts:37`) ya prevé **varios
emisores del mismo efecto** (refuerzo + ojal) — el modelo lo conserva:
**acumulación** por lado, no "último gana".

## 7. Decisiones abiertas

- **¿"Efecto post" es un mecanismo nuevo?** No: es literal `publicaCanon` +
  `outputs`. La pregunta es si se **unifican esos dos** en un solo `emite`
  (geometría y magnitud son la misma familia de "publico un valor").
- **¿La demasía POST muta `piezas` o publica dimensión?** Recomiendo
  **dimensión** (§3): el absorbedor lee `lonaBrutaMm`, nadie muta `piezas`. Hay
  que confirmar que ningún paso posterior a impresión dependa de la lona
  *crecida* (en backlight, ninguno).
- **¿Cómo se ubica al absorbedor?** Por el material que consume, por el output
  canónico, o por un target declarado. El de demasía apunta al **material**; el
  de geometría, a **quien lea la clave**.
- **¿Migración de `modificaciones-pre`?** Se queda como la implementación PRE
  del modelo; sólo cambia **cómo se declara** (uniforme), no cómo se aplica.
- **¿Efectos que dependen del tipo de estructura?** El canvas exige envolver la
  profundidad; el backlight, sólo agarre. El efecto de demasía del bastidor ya
  es paramétrico (`montajeLona`) — el modelo hereda eso.

## 8. Primera aplicación — lona POST del backlight

La prueba de fuego y primer PR del modelo:
- el bastidor publica `lonaBrutaMm` como **efecto POST** (ya lo publica al canon,
  Ola #2),
- la **impresión** lo lee como su tamaño de material,
- se **retira la demasía del paso Tensado** (deja de ser PRE),
- re-baseline controlado: mueve precios sólo si el valor difiere de los 10 cm de
  hoy.

Si eso cierra limpio, valida el modelo antes de generalizar la declaración.

**Estado: IMPLEMENTADO (2026-08-13).** `conLonaBrutaSiExiste` en el dispatch de
rollo (`nesting-dispatcher.ts`): si un bastidor publicó `lonaBrutaMm`, la
impresión imprime esa pieza sin mutar el `piezas` global. Enganchado (spec
end-to-end: con `lonaBrutaMm` la impresión consume más rollo) y **price-safe**
(golden master IDÉNTICO: la lona bruta del backlight = la demasía de tensado
vieja, ambas visible+10cm).

**Cleanup del Tensado HECHO (2026-08-13).** Hallazgo: la demasía del Tensado NO
era pura redundancia — su `mm` crecía la lona (ahora inerte), pero sus `lados`
alimentaban el TIEMPO del propio Tensado (`productivityQuantitySource:
perimetro_lados_efecto`, que lee el efecto). Cleanup limpio: se agregó la fuente
`perimetro_visible` (perímetro visible completo, sin leer ningún efecto —
motor.service.ts), se cambió el Tensado a esa fuente y se **retiró la demasía**.
Golden master **IDÉNTICO** (el perímetro visible = el de los 4 lados). Ahora la
demasía de la lona tiene **una sola fuente** (el bastidor). **Deploy:** la
reconfig del paso Tensado es data de ruta — en dev ya está; otros entornos
necesitan la misma (fuente `perimetro_visible` + sin `efectos.demasiaMedida`),
idealmente por migración/seed.

## 9. Bitácora

| Fecha | Qué se analizó |
|---|---|
| 2026-08-13 | Modelo inicial: efecto entre pasos con dirección (post/pre) resuelta por posición en la ruta; mapeo de los 3 mecanismos actuales como instancias; el matiz POST-no-muta-`piezas`; casos de referencia; primera aplicación = lona POST del backlight. Sin código. |
| 2026-08-13 | Lona-POST IMPLEMENTADA: `conLonaBrutaSiExiste` en el dispatch de rollo. Enganchado (spec) + price-safe (golden idéntico). Falta retirar la demasía redundante del Tensado (config de ruta). |
