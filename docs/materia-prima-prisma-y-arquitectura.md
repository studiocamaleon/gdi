# Materia Prima: Modelo Prisma (Base + Variantes) y Arquitectura de Modulo

Fecha: 2026-03-12
Estado: Borrador tecnico listo para implementacion

## 1) Decision de modelado: base + variantes

Patron recomendado:

1. `MateriaPrima` = maestro base (ej. "Vinilo adhesivo blanco").
2. `MateriaPrimaVariante` = combinacion stockeable/comprable/costeable (ej. ancho 1.27, largo 50, frente mate).
3. Precio, stock, lote y movimientos viven en `Variante`.

Regla:

- si cambia precio/stock/SKU/costo/consumo, debe ser variante.

---

## 2) Propuesta de enums (Prisma)

```prisma
enum FamiliaMateriaPrima {
  SUSTRATO
  TINTA_COLORANTE
  TRANSFERENCIA_LAMINACION
  QUIMICO_AUXILIAR
  ADITIVA_3D
  ELECTRONICA_CARTELERIA
  NEON_LUMINARIA
  METAL_ESTRUCTURA
  PINTURA_RECUBRIMIENTO
  TERMINACION_EDITORIAL
  MAGNETICO_FIJACION
  POP_EXHIBIDOR
  HERRAJE_ACCESORIO
  ADHESIVO_TECNICO
  PACKING_INSTALACION
}

enum SubfamiliaMateriaPrima {
  SUSTRATO_HOJA
  SUSTRATO_ROLLO_FLEXIBLE
  SUSTRATO_RIGIDO
  OBJETO_PROMOCIONAL_BASE
  TINTA_IMPRESION
  TONER
  FILM_TRANSFERENCIA
  PAPEL_TRANSFERENCIA
  LAMINADO_FILM
  QUIMICO_ACABADO
  AUXILIAR_PROCESO
  POLVO_DTF
  FILAMENTO_3D
  RESINA_3D
  MODULO_LED_CARTELERIA
  FUENTE_ALIMENTACION_LED
  CABLEADO_CONECTICA
  CONTROLADOR_LED
  NEON_FLEX_LED
  ACCESORIO_NEON_LED
  CHAPA_METALICA
  PERFIL_ESTRUCTURAL
  PINTURA_CARTELERIA
  PRIMER_SELLADOR
  ANILLADO_ENCUADERNACION
  TAPA_ENCUADERNACION
  IMAN_CERAMICO_FLEXIBLE
  FIJACION_AUXILIAR
  ACCESORIO_EXHIBIDOR_CARTON
  ACCESORIO_MONTAJE_POP
  SEMIELABORADO_POP
  ARGOLLA_LLAVERO_ACCESORIO
  OJAL_OJALILLO_REMACHE
  PORTABANNER_ESTRUCTURA
  SISTEMA_COLGADO_MONTAJE
  PERFIL_BASTIDOR_TEXTIL
  CINTA_DOBLE_FAZ_TECNICA
  ADHESIVO_LIQUIDO_ESTRUCTURAL
  VELCRO_CIERRE_TECNICO
  EMBALAJE_PROTECCION
  ETIQUETADO_IDENTIFICACION
  CONSUMIBLE_INSTALACION
}

enum UnidadMateriaPrima {
  UNIDAD
  PACK
  CAJA
  KIT
  HOJA
  PLIEGO
  RESMA
  ROLLO
  METRO_LINEAL
  M2
  M3
  MM
  CM
  LITRO
  ML
  KG
  GRAMO
  PIEZA
  PAR
}

enum EstadoPrecioVariante {
  BORRADOR
  PUBLICADO
}

enum TipoMovimientoMateriaPrima {
  INGRESO_COMPRA
  INGRESO_AJUSTE
  SALIDA_CONSUMO
  SALIDA_AJUSTE
  RESERVA
  LIBERACION_RESERVA
  TRANSFERENCIA_ENTRADA
  TRANSFERENCIA_SALIDA
}

enum ModoUsoCompatibilidadMateriaPrima {
  SUSTRATO_DIRECTO
  TINTA
  TRANSFERENCIA
  LAMINACION
  AUXILIAR
  MONTAJE
  EMBALAJE
}
```

---

## 3) Propuesta de modelos (Prisma)

