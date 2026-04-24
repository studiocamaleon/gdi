# Plan técnico F.1 — Schema nuevo + seed mínimo

> **Fase F.1** — Primer ticket de implementación del Big Bang.
> **Sesión**: 2026-04-24. **Esfuerzo estimado**: 10-15 días (1 dev full-time).
> **Pre-requisito**: safety net listo (`v1.4` + DB dump) ✅.

## 1. Decisiones de diseño cerradas

| # | Decisión | Valor |
|---|---|---|
| D1 | Familias del catálogo (las 31) | **HARDCODED** en `apps/api/src/productos-servicios/pasos/familias.ts` |
| D2 | Plantillas de máquinas (las 9) | **ENUM** `PlantillaMaquinaria` (como hoy) |
| D3 | Checklist del producto (5 entidades) | **ELIMINAR** — funcionalidad cubierta por inputs JobContext + CONDICIONAL + cargos + materiales opcionales |
| D4 | `paramsPaso` por paso del producto | **JSON libre** validado por declaración de la familia |
| D5 | Migración de datos viejos | **NO migrar**. DB nueva. Seed manual con datos reales como referencia |

## 2. Mapa del schema actual → schema nuevo

### Bloque A — Catálogo del SISTEMA (hardcodeado en código)

| Hoy | Mañana | Acción |
|---|---|---|
| (N/A) | `familias.ts` — array de 31 familias | **CREAR** |
| Enum `PlantillaMaquinaria` (113-136) | Igual | **PRESERVAR** |

### Bloque B — Catálogo del TALLER (DB)

| Hoy | Mañana | Acción |
|---|---|---|
| `Maquina` | Igual | **PRESERVAR** |
| `MaquinaPerfilOperativo` | Igual (revisar campos `printMode`, `printSides` que vienen del modelo viejo) | **PRESERVAR + ajustes menores** |
| `MaquinaConsumible` | Igual | **PRESERVAR** |
| `MaquinaComponenteDesgaste` | Mover desgaste a nivel perfil (decisión de `06-maquinas-y-perfiles.md`) | **AJUSTAR** (mover FK de `maquinaId` a `perfilOperativoId`) |
| `MateriaPrima` + `MateriaPrimaVariante` | Igual | **PRESERVAR** |
| `AlmacenMateriaPrima*` + `Stock*` + `Movimiento*` | Igual | **PRESERVAR** |
| `CentroCosto*` (8 entidades) | Igual | **PRESERVAR** |
| `Estacion` | Igual | **PRESERVAR** |
| `Planta` | Igual | **PRESERVAR** |

### Bloque C — Catálogo de PRODUCTOS (rehacer mayoritariamente)

| Hoy | Mañana | Acción |
|---|---|---|
| `ProcesoDefinicion` | `Ruta` (entidad reusable, esqueleto) | **REHACER** (simplificado) |
| `ProcesoOperacion` | `RutaPaso` (familia + orden, sin máquinas/materiales) | **REHACER** (mucho más simple) |
| `ProcesoOperacionPlantilla` | (eliminada) | **ELIMINAR** |
| `ProcesoVersion` | `RutaVersion` | **PRESERVAR** (lógica versionado) |
| `ProductoServicio` | `Producto` (nuevo) | **REHACER** (sin `motorCodigo`, sin `procesoDefinicionDefaultId`, sin `usarRutaComunVariantes`) |
| `ProductoVariante` | (eliminada) | **ELIMINAR** — variantes ahora vía paramsPaso + rutas alternativas + JobContext |
| `GranFormatoVariante` | (eliminada) | **ELIMINAR** |
| `FamiliaProducto`, `SubfamiliaProducto` | `CategoriaProducto` (simplificada, opcional para agrupar UI) | **OPCIONAL** — evaluar si vale mantener |
| (N/A) | `ProductoRutaAlternativa` (M:N) | **CREAR** |
| (N/A) | `ProductoConfigPaso` | **CREAR** |
| (N/A) | `ProductoConfigPasoSlotMaterial` | **CREAR** |
| (N/A) | `ProductoConfigPasoMaquinaCandidata` | **CREAR** (para M-2) |
| (N/A) | `CargoDirectoCatalogo` (5 tipos del catálogo) | **CREAR** |
| (N/A) | `ProductoCargoDirectoPaso` | **CREAR** |
| (N/A) | `ProductoCargoDirectoCotizacion` | **CREAR** |
| (N/A) | `ProductoPasoExtra` | **CREAR** (sub-tema 07: pasos extras inline del producto) |

