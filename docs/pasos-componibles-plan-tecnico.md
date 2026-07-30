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

> **Estado 2026-07-29: código COMPLETO** (commit a87c4301 en
> `feat/pasos-familias-tenant`): migración, resolver, CRUD, 16 tests en
> verde, suite idéntica a la base. Tres desvíos del diseño de abajo,
> deliberados: (1) la estación NO se duplica como columna — la API escribe
> `EstacionFamilia`, que ya es la fuente del ruteo; (2) validador puro en
> vez de zod — el repo no tiene zod y usa class-validator para el formato;
> (3) autorización por `@Permiso('costos.gestionar')` en vez de rol a mano —
> es el mismo permiso que editar rutas, por default sólo del administrador.
>
> **E2E de cierre EJECUTADO 2026-07-29** (con la sesión del usuario, flujo
> completo por UI): la "Serigrafía manual"
> (`754f8569-0c49-4ff4-9670-7babcaa7e610`, estación Produccion & Taller) se
> agregó como paso extra a un producto duplicado de prueba ("Imanes PRUEBA
> serigrafia E2E"), se cotizó (OT-2026-0002, cliente de prueba SIN teléfono,
> cero WhatsApps verificado en NotificacionWhatsapp), se emitió y se
> ejecutó la ruta entera en el tablero. Todo lo estructural anduvo a la
> primera: el selector de pasos la ofrece, el editor renderiza su contrato
> (slot "Tinta de serigrafía", productividad propia T-2), el motor la costeó
> exacto (100 u ÷ 60/h = 100 min a la tarifa del centro, $41.959, output
> canónico `piezas_estampadas: 100` en el snapshot), la regla de secuencia
> la mantuvo no-ejecutable hasta completar los 4 pasos previos, ruteó a
> Produccion & Taller, corrió con CRONÓMETRO (iniciar/pausar/completar) y la
> OT cerró finalizada con tiempoRealMin=100 declarado.
>
> **Bug encontrado y arreglado en el E2E**: `resolverNombreVisiblePaso`
> (motor) caía en `humanizarCodigo(familiaCodigo)` sin consultar el nombre
> de la familia — para una tenant eso mostraba el UUID en el desglose, el
> snapshot y el paso materializado. Fix: `resolverFamilia(...)?.nombre`
> antes del humanizador; suite del motor idéntica (mismos 18 preexistentes).
> Los labels ya guardados de la OT de prueba se corrigieron por SQL.

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

> **Estado 2026-07-29: v1 COMPLETA y verificada E2E** (rama
> `feat/pasos-wizard`). Lo construido: vista "Pasos de producción" en el
> sidebar de Costos (listado de familias tenant con forma/estación/estado +
> catálogo del sistema en solo-lectura), wizard de 9 pasos en sheet con
> preguntas físicas, preview de costeo (visible-opcional §8.8) que usa la
> MISMA tarifa publicada que el motor, y el grupo "Tus pasos" primero en el
> selector de pasos extra.
>
> **E2E del criterio de done, ejecutado con la sesión del usuario**: se creó
> "Bordado" partiendo del preset Trabajo manual — el preset precargó todo,
> las 9 preguntas fluyeron, estación Produccion & Taller elegida, y el
> preview devolvió **100 min · $41.959,45**, exactamente el número que el
> motor real produjo en la cotización de serigrafía del E2E de la Etapa C
> (misma forma, misma tarifa): validación cruzada contra la realidad.
>
> Dos bugs cazados EN el E2E, arreglados en el momento: (1) elegir una
> opción de un HumanSelect cerraba el wizard — la lista se renderiza en un
> portal fuera del sheet y contaba como click-afuera; `disablePointerDismissal`
> en el Sheet (Base UI); (2) la segunda fila de "Tus pasos" quedaba
> RECORTADA — el layout del dashboard restringe altura, `.wrap` es flex
> column y las secciones se encogían (flex-shrink default) bajo un
> `overflow: hidden`; `flex: none` en la sección. El preview además tuvo que
> ajustar el transporte de errores: el ApiError del front sólo lee
> `message`, así que el validador manda los errores como array (apiRequest
> los une).
>
> **Scope-cut de la v1, RESUELTO 2026-07-29** (rama feat/pasos-edicion): la
> edición reusa el MISMO wizard precargado (sin la pregunta de preset),
> guarda con PATCH y preserva los códigos de los slots existentes — los
> productos configurados contra esos slots no pierden el vínculo. El ciclo
> de vida quedó completo: crear / editar / inhabilitar / reactivar /
> eliminar. El preview
> corre para T-1/T-2 espejando la aritmética exacta del motor (F.2.10, mismo
> ceil y misma tarifa via loadTarifasHorarias) — correr el motor entero
> exigiría producto+ruta que aún no existen al crear la familia; el desvío
> queda anotado en el código.

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

