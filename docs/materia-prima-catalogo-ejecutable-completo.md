# Catalogo Ejecutable Completo - Modulo Materia Prima

Fecha: 2026-03-12
Estado: Propuesta lista para implementacion

## 1) Objetivo

Definir un catalogo completo y ejecutable del modulo `Materia Prima` para este ERP, incluyendo:

1. taxonomia completa (familias/subfamilias/tipos)
2. campos obligatorios y opcionales por subfamilia
3. enums canónicos
4. unidades y conversiones permitidas
5. reglas de validacion
6. compatibilidad con maquinaria/perfiles
7. base directa para `Prisma + DTO + UI`

Este documento prioriza cobertura amplia (no minima) para competir con soluciones MIS/ERP graficas que ya cubren escenarios extendidos.

---

## 2) Principio de modelado definitivo

Modelo hibrido:

1. `Core comun` para todas las materias primas.
2. `Template por subfamilia` para atributos tecnicos.
3. `JSON schema versionado` por template.
4. `Enums canonicos` para consistencia transversal.

Decisión: no usar EAV puro, no usar tabla fisica por cada tipo.

---

## 3) Core comun obligatorio

Entidad base `MateriaPrima`:

- `id` (uuid)
- `tenantId` (uuid)
- `codigo` (string, unico por tenant)
- `nombre` (string)
- `descripcion` (string?)
- `familia` (enum)
- `subfamilia` (enum)
- `tipoTecnico` (enum/string controlado)
- `templateId` (string)
- `templateVersion` (int)
- `unidadStock` (enum)
- `unidadCompra` (enum)
- `factorConversionCompra` (decimal > 0)
- `controlLote` (bool)
- `controlVencimiento` (bool)
- `activo` (bool)
- `atributosTecnicosJson` (json validado por schema)
- `createdAt`
- `updatedAt`

Relaciones core:

- `MateriaPrimaProveedor[]`
- `MateriaPrimaCompatibilidadMaquina[]`
- `StockMateriaPrima[]`
- `MovimientoMateriaPrima[]`

---

## 4) Enums canonicos

## 4.1 FamiliaMateriaPrima

- `SUSTRATO`
- `TINTA_COLORANTE`
- `TRANSFERENCIA_LAMINACION`
- `QUIMICO_AUXILIAR`
- `ADITIVA_3D`
- `ELECTRONICA_CARTELERIA`
- `NEON_LUMINARIA`
- `METAL_ESTRUCTURA`
- `PINTURA_RECUBRIMIENTO`
- `TERMINACION_EDITORIAL`
- `MAGNETICO_FIJACION`
- `POP_EXHIBIDOR`
- `HERRAJE_ACCESORIO`
- `ADHESIVO_TECNICO`
- `PACKING_INSTALACION`

## 4.2 SubfamiliaMateriaPrima

- `SUSTRATO_HOJA`
- `SUSTRATO_ROLLO_FLEXIBLE`
- `SUSTRATO_RIGIDO`
- `OBJETO_PROMOCIONAL_BASE`
- `TINTA_IMPRESION`
- `TONER`
- `FILM_TRANSFERENCIA`
- `PAPEL_TRANSFERENCIA`
- `LAMINADO_FILM`
- `QUIMICO_ACABADO`
- `AUXILIAR_PROCESO`
- `POLVO_DTF`
- `FILAMENTO_3D`
- `RESINA_3D`
- `MODULO_LED_CARTELERIA`
- `FUENTE_ALIMENTACION_LED`
- `CABLEADO_CONECTICA`
- `CONTROLADOR_LED`
- `NEON_FLEX_LED`
- `ACCESORIO_NEON_LED`
- `CHAPA_METALICA`
- `PERFIL_ESTRUCTURAL`
- `PINTURA_CARTELERIA`
- `PRIMER_SELLADOR`
- `ANILLADO_ENCUADERNACION`
- `TAPA_ENCUADERNACION`
- `IMAN_CERAMICO_FLEXIBLE`
- `FIJACION_AUXILIAR`
- `ACCESORIO_EXHIBIDOR_CARTON`
- `ACCESORIO_MONTAJE_POP`
- `SEMIELABORADO_POP`
- `ARGOLLA_LLAVERO_ACCESORIO`
- `OJAL_OJALILLO_REMACHE`
- `PORTABANNER_ESTRUCTURA`
- `SISTEMA_COLGADO_MONTAJE`
- `PERFIL_BASTIDOR_TEXTIL`
- `CINTA_DOBLE_FAZ_TECNICA`
- `ADHESIVO_LIQUIDO_ESTRUCTURAL`
- `VELCRO_CIERRE_TECNICO`
- `EMBALAJE_PROTECCION`
- `ETIQUETADO_IDENTIFICACION`
- `CONSUMIBLE_INSTALACION`

