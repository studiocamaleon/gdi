# Cartelería — biblioteca de materiales instalable

> **Estado**: relevada e implementada 2026-08-04 (sin commitear).
> Código: `apps/api/src/carteleria/biblioteca-carteleria.ts` (datos +
> `instalarBibliotecaCarteleria`, idempotente por sku). La llamará
> `provisionar-carteleria` cuando el plan incluya el feature (§12 del doc de
> diseño); instalada en dev.
> Fuentes del relevamiento: prototipo del usuario (grafo-motor-carteleria.md
> §2, specs de módulos/fuentes del rubro) + proveedores AR relevados
> 2026-08-04 (LedShop, listados Franceled, Led Neon Flex Argentina) +
> catálogos IP67 genéricos.

## 1. El principio

Cuando el plan incluye cartelería, la provisión instala **todo lo necesario
para cotizar**: productos del sistema + esta biblioteca de materiales **sin
precio**. El tenant completa costos y margen y ya cotiza — si falta un precio
el motor corta con su diagnóstico de siempre. Nada de armar bibliotecas a
mano.

Idempotente a nivel variante (sku): sumar una variante acá y re-provisionar
la agrega a todos los tenants sin tocar precios ni datos existentes.

## 2. Catálogo (14 materias · 34 variantes)

### Iluminación (lo relevado)

| Materia | Variantes | Atributos que lee el motor |
|---|---|---|
| **Módulo LED** (`CART-LED-MOD`) | 1×2835 0,6W (pastillas finas) · 3×2835 1,2W (el estándar) · lente 160° 1,2W · backlight 10°×65° 3W (cajones 12–20 cm) · COB 2W | `cobertura` (m², sembrado por área) · `paso` (mm, por recorrido) · `potencia` (W → fuente) |
| **Tubo LED T8** (`CART-LED-TUBO`) | 60 cm 9W · 120 cm 18W (220V, cajas de luz económicas) | cobertura 0,15/0,30 |
| **Neón flex** (`CART-NEON`) | 6×12 mm 12V frío/cálido/color · 9,6 W/m | potencia por metro |
| **Fuente switching** (`CART-FUENTE`) | 60/100/150/200/350W IP67 + 150W IP20 | `capacidad` (selector MENOR_CAPACIDAD) |
| **Controlador** (`CART-CONTROL`) | dimmer 12V 8A · controladora RGB | — |
| **Cable** (`CART-CABLE`) | taller 2×1 · 2×1,5 (por ml) | — |
| **Conectores** (`CART-CONECTOR`) | ficha fast · prensacable PG7 | — |

Regla del rubro que queda modelada: la **profundidad del cajón elige el
módulo** — fino (≥2,5 cm) → 1 LED chico; 8–15 cm → 3×2835 estándar; 12–20 cm
→ módulo backlight con lente que proyecta. Cada variante trae su cobertura,
así el sembrado del motor sale bien con solo elegir el módulo.

### Estructura y terminación

| Materia | Variantes |
|---|---|
| **Caño estructural** (`CART-PERFIL`) | 20×20×1,2 · 30×30×1,6 · 40×40×1,6 · aluminio 40×40 (con `desarrolloSeccion` para la pintura) |
| **Chapa** (`CART-CHAPA`) | galvanizada 0,7 · prepintada 0,7 · aluminio 1,0 |
| **Pintura** (`CART-PINTURA`) | antióxido+esmalte negro · blanco |
| **Anclajes** (`CART-ANCLAJE`) | soporte L + brocas · abrazadera columna · suspensión cadena |

### Lonas (con nesting real)

| Materia | Variantes | Nota |
|---|---|---|
| **Lona backlight 510 g** (`CART-LONA-BACK`) | rollo 3,20 × 50 m | attrs `anchoMm/largoRolloMm` → shelf-rollo |
| **Lona frontlight 440 g** (`CART-LONA-FRONT`) | rollo 3,20 × 50 m | ídem |

## 3. La lona se cotiza como una lona (verificado E2E)

La ruta del backlight quedó completa en dev:

```
1. Demasía de tensado (modificacion_pre, +100 mm/lado)      $3.357
2. Impresión de lona (impresion_por_area, shelf-rollo)      $87.410
     rollo 3,20: 1,60 ml consumidos = 5,12 m² · aprovechamiento 71%
     tintas CMYK por m² (consumibles de máquina)
3. Estructura de bastidor                                   $123.958
4. Iluminación LED                                          $57.033
                                              total $494.104
```

Dos cosas que valen el precio de la entrada:
- **La regla de oro cruzó familias**: la demasía mutó el material a 2,6×1,4,
  la lona se anidó y cobró sobre eso, pero el bastidor (20,28 ml) y los LEDs
  (47) siguieron midiendo el cartel VISIBLE de 2,4×1,2. Con test propio en
  cada helper.
- El paso de lona trae **nesting real con placements** → el viewer existente
  (con boca de impresora) ya lo dibuja: esa es la base de la ficha blueprint.

## 4. Ficha técnica blueprint (diseño, F3c)

Cada paso aporta su lámina, todas desde datos que el motor YA publica:

| Lámina | Fuente |
|---|---|
| **Lona**: acomodo en el rollo, demasía de tensado señalada, área útil vs consumida, costuras si panela | placements del nesting + mutación del paso PRE |
| **Bastidor**: alzado con cotas, separación de refuerzos, puntos de soldadura, desarrollo de cenefa | outputs ml_estructura/puntos_soldadura/cenefa_m2 + params |
| **Eléctrica**: grilla de módulos (cols×rows), watts, fuente elegida, cable | outputs modulos_led/watts_led + selector de fuente |
| **3D**: snapshot del configurador | canvas del editor (patrón EPS del sello) |

## 5. Pendiente

- `provisionar-carteleria.ts` (productos del sistema + esta biblioteca +
  flag del plan) — F3a/b del §12.
- Anclajes/instalación como paso o cargo (V1: cargos manuales).
- El slot `modulos_led` con neón/cinta por metro (hoy el sembrado cuenta
  unidades; por-ml es un refinamiento de la familia).
