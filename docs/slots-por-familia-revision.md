# Slots declarados por familia — tabla de revisión

**Estado: DOCUMENTO DE REVISIÓN** (2026-08-14). Tabla viva para auditar los
`slotsRequeridos` de cada familia y decidir faltantes / sobrantes. Fuente:
[`apps/api/src/productos-servicios/pasos/familias.ts`](../apps/api/src/productos-servicios/pasos/familias.ts).

## Cómo leer

- Un slot **declarado** es parte de la ficha de la familia: aparece en TODOS los
  pasos de esa familia. `requerido: true` = obligatorio (bloquea la cotización
  si falta); `requerido: false` = **opcional** (aparece pero no obliga).
- `permiteSlotsAdicionales: true` deja al modelador **agregar slots extra** en un
  producto puntual — la alternativa a declarar un slot opcional para algo que
  casi nunca se usa.
- Familias **⟨derivador⟩**: la cantidad de sus slots la calcula el motor
  (`magnitudDerivada` / `cantidadFija`), no una fórmula del comercial.

## Tabla

| Familia | Slot | Nombre | Tipo | Requerido | Deriva / fórmula | Compatibilidad MP | Adicionales |
|---|---|---|---|:---:|---|---|:---:|
| **pre_prensa** | — | *(sin slots)* | — | — | — | — | no |
| **impresion_por_hoja** | `sustrato_principal` | Sustrato principal | SUSTRATO | **oblig.** | *(ignora caras)* | `MP.sustratoHoja` | no |
| | `tinta_o_toner` | Tinta / tóner | CONSUMIBLE_MAQUINA | **oblig.** | — | — | |
| **impresion_por_area** | `sustrato_principal` | Sustrato principal | SUSTRATO | **oblig.** | — | `MP.sustratoImpresionArea` | no |
| | `tinta` | Tinta | CONSUMIBLE_MAQUINA | **oblig.** | — | — | |
| **impresion_por_pieza** | `sustrato_principal` | Sustrato principal | SUSTRATO | **oblig.** | — | `MP.sustratoPieza` | no |
| | `tinta` | Tinta | CONSUMIBLE_MAQUINA | **oblig.** | — | — | |
| **impresion_3d** | `material_3d` | Filamento / resina | SUSTRATO | **oblig.** | — | `MP.aditiva3d` | **sí** |
| **aplicacion_transfer** | `textil` | Objeto base | SUSTRATO | **oblig.** | — | `MP.sustratoPieza` | no |
| | `film_transfer` | Film transfer (comprado) | INSUMO_PASO | opcional | — | `MP.filmTransfer` | |
| **aplicacion_transfer_textil** | `prenda` | Prenda / sustrato textil | SUSTRATO | **oblig.** | — | `MP.sustratoPieza` | no |
| | `film_transfer` | Film transfer (comprado) | INSUMO_PASO | opcional | — | `MP.filmTransfer` | |
| **grabado_laser** | `sustrato` | Sustrato a grabar | SUSTRATO | **oblig.** | — | `MP.sustratoGrabable` | no |
| **corte_guillotina** | — | *(sin slots)* | — | — | — | — | no |
| **plotter_corte** | — | *(sin slots)* | — | — | — | — | no |
| **corte_laser** | — | *(sin slots)* | — | — | — | — | no |
| **troquelado_digital** | — | *(sin slots)* | — | — | — | — | no |
| **cnc** | — | *(sin slots)* | — | — | — | — | no |
| **plegado** | — | *(sin slots)* | — | — | — | — | no |
| **corte_manual** | — | *(sin slots)* | — | — | — | — | no |
| **laminado** | `film` | Film de laminado | INSUMO_PASO | **oblig.** | `por_metro_lineal` | `MP.laminadoFilm` | no |
| **plastificado_pouch** | `pouch` | Pouch térmico | INSUMO_PASO | **oblig.** | — | `MP.laminadoPouch` | no |
| **pintura_superficial** | `pintura` | Pintura / laca | INSUMO_PASO | **oblig.** | — | `MP.pintura` | no |
| **abrochado_caballete** | — | *(sin slots)* | — | — | — | — | **sí** |
| **encuadernado_anillado** | `anillo` | Anillo (por capacidad) | INSUMO_PASO | **oblig.** | — | `MP.anillo` | no |
| | `tapa_frontal` | Tapa frontal (transparente) | TAPA | opcional | — | `MP.tapa` | |
| | `tapa_posterior` | Contratapa (cartón) | TAPA | opcional | — | `MP.tapa` | |
| **engomado_emblocado** | `cola` | Cola / goma | INSUMO_PASO | **oblig.** | — | `MP.adhesivo` | no |
| | `carton_base` | Cartón base (opcional) | INSUMO_PASO | opcional | — | `MP.cartonBase` | |
| | `hoja_blanca_superior` | Hoja blanca superior (opcional) | INSUMO_PASO | opcional | — | `MP.sustratoHoja` | |
| | `tapa_cartulina` | Tapa cartulina (opcional) | TAPA | opcional | — | `MP.tapa` | |
| **ensamble_estructural** | — | *(sin slots)* | — | — | — | — | **sí** |
| **estructura_bastidor** ⟨deriv⟩ | `perfil_estructural` | Perfil / caño estructural | INSUMO_PASO | **oblig.** | `mlTotal` · `por_unidad_productiva` | `MP.soldadura` | **sí** |
| | `anclaje` | Anclajes (opcional) | INSUMO_PASO | opcional | `anclajes` | HERRAJE_ACCESORIO / SISTEMA_COLGADO_MONTAJE, FIJACION_AUXILIAR | |
| **iluminacion_led** ⟨deriv⟩ | `modulos_led` | Módulo LED | INSUMO_PASO | **oblig.** | `por_unidad_productiva` | ELECTRONICA_CARTELERIA, NEON_LUMINARIA / MODULO_LED_CARTELERIA, NEON_FLEX_LED | **sí** |
| | `fuente` | Fuente de alimentación (auto) | INSUMO_PASO | **oblig.** | `cantidadFija: 1` (+ criterio capacidad) | ELECTRONICA_CARTELERIA / FUENTE_ALIMENTACION_LED | |
| | `cableado` | Cable y conectores (opcional) | INSUMO_PASO | opcional | `cableMl` | ELECTRONICA_CARTELERIA / CABLEADO_CONECTICA | |
| **montaje_sobre_sustrato** | `sustrato_montaje` | Material de montaje | SUSTRATO | **oblig.** | — | `MP.sustratoMontaje` | **sí** |
| | `adhesivo_montaje` | Adhesivo de montaje | INSUMO_PASO | opcional | — | `MP.adhesivo` | |
| **embalaje** | `caja` | Caja / bolsa | INSUMO_PASO | **oblig.** | — | `MP.packaging` | no |
| | `cinta` | Cinta | INSUMO_PASO | opcional | — | `MP.cinta` | |
| **trabajo_manual** | `insumo_manual` | Insumo manual (opcional) | INSUMO_PASO | opcional | — | `MP.insumoManual` | **sí** |
| **modificacion_post** | — | *(sin slots)* | — | — | — | — | **sí** |
| **colocacion_ojales** ⟨deriv⟩ | `ojal` | Ojal / ojalillo | INSUMO_PASO | **oblig.** | *(deriva por bloque)* | HERRAJE_ACCESORIO / OJAL_OJALILLO_REMACHE | **sí** |
| **instalacion_in_situ** | — | *(sin slots)* | — | — | — | — | no |
| **diseno_grafico** | — | *(sin slots)* | — | — | — | — | no |

