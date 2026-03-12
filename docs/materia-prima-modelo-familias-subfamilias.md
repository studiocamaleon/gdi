# Modelo de Materia Prima por Familias y Subfamilias

Fecha: 2026-03-11

## Objetivo

Definir un modelo funcional/técnico de `Materia Prima` para el ERP, contemplando que distintos materiales requieren distintos campos (ejemplo: `tazas` vs `hojas de papel`).

Este documento sirve como base previa obligatoria para implementar el módulo.

---

## 1) Respuesta a la hipótesis central

Sí, estás en lo correcto:

1. `Tazas` no requieren los mismos campos que `hojas de papel`.
2. Un único formulario/plano para todo rompe calidad de datos.
3. La implementación debe ser por `core común + modelo específico por subfamilia`.

---

## 2) Enfoque recomendado

## 2.1 Core común obligatorio (todas las materias primas)

Campos mínimos:

- `codigo`
- `nombre`
- `familia`
- `subfamilia`
- `tipoTecnico`
- `unidadStock`
- `unidadCompra`
- `factorConversionCompra`
- `controlLote`
- `controlVencimiento`
- `activo`
- `atributosTecnicosJson` (validado por template)

## 2.2 Modelo específico por subfamilia

Cada subfamilia tiene un `template` con:

- campos requeridos
- campos opcionales
- unidades válidas
- validaciones de rango/formato

---

## 3) Familias y subfamilias propuestas (V1)

## Familia A: Sustratos

### A1) `sustrato_hoja`

Ejemplos: papel obra, ilustración, cartulina, sintético en hoja.

Campos técnicos:

- `anchoMm`
- `altoMm`
- `gramajeGm2`
- `acabado`
- `colorBase`
- `fibraDireccion` (si aplica)
- `aptoLaser` / `aptoInkjet`

### A2) `sustrato_rollo_flexible`

Ejemplos: vinilo, lona, film, canvas, backlit.

Campos técnicos:

- `anchoRolloMm`
- `largoRolloM`
- `micraje` o `gramajeGm2`
- `tipoAdhesivo` (si aplica)
- `acabado`
- `aplicacionInteriorExterior`

### A3) `sustrato_rigido`

Ejemplos: PVC espumado, acrílico, MDF, dibond, corrugado plástico.

Campos técnicos:

- `anchoMm`
- `altoMm`
- `espesorMm`
- `densidad` (opcional)
- `acabado`
- `colorBase`

### A4) `objeto_promocional_base`

Ejemplos: tazas, termos, botellas, vasos.

Campos técnicos:

- `materialBase` (cerámica, acero, vidrio, polímero)
- `diametroMm` (si cilíndrico)
- `altoMm`
- `areaImprimibleMm2` (o ancho/alto imprimible)
- `recubrimiento` (ej: polímero para sublimación)
- `colorBase`

Nota: acá entran tus `tazas`, y se ve claro que no comparten modelo con papel.

## Familia B: Tintas y colorantes

### B1) `tinta_impresion`

Ejemplos: solvente, latex, UV, DTF, sublimación, CAD.

Campos técnicos:

- `tecnologiaCompatible`
- `canalColor` (CMYK, blanco, barniz, etc.)
- `presentacionMl`
- `rendimientoReferencia`
- `baseQuimica` (si aplica)

### B2) `toner`

Campos técnicos:

- `color`
- `rendimientoPaginasIso`
- `equipoCompatible` (catálogo/relación)
- `oemOAlternativo`

## Familia C: Transferencia y laminación

### C1) `film_transferencia`

Ejemplos: film DTF PET, film A/B UV.

Campos técnicos:

- `anchoMm`
- `largoM`
- `tipoRelease` (hot/cold peel)
- `espesorMicrones`
- `tecnologiaCompatible`

### C2) `papel_transferencia`

Ejemplos: papel sublimación.

Campos técnicos:

- `anchoMm` / `altoMm` o `anchoRolloMm/largoRolloM`
- `gramajeGm2`
- `ladoImprimible`

### C3) `laminado`

Ejemplos: laminado brillo/mate, protección UV.

Campos técnicos:

- `anchoMm`
- `largoM`
- `espesorMicrones`
- `acabado`
- `adhesivoTipo`

## Familia D: Químicos y auxiliares

### D1) `quimico_acabado`

Ejemplos: barniz, primer, promotor de adhesión.

Campos técnicos:

- `presentacionMl`
- `tecnologiaCompatible`
- `superficiesCompatibles`