## 4.3 UnidadMateriaPrima

- `UNIDAD`
- `PACK`
- `CAJA`
- `KIT`
- `HOJA`
- `PLIEGO`
- `RESMA`
- `ROLLO`
- `METRO_LINEAL`
- `M2`
- `M3`
- `MM`
- `CM`
- `LITRO`
- `ML`
- `KG`
- `GRAMO`
- `PIEZA`
- `PAR`

## 4.4 ModoUsoCompatibilidad

- `SUSTRATO_DIRECTO`
- `TINTA`
- `TRANSFERENCIA`
- `LAMINACION`
- `AUXILIAR`
- `MONTAJE`
- `EMBALAJE`

---

## 5) Templates por subfamilia (completo)

Formato por template:

1. `required[]`
2. `optional[]`
3. `allowedUnitsStock[]`
4. `allowedUnitsCompra[]`
5. `rules[]`

## 5.1 SUSTRATO_HOJA

required:

- `anchoMm`
- `altoMm`
- `gramajeGm2`
- `acabado`
- `colorBase`

optional:

- `fibraDireccion`
- `aptoLaser`
- `aptoInkjet`
- `marca`
- `lineaProducto`

allowedUnitsStock:

- `HOJA`
- `PLIEGO`

allowedUnitsCompra:

- `RESMA`
- `CAJA`
- `HOJA`

rules:

- `anchoMm > 0`
- `altoMm > 0`
- `gramajeGm2 in [40, 1000]`
- `factorConversionCompra > 0`

## 5.2 SUSTRATO_ROLLO_FLEXIBLE

required:

- `anchoRolloMm`
- `largoRolloM`
- `espesorMicrones` o `gramajeGm2`
- `acabado`

optional:

- `tipoAdhesivo`
- `aplicacionInteriorExterior`
- `colorBase`
- `tecnologiaCompatible[]`

allowedUnitsStock:

- `ROLLO`
- `M2`
- `METRO_LINEAL`

allowedUnitsCompra:

- `ROLLO`

rules:

- `anchoRolloMm > 0`
- `largoRolloM > 0`
- `espesorMicrones > 0` (si informado)
- `gramajeGm2 > 0` (si informado)

## 5.3 SUSTRATO_RIGIDO

required:

- `anchoMm`
- `altoMm`
- `espesorMm`
- `materialBase`

optional:

- `densidad`
- `acabado`
- `colorBase`
- `tratamientoSuperficial`

allowedUnitsStock:

- `PLIEGO`
- `UNIDAD`
- `PIEZA`

allowedUnitsCompra:

- `PLIEGO`
- `UNIDAD`

rules:

- `espesorMm > 0`
- `anchoMm > 0`
- `altoMm > 0`

## 5.4 OBJETO_PROMOCIONAL_BASE

required:

- `materialBase`
- `colorBase`
- `forma` (`cilindrico|plano|otro`)

optional:

- `diametroMm`
- `altoMm`
- `anchoMm`
- `areaImprimibleMm2`
- `recubrimiento`

