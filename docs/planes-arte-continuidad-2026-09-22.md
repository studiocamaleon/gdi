# Aprobación de arte y revisiones (C08)

## Independencia y recorrido

El editor permite contratar C08 con Órdenes y Archivos sin contratar Proyectos. Antes, los documentos controlados exigían una campaña. Ahora se pueden organizar directamente en **OT → Archivos → Versiones y aprobaciones**. Las campañas mantienen su biblioteca compartida.

Un grupo de versiones pertenece a una campaña o a una OT, nunca a ambas. PostgreSQL impone esa condición. Los archivos de una revisión deben pertenecer a ese ámbito y a la misma empresa. Los requisitos documentales de las recetas se materializan también en OT independientes; al desaparecer un requisito, su control anterior se desactiva.

El recorrido es: archivo → revisión → solicitud → decisión interna o pública → liberación explícita. Aprobar no equivale a liberar. Los controles de producción siguen exigiendo una revisión vigente liberada y el tipo de aprobación correspondiente. El avance de la OT verifica los controles dentro de la transacción.

Las nuevas subidas desde Archivos calculan el hash cuando C08 está incluida. Un archivo histórico sin hash necesita volver a subirse para incorporarlo como revisión; no se inventa su huella ni se procesa automáticamente todo el almacenamiento histórico.

## Cambio de plan

- Crear grupos, revisiones, solicitudes, enlaces y controles revalida C08 dentro de la transacción y coordina con el bloqueo de empresa. Un checkout que retira C08 impide nuevos compromisos.
- Resolver solicitudes existentes y liberar arte sigue permitido mientras el contrato incluya C08, aun durante ese checkout.
- El diagnóstico bloquea retirar C08 si quedan solicitudes pendientes, incluidas las vencidas, o controles sin cumplir en trabajos abiertos. Cancelar la solicitud, liberar el arte o retirar explícitamente el control permite resolver esos pendientes. Retirar un control queda auditado; no equivale a aprobar el archivo.
- Los grupos y revisiones en preparación requieren aceptar que pasarán a consulta histórica. Retirar C08 no borra documentos, decisiones ni controles.
- Sin C08 se conserva consulta interna y pública de enlaces vigentes. Un gestor puede cancelar solicitudes, revocar enlaces y desactivar controles. No puede crear revisiones ni nuevas aprobaciones/liberaciones. La interfaz refleja estos límites y conserva los permisos personales.
- El cambio de plan nunca libera producción por sí mismo.

## Consistencia

Las decisiones releen la solicitud dentro de la transacción y actualizan únicamente una solicitud todavía pendiente. Se revalida allí la vigencia del enlace público. Una revisión obsoleta no se puede aprobar o liberar como vigente. Una decisión negativa sobre una revisión liberada retira su liberación.

La migración `20260922050000_arte_directo_ordenes` agrega el ámbito OT y vuelve opcional la campaña. Conserva los datos existentes. Se aplicó en desarrollo y en `gdi_saas_test`.

## Evidencia

- `planes-arte.integration.spec.ts`: contratos publicados/asignados de Esencial, Pro y Avanzado; plan mínimo con C08 sin Proyectos; API Nest y permisos; OT → aprobación pública → liberación → retirada → historial; campañas; archivos de otro ámbito; empresa vencida; checkout pendiente; cambio de contrato entre lectura y escritura; enlaces revocados y solicitudes vencidas.
- `arte-concurrencia.integration.spec.ts`: dos decisiones sobre la misma solicitud desde conexiones PostgreSQL independientes registran una sola respuesta. Revocar el enlace después de su lectura impide confirmar una decisión nueva.
- Pruebas de requisitos de recetas: OT con y sin campaña, reutilización de controles y retiro de requisitos antiguos. Regresión de controles productivos, tablero, asignación/contratación, cupones y fidelización, incluidos sus recorridos reales de cotización y OT.
- El recorrido F4.2/F4.3/F4.4.2 de `motor.spec.ts` también verifica los documentos materializados de una receta compuesta sin campaña: crea su revisión, solicita y registra la aprobación, libera el arte y completa producción. El fixture anterior intentaba producir sin satisfacer el requisito; se actualizó para recorrer el circuito, sin desactivar controles.
- `desarrollo-documental-planes.test.tsx`: cinco pruebas de interfaz sobre C08 sin campañas, consulta histórica, permisos y enlaces públicos en modo consulta.
- TypeScript de API (`tsconfig.build.json`) y web sin errores; lint focal de los servicios, controladores, pruebas de integración y componentes modificados sin errores. `git diff --check` limpio. API reiniciada y respuestas HTTP 200 en API y Backoffice.

## Límites

- La descarga pública se prueba como redirección mediante el firmador simulado; esta suite no descarga bytes de R2.
- El caso de cambio de contrato fuerza el orden dentro de la fixture transaccional. Los casos de decisiones concurrentes sí usan conexiones independientes; no certifican todas las intercalaciones posibles.
- La verificación de interfaz cubre renderizado y permisos. No se realizó una nueva sesión visual autenticada de empresa: la sesión disponible del navegador corresponde a Plataforma.
- El panel directo muestra documentos de esa OT. La biblioteca compartida de una campaña se sigue gestionando desde su campaña.
- No habilita precios anuales ni Paddle en producción. Continúan las revisiones de otras funciones y la validación visual global.
