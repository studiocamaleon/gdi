# Plan de Implementacion del Modulo Procesos

## Objetivo

Implementar el modulo `Procesos` en etapas, minimizando riesgo y maximizando reutilizacion de lo ya construido en:

- modulo `Costos`
- modulo `Maquinaria`

El objetivo operativo es llegar a una V1 que deje listo el camino para `Cotizacion`.

## Principios de implementacion

1. Reusar patrones ya probados del repo (`plantillas en codigo + datos tenant en DB`).
2. No duplicar logica de costo que ya vive en `Costos`.
3. Mantener versionabilidad y trazabilidad desde el dia 1.
4. Empezar por un flujo funcional end-to-end simple antes de sumar complejidad.
5. Priorizar validaciones de consistencia entre `Proceso`, `CentroCosto` y `Maquina`.

## Alcance V1

Incluye:

- CRUD de definiciones de proceso por tenant
- creacion desde plantillas del sistema
- operaciones secuenciales con tiempos y productividad
- vinculacion de operacion con `CentroCosto` y opcional `Maquina/Perfil`
- calculo tecnico base de costo por operacion usando tarifa de centro publicada
- respuesta estructurada para consumo futuro por cotizacion

No incluye en V1:

- planificacion avanzada con calendario y carga finita
- captura shop floor en tiempo real
- integracion JDF/JMF
- simulador comercial completo de cotizacion (solo contrato tecnico)

## Fases recomendadas

### Fase 0 - Cierre funcional y contrato de dominio

Entregables:

- consolidar documento funcional (`docs/procesos-functional-analysis.md`)
- acordar enums y vocabulario canonico (`tipoOperacion`, unidades, estados)
- matriz de compatibilidad `PlantillaMaquinaria -> PlantillasProceso`

Criterio de salida:

- alcance V1 firmado y sin ambiguedades de negocio

### Fase 1 - Modelo de datos y migracion inicial

Entregables:

- modelos Prisma iniciales (minimo):
  - `ProcesoDefinicion`
  - `ProcesoOperacion`
  - `ProcesoVersion` (si se define V1) o campos de version en definicion
- enums y relaciones con:
  - `CentroCosto`
  - `Maquina`
  - `MaquinaPerfilOperativo`
- indices por tenant + estado + activos + plantilla

Criterio de salida:

- migracion aplicada en local
- constraints y relaciones validadas

### Fase 2 - Catalogo de plantillas de proceso (codigo)

Entregables:

- `src/lib/procesos.ts` (tipos compartidos)
- `src/lib/procesos-templates.ts` (catalogo oficial versionado)
- reglas de validacion por plantilla en API (similar a maquinaria rules)
- ayudas contextuales por plantilla

Criterio de salida:

- se puede crear una definicion de proceso desde plantilla oficial
- validaciones bloquean combinaciones invalidas

### Fase 3 - API backend del modulo Procesos

Entregables:

- modulo Nest: `apps/api/src/procesos/*`
- endpoints V1:
  - `GET /procesos`
  - `GET /procesos/:id`
  - `POST /procesos`
  - `PUT /procesos/:id`
  - `PATCH /procesos/:id/toggle`
  - `POST /procesos/:id/snapshot-costo?periodo=YYYY-MM`
- calculo tecnico de costo por operacion (sin margen comercial)

Criterio de salida:

- pruebas de servicio cubriendo:
  - validaciones cruzadas con centro/maquina/perfil
  - casos sin tarifa publicada
  - consistencia de formulas y unidades

### Fase 4 - UI del modulo Procesos

Entregables:

- pagina dashboard: `costos/procesos` (o ruta acordada)
- panel con:
  - listado y filtros
  - alta/edicion por pasos (wizard o sheet por tabs)
  - vista de costo tecnico por operacion y total
  - advertencias de configuracion incompleta
- componentes `shadcn/ui` siguiendo estilo actual de paneles de costos/maquinaria

Criterio de salida:

- usuario puede crear/editar un proceso util sin tocar DB ni API manualmente

### Fase 5 - Integracion fuerte con Costos

Entregables:

- resolver tarifa aplicable por `periodo` y `centroCostoId`
- reglas de fallback y advertencias estandarizadas
- snapshot de tarifas usadas en cada evaluacion de proceso

Criterio de salida:

- resultado de costo de proceso es reproducible para el mismo periodo y version

### Fase 6 - Contrato tecnico para Cotizacion

Entregables:

- endpoint/servicio de evaluacion reutilizable por futuro modulo cotizador
- DTO estable con:
  - tiempos por operacion
  - costos por operacion
  - costo total tecnico
  - advertencias y supuestos

Criterio de salida:

- cotizacion futura puede consumir el contrato sin recalcular reglas desde cero

## Orden recomendado de ejecucion

1. Fase 0
2. Fase 1
3. Fase 2
4. Fase 3
5. Fase 4
6. Fase 5
7. Fase 6

## Riesgos y mitigaciones

1. Riesgo: sobrecargar V1 con planificacion avanzada.
   Mitigacion: mantener V1 enfocada en definicion + costo tecnico.
2. Riesgo: inconsistencias de unidad entre procesos y centros.
   Mitigacion: validaciones estrictas y catalogo canonico de unidades.
3. Riesgo: costo poco confiable por falta de tarifas publicadas.
   Mitigacion: bloqueo funcional o estado "provisorio" con advertencias claras.
4. Riesgo: duplicacion de logica entre modulos.
   Mitigacion: servicio de costo centralizado y reutilizable.

## Criterios de aceptacion V1

1. Existe CRUD completo de procesos versionables por tenant.
2. Cada operacion referencia un centro de costo valido.
3. El costo de proceso se calcula con tarifas publicadas del periodo.
4. Se puede partir de plantillas oficiales por tipo de maquinaria.
5. La salida tecnica queda lista para consumo por cotizacion.

## Alineacion funcional aplicada (P1, P2, P3)

### P1 - Definicion operativa y UX base

1. `TipoProceso` soporta `maquinaria`, `manual` y `mixto`.
2. Proceso `manual`:
   - no requiere plantilla de maquinaria
   - no permite guardar maquina/perfil operativo en operaciones
3. Centro de costo por operacion:
   - sigue siendo obligatorio a nivel funcional
   - cuando se selecciona maquina, el sistema autocompleta centro con `centroCostoPrincipalId` si el usuario no lo definio
4. Unidades operativas:
   - `unidadEntrada`, `unidadSalida` y `unidadTiempo` usan catalogo canonico (enum), sin texto libre
5. Codigos:
   - codigo de proceso generado por backend en alta
   - codigos de operaciones generados por backend por orden (`OP-001`, `OP-002`, ...)
   - UI en solo lectura para evitar duplicados/carga manual inconsistente

### P2 - Consistencia cruzada y contrato de costo

1. Compatibilidad `maquina` vs `plantilla` del proceso:
   - en procesos `maquinaria` se valida coincidencia de plantilla en backend
2. Relacion maquina-centro:
   - si difiere `centroCostoId` de operacion vs `centroCostoPrincipalId` de maquina, se registra `warning`
   - no bloquea guardado por ahora (decision explicita para operacion controlada)
3. Snapshot de costo:
   - endpoint `POST /procesos/:id/snapshot-costo?periodo=YYYY-MM`
   - devuelve costo por operacion, total, advertencias y estado `validaParaCotizar`

### P3 - Versionado y trazabilidad

1. `ProcesoDefinicion.currentVersion` mantiene la version vigente.
2. Cada alta/edicion persiste snapshot en `ProcesoVersion`.
3. Endpoint `GET /procesos/:id/versiones` expone historico versionado.

## Siguiente paso recomendado

Completar pruebas de servicio/end-to-end de `Procesos` y preparar contrato de consumo para el futuro modulo `Productos y servicios`.
