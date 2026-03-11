# Especificacion Tecnica del Modelo de Datos de Maquinaria

## Objetivo

Definir la estructura de datos inicial para implementar el modulo `Maquinaria` dentro del ERP, alineada con:

- el esquema actual de `Tenant`, `Planta` y `CentroCosto`
- el alcance V1 aprobado para maquinaria
- un catalogo de plantillas cerrado y versionado por el sistema
- una futura integracion con costeo y procesos

## Decision estructural principal

Las `plantillas de maquinaria` no deben persistirse como registros editables por tenant.

En V1, las plantillas deben vivir como un `catalogo versionado en codigo`, porque:

- son definiciones oficiales del sistema
- deben imponer consistencia estructural
- no deben ser modificables libremente por cada cliente
- permiten validar mejor formularios, ayuda contextual y reglas

La base de datos debe guardar:

- maquinas concretas
- perfiles operativos de cada maquina
- consumibles
- componentes de desgaste
- vinculos organizativos y economicos

## Integracion con el esquema actual

Hoy el proyecto ya tiene:

- `Tenant`
- `Planta`
- `AreaCosto`
- `CentroCosto`

Referencias actuales:

- [schema.prisma](/Users/lucasgomez/gdi-saas/apps/api/prisma/schema.prisma#L379)
- [schema.prisma](/Users/lucasgomez/gdi-saas/apps/api/prisma/schema.prisma#L396)
- [schema.prisma](/Users/lucasgomez/gdi-saas/apps/api/prisma/schema.prisma#L414)

### Decision de vinculacion V1

Para no sobrediseñar el esquema inicial:

- `plantaId` debe ser obligatorio en `Maquina`
- `centroCostoPrincipalId` debe ser opcional
- `ubicacionDetalle` debe ser un `string`
- no crear una entidad nueva de `Sector` en V1
- `areaCostoId` no debe vivir en `Maquina` si ya existe el vinculo a `CentroCosto`

Esto deja un modelo simple, consistente y sin duplicidad estructural innecesaria.

## Enums propuestos

### `PlantillaMaquinaria`

```ts
type PlantillaMaquinaria =
  | "router_cnc"
  | "corte_laser"
  | "impresora_3d"
  | "impresora_dtf"
  | "impresora_dtf_uv"
  | "impresora_uv_mesa_extensora"
  | "impresora_uv_cilindrica"
  | "impresora_uv_flatbed"
  | "impresora_uv_rollo"
  | "impresora_solvente"
  | "impresora_inyeccion_tinta"
  | "impresora_latex"
  | "impresora_sublimacion_gran_formato"
  | "impresora_laser"
  | "plotter_cad"
  | "mesa_de_corte"
  | "plotter_de_corte";
```

### `EstadoMaquina`

```ts
type EstadoMaquina = "activa" | "inactiva" | "mantenimiento" | "baja";
```

### `EstadoConfiguracionMaquina`

```ts
type EstadoConfiguracionMaquina = "borrador" | "incompleta" | "lista";
```

### `GeometriaTrabajoMaquina`

```ts
type GeometriaTrabajoMaquina =
  | "pliego"
  | "rollo"
  | "plano"
  | "cilindrico"
  | "volumen";
```

### `UnidadProduccionMaquina`

```ts
type UnidadProduccionMaquina =
  | "hora"
  | "hoja"
  | "copia"
  | "a4_equiv"
  | "m2"
  | "metro_lineal"
  | "pieza"
  | "ciclo";
```

### `TipoPerfilOperativo`

```ts
type TipoPerfilOperativo =
  | "impresion"
  | "corte"
  | "mecanizado"
  | "grabado"
  | "fabricacion"
  | "mixto";
```

### `TipoConsumibleMaquina`

```ts
type TipoConsumibleMaquina =
  | "toner"
  | "tinta"
  | "barniz"
  | "primer"
  | "film"
  | "polvo"
  | "adhesivo"
  | "resina"
  | "lubricante"
  | "otro";
```

### `UnidadConsumoMaquina`

```ts
type UnidadConsumoMaquina =
  | "ml"
  | "litro"
  | "gramo"
  | "kg"
  | "unidad"
  | "m2"
  | "metro_lineal"
  | "pagina"
  | "a4_equiv";
```

### `TipoComponenteDesgasteMaquina`

```ts
type TipoComponenteDesgasteMaquina =
  | "fusor"
  | "drum"
  | "developer"
  | "correa_transferencia"
  | "cabezal"
  | "lampara_uv"
  | "fresa"
  | "cuchilla"
  | "filtro"
  | "kit_mantenimiento"
  | "otro";
```

### `UnidadDesgasteMaquina`

```ts
type UnidadDesgasteMaquina =
  | "copias_a4_equiv"
  | "m2"
  | "metros_lineales"
  | "horas"
  | "ciclos"
  | "piezas";
```

## Catalogo de plantillas en codigo

El catalogo debe implementarse en una fuente central, por ejemplo:

- `src/lib/maquinaria-templates.ts`

Cada plantilla debe incluir:

- `id`
- `label`
- `familia`
- `descripcion`
- `geometriaTrabajo`
- `unidadProduccionDefault`
- `camposComunesRequeridos`
- `seccionesVisibles`
- `schemaCapacidades`
- `schemaParametrosTecnicos`
- `schemaPerfiles`
- `schemaConsumibles`
- `schemaDesgaste`
- `helpContent`

## Estrategia de modelado

### Que va en columnas tipadas

Se recomienda guardar en columnas normales:

- identidad de maquina
- vinculos relacionales
- estado
- plantilla
- geometria
- unidad principal
- anchos, largos, altos o espesores maximos base
- marcas booleanas de estado y actividad

### Que va en JSON validado

Se recomienda guardar en JSON estructurado y validado por plantilla:

- `parametrosTecnicosJson`
- `capacidadesAvanzadasJson`
- detalles especificos del perfil operativo
- detalles especificos de consumibles
- detalles especificos de desgaste

### Razon

Con 17 plantillas iniciales, una tabla por plantilla no es razonable para V1.

Pero tampoco conviene un unico blob JSON sin estructura.

La estrategia recomendada es:

- `core comun tipado`
- `detalle especifico validado por plantilla`

## Modelos propuestos

## `Maquina`

Representa el equipo concreto del cliente.

Campos recomendados:

- `id`
- `tenantId`
- `codigo`
- `nombre`
- `plantilla`
- `plantillaVersion`
- `fabricante`
- `modelo`
- `numeroSerie`
- `plantaId`
- `centroCostoPrincipalId`
- `ubicacionDetalle`
- `estado`
- `estadoConfiguracion`
- `geometriaTrabajo`
- `unidadProduccionPrincipal`
- `anchoUtil`
- `largoUtil`
- `altoUtil`
- `espesorMaximo`
- `pesoMaximo`
- `fechaAlta`
- `activo`
- `observaciones`
- `parametrosTecnicosJson`
- `capacidadesAvanzadasJson`
- `createdAt`
- `updatedAt`

Decisiones:

- `codigo` debe ser unico por tenant
- `centroCostoPrincipalId` debe ser opcional
- `activo` y `estado` conviene mantenerlos separados
- `estadoConfiguracion` se puede recalcular desde backend pero conviene persistirlo

## `MaquinaPerfilOperativo`

Subentidad para modos de uso reales del equipo.

Campos recomendados:

- `id`
- `tenantId`
- `maquinaId`
- `nombre`
- `tipoPerfil`
- `activo`
- `anchoAplicable`
- `altoAplicable`
- `modoTrabajo`
- `calidad`
- `productividad`
- `unidadProductividad`
- `tiempoPreparacionMin`
- `tiempoCargaMin`
- `tiempoDescargaMin`
- `tiempoRipMin`
- `cantidadPasadas`
- `dobleFaz`
- `detalleJson`
- `createdAt`
- `updatedAt`

Notas:

- `detalleJson` sirve para configuraciones como color, canales, herramienta, rpm, material objetivo o secado
- `modoTrabajo` debe ser string controlado por plantilla desde el catalogo, no texto libre puro en frontend

## `MaquinaConsumible`

Subentidad para insumos variables del equipo.

Campos recomendados:

- `id`
- `tenantId`
- `maquinaId`
- `perfilOperativoId`
- `nombre`
- `tipo`
- `unidad`
- `costoReferencia`
- `rendimientoEstimado`
- `consumoBase`
- `activo`
- `detalleJson`
- `observaciones`
- `createdAt`
- `updatedAt`

Notas:

- `perfilOperativoId` debe ser opcional
- si un consumible aplica solo a cierto perfil, se vincula
- si aplica a toda la maquina, queda null

## `MaquinaComponenteDesgaste`

Subentidad para repuestos o kits con vida util.

Campos recomendados:

- `id`
- `tenantId`
- `maquinaId`
- `nombre`
- `tipo`
- `vidaUtilEstimada`
- `unidadDesgaste`
- `costoReposicion`
- `modoProrrateo`
- `activo`
- `detalleJson`
- `observaciones`
- `createdAt`
- `updatedAt`

Notas:

- `modoProrrateo` puede arrancar como string simple en V1
- mas adelante puede normalizarse si aparece un conjunto estable

## `MaquinaDocumento` (opcional V1)

No lo considero obligatorio en la primera migracion.

Si se incluye:

- `id`
- `tenantId`
- `maquinaId`
- `nombre`
- `tipoDocumento`
- `archivoUrl`
- `observaciones`
- `createdAt`

Si no se incluye, puede diferirse a V2 sin bloquear el modulo principal.

## Relaciones recomendadas

- `Tenant 1 - N Maquina`
- `Planta 1 - N Maquina`
- `CentroCosto 1 - N Maquina`
- `Maquina 1 - N MaquinaPerfilOperativo`
- `Maquina 1 - N MaquinaConsumible`
- `Maquina 1 - N MaquinaComponenteDesgaste`
- `MaquinaPerfilOperativo 1 - N MaquinaConsumible` opcional

## Restricciones e indices

### `Maquina`

- unique `(tenantId, codigo)`
- index `(tenantId, plantilla, activo)`
- index `(tenantId, plantaId, activo)`
- index `(tenantId, estado)`
- index `(tenantId, centroCostoPrincipalId)`

### `MaquinaPerfilOperativo`

- index `(tenantId, maquinaId, activo)`
- unique recomendado `(tenantId, maquinaId, nombre)` para evitar duplicados

### `MaquinaConsumible`

- index `(tenantId, maquinaId, activo)`
- index `(tenantId, perfilOperativoId)` si aplica

### `MaquinaComponenteDesgaste`

- index `(tenantId, maquinaId, activo)`

## Propuesta de esquema Prisma

No es la migracion definitiva, pero esta es la direccion tecnica recomendada.

```prisma
enum PlantillaMaquinaria {
  ROUTER_CNC
  CORTE_LASER
  IMPRESORA_3D
  IMPRESORA_DTF
  IMPRESORA_DTF_UV
  IMPRESORA_UV_MESA_EXTENSORA
  IMPRESORA_UV_CILINDRICA
  IMPRESORA_UV_FLATBED
  IMPRESORA_UV_ROLLO
  IMPRESORA_SOLVENTE
  IMPRESORA_INYECCION_TINTA
  IMPRESORA_LATEX
  IMPRESORA_SUBLIMACION_GRAN_FORMATO
  IMPRESORA_LASER
  PLOTTER_CAD
  MESA_DE_CORTE
  PLOTTER_DE_CORTE
}

enum EstadoMaquina {
  ACTIVA
  INACTIVA
  MANTENIMIENTO
  BAJA
}

enum EstadoConfiguracionMaquina {
  BORRADOR
  INCOMPLETA
  LISTA
}

enum GeometriaTrabajoMaquina {
  PLIEGO
  ROLLO
  PLANO
  CILINDRICO
  VOLUMEN
}

enum UnidadProduccionMaquina {
  HORA
  HOJA
  COPIA
  A4_EQUIV
  M2
  METRO_LINEAL
  PIEZA
  CICLO
}

model Maquina {
  id                         String                      @id @default(uuid()) @db.Uuid
  tenantId                   String                      @db.Uuid
  codigo                     String
  nombre                     String
  plantilla                  PlantillaMaquinaria
  plantillaVersion           Int                         @default(1)
  fabricante                 String?
  modelo                     String?
  numeroSerie                String?
  plantaId                   String                      @db.Uuid
  centroCostoPrincipalId     String?                     @db.Uuid
  ubicacionDetalle           String?
  estado                     EstadoMaquina               @default(ACTIVA)
  estadoConfiguracion        EstadoConfiguracionMaquina  @default(BORRADOR)
  geometriaTrabajo           GeometriaTrabajoMaquina
  unidadProduccionPrincipal  UnidadProduccionMaquina
  anchoUtil                  Decimal?                    @db.Decimal(12, 2)
  largoUtil                  Decimal?                    @db.Decimal(12, 2)
  altoUtil                   Decimal?                    @db.Decimal(12, 2)
  espesorMaximo              Decimal?                    @db.Decimal(12, 2)
  pesoMaximo                 Decimal?                    @db.Decimal(12, 2)
  fechaAlta                  DateTime?                   @db.Date
  activo                     Boolean                     @default(true)
  observaciones              String?
  parametrosTecnicosJson     Json?
  capacidadesAvanzadasJson   Json?
  createdAt                  DateTime                    @default(now())
  updatedAt                  DateTime                    @updatedAt
  tenant                     Tenant                      @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  planta                     Planta                      @relation(fields: [plantaId], references: [id], onDelete: Cascade)
  centroCostoPrincipal       CentroCosto?                @relation(fields: [centroCostoPrincipalId], references: [id], onDelete: SetNull)
  perfilesOperativos         MaquinaPerfilOperativo[]
  consumibles                MaquinaConsumible[]
  componentesDesgaste        MaquinaComponenteDesgaste[]

  @@unique([tenantId, codigo])
  @@index([tenantId, plantilla, activo])
  @@index([tenantId, plantaId, activo])
  @@index([tenantId, estado])
  @@index([tenantId, centroCostoPrincipalId])
}
```

Las subentidades deben seguir el mismo patron multi-tenant que el resto del esquema actual.

## Reglas de validacion de backend

El backend debe validar:

- que la plantilla exista en el catalogo del sistema
- que los campos comunes obligatorios esten presentes
- que `geometriaTrabajo` y `unidadProduccionPrincipal` coincidan con la plantilla
- que el JSON tecnico respete la definicion de la plantilla
- que no se carguen perfiles, consumibles o desgastes incompatibles con la plantilla
- que el `centroCostoPrincipalId`, si existe, pertenezca al mismo tenant

## Estrategia de estados de configuracion

`estadoConfiguracion` no debe depender de completitud libre.

Regla sugerida:

- `BORRADOR`: faltan datos basicos o no hay estructura minima
- `INCOMPLETA`: hay maquina creada pero faltan bloques importantes
- `LISTA`: tiene datos base validos y al menos un bloque operativo consistente

Esto ayuda mucho a la UX del listado y a priorizar configuraciones pendientes.

## Consideraciones de migracion

### Primera migracion

La primera migracion deberia incluir:

- enums
- `Maquina`
- `MaquinaPerfilOperativo`
- `MaquinaConsumible`
- `MaquinaComponenteDesgaste`
- relaciones con `Tenant`, `Planta` y `CentroCosto`

### No incluir en primera migracion

- historiales
- documentos
- auditoria custom
- tablas de procesos
- tablas de formulas de costeo

## Impacto esperado en frontend

Aunque este documento es de datos, condiciona la UI:

- el alta de maquina debe comenzar por plantilla
- cada seccion del formulario se renderiza desde el catalogo de plantilla
- las ayudas contextuales deben venir del mismo catalogo
- las tablas de perfiles, consumibles y desgaste deben operar sobre subentidades concretas

Esto encaja bien con una UI compuesta con `shadcn/ui`, especialmente usando:

- `Sheet`
- `Tabs`
- `Card`
- `Table`
- `FieldGroup`
- `Tooltip`
- `HoverCard`
- `Alert`

## Siguiente paso recomendado

Con esta base, el siguiente paso deberia ser una de estas dos cosas:

1. definir el `catalogo tecnico de plantillas` en codigo
2. diseñar la `migracion Prisma` y los DTOs del backend

Mi recomendacion es avanzar primero con el catalogo tecnico en codigo, porque de ahi salen:

- validaciones
- formularios
- ayudas contextuales
- defaults por plantilla
- y despues la UI de shadcn queda mucho mas ordenada