## Resumen

- **31 familias.** 18 declaran ≥1 slot; **13 no declaran ninguno**.
- **33 slots** en total: 8 SUSTRATO, 3 CONSUMIBLE_MAQUINA, 19 INSUMO_PASO, 3 TAPA.
- **9 permiten adicionales**: impresion_3d, abrochado_caballete, ensamble_estructural,
  estructura_bastidor, iluminacion_led, montaje_sobre_sustrato, trabajo_manual,
  modificacion_post, colocacion_ojales.
- **Tipos NO usados**: `COMPONENTE`, `CONSUMIBLE`, `PACKAGING` — el rol existe en
  el modelo pero ninguna familia lo declara (todo cae en INSUMO_PASO). A revisar
  si conviene tiparlos mejor o si el rol de slot ya no aporta.

## Observaciones para revisar (candidatos)

> No son decisiones — son banderas para que valides. Marcá al lado.

### El disparador: `estructura_bastidor.anclaje`
Ya está **opcional** (`requerido: false`, nombre "Anclajes (opcional)") — **no es
obligatorio**. La decisión real es: *¿declararlo opcional (hoy) o no declararlo y
que sea un adicional?* Matiz: el derivador calcula la magnitud `anclajes`
(`magnitudDerivada: 'anclajes'`); si se saca de los declarados, un adicional
tendría que re-mapear esa magnitud a mano. Por eso "declarado-opcional" es
probablemente correcto. **Decisión: ______**

### Posibles FALTANTES (familia sin el slot de su consumible propio)
- **`abrochado_caballete`** (grapado a caballete): no declara slot, pero el grapado
  consume **grapas/broches**. Hoy sólo vía adicional. ¿Merece un slot declarado
  (opcional) para la grapa? **______**
- **`ensamble_estructural`**: sin slots. El ensamblado suele consumir
  **tornillería / fijaciones / adhesivo**. ¿Faltan slots? **______**
- **`instalacion_in_situ`**: sin slots. El montaje en obra puede consumir
  **fijaciones / tacos / tornillos**. ¿O eso va como material aparte? **______**
- **`troquelado_digital` / `corte_laser` / `cnc`**: sin slots. Correcto si el
  troquel/cuchilla/fresa es **consumible de máquina** (no material del trabajo).
  Confirmar que el troquel no debería ser un slot. **______**

### Posibles SOBRANTES (muchos opcionales declarados = ruido)
- **`engomado_emblocado`**: 3 slots opcionales (`carton_base`,
  `hoja_blanca_superior`, `tapa_cartulina`). ¿Todos justifican estar declarados,
  o algunos deberían ser adicionales? **______**
- **`encuadernado_anillado`**: 2 tapas opcionales (`tapa_frontal`,
  `tapa_posterior`). ¿Declaradas o adicionales? **______**

### Consistencia
- Las 3 familias de impresión (hoja/área/pieza) tienen el mismo par
  sustrato + tinta/tóner. ✅ Consistente.
- Sólo `impresion_por_hoja.sustrato_principal` tiene `ignoraMultiplicadorCaras`.
  ¿Deberían tenerlo también `impresion_por_area` / `por_pieza`, o es correcto que
  no? **______**
