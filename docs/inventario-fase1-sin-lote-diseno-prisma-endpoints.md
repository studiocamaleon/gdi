# Inventario Fase 1 (Sin Lote)
## Diseno Prisma + Endpoints Exactos

Fecha: 2026-03-12
Rama: `codex/feature-inventario-centro-stock`

## 1) Alcance acordado

Incluye:

1. Centro de stock con `almacenes` y `ubicaciones`.
2. Stock por `variante + ubicacion`.
3. Movimientos de stock con trazabilidad.
4. Kardex por variante.

No incluye (por ahora):

1. lotes,
2. vencimientos,
3. reservas,
4. reglas avanzadas FIFO/FEFO.

## 2) Modelo Prisma propuesto (minimo y profesional)

### 2.1 Enums

```prisma
enum TipoMovimientoStockMateriaPrima {
  INGRESO
  EGRESO
  AJUSTE_ENTRADA
  AJUSTE_SALIDA
  TRANSFERENCIA_SALIDA
  TRANSFERENCIA_ENTRADA
}

enum OrigenMovimientoStockMateriaPrima {
  COMPRA
  CONSUMO_PRODUCCION
  AJUSTE_MANUAL
  TRANSFERENCIA
  DEVOLUCION
  OTRO
}
```

### 2.2 Modelos

```prisma
model AlmacenMateriaPrima {
  id          String   @id @default(uuid()) @db.Uuid
  tenantId    String   @db.Uuid
  codigo      String
  nombre      String
  descripcion String?
  activo      Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  tenant      Tenant                      @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  ubicaciones AlmacenMateriaPrimaUbicacion[]

  @@unique([tenantId, codigo])
  @@index([tenantId, activo])
}

model AlmacenMateriaPrimaUbicacion {
  id          String   @id @default(uuid()) @db.Uuid
  tenantId    String   @db.Uuid
  almacenId   String   @db.Uuid
  codigo      String
  nombre      String
  descripcion String?
  activo      Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  tenant      Tenant                  @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  almacen     AlmacenMateriaPrima     @relation(fields: [almacenId], references: [id], onDelete: Cascade)
  stocks      StockMateriaPrimaVariante[]
  movimientos MovimientoStockMateriaPrima[]

  @@unique([tenantId, almacenId, codigo])
  @@index([tenantId, almacenId, activo])
}

model StockMateriaPrimaVariante {
  id                 String   @id @default(uuid()) @db.Uuid
  tenantId           String   @db.Uuid
  varianteId         String   @db.Uuid
  ubicacionId        String   @db.Uuid
  cantidadDisponible Decimal  @db.Decimal(14, 4)
  costoPromedio      Decimal  @db.Decimal(14, 6)
  createdAt          DateTime @default(now())
  updatedAt          DateTime @updatedAt

  tenant             Tenant                      @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  variante           MateriaPrimaVariante        @relation(fields: [varianteId], references: [id], onDelete: Cascade)
  ubicacion          AlmacenMateriaPrimaUbicacion @relation(fields: [ubicacionId], references: [id], onDelete: Cascade)

  @@unique([tenantId, varianteId, ubicacionId])
  @@index([tenantId, varianteId])
  @@index([tenantId, ubicacionId])
}

model MovimientoStockMateriaPrima {
  id                String   @id @default(uuid()) @db.Uuid
  tenantId          String   @db.Uuid
  varianteId        String   @db.Uuid
  ubicacionId       String   @db.Uuid
  tipo              TipoMovimientoStockMateriaPrima
  origen            OrigenMovimientoStockMateriaPrima
  cantidad          Decimal  @db.Decimal(14, 4)
  costoUnitario     Decimal? @db.Decimal(14, 6)
  saldoPosterior    Decimal  @db.Decimal(14, 4)
  costoPromedioPost Decimal  @db.Decimal(14, 6)
  referenciaTipo    String?
  referenciaId      String?
  transferenciaId   String?  @db.Uuid
  notas             String?
  createdAt         DateTime @default(now())

  tenant            Tenant                      @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  variante          MateriaPrimaVariante        @relation(fields: [varianteId], references: [id], onDelete: Cascade)
  ubicacion         AlmacenMateriaPrimaUbicacion @relation(fields: [ubicacionId], references: [id], onDelete: Cascade)

  @@index([tenantId, varianteId, createdAt])
  @@index([tenantId, ubicacionId, createdAt])
  @@index([tenantId, tipo, createdAt])
  @@index([tenantId, referenciaTipo, referenciaId])
  @@index([tenantId, transferenciaId])
}
```

## 3) Reglas de negocio exactas (Fase 1)

1. `cantidad` siempre positiva en payload; el signo lo define `tipo`.
2. `EGRESO`, `AJUSTE_SALIDA`, `TRANSFERENCIA_SALIDA` no permiten stock negativo.
3. `INGRESO` y `AJUSTE_ENTRADA` pueden crear registro de stock si no existe.
4. `TRANSFERENCIA` genera dos movimientos en transaccion atomica:
   - salida en origen,
   - entrada en destino,
   - ambas enlazadas por `transferenciaId`.
5. Kardex es inmutable: no se edita ni borra movimiento historico.
6. Costo promedio:
   - ingreso/ajuste_entrada recalculan `costoPromedio` ponderado,
   - egreso/transferencia_salida conservan costoPromedio vigente.

## 4) Endpoints exactos (contrato API)

Base propuesta: `/inventario`

## 4.1 Almacenes

