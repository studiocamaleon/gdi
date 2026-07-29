# Pasos componibles — plan técnico (Etapas A, C, D)

> Ejecuta las decisiones cerradas en `docs/pasos-componibles-diseno.md` §8.
> Orden decidido: **A → C → D**, con B (nesting parametrizado) diferida.
> Punto de restauración: `v3.8-pre-abstraccion-pasos` (ver
> `backups/README-rollback.md`).
>
> Regla de trabajo: una rama por etapa, merge a main con la etapa verificada
> antes de arrancar la siguiente. Vistas nuevas nacen con `.module.css`
> (`npm run css:guard` antes de cerrar UI).

---

## Etapa A — Limpieza Tipo A

**Objetivo**: que el motor deje de nombrar familias concretas cuando lo que
está expresando son datos de la familia. Al cierre, todo `familiaCodigo ===`
que quede en el código es Tipo B (geometría/nesting) y está documentado como
tal.

### A.1 Censo (entregable, no exploración)

Tabla línea por línea de los **51** `familiaCodigo === '<código>'` reales
(sin tests) con veredicto A/B. Se agrega como apéndice a este documento.
Reparto conocido: `motor.service.ts` 21, `nesting-config.ts` 16,
`nesting-dispatcher.ts` 9, `config-pasos.service.ts` 5.

Los ya clasificados al escribir este plan:

| Ubicación | Qué es | Veredicto |
|---|---|---|
| `motor.service.ts:5414` `esTipoPerfilCompatibleConFamilia` | plotter→CORTE\|MIXTO, área→IMPRESION\|MIXTO | **A** — campo `tiposPerfilCompatibles` |
| `config-pasos.service.ts:14` `tipoPerfilCompatibleConFamilia` | **la misma lógica, duplicada** | **A** — mismo campo, una sola fuente |
| `config-pasos.service.ts:29` `normalizarFormulaSlotMaterial` | laminado+film → `por_metro_lineal` | **A** — el slot declara `formulaDefault` |
| `config-pasos.service.ts:110,466` | validaciones plotter vs plantilla de máquina | censar: probable **A** (compatibilidad declarable) |
| `nesting-config.ts` / `nesting-dispatcher.ts` (25 refs) | runners y config de nesting | **B** — quedan, son la frontera |
| `motor.service.ts` resto (~19) | guards de nesting, herencia guillotina, mutaciones de JobContext (ojales, modificacion_pre) | censar uno a uno |

### A.2 Cambios

1. Nuevos campos opcionales en `DefinicionFamilia` (types.ts) para cada
   dato que hoy es un `if`: `tiposPerfilCompatibles?: string[]`,
   `formulaDefault` en `SlotDeclarado`, y los que surjan del censo.
2. Poblar esos campos en `familias.ts` **solo** en las familias que hoy
   tienen el `if` (comportamiento idéntico, cero cambios para el resto).
3. Reemplazar cada `if` Tipo A por lectura de la declaración, borrando la
   duplicación motor/config-pasos.
4. Los Tipo B que queden se marcan con un comentario uniforme
   (`// FRONTERA-NESTING:`) para que el censo no se desactualice.

### A.3 Verificación y cierre

- La suite del motor (`motor.spec.ts`, 3.6k líneas) pasa **sin tocar un
  solo test**: si un test necesita cambio, el paso 2 rompió comportamiento.
- `npx tsc --noEmit` en apps/api.
- Cotización E2E de un producto con plotter + área + laminado (los tres
  afectados) comparando desglose antes/después: idéntico al centavo.
- **Done** = cero `familiaCodigo ===` fuera de los marcados
  `FRONTERA-NESTING`, censo apendizado, merge a main.

Riesgo: bajo. Es mover datos de lugar con red de tests densa.

---

## Etapa C — Tabla de familias tenant + resolver

**Objetivo**: el motor aprende a leer familias desde la base sin que exista
UI de creación. Al cierre, una familia insertada a mano por API cotiza,
rutea a estación y registra tiempos exactamente como una del catálogo.

### C.1 Modelo (migración formal, no `db push`)