### Bloque D — Tab Precio (preservar 100%)

| Hoy | Mañana | Acción |
|---|---|---|
| `ProductoImpuestoCatalogo` | Igual | **PRESERVAR** |
| `ProductoComisionCatalogo` | Igual | **PRESERVAR** |
| Campos JSON del precio en `ProductoServicio` | Mover a campos del nuevo `Producto` | **PRESERVAR + migrar de ubicación** |

### Bloque E — Cotizaciones (rehacer)

| Hoy | Mañana | Acción |
|---|---|---|
| `CotizacionProductoSnapshot` | `Cotizacion` + `CotizacionItem` + `CotizacionSnapshot` (estructurado) | **REHACER** según sub-tema 07 §7 (snapshot completo) |
| `CotizacionChecklistRespuestaSnapshot` | (eliminada) | **ELIMINAR** |

### Bloque F — A ELIMINAR completamente

| Entidades | Razón |
|---|---|
| `ProductoAdicionalCatalogo` + 11 relacionadas (12 total) | Adicionales = pasos opcionales en modelo nuevo |
| `ProductoChecklist` + 4 relacionadas (5 total) | Cubierto por inputs JobContext + CONDICIONAL + cargos + materiales opcionales (D3) |
| `ProductoMotorConfig`, `ProductoVarianteMotorOverride` | No hay más config de motor por producto — es un solo motor |
| `AlgoritmoCosto`, `ProductoVarianteAlgoritmoConfig` | Algoritmos de costo viejo (rigid-printed específico) |

**Total a eliminar**: ~22 modelos. **Total a crear**: ~10 modelos nuevos. **Net**: schema más simple que hoy.

## 3. Diseño detallado del schema nuevo

### 3.1 Familias en código (`familias.ts`)

```typescript
// apps/api/src/productos-servicios/pasos/familias.ts

export type FamiliaCodigo =
  | 'pre_prensa'
  | 'proof'
  | 'impresion_por_hoja'
  | 'impresion_por_area'
  | 'impresion_por_pieza'
  | 'aplicacion_transfer'
  | 'grabado_laser'
  | 'corte_guillotina'
  | 'plotter_corte'
  | 'corte_laser'
  | 'troquelado_digital'
  | 'cnc'
  | 'plegado'
  | 'perforado'
  | 'corte_manual'        // F.E nueva
  | 'laminado'
  | 'barniz'
  | 'acabado_decorativo'
  | 'pintura_superficial'
  | 'lijado_canteado'     // F.E nueva
  | 'encuadernado_engrapado'
  | 'encuadernado_anillado'
  | 'engomado_emblocado'
  | 'armado_cajas'
  | 'soldadura'
  | 'ensamble_estructural'
  | 'instalacion_electrica'
  | 'embalaje'
  | 'conteo_manual'
  | 'atado_banding'
  | 'etiquetado_manual'
  | 'control_calidad'
  | 'modificacion_pre'
  | 'modificacion_post'
  | 'envio'
  | 'instalacion_in_situ'
  | 'toma_medidas'
  | 'diseno_grafico';

export type CategoriaFamilia =
  | 'pre_prensa' | 'produccion_impresion' | 'corte_y_formado'
  | 'terminaciones' | 'encuadernacion_armado' | 'estructural_montaje'
  | 'operaciones_manuales' | 'logistica_instalacion' | 'servicios_profesionales';

export interface DefinicionFamilia {
  codigo: FamiliaCodigo;
  nombre: string;
  categoria: CategoriaFamilia;
  // Comportamiento
  relacionMaquina: 'M-0' | 'M-1' | 'M-2';                // tipo único o list ['M-1','M-2']
  modosTiempoSoportados: ('T-1' | 'T-2' | 'T-3' | 'T-4')[];
  mecanismosCantidadSoportados: ('DIRECT_FROM_JOBCONTEXT' | 'HEREDAR_DEL_OUTPUT_CANONICO' | 'CALCULADO_POR_PASO' | 'CONVERSION')[];
  modosActivacionSoportados: ('OBLIGATORIO' | 'OPCIONAL' | 'CONDICIONAL')[];
  multiplicadoresSoportados: string[];                    // ej: ['caras', 'tipoCopia']
  // Slots de materiales
  slotsRequeridos: SlotDeclarado[];
  permiteSlotsAdicionales: boolean;
  // Plantillas de máquinas compatibles (cuando relacionMaquina != M-0)
  plantillasCompatibles: PlantillaMaquinaria[];
  // Outputs canónicos que escribe al JobContext
  outputsCanonicos: string[];
  // Validaciones declaradas (D.7)
  validaciones: ValidacionDeclarada[];
  // Inputs requeridos del JobContext
  inputsRequeridos: string[];
  // paramsPaso schema (qué params soporta el modelador en el paso del producto)
  paramsPasoSchema?: ParamsPasoDeclarado[];
}

export interface SlotDeclarado {
  codigo: string;                                          // ej: 'sustrato_principal'
  tipo: 'SUSTRATO' | 'CONSUMIBLE_MAQUINA' | 'INSUMO_PASO' | 'TAPA' | ...;
  requerido: boolean;
}

export interface ValidacionDeclarada {
  codigo: string;
  tipo: 'REQUIRES_INPUT' | 'COMPARE' | 'IN_RANGE' | 'ONE_OF' | 'EXISTS_OUTPUT';
  // ... config según tipo
  mensaje: string;
}

export interface ParamsPasoDeclarado {
  campo: string;
  tipo: 'string' | 'number' | 'boolean' | 'enum';
  valoresPermitidos?: string[];
  default?: unknown;
}

export const FAMILIAS: Record<FamiliaCodigo, DefinicionFamilia> = {
  // ... 31 familias declaradas en detalle
};
```

