# Presupuestos F2 — aprobación interna por umbrales (plan)

> 2026-07-18. Plan SIN implementación, alcance recortado por decisión
> del usuario: SOLO aprobación por umbrales. Items fuera de catálogo y
> revisiones -R1 quedan para otra etapa. Base: estudio
> docs/presupuestos-modulo-estudio.md §4 y F1 ya en la rama
> feat/presupuestos-ciclo.

## 1. Qué resuelve

El caso planteado desde el arranque: si el presupuesto se sale de lo
normal, el OPERADOR no puede enviarlo al cliente — queda **bloqueado**
esperando la aprobación de un SUPERVISOR/ADMINISTRADOR (patrón CPQ:
la aprobación bloquea el envío, no es una alerta). El gating es al
ENVIAR, no al emitir: emitir queda libre (el borrador no compromete).

## 2. Lo que F1 ya dejó listo

- `ConfiguracionPresupuestos` con los campos dormidos:
  `aprobacionMontoMax`, `aprobacionMargenMinPct`,
  `aprobacionDescuentoMaxPct`, `requiereAprobacionSinCosteo`.
- Estado `pendiente_aprobacion` reservado en la máquina (comentario en
  schema y DTO).
- `RolesGuard` + `@Roles()` funcionando (sin aplicar a ventas).
- `CotizacionEvento` para el rastro de auditoría.
- El costo real por item (snapshot) → margen calculable.

## 3. Reglas de evaluación (al intentar enviar)

Función PURA `evaluarAprobacion(config, presupuesto) → MotivoAprobacion[]`
(testeable estilo periodo.spec):

1. **Monto**: `total > aprobacionMontoMax` → "El total $X supera el
   umbral de $Y".
2. **Margen**: `margenPct < aprobacionMargenMinPct` → "El margen N% está
   debajo del mínimo M%". Margen = (Σ subtotal items − Σ costoTotal
   snapshot) / Σ subtotal. Cargos directos fuera del margen (declarado).
   Si algún item no tiene costo snapshot y la regla está activa →
   dispara ("hay items sin costeo verificable").
3. Regla desactivada = campo null (default): no dispara. **Sin config,
   nada cambia** para ningún tenante.

**Fuera de F2 (honesto)**: `aprobacionDescuentoMaxPct` queda dormido —
hoy no existe descuento manual sobre el precio del motor, así que la
regla no tiene dato que evaluar. Se activa cuando exista el campo de
descuento/override (misma etapa que items libres).

## 4. Máquina de estados (delta)

```
borrador → [enviar() evalúa reglas]
   ├─ sin disparos → enviado (como hoy)
   ├─ dispara + actor SUPERVISOR/ADMIN → enviado
   │    (evento: "regla X disparó; envío asumido por <rol>")
   └─ dispara + actor OPERADOR → pendiente_aprobacion  (BLOQUEA:
        sin publicToken, sin fechaEnvio, link público inexistente)

pendiente_aprobacion → aprobar (SUPERVISOR/ADMIN) → enviado
                        (aprobar Y enviar en el mismo acto)
pendiente_aprobacion → devolver (SUPERVISOR/ADMIN, comentario) → borrador
```

- Decisión: supervisores/admins **exentos del bloqueo** (no burocratizar
  al que aprueba), pero el evento registra que la regla disparó.
- "Devolver" regresa a borrador con comentario en el timeline. Límite
  declarado: la corrección real del contenido (precios) requiere
  recotizar desde la ficha o las revisiones -R1 futuras; devolver sirve
  como "no lo mandes así".
- El vencimiento lazy NO aplica a `pendiente_aprobacion` (aún no se
  envió; la validez corre desde el envío — sin cambio).

## 5. Modelo de datos (migración chica, mismo método migrate diff+resolve)

`Cotizacion` +:
- `aprobacionMotivosJson Json?` — motivos disparados (se muestran en el
  banner del drawer y quedan para métricas).
- `aprobacionSolicitadaEl DateTime?`
- `aprobacionResueltaPorId/Nombre` (+`aprobacionResueltaEl`) — quién
  aprobó/devolvió (el nombre snapshot, patrón de siempre).

Nada más: el comentario de devolución vive en el evento.

## 6. Backend

- `presupuestos.service.enviar()`: evalúa reglas antes de transicionar;
  necesita el ROL del actor → `CurrentAuth` ya trae `role`.
- `PATCH /presupuestos/:id/aprobacion { decision: 'aprobar'|'devolver',
  comentario? }` con `@Roles(ADMINISTRADOR, SUPERVISOR)`.
- `PUT /presupuestos/config`: DTO amplía `aprobacionMontoMax` y
  `aprobacionMargenMinPct` (números o null para desactivar), con
  `@Roles(ADMINISTRADOR, SUPERVISOR)` (el operador no se sube su propio
  umbral).
- Eventos nuevos: `aprobacion_solicitada` (con motivos),
  `aprobacion_aprobada`, `aprobacion_devuelta` (con comentario),
  `envio_asumido` (supervisor envió con regla disparada).
- Listado/stats: incluye el estado nuevo (groupBy ya lo trae solo).

## 7. Front

- **Rol en la vista**: la página del listado (server) pasa el rol del
  membership al componente (la sesión ya lo tiene server-side).
- **Listado**: chip "Pend. aprobación" + badge ámbar (warn) para el
  estado; el polling existente lo actualiza solo.
- **Drawer en pendiente_aprobacion**:
  - Banner ámbar con los motivos disparados textuales.
  - SUPERVISOR/ADMIN: "Aprobar y enviar" (primary) + "Devolver"
    (con textarea de comentario).
  - OPERADOR: sólo lectura — "Esperando aprobación de un supervisor".
- **Config**: sheet "Configuración de presupuestos" desde el listado
  (ícono engranaje): validez default, seña sugerida, condiciones del
  PDF (los F1 que hoy no tienen UI) + umbral de monto y margen mínimo
  (con placeholder sugerido = margenPctMin de insights, 25%). Un solo
  lugar para toda la config del módulo.
- **Ficha**: sin cambios (emitir sigue libre).
- Notificaciones push/email al supervisor: fuera de alcance (sin infra
  de canales); la señal es el chip del listado + polling. Declarado.

## 8. Secuencia de construcción (una sesión)

1. Migración + constantes de estado + tipos.
2. `evaluarAprobacion()` pura + spec (casos: sin config, monto, margen,
   item sin costo, combinados).
3. `enviar()` gateado + endpoint `aprobacion` + config DTO/roles.
4. Front: rol al view, badge/chip, banner + acciones por rol, sheet de
   config.
5. E2E: configurar umbral bajo → (a) admin envía directo con evento
   "asumido"; (b) usuario OPERADOR de dev (crear membership si no hay)
   envía → pendiente; supervisor aprueba → enviado con token; devolver
   → borrador con comentario en timeline.

## 9. Decisiones a confirmar antes de codear

1. Supervisores/admins exentos del bloqueo (recomendado sí). ✔/✘
2. Defaults desactivados (null) hasta que cada tenant configure
   (recomendado sí — no sorprender). ✔/✘
3. "Aprobar" = aprobar Y enviar en un acto (recomendado sí; evita el
   doble click y el estado intermedio). ✔/✘
4. ¿El OPERADOR puede seguir usando "Convertir en OT" desde enviado?
   (hoy sí; la aprobación interna sólo gatea el ENVÍO — recomendado
   dejarlo así en F2 y revisar con el gating por rol del Panel). ✔/✘