```prisma
model MateriaPrima {
  id                    String                  @id @default(uuid()) @db.Uuid
  tenantId              String                  @db.Uuid
  codigo                String
  nombre                String
  descripcion           String?
  familia               FamiliaMateriaPrima
  subfamilia            SubfamiliaMateriaPrima
  tipoTecnico           String
  templateId            String
  templateVersion       Int                     @default(1)
  unidadStock           UnidadMateriaPrima
  unidadCompra          UnidadMateriaPrima
  factorConversionCompra Decimal                @db.Decimal(14, 6)
  controlLote           Boolean                 @default(false)
  controlVencimiento    Boolean                 @default(false)
  activo                Boolean                 @default(true)
  atributosTecnicosJson Json
  createdAt             DateTime                @default(now())
  updatedAt             DateTime                @updatedAt

  tenant                Tenant                  @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  variantes             MateriaPrimaVariante[]
  proveedores           MateriaPrimaProveedor[]
  compatibilidades      MateriaPrimaCompatibilidadMaquina[]

  @@unique([tenantId, codigo])
  @@index([tenantId, familia, subfamilia, activo])
  @@index([tenantId, nombre])
}

model MateriaPrimaVariante {
  id                    String                   @id @default(uuid()) @db.Uuid
  tenantId              String                   @db.Uuid
  materiaPrimaId        String                   @db.Uuid
  sku                   String
  nombreVariante        String?
  activo                Boolean                  @default(true)
  atributosVarianteJson Json
  claveVarianteHash     String
  unidadStock           UnidadMateriaPrima?
  unidadCompra          UnidadMateriaPrima?
  factorConversionCompra Decimal?                @db.Decimal(14, 6)
  createdAt             DateTime                 @default(now())
  updatedAt             DateTime                 @updatedAt

  tenant                Tenant                   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  materiaPrima          MateriaPrima             @relation(fields: [materiaPrimaId], references: [id], onDelete: Cascade)
  precios               MateriaPrimaVariantePrecio[]
  lotes                 LoteMateriaPrimaVariante[]
  stocks                StockMateriaPrimaVariante[]
  movimientos           MovimientoMateriaPrima[]
  compatibilidades      MateriaPrimaCompatibilidadMaquina[]

  @@unique([tenantId, sku])
  @@unique([tenantId, materiaPrimaId, claveVarianteHash])
  @@index([tenantId, materiaPrimaId, activo])
}

model MateriaPrimaProveedor {
  id                    String                  @id @default(uuid()) @db.Uuid
  tenantId              String                  @db.Uuid
  materiaPrimaId        String                  @db.Uuid
  proveedorId           String                  @db.Uuid
  skuProveedor          String?
  leadTimeDias          Int?
  cantidadMinimaCompra  Decimal?                @db.Decimal(12, 3)
  costoReferencia       Decimal?                @db.Decimal(12, 4)
  moneda                String?                 @db.VarChar(3)
  preferido             Boolean                 @default(false)
  activo                Boolean                 @default(true)
  createdAt             DateTime                @default(now())
  updatedAt             DateTime                @updatedAt

  tenant                Tenant                  @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  materiaPrima          MateriaPrima            @relation(fields: [materiaPrimaId], references: [id], onDelete: Cascade)
  proveedor             Proveedor               @relation(fields: [proveedorId], references: [id], onDelete: Cascade)

  @@index([tenantId, materiaPrimaId, activo])
  @@index([tenantId, proveedorId, activo])
}

model MateriaPrimaVariantePrecio {
  id                    String                  @id @default(uuid()) @db.Uuid
  tenantId              String                  @db.Uuid
  varianteId            String                  @db.Uuid
  proveedorId           String?                 @db.Uuid
  estado                EstadoPrecioVariante    @default(BORRADOR)
  precioUnitario        Decimal                 @db.Decimal(14, 6)
  unidadPrecio          UnidadMateriaPrima
  vigenciaDesde         DateTime?               @db.Date
  vigenciaHasta         DateTime?               @db.Date
  notas                 String?
  createdAt             DateTime                @default(now())
  updatedAt             DateTime                @updatedAt

  tenant                Tenant                  @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  variante              MateriaPrimaVariante    @relation(fields: [varianteId], references: [id], onDelete: Cascade)
  proveedor             Proveedor?              @relation(fields: [proveedorId], references: [id], onDelete: SetNull)

  @@index([tenantId, varianteId, estado])
  @@index([tenantId, proveedorId, estado])
}

model AlmacenMateriaPrima {
  id                    String                  @id @default(uuid()) @db.Uuid
  tenantId              String                  @db.Uuid
  codigo                String
  nombre                String
  activo                Boolean                 @default(true)
  createdAt             DateTime                @default(now())
  updatedAt             DateTime                @updatedAt

  tenant                Tenant                  @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  ubicaciones           AlmacenMateriaPrimaUbicacion[]

  @@unique([tenantId, codigo])
  @@index([tenantId, activo])
}

model AlmacenMateriaPrimaUbicacion {
  id                    String                  @id @default(uuid()) @db.Uuid
  tenantId              String                  @db.Uuid
  almacenId             String                  @db.Uuid
  codigo                String
  nombre                String
  activo                Boolean                 @default(true)
  createdAt             DateTime                @default(now())
  updatedAt             DateTime                @updatedAt

  tenant                Tenant                  @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  almacen               AlmacenMateriaPrima     @relation(fields: [almacenId], references: [id], onDelete: Cascade)
  lotes                 LoteMateriaPrimaVariante[]
  stocks                StockMateriaPrimaVariante[]
  movimientos           MovimientoMateriaPrima[]

  @@unique([tenantId, almacenId, codigo])
  @@index([tenantId, almacenId, activo])
}

model LoteMateriaPrimaVariante {
  id                    String                  @id @default(uuid()) @db.Uuid
  tenantId              String                  @db.Uuid
  varianteId            String                  @db.Uuid
  ubicacionId           String?                 @db.Uuid
  lote                  String
  fechaVencimiento      DateTime?               @db.Date
  costoUnitario         Decimal?                @db.Decimal(14, 6)
  activo                Boolean                 @default(true)
  createdAt             DateTime                @default(now())
  updatedAt             DateTime                @updatedAt

  tenant                Tenant                  @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  variante              MateriaPrimaVariante    @relation(fields: [varianteId], references: [id], onDelete: Cascade)
  ubicacion             AlmacenMateriaPrimaUbicacion? @relation(fields: [ubicacionId], references: [id], onDelete: SetNull)
  stocks                StockMateriaPrimaVariante[]
  movimientos           MovimientoMateriaPrima[]

  @@unique([tenantId, varianteId, lote])
  @@index([tenantId, varianteId, activo])
}

model StockMateriaPrimaVariante {
  id                    String                  @id @default(uuid()) @db.Uuid
  tenantId              String                  @db.Uuid
  varianteId            String                  @db.Uuid
  ubicacionId           String                  @db.Uuid
  loteId                String?                 @db.Uuid
  cantidadDisponible    Decimal                 @db.Decimal(14, 4)
  cantidadReservada     Decimal                 @db.Decimal(14, 4)
  createdAt             DateTime                @default(now())
  updatedAt             DateTime                @updatedAt

  tenant                Tenant                  @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  variante              MateriaPrimaVariante    @relation(fields: [varianteId], references: [id], onDelete: Cascade)
  ubicacion             AlmacenMateriaPrimaUbicacion @relation(fields: [ubicacionId], references: [id], onDelete: Cascade)
  lote                  LoteMateriaPrimaVariante? @relation(fields: [loteId], references: [id], onDelete: SetNull)

  @@unique([tenantId, varianteId, ubicacionId, loteId])
  @@index([tenantId, varianteId])
  @@index([tenantId, ubicacionId])
}

model MovimientoMateriaPrima {
  id                    String                  @id @default(uuid()) @db.Uuid
  tenantId              String                  @db.Uuid
  varianteId            String                  @db.Uuid
  ubicacionId           String?                 @db.Uuid
  loteId                String?                 @db.Uuid
  tipo                  TipoMovimientoMateriaPrima
  cantidad              Decimal                 @db.Decimal(14, 4)
  unidad                UnidadMateriaPrima
  costoUnitario         Decimal?                @db.Decimal(14, 6)
  referenciaTipo        String?
  referenciaId          String?
  notas                 String?
  createdAt             DateTime                @default(now())

  tenant                Tenant                  @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  variante              MateriaPrimaVariante    @relation(fields: [varianteId], references: [id], onDelete: Cascade)
  ubicacion             AlmacenMateriaPrimaUbicacion? @relation(fields: [ubicacionId], references: [id], onDelete: SetNull)
  lote                  LoteMateriaPrimaVariante? @relation(fields: [loteId], references: [id], onDelete: SetNull)

  @@index([tenantId, varianteId, createdAt])
  @@index([tenantId, tipo, createdAt])
}

model MateriaPrimaCompatibilidadMaquina {
  id                    String                  @id @default(uuid()) @db.Uuid
  tenantId              String                  @db.Uuid
  materiaPrimaId        String                  @db.Uuid
  varianteId            String?                 @db.Uuid
  plantillaMaquinaria   PlantillaMaquinaria?
  maquinaId             String?                 @db.Uuid
  perfilOperativoId     String?                 @db.Uuid
  modoUso               ModoUsoCompatibilidadMateriaPrima
  consumoBase           Decimal?                @db.Decimal(14, 6)
  unidadConsumo         UnidadMateriaPrima?
  mermaBasePct          Decimal?                @db.Decimal(8, 4)
  activo                Boolean                 @default(true)
  createdAt             DateTime                @default(now())
  updatedAt             DateTime                @updatedAt

  tenant                Tenant                  @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  materiaPrima          MateriaPrima            @relation(fields: [materiaPrimaId], references: [id], onDelete: Cascade)
  variante              MateriaPrimaVariante?   @relation(fields: [varianteId], references: [id], onDelete: SetNull)
  maquina               Maquina?                @relation(fields: [maquinaId], references: [id], onDelete: SetNull)
  perfilOperativo       MaquinaPerfilOperativo? @relation(fields: [perfilOperativoId], references: [id], onDelete: SetNull)

  @@index([tenantId, materiaPrimaId, activo])
  @@index([tenantId, varianteId, activo])
  @@index([tenantId, plantillaMaquinaria, activo])
  @@index([tenantId, maquinaId, perfilOperativoId, activo])
}
```

