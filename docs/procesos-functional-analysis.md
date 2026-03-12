# Analisis Funcional del Modulo Procesos (ERP Industria Grafica)

## Objetivo

Definir como debe implementarse el modulo `Procesos` para:

- modelar rutas productivas por tipo de maquina (plantillas)
- conectar esas rutas con `Costos` y `Maquinaria` ya existentes
- preparar una base solida para un futuro motor de `Cotizacion`
- servir de capa de integracion con modulos futuros (produccion, shop floor, compras, calidad)

Fecha de referencia del analisis: `2026-03-11`.

## Metodologia

Se relevo:

- estructura actual del proyecto (`Prisma`, `CostosService`, `MaquinariaService`, paneles de UI)
- patron documental ya usado en `Maquinaria`
- practicas de mercado en MIS/ERP graficos y MRP estandar (fuentes al final)

## Hallazgos de investigacion externa

### 1) El nucleo funcional es `Operacion + Unidad + Centro/Capacidad`

Patron repetido en PrintVis, Odoo y ERPNext:

- la estimacion se arma con operaciones
- cada operacion se ejecuta en un centro/workstation
- el costo depende de tiempo, capacidad y tarifa/costo horario
- la unidad de medida operativa debe estar atada a la estimacion para comparar estimado vs real

Implicacion para nuestro ERP:

- `Procesos` no debe ser solo una lista de pasos descriptivos
- debe guardar semantica operativa medible para costear y luego controlar ejecucion

### 2) Separacion explicita entre `setup` y `run`

En software de referencia se separa:

- tiempo de preparacion (makeready/setup)
- tiempo productivo (run)
- limpieza/cierre

Implicacion:

- cada operacion de proceso debe soportar al menos `setupMin`, `runFormula`, `cleanupMin`
- este corte permite cotizar mejor, planificar mejor y explicar desvio real luego

### 3) Velocidad y merma no se modelan como valores unicos fijos

En MIS graficos maduros se usan tablas/reglas para:

- velocidad por rangos de tirada/formato/material/configuracion
- merma por proceso/maquina/corrida/configuracion

Implicacion:

- el modulo debe permitir reglas por plantilla/operacion (con fallback simple V1)
- sin esto, las cotizaciones no van a escalar bien entre tecnologias y tiradas

### 4) Routing flexible con capacidades y alternativas

Patron comun:

- operacion principal + centros alternativos
- calendarios/turnos/capacidad
- posibilidad de planificar temprano o tarde segun fecha objetivo

Implicacion:

- `Procesos` debe guardar la ruta canonical y centros alternativos posibles
- planificacion fina puede ser fase posterior, pero la estructura base debe existir en V1

### 5) Integracion MIS-Shop Floor-Dispositivos via estandares

CIP4 (JDF/JMF/XJDF + ICS) confirma una arquitectura manager/worker:

- MIS define orden/proceso
- preprensa/prensa/postprensa ejecutan y reportan estados/metricas

Implicacion:

- conviene dejar desde V1 identificadores y estados que luego permitan integraciones
- no hace falta implementar JDF en V1, pero si evitar un modelo cerrado que lo bloquee

## Diagnostico del sistema actual (interno)

### Lo que ya esta bien resuelto

- `Costos` tiene base organizativa y economica robusta:
  - `Planta`, `AreaCosto`, `CentroCosto`
  - componentes de costo por periodo
  - capacidad practica por periodo
  - tarifa calculada/publicada por periodo (`costoMensualTotal / capacidadPractica`)
- `Maquinaria` ya tiene:
  - catalogo de plantillas en codigo
  - maquinas por tenant
  - perfiles operativos
  - consumibles y componentes de desgaste
  - vinculacion opcional a centro de costo principal

### Brecha funcional actual

No existe una capa intermedia que diga:

- que secuencia operativa aplicar para un producto/tipo de trabajo
- con que centros/maquinas/perfiles correr cada paso
- como convertir cantidades de entrada/salida entre pasos
- como transformar tiempos/consumos en costo de proceso reutilizable en cotizacion

## Objetivos funcionales del modulo Procesos

1. Definir procesos versionables por tenant, basados en plantillas del sistema.
2. Permitir rutas por tipo de maquinaria con operaciones ordenadas.
3. Enlazar cada operacion con `CentroCosto` (y opcionalmente `Maquina`/`PerfilOperativo`).
4. Calcular tiempo/costo tecnico por operacion con reglas de setup, velocidad y merma.
5. Dejar salida estructurada para futuro modulo de cotizacion.
6. Soportar trazabilidad posterior estimado vs real (aunque la captura real llegue en fases futuras).

