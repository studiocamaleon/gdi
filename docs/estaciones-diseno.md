# Estaciones de producción — diseño real

> Análisis 2026-07-17 (rama `feat/tablero-ordenes-reales`). Complementa a
> docs/tablero-produccion-conexion-diseno.md: la fase 1 del tablero usó el
> centro de costo como proxy de estación; esta fase crea la estación REAL
> configurable y la vuelve la agrupación operativa del taller.

## 1. Estado actual

- **Entidad `Estacion`**: mínima (nombre, descripción, activo). CRUD real en
  `apps/api/src/produccion/` (GET/POST/PUT/toggle; sin DELETE). **0 filas** en
  dev: nadie la usa operativamente.
- **Panel `/produccion/estaciones`**: 100% mock (14 estaciones, máquinas y
  empleados inventados, 6 "etapas" hardcodeadas). El form ya diseñó la UX
  correcta: identidad → recursos → capacidad/planificación.
- **Tablero "Por estación"**: agrupa por `centroCostoNombre` del paso (proxy
  fase 1). Sirve, pero el centro de costo es un concepto de COSTEO (tarifas),
  no de PISO DE TALLER: "Ventas & Centro de Copiado" tarifa la DesignJet pero
  nadie "trabaja parado" en ese centro.
- **Datos reales disponibles**: 12 máquinas (con `centroCostoPrincipalId`),
  7 empleados (con sector), catálogo fijo de ~41 familias de pasos con
  `categoria` (9 categorías de alto nivel), y los pasos materializados del
  tablero llevan `familiaCodigo` persistido.

## 2. Concepto

La **estación** es el lugar físico/lógico del taller donde se ejecuta un tipo
de trabajo: agrupa **familias de pasos** (qué se hace ahí), **máquinas** (con
qué) y **empleados habilitados** (quiénes), con una **capacidad** de trabajo
concurrente. El paso llega a su estación por la **familia**.

```
FamiliaPaso (catálogo fijo) ──N:1── Estacion ──1:N── Maquina
                                        │
                                        └──N:M── Empleado
```

## 3. Decisiones

- **D1 — Familia + máquinas rutean el paso a UNA estación.** (Refinada
  2026-07-17: las máquinas son FILTROS.) El paso llega por su familia; si la
  estación tiene máquinas, sólo recibe los pasos que usan esas máquinas (el
  vínculo real es `paso.centroCostoId` = centro de costo principal de alguna
  máquina de la estación — la trazabilidad no guarda maquinaId, y en este
  modelo el centro identifica la máquina o el grupo de máquinas idénticas).
  Reglas de consistencia:
  - Una familia puede estar en VARIAS estaciones **sólo si tienen máquinas**
    (como una máquina vive en una sola estación, son disjuntas solas).
  - A lo sumo **una estación general** (sin máquinas) por familia: el
    catch-all de los pasos que no matchean ninguna máquina. Dos generales con
    la misma familia → 409 con la dueña.
  - Resolución por paso: estación cuya máquina matchea > estación general >
    paso sin centro con única candidata > **"Sin estación"**. Determinista:
    un paso nunca aparece en dos estaciones.
- **D2 — Una máquina está EN una estación** (FK nullable `estacionId` en
  `Maquina`, SetNull al borrar la estación). Asignar en B una máquina que
  estaba en A la **mueve** (la UI lo avisa). El `centroCostoPrincipalId` no se
  toca: costeo y piso de taller son ejes independientes.
- **D3 — Empleados N:M** (`EstacionEmpleado`): un operario puede estar
  habilitado en varias estaciones.
- **D4 — La ETAPA es FIJA y se elige por estación.** (Corregida 2026-07-17
  a pedido del usuario: la derivación por familias quedó descartada.)
  Catálogo fijo de 6 etapas productivas — Pre-prensa, Impresión, Post-prensa,
  Terminaciones, Instalación, QA & Despacho — con orden y color; campo
  `etapa` en `Estacion` (default `preprensa`), picker en el form, y agrupa/
  ordena las vistas operativas (panel y tablero). Espejo front en
  `ETAPAS_ESTACION` (src/lib/estaciones.ts), validación @IsIn en el DTO.
- **D5 — Capacidad y planificación (fase 1)**: `capacidadConcurrente` (pasos
  en paralelo, para % de carga REAL del tablero: activos/capacidad) y
  `horario` (texto libre informativo). El "tiempo promedio por paso" del mock
  NO se persiste: se deriva de `duracionEstimadaMin` de los pasos reales
  cuando haga falta. `icono` sí se persiste (lenguaje visual del tablero).
- **D6 — El tablero agrupa por estación real.** Resolución de D1
  (`resolverEstacionDePaso`): familia + filtro de máquinas vía el centro de
  costo del paso. Pasos sin estación resuelta (familia sin asignar, máquina
  que no matchea sin estación general, o estación inactiva) caen al bucket
  **"Sin estación"** con CTA a configurar.
  El centro de costo queda como dato informativo del paso (banner del sheet),
  ya no agrupa. Sin estaciones configuradas, la vista muestra el estado vacío
  con CTA (no vuelve al proxy: sería tener dos verdades).
