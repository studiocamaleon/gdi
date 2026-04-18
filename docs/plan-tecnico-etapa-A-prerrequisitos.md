# Plan técnico — Etapa A: Prerrequisitos

**Duración estimada:** 1–2 meses (1 persona full-time).
**Reversibilidad:** total. Nada de lo que se construye acá reemplaza código existente; es aditivo.
**Bloqueante de:** Etapas B, C, D, E.

**Objetivo de la etapa:** preparar toda la infraestructura que el resto de la migración necesita, sin tocar todavía ningún motor productivo. Al cerrar esta etapa, el sistema corre idéntico a hoy pero con tooling, catálogos y endpoints en su lugar para que Etapa B pueda arrancar.

---

## §0 — Preguntas de arranque

Responder con el dueño del sistema antes de A.1:

1. **Casos golden por motor.** Seleccionar 8–12 productos+variantes representativos de cada motor activo (digital, rigid-printed, talonario, vinyl-cut). El dueño valida la lista antes de construir los snapshots. Total esperado: 32–48 casos.
2. **DSL de expresiones.** ¿JsonLogic o una mini-lib propia? Recomendación: JsonLogic (maduro, JSON-nativo, libs en TS). Si hay objeciones, proponer alternativa antes de A.5.
3. **Plantillas de config por familia.** ¿Las 18 familias definitivas de `quiero-que-hablemos-de-dynamic-parrot.md` §2 o hacen falta ajustes? Oportunidad de revisar.

---

## §1 — Tareas

### A.0 — Safety net y rama de integración

**Entregable:** rama larga `refactor/modelo-universal` creada desde `main` + tag de anchor + dump de DB + `ROLLBACK_PLAN.md` actualizado.

**Prerrequisito humano:** validar con el usuario la compatibilidad con el refactor previo (ver `plan-tecnico-indice.md` §B al final). No continuar hasta resolver esa validación.

**Pasos:**
1. Confirmar commit estable actual de `main` (verde en CI, sin cambios pendientes críticos).
2. `git tag v1.1-stable-pre-modelo-universal <sha>` + `git push origin v1.1-stable-pre-modelo-universal`.
3. Dump de DB productiva: `pg_dump ... > backups/gdi_saas_pre_modelo_universal_<fecha>.sql`. Verificar que el archivo es válido (`file <archivo>`, size > 0) y guardarlo en `backups/` (ignorado por git; archivar fuera del repo si se requiere).
4. `git checkout -b refactor/modelo-universal` desde el tag. Push con `-u`.
5. Crear/actualizar `ROLLBACK_PLAN.md` en raíz del repo con sección "Modelo universal" que documenta:
   - Cómo revertir cada tipo de migración Prisma aplicada en Etapa A.
   - Cómo apagar el endpoint `/cotizar-v2` (feature flag global).
   - Cómo volver un producto a v1 (`motorPreferido='v1'`).
   - Comando exacto para restore completo desde el tag + DB dump (descarte total).
6. Documentar en el commit inicial de la rama: fecha, tag de origen, archivo de dump de DB.

**Éxito:** rama `refactor/modelo-universal` lista y sincronizada con origin; tag y dump accesibles; `ROLLBACK_PLAN.md` con procedimiento probado (hacer un dry-run del restore en un entorno local para confirmar que funciona — no saltarse este paso).

**Tiempo estimado:** 1 día. Pero **no empezar A.1 hasta completar A.0** — es el prerrequisito de seguridad de todo lo demás.

---

### A.1 — Golden-output suite para motores activos

**Entregable:** 32–48 tests de Jest que fijan la salida actual de `quoteDigitalVariant`, `quoteRigidPrintedVariant`, `quoteTalonarioVariant`, `quoteVinylCutVariant` como snapshot.

**Pasos:**
1. Por cada motor, seleccionar los 8–12 casos aprobados en §0.
2. Crear fixtures en `apps/api/src/productos-servicios/__fixtures__/quote-cases/<motor>/<caso>.input.json` con el payload de entrada completo (`productoServicioId`, `varianteId`, `cantidad`, `seleccionesBase`, `opcionalesSeleccionados`, `nivelesSeleccionados`, `checklistRespuestas`, `periodoTarifa`).
3. Script `apps/api/src/productos-servicios/__fixtures__/generate-goldens.ts` que invoca cada `quote*Variant` contra su fixture y escribe `<caso>.expected.json`.
4. Test `apps/api/src/productos-servicios/quote-regression.spec.ts` que lee cada par fixture/expected y compara con `expect(actual).toEqual(expected)`.
5. **Auditoría de no-determinismo:** grep por `Date.now()`, `new Date()`, `Math.random()`, `uuid()` dentro de los motores. Si aparecen, mockear con `jest.useFakeTimers()` o inyectar desde `CurrentAuth` en tests.