### 3.2 Schema Prisma nuevo (entidades CREAR + REHACER)

```prisma
// === CATÁLOGO DE PRODUCTOS ===

model Ruta {
  id                String          @id @default(uuid()) @db.Uuid
  tenantId          String          @db.Uuid
  codigo            String
  nombre            String
  descripcion       String?
  versionActual     Int             @default(1)
  activo            Boolean         @default(true)
  createdAt         DateTime        @default(now())
  updatedAt         DateTime        @updatedAt
  tenant            Tenant          @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  pasos             RutaPaso[]
  versiones         RutaVersion[]
  productosAlternativas ProductoRutaAlternativa[]

  @@unique([tenantId, codigo])
  @@index([tenantId, activo])
}

model RutaPaso {
  id            String          @id @default(uuid()) @db.Uuid
  tenantId      String          @db.Uuid
  rutaId        String          @db.Uuid
  orden         Int
  familiaCodigo String          // referencia a FAMILIAS hardcodeadas
  // SIN máquinas, SIN materiales, SIN modos — esos van en producto
  activo        Boolean         @default(true)
  createdAt     DateTime        @default(now())
  updatedAt     DateTime        @updatedAt
  tenant        Tenant          @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  ruta          Ruta            @relation(fields: [rutaId], references: [id], onDelete: Cascade)
  productoConfigs ProductoConfigPaso[]

  @@unique([tenantId, rutaId, orden])
  @@index([tenantId, rutaId, activo])
}

model RutaVersion {
  id          String   @id @default(uuid()) @db.Uuid
  tenantId    String   @db.Uuid
  rutaId      String   @db.Uuid
  version     Int
  snapshotJson Json    // snapshot completo de la ruta + sus pasos
  cambios     String?  // descripción del cambio (modelador escribe)
  createdAt   DateTime @default(now())
  tenant      Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  ruta        Ruta     @relation(fields: [rutaId], references: [id], onDelete: Cascade)

  @@unique([tenantId, rutaId, version])
}

model Producto {
  id            String   @id @default(uuid()) @db.Uuid
  tenantId      String   @db.Uuid
  codigo        String
  nombre        String
  descripcion   String?
  // Atributos comerciales (preservados del schema viejo)
  unidadComercial String @default("unidad")          // 'unidad' | 'm2' | 'metro_lineal'
  // Modo de medidas (gap H4)
  modoMedidas   String   @default("FIJA")             // 'FIJA' | 'LIBRE' | 'COMERCIAL_ELIGE'
  medidaDefaultAnchoMm Decimal? @db.Decimal(12,2)
  medidaDefaultAltoMm  Decimal? @db.Decimal(12,2)
  // Tab Precio (JSON preservado del schema viejo)
  precioConfigJson Json?
  // Estado
  activo        Boolean  @default(true)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  tenant        Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  rutasAlternativas ProductoRutaAlternativa[]
  pasosExtras   ProductoPasoExtra[]
  cargosDirectos ProductoCargoDirectoCotizacion[]
  preciosEspeciales ProductoPrecioEspecialCliente[]
  cotizaciones  CotizacionItem[]

  @@unique([tenantId, codigo])
  @@index([tenantId, activo])
}

model ProductoRutaAlternativa {
  id              String   @id @default(uuid()) @db.Uuid
  tenantId        String   @db.Uuid
  productoId      String   @db.Uuid
  rutaId          String   @db.Uuid
  rutaVersion     Int                                  // versión específica que usa el producto
  nombre          String                                // nombre humano (ej: "Vía láser", "Vía offset")
  esPreferida     Boolean  @default(false)
  reglaAutoSeleccionJson Json?                         // JsonLogic opcional
  orden           Int      @default(0)
  activo          Boolean  @default(true)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  tenant          Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  producto        Producto @relation(fields: [productoId], references: [id], onDelete: Cascade)
  ruta            Ruta     @relation(fields: [rutaId], references: [id])
  configPasos     ProductoConfigPaso[]

  @@unique([tenantId, productoId, rutaId])
  @@index([tenantId, productoId, activo])
}

model ProductoConfigPaso {
  id                       String   @id @default(uuid()) @db.Uuid
  tenantId                 String   @db.Uuid
  productoRutaAlternativaId String  @db.Uuid
  rutaPasoId               String   @db.Uuid
  // Modos elegidos por el modelador (cuando familia soporta varios)
  modoActivacion           String?                         // 'OBLIGATORIO' | 'OPCIONAL' | 'CONDICIONAL'
  condicionActivacionJson  Json?                            // si modoActivacion = CONDICIONAL
  modoTiempo               String?                         // 'T-1' | 'T-2' | 'T-3' | 'T-4'
  mecanismoCantidad        String?                         // 'DIRECT' | 'HEREDAR' | 'CALCULADO' | 'CONVERSION'
  mecanismoCantidadConfigJson Json?                        // params del mecanismo
  // Multiplicadores activos (cuáles de los soportados están habilitados)
  multiplicadoresActivos   String[]
  // paramsPaso JSON libre (D4) — gap H19
  paramsPasoJson           Json?
  // Máquina M-1 (única) si aplica
  maquinaM1Id              String?  @db.Uuid
  perfilM1Id               String?  @db.Uuid
  // Override de tiempos
  setupOverrideMin         Decimal? @db.Decimal(12,2)
  cleanupOverrideMin       Decimal? @db.Decimal(12,2)
  tiempoFijoOverrideMin    Decimal? @db.Decimal(12,2)
  // Estado
  activo                   Boolean  @default(true)
  createdAt                DateTime @default(now())
  updatedAt                DateTime @updatedAt
  tenant                   Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  productoRutaAlternativa  ProductoRutaAlternativa @relation(fields: [productoRutaAlternativaId], references: [id], onDelete: Cascade)
  rutaPaso                 RutaPaso @relation(fields: [rutaPasoId], references: [id])
  maquinaM1                Maquina? @relation("ProductoConfigPasoMaquinaM1", fields: [maquinaM1Id], references: [id])
  perfilM1                 MaquinaPerfilOperativo? @relation("ProductoConfigPasoPerfilM1", fields: [perfilM1Id], references: [id])
  slotsMateriales          ProductoConfigPasoSlotMaterial[]
  maquinasCandidatas       ProductoConfigPasoMaquinaCandidata[]
  cargosDirectosPaso       ProductoCargoDirectoPaso[]

  @@unique([tenantId, productoRutaAlternativaId, rutaPasoId])
  @@index([tenantId, productoRutaAlternativaId])
}

model ProductoConfigPasoSlotMaterial {
  id                      String   @id @default(uuid()) @db.Uuid
  tenantId                String   @db.Uuid
  productoConfigPasoId    String   @db.Uuid
  slotCodigo              String                        // ej: 'sustrato_principal'
  modoSeleccion           String                        // 'HARDCODED' | 'COMERCIAL_ELIGE' | 'MOTOR_ELIGE_AUTO'
  criterioMotorAuto       String?                       // 'MENOR_COSTO' | 'MAYOR_APROVECHAMIENTO' | 'MENOR_CAPACIDAD_QUE_CUMPLA'
  criterioInputCampo      String?                       // ej: 'hojasPorLibro'
  criterioMaterialCampo   String?                       // ej: 'capacidadMaxHojas'
  // Materiales candidatos / hardcoded
  materialVarianteId      String?  @db.Uuid             // si HARDCODED, una sola variante
  materialesCandidatosJson Json?                        // lista de variantes para COMERCIAL_ELIGE / MOTOR_ELIGE_AUTO
  // Estrategia de costo del material
  estrategiaCosto         String   @default("simple")   // 'simple' | 'm2-exact' | 'consumed-length' | 'plate-segments'
  formula                 String   @default("por_unidad_productiva") // ver D.5
  aplicaMultiCaras        Boolean  @default(false)
  activo                  Boolean  @default(true)
  createdAt               DateTime @default(now())
  updatedAt               DateTime @updatedAt
  tenant                  Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  productoConfigPaso      ProductoConfigPaso @relation(fields: [productoConfigPasoId], references: [id], onDelete: Cascade)
  materialVariante        MateriaPrimaVariante? @relation("ProductoConfigPasoSlotMaterialVariante", fields: [materialVarianteId], references: [id])

  @@unique([tenantId, productoConfigPasoId, slotCodigo])
  @@index([tenantId, productoConfigPasoId])
}

model ProductoConfigPasoMaquinaCandidata {
  id                      String   @id @default(uuid()) @db.Uuid
  tenantId                String   @db.Uuid
  productoConfigPasoId    String   @db.Uuid
  maquinaId               String   @db.Uuid
  esPreferida             Boolean  @default(false)
  orden                   Int      @default(0)
  activo                  Boolean  @default(true)
  createdAt               DateTime @default(now())
  tenant                  Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  productoConfigPaso      ProductoConfigPaso @relation(fields: [productoConfigPasoId], references: [id], onDelete: Cascade)
  maquina                 Maquina  @relation("ProductoConfigPasoMaquinaCandidata", fields: [maquinaId], references: [id])

  @@unique([tenantId, productoConfigPasoId, maquinaId])
  @@index([tenantId, productoConfigPasoId])
}

model ProductoPasoExtra {
  id                  String   @id @default(uuid()) @db.Uuid
  tenantId            String   @db.Uuid
  productoId          String   @db.Uuid
  // Posición en el flujo: insertar después de qué paso de la ruta
  insertarDespuesDeRutaPasoId String? @db.Uuid                    // null = al inicio
  ordenInterno        Int      @default(0)                         // si hay varios pasos extras en la misma posición
  // Configuración del paso extra (igual que ProductoConfigPaso)
  familiaCodigo       String
  modoActivacion      String?
  // ... mismos campos que ProductoConfigPaso pero inline (sin referencia a rutaPaso)
  paramsPasoJson      Json?
  activo              Boolean  @default(true)
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt
  tenant              Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  producto            Producto @relation(fields: [productoId], references: [id], onDelete: Cascade)

  @@index([tenantId, productoId, activo])
}

// === CARGOS DIRECTOS ===

model CargoDirectoCatalogo {
  id              String   @id @default(uuid()) @db.Uuid
  tenantId        String   @db.Uuid
  codigo          String                                  // 'tercerizacion' | 'viatico' | 'combustible_flete' | 'matriz_custom' | 'recargo_urgencia'
  nombre          String
  descripcion     String?
  modoCalculo     String                                  // 'MONTO_FIJO_PLANO' | 'PORCENTAJE_SOBRE_BASE' | 'POR_UNIDAD_INPUT'
  modosActivacionSoportados String[]                     // 'OBLIGATORIO' | 'OPCIONAL' | 'CONDICIONAL'
  configJson      Json?                                   // defaults por tipo
  activo          Boolean  @default(true)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  tenant          Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@unique([tenantId, codigo])
  @@index([tenantId, activo])
}

model ProductoCargoDirectoPaso {
  id                      String   @id @default(uuid()) @db.Uuid
  tenantId                String   @db.Uuid
  productoConfigPasoId    String   @db.Uuid
  cargoDirectoCatalogoId  String   @db.Uuid
  modoActivacion          String                          // OBLIGATORIO / OPCIONAL / CONDICIONAL
  condicionActivacionJson Json?
  // Override de la config base
  configOverrideJson      Json?
  activo                  Boolean  @default(true)
  createdAt               DateTime @default(now())
  tenant                  Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  productoConfigPaso      ProductoConfigPaso @relation(fields: [productoConfigPasoId], references: [id], onDelete: Cascade)
  cargoDirectoCatalogo    CargoDirectoCatalogo @relation("ProductoCargoDirectoPasoCatalogo", fields: [cargoDirectoCatalogoId], references: [id])

  @@index([tenantId, productoConfigPasoId])
}

model ProductoCargoDirectoCotizacion {
  id                      String   @id @default(uuid()) @db.Uuid
  tenantId                String   @db.Uuid
  productoId              String   @db.Uuid
  cargoDirectoCatalogoId  String   @db.Uuid
  modoActivacion          String
  condicionActivacionJson Json?
  configOverrideJson      Json?
  activo                  Boolean  @default(true)
  createdAt               DateTime @default(now())
  tenant                  Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  producto                Producto @relation(fields: [productoId], references: [id], onDelete: Cascade)
  cargoDirectoCatalogo    CargoDirectoCatalogo @relation("ProductoCargoDirectoCotizacionCatalogo", fields: [cargoDirectoCatalogoId], references: [id])

  @@index([tenantId, productoId])
}

// === COTIZACIONES (rehacer) ===

model Cotizacion {
  id            String   @id @default(uuid()) @db.Uuid
  tenantId      String   @db.Uuid
  numero        String?
  clienteId     String?  @db.Uuid
  estado        String   @default("borrador")             // 'borrador' | 'enviada' | 'aceptada' | 'rechazada'
  fechaEmision  DateTime?
  fechaValidez  DateTime?
  observaciones String?
  // Cargos directos a nivel cotización (suma de los que apliquen)
  cargosDirectosCotizacionJson Json?
  // Totales calculados
  subtotal      Decimal? @db.Decimal(14,2)
  total         Decimal? @db.Decimal(14,2)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  tenant        Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  cliente       Cliente? @relation("CotizacionCliente", fields: [clienteId], references: [id])
  items         CotizacionItem[]

  @@unique([tenantId, numero])
  @@index([tenantId, estado])
}

model CotizacionItem {
  id              String   @id @default(uuid()) @db.Uuid
  tenantId        String   @db.Uuid
  cotizacionId    String   @db.Uuid
  productoId      String   @db.Uuid
  rutaAlternativaId String? @db.Uuid                     // cuál ruta se eligió
  cantidad        Decimal  @db.Decimal(14,2)
  jobContextJson  Json                                   // los inputs del comercial al cotizar
  // Snapshot completo (sub-tema 07 §7)
  snapshotJson    Json                                   // ruta + producto + materiales + valores + cargos
  // Costo y precio calculados
  costoUnitario   Decimal? @db.Decimal(14,2)
  costoTotal      Decimal? @db.Decimal(14,2)
  precioUnitario  Decimal? @db.Decimal(14,2)
  precioTotal     Decimal? @db.Decimal(14,2)
  trazabilidadJson Json?                                  // buckets a-g
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  tenant          Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  cotizacion      Cotizacion @relation(fields: [cotizacionId], references: [id], onDelete: Cascade)
  producto        Producto @relation(fields: [productoId], references: [id])

  @@index([tenantId, cotizacionId])
}
```