allowedUnitsStock:

- `UNIDAD`
- `PIEZA`

allowedUnitsCompra:

- `CAJA`
- `UNIDAD`

rules:

- `areaImprimibleMm2 > 0` (si informado)
- si `forma=cilindrico`, `diametroMm` recomendado obligatorio de negocio

## 5.5 TINTA_IMPRESION

required:

- `tecnologiaCompatible[]`
- `canalColor`
- `presentacionMl`

optional:

- `baseQuimica`
- `rendimientoReferencia`
- `codigoFabricante`

allowedUnitsStock:

- `ML`
- `LITRO`
- `UNIDAD`

allowedUnitsCompra:

- `UNIDAD`
- `CAJA`

rules:

- `presentacionMl > 0`
- `canalColor` en catalogo controlado

## 5.6 TONER

required:

- `color`
- `rendimientoPaginasIso`

optional:

- `oemOAlternativo`
- `codigoFabricante`

allowedUnitsStock:

- `UNIDAD`

allowedUnitsCompra:

- `UNIDAD`
- `CAJA`

rules:

- `rendimientoPaginasIso > 0`

## 5.7 FILM_TRANSFERENCIA

required:

- `anchoMm`
- `largoM`
- `tipoRelease`

optional:

- `espesorMicrones`
- `tecnologiaCompatible[]`

allowedUnitsStock:

- `ROLLO`
- `M2`

allowedUnitsCompra:

- `ROLLO`

rules:

- `anchoMm > 0`
- `largoM > 0`

## 5.8 PAPEL_TRANSFERENCIA

required:

- `gramajeGm2`
- `ladoImprimible`

optional:

- `anchoMm`
- `altoMm`
- `anchoRolloMm`
- `largoRolloM`

allowedUnitsStock:

- `HOJA`
- `ROLLO`

allowedUnitsCompra:

- `RESMA`
- `ROLLO`

rules:

- formato hoja o formato rollo debe existir al menos uno

## 5.9 LAMINADO_FILM

required:

- `anchoMm`
- `largoM`
- `espesorMicrones`
- `acabado`

optional:

- `tipoAdhesivo`
- `temperaturaLaminacionRecomendada`

allowedUnitsStock:

- `ROLLO`
- `M2`

allowedUnitsCompra:

- `ROLLO`

rules:

- `espesorMicrones > 0`

## 5.10 QUIMICO_ACABADO

required:

- `presentacionMl`
- `tecnologiaCompatible[]`

optional:

- `superficiesCompatibles[]`
- `baseQuimica`

allowedUnitsStock:

- `ML`
- `LITRO`
- `UNIDAD`

allowedUnitsCompra:

- `UNIDAD`
- `CAJA`

rules:

- `presentacionMl > 0`

## 5.11 AUXILIAR_PROCESO

required:

- `usoTecnico`
- `presentacion`

optional:

- `compatibilidadEquipo`
- `superficiesCompatibles[]`

allowedUnitsStock:

- `UNIDAD`
- `PACK`
- `CAJA`
- `ROLLO`

allowedUnitsCompra:

- `UNIDAD`
- `CAJA`

rules:

- string no vacío en `usoTecnico`

## 5.12 POLVO_DTF

required:

- `tipoPolvo`
- `rangoTemperaturaAplicacion`

optional:

- `granulometria`

allowedUnitsStock:

- `KG`
- `GRAMO`

allowedUnitsCompra:

- `KG`
- `CAJA`

rules:

- `temperaturaMin < temperaturaMax` (si estructurado)

## 5.13 FILAMENTO_3D

required:

- `materialPolimero`
- `diametroMm`
- `pesoKg`

optional:

- `rangoTemperaturaExtrusion`

allowedUnitsStock:

- `KG`
- `UNIDAD`

allowedUnitsCompra:

- `UNIDAD`

rules:

- `diametroMm in [1.75, 2.85]` recomendado
- `pesoKg > 0`