**Éxito:** `npm test` en `apps/api/` pasa verde con los nuevos tests. Regenerar los goldens tras modificar un motor requiere PR aprobado con diff visible.

**Riesgo principal:** motores no-determinísticos. Mitigación: resolverlo antes de cerrar A.1 (no seguir sin determinismo).

---

### A.2 — Catálogo declarativo de familias de paso

**Entregable:** archivo `apps/api/src/productos-servicios/pasos/familias.ts` exportando las 18 familias con metadata.

**Estructura propuesta:**
```ts
export type FamiliaPaso = {
  codigo: string;                // 'impresion_por_hoja'
  nombre: string;
  descripcion: string;
  plantillaConfig: JSONSchema;   // valida ProductoMotorConfig.parametrosJson
  outputsCanonicos: string[];    // ['piezasPorPlaca', 'hojasImpresas', ...]
  formulasDisponibles: {         // referencias a fórmulas predeclaradas
    tiempo: string[];
    material: string[];
  };
};

export const FAMILIAS_PASO: Record<string, FamiliaPaso> = { ... };
```

**Pasos:**
1. Crear el archivo con las 18 entradas del modelo universal §2.
2. Crear `apps/api/src/productos-servicios/pasos/outputs-canonicos.ts` con la lista estable de nombres semánticos (`piezasPorPlaca`, `hojasImpresas`, `planchasNecesarias`, `metrosLinealesCortados`, `m2Impresos`, `panelesGenerados`, etc.).
3. Un test de smoke: cada familia tiene schema JSON válido y outputs canónicos no duplicados.

**Éxito:** importable desde otros módulos, sin consumidores todavía.

---

### A.3 — Extensiones aditivas a `ProcesoOperacion`

**Entregable:** migración Prisma que agrega campos opcionales a `ProcesoOperacion`.

**Campos a agregar (todos `nullable`):**
- `familia: String?` — FK lógica al catálogo de §A.2 (no enforceable a nivel DB).
- `leeDelTrabajo: Json?` — lista de strings.
- `leeDePasos: Json?` — lista de strings.
- `produce: Json?` — lista de strings.
- `unidadProductiva: String?` — por default lee `cantidad` del trabajo.
- `activacion: String?` — `'obligatoria' | 'opcional' | 'condicional'`; default `'obligatoria'`.
- `condicion: Json?` — expresión JsonLogic si `activacion === 'condicional'`.

**Pasos:**
1. Schema change en `apps/api/prisma/schema.prisma`.
2. `npx prisma migrate dev --name add_proceso_operacion_universal_fields`.
3. Regenerar el client.
4. Test Prisma básico: crear una `ProcesoOperacion` con y sin esos campos.

**Éxito:** migración aplicada; motores legacy siguen funcionando idéntico (ignoran los nuevos campos).

---

### A.4 — Entidad `ReglaDeSeleccion`

**Entregable:** nueva tabla Prisma + CRUD endpoint básico.