> **Nota**: el diseño de arriba es propuesta inicial. Puede refinarse al implementar (ej: campos JSON que se demuestren mejor como tablas).

## 4. Tareas concretas de F.1

### F.1.1 — Crear `familias.ts` (catálogo de las 31 familias) — **2-3 días**
- TS file con `FAMILIAS: Record<FamiliaCodigo, DefinicionFamilia>`.
- Cada familia con todos sus modos, slots, validaciones, multiplicadores, plantillas compatibles.
- Tests unitarios que validen integridad del catálogo.

### F.1.2 — Diseñar Prisma schema nuevo — **3-4 días**
- Crear las nuevas entidades del Bloque C + E.
- Mantener Bloques B, D existentes con ajustes menores.
- Marcar como `@@deprecated` o eliminar el Bloque F.

### F.1.3 — Eliminar entidades obsoletas — **1 día**
- Identificar dependencias (foreign keys que apunten a las entidades a eliminar).
- DROP de las ~22 tablas (con cuidado por orden de dependencias).
- Backup en script aparte para referencia (no para restaurar — ya está el dump en safety net).

### F.1.4 — Migración Prisma — **1 día**
- `npx prisma migrate dev --name modelo_universal_inicial`
- Verificar que no rompe `Auth`, `Centros`, `Materiales`, `Inventario`, `TabPrecio`.
- Ejecutar tests existentes que dependan del schema preservado.