## 5.14 RESINA_3D

required:

- `tipoResina`
- `presentacionMl`

optional:

- `longitudOndaCurado`
- `aplicacion`

allowedUnitsStock:

- `ML`
- `LITRO`

allowedUnitsCompra:

- `UNIDAD`

rules:

- `presentacionMl > 0`

## 5.15 MODULO_LED_CARTELERIA

required:

- `voltajeNominal`
- `potenciaW`
- `gradoIp`

optional:

- `temperaturaColorK`
- `luminosidadLm`
- `tipoLente`
- `pasoModulosRecomendadoMm`

allowedUnitsStock:

- `UNIDAD`
- `PACK`

allowedUnitsCompra:

- `PACK`
- `CAJA`

rules:

- `voltajeNominal in {12,24}` recomendado
- `potenciaW > 0`

## 5.16 FUENTE_ALIMENTACION_LED

required:

- `entradaVac`
- `salidaVdc`
- `corrienteA`
- `potenciaW`

optional:

- `factorPotencia`
- `gradoIp`
- `certificaciones[]`

allowedUnitsStock:

- `UNIDAD`

allowedUnitsCompra:

- `UNIDAD`
- `CAJA`

rules:

- `potenciaW >= salidaVdc * corrienteA` (tolerancia técnica)

## 5.17 CABLEADO_CONECTICA

required:

- `tipoCable`
- `seccionAwgMm2`
- `materialConductor`

optional:

- `aislacion`
- `gradoIp`
- `temperaturaMaxOperacion`

allowedUnitsStock:

- `METRO_LINEAL`
- `ROLLO`
- `UNIDAD`

allowedUnitsCompra:

- `ROLLO`
- `UNIDAD`

rules:

- `seccionAwgMm2` válido según patrón AWG/mm2

## 5.18 CONTROLADOR_LED

required:

- `canales`
- `protocoloControl`
- `voltajeTrabajo`

optional:

- `corrienteMaxCanal`

allowedUnitsStock:

- `UNIDAD`

allowedUnitsCompra:

- `UNIDAD`

rules:

- `canales > 0`

## 5.19 NEON_FLEX_LED

required:

- `voltajeNominal`
- `potenciaWm`
- `gradoIp`
- `pasoCorteMm`

optional:

- `temperaturaColorK`
- `colorLuz`
- `radioMinCurvaturaMm`

allowedUnitsStock:

- `METRO_LINEAL`
- `ROLLO`

allowedUnitsCompra:

- `ROLLO`
- `METRO_LINEAL`

rules:

- `potenciaWm > 0`
- `pasoCorteMm > 0`

## 5.20 ACCESORIO_NEON_LED

required:

- `tipoAccesorio`
- `compatibilidadPerfil`

optional:

- `material`
- `unidadPorPack`

allowedUnitsStock:

- `UNIDAD`
- `PACK`

allowedUnitsCompra:

- `PACK`
- `UNIDAD`

rules:

- `tipoAccesorio` no vacío

## 5.21 CHAPA_METALICA

required:

- `materialMetal`
- `anchoMm`
- `altoMm`
- `espesorMm`

optional:

- `acabadoSuperficial`
- `tratamientoAnticorrosivo`

allowedUnitsStock:

- `PLIEGO`
- `UNIDAD`

allowedUnitsCompra:

- `PLIEGO`
- `UNIDAD`

rules:

- `espesorMm > 0`

## 5.22 PERFIL_ESTRUCTURAL

required:

- `seccionPerfil`
- `largoMm`
- `material`

optional:

- `espesorMm`

allowedUnitsStock:

- `UNIDAD`
- `METRO_LINEAL`

allowedUnitsCompra:

- `UNIDAD`
- `METRO_LINEAL`

rules:

- `largoMm > 0`

## 5.23 PINTURA_CARTELERIA

required:

- `tipoPintura`
- `base`
- `acabado`
- `color`