### D2) `auxiliar_proceso`

Ejemplos: limpiadores, cintas, paños técnicos.

Campos técnicos:

- `presentacion`
- `usoTecnico`
- `compatibilidadEquipo`

### D3) `polvo_dtf`

Campos técnicos:

- `tipoPolvo`
- `granulometria` (opcional)
- `rangoTemperaturaAplicacion`

## Familia E: Aditiva (3D)

### E1) `filamento_3d`

Campos técnicos:

- `materialPolimero`
- `diametroMm`
- `pesoKg`
- `rangoTemperaturaExtrusion`

### E2) `resina_3d`

Campos técnicos:

- `tipoResina`
- `longitudOndaCurado`
- `presentacionMl`
- `aplicacion`

## Familia F: Electronica para carteleria

### F1) `modulo_led_carteleria`

Ejemplos: módulos LED inyección/canaleta para letras corpóreas y cajas de luz.

Campos técnicos:

- `voltajeNominal` (12V/24V)
- `potenciaW`
- `temperaturaColorK`
- `luminosidadLm`
- `gradoIp` (IP65/IP67)
- `tipoLente` (ángulo)
- `pasoModulosRecomendadoMm`

### F2) `fuente_alimentacion_led`

Ejemplos: fuentes switching para signage.

Campos técnicos:

- `entradaVac`
- `salidaVdc`
- `corrienteA`
- `potenciaW`
- `factorPotencia` (opcional)
- `gradoIp`
- `certificaciones` (UL/CE u otras)

### F3) `cableado_conectica`

Ejemplos: cable bipolar, cable siliconado, conectores rápidos, borneras.

Campos técnicos:

- `tipoCable`
- `seccionAwgMm2`
- `materialConductor`
- `aislacion`
- `gradoIp` (si aplica)
- `temperaturaMaxOperacion`

### F4) `controlador_led`

Ejemplos: controladoras RGB/RGBW, dimmers, receptores.

Campos técnicos:

- `canales`
- `protocoloControl` (PWM, DMX, RF, etc.)
- `voltajeTrabajo`
- `corrienteMaxCanal`

## Familia G: Neón y luminarias

### G1) `neon_flex_led`

Ejemplos: neón flexible 12V/24V para cartelería.

Campos técnicos:

- `voltajeNominal`
- `potenciaWm`
- `temperaturaColorK` o `colorLuz`
- `gradoIp`
- `radioMinCurvaturaMm`
- `pasoCorteMm`

### G2) `accesorio_neon_led`

Ejemplos: tapas terminales, clips, perfiles, difusores.

Campos técnicos:

- `tipoAccesorio`
- `compatibilidadPerfil`
- `material`
- `unidadPorPack`

## Familia H: Metal y rigidizacion para carteleria

### H1) `chapa_metalica`

Ejemplos: chapa galvanizada, aluminio, acero fino para frentes y refuerzos.

Campos técnicos:

- `materialMetal`
- `anchoMm`
- `altoMm`
- `espesorMm`
- `acabadoSuperficial`
- `tratamientoAnticorrosivo` (si aplica)

### H2) `perfil_estructural`

Ejemplos: perfiles U/L/caja en aluminio o acero.

Campos técnicos:

- `seccionPerfil`
- `largoMm`
- `espesorMm`
- `material`

## Familia I: Pinturas y recubrimientos

### I1) `pintura_carteleria`

Ejemplos: esmalte sintético, acrílica, poliuretánica.

Campos técnicos:

- `tipoPintura`
- `base` (agua/solvente)
- `acabado` (mate/satinado/brillante)
- `color`
- `rendimientoM2L`
- `tiempoSecado`
- `resistenciaUvExterior` (si/no o nivel)

### I2) `primer_sellador`

Ejemplos: primers para metal/plástico y selladores.

Campos técnicos:

- `superficieObjetivo`
- `baseQuimica`
- `rendimientoM2L`
- `tiempoCurado`

## Familia J: Terminacion editorial y grafica comercial

### J1) `plastificado_film`

Ejemplos: film BOPP mate/brillo, soft touch, antihuella.

Campos técnicos:

- `anchoMm`
- `largoM`
- `espesorMicrones`
- `acabado`
- `tipoAdhesivo`
- `temperaturaLaminacionRecomendada`

### J2) `anillado_encuadernacion`

Ejemplos: wire-o, espiral plástico, peine plástico.

Campos técnicos:

- `tipoAnillado`
- `paso` (3:1, 2:1, etc.)
- `diametroMm`
- `material`
- `color`
- `capacidadHojasRef`

### J3) `tapa_encuadernacion`

Ejemplos: tapa PVC transparente, polipropileno, cartón entelado.

Campos técnicos:

- `material`
- `espesorMicronesMm`
- `formato`
- `acabado`
- `color`

## Familia K: Magneticos y fijacion

### K1) `iman_ceramico_flexible`

Ejemplos: imán cerámico/ferrita, lámina magnética flexible, imán de neodimio.

Campos técnicos:

- `tipoIman` (cerámico/flexible/neodimio)
- `gradoMagnetico` (si aplica)
- `anchoMm`
- `altoMm` o `diametroMm`
- `espesorMm`
- `fuerzaSujecionRef`
- `adhesivo` (si/no/tipo)

### K2) `fijacion_auxiliar`

Ejemplos: cintas doble faz, velcro industrial, remaches, tornillería.

Campos técnicos:

- `tipoFijacion`
- `material`
- `medidaNominal`
- `resistenciaRef`

## Familia L: POP y exhibidores

### L1) `accesorio_exhibidor_carton`

Ejemplos: pie de cartón para exhibidor de escritorio, trabas, calces, separadores.

Campos técnicos:

- `tipoAccesorio`
- `materialBase`
- `anchoMm`
- `altoMm`
- `espesorMm`
- `capacidadCargaRef`

### L2) `accesorio_montaje_pop`

Ejemplos: cintas de montaje, pads adhesivos, clips, presillas.

Campos técnicos:

- `tipoAccesorio`
- `formatoPresentacion`
- `resistenciaRef`
- `superficiesCompatibles`

### L3) `semielaborado_pop`

Ejemplos: cuerpo troquelado prearmado, kit de partes para display.

Campos técnicos:

- `composicion`
- `dimensionesBase`
- `estadoSemielaborado`
- `unidadUso`

## Familia M: Herrajes y accesorios comerciales

### M1) `argolla_llavero_y_accesorio`

Ejemplos: argolla partida, cadena corta, mosquetón, ojal para llavero, terminales.

Campos técnicos:

- `tipoAccesorio`
- `diametroInteriorMm`
- `diametroExteriorMm`
- `material` (acero niquelado, inox, etc.)
- `acabado`
- `resistenciaRef`
- `unidadPorPack`

### M2) `ojal_ojalillo_remache`

Ejemplos: ojales metálicos para lona, ojalillo plástico, remaches para gráfica.

Campos técnicos:

- `tipoOjal` (metálico/plástico/remache)
- `diametroInteriorMm`
- `diametroExteriorMm`
- `material`
- `acabado`
- `herramientaCompatible` (manual/prensa)
- `espesorMaterialMax`

### M3) `portabanner_estructura`

Ejemplos: roll-up, X-banner, L-banner, araña pop-up, base con varillas.

Campos técnicos:

- `tipoPortabanner`
- `anchoGraficaMm`
- `altoGraficaMm`
- `materialEstructura`
- `incluyeBolso` (bool)
- `usoInteriorExterior`
- `pesoKg`

### M4) `sistema_colgado_montaje`

Ejemplos: tensores, cables de acero, pitones, separadores, perfiles snap/frame.

Campos técnicos:

- `tipoSistema`
- `material`
- `medidaNominal`
- `capacidadCargaRef`
- `compatibilidadSuperficie`
- `acabado`

### M5) `perfil_bastidor_textil`

Ejemplos: perfiles para bastidor textil siliconado (SEG), uniones y esquineros.

Campos técnicos:

- `tipoPerfil`
- `material`
- `largoMm`
- `seccionPerfil`
- `compatibilidadTela` (grosor de burlete/silicona)

## Familia N: Adhesivos y cintas tecnicas avanzadas

### N1) `cinta_doble_faz_tecnica`

Ejemplos: VHB, foam tape, transfer tape.

Campos técnicos:

- `anchoMm`
- `largoM`
- `espesorMm`
- `adhesivoBase` (acrílico/caucho/híbrido)
- `superficiesCompatibles`
- `resistenciaCortePeladoRef`

### N2) `adhesivo_liquido_estructural`

Ejemplos: epoxi, cianoacrilato, PU, MS polímero.

Campos técnicos:

- `tipoAdhesivo`
- `presentacionMl`
- `tiempoCurado`
- `resistenciaRef`
- `superficiesCompatibles`
- `usoInteriorExterior`

### N3) `velcro_cierre_tecnico`

