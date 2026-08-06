# Pasos del tenant por PLANTILLA — diseño

**Estado: E1 HECHA** (2026-08-07) — faltan E2 (catálogo/estación) y E3 (modal). Reemplaza el modelo de "familias tenant
declaradas desde cero" por **instancias de una plantilla del sistema**, con
herencia viva de toda la ficha.

## 1. La decisión en una frase

El tenant deja de **declarar** pasos (eligiendo mecanismos, superficies,
outputs canónicos: nuestro idioma interno) y pasa a **instanciar** una
plantilla del catálogo de Grafo, poniéndole su nombre y sus defaults. La
instancia **hereda la ficha completa** de la plantilla, así que tiene los
mismos superpoderes que un paso del sistema: derivador, nesting, primitivas,
todo.

## 2. El diagnóstico (por qué el modelo actual no sirve)

### 2.1 Las familias tenant son ciudadanos de segunda clase

Proyectando una familia tenant real y mirando los **16 ejes avanzados** de la
ficha ([ficha-familia-pasos.md](ficha-familia-pasos.md) §2), tiene **cero**:

```
✗ derivador      ✗ primitivas       ✗ nestingConfig (salvo superficie)
✗ esImpresion    ✗ outputHeredadoDefault  ✗ mecanismoCantidadDefault
✗ ritmoDefault   ✗ paramsPasoSchema ✗ editorParamsGenerico
✗ mutaMedidasEnPrePasada  ✗ magnitudTiempoDefault  ✗ fuentesPiezasNesting
✗ separacionNestingDefaultMm  ✗ sinConsumiblesMaquina
✗ origenMargenesNesting  ✗ semanticaSeparacion
```

Es estructural: el tenant no tiene forma de apuntar a los tres catálogos
(derivadores, estrategias de nesting, primitivas) porque son código. O sea,
el sistema tiene **dos clases de familia con capacidades distintas** — la
misma bifurcación que pasamos meses matando dentro del motor, pero a nivel de
modelo de datos.

### 2.2 El uso real dice que el wizard es un parche, no una herramienta

Las únicas 4 familias tenant que existieron (dev, borradas el 2026-08-07):

| Nombre | Ejes | Diagnóstico |
|---|---|---|
| Bordado | M-0, directa | **Hueco del catálogo** (bordado no existe como familia) |
| Serigrafía manual | M-0, directa/hereda | **Hueco del catálogo** |
| Estampado en pliego | M-0, calcula + pliego | **Hueco** (no hay manual que acomode en pliego) |
| Troquelado tercerizado E2E | M-0, directa | Fixture de test |

Las cuatro son M-0 manuales; ninguna es de máquina. **Tres de cuatro son
huecos** que el test del nicho digital ya había identificado. El wizard no se
usó para modelar: se usó para tapar familias que nos faltan.

### 2.3 El wizard habla en idioma motor

Pedir "mecanismo de cantidad", "superficie de acomodo", "outputs canónicos",
"inputs requeridos" y "validaciones declaradas" contradice la regla que
fijamos para el editor guiado: *el usuario habla en lenguaje de imprenta; los
ejes son nuestros*.

## 3. El modelo nuevo

### 3.1 La instancia

Una fila por paso propio del tenant, con **sólo lo suyo**:

```ts
PasoTenant {
  id            // el código que usan RutaPaso / OT
  tenantId
  plantillaCodigo   // ← FamiliaCodigo del sistema. LA HERENCIA. Obligatorio.
  nombre            // "Bordado", "Pegado de imanes"
  descripcion?
  icono?            // si se omite, el de la plantilla
  activo
  // + los defaults que hoy viven en FamiliaPasoDefaults
  centroCostoId? productividadHora? tiempoFijoMin? demasiaMm? solapePanelMm?
  tercerizado? proveedorId? fuenteCostoTercerizado? plazoProveedorDias?
}
```

**Desaparecen los 14 campos de forma** (`relacionMaquina`, `modosTiempo`,
`mecanismosCantidad`, `modosActivacion`, `slots`, `multiplicadores`,
`plantillasCompatibles`, `tiposPerfilCompatibles`, `inputsRequeridos`,
`outputsCanonicos`, `validaciones`, `permiteSlotsAdicionales`,
`nestingConfigJson`, `modoRegistro`): todos vienen de la plantilla.

### 3.2 La herencia, en una línea

```ts
// resolverFamilia(codigo)
if (FAMILIAS[codigo]) return FAMILIAS[codigo];          // paso del sistema
const inst = REGISTRO_TENANT.get(codigo);               // instancia
if (!inst) return undefined;
return {
  ...FAMILIAS[inst.plantillaCodigo],   // ← toda la ficha, viva
  codigo: inst.id,
  nombre: inst.nombre,
  descripcion: inst.descripcion ?? FAMILIAS[inst.plantillaCodigo].descripcion,
  esTenant: true,
  plantillaCodigo: inst.plantillaCodigo,
};
```