optional:

- `rendimientoM2L`
- `tiempoSecado`
- `resistenciaUvExterior`

allowedUnitsStock:

- `LITRO`
- `ML`
- `UNIDAD`

allowedUnitsCompra:

- `UNIDAD`
- `CAJA`

rules:

- `rendimientoM2L > 0` si informado

## 5.24 PRIMER_SELLADOR

required:

- `superficieObjetivo`
- `baseQuimica`

optional:

- `rendimientoM2L`
- `tiempoCurado`

allowedUnitsStock:

- `LITRO`
- `ML`
- `UNIDAD`

allowedUnitsCompra:

- `UNIDAD`

rules:

- `superficieObjetivo` no vacía

## 5.25 ANILLADO_ENCUADERNACION

required:

- `tipoAnillado`
- `diametroMm`
- `material`

optional:

- `paso`
- `color`
- `capacidadHojasRef`

allowedUnitsStock:

- `UNIDAD`
- `CAJA`
- `PACK`

allowedUnitsCompra:

- `CAJA`
- `PACK`

rules:

- `diametroMm > 0`

## 5.26 TAPA_ENCUADERNACION

required:

- `material`
- `formato`

optional:

- `espesorMicronesMm`
- `acabado`
- `color`

allowedUnitsStock:

- `UNIDAD`
- `CAJA`

allowedUnitsCompra:

- `CAJA`
- `UNIDAD`

rules:

- formato en catálogo permitido

## 5.27 IMAN_CERAMICO_FLEXIBLE

required:

- `tipoIman`
- `espesorMm`

optional:

- `gradoMagnetico`
- `anchoMm`
- `altoMm`
- `diametroMm`
- `fuerzaSujecionRef`
- `adhesivo`

allowedUnitsStock:

- `UNIDAD`
- `M2`
- `ROLLO`

allowedUnitsCompra:

- `UNIDAD`
- `ROLLO`

rules:

- `espesorMm > 0`

## 5.28 FIJACION_AUXILIAR

required:

- `tipoFijacion`
- `material`

optional:

- `medidaNominal`
- `resistenciaRef`

allowedUnitsStock:

- `UNIDAD`
- `PACK`
- `CAJA`

allowedUnitsCompra:

- `PACK`
- `CAJA`

rules:

- `tipoFijacion` en catálogo

## 5.29 ACCESORIO_EXHIBIDOR_CARTON

required:

- `tipoAccesorio`
- `materialBase`

optional:

- `anchoMm`
- `altoMm`
- `espesorMm`
- `capacidadCargaRef`

allowedUnitsStock:

- `UNIDAD`
- `KIT`

allowedUnitsCompra:

- `UNIDAD`
- `KIT`

rules:

- `tipoAccesorio` no vacío

## 5.30 ACCESORIO_MONTAJE_POP

required:

- `tipoAccesorio`
- `formatoPresentacion`

optional:

- `resistenciaRef`
- `superficiesCompatibles[]`

allowedUnitsStock:

- `UNIDAD`
- `PACK`

allowedUnitsCompra:

- `PACK`
- `CAJA`

rules:

- `tipoAccesorio` no vacío

## 5.31 SEMIELABORADO_POP

required:

- `composicion`
- `estadoSemielaborado`
- `unidadUso`

optional:

- `dimensionesBase`

allowedUnitsStock:

- `UNIDAD`
- `KIT`

allowedUnitsCompra:

- `UNIDAD`

rules:

- `estadoSemielaborado` en catálogo controlado

## 5.32 ARGOLLA_LLAVERO_ACCESORIO

required:

- `tipoAccesorio`
- `material`

optional:

- `diametroInteriorMm`
- `diametroExteriorMm`
- `acabado`
- `resistenciaRef`
- `unidadPorPack`

allowedUnitsStock:

- `UNIDAD`
- `PACK`

allowedUnitsCompra:

- `PACK`
- `CAJA`