## Modelo funcional propuesto (V1-V1.5)

### Decision estructural principal

Mantener el mismo patron que `Maquinaria`:

- `plantillas del sistema` en codigo versionado
- `definiciones concretas` de tenant persistidas en DB

Esto asegura consistencia inter-tenant sin impedir adaptacion local.

### Entidades funcionales sugeridas

1. `PlantillaProcesoSistema` (codigo):
   - id de plantilla, familia, pasos recomendados, reglas default, ayuda contextual
2. `ProcesoDefinicion` (DB):
   - proceso usable por tenant (ej: "UV Rollo con laminado y corte")
   - referencia a plantilla origen y version
3. `ProcesoOperacion` (DB):
   - secuencia de pasos
   - setup/run/cleanup
   - formula o modo de calculo
   - merma base y/o regla
   - vinculacion a centro/maquina/perfil
4. `ProcesoReglaConsumo` (DB o JSON validado):
   - regla de consumo para insumo/desgaste aplicable al paso
5. `ProcesoVersion` (DB, opcional V1.5):
   - historico de cambios para auditoria y reproducibilidad de cotizacion

### Campos clave por operacion de proceso

- identificacion: `codigo`, `nombre`, `orden`
- clasificacion: `tipoOperacion` (`preprensa|impresion|terminacion|logistica|tercerizado`)
- vinculacion productiva: `centroCostoId` (obligatorio), `maquinaId` (opcional), `perfilOperativoId` (opcional)
- unidad de trabajo: `unidadEntrada`, `unidadSalida`, `unidadTiempo`
- tiempos: `setupMin`, `cleanupMin`, `tiempoFijoMin`
- productividad: `modoProductividad` (`fija|formula|tabla`)
- regla de velocidad: `velocidadBase` y/o `reglaVelocidadJson`
- regla de merma: `mermaFijaPct` y/o `reglaMermaJson`
- alternativos: centros/maquinas alternativas (opcional V1.5)
- gobernanza: `activo`, `estadoConfiguracion`, `vigenciaDesde`, `vigenciaHasta`

## Plantillas por tipo de maquina (direccion funcional)

Para cada `PlantillaMaquinaria`, definir una o mas plantillas de proceso recomendadas:

1. `impresora_laser`:
   - preflight -> impresion digital -> corte -> terminacion
2. `impresora_uv_rollo`:
   - preflight -> impresion UV rollo -> secado/curado -> laminado opcional -> corte/plotter
3. `impresora_uv_flatbed`:
   - preflight -> impresion UV plano -> curado -> terminacion
4. `impresora_dtf` / `impresora_dtf_uv`:
   - impresion -> transferencia/laminado segun tecnologia -> corte/finalizacion
5. `router_cnc` / `corte_laser`:
   - preparacion archivo -> mecanizado/corte -> limpieza/retiro -> control

Nota: no significa proceso unico. Significa `template base` para reducir friccion de carga y asegurar coherencia.

## Integracion con Costos (modulo ya existente)

Regla de costo de operacion propuesta:

`costoOperacion = costoTiempo + costoInsumos + costoDesgaste + costoTercerizado`

donde:

- `costoTiempo = horasEfectivas * tarifaCentroCosto(periodo, estado=PUBLICADA)`
- `horasEfectivas = (setup + run + cleanup) / 60`
- `run` depende de cantidad neta + merma y de regla de velocidad
- `costoInsumos` sale de regla de proceso + consumibles de maquina (si aplica)
- `costoDesgaste` sale de vida util/costo reposicion de componentes (si aplica)

Reglas de negocio recomendadas:

1. Si no hay tarifa `PUBLICADA` para el periodo, bloquear calculo final de cotizacion (o marcarla provisoria).
2. Validar compatibilidad entre unidad base del centro y unidad de la operacion.
3. Guardar snapshot de tarifa usada para auditoria de cotizacion.

## Integracion con Maquinaria (modulo ya existente)

1. `ProcesoOperacion` puede enlazar una `Maquina` concreta.
2. Si enlaza `Maquina`, puede exigir `PerfilOperativo` para tomar productividad realista.
3. Reglas de consumo pueden leer `MaquinaConsumible` y `MaquinaComponenteDesgaste`.
4. Plantillas de proceso deben filtrar maquinas compatibles por `PlantillaMaquinaria` y geometria.

## Como habilita la Cotizacion futura

