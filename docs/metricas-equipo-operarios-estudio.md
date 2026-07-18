# Métricas de equipo (empleados/operarios) — estudio y propuesta

> 2026-07-18. Estudio SIN implementación, previo a decidir. Cruza (a) el
> relevamiento exhaustivo de qué datos por persona ya captura el sistema
> con (b) la investigación de industria: qué miden los Print MIS y los
> MES por operario, y — lo más importante — la evidencia sobre las
> trampas de medir personas (Goodhart, Deming, rankings, monitoreo).
> Responde: ¿tab de productividad de operarios? ¿qué métricas? ¿y la
> "devolución" del sistema al propio empleado?

## 1. La tesis del estudio

Se puede construir un tab de equipo valioso HOY, con datos que ya
existen. Pero la investigación es contundente en que **el diseño
correcto no es un ranking de operarios**: el efecto documentado del
monitoreo evaluativo sobre el desempeño es ~neutro, con costo real en
estrés y clima (meta-análisis 2022), Deming demostró que la mayor parte
de la variación entre operarios es del SISTEMA (no de la persona), y el
caso Microsoft (stack ranking, abandonado en 2013) muestra lo que un
ranking público le hace a la colaboración — peor aún en un taller de
5-15 personas que se conocen.

La estructura que la evidencia respalda es de **tres niveles con
filosofías explícitas**:

1. **Proceso** (sin nombres): dónde se pierde tiempo/plata — ya lo
   tenemos en Producción y hay que profundizarlo, no personalizarlo.
2. **Equipo** (agregado, apto pantalla compartida): el taller como
   conjunto.
3. **Persona** (privado, con guardas): tendencia de cada uno contra sí
   mismo para el admin/supervisor, y la **devolución al propio
   empleado** — que tiene precedente sólido en MES (Tulip,
   MachineMetrics: el operario ve SU marcha) y evidencia de +10-25% en
   job-shops cuando se hace como herramienta propia, no como vigilancia.

Ventas es la excepción cultural: comparar vendedores (facturación, ticket,
margen) es práctica estándar y esperada — ese ranking ya existe en el
Panel y está bien donde está.

## 2. Qué datos por persona YA captura el sistema (verificado)

### El doble eje (decisión de diseño obligada)

- **Producción** se atribuye a **`User`**: `OrdenTrabajoPasoTramo`
  (usuarioId/Nombre, inicioEl/finEl, motivoFin, origen — con índice por
  tenant+usuario+fin) y `OrdenTrabajoItemPaso` (iniciadoPor*/
  completadoPor*, tiempoRealMin, tiempoFuente, familia, centro).
- **Comercial** se atribuye a **`Empleado`** (`vendedorEmpleadoId`), y
  el puente `Empleado.userId` es OPCIONAL (puede haber legajo sin
  cuenta y cuenta sin legajo).
- Recomendación: eje primario = **User** (ahí vive la producción),
  atributos de negocio (sector, ocupación, ventas, comisiones) vía el
  join opcional, mostrando explícitos los no-vinculados.

### Sólido hoy (🟢 sin tocar captura)

| Dato por persona | Fuente |
|---|---|
| Tiempo efectivo trabajado, pasos, sesiones/día | tramos por usuarioId |
| Pausas por motivo (incl. auto_pausa y fin_jornada) | tramos.motivoFin |
| Real vs. cotizado por familia | pasos por completadoPorId + tiempoFuente medido + filtro de atípicos existente |
| Disciplina de registro (% medido vs declarado/estimado/invalido; auto-pausas) | tiempoFuente × persona |
| Polivalencia observada (familias/estaciones donde completó trabajo) | pasos por persona × familiaCodigo/centro |
| Ventas por vendedor (facturado, órdenes, ticket, margen) | vendedorEmpleadoId (ya en el Panel) |
| Bloqueos/desbloqueos/reaperturas por persona | OrdenTrabajoEvento (datosJson.accion + usuarioId) |
| Última conexión / frecuencia de login | AuthSession (grano grueso) |