Con eso, una instancia de `trabajo_manual` llamada "Bordado" **es** un
trabajo manual a todos los efectos; y el día que exista la plantilla
`bordado` con su eje de puntadas, la instancia se re-apunta y hereda eso.

### 3.3 Qué edita el tenant, qué no

| Nivel | Campos | Editable |
|---|---|---|
| Identidad | nombre, descripción, ícono, activo | ✅ siempre |
| Defaults del taller | centro de costo, ritmo típico, tiempo fijo, demasía, solape, tercerización + proveedor | ✅ siempre |
| **Forma** (los ejes de la ficha) | todo lo demás | ❌ nunca — es de la plantilla |

**Regla de oro**: si el tenant necesita una forma que ninguna plantilla da,
**falta una plantilla** — y eso es feedback de producto para Grafo, no un
agujero que el tenant deba tapar solo. Vale registrar esos intentos.

### 3.4 El journey de creación (definido por Lucas, 2026-08-07)

**Igual que el alta de máquina**: un modal chico que pide lo mínimo y crea
con los defaults de la plantilla. El modelo a copiar existe y funciona —
[`maquina-alta-dialog.tsx`](../src/components/costos/maquina-editor/maquina-alta-dialog.tsx),
167 líneas, cuyo propio comentario dice *"Reemplaza al sheet gigante de alta"*.

```
[+ Nuevo paso]
      ↓
┌─ Nuevo paso ─────────────────────────┐
│  Nombre del paso *                   │   ej: "Bordado"
│  [_________________________]         │
│                                      │
│  Tipo (plantilla de paso) *          │
│  🔍 [búsqueda________]               │
│  ┌──────────────────────────────┐    │
│  │ Trabajo manual            ✓  │    │   ← lista filtrable de las
│  │ Impresión por hoja           │    │      plantillas del sistema
│  │ Corte con guillotina         │    │
│  │ …                            │    │
│  └──────────────────────────────┘    │
│              [Cancelar]  [Guardar]   │
└──────────────────────────────────────┘
      ↓
  se crea la instancia y te lleva a su ficha,
  donde configurás los defaults del taller
  (centro de costo, ritmo típico, tercerización)
```

**Lo que muere**: el sheet actual (`pasos-familias-view.tsx`, 1.714 líneas)
con su wizard de **13 pantallas** — arranque, quién lo hace, proveedor,
máquina, máquinas candidatas, tiempo, materiales, cantidad, activación,
centro, registro, final. Todas esas decisiones ahora vienen de la plantilla
(las de forma) o se configuran después en la ficha (los defaults) y en el
editor de ruta del producto (lo específico de ese producto).

Es el mismo movimiento que ya se hizo con maquinaria en la Fase D del
rediseño estilo Holdprint: **el alta pide lo mínimo, la ficha completa el
resto**.

## 4. Decisiones de diseño (cerradas)

### 4.1 Herencia VIVA, no foto congelada

La instancia guarda el **puntero** a la plantilla, no una copia. Si mejoramos
`trabajo_manual`, todas las instancias mejoran.

- **Riesgo**: un cambio de plantilla altera productos existentes.
- **Mitigación que ya existe**: las plantillas son catálogo cerrado con
  deploy y golden masters; y `RutaVersion.snapshotJson` ya congela la
  configuración del paso dentro del producto, que es donde importa.
- El campo `presetOrigen` de hoy era justamente una copia congelada — se
  reemplaza por `plantillaCodigo` obligatorio.

### 4.2 Varias instancias por plantilla

"Trabajo manual" puede instanciarse N veces: Bordado, Serigrafía, Pegado de
imanes. Consecuencia: los defaults se mudan de `FamiliaPasoDefaults` (que es
`@@unique([tenantId, familiaCodigo])`, uno solo por familia) **a la
instancia**.

### 4.3 `FamiliaPasoDefaults` sobrevive, para las familias del sistema

Un tenant que usa `impresion_por_hoja` tal cual (sin instanciarla) sigue
teniendo sus defaults ahí. La instancia es **opt-in**: se crea cuando el
tenant quiere *su nombre* y *su configuración propia*.

> Alternativa descartada por ahora: que TODO paso usado sea una instancia
> (incluso los del sistema). Es más puro conceptualmente pero obliga a migrar
> todas las rutas existentes; se puede evaluar más adelante.

### 4.4 Se reforma `FamiliaTenant`, no se crea tabla nueva

La tabla **quedó vacía** tras la limpieza del 2026-08-07 (4 familias, 3 rutas
E2E, 1 producto de prueba, su cotización y su OT — sin referencias huérfanas).
Se puede cambiar su forma sin migrar un solo dato. Queda a decidir si además
se renombra a `PasoTenant` (más claro para el modelo nuevo) o se conserva el
nombre para no tocar relaciones.