- **D7 — Sin `estacionId` persistido en el paso.** El mapeo es en lectura:
  reconfigurar estaciones re-rutea el trabajo vivo al instante y no hay
  backfill. (Cuando exista asignación de operario/mesa persistente, se
  revisa.)
- **D8 — Borrar estación**: DELETE real con `ConfirmacionDestructiva`;
  libera sus familias (cascade en `EstacionFamilia`), desasigna máquinas
  (SetNull) y suelta empleados (cascade). El trabajo vivo cae a "Sin
  estación" — nada se pierde.
- **D9 — Catálogo de familias por API** (`GET /produccion/familias-pasos`):
  código, nombre y categoría desde el catálogo del backend (fuente de
  verdad), más qué estación la tiene tomada. El front no duplica nombres.

## 4. Modelo (migración)

```prisma
model Estacion {
  // existentes: id, tenantId, nombre, descripcion, activo, timestamps
  icono                String?  // clave del set de iconos del tablero
  capacidadConcurrente Int      @default(1)
  horario              String?
  familias             EstacionFamilia[]
  empleados            EstacionEmpleado[]
  maquinas             Maquina[]
}

model EstacionFamilia {
  id, tenantId, estacionId, familiaCodigo
  @@unique([estacionId, familiaCodigo]) // sin duplicados dentro de la estación
  // La regla "a lo sumo una estación general por familia" la valida el
  // service (depende de si la estación tiene máquinas).
}

model EstacionEmpleado {
  id, tenantId, estacionId, empleadoId
  @@unique([estacionId, empleadoId])
}

// Maquina: + estacionId String? @db.Uuid (SetNull) + índice
```

## 5. Contrato

`GET /produccion/estaciones` pasa a devolver la proyección completa:

```ts
type Estacion = {
  id: string; nombre: string; descripcion: string; activo: boolean;
  icono: string | null; capacidadConcurrente: number; horario: string | null;
  familias: string[];                      // códigos
  empleados: Array<{ id: string; nombreCompleto: string; sector: string }>;
  maquinas: Array<{ id: string; codigo: string; nombre: string;
                    centroCostoId: string | null }>; // vínculo paso→máquina
  createdAt: string; updatedAt: string;
};
```

`POST/PUT` reciben además `icono?`, `capacidadConcurrente?`, `horario?`,
`familias: string[]`, `empleadoIds: string[]`, `maquinaIds: string[]`
(reemplazo completo de las tres listas — el form edita el conjunto).
`DELETE /produccion/estaciones/:id` nuevo.
`GET /produccion/familias-pasos` →
`Array<{ codigo, nombre, categoria, estaciones: [{ id, nombre, conMaquinas }] }>`.

## 6. Casos borde

- Dos estaciones generales (sin máquinas) con la misma familia → 409 con la
  dueña; la UI deshabilita el chip mientras el borrador no tenga máquinas.
- Paso con máquina que no matchea ninguna estación de su familia y sin
  estación general → "Sin estación" (el filtro es estricto, como pidió el
  usuario).
- Máquina que ya estaba en otra estación → se mueve (aviso en el picker).
- Estación inactivada con trabajo vivo → sus pasos caen a "Sin estación";
  reactivarla los recupera (mapeo en lectura, D7).
- Empleado/máquina eliminados del sistema → cascade/SetNull; la estación
  sigue válida.
- Familias con `visibleEnSelector: false` (legacy): se listan sólo si ya
  estaban asignadas.

## 7. Journey (verificación E2E)

1. Crear "Impresión digital" con familias `impresion_por_hoja` +
   `impresion_por_pieza`, las 3 Ricoh, empleados de Producción, capacidad 4.
2. Crear "Gran formato UV" (`impresion_por_area`), "Pre-prensa & Diseño"
   (`pre_prensa`, `diseno_grafico`, `proof`), "Corte y terminación"
   (`corte_guillotina`, `laminado`), "Textil" (`aplicacion_transfer`).
3. Intentar asignar `pre_prensa` a otra estación → bloqueado con la dueña.
4. Tablero "Por estación": los 9 pasos activos agrupados por las estaciones
   creadas; carga = activos/capacidad; `trabajo_manual` (sin asignar) en
   "Sin estación".

## 8. Fase B (después)

Asignación de operario a paso (habilitados = los de la estación),
sugerencia automática de estaciones iniciales desde máquinas/centros.

Ya implementados de esta fase:
- **Horario estructurado** → docs/capacidad-estaciones-diseno.md (2026-07-17).
- **"Mi mesa" persistente** (2026-07-17): `OrdenTrabajoItemPaso.mesaUsuarioId`
  (por USUARIO auth, SetNull) + `PATCH /ordenes-trabajo/tablero/pasos/:id/mesa`.
  Drag & drop entre columnas en el detalle de estación (HTML5 nativo, con
  botones como alternativa), optimista con confirmación del server. El
  reclamo lo ve todo el taller: en compartidas, el paso tomado por OTRO
  muestra chip "en mesa de {nombre}"; tomar pisa el reclamo ajeno (taller
  chico). Los pasos hechos no se reclaman.