**Decisión 2026-07-29: el proyecto se integra en la rama `dev` (creada desde
main), NO en main.** Cada etapa mergea a dev al cumplir su criterio; main
queda limpio hasta que el proyecto completo funcione validado de punta a
punta — recién ahí dev → main de una. Si el proyecto se abandona a mitad de
camino, main nunca se ensució y el restore point v3.8 cubre la base.

| Rama | Contenido | Merge a `dev` cuando |
|---|---|---|
| `feat/pasos-limpieza-tipo-a` | A completa + censo apendizado | ✅ mergeada (4ab3c7f1): suite idéntica + E2E usuario |
| `feat/pasos-familias-tenant` | C completa (modelo+resolver+API) | E2E "Serigrafía manual" completo |
| `feat/pasos-wizard` | D completa | E2E wizard + css:guard |

Las ramas de etapa nacen de `dev` (no de main) para ver el trabajo previo.
Ojo con las migraciones de la Etapa C: quedan aplicadas en la base dev
aunque main no las conozca — si hay que volver a trabajar sobre main antes
del merge final, la base y el schema van a divergir; el dump v3.8 es la
vuelta atrás limpia.

Después de D en dev y con uso real: retomar B (nesting) y E/F (wizard de
ruta/producto) con diseño propio sobre lo aprendido.

## Apéndice — Censo de los cableados (Etapa A, ejecutada 2026-07-29)

Base: 51 líneas con `familiaCodigo === '<literal>'` fuera de tests, medidas
sobre `5abc97f5` = **50 comparaciones de familia** + 1 `typeof === 'string'`.
Tras la etapa: **43 comparaciones**, todas Tipo B bajo marcador
`FRONTERA-NESTING` / `FRONTERA-PRIMITIVA`. Puerta para PRs futuros:

```bash
grep -rnE "familiaCodigo\s*===\s*'[a-z_]+'" apps/api/src --include='*.ts' | grep -v __tests__
# toda línea nueva de esa lista necesita justificación de frontera
```

### Movidas a la declaración (Tipo A — 7 comparaciones eliminadas)

| Estaba en | Era | Ahora lo declara |
|---|---|---|
| motor.service `esTipoPerfilCompatibleConFamilia` (2 ifs) | plotter→CORTE\|MIXTO, área→IMPRESION\|MIXTO | `tiposPerfilCompatibles` en la familia |
| config-pasos `tipoPerfilCompatibleConFamilia` (2 ifs) | **la misma lógica, duplicada** | mismo campo — helper único `perfilCompatibleConFamilia` en familias.ts |
| config-pasos `normalizarFormulaSlotMaterial` (1 if) | laminado+film fuerza `por_metro_lineal` | `formulaForzada` en el slot film |
| motor.service `ignoraCarasEnMaterial` (1 if) | hoja+sustrato no multiplica ×caras | `ignoraMultiplicadorCaras` en el slot sustrato |
| motor.service consumibles de máquina (1 if) | plotter_corte no factura tinta | `sinConsumiblesMaquina` en la familia |