### Frágil (🟡 requiere cómputo nuevo o es ruidoso)

- **Comisión devengada por vendedor**: la regla existe
  (`EmpleadoComision`) pero nunca se cruza con ventas reales; los
  snapshots de comisión por item son de producto/pasarela, NO del
  vendedor. Computable, nadie lo hace hoy.
- **Retrabajos por persona**: solo minando eventos `reabrir`
  (aproximado y ruidoso; no hay scrap/causa por paso).
- **Cobros/comprobantes cargados por usuario**: `Cobro` y `Comprobante`
  no tienen createdBy; solo los cobros ligados a orden dejan rastro en
  eventos.

### Imposible con el modelo actual (🔴 declarar fuera de alcance)

Asistencia/fichaje y presentismo (la suma de tramos subestima: no
cuenta esperas ni presencia sin paso) · turnos y ausencias por persona
(DiaNoLaborable es del taller) · costo hora / sueldo por persona (los
sueldos son pool por centro de costo) → **cualquier métrica monetaria
por operario queda fuera** · calidad/scrap atribuido · historial de
reclamos de mesa (solo estado actual).

## 3. Catálogo industria × nuestra viabilidad

**[CORE]** = estándar en MES/Print MIS; **[DIF]** = diferenciador.

| Métrica | Fórmula | Prioridad | Viabilidad |
|---|---|---|---|
| Eficiencia vs. estándar (earned hours) | tiempo cotizado de lo completado ÷ tiempo real | [CORE] | 🟢 (nuestro "estándar" es el tiempo cotizado — sirve para tendencia, no para veredictos) |
| Horas productivas por persona/día | Σ tramos | [CORE] | 🟢 |
| Utilización (productivas ÷ presenciales) | requiere fichada | [CORE] | 🔴 sin asistencia |
| Piezas/hora por paso | solo comparable mismo paso | [CORE] | 🟡 (mix distinto → no comparar entre personas) |
| Calidad / retrabajo por persona | retrabajos ÷ completados | [CORE] | 🔴 (solo proxy `reabrir`, ruidoso) |
| Polivalencia / skills matrix (ILUO) | estaciones dominadas ÷ totales | [DIF] | 🟢 derivada de producción real (versión "observada") |
| Disciplina de registro | % pasos medido + auto-pausas | [DIF] | 🟢 — nadie la ofrece y es la que mejora TODAS las demás métricas del Panel |
| Ventas/quota por vendedor | attainment, ticket, margen | [CORE] | 🟢 ventas/margen; 🔴 quota (no hay cuotas) y win rate (sin estados de cotización — F3 del estudio anterior) |
| Comisión devengada por vendedor | regla × ventas del período | [CORE] | 🟡 cómputo nuevo con regla declarada |
| Asistencia/puntualidad | — | sensible | 🔴 sin fichaje |

## 4. Trampas documentadas → reglas duras del módulo

1. **Goodhart/gaming**: sub-reportar tiempo, elegir pasos fáciles,
   completar rápido sacrificando calidad. Antídoto: **métricas
   emparejadas** (nunca velocidad sola: eficiencia + disciplina de
   registro juntas), y el desvío se usa primero para **corregir la
   cotización** (proceso), no para evaluar gente.
2. **Deming/variación**: no mostrar eficiencia por persona con muestra
   chica — **regla: n ≥ 20 pasos medidos comparables en el período**, si
   no, la celda dice "pocos datos". Tendencia contra uno mismo (media
   móvil 4 semanas) en vez de comparación entre pares.
3. **Sin rankings públicos de producción.** El dato individual es para
   el admin/supervisor y para el propio operario. Nada de leaderboards
   (la propia literatura de gamificación industrial los está
   abandonando). Ventas comparado sí (cultura comercial).
4. **Transparencia**: el operario sabe qué se mide y ve exactamente lo
   mismo que ve su supervisor sobre él. El monitoreo percibido como
   herramienta útil atenúa el costo de clima; percibido como vigilancia,
   lo paga en estrés y rotación.
