# Plan técnico — Etapa C: Migración de motores legacy con shadow mode

**Duración estimada:** 4–8 meses (1–2 personas; la horquilla depende del ritmo de validación del dueño).
**Reversibilidad:** total por producto via feature flag (`ProductoServicio.motorPreferido`); total por motor vía disable del flag global.
**Prerrequisitos:** Etapas A y B completas.

**Objetivo de la etapa:** migrar los 4 motores activos (`vinilo_de_corte`, `impresion_digital_laser`, `rigidos_impresos`, `talonario`) al modelo universal usando shadow mode como mecanismo de validación. Al cerrar esta etapa, 100% de productos activos cotizan con motor v2, mientras v1 sigue corriendo en background como red de seguridad.

---

## §0 — Preguntas de arranque

1. **Volumen de snapshots.** Query SQL de producción para contar `CotizacionProductoSnapshot` totales, por motor, y por últimos 30 días. Responde si el shadow log va a ser manejable o necesita sampling.
2. **Orden de productos por motor.** Dentro de cada motor, ¿qué productos son los primeros en migrar? Recomendación: los más simples y con menos adicionales/checklist primero; los más complejos al final.
3. **Tolerancia de diff aceptable.** Confirmar: ¿0.01% es el umbral correcto? Para productos con redondeos agresivos puede ser más permisivo (ej. 0.1% en unitarios de pocas unidades).
4. **Ventana de shadow mode por producto.** Default: 1 semana de tráfico real. Confirmar o ajustar según frecuencia de cotización de cada producto.
5. **Quién monitorea los diffs.** Si es el dev de migración, 1h/día de monitoring durante C. Si es automatizable con alertas, dashboard con thresholds.

---

## §1 — Infraestructura previa a migrar motores (C.1)

**Entregable:** mecanismo de shadow mode funcional sin necesidad de tocar motores todavía.

### C.1.1 — Tabla `CotizacionShadowLog`

**Schema:**
```prisma
model CotizacionShadowLog {
  id                  String   @id @default(cuid())
  tenantId            String
  productoServicioId  String
  productoVarianteId  String?
  motorCodigo         String
  inputHash           String   // sha256 del input para agrupar
  totalV1             Decimal  @db.Decimal(14, 6)
  totalV2             Decimal  @db.Decimal(14, 6)
  diffAbsoluto        Decimal  @db.Decimal(14, 6)
  diffPct             Float
  subtotalesV1        Json
  subtotalesV2        Json
  anomalias           Json     // flags detectadas (mismatch en bucket, paso no modelado, etc.)
  createdAt           DateTime @default(now())
  
  @@index([tenantId, motorCodigo, createdAt])
  @@index([tenantId, productoServicioId, createdAt])
  @@index([diffPct])
}
```

### C.1.2 — Field `motorPreferido` en `ProductoServicio`

```prisma
model ProductoServicio {
  // ...
  motorPreferido String @default("v1")  // 'v1' | 'v2' | 'shadow'
}
```

Migración aditiva, default `'v1'` preserva comportamiento actual.

### C.1.3 — Dispatcher con shadow mode

Modificar el endpoint `/cotizar` en `productos-servicios.controller.ts`:
- Si `producto.motorPreferido === 'v1'`: llamar v1, retornar su resultado, persistir snapshot v1.
- Si `producto.motorPreferido === 'v2'`: llamar v2, retornar su resultado en shape canónica, persistir snapshot v2.
- Si `producto.motorPreferido === 'shadow'`: llamar v1 (respuesta oficial) + llamar v2 en paralelo + comparar totales y subtotales + escribir `CotizacionShadowLog` + retornar resultado v1 al cliente.

Errores del motor v2 en shadow mode se loguean como anomalía, **no propagan** al cliente (que sigue viendo v1 correcta).

### C.1.4 — Dashboard de diffs

**Entregable:** página admin `/admin/shadow-logs` en el frontend.

- Lista de `CotizacionShadowLog` ordenada por `diffPct DESC`.
- Filtros: por motor, por producto, por rango de fecha, por umbral de diff.
- Por entrada: link a input.json, link a ambos resultados, anomalías detectadas.
- Gráfico de serie temporal: diff promedio y máximo por día, por producto.

**Éxito:** cualquier producto en modo `shadow` genera logs en la tabla; el dashboard muestra el estado en tiempo casi-real.

---

## §2 — Migración por motor (C.2 a C.5)

Orden sugerido (del más simple al más complejo):

### C.2 — Vinilo de corte (~4–6 semanas)

Motor más simple: ruta corta (ploteo + laminado opcional), shape de resultado chica.

**Pasos:**
1. **Diseño de ruta v2.** Familias: `corte` (para el ploteo) + `laminado` opcional + `embalaje`. Reglas de selección: elección de material+plotter por menor costo (la única regla hoy hardcoded en `quoteVinylCutVariant`).
2. **Implementación de `VinylCutMotorModuleV2`.** Reutilizar `route-runner.ts` de Etapa B. Emitir shape canónica.
3. **Poblar `ProcesoOperacion` nueva con campos v2** para todos los productos activos de vinilo (o crear `ProcesoDefinicion` v2 en paralelo si el motor v1 no usaba `ProcesoOperacion`).
4. **Golden-output tests específicos del motor** (basados en los goldens de Etapa A, pero esta vez chequeando que v2 emite la misma cotización que v1 vía adapter `v1→canonical`).
5. **Activar shadow mode** para un producto piloto. Monitorear 1 semana.
6. **Si diff < 0.01%**, flip a `motorPreferido='v2'` para ese producto.
7. **Repetir para cada producto del motor.**
8. **Cuando 100% de productos de vinilo en v2, durante 1 semana adicional sin diffs, declarar el motor migrado.** v1 sigue vivo como backup hasta Etapa E.