```prisma
/// Familia de pasos creada por el tenant (diseño §4). Las 42 del sistema
/// NO viven acá: siguen en familias.ts (decisión §8.1, híbrido). En los
/// familiaCodigo string del resto del schema viaja el UUID de esta tabla.
model FamiliaTenant {
  id          String  @id @default(uuid())
  tenantId    String
  tenant      Tenant  @relation(...)
  nombre      String
  descripcion String?

  /// La forma (§4.3): mismos vocabularios que DefinicionFamilia.
  categoria             String   // CategoriaFamiliaCodigo — agrupa en UI y da default de modoRegistro
  relacionMaquina       Json     // RelacionMaquina[]
  modosTiempo           Json     // ModoTiempo[]
  mecanismosCantidad    Json     // MecanismoCantidad[]
  modoActivacionDefault String
  slots                 Json     // SlotDeclarado[]
  multiplicadores       Json     // string[]
  modoRegistro          String?  // override; default por categoría como hoy
  tiposPerfilCompatibles Json?   // el campo que nace en Etapa A

  /// Ruteo (§8.4): la estación se elige en el wizard.
  estacionId  String?
  estacion    Estacion? @relation(...)

  /// Preset del catálogo del que nació, si nació de uno (analytics + UI).
  presetOrigen String?

  activo    Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([tenantId, nombre])
  @@index([tenantId, activo])
}
```

Notas:

- **Sin enum de DB** para los ejes: los vocabularios viven en types.ts y
  valida un schema zod compartido (`familia-tenant.schema.ts`) que es la
  única puerta de escritura. Así los vocabularios no se duplican.
- `usada` no se persiste: se calcula al borrar (§C.4) consultando
  referencias. Evita un flag que puede mentir.

### C.2 El resolver único

```
resolverFamilia(codigo: string, tenantId: string): DefinicionFamilia
```

- Si `codigo` parsea como UUID → `FamiliaTenant` (scoped al tenant, cache
  en memoria por request como hace el motor con materiales). La fila se
  proyecta a `DefinicionFamilia` — misma interfaz, el motor no distingue.
- Si no → `FAMILIAS[codigo]` como hoy. `getFamilia` pasa a delegar acá.
- **Resolver ignora `activo`**: una familia inhabilitada sigue resolviendo
  para OTs/rutas históricas. `activo` solo filtra selectores y wizard.
- Puntos de integración a tocar (todos pasan hoy por `getFamilia`/
  `FAMILIAS[...]`): motor, config-pasos, `modoRegistroDeFamilia` (acepta
  UUID → lee `modoRegistro` de la fila o default por categoría), ruteo de
  estaciones (una familia tenant rutea por su `estacionId`, no por
  `EstacionFamilia`), validación pre-pasada.

### C.3 Snapshot al usar (§8.2)

`OrdenTrabajoItemPaso` ya se materializa desde `trazabilidadJson.pasos`
del snapshot del cotizador — la mitad del mecanismo existe. Se agrega:

- Al materializar pasos de una OT: copiar `modoRegistro` resuelto y
  `estacionId` resueltos al paso materializado (hoy se derivan en caliente
  de la familia). Con eso, editar la familia no re-rutea OTs en vuelo.
- La cotización ya congela el desglose económico; re-cotizar re-resuelve.
  No hace falta congelar la definición entera: basta congelar lo que el
  tablero consulta en caliente.

### C.4 API (sin UI)

`/productos-servicios/familias` — guard ADMIN (§8.7), tenant-scoped:

- `GET /` — merge catálogo (42, `origen: 'sistema'`) + tenant activas
  (`origen: 'tenant'`). Es lo que consumirán selectores y wizard.
- `POST /` — valida contra zod; crea.
- `PATCH /:id` — edita (solo tenant; las de sistema son inmutables).
- `DELETE /:id` — **borrar solo si virgen** (§8.6): cuenta referencias en
  RutaPaso/ProductoPasoExtra/pasos materializados; si >0 → 409 con mensaje
  que ofrece inhabilitar. `PATCH {activo:false}` inhabilita.

### C.5 Verificación y cierre

- Tests de integración (DB `gdi_saas_test` vía jest-setup-db, como
  siempre): resolver UUID/código, familia inhabilitada sigue resolviendo,
  borrado virgen vs usada, unicidad de nombre por tenant.
- E2E manual: insertar por API una familia "Serigrafía manual" (forma
  `sin máquina · con material · T-2`), armarle una ruta a un producto de
  prueba, cotizar, emitir OT, verla rutear a su estación y registrar
  tiempo con cronómetro. **Ese flujo completo es el done.**
- El motor no sabe que existió la etapa: cero cambios en cálculos.

Riesgo: medio. Todo está detrás del resolver; el peligro es algún caller
que lea `FAMILIAS` directo sin pasar por `getFamilia` — el censo de la
Etapa A ya deja mapeados esos accesos.