rules:

- diámetros positivos si informados

## 5.33 OJAL_OJALILLO_REMACHE

required:

- `tipoOjal`
- `diametroInteriorMm`
- `material`

optional:

- `diametroExteriorMm`
- `acabado`
- `herramientaCompatible`
- `espesorMaterialMax`

allowedUnitsStock:

- `UNIDAD`
- `PACK`

allowedUnitsCompra:

- `PACK`
- `CAJA`

rules:

- `diametroInteriorMm > 0`

## 5.34 PORTABANNER_ESTRUCTURA

required:

- `tipoPortabanner`
- `anchoGraficaMm`
- `altoGraficaMm`
- `materialEstructura`

optional:

- `incluyeBolso`
- `usoInteriorExterior`
- `pesoKg`

allowedUnitsStock:

- `UNIDAD`

allowedUnitsCompra:

- `UNIDAD`
- `CAJA`

rules:

- `anchoGraficaMm > 0`
- `altoGraficaMm > 0`

## 5.35 SISTEMA_COLGADO_MONTAJE

required:

- `tipoSistema`
- `material`

optional:

- `medidaNominal`
- `capacidadCargaRef`
- `compatibilidadSuperficie`
- `acabado`

allowedUnitsStock:

- `UNIDAD`
- `PACK`

allowedUnitsCompra:

- `PACK`
- `CAJA`

rules:

- `tipoSistema` no vacío

## 5.36 PERFIL_BASTIDOR_TEXTIL

required:

- `tipoPerfil`
- `material`
- `largoMm`

optional:

- `seccionPerfil`
- `compatibilidadTela`

allowedUnitsStock:

- `UNIDAD`
- `METRO_LINEAL`

allowedUnitsCompra:

- `UNIDAD`
- `METRO_LINEAL`

rules:

- `largoMm > 0`

## 5.37 CINTA_DOBLE_FAZ_TECNICA

required:

- `anchoMm`
- `largoM`
- `espesorMm`
- `adhesivoBase`

optional:

- `superficiesCompatibles[]`
- `resistenciaCortePeladoRef`

allowedUnitsStock:

- `ROLLO`
- `UNIDAD`

allowedUnitsCompra:

- `ROLLO`
- `CAJA`

rules:

- `anchoMm > 0`
- `largoM > 0`
- `espesorMm > 0`

## 5.38 ADHESIVO_LIQUIDO_ESTRUCTURAL

required:

- `tipoAdhesivo`
- `presentacionMl`

optional:

- `tiempoCurado`
- `resistenciaRef`
- `superficiesCompatibles[]`
- `usoInteriorExterior`

allowedUnitsStock:

- `ML`
- `LITRO`
- `UNIDAD`

allowedUnitsCompra:

- `UNIDAD`

rules:

- `presentacionMl > 0`

## 5.39 VELCRO_CIERRE_TECNICO

required:

- `anchoMm`
- `largoM`
- `tipoCierre`

optional:

- `adhesivo`
- `resistenciaRef`

allowedUnitsStock:

- `ROLLO`
- `METRO_LINEAL`

allowedUnitsCompra:

- `ROLLO`

rules:

- `anchoMm > 0`
- `largoM > 0`

## 5.40 EMBALAJE_PROTECCION

required:

- `tipoEmbalaje`
- `unidadPresentacion`

optional:

- `dimensiones`
- `espesorMicronesMm`
- `resistenciaRef`

allowedUnitsStock:

- `UNIDAD`
- `ROLLO`
- `CAJA`
- `PACK`

allowedUnitsCompra:

- `CAJA`
- `PACK`
- `UNIDAD`

rules:

- `tipoEmbalaje` no vacío

## 5.41 ETIQUETADO_IDENTIFICACION

required:

- `tipoEtiquetaTag`
- `material`
- `formato`

optional:

- `adhesivoTipo`
- `aptoExterior`

allowedUnitsStock:

- `UNIDAD`
- `ROLLO`

allowedUnitsCompra:

- `ROLLO`
- `CAJA`

rules:

- `formato` en catálogo

## 5.42 CONSUMIBLE_INSTALACION

required:

- `tipoConsumible`
- `medidaNominal`
- `material`

optional:

- `superficieObjetivo`
- `unidadPorPack`

allowedUnitsStock:

- `UNIDAD`
- `PACK`
- `CAJA`

allowedUnitsCompra:

- `PACK`
- `CAJA`

rules:

- `tipoConsumible` en catálogo controlado

---

## 6) Matriz completa de compatibilidad con plantillas de maquinaria

Regla general:

1. `MateriaPrimaCompatibilidadMaquina` se define mínimo por `subfamilia + plantillaMaquinaria`.
2. Ajuste fino opcional por `maquinaId` y `perfilOperativoId`.

Compatibilidad base por plantilla:

- `router_cnc`: SUSTRATO_RIGIDO, AUXILIAR_PROCESO, FIJACION_AUXILIAR, ADHESIVO_LIQUIDO_ESTRUCTURAL
- `corte_laser`: SUSTRATO_RIGIDO, SUSTRATO_HOJA, AUXILIAR_PROCESO, OJAL_OJALILLO_REMACHE
- `impresora_3d`: FILAMENTO_3D, RESINA_3D, AUXILIAR_PROCESO
- `impresora_dtf`: FILM_TRANSFERENCIA, TINTA_IMPRESION, POLVO_DTF, OBJETO_PROMOCIONAL_BASE (destino textil)
- `impresora_dtf_uv`: FILM_TRANSFERENCIA, TINTA_IMPRESION, QUIMICO_ACABADO, OBJETO_PROMOCIONAL_BASE
- `impresora_uv_mesa_extensora`: SUSTRATO_RIGIDO, TINTA_IMPRESION, QUIMICO_ACABADO
- `impresora_uv_cilindrica`: OBJETO_PROMOCIONAL_BASE, TINTA_IMPRESION, QUIMICO_ACABADO
- `impresora_uv_flatbed`: SUSTRATO_RIGIDO, TINTA_IMPRESION, QUIMICO_ACABADO
- `impresora_uv_rollo`: SUSTRATO_ROLLO_FLEXIBLE, TINTA_IMPRESION, LAMINADO_FILM
- `impresora_solvente`: SUSTRATO_ROLLO_FLEXIBLE, TINTA_IMPRESION, LAMINADO_FILM, AUXILIAR_PROCESO
- `impresora_inyeccion_tinta`: SUSTRATO_ROLLO_FLEXIBLE, TINTA_IMPRESION
- `impresora_latex`: SUSTRATO_ROLLO_FLEXIBLE, TINTA_IMPRESION, LAMINADO_FILM
- `impresora_sublimacion_gran_formato`: PAPEL_TRANSFERENCIA, TINTA_IMPRESION, OBJETO_PROMOCIONAL_BASE
- `impresora_laser`: SUSTRATO_HOJA, TONER, ANILLADO_ENCUADERNACION, TAPA_ENCUADERNACION
- `plotter_cad`: SUSTRATO_ROLLO_FLEXIBLE, TINTA_IMPRESION
- `mesa_de_corte`: SUSTRATO_RIGIDO, SUSTRATO_ROLLO_FLEXIBLE, OJAL_OJALILLO_REMACHE
- `plotter_de_corte`: SUSTRATO_ROLLO_FLEXIBLE, LAMINADO_FILM, CINTA_DOBLE_FAZ_TECNICA

Compatibilidad extendida transversal (producción/cartelería):

- Familias `ELECTRONICA_CARTELERIA`, `NEON_LUMINARIA`, `METAL_ESTRUCTURA`, `HERRAJE_ACCESORIO`, `ADHESIVO_TECNICO`, `PACKING_INSTALACION` se pueden asociar a procesos de terminación/montaje/logística, aunque no a una impresora específica.