---

## 4) Nota sobre variantes y UI (como la captura que compartiste)

El comportamiento recomendado para UI:

1. En ficha de materia prima, pestaña `Opciones/Variantes`.
2. Grilla de variantes con columnas dinámicas (ancho, largo, frente, color, etc.).
3. Precio e inventario por variante.
4. Búsqueda/filtro por combinación de atributos.

Ejemplo:

- Base: `Vinilo Adhesivo Blanco`
- Variantes:
  - `ancho=1.06`, `largo=50`, `frente=gloss`
  - `ancho=1.27`, `largo=50`, `frente=gloss`
  - `ancho=1.52`, `largo=50`, `frente=matte`

---

## 5) Ubicacion del modulo: Costos vs Inventario

Recomendacion principal:

1. `Materia Prima` debe vivir bajo modulo padre `Inventario`.
2. `Costos` debe consumir su valorizacion y snapshots.

Por que:

1. `Materia Prima` no es solo costo: tiene ciclo de vida de stock, lotes, movimientos, compras, reservas y consumo.
2. Si queda dentro de `Costos`, se sesga al calculo y se debilita trazabilidad operativa.
3. En MIS/ERP graficos competitivos, materiales se gestionan en inventario/warehouse con integracion a estimating/job costing.

Arquitectura recomendada:

- Padre: `Inventario`
  - `Materias primas`
  - `Almacenes`
  - `Stock y lotes`
  - `Movimientos`
- Integraciones:
  - `Costos`: toma costo material valorizado
  - `Procesos`: reglas de consumo por operacion
  - `Compras`: reposicion
  - `Productos y servicios`: cotizacion tecnica

Ruta transicional (si queres entrega incremental):

1. V1 UI en sidebar puede aparecer en `Costos` por rapidez.
2. Meta V1.1: moverlo a `Inventario` como home natural.

---

## 6) Siguiente paso tecnico sugerido

1. Crear migracion inicial con modelos core (`MateriaPrima`, `Variante`, `Proveedor`, `Compatibilidad`).
2. Crear DTOs de alta/edicion con validacion por `template`.
3. Implementar endpoints CRUD + variantes.
4. Implementar stock/movimientos por variante en la segunda migracion.