Ejemplos: velcro industrial adhesivo/cosible, dual lock.

Campos técnicos:

- `anchoMm`
- `largoM`
- `tipoCierre`
- `adhesivo` (sí/no, tipo)
- `resistenciaRef`

## Familia O: Packing, despacho e instalacion

### O1) `embalaje_proteccion`

Ejemplos: film stretch, burbuja, cantoneras, espuma, cajas.

Campos técnicos:

- `tipoEmbalaje`
- `dimensiones`
- `espesorMicronesMm`
- `unidadPresentacion`
- `resistenciaRef`

### O2) `etiquetado_identificacion`

Ejemplos: etiquetas de despacho, precintos, tags.

Campos técnicos:

- `tipoEtiquetaTag`
- `material`
- `formato`
- `adhesivoTipo`
- `aptoExterior` (bool)

### O3) `consumible_instalacion`

Ejemplos: tarugos, tornillos, bridas, niveladores, selladores.

Campos técnicos:

- `tipoConsumible`
- `medidaNominal`
- `material`
- `superficieObjetivo`
- `unidadPorPack`

---

## 4) Compatibilidad con maquinaria

Relación recomendada:

- `materiaPrimaId`
- `plantillaMaquinaria` (obligatorio)
- `maquinaId` (opcional)
- `perfilOperativoId` (opcional)
- `modoUso` (`sustrato_directo|tinta|transferencia|auxiliar`)
- `consumoBase`
- `unidadConsumo`
- `mermaBasePct`

---

## 5) Recomendación sobre "revisar todas las materias primas posibles"

Sí, pero con criterio de implementación:

1. No intentar universo infinito.
2. Cerrar un `universo controlado V1` por familias/subfamilias.
3. Dejar el sistema extensible por nuevos templates versionados.

Regla práctica:

- cubrir 80-90% de casos reales del negocio objetivo en V1;
- agregar long-tail por iteración sin rediseñar el modelo.

Priorizacion sugerida para no trabar implementacion:

1. `V1`: familias A, B, C, D y J.
2. `V1.1`: familias F, G, H, K y M.
3. `V2`: familias L, N y O + semielaborados avanzados.

Lista rápida de accesorios críticos para cubrir competitividad:

1. Argollas y accesorios de llavero (M1).
2. Ojales/ojalillos/remaches para lona y textil (M2).
3. Portabanners (roll-up, X, L, pop-up) (M3).
4. Sistemas de colgado y separación mural (M4).
5. Perfiles bastidor textil (M5).
6. Cintas técnicas y adhesivos estructurales (N1, N2).
7. Velcros/dual lock para montaje reversible (N3).
8. Embalaje e insumos de instalación/despacho (O1, O3).

---

## 6) Criterios de aceptación de este documento (antes de implementar)

1. Cada materia prima del negocio cae en una subfamilia clara.
2. Cada subfamilia tiene campos técnicos mínimos definidos.
3. No hay campos ambiguos entre subfamilias.
4. Existe estrategia para agregar subfamilias nuevas sin migraciones destructivas.

---

## 7) Decisiones a confirmar

1. ¿Incluimos `objeto_promocional_base` (tazas, termos, etc.) dentro de Materia Prima en V1?
2. ¿Control de lote obligatorio solo para familias críticas o para todas?
3. ¿Compatibilidad solo por `plantillaMaquinaria` en V1, o también por `maquina` desde inicio?
4. ¿Queremos habilitar en V1.1 electrónica y neón con stock valorizado o solo como catálogo técnico sin inventario?
5. ¿Los insumos de encuadernación/plastificado se imputan por proceso o por BOM de producto?
6. ¿Portabanners se tratarán como materia prima, producto comercial o ambos (según se compre o se arme)?

---

## 8) Referencias de investigacion para ampliar categorias

- Avery Dennison Graphics Solutions: https://graphics.averydennison.com/
- ORAFOL / ORACAL films: https://www.orafol.com/
- 3M Graphics and Signage: https://www.3m.com/
- Roland DG (aplicaciones print & cut): https://www.rolanddg.com/
- SloanLED (módulos LED signage): https://www.sloanled.com/
- MEAN WELL (fuentes LED): https://www.meanwell.com/
- Principal LED (neón y módulos): https://www.principalled.com/
- GBC (laminado y encuadernación): https://www.gbc.com/
- Renz (wire-o y encuadernación): https://www.renz.com/
- MyBinding (guías de anillado y capacidades): https://www.mybinding.com/