**Schema:**
```prisma
model ReglaDeSeleccion {
  id        String   @id @default(cuid())
  tenantId  String
  dominio   String   // 'material' | 'centroCosto' | 'variante' | 'activacion' | 'parametro'
  targetRef String?  // id del paso/material/centro sobre el que decide
  inputs    Json     // string[]
  casos     Json     // Array<{ condicion: JsonLogicExpr, decision: any }>
  defaultDecision Json?
  activa    Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

**Pasos:**
1. Schema + migración Prisma.
2. Service y controller minimalistas en `apps/api/src/productos-servicios/reglas-seleccion/` (sólo CRUD; sin consumidores aún).
3. Registrar módulo en `productos-servicios.module.ts`.

**Éxito:** endpoints `GET/POST/PUT/DELETE /productos-servicios/reglas-seleccion/*` funcionan; la tabla queda vacía en producción hasta que alguien empiece a crearlas en etapas posteriores.

---

### A.5 — Evaluador de expresiones

**Entregable:** función pura `evaluarCondicion(expr, context) → any`.

**Pasos:**
1. Instalar `json-logic-js` en `apps/api` (~2KB; mantenido).
2. Crear wrapper en `apps/api/src/productos-servicios/reglas-seleccion/evaluador.ts` con tipos TS.
3. Soporte para operadores estándar (`==`, `<`, `>`, `and`, `or`, `if`, `in`, `var`).
4. Test unitario con 10 casos: comparaciones numéricas, lógica booleana, lookup de variables anidadas (`componente.letras[0].tamaño`).

**Éxito:** `evaluarCondicion({">=": [{"var": "cantidad"}, 500]}, {cantidad: 500})` devuelve `true`. Tests pasan.

---

### A.6 — Endpoint `/cotizar-v2` con shape canónica

**Entregable:** endpoint que acepta el mismo payload que `/cotizar` y emite la shape canónica del modelo universal (`quiero-que-hablemos-de-dynamic-parrot.md` §7).

**Pasos:**
1. Definir `CotizacionCanonica` en `apps/api/src/productos-servicios/dto/cotizacion-canonica.dto.ts`:
   ```ts
   type CotizacionCanonica = {
     total: number;
     unitario: number;
     subtotales: { centroCosto: number; materiasPrimas: number; cargosFlat: number; };
     pasos: Array<{
       id: string; tipo: string; nombre: string;
       costoCentroCosto: number; costoMateriasPrimas: number; cargosFlat: number;
       trazabilidad: { tiempos: any; consumos: any; inputs: any; outputs: any; };
     }>;
     subProductos: CotizacionCanonica[];
   };
   ```
2. Endpoint `POST /productos-servicios/variantes/:varianteId/cotizar-v2` en el controller. Devuelve 501 hasta que un motor v2 esté listo.
3. Adapter `v1ToCanonical(resultado, motorCodigo) → CotizacionCanonica` en `apps/api/src/productos-servicios/adapters/v1-to-canonical.ts`. Usa la tabla de correspondencia de `fase-2-mapeo.md` §2.2.
4. Test del adapter: tomar los goldens de A.1, convertirlos a canónica, validar que los totales coincidan.

**Éxito:** el endpoint existe, el adapter convierte goldens v1 → shape canónica sin perder información ni cambiar totales.

---

## §2 — Definición de hecho (criterios de cierre de Etapa A)

- [ ] A.0: Rama `refactor/modelo-universal` existe, tag `v1.1-stable-pre-modelo-universal` pusheado, DB dump guardado, `ROLLBACK_PLAN.md` actualizado con procedimiento probado.
- [ ] A.1: `npm test` en `apps/api` pasa con ≥32 tests de regresión de cotización.
- [ ] A.2: `familias.ts` y `outputs-canonicos.ts` committeados, importables.
- [ ] A.3: Migración Prisma aplicada en `main`; `ProcesoOperacion` acepta los nuevos campos.
- [ ] A.4: CRUD de `ReglaDeSeleccion` funcionando; sin consumidores.
- [ ] A.5: Evaluador de JsonLogic con tests pasando.
- [ ] A.6: Endpoint `/cotizar-v2` existe; adapter v1→canonical valida totales contra goldens.
- [ ] Feature freeze suave en módulo costeo negociado con el negocio.
- [ ] Dueño de migración asignado y disponible ≥1h/semana.

**Checkpoint con el dueño del sistema:** revisión del estado al cerrar cada sub-tarea (A.1 a A.6) antes de pasar a la siguiente. En particular A.1 requiere validación explícita ("estos 32 casos sí cubren mi operación real").

---

## §3 — Riesgos específicos de esta etapa

| Riesgo | Probabilidad | Mitigación |
|---|---|---|
| Motores no-determinísticos impiden golden snapshots | Media | Resolver en A.1 — no avanzar sin determinismo |
| Las 18 familias resultan insuficientes al analizarlas en detalle | Baja | Volver a `quiero-que-hablemos-de-dynamic-parrot.md`, agregar familia si hace falta; el catálogo es declarativo, no rompe nada |
| Dueño del sistema no disponible para validar golden cases | Media | Bloquea A.1 pero no A.2–A.6 (trabajar en paralelo) |
| JsonLogic se queda corto para alguna regla compleja | Baja | Compuerta de escape a función TS; decidir en la primera regla que no entre |

---

## §4 — Output de la etapa para etapas posteriores

Al cerrar A, las siguientes etapas tienen disponible:
- Golden tests que validan que no se rompió nada (Etapas B–E los corren en CI).
- Catálogo de familias como input de Etapas B y C (al diseñar rutas v2).
- Campos extendidos en `ProcesoOperacion` listos para poblar (Etapas B y C).
- `ReglaDeSeleccion` y evaluador listos para crear reglas (Etapas B y C).
- Endpoint `/cotizar-v2` como contenedor donde Etapas B y C enchufan sus motores.
- Adapter `v1→canonical` que permite que UI v2 de Etapa D lea incluso cotizaciones v1 durante la transición.

**Fin del plan de Etapa A.**
