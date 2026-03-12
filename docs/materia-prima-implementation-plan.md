# Plan de Implementacion del Modulo Materia Prima

Fecha: 2026-03-11

## 1) Respuesta corta a la decision clave

Si: conviene implementar `templates de materia prima`, pero en formato **hibrido**:

1. `Core comun obligatorio` para todas las materias primas.
2. `Template por familia` para campos tecnicos especificos.
3. `Atributos versionados + validacion por schema`, sin crear 50 tablas especializadas.

Conclusion: no todos necesitan los mismos campos, y forzar un unico formulario plano va a generar ruido, errores de carga y mal costeo.

---

## 2) Evidencia de investigacion (industria grafica)

### PrintVis (MIS grafico)

Patrones observados:

1. `Item Type` obligatorio para usar material en estimacion (paper/ink/etc).
2. `Quality` como subtipo del item type, con campos tecnicos (gramaje, formato, fibra/grain).
3. Filtros por template/maquina/peso/calidad para restringir seleccion de materiales.
4. Campos especificos por material (sheet/web, coating, factores de consumo de tinta).

Interpretacion aplicada:

- el MIS no trata todos los materiales igual;
- usa clasificacion + configuracion especializada por tipo.

### Infor Printing Industry Pack

Patrones observados:

1. formulas de material por operacion;
2. paper consumption factors;
3. transacciones de material por trabajo/lote.

Interpretacion aplicada:

- el modelo necesita compatibilidad entre material + operacion + maquina;
- no alcanza con un maestro de inventario generico.

### CERM (label/packaging)

Patrones observados:

1. gestion de stock de materiales en MIS;
2. material usage en tiempo real;
3. PYOM (producir materiales internamente).

Interpretacion aplicada:

- dejar preparada la arquitectura para materia prima comprada y semielaborada.

---

## 3) Confirmacion sobre el analisis de TODAS las materias primas

Tomando la matriz completa por las 17 plantillas de maquinaria ya documentada en:

- `docs/materia-prima-analisis-funcional-tecnico-por-plantilla.md`

se confirma:

1. Hay un `core` transversal real (codigo, nombre, unidad, costo, lote, proveedor, etc.).
2. Hay campos exclusivos por familia:
   - sustratos: formato/gramaje/espesor/fibra;
   - tintas: canal/color/rendimiento;
   - transferencia: tipo film/papel/adhesion;
   - aditiva: diametro filamento o tipo resina;
   - auxiliares: composicion/riesgo/compatibilidad.
3. Algunas plantillas requieren doble materialidad:
   - DTF/DTF UV/sublimacion: material de impresion + material objetivo final.

Conclusion tecnica: un unico tipo plano o EAV puro seria mala decision; conviene `core + templates de familia`.

---

## 4) Diseno funcional propuesto

## 4.1 Core comun (obligatorio para todas)

Entidad `MateriaPrima`:

- `id`, `tenantId`, `codigo`, `nombre`, `descripcion`
- `familia` (enum)
- `subfamilia` (enum controlado)
- `tipoTecnico` (catalogo)
- `unidadStock`, `unidadCompra`, `factorConversionCompra`
- `controlLote` (bool), `controlVencimiento` (bool)
- `activo`
- `atributosTecnicosJson` (validados por template)
- `templateVersion`

## 4.2 Templates por familia

Entidad `MateriaPrimaTemplate` (catalogo de sistema, en codigo):

- `id`
- `familia`, `subfamilia` objetivo
- `version`
- `schemaJson` (JSON Schema)
- `uiHintsJson` (labels, placeholders, ayudas)
- `requiredFields[]`

Templates iniciales V1 sugeridos:

1. `sustrato_hoja`
2. `sustrato_rollo_flexible`
3. `sustrato_rigido`
4. `tinta`
5. `barniz_primer_quimico`
6. `transferencia_dtf_sublimacion`
7. `auxiliar_proceso`
8. `aditiva_filamento`
9. `aditiva_resina`

## 4.3 Relacion con maquinaria

Entidad `MateriaPrimaCompatibilidadMaquina`:

- `materiaPrimaId`
- `plantillaMaquinaria` (obligatorio)
- `maquinaId` (opcional)
- `perfilOperativoId` (opcional)
- `modoUso` (`sustrato_directo|tinta|transferencia|auxiliar`)
- `consumoBase`
- `unidadConsumo`
- `mermaBasePct`
- `activo`

## 4.4 Relacion con procesos

Entidad `ProcesoOperacionMaterialRegla`:

- `procesoOperacionId`
- `materiaPrimaId`
- `tipoRegla` (`fija|formula|tabla`)
- `reglaJson`
- `mermaSetup`
- `mermaRunPct`

Esto permite calcular `costoMaterial` por operacion y total tecnico.

---

## 5) Diseno tecnico (API, validaciones, costo)

### 5.1 API catalogo

- `GET /materias-primas`
- `GET /materias-primas/:id`
- `POST /materias-primas`
- `PUT /materias-primas/:id`
- `PATCH /materias-primas/:id/toggle`

Validaciones:

1. `familia/subfamilia` coherente con template.
2. `atributosTecnicosJson` valido contra schema activo.
3. conversiones de unidad sin ambiguedad.

### 5.2 API compatibilidades

- `GET /materias-primas/:id/compatibilidades`
- `PUT /materias-primas/:id/compatibilidades`

Validaciones:

1. compatibilidad por plantilla maquinara permitida.
2. si hay `perfilOperativoId`, debe corresponder a `maquinaId`.

### 5.3 API inventario

- `POST /inventario/materias-primas/movimientos`
- `GET /inventario/materias-primas/stock`
- `GET /inventario/materias-primas/kardex`

### 5.4 Integracion en costo de procesos

Extender `POST /procesos/:id/evaluar-costo` para devolver:

- `costoMaterialPorOperacion`
- `costoMaterialTotal`
- `costoTecnicoTotal = costoTiempoTotal + costoMaterialTotal`
- advertencias por falta de precio/stock/lote

---

## 6) Plan de implementacion por fases

## Fase 0 - Cierre funcional (2-3 dias)

1. congelar taxonomia V1;
2. aprobar templates de familia;
3. cerrar unidades y conversiones canonicas.

Salida:

- contrato funcional firmado.

## Fase 1 - Modelo y migraciones (3-4 dias)

1. crear entidades: `MateriaPrima`, `MateriaPrimaCompatibilidadMaquina`, `TemplateRef`;
2. crear entidades inventario: `Almacen`, `Ubicacion`, `Lote`, `Stock`, `Movimiento`;
3. indices multi-tenant y constraints.

Salida:

- migracion Prisma aplicada y verificada.

## Fase 2 - Catalogo + templates (4-5 dias)

1. implementar templates en codigo (`src/lib/materia-prima-templates.ts`);
2. validacion backend por JSON Schema;
3. CRUD API de materias primas.

Salida:

- alta/edicion validada por template.

## Fase 3 - Compatibilidad con maquinaria (3-4 dias)

1. CRUD de compatibilidades;
2. filtros por plantilla/maquina/perfil;
3. validaciones cruzadas con modulo `Maquinaria`.

Salida:

- matriz de compatibilidades operativa.

## Fase 4 - Inventario base (5-7 dias)

1. movimientos + kardex + stock por lote/ubicacion;
2. reglas de no-negativo configurables;
3. costo valorizado base por lote.

Salida:

- stock auditable de materias primas.

## Fase 5 - Integracion con Procesos/Costo (4-6 dias)

1. reglas de consumo por operacion;
2. extender evaluacion tecnica con costo material;
3. snapshots de costo para trazabilidad.

Salida:

- costo tecnico completo para cotizacion.

## Fase 6 - UI V1 (5-7 dias)

1. panel catalogo materia prima;
2. panel compatibilidades;
3. panel inventario/movimientos;
4. tab materiales en procesos.

Salida:

- flujo end-to-end usable por usuario de negocio.

## Fase 7 - QA y rollout (3-4 dias)

1. pruebas unitarias/servicio/e2e;
2. datos semilla reales (papel laser, vinilos, tintas, DTF, UV);
3. checklist de go-live.

Salida:

- modulo listo para activar progresivamente.

---

## 7) Riesgos y mitigaciones

1. Riesgo: sobre-especificar templates al inicio.
   - Mitigacion: 9 templates V1 maximos y evolucion por version.
2. Riesgo: reglas de consumo inconsistentes.
   - Mitigacion: motor unico de evaluacion y validaciones de unidad.
3. Riesgo: carga inicial extensa.
   - Mitigacion: asistente de alta por familias + import CSV.

---

## 8) Criterios de aceptacion V1

1. Se puede cargar materia prima real por familia con campos correctos.
2. Se puede vincular materia prima a plantilla/maquina/perfil.
3. Se puede registrar y auditar stock por lote.
4. `evaluar-costo` integra costo material y tiempo.
5. La salida queda lista para `Productos y servicios` y cotizacion.

---

## 9) Fuentes de referencia

- PrintVis Qualities: https://learn.printvis.com/Legacy/Warehouse/Qualities/
- PrintVis Item Type Codes: https://learn.printvis.com/Legacy/Warehouse/ItemTypeCodes/
- PrintVis Item Card: https://learn.printvis.com/Legacy/Warehouse/ItemCard/
- PrintVis Template Filters: https://learn.printvis.com/Legacy/Estimation/TemplateFilters/
- PrintVis Consume more than 1 paper: https://learn.printvis.com/Legacy/Estimation/TTConsumePaper/
- Infor Printing Industry Pack: https://docs.infor.com/csi/9.01.x/en-us/csbiolh/skin/toc-d1e12505.html
- Infor Printing Parameters: https://docs.infor.com/csi/2024.x/en-us/csbiolh/print_ind_pack_user_cl_sl/mergedprojects/sl_indprint/forms/indprint/printing_industry_parameters.html
- CERM PYOM: https://www.cerm.net/blog/produce-your-own-materials-with-cerm-733
- CIP4 JDF/XJDF: https://www.cip4.org/print-automation/jdf