Salida esperada del modulo `Procesos` para `Cotizacion`:

- ruta productiva completa (pasos ordenados)
- tiempos y cantidades por paso
- costo tecnico por paso
- costo total tecnico del proceso
- metadatos de riesgo (advertencias por falta de tarifa/capacidad/perfil)

Esto permite:

- calcular precio tecnico por trabajo sin reconfigurar operaciones cada vez
- comparar escenarios (cambio de maquina, calidad, tirada)
- versionar supuestos para trazabilidad comercial

## Integracion con modulos futuros

1. `Produccion/Ordenes`:
   - instanciar la ruta de proceso versionada en una orden concreta
2. `Shop Floor`:
   - registrar tiempo real por operacion y comparar con estimado
3. `Compras/Subcontratacion`:
   - disparar requerimientos para pasos tercerizados o insumos faltantes
4. `Calidad`:
   - checklists y resultados por operacion
5. `BI/KPIs`:
   - desvio estimado vs real, OEE, merma real vs estimada, costo por familia/proceso

## Criterios de calidad para V1

1. Cualquier proceso debe poder costearse usando tarifas de centros publicadas.
2. Debe existir una forma clara de mapear proceso <-> maquinaria <-> centro de costo.
3. El modelo debe soportar versionado basico de definiciones.
4. Debe ser posible crear procesos desde plantillas con baja friccion.
5. Debe evitarse duplicar logica ya existente en `Costos` y `Maquinaria`.

## Decisiones aplicadas en implementacion

1. Se habilita `tipoProceso` (`maquinaria`, `manual`, `mixto`) para cubrir procesos sin maquina.
2. En operaciones con maquina, el centro se autocompleta con el centro principal de la maquina si viene vacio.
3. Si el centro elegido difiere del centro principal de la maquina, se informa advertencia y no bloqueo.
4. Unidades de entrada/salida/tiempo se normalizan con enum canonico, sin texto libre.
5. Codigo de proceso y codigos de operacion son generados por sistema para minimizar duplicados.
6. Se versiona cada alta/edicion en `ProcesoVersion` para trazabilidad y reproducibilidad de costos.

## Fuentes consultadas (externas)

- PrintVis Job Costing: [learn.printvis.com/Legacy/JobCosting/JobCosting](https://learn.printvis.com/Legacy/JobCosting/JobCosting/)
- PrintVis Calculation Units: [learn.printvis.com/Legacy/Estimation/CalcUnits](https://learn.printvis.com/Legacy/Estimation/CalcUnits/)
- PrintVis Estimating: [learn.printvis.com/Legacy/Estimation/Estimating](https://learn.printvis.com/Legacy/Estimation/Estimating/)
- PrintVis Speed Table: [learn.printvis.com/Legacy/Estimation/SpeedTable](https://learn.printvis.com/Legacy/Estimation/SpeedTable/)
- PrintVis Scrap Table: [learn.printvis.com/Legacy/Estimation/ScrapTable](https://learn.printvis.com/Legacy/Estimation/ScrapTable/)
- PrintVis Estimate Master Data: [learn.printvis.com/Legacy/Estimation/EstimateMasterData](https://learn.printvis.com/Legacy/Estimation/EstimateMasterData/)
- PrintVis Planning Board: [learn.printvis.com/Legacy/Planning/PlanningBoard](https://learn.printvis.com/Legacy/Planning/PlanningBoard/)
- Odoo 19 Work Centers: [odoo.com/documentation/19.0/.../using_work_centers.html](https://www.odoo.com/documentation/19.0/applications/inventory_and_mrp/manufacturing/advanced_configuration/using_work_centers.html)
- ERPNext Operation: [docs.frappe.io/erpnext/operation](https://docs.frappe.io/erpnext/operation)
- ERPNext Workstation: [docs.frappe.io/erpnext/workstation](https://docs.frappe.io/erpnext/workstation)
- CIP4 Specifications: [cip4.org/print-automation/specifications/articles/specifications](https://www.cip4.org/print-automation/specifications/articles/specifications)
- CIP4 JDF Glossary: [cip4.org/glossary/jdf](https://www.cip4.org/glossary/jdf)
- CIP4 JMF Glossary: [cip4.org/glossary/jmf](https://www.cip4.org/glossary/jmf)
- CIP4 MIS/Prepress ICS updates: [cip4.org/news-detail/CIP4-JDF-MIS-PREPREE](https://www.cip4.org/news-detail/CIP4-JDF-MIS-PREPREE)