---

## 7) Reglas de negocio críticas

1. Toda materia prima debe pertenecer a una `subfamilia` válida.
2. `atributosTecnicosJson` debe validar contra `templateId/templateVersion`.
3. No se permite consumo en procesos si la materia prima no tiene compatibilidad declarada.
4. Para subfamilias con lote crítico (`tinta`, `film_transferencia`, `sustratos premium`, `químicos`), `controlLote` debe ser `true` por defecto.
5. `unidadStock` y `unidadCompra` deben tener conversión directa.
6. Historial de cambios de template no debe invalidar datos históricos.

---

## 8) Estructura recomendada en Prisma (lista de modelos)

1. `MateriaPrima`
2. `MateriaPrimaProveedor`
3. `MateriaPrimaTemplateRef` (opcional si templates en DB)
4. `MateriaPrimaCompatibilidadMaquina`
5. `Almacen`
6. `AlmacenUbicacion`
7. `LoteMateriaPrima`
8. `StockMateriaPrima`
9. `MovimientoMateriaPrima`
10. `ProcesoOperacionMaterialRegla`
11. `ProcesoOperacionMaterialSnapshot` (auditoría de costo)

---

## 9) DTOs mínimos backend

1. `UpsertMateriaPrimaDto`
2. `UpsertMateriaPrimaProveedorDto`
3. `ReplaceMateriaPrimaCompatibilidadesDto`
4. `RegistrarMovimientoMateriaPrimaDto`
5. `UpsertProcesoOperacionMaterialReglaDto`

---

## 10) Pantallas frontend mínimas (cobertura completa)

1. `Catalogo Materia Prima`
2. `Ficha Materia Prima` con formulario dinámico por template
3. `Compatibilidades con Maquinaria`
4. `Stock y lotes`
5. `Movimientos/Kardex`
6. `Reglas de consumo por operación`
7. `Simulador de costo material` dentro de `Procesos`

---

## 11) Priorización de salida (completa)

## V1 (alto impacto inmediato)

- SUSTRATO_HOJA
- SUSTRATO_ROLLO_FLEXIBLE
- SUSTRATO_RIGIDO
- TINTA_IMPRESION
- TONER
- FILM_TRANSFERENCIA
- PAPEL_TRANSFERENCIA
- LAMINADO_FILM
- QUIMICO_ACABADO
- POLVO_DTF
- ANILLADO_ENCUADERNACION
- TAPA_ENCUADERNACION
- ARGOLLA_LLAVERO_ACCESORIO
- OJAL_OJALILLO_REMACHE
- PORTABANNER_ESTRUCTURA

## V1.1

- ELECTRONICA_CARTELERIA (4 subfamilias)
- NEON_LUMINARIA (2 subfamilias)
- METAL_ESTRUCTURA (2 subfamilias)
- MAGNETICO_FIJACION (2 subfamilias)
- ADHESIVO_TECNICO (3 subfamilias)

## V2

- POP_EXHIBIDOR (3 subfamilias)
- PACKING_INSTALACION (3 subfamilias)
- semielaborados avanzados y trazabilidad ampliada

---

## 12) Criterios de completitud (checklist)

1. Todo insumo real del negocio encaja en una subfamilia sin ambigüedad.
2. Cada subfamilia tiene required/optional y reglas claras.
3. Unidades y conversiones están cerradas.
4. Compatibilidad con maquinaria/procesos está modelada.
5. El catálogo permite crecer sin rediseño estructural.

---

## 13) Fuentes de soporte sectorial

- PrintVis (Warehouse / Estimation / Job Costing)
- Infor Printing Industry Pack
- CERM (material usage / PYOM)
- Avery, ORAFOL, 3M (sustratos gráficos)
- SloanLED, Mean Well, Principal LED (electrónica/neón)
- GBC, Renz, MyBinding (laminado/encuadernación)