### F.1.5 — Implementar seed inicial — **2-3 días**
- Tenant + máquinas + perfiles + materiales (extraer del seed actual o cargar nuevo).
- Cargar los 4 productos validados:
  - Tarjetas de Visita (`fase-e/tarjetas-de-visita.md`)
  - Vinilo adhesivo (`fase-e/vinilo-adhesivo.md`)
  - Talonarios (`fase-e/talonarios-emblocados.md`)
  - Rígido impreso (`fase-e/rigido-impreso.md`)
- Cargar el catálogo de cargos directos (5 tipos).

### F.1.6 — Tests del schema — **1-2 días**
- Tests CRUD básicos para cada entidad nueva.
- Tests de relaciones (M:N producto-rutas, slots, cargos).
- Tests de constraints (unique, etc.).

**Total F.1**: 10-15 días (~2-3 semanas, 1 dev full-time).

## 5. Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Eliminar entidades viejas rompe queries en código preservado (Tab Precio, etc.) | Mapeo previo: listar qué archivos del código tocan cada entidad a eliminar. Si tocan, decidir caso por caso (preservar o reemplazar). |
| El JSON `paramsPasoJson` necesita validación de schema y la familia declarada | F.1 implementa la declaración (`paramsPasoSchema` en familias.ts). La validación se implementa en F.2 (motor) cuando se ejecuta el paso. |
| El gap H7 (`piezas: [...]`) afecta cómo se modelan las medidas en JobContext | Decidido en F.1: el JobContext es JSON libre en `CotizacionItem.jobContextJson` (sin tabla rígida). El motor sabrá leer `piezas` cuando aplique. |
| Cambios al modelo de máquinas (mover desgaste a perfil) puede romper queries | Dependencia con `MaquinaComponenteDesgaste` actuales. Verificar y migrar manualmente al ejecutar la migración. |

