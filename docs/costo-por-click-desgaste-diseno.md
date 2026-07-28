# Costo por click (desgaste y repuestos) — Diseño

**Fecha:** 2026-07-28
**Estado:** IMPLEMENTADO — datos, editor y motor; verificado E2E contra la
Ricoh C8003 de desarrollo
**Caso de referencia:** impresora láser color (Ricoh Pro C8003)

---

## 1. Contexto y objetivo

Una impresora láser no gasta sólo tóner. Cada hoja que pasa desgasta piezas que
la imprenta repone cada tantos miles de copias: el cilindro (drum), la blade de
limpieza, la barra de cera del fusor, el rodillo de carga, el revelador. El
fabricante las vende con una vida útil declarada en **copias A4**, y la imprenta
las paga aunque el trabajo haya sido una hoja al 2% de cobertura.

Hasta ahora esas piezas se podían listar en la ficha de la máquina pero **nadie
las costeaba**: la tabla `MaquinaComponenteDesgaste` existía, exigía vincular
una variante de inventario, y el motor no la miraba.

**Objetivo:** que la imprenta declare cada pieza con su precio y su rinde, y que
el motor sume ese desgaste como un costo variable más del trabajo — el "costo
por click" con el que la industria compara equipos.

---

## 2. Por qué el driver es el click y no la cobertura

Es la distinción que ordena todo el módulo:

| | Tóner | Desgaste |
|---|---|---|
| Escala con | cobertura × área × caras | cantidad de páginas |
| Una hoja al 2% vs. al 60% | cuesta 30× menos | cuesta **igual** |
| Dónde se declara | perfil de impresión (g/m²) | máquina (precio / rinde) |

El drum dio la misma vuelta en los dos casos. Por eso los rindes ISO 19752 /
19798 —que suponen 5% de cobertura— aplican al tóner y **no** a estas piezas:
las de desgaste se declaran directamente en copias.

De ahí se sigue dónde vive cada cosa: el tóner varía por perfil (un papel más
absorbente consume más), el desgaste no varía por perfil sino por máquina.

---

## 3. Modelo de datos

`MaquinaComponenteDesgaste` (una fila por pieza, colgando de la máquina):

| Campo | Rol |
|---|---|
| `nombre` | "Drum negro", "Drums color (CMY)" |
| `tipo` | enum de piezas (drum, fusor, blade, cera, etc.) |
| `vidaUtilEstimada` | el rinde: cuántos clicks A4 aguanta |
| `unidadDesgaste` | `COPIAS_A4_EQUIV` para láser |
| `precioUnitario` | **nuevo** — precio suelto del repuesto |
| `materiaPrimaVarianteId` | **ahora opcional** — el repuesto en inventario |
| `soloColor` | **nuevo** — la pieza sólo gira imprimiendo en color |

Migración: `20260728030000_desgaste_costo_por_click`.

Tres decisiones que tomó el usuario y que explican el modelo:

1. **La pieza vive en la máquina, no en el perfil.** El drum no se gasta
   distinto según el papel; la unidad de análisis es el equipo.
2. **Se distingue color de mono.** Una C8003 tiene cuatro drums: el negro gira
   siempre, los CMY sólo en trabajos color. Cobrar los cuatro en un trabajo en
   blanco y negro infla el costo un 300%.
3. **Se permite precio suelto.** Exigir que cada repuesto esté dado de alta como
   materia prima frenaba la carga. Si hay variante vinculada, su
   `precioReferencia` manda; si no, se usa el precio suelto. Uno de los dos es
   obligatorio (lo valida la API).

---

## 4. Cómo lo costea el motor

En `calcularDesgasteMaquina`, después de los consumibles y sólo para pasos de
familia `impresion_por_hoja`:

```
clicks = ceil(pliegos) × caras × ceil(factorA4)
costo  = Σ (precio del repuesto / vida útil) × clicks
```

- **Clicks enteros**: es lo que cuenta el contador del equipo. Un SRA3 son 2
  clicks, no 2,31 — el factor A4-equivalente se redondea para arriba.
- **Filtro por color**: si el modo de color efectivo del paso es `BN`, las
  piezas con `soloColor` no suman.
- **Piezas incompletas se ignoran**: sin rinde o sin precio, la línea no
  aparece. No es un error de cotización: es una pieza a medio cargar.
- Cada pieza genera su propia línea con `tipoLineaCosto: 'DESGASTE_MAQUINA'`,
  `estrategiaCosto: 'costo_por_click'` y `modoSeleccion: 'MAQUINA_DESGASTE'`,
  así el desglose de la propuesta la muestra separada del papel y del tóner.

El desgaste entra en los reportes como **costo variable**, junto a `MATERIAL` y
`CONSUMIBLE_MAQUINA` (rentabilidad y contribución por producto).

---

## 5. La carga (journey)

Ficha de la máquina › Ajustes › **Desgaste y repuestos**. Una tabla, una fila
por pieza:

| Componente | Tipo | Precio del repuesto | Rinde (clicks A4) | Costo por click | Sólo color |

El costo por click de cada fila se calcula mientras se escribe, y al pie queda
el total que es el número que la imprenta reconoce:

> Costo por click: **$ 0,62** en blanco y negro · **$ 2,37** en color

La columna *Sólo color* aparece únicamente si la máquina declara CMYK entre sus
modos: en una monocromática sería ruido.

---

## 6. Verificación

Cotización real contra la base de desarrollo (Folletos/flyers, 1000 u., doble
faz, Ricoh C8003 con drum negro $185.000/300.000 clicks y drums color
$420.000/240.000 clicks):

```
CMYK   MATERIAL              125 hoja                    => 12.500,00
       CONSUMIBLE_MAQUINA    98,54 g × 4 tóners          => 149.295,06
       DESGASTE_MAQUINA      Drum negro         500 a4   =>     308,33
       DESGASTE_MAQUINA      Drums color (CMY)  500 a4   =>     875,00

BN     MATERIAL              125 hoja                    => 12.500,00
       CONSUMIBLE_MAQUINA    98,54 g (negro)             =>  40.107,65
       DESGASTE_MAQUINA      Drum negro         500 a4   =>     308,33
```

500 clicks = 125 pliegos × 2 caras × 2 (el pliego es A3). En BN los drums de
color no aparecen. Tests en `motor.spec.ts` ("Desgaste: …").

---

## 7. Pendientes

- **Otras plantillas.** Hoy sólo costea `impresion_por_hoja`. Gran formato
  (cabezales, lámpara UV) y router (fresas) tienen desgaste real, pero su driver
  no es el click sino m² / horas / metros lineales: cada uno necesita su propia
  conversión antes de habilitarlos.
- **Vínculo con inventario.** El precio suelto es el atajo. Cuando los repuestos
  estén dados de alta como materia prima, vincularlos hace que el costo siga al
  precio de compra sin retocar la ficha.
- **Aviso de reposición.** Con rinde declarado y clicks acumulados por máquina
  se podría avisar cuándo toca cambiar cada pieza. Requiere contador de clicks
  por máquina, que hoy no existe.