## 5. Impacto por capa

| Capa | Qué cambia |
|---|---|
| `resolverFamilia` | El spread de §3.2 — la herencia entera. |
| `proyectarFamiliaTenant` | Se simplifica radicalmente: hoy mapea 14 campos, pasa a spread + 3 overrides. |
| `familia-tenant-validacion.ts` | La validación de forma **desaparece** (la forma ya no se escribe). Queda: plantilla existente + nombre único por tenant. |
| Catálogo (`familias-pasos.service`) | Las instancias pasan a serializar **todos** los ejes (los heredados). Hoy salen con la mitad en null. |
| Editor guiado | **Cero cambios**: ya lee la ficha; una instancia trae la ficha completa y se comporta igual que su plantilla. |
| Motor | **Cero cambios**: ya resuelve por `resolverFamilia`. |
| Wizard UI (`pasos-familias-view`) | De ~14 preguntas técnicas a: elegir plantilla → nombre → defaults. |
| Tablero / tracking | Los mapas de ícono y label son por código de sistema; la instancia debe caer al de su plantilla (hoy caería al genérico). |
| Estaciones por reglas | `EstacionRegla` matchea por `familiaCodigo`. **A decidir**: ¿una regla sobre `trabajo_manual` alcanza a sus instancias, o cada instancia rutea aparte? |

## 6. Plan por etapas

- **E0 — limpieza** ✅ hecha (2026-08-07): tabla vacía, cero huérfanos.
- **E1 — modelo** ✅ (2026-08-07): migración `20260807120000_pasos_tenant_por_
  plantilla` (tabla `PasoTenant`: `plantillaCodigo` + defaults propios; se
  cayeron los 14 campos de forma). `paso-tenant.ts` reemplaza a
  `familia-tenant-validacion.ts` (378 → 104 líneas: la forma no se valida
  porque no se escribe) y `pasos-tenant.service.ts` a
  `familias-tenant.service.ts`. Endpoints `pasos-tenant` (+ `/plantillas`).
  **La proyección es la herencia**: `{...FAMILIAS[plantilla], codigo, nombre}`.
  Efectos colaterales lindos: el catálogo pasó de DOS mapeos duplicados a UNA
  serialización para ambos mundos, y murieron dos casos especiales de tenant
  en el motor (`superficieDeFamiliaTenant` + su guard propio, ya cubiertos por
  el `guardSinLayout` heredado) y `formaEmisionDeFamiliaTenant` (sin usos).
  Verificado: una instancia de `impresion_por_hoja` trae nesting, las 5
  primitivas, esImpresion, herencia default, 15 outputs y sus params — antes
  tenía 0 ejes. Goldens: cartelería 7/7 idéntico; genérico re-baselineado a
  148 casos (los 4 que faltan son del producto E2E borrado en E0, no un
  cambio de pricing — los otros 148 idénticos). jest: 11 fallos en motor.spec,
  los mismos pre y post. tsc y vitest 415 verdes.
- **E2 — catálogo y lectura**: serializar los ejes heredados; ícono/label del
  tablero por plantilla; decidir el caso de `EstacionRegla`.
- **E3 — alta por modal**: nace `paso-alta-dialog.tsx` calcado de
  `maquina-alta-dialog.tsx` (nombre + plantilla filtrable + Guardar → ficha).
  Muere el wizard de 13 pantallas de `pasos-familias-view.tsx`; la vista
  queda como listado + ficha de defaults.
- **E4 — verificación**: goldens idénticos (no debería moverse un centavo:
  no hay instancias en uso), jest, vitest, E2E creando una instancia de
  `trabajo_manual` y usándola en una ruta.

## 7. Decisiones de Lucas (2026-08-07) — todas cerradas

1. **Journey de creación**: modal estilo alta de máquina (§3.4). ✅
2. **Estación**: la instancia **hereda** la regla de estación de su plantilla,
   pero **se puede cambiar a otra estación** — override por instancia. Si una
   regla rutea `trabajo_manual` al Taller, "Bordado" nace ahí y puede mudarse
   sin tocar la plantilla.
3. **Renombrar** `FamiliaTenant` → `PasoTenant`: **sí** (la tabla está vacía,
   es el momento sin costo de migración).
4. **Rótulo de la sección**: "Tus pasos" **queda**. Cambios de copy ya
   aplicados: se eliminó la bajada del estado vacío ("Si lo que tu taller
   hace no está en el catálogo… crealo acá"), que describía el modelo viejo
   de declarar desde cero; y el botón "+ Nuevo paso" del encabezado ahora
   sólo aparece **cuando ya hay pasos** — sin pasos manda el CTA "Crear el
   primero" del estado vacío, nunca los dos juntos.
5. **Instanciar familias con máquina**: sí, sin restricción — "Impresión
   Xerox interior" es un nombre legítimo del taller.