---

## Etapa D — Wizard de paso

**Objetivo**: la feature visible. Un ADMIN crea un tipo de paso sin saber
qué es un eje.

### D.1 Ubicación y forma

- Vista nueva bajo Productos y servicios (donde viven los pasos hoy), con
  su `pasos-familias.module.css` (regla CSS vigente).
- Listado: las del tenant + las del sistema (solo lectura), buscador,
  inhabilitar/reactivar.
- Alta = wizard en diálogo (patrón Maquinaria: alta en diálogo, ficha con
  tabs para editar).

### D.2 El flujo (preguntas físicas, diseño §5)

```
0. ¿Partís de un paso existente?      → preset (default) o desde cero
1. ¿Requiere una máquina?             → M-0 / M-1 / M-2 (radio con ejemplos)
2. ¿Cómo se mide el tiempo?           → según respuesta 1 se acotan T-1..T-4
3. ¿Consume materiales?               → slots: tipo + ¿obligatorio? + compat
4. ¿De dónde sale la cantidad?        → mecanismos (con default por forma)
5. ¿Cómo entra a la ruta?             → modoActivacion default
6. ¿Dónde se hace?                    → estación (default: general) (§8.4)
7. ¿Cómo se registra en el tablero?   → default por categoría, override visible
8. Nombre + descripción → PREVIEW → guardar
```

- Cada respuesta acota las siguientes usando las combinaciones que los
  vocabularios ya declaran; el wizard **no puede** emitir una forma que el
  zod de C.1 rechace (el mismo schema valida en front y back).
- Elegir preset precarga todo y salta directo al paso 8 con los pasos
  anteriores editables.
- "¿Acomoda piezas?" **no aparece** en esta versión (§8.3, B diferida).

### D.3 Preview de costeo (§8.8: visible, opcional)

- Endpoint `POST /familias/preview-costeo`: recibe la forma + una cantidad
  de prueba + (si M-1/M-2) una máquina y (si tiene slots) materiales, y
  corre el motor real sobre un JobContext sintético. Devuelve el desglose.
- En el paso 8, panel visible con CTA "Probar con un ejemplo" — no bloquea
  guardar. Mitigación residual (§8.8): las cotizaciones que incluyen un
  paso de familia tenant con menos de N usos muestran un tag discreto
  "paso nuevo" en el desglose interno (nunca en documentos del cliente).
  El diseño fino de ese tag se decide al construir D.
- Selectores del editor de rutas y de pasos extra pasan a consumir el
  `GET /familias` mergeado — con grupo visual "Tus pasos" arriba del
  catálogo.

### D.4 Verificación y cierre

- `npm run css:guard` limpio (vista nueva = módulo).
- E2E: crear desde preset y desde cero; el flujo completo de C.5 pero
  entrando por el wizard; editar familia usada y verificar que la OT en
  vuelo no cambia (snapshot C.3); inhabilitar y verificar que desaparece
  de selectores pero la OT histórica la sigue mostrando.
- **Done** = una persona sin contexto del motor crea "Bordado" partiendo
  del preset trabajo_manual en menos de dos minutos, y su cotización sale
  con el costo esperado.

---

## Secuencia de ramas

| Rama | Contenido | Merge cuando |
|---|---|---|
| `feat/pasos-limpieza-tipo-a` | A completa + censo apendizado | suite motor intacta + E2E de desglose idéntico |
| `feat/pasos-familias-tenant` | C completa (modelo+resolver+API) | E2E "Serigrafía manual" completo |
| `feat/pasos-wizard` | D completa | E2E wizard + css:guard |

Después de D en main y con uso real: retomar B (nesting) y E/F (wizard de
ruta/producto) con diseño propio sobre lo aprendido.

## Qué puede salir mal (por etapa)

- **A**: un `if` clasificado A que en realidad tenía un efecto secundario
  no declarado. Red: los tests del motor + E2E al centavo.
- **C**: un caller que no pasa por el resolver y explota con UUID. Red: el
  censo de A mapea todos los accesos; grep de `FAMILIAS[` como gate de PR.
- **D**: familias mal compuestas que cotizan "razonable pero mal" — el
  riesgo #1 del diseño (§7.1), agravado por preview opcional (§8.8). Red:
  el zod no deja emitir formas inválidas; el tag "paso nuevo" mantiene el
  ojo humano encima; y el precedente Wati aplica: **dev tiene integraciones
  vivas, probar con tenant de prueba**, no con Grafoprint real.