5. **El proceso primero**: cola, bloqueos, desvío por familia ya están
   en el tab Producción — el tab de equipo NO reemplaza eso; agrega la
   capa de personas con las guardas de arriba.

## 5. Propuesta

### Tab "Equipo" del Panel (admin/supervisor) — Fase 1, todo 🟢

- **KPIs**: personas activas en el período · horas productivas totales ·
  % de tiempo medido (disciplina del taller) · pasos completados.
- **Card "Horas y pasos por persona"** (evolución del card actual de
  Producción, que se muda acá): tiempo, pasos, sesiones/día, familias
  tocadas. Sin columna de eficiencia.
- **Card "Eficiencia con guardas"**: por persona, SOLO donde n ≥ 20
  pasos medidos: tendencia propia (media móvil) + banda de variación
  (espíritu XmR) — sin ordenar por valor; orden alfabético.
- **Card "Disciplina de registro"**: % medido / declarado / estimado /
  inválido y auto-pausas por persona — la métrica accionable nº 1
  (habilita todas las demás y es coacheable sin conflicto).
- **Card "Polivalencia observada"**: matriz persona × familia con
  intensidad (heatmap ya existente) — quién puede cubrir qué; cobertura
  de estación (familias con <2 personas = riesgo).
- **Card "Vendedores"** (se muda/expande de Comercial): facturado,
  órdenes, ticket, margen por vendedor + comisión devengada (🟡 cómputo
  nuevo con la regla de EmpleadoComision, etiquetada "estimada").
- Meta de honestidad como siempre: cada card declara fuente, filtros y
  muestras.

### "Mi desempeño" (devolución al empleado) — Fase 2

Vista para el rol OPERADOR (fuera del Panel gerencial): hoy trabajaste
X en N pasos · tu semana vs. TU promedio · tu disciplina de registro ·
tus familias (polivalencia como progreso: "sumaste laminado este mes").
Enmarcada como herramienta propia; exactamente los mismos números que ve
el supervisor. Sin comparaciones con compañeros. Es el precedente MES
que funciona y convierte el registro de tiempos en algo que le devuelve
valor a quien lo alimenta.

### Prerrequisitos de captura (decisiones de producto, si se quieren las 🔴)

1. **Fichaje simple entrada/salida** (o import de reloj) → destraba
   utilización y presentismo. Decisión sensible: sumarla solo si el
   tenant la pide.
2. **Scrap/retrabajo con causa al completar paso** (ya identificado en
   el estudio de métricas avanzadas como F3) → destraba calidad por
   persona Y por proceso.
3. **createdBy en Cobro/Comprobante** (una columna + set en el service)
   → trazabilidad administrativa barata; útil más por auditoría que por
   productividad.
4. **Cuotas de venta por vendedor** → attainment real.
5. **Costo laboral por persona**: hoy los sueldos son pool por centro;
   individualizarlos es una decisión de modelo de costos (no
   recomendada solo para esta métrica).

### Fases

- **F1**: tab Equipo (todo 🟢 + comisión devengada 🟡). Backend:
  `equipo.service.ts` en reportes con el patrón del módulo.
- **F2**: "Mi desempeño" (misma data, endpoint scoped al propio user).
- **F3**: capturas nuevas según demanda (fichaje, scrap, cuotas).

## 6. Estado

Estudio sin implementación. Fuentes de industria: EFI Pace/Avanti
(SFDC/job costing), PrintVis (registration users), Visual South y L2L
(labor efficiency/earned hours), Deming Institute (red beads), Wheeler
(Understanding Variation), meta-análisis de monitoreo electrónico
(Computers in Human Behavior Reports 2022, Annual Review Org. Psych.),
SHRM (fin del stack ranking en Microsoft), literatura de gamificación
industrial (Robotics & CIM 2024, MDPI 2023), Tulip/SparkMES (operator
dashboards), Sharpen (skills matrix). URLs en el informe de
investigación de la sesión 2026-07-18.