**Éxito:** todos los productos `vinilo_de_corte` tienen `motorPreferido='v2'`, zero diff crítico en shadow log de las últimas 2 semanas.

### C.3 — Digital / láser (~8–12 semanas)

Motor más usado; tiene más productos y más adicionales. Misma rutina que C.2 pero con más iteraciones.

**Complicaciones específicas:**
- Matching automático `tipoImpresion + caras → máquina`: implementar como regla de selección con dominio `centroCosto`.
- Config legacy `detalleJson.matchingBase` y `detalleJson.pasosFijos` en productos viejos: adapter que los traduce a reglas v2 al migrar cada producto.
- Volumen alto de productos ⇒ el flip producto-por-producto toma más tiempo. Alternativa: grupos de productos "equivalentes" pueden flipearse juntos si el shadow diff es consistente para todos.

**Éxito:** igual que C.2 con el corpus de productos digital/láser.

### C.4 — Rígidos impresos (~6–10 semanas)

Complejidad: las 3 estrategias de costeo (`m2_exacto`, `largo_consumido`, `segmentos_placa`) hay que preservar como parámetros de la plantilla de `impresion_por_pieza`. El nesting rectangular grid queda como cálculo interno del paso (no como regla).

**Pasos adicionales específicos:**
- Fórmulas de costeo material pre-declaradas en el catálogo de A.2 como `formulasMaterial: ['m2_exacto', 'largo_consumido', 'segmentos_placa']`.
- Preservar el field `estrategiaCosteo` al migrar productos, mapeándolo al parámetro de la plantilla.

**Éxito:** igual.

### C.5 — Talonario (~6–10 semanas)

El motor más particular: composición multi-copia (COPIA_SIMPLE, DUPLICADO, TRIPLICADO, CUADRUPLICADO) + modos de pliego (aprovechar_pliego / pose_completa) + numeración + puntillado + encuadernación.

**Complicaciones específicas:**
- La ruta talonario típica tiene 5–7 pasos (más que digital). Más oportunidad de errores de mapeo.
- `tipoCopiaDefiniciones` ⇒ reglas de selección con dominio `composicion`.
- `modoAprovechamiento` ⇒ parámetro del paso de impresión con fórmulas distintas según el modo.

**Éxito:** igual.

---

## §3 — Definición de hecho (criterios de cierre de Etapa C)

- [ ] Infraestructura de shadow mode (C.1) en producción y usada.
- [ ] 100% de productos activos de los 4 motores tienen `motorPreferido='v2'`.
- [ ] Shadow logs de las últimas 2 semanas: ningún producto con `diffPct > 0.01%` no explicado (salvo exclusiones pre-aprobadas).
- [ ] Motores v1 siguen vivos y funcionales (apagados sólo en Etapa E).
- [ ] Golden-output suite v1 (Etapa A) sigue verde.
- [ ] Nueva golden-output suite v2 construida por motor durante la migración.
- [ ] Runbook de rollback documentado: cómo volver un producto a v1 en < 5 minutos si aparece bug en producción.

**Checkpoint por producto:** no se avanza con el siguiente producto de un motor hasta que el actual esté flipeado con shadow diff estable.

**Checkpoint por motor:** no se arranca el siguiente motor hasta que el motor actual esté 100% flipeado y estable ≥ 2 semanas.

---

## §4 — Riesgos específicos de esta etapa

| Riesgo | Probabilidad | Mitigación |
|---|---|---|
| Shadow diff sistemático en un motor que no se logra resolver | Media | Investigar caso por caso; la mayoría son bugs de mapeo corregibles |
| Monolito de 17K líneas impide extraer un motor sin tocar lógica ajena | Media | Feature flag por producto permite rollback inmediato; extracción conservadora (copiar, no mover) |
| Cronograma se extiende más de lo previsto | Alta | Etapa C es la más larga; comunicar estimación como rango, no como fecha |
| Volumen de shadow logs llena DB | Baja | Política de retención (ej. 30 días); sampling si hace falta |
| Dueño no está disponible para validar flip de producto X | Media | Criterio objetivo (diff < 0.01% durante 1 semana) no requiere validación subjetiva por cada producto; sólo escalar si hay anomalía |
| Conflicto de scope con desarrollo normal del producto | Alta | Feature freeze suave acordado en Etapa A; si se rompe, Etapa C demora pero no se bloquea |

---

## §5 — Output de la etapa para etapas posteriores

Al cerrar C, las etapas siguientes tienen disponible:
- 5 motores v2 productivos (gran formato + los 4 legacy migrados).
- Shape canónica consistente para todo el sistema → habilita Etapa D (unificación frontend sin casos especiales).
- Shadow log histórico como red de seguridad durante Etapa D/E (cualquier regresión detectada se correlaciona con el diff).
- 100% de cotizaciones nuevas se persisten con `motorVersion=2`; las cotizaciones viejas (`motorVersion=1`) quedan como histórico legacy.

**Fin del plan de Etapa C.**