## 6. Salida esperada al cerrar F.1

- ✅ Schema Prisma nuevo aplicado, migración corre limpia.
- ✅ Catálogo `familias.ts` con 31 familias declaradas.
- ✅ Seed con tenant Corporearte + 9 máquinas + materiales + 4 productos validados cargados.
- ✅ Tests CRUD pasando.
- ✅ Tab Precio sigue operativo (sin cambios).
- ✅ Endpoints viejos (motores legacy) siguen vivos pero ya no apuntan a tablas que se eliminaron — **bug esperado**, se resuelve en F.2 al implementar el motor nuevo.

**Importante**: al cerrar F.1, el sistema NO cotiza. Los motores legacy quedan rotos (sus tablas se fueron). Es esperado — F.2 implementa el motor nuevo que sí cotiza.

## 7. Dependencias para arrancar F.1

- ✅ Modelo conceptual cerrado (Fase A-E).
- ✅ Safety net listo (`v1.4` + DB dump).
- ✅ Decisiones D1-D5 cerradas (este doc).
- ⬜ Confirmar que arrancar F.1 no requiere terminar otros frentes (ej. plantillas SOLDADORA/CABINA postergadas — no son bloqueantes para F.1).

## 8. Próximos pasos después de F.1

- **F.2**: Implementar `MotorUniversalService` que consume el schema nuevo. ~2-3 semanas.
- **F.3**: UI admin nueva. ~2-3 semanas.
- **F.4**: UI cotizador comercial. ~1-2 semanas.
- **F.5**: Cleanup final. ~3-5 días.
