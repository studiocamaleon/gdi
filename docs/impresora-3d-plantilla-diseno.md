# Plantilla IMPRESORA_3D — diseño e implementación

**Fecha:** 2026-08-04 · **Estado:** implementado (falta correr la migración en dev).
Base del relevamiento: [holdprint-plantillas-maquinaria-relevamiento.md](holdprint-plantillas-maquinaria-relevamiento.md) §2 y §4.3.

---

## 1. La decisión de fondo: la magnitud son los gramos

Holdprint modela la 3D con **perfiles por caja envolvente** (10/20/30/40 cm) y
filamento + tiempo **fijos** por bucket. Lo descartamos por tres motivos:

1. Dos piezas del mismo tamaño consumen muy distinto según relleno y paredes: la
   caja no dice nada del material real.
2. No hay auto-resolución — el comercial elige el bucket a mano igual.
3. Sus propios defaults lo delatan: los cuatro buckets traen 91 m y 12 h idénticos.

**Nuestro modelo:** el perfil declara el **caudal de material (g/h)** y el paso
aporta los **gramos de la pieza**. `tiempo = gramos ÷ caudal`. Los gramos son el
dato que da cualquier slicer, y son la única variable que captura relleno,
paredes y soportes a la vez.

Dato de validación: los 91 m / 12 h de Holdprint, convertidos (PLA 1,75 mm ≈
2,98 g/m → 271 g en 12 h), dan **~23 g/h** — un caudal FDM realista. Su número
era razonable; lo que fallaba era el eje por el que lo indexaban.

## 2. Qué se implementó

### Plantilla `IMPRESORA_3D`

| Sección | Campos |
|---|---|
| Volumen de impresión | `anchoUtil` (X), `largoUtil` (Y), `altoUtil` (Z) — requeridos, informativos |
| Tecnología | `tecnologia`: FDM / RESINA — requerido, define el consumible |
| Perfiles | `nombre`, `material` (**multi-valor**), `calidad` (borrador/normal/alta), `alturaCapaMm`, `productivityValue` (**g/h**, requerido), `setupMin`, `cleanupMin` |
| Desgaste | genérico (boquilla, cama, film FEP, pantalla LCD) |

- Geometría `plano`, unidad por defecto `g_h`, perfiles de tipo `FABRICACION`.
- El **relleno NO va en la máquina**: cambia trabajo a trabajo, así que vive en
  el paso (igual que el `FILL_PERCENTAGE` de Holdprint, que también lo pone en
  el proceso).

### Familia de paso `impresion_3d`

- M-1 / M-2, activación obligatoria u opcional.
- **T-3** (caudal del perfil) y **T-4** (el comercial carga las horas del
  slicer — el dato más fiel cuando ya sliceó la pieza).
- `magnitudTiempoDefault: 'gramos_material'`.
- Slot `material_3d` → familia de materia prima `ADITIVA_3D`
  (`FILAMENTO_3D` / `RESINA_3D`), que **ya existían** en la biblioteca.
- Params del paso: `gramosPorPieza` (la magnitud; conviene dejarlo abierto al
  comercial) y `rellenoPct` (informativo para producción).
- Publica `piezas_impresas` y `tiempo_real_impresion`.

### Motor

- Nueva unidad de producción **`G_H`**. No hizo falta tocar la conversión:
  `runMinPorProductividad` ya cae en la rama "por hora", que da exactamente
  `gramos ÷ (g/h) × 60`.
- Nueva magnitud **`gramos_material`**: `gramosPorPieza × cantidad`, leyendo
  params efectivos (o sea, respeta lo que el comercial completó). Sin el dato
  cae a la cantidad — por eso un paso sin gramos debería usar T-4.

### Migración

`20260804140000_add_impresora_3d_plantilla` — aditiva, dos `ADD VALUE IF NOT
EXISTS` (`PlantillaMaquinaria.IMPRESORA_3D`, `UnidadProduccionMaquina.G_H`).
**Pendiente correrla en dev.**

## 3. Lo que quedó afuera a propósito

- **Curado/lavado de resina y retiro de soportes**: son pasos aparte (trabajo
  manual), no tiempo de máquina. El `cleanupMin` del perfil cubre sólo retirar
  la pieza y limpiar la cama.
- **Acomodar varias piezas en una misma cama** (nesting 3D): el motor acomoda
  en 2D. Una cama con 6 piezas hoy se cotiza como 6 × gramos, que es correcto en
  material y conservador en tiempo (no descuenta el paralelismo). Si se vuelve
  un caso real, se modela después.
- **Modelado 3D** como servicio de diseño: es otra familia (`diseno_grafico`
  ya sirve), no parte de esta.

## 4. Otros cambios de la misma tanda

- **Material multi-valor en perfiles** (idea robada a Holdprint): el campo
  `material` de los perfiles de láser y CNC pasó de `select` a `multiselect`.
  Un perfil ahora cubre varios materiales (su "Grabación sencilla" vale para
  MDF, compacto, multilaminado, madera y acrílico) en vez de obligar a duplicar
  filas. Retrocompatible: el editor ya normaliza el string viejo a array.
- **Valores de referencia como placeholder** en los campos clave de láser, CNC
  y 3D (mesa 1300×2500, ejes CNC 2800/5000/150, velocidades típicas por
  material y espesor, caudal 23 g/h). Sugieren sin afirmar: el input queda
  vacío, no precargado.

## 5. Auditoría de plantillas faltantes

Contra las 18 de Holdprint, **la única que faltaba de verdad era la 3D**:

- Sus 8 impresoras de gran formato (solvente, látex, UV rollo, UV flatbed, UV
  mesa, sublimación GF, DTF, DTF UV) las unifica nuestra
  `IMPRESORA_GRAN_FORMATO_POR_AREA` con `tecnologia` + `geometria`.
- Su UV 360 cilíndrica la cubre `impresion_por_pieza` sobre esa misma plantilla.
- `INKJET` sigue descartada (no aplica al rubro).
- Su prensa térmica y su calandra son bloques dentro de un proceso; nosotros
  tenemos `PLANCHA_TERMICA` como plantilla propia — **estamos más adelante**.
- Ellos no tienen plantilla de guillotina, anilladora ni laminadora (las modelan
  como procesos manuales con tabla de productividad); nosotros sí.

Único hueco menor detectado: una **sublimadora de hoja chica** (A4/A3, en
unidades/min) no encaja perfecto — `impresion_por_hoja` sólo admite
`IMPRESORA_LASER` y gran formato trabaja por m². No bloquea nada hoy.