Campos nuevos: `DefinicionFamilia.tiposPerfilCompatibles?`,
`DefinicionFamilia.sinConsumiblesMaquina?`, `SlotDeclarado.formulaForzada?`,
`SlotDeclarado.ignoraMultiplicadorCaras?` — con helpers de lectura en
familias.ts (`perfilCompatibleConFamilia`, `formulaEfectivaSlot`,
`slotIgnoraMultiplicadorCaras`, `familiaSinConsumiblesMaquina`). Una familia
que no declara el campo conserva el fallthrough del if original.

### Quedan como frontera (Tipo B — 43 comparaciones)

| Cluster | Refs | Marcador |
|---|---|---|
| `nesting-config.ts` — config por familia (márgenes, separación, panelizado, algoritmo) | 16 | archivo entero `FRONTERA-NESTING` |
| `nesting-dispatcher.ts` — ruteo a runners + casos hoja | 9 | archivo entero `FRONTERA-NESTING` |
| motor: guards d.0–d.1 (laminado, pouch, hoja, área, montaje, pre_prensa cortan sin layout) | 6 | `FRONTERA-NESTING` en el bloque |
| motor: `debeCalcularNestingLaminado` | 1 | `FRONTERA-NESTING` |
| motor: cantidades propias en CALCULADO_POR_PASO (modificacion_pre, ojales, área/plotter m²) | 4 | `FRONTERA-PRIMITIVA` |
| motor: layout de ojales (traza + params) | 1 | `FRONTERA-PRIMITIVA` |
| motor: guillotina — runMin por cortes + perfil por gramaje | 2 | `FRONTERA-PRIMITIVA` |
| motor: hoja — cadena color→caras→gramaje de selección de perfil | 1 | `FRONTERA-PRIMITIVA` |
| motor: montaje — tiempo desde el plan de montaje | 1 | `FRONTERA-PRIMITIVA` |
| config-pasos: plotter sobre impresora híbrida exige corte integrado (ruta + candidatas M-2) | 2 | `FRONTERA-PRIMITIVA` |

(La suma de comparaciones por línea difiere de la de clusters porque varias
líneas comparten un if.)

### Verificación de la etapa

- `tsc --noEmit -p tsconfig.build.json` limpio.
- Suite completa del API: **resultado idéntico a main, test por nombre**
  (extraído con `jest --json` y comparado con la base vía `git stash`):
  1.149 pasan en ambos, y los mismos 18 smoke tests de motor.spec fallan en
  ambos — **preexistentes**, dependen de fixtures de `gdi_saas_test`
  (probable secuela del incidente de base del 2026-07-28). Quedan fuera del
  alcance de la etapa, con task aparte para diagnosticarlos.
- Ojo al medir: en paralelo el conteo fluctúa (18–20) porque las suites
  comparten `gdi_saas_test`; con `--runInBand` da 18 estable. Comparar
  resultados de jest siempre en serie o por nombre de test, nunca por el
  número del resumen.
- **E2E manual (usuario, 2026-07-29)**: Tarjetas de visita doble faz con
  laminado re-cotizadas contra una cotización previa al cambio — desglose
  **idéntico**. Cubre `ignoraMultiplicadorCaras` (papel no ×2 con doble faz)
  y `formulaForzada` (film en metros lineales). **Sticker troquelado también
  verificado por el usuario**: factura tinta por su paso de impresión
  (CMYK/ByN — correcto) y el paso de plotter no agrega consumibles propios;
  cubre la selección de perfil (`tiposPerfilCompatibles`). Matiz honesto
  sobre `sinConsumiblesMaquina`: su rama sólo se ejercita cuando el paso de
  plotter corre sobre la impresora híbrida (corte integrado) — sobre un
  plotter dedicado el código corta antes por plantilla, igual que siempre.
  Ese sub-caso queda por equivalencia de código; sus smoke tests están entre
  los 18 caídos por fixtures.

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