1. `GET /inventario/almacenes`
2. `POST /inventario/almacenes`
3. `PUT /inventario/almacenes/:id`
4. `PATCH /inventario/almacenes/:id/toggle`

Payload create/update:

```json
{
  "codigo": "ALM-CENTRAL",
  "nombre": "Almacen Central",
  "descripcion": "Deposito principal",
  "activo": true
}
```

## 4.2 Ubicaciones

1. `GET /inventario/almacenes/:almacenId/ubicaciones`
2. `POST /inventario/almacenes/:almacenId/ubicaciones`
3. `PUT /inventario/ubicaciones/:id`
4. `PATCH /inventario/ubicaciones/:id/toggle`

Payload create/update:

```json
{
  "codigo": "RACK-A1",
  "nombre": "Rack A1",
  "descripcion": "Vinilos",
  "activo": true
}
```

## 4.3 Movimientos

1. `POST /inventario/movimientos`
2. `POST /inventario/movimientos/transferencia`

### POST /inventario/movimientos

Payload:

```json
{
  "varianteId": "uuid",
  "ubicacionId": "uuid",
  "tipo": "INGRESO",
  "origen": "COMPRA",
  "cantidad": 10.5,
  "costoUnitario": 12.34,
  "referenciaTipo": "compra",
  "referenciaId": "PO-000123",
  "notas": "Ingreso inicial"
}
```

### POST /inventario/movimientos/transferencia

Payload:

```json
{
  "varianteId": "uuid",
  "ubicacionOrigenId": "uuid",
  "ubicacionDestinoId": "uuid",
  "cantidad": 3,
  "referenciaTipo": "traslado-interno",
  "referenciaId": "TR-0001",
  "notas": "Reubicacion por capacidad"
}
```

Respuesta esperada:

```json
{
  "transferenciaId": "uuid",
  "salida": { "movimientoId": "uuid" },
  "entrada": { "movimientoId": "uuid" }
}
```

## 4.4 Stock actual

1. `GET /inventario/stock`

Query params opcionales:

- `varianteId`
- `materiaPrimaId`
- `almacenId`
- `ubicacionId`
- `soloConStock=true|false`

Respuesta (ejemplo):

```json
[
  {
    "varianteId": "uuid",
    "varianteSku": "VIN-127-50-GLOSS",
    "materiaPrimaId": "uuid",
    "materiaPrimaNombre": "Vinilo adhesivo blanco",
    "ubicacionId": "uuid",
    "ubicacionNombre": "Rack A1",
    "almacenId": "uuid",
    "almacenNombre": "Almacen Central",
    "cantidadDisponible": 12.5,
    "costoPromedio": 11.82,
    "valorStock": 147.75,
    "updatedAt": "2026-03-12T15:20:00.000Z"
  }
]
```

## 4.5 Kardex

1. `GET /inventario/kardex`

Query params:

- `varianteId` (requerido en V1)
- `fechaDesde` (opcional)
- `fechaHasta` (opcional)
- `ubicacionId` (opcional)
- `page` / `pageSize`

Respuesta (ejemplo):

```json
{
  "items": [
    {
      "movimientoId": "uuid",
      "createdAt": "2026-03-12T14:00:00.000Z",
      "tipo": "INGRESO",
      "origen": "COMPRA",
      "ubicacionId": "uuid",
      "ubicacionNombre": "Rack A1",
      "cantidad": 10,
      "costoUnitario": 12.3,
      "saldoPosterior": 10,
      "costoPromedioPost": 12.3,
      "referenciaTipo": "compra",
      "referenciaId": "PO-000123",
      "notas": "Ingreso proveedor"
    }
  ],
  "total": 1,
  "page": 1,
  "pageSize": 50
}
```

## 5) DTOs sugeridos (Nest)

1. `CreateAlmacenDto`, `UpdateAlmacenDto`.
2. `CreateUbicacionDto`, `UpdateUbicacionDto`.
3. `RegistrarMovimientoDto`.
4. `RegistrarTransferenciaDto`.
5. `GetStockQueryDto`.
6. `GetKardexQueryDto`.

## 6) Plan tecnico de implementacion

## Paso 1: Migracion Prisma

Nombre sugerido:

`20260312_add_inventario_centro_stock_v1`

Incluye:

1. enums nuevos,
2. tablas `Almacen`, `Ubicacion`, `Stock`, `Movimiento`.

## Paso 2: Servicio de inventario transaccional

1. `registrarMovimiento()`
2. `registrarTransferencia()`
3. `listarStock()`
4. `listarKardex()`

Todo en `prisma.$transaction` cuando aplique.

## Paso 3: Controlador

Agregar rutas nuevas en `InventarioController` o subcontrolador `InventarioStockController`.

## Paso 4: UI minima

1. Nueva vista `Inventario > Centro de stock`.
2. Tabla de stock + filtros.
3. Formulario rapido de movimiento.
4. Vista de kardex por variante.

## 7) Criterios de aceptacion Fase 1

1. Se puede crear almacen y ubicaciones.
2. Se puede ingresar/egresar/ajustar stock.
3. Se puede transferir entre ubicaciones sin romper consistencia.
4. El sistema bloquea egresos que dejen negativo.
5. El kardex explica cada cambio de saldo.
6. El stock actual coincide con sumatoria de kardex.

## 8) Impacto en futuro Productos/Servicios

Con esta fase lista, `Productos y servicios` ya puede:

1. consultar disponibilidad real por variante,
2. consumir costo promedio real en lugar de solo precio referencia,
3. reservar en fase posterior sin rediseño de base.
