# Plan Maestro — Evolución de Grafoprint para operaciones shopper / in-store

**Caso de referencia:** Visual Ilusión  
**Estado:** Plan rector de implementación  
**Versión inicial:** 1.0 — 29 de agosto de 2026  
**Rama integradora:** `visual-ilusion/analisis`  
**Documento de diagnóstico:** `docs/visual-ilusion-analisis-readiness.md`  
**Contrato visual obligatorio:** `docs/visual-ilusion-lenguaje-visual.md`
**Punto de restauración previo:** `/Users/lucasgomez/gdi-saas-backups/visual-ilusion-pre-plan-20260829-181912--03`

---

## 1. Propósito y autoridad de este documento

Este documento es la **fuente de verdad del programa de evolución Visual Ilusión**. Su objetivo no es reemplazar el diseño técnico detallado de cada fase, sino conservar de forma durable:

- el resultado de negocio esperado;
- la arquitectura objetivo;
- todas las capacidades comprometidas;
- las dependencias entre fases;
- las invariantes que no se pueden romper;
- el alcance mínimo de cada fase;
- los criterios que permiten declarar una fase terminada;
- los trabajos deliberadamente diferidos y la fase que los recibe;
- la trazabilidad entre el informe funcional y la implementación.

Una fase puede generar su propio documento de diseño y plan técnico. Esos documentos **complementan** este Plan Maestro: no pueden reducir silenciosamente su alcance.

### Regla contra la pérdida de alcance

Ningún punto de este plan puede desaparecer porque una sesión termine, cambie el equipo o aparezca una implementación más cómoda.

Si una capacidad:

1. se implementa, se marca como completada y se enlaza evidencia;
2. cambia de diseño, se registra la decisión y se actualizan las fases afectadas;
3. se difiere, debe quedar asignada explícitamente a otra fase;
4. se descarta, debe constar la razón, el impacto y la aprobación de producto.

Una fase no está completa mientras tenga elementos “pendientes” sin destino explícito.

---

## 2. Visión del producto resultante

Grafoprint conservará su flujo esencial:

```text
Cliente → Cotización → Orden de trabajo → Producción → Entrega → Cobro
```

Y permitirá activar, sólo cuando el negocio lo necesite, capas adicionales:

```text
Cliente
  → Proyecto / Campaña
  → Cotizaciones y ampliaciones
  → Entregables / productos
  → Recetas y componentes
  → Órdenes de trabajo
  → Rutas productivas
  → Lotes y producción parcial
  → Calidad y reproceso
  → Kits y unidades logísticas
  → Destinos
  → Envíos e instalaciones
  → Rentabilidad consolidada
```

El producto final no será un fork llamado “GrafoShopper”. Será **Grafoprint con capacidades industriales y una vertical modular Shopper / Retail Operations**.

### Experiencia objetivo por complejidad

- Una gráfica pequeña puede seguir usando cliente → presupuesto → OT → entrega sin configurar campañas, lotes ni kits.
- Una gráfica industrial puede usar BOM, DAG, capacidad, calidad, reservas y compras.
- Una empresa shopper/in-store puede sumar campañas, kits, multidestino, packing, logística e instalaciones.

---

## 3. Principios arquitectónicos no negociables

### P1. Compatibilidad hacia atrás

Toda entidad avanzada será opcional. Los datos existentes deberán migrar sin reinterpretaciones peligrosas y los flujos actuales conservarán su comportamiento.

### P2. Una sola plataforma

Se conserva una base de código, una API, un esquema de datos y un núcleo comercial/administrativo. Los módulos avanzados se habilitan por capacidades del tenant, configuración o plan comercial.

### P3. Definición, snapshot y ejecución son capas distintas

- El catálogo define recetas/rutas maestras versionadas.
- La cotización congela qué se vendió y cómo se calculó.
- La OT materializa qué debe ejecutarse.
- La ejecución registra lo que realmente ocurrió.

Modificar un maestro nunca altera silenciosamente una cotización u OT histórica.

### P4. Datos operativos relacionales

JSON seguirá usándose para configuración variable, atributos y snapshots. No se usarán grandes JSON mutables como sustituto de entidades con ciclo propio, concurrencia o reporting: campañas, BOM, lotes, calidad, reservas, compras, kits, envíos e instalaciones serán relacionales.

### P5. Ledger para cantidades y movimientos

Stock, reservas, transformaciones de lote, scrap, reproceso y movimientos físicos deberán ser auditables. Los saldos derivados no reemplazarán el historial que los explica.

### P6. Estados y transiciones explícitos

Cada entidad operativa tendrá máquina de estados documentada, transiciones validadas en backend, eventos de auditoría y reglas de idempotencia cuando corresponda.

### P7. El Gantt no será otra fuente de verdad

La planificación visual proyectará el scheduler. Una intervención manual se guardará como restricción, prioridad, asignación o fecha fija y volverá a alimentar el cálculo.

### P8. Seguridad multi-tenant desde el primer commit

Todos los modelos operativos incluirán `tenantId`, índices adecuados y pruebas de aislamiento. Los endpoints públicos usarán tokens opacos y proyecciones mínimas.

### P9. Modularidad de interfaz

Las pantallas y navegación avanzadas se mostrarán sólo cuando apliquen. No se impondrá complejidad shopper a todos los tenants.

### P10. Ninguna fase se cierra sólo porque “se ve bien”

Cada fase requiere persistencia, reglas de negocio, permisos, auditoría, API, UI operativa, migración, pruebas y documentación.

### P11. Una sola identidad visual Grafoprint

Toda interfaz nueva debe aplicar el contrato `docs/visual-ilusion-lenguaje-visual.md`. Las superficies ejecutivas y de gestión toman como referencia Tesorería; las superficies densas, productivas o de piso toman como referencia la Orden de Trabajo. Los componentes shadcn pueden utilizarse como infraestructura de interacción y accesibilidad, pero nunca como estética predeterminada: cada módulo tendrá composición, jerarquía y estilos propios de Grafoprint mediante CSS Modules. La revisión visual contra esas referencias forma parte del criterio de cierre de cada fase.

### P12. Frescura operativa y notificaciones son infraestructura transversal

Una vista operacional abierta no puede exigir recarga manual para conocer una aprobación, un avance productivo o un bloqueo ocurrido en otra sesión. Los eventos de negocio se persistirán una sola vez y servirán para invalidar vistas y generar notificaciones internas dirigidas. El tiempo real no reemplaza la fuente relacional ni la auditoría: avisa que algo cambió y cada pantalla reconsulta la proyección autorizada correspondiente.

---

## 4. Modelo conceptual objetivo

```text
Cliente
 └── ProyectoCampaña
      ├── CampañaHito / responsables / archivos
      ├── Cotización (0..n)
      ├── OrdenTrabajo (0..n)
      ├── EntregableCampaña
      │    └── revisión de receta/BOM congelada
      ├── DemandaMaterial / Reserva / Compra
      ├── KitDefinición / KitInstancia
      ├── DestinoCampaña
      ├── Envío
      └── Instalación

Producto
 └── RecetaRevision
      ├── NodoReceta
      ├── AristaReceta
      ├── MaterialReceta
      ├── ComponenteReceta
      ├── RecursoReceta
      └── AprobaciónRequerida

OrdenTrabajoItem
 └── EjecuciónRecetaSnapshot
      ├── NodoEjecución / dependencias
      ├── LoteProducción
      │    ├── OperaciónLote
      │    ├── InspecciónCalidad
      │    └── Incidencia / Reproceso
      └── PlanNesting

Producción buena disponible
 └── AsignaciónKit / Picking
      └── UnidadLogística (caja/pallet)
           └── Envío → Entrega → Instalación
```

Los nombres definitivos se resolverán en los diseños de fase. El diagrama fija responsabilidades y evita fusionar conceptos distintos.

---

## 5. Estrategia de ramas e integración

### Rama integradora

`visual-ilusion/analisis` será la rama de integración del programa hasta que el conjunto sea funcional y aceptado. No se fusionará a `main` por el mero cierre de una fase.

### Ramas de fase

Cada fase nace desde la rama integradora actualizada:

```text
visual-ilusion/analisis
  ├── visual-ilusion/fase-1-campanas
  ├── visual-ilusion/fase-2-arte-aprobaciones
  ├── visual-ilusion/fase-2-5-tiempo-real-notificaciones
  ├── visual-ilusion/fase-3-recetas-bom
  └── ...
```

Al finalizar una fase:

1. se valida su Definition of Done;
2. se actualiza este documento con estado y evidencia;
3. se integra en `visual-ilusion/analisis`;
4. se ejecuta la regresión acumulada;
5. la fase siguiente nace desde esa integración.

### Regla de commits

- Migraciones, backend, frontend, pruebas y documentación deben quedar en commits comprensibles.
- Una migración aplicada no se reescribe después de ser compartida; se corrige con otra migración.
- Ninguna rama de fase se elimina hasta verificar su integración y conservar una referencia recuperable.

---

## 6. Gobierno del programa

### Estados de fase

- `PENDIENTE`: no iniciada.
- `DISEÑO`: dominio y contratos en definición.
- `IMPLEMENTACIÓN`: construcción activa.
- `VALIDACIÓN`: implementación completa, bajo pruebas/piloto.
- `COMPLETA`: criterios de salida cumplidos e integrada.
- `BLOQUEADA`: impedimento explícito registrado.

### Artefactos obligatorios por fase

Cada fase debe producir:

1. diseño funcional/técnico de la fase;
2. decisiones e invariantes;
3. migraciones y estrategia de backfill;
4. contratos de API;
5. permisos y auditoría;
6. UI operativa y estados vacíos/error;
7. pruebas unitarias, integración y casos de regresión;
8. guía de uso o actualización de documentación;
9. evidencia de aceptación;
10. actualización de la matriz de trazabilidad de este documento.

### Definition of Done común

Una fase sólo puede marcarse `COMPLETA` cuando:

- todos sus criterios funcionales están cubiertos;
- el flujo simple anterior sigue funcionando;
- las migraciones se probaron sobre una copia representativa de la base;
- el aislamiento multi-tenant está probado;
- los permisos deniegan por defecto;
- los eventos críticos quedan auditados;
- los comandos idempotentes no duplican datos;
- build, lint relevante y tests pasan;
- los indicadores/reportes no inventan datos ausentes;
- la documentación refleja la implementación real;
- los pendientes están cerrados, reasignados o descartados formalmente.

### Gate de regresión acumulada

Después de integrar cada fase se verificará como mínimo:

- alta/login/tenant;
- clientes y proveedores;
- productos/rutas/costeo;
- creación, envío y aprobación de presupuesto;
- conversión/emisión de OT;
- tablero y ejecución lineal;
- ETA;
- stock/Kardex;
- archivos;
- facturación/cobro/egresos;
- tracking/entrega existentes.

---

## 7. Fases maestras

## Fase 0 — Resguardo, diagnóstico y gobierno

**Estado:** COMPLETA para iniciar Fase 1.

### Objetivo

Establecer un punto recuperable, comprender la arquitectura real y fijar el plan que gobierna las implementaciones posteriores.

### Incluye

- punto de restauración completo y verificado;
- diagnóstico de preparación del sistema;
- decisión de un solo producto modular;
- Plan Maestro y matriz de trazabilidad;
- estrategia de ramas y gates de calidad.

### Evidencia

- `docs/visual-ilusion-analisis-readiness.md`.
- este documento.
- backup `/Users/lucasgomez/gdi-saas-backups/visual-ilusion-pre-plan-20260829-181912--03`.

### Salida

La Fase 1 puede empezar sin decisiones estructurales pendientes.

---

## Fase 1 — Proyecto / Campaña como capa de coordinación

**Estado:** COMPLETA
**Rama:** `visual-ilusion/fase-1-campanas`  
**Dependencias:** Fase 0.

### Objetivo de negocio

Permitir que una operación como “Carrefour — Vuelta a Clases 2027” se gestione como una unidad, sin perder la autonomía de presupuestos, OTs, facturas y entregas.

### Lenguaje visual de la fase

- Familia primaria: **Gestión ejecutiva**, basada en Tesorería, para el listado, filtros, KPIs, ficha de campaña y lectura comercial.
- Familia secundaria: **Operación técnica**, basada en la Orden de Trabajo, para hitos, avance productivo, alertas y trazabilidad operativa.
- El listado será una tabla operacional con jerarquía y densidad controladas, no una cuadrícula genérica de tarjetas.
- La ficha combinará una cabecera ejecutiva, una banda de indicadores y bloques operativos trazables a sus fuentes.
- Formularios, estados, responsive y criterios de aceptación visual se rigen por la sección 8 del contrato visual obligatorio.

### Alcance obligatorio

- Entidad `ProyectoCampaña` opcional por tenant y cliente.
- Código/número legible, nombre, descripción, tipo, estado, prioridad, fechas, responsable, equipo y observaciones.
- Ciclo inicial: borrador → activo → pausado → completado/cancelado, con reglas explícitas.
- Relación de campaña con múltiples cotizaciones y múltiples OTs.
- Soporte de ampliaciones: nuevos presupuestos/OTs vinculados sin modificar los originales.
- Archivos de campaña y timeline de eventos.
- Hitos configurables con responsable, fecha objetivo, estado y notas.
- Vista listado con filtros por cliente, estado, responsable y fecha.
- Ficha/dashboard con resumen comercial, producción, materiales disponibles cuando haya fuente, entregas y rentabilidad agregable.
- Creación/selección opcional de campaña desde presupuesto y OT.
- Navegación desde cliente, presupuesto y OT hacia la campaña.
- Permisos específicos o mapeados coherentemente a comercial/producción.
- Auditoría de altas, cambios de estado, vínculos y desvínculos.

### Modelo y decisiones mínimas

- No convertir Campaña en una super-OT.
- No imponer una única cotización u OT.
- Preferir FK opcional directa para el caso dominante; usar tabla de asociación sólo donde la cardinalidad real sea n:n.
- Congelar métricas financieras desde fuentes contables existentes, no duplicar montos editables.
- Definir qué significa “completada”: decisión humana inicialmente, acompañada de señales derivadas.

### Compatibilidad

- Todos los registros existentes quedan con `proyectoCampañaId = null`.
- Presupuestar y emitir OT sin campaña debe seguir idéntico.
- No alterar estados ni numeraciones de presupuesto/OT.

### Fuera de alcance, con destino

- versiones/aprobación de arte → Fase 2;
- BOM y componentes → Fase 3;
- lotes → Fase 6;
- kits/destinos → Fases 12–13;
- dashboard material detallado → se enriquece en Fases 9–11.

### Criterios de salida

- Crear una campaña para un cliente y vincular al menos dos presupuestos y dos OTs.
- Agregar una ampliación sin modificar ni renumerar lo anterior.
- Ver un dashboard cuyos totales coincidan con las entidades fuente.
- Usar presupuesto/OT sin campaña sin diferencias funcionales.
- Aislamiento tenant, permisos y auditoría probados.
- Backfill/migración probados contra copia de la base.

---

## Fase 2 — Desarrollo, archivos versionados y aprobaciones

**Estado:** COMPLETA · VALIDACIÓN FUNCIONAL APROBADA

**Rama:** `visual-ilusion/fase-2-desarrollo-aprobaciones`

**Dependencias:** Fase 1.

### Objetivo de negocio

Evitar producir archivos obsoletos y administrar Brief → Diseño → Prototipo → Muestra → Aprobación → Liberación.

### Alcance obligatorio

- `ArchivoMaestro` por propósito lógico: print, cut, render, plano, instructivo u otro.
- Revisiones inmutables con número, autor, fecha, comentario, hash y archivo físico.
- Estados de revisión: borrador, en revisión, observada, aprobada, obsoleta.
- Puntero único a revisión aprobada/liberada para producción.
- Entidad de solicitud/decisión de aprobación reutilizable.
- Tipos de aprobación iniciales: cliente, diseño, color/muestra, ingeniería y liberación productiva.
- Aprobadores por rol/usuario, comentario, fecha y evidencia.
- Gates configurables que bloqueen el comienzo del trabajo productivo correspondiente.
- Flujo de prototipo/muestra con iteraciones y decisión.
- Timeline y notificaciones internas usando infraestructura existente cuando corresponda.
- Link público seguro para aprobación externa, con token, expiración/revocación y proyección mínima.
- La OT y el nodo de producción deben mostrar exactamente qué revisión está liberada.

### Invariantes

- Una revisión aprobada no se sobrescribe.
- Aprobar una nueva revisión vuelve obsoleta o reemplazada a la anterior mediante transición auditable.
- Producción nunca elige “el último archivo”; usa la revisión explícitamente liberada.
- El borrado físico respeta retención y referencias históricas.

### Compatibilidad

Los `Archivo` existentes siguen siendo adjuntos. La migración al modelo maestro/revisión es gradual y sólo obligatoria para flujos que activen control documental.

### Criterios de salida

- Cargar V1, rechazarla, cargar V2, aprobarla y demostrar que sólo V2 puede liberarse.
- Bloquear e impedir backend-side el inicio de producción sin aprobación requerida.
- Conservar historial completo aun al cambiar aprobadores o archivos vigentes.
- Aprobar externamente sin exponer costos, otros clientes o archivos privados.

### Evidencia de implementación

- Diseño y decisiones: `docs/visual-ilusion-fase-2-desarrollo-aprobaciones-diseno.md`.
- Migración: `apps/api/prisma/migrations/20260829210000_visual_ilusion_fase_2_desarrollo_aprobaciones/migration.sql`.
- Recorrido real completado con V1 observada/rechazada, V2 aprobada/liberada, revocación de link y gate productivo bloqueado/habilitado sobre la misma OT.
- Prisma y base al día; builds Nest/Next exitosos; 197 tests relevantes aprobados.
- Conformidad funcional otorgada el 29/08/2026; lista para integrar en la rama madre.

---

## Fase 2.5 — Eventos en tiempo real y bandeja de notificaciones internas

**Estado actual:** COMPLETA · VALIDACIÓN FUNCIONAL APROBADA

**Rama:** `visual-ilusion/fase-2-5-tiempo-real-notificaciones`

**Documento de diseño:** `docs/visual-ilusion-fase-2-5-tiempo-real-notificaciones-diseno.md`

**Dependencias:** Fases 1–2.

**Orden recomendado:** ejecutar antes de Fase 3 para que las fases siguientes publiquen eventos sobre un contrato único.

### Problema que resuelve

Campañas y otras fichas cargan hoy un snapshot inicial: si otra persona avanza una OT o un cliente decide una aprobación, la pantalla abierta no cambia hasta recargarla. Algunos módulos —Tablero, tracking, presupuestos— resuelven casos puntuales con polling de 10–15 segundos, pero no existe una infraestructura común. Las tablas `NotificacionEvento` y `NotificacionWhatsapp` actuales pertenecen exclusivamente al envío externo por WhatsApp y no deben reutilizarse como inbox interno.

### Objetivo de negocio

Que cada usuario vea cambios pertinentes sin recargar y reciba, junto a “Cerrar sesión”, una bandeja persistente de novedades no leídas según sus responsabilidades y permisos. La capacidad será reutilizable por todo Grafoprint, no exclusiva de Shopper ni de Campañas.

### Arquitectura objetivo

- **Evento de dominio / outbox transaccional:** registro append-only, tenant-safe e idempotente del hecho ocurrido, creado en la misma transacción que el cambio de negocio. Incluye tipo, entidad, actor, fecha, correlación y payload mínimo no sensible.
- **Notificación interna por destinatario:** fila persistente por usuario con estado no leída/leída/archivada, severidad, título, resumen y deep-link autorizado. Los destinatarios se resuelven por asignación explícita, responsable/equipo, rol y permiso según cada tipo de evento.
- **Entrega en vivo:** Server-Sent Events autenticados como canal principal, porque el sistema necesita comunicación unidireccional servidor → navegador. Debe soportar heartbeat, reconexión, `Last-Event-ID`, replay acotado y paso correcto por el BFF de Next sin bufferizar el stream.
- **Degradación segura:** si SSE no está disponible, polling incremental con cursor, sólo con la pestaña visible y al recuperar foco. La operación nunca depende de que el canal en vivo esté conectado.
- **Invalidación selectiva:** el evento transporta identificadores/tópicos de invalidación; Campaña, OT, Tablero u otra vista reconsulta sólo su proyección autorizada. No se envían datasets completos por el stream ni se pisan formularios/modales con cambios sin guardar.
- **Proveedor global de UI:** una única conexión por sesión de dashboard mantiene el contador, la bandeja y distribuye invalidaciones a las vistas abiertas.

### Alcance obligatorio

- Modelos relacionales de evento durable, notificación por usuario y cursor/lectura cuando corresponda.
- Catálogo tipado y versionable de eventos internos, separado del catálogo de WhatsApp.
- Productor transaccional y materialización idempotente de destinatarios; un fallo de entrega no revierte el cambio de negocio.
- Endpoint incremental de eventos/notificaciones y stream SSE autenticado.
- Adaptación del BFF para streaming, desconexión y cancelación correctos.
- Campana abierta actualizada automáticamente ante cambios de OT, hitos, vínculos y aprobaciones documentales.
- OT, Tablero y documentación liberada sincronizados sin recarga manual.
- Campana de notificaciones al lado de “Cerrar sesión”, badge de no leídas y panel con: recientes, tipo, fecha, contexto, deep-link, marcar una/todas como leídas y estado vacío/error/desconectado.
- Destinatarios iniciales:
  - solicitud/decisión/liberación documental → solicitante, asignado, responsable y equipo pertinente;
  - bloqueo, inicio, avance y finalización de OT → responsables comerciales/productivos pertinentes;
  - hitos vencidos/completados y cambios relevantes de campaña → responsable/equipo;
  - eventos de fases futuras → deben registrar aquí su política al implementarse.
- Preferencias mínimas por familia sólo si el relevamiento confirma que un evento es informativo y silenciable; eventos críticos de seguridad/operación no pueden ocultarse por defecto.
- Paginación, retención, deduplicación, métricas de conexión/entrega y limpieza programada documentadas.
- Compatibilidad con una o varias instancias de API. El diseño no puede depender de memoria local del proceso; podrá usar PostgreSQL para durabilidad/señalización y dejar Redis como evolución medida, no como requisito prematuro.

### Lenguaje visual

- Botón global discreto y contador inspirado en la densidad de la cabecera de Tesorería, ubicado inmediatamente antes de “Cerrar sesión”.
- Panel de lectura ejecutiva con jerarquía Grafoprint; eventos productivos conservan códigos, estados y acentos técnicos de la OT.
- No se presenta como un dropdown shadcn genérico. Desktop, tablet y mobile deben conservar contador, navegación y acciones de lectura.

### Invariantes

- Si la transacción de negocio hace rollback, no existe evento; si confirma, el evento durable no se pierde.
- La entrega es al menos una vez y el consumo es idempotente: reconectar no duplica notificaciones ni efectos visuales.
- Una notificación pertenece a un tenant y a un usuario concreto; cambiar roles después no permite leer retrospectivamente contenido no autorizado.
- El stream nunca contiene importes, archivos o datos personales que el destinatario no pueda consultar por el endpoint de destino.
- Marcar como leída es por usuario y no modifica la auditoría ni el timeline de negocio.
- El badge y el stream son señales de frescura, no nuevas fuentes de verdad.
- WhatsApp, email u otros canales podrán consumir los mismos eventos en el futuro, pero conservan colas, consentimiento y políticas de envío independientes.

### Criterios de salida

- Con dos sesiones simultáneas, avanzar una OT en una actualiza su Campaña/OT abierta en la otra sin recargar.
- Una aprobación externa actualiza la revisión y genera la notificación pertinente en sesiones conectadas.
- Con SSE sano, el cambio visible llega dentro de un objetivo inicial de 3 segundos; al cortar el stream, la reconexión o fallback lo recupera sin pérdida.
- Cerrar/reabrir sesión conserva no leídas; marcar una o todas funciona y no afecta a otro usuario.
- Un usuario no asignado o sin permiso no recibe ni puede consultar la notificación o entidad.
- Reconexión, doble entrega, dos instancias de API y dos pestañas no duplican filas ni contadores.
- Campaña, Tablero, tracking y presupuesto conservan su comportamiento anterior durante degradación.
- Pruebas de aislamiento tenant, autorización, replay, idempotencia, performance y QA visual responsive aprobadas.

### Fuera de alcance, con destino

- Push del sistema operativo y aplicación móvil nativa: evaluar después del piloto.
- Email como canal: integrar sólo con proveedor y consentimiento definidos.
- Automatizaciones configurables por usuarios finales: fase posterior al catálogo estable.

---

## Fase 3 — Receta productiva y BOM versionada

**Estado actual:** COMPLETA · VALIDACIÓN FUNCIONAL, TÉCNICA Y VISUAL APROBADA
**Rama:** `visual-ilusion/fase-3-receta-bom`
**Documento de diseño:** `docs/visual-ilusion-fase-3-receta-bom-diseno.md`
**Dependencias:** Fase 2 para archivos/aprobaciones reutilizables y Fase 2.5 para eventos/notificaciones transversales.

### Objetivo de negocio

Representar de forma explícita qué materiales, componentes, procesos, recursos y documentos necesita un producto industrial.

### Alcance obligatorio

- Entidad de receta maestra y revisiones publicables.
- Líneas de material con unidad, fórmula, merma y política de selección.
- Distinción entre sustrato/consumible/packaging, componente comprado y subproducto fabricado.
- Recursos requeridos: estación, máquina/capacidad, perfil operativo y skill/dotación cuando aplique.
- Archivos/documentos requeridos por nodo.
- Costos directos y tercerizaciones integrados sin duplicar el motor vigente.
- Validación de unidades y compatibilidades.
- Publicar/clonar/deprecar revisiones.
- Snapshot exacto de la revisión al cotizar y al emitir OT.
- Estrategia de adopción para productos existentes basados en ruta + slots.

### Decisión clave

Los productos compuestos simples podrán seguir usando slots si no requieren ejecución independiente. Sólo un componente que necesite cantidad, ruta, estado o convergencia propios se materializa como subproducto fabricado.

### Invariantes

- No hay recursión infinita de recetas.
- Las unidades son convertibles y validadas.
- Una revisión publicada es inmutable.
- Costear la receta no puede contar dos veces un material heredado.

### Criterios de salida

- Modelar un exhibidor con materiales, packaging y al menos un componente comprado.
- Modelar un producto compuesto simple sin regresión respecto al motor actual.
- Cotizar y emitir preservando revisión y desglose.
- Detectar ciclos, unidades incompatibles y componentes faltantes.

### Evidencia de cierre

- Caso industrial automatizado: exhibidor rígido de 600 × 1.800 mm con
  sustrato, consumible, packaging, componente comprado, componente fabricado,
  estación, capacidades y documento aprobado requerido.
- Cotización recursiva y frontera de emisión de OT conservan revisión, versión,
  huella, BOM y desglose de componentes.
- Una nueva versión de la receta hija invalida la cotización del padre hasta
  publicar una revisión consistente; ciclos, unidades y referencias faltantes
  se rechazan explícitamente.
- Migraciones aplicadas en desarrollo y test; builds de API y frontend
  aprobados; regresión total: 194 suites y 1.927 pruebas aprobadas (2 suites y
  3 casos omitidos explícitamente por el repositorio).
- QA visual de Producción/BOM aprobado en escritorio y mobile, sin elementos
  fuera del viewport y respetando el lenguaje visual propio de Grafoprint.

---

## Fase 4 — Rutas DAG, paralelismo, convergencia y gates

**Estado actual:** IMPLEMENTADA · PENDIENTE DE VALIDACIÓN FUNCIONAL DE COMPONENTES CONFIGURABLES

**Rama:** `visual-ilusion/fase-4-rutas-dag`

**Documento de diseño:** `docs/visual-ilusion-fase-4-rutas-dag-diseno.md`

**Ampliación 4.1:**
`docs/visual-ilusion-fase-4-1-composicion-contextual-diseno.md`

**Ampliación 4.2:**
`docs/visual-ilusion-fase-4-2-pasos-compuestos-incorporacion-diseno.md`

**Dependencias:** Fase 3.

### Objetivo de negocio

Ejecutar rutas con ramas paralelas y convergencia, manteniendo las rutas lineales actuales.

### Alcance obligatorio

- Topología `LINEAL | DAG` por revisión.
- Nodos productivos y aristas de precedencia.
- Compilación de rutas lineales existentes a un DAG trivial sin cambiar su comportamiento.
- Materialización en OT de nodos y dependencias congeladas.
- Regla de ejecutabilidad por predecesores satisfechos y gates.
- Varias fronteras activas simultáneas por ítem.
- Convergencia de componentes antes de armado/QC.
- Vincular cada componente fabricado separado de la BOM a su nodo de
  incorporación, ensamble o convergencia dentro del flujo principal.
- Crear y coordinar la ejecución hija desde esa relación, conservando la receta
  y revisión que Fase 3 dejó congeladas.
- Configurar cada instancia hija mediante bindings de parámetro: default del
  hijo, valor fijo, referencia al JobContext público del padre, fórmula segura
  o valor solicitado durante la cotización.
- Mantener visibles los parámetros industriales de un paso tercerizado: cambia
  quién lo ejecuta y cómo se costea, no qué trabajo se encarga.
- Permitir que un componente publique outputs planificados y que otros hijos
  los consuman mediante referencias controladas y un DAG de cálculo separado
  del DAG productivo.
- Permitir que el nodo de incorporación actúe como paso compuesto y reúna
  operaciones hijas específicas por relación BOM, con inductores, tiempos,
  recursos, costos y trazabilidad propios.
- Separar estrictamente la fabricación de cada componente, su trabajo de
  incorporación y la preparación/cierre general del ensamble, evitando doble
  conteo y manteniendo legible la ruta principal.
- Congelar outputs públicos, dependencias de cálculo y contextos resueltos sin
  compartir un JobContext global mutable entre productos.
- Reutilizar el configurador del producto hijo en un workspace amplio desde la
  BOM y como segundo nivel del sheet de cotización, sin duplicar ni comprimir el
  editor de rutas.
- Congelar en cotización y OT el JobContext hijo resuelto, sus bindings,
  cantidad, revisión y desglose económico.
- Actualización de iniciar, completar, bloquear, reabrir, cancelar y finalizar.
- Progreso por nodos y duración ponderada, sin vender falsa precisión.
- Adaptación del tablero por ítems/estación/kanban.
- Adaptación del scheduler ETA para precedencias DAG.
- Visualizador de dependencias comprensible; el editor avanzado puede ser una vista posterior si la primera versión usa formularios controlados.

### Gates soportados

- nodo(s) anterior(es) terminados;
- material asignado/disponible;
- aprobación liberada;
- componente recibido;
- tercerización recibida;
- condición de calidad satisfecha.

### Invariantes

- Un nodo no inicia si falta cualquier dependencia obligatoria.
- Reabrir un nodo invalida/controla descendientes ya iniciados; nunca deja el grafo imposible.
- Finalizar requiere todos los terminales obligatorios satisfechos.
- El scheduler y el backend comparten la misma semántica de dependencias.

### Criterios de salida

- Ejecutar `Diseño → {UV PVC, Cartón/Corte, Acrílico/Láser} → Armado → QC`.
- Demostrar ramas simultáneamente listas en estaciones distintas.
- Impedir Armado hasta completar todas las ramas.
- Demostrar que un componente fabricado con receta propia se ejecuta por su
  ruta y habilita exactamente el nodo del producto padre donde se incorpora.
- Cotizar un padre de medida libre cuyo hijo hereda/calcula medidas, combina
  valores fijos y solicita al menos una decisión comercial; validar y congelar
  ambos JobContexts sin doble conteo.
- Ejecutar una OT lineal histórica con resultado equivalente.
- ETA y progreso coherentes en ambos tipos de topología.
- Resolver el caso Backlight: Bastidor publica geometría; Lona y Cenefas la
  consumen al cotizar y las tres ramas siguen disponibles en paralelo hasta su
  convergencia física.
- Resolver el ensamble del Backlight como paso compuesto: tensado, cenefas,
  iluminación y prueba conservan reglas de tiempo diferentes sin convertirse
  en productos ni ensuciar la ruta principal.

### Evidencia de implementación

- Grafo `LINEAL | DAG` versionado, validado, congelado en OT y materializado
  mediante dependencias relacionales, con fallback equivalente para órdenes
  históricas.
- Ejecución con varias fronteras simultáneas, convergencia estricta,
  reapertura segura por descendientes, finalización por terminales y progreso
  ponderado.
- Componentes fabricados como ítems hijos con receta propia congelada; sus
  terminales habilitan exactamente el nodo de incorporación del padre.
- Gates de aprobación, componente y tercerización integrados con sus fuentes;
  gates de `MATERIAL` y `CALIDAD` persistentes, auditables y bloqueantes. En F4
  se resuelven por supervisor; F7 y F9 conectarán evidencia de QC e inventario
  sin cambiar el contrato.
- Scheduler ETA, simuladores y tablero adaptados a DAG; editor controlado de
  dependencias y gates en Producción/BOM.
- Migraciones aplicadas en desarrollo y test; builds aprobados; regresión
  acumulada: backend 197 suites/1.944 pruebas y frontend 54 archivos/542
  pruebas aprobadas.
- La validación funcional detectó que `cantidad × unidad` no cubre hijos de
  medida libre. Se aprobó la ampliación de bindings padre–componente documentada
  en el diseño de F4; su implementación y QA vuelven a dejar la fase en
  desarrollo antes del cierre.

---

## Fase 5 — Centro de corte y planes de nesting persistentes

**Estado inicial:** PENDIENTE  
**Dependencias:** Fases 3–4.

### Objetivo de negocio

Convertir corte/nesting en trabajo planificado, versionado y trazable, no sólo en un cálculo transitorio.

### Alcance obligatorio

- `PlanNesting` genérico con revisión/estado.
- Material, variante/lote cuando exista, formato, piezas, cantidades, placas/rollo, aprovechamiento y scrap.
- Archivo fuente, resultado generado y vínculo con archivos print/cut/TAP.
- Máquina, herramienta, tipo de operación, pasadas, metros de recorrido y estimación.
- Aprobación/liberación del plan antes de ejecutar.
- Cola específica de mesa de corte usando estaciones y capacidad existentes.
- Consolidación de trabajos y relación entre tanda de máquina y lotes productivos futuros.
- Consumo planificado vs. real y aporte a costos/sostenibilidad.
- Revisiones sin sobrescribir planes ya ejecutados.

### Invariantes

- Un plan ejecutado es inmutable.
- Reanidar genera revisión nueva y recalcula reserva/consumo antes de liberar.
- La cantidad total de piezas del plan debe cubrir la demanda asignada.

### Criterios de salida

- Persistir y reabrir un plan sin recalcularlo accidentalmente.
- Mostrar aprovechamiento/scrap y archivos asociados.
- Ejecutar una tanda consolidada manteniendo identidad de trabajos participantes.

---

## Fase 6 — Lotes productivos y producción parcial

**Estado inicial:** PENDIENTE  
**Dependencias:** Fases 3–5.

### Objetivo de negocio

Dividir una demanda grande en lotes físicos trazables y registrar cantidades reales por operación.

### Alcance obligatorio

- `LoteProducción` con identificador, cantidad objetivo, unidad y genealogía.
- División y fusión controladas.
- Estado/ubicación productiva por lote.
- Operación por lote/nodo con entrada, buenas, rechazadas, scrap y pendientes.
- Transferencia de cantidad al nodo siguiente.
- Producción y entrega parciales sin falsificar el estado global de la OT.
- Múltiples lotes simultáneamente en pasos diferentes.
- Reconciliación cuantitativa y eventos auditables.
- Vínculo opcional con lote de materia prima cuando Fase 9 lo habilite.
- Etiqueta/QR básico de lote reutilizando infraestructura existente.

### Diferencia obligatoria de conceptos

- **Tanda de máquina:** varios trabajos procesados juntos.
- **Lote productivo:** porción física de la cantidad de un trabajo.

Pueden relacionarse, pero nunca ser la misma entidad.

### Invariantes cuantitativas

- Entrada = buenas + rechazadas + scrap + pendiente/transferida según transición.
- Dividir conserva la cantidad total.
- Fusionar sólo lotes compatibles y conserva genealogía.
- Una cantidad no puede estar en dos ubicaciones/estados físicos a la vez.

### Criterios de salida

- Dividir 5.000 unidades en 1.000/1.000/1.500/1.500.
- Tener simultáneamente lotes terminados, en armado, corte e impresión.
- Registrar 1.000 entradas, 984 buenas, 11 scrap y 5 a reproceso sin descuadre.
- Derivar progreso de OT y campaña de forma explicable.

---

## Fase 7 — Calidad, incidencias y reproceso

**Estado inicial:** PENDIENTE  
**Dependencias:** Fase 6.

### Objetivo de negocio

Controlar calidad por producto/lote, registrar no conformidades y reponer automáticamente cantidades defectuosas con costo trazable.

### Alcance obligatorio

- Plantilla versionada de checklist QC por producto/receta/nodo.
- Inspección por lote, muestra o unidad según configuración.
- Resultado aprobado, rechazado, aprobado con observación o reproceso.
- Mediciones, fotos, comentarios y firma/responsable.
- Incidencia/no conformidad con estación, máquina, operador, causa, afectadas y severidad.
- Catálogo inicial de causas y acciones, extensible por tenant.
- Orden/rama de reproceso vinculada a la incidencia y al lote origen.
- Reposición de cantidad y reincorporación controlada al flujo.
- Costo de falla: materiales, máquina, tercero y tiempo real.
- Reportes de yield, scrap, costo y causas principales.

### Invariantes

- Reproceso no crea unidades vendibles sin una entrada defectuosa trazable.
- Una incidencia cerrada conserva evidencia y costos.
- QC obligatorio bloquea liberación/packing hasta aprobar.

### Criterios de salida

- Registrar un defecto de corte en 14 unidades.
- Crear la reposición necesaria, ejecutarla y reincorporarla al lote.
- Ver el costo incremental y el impacto en yield.
- Bloquear packing de unidades sin QC requerido.

---

## Fase 8 — Variantes comerciales y matrices de cantidad

**Estado inicial:** PENDIENTE  
**Dependencias:** Fases 3 y 6; puede diseñarse en paralelo con Fase 7.

### Objetivo de negocio

Vender y producir un total consolidado con distribución por talle, color u otros ejes.

### Alcance obligatorio

- Definición de ejes de variante y combinaciones permitidas.
- Matriz cantidad por combinación en cotizador.
- Total derivado, no editable de forma inconsistente.
- Precio/costo del componente base por variante, incluidos recargos.
- Procesos compartidos calculados sobre total y excepciones por variante cuando corresponda.
- Snapshot de curva en cotización y OT.
- Preparación/picking de blanks por curva.
- Producción consolidada sin crear obligatoriamente una OT por combinación.
- Representación en lotes: homogéneos o mixtos con desglose controlado.
- Reportes y exportación legible de curva.

### Criterios de salida

- Cotizar 500 remeras en matriz talle × color y obtener total 500.
- Costear correctamente precios distintos de blanks.
- Ejecutar procesos compartidos y mostrar la curva al taller/packing.
- Evitar combinaciones no permitidas o totales incongruentes.

---

## Fase 9 — Inventario comprometido, reservas y trazabilidad

**Estado inicial:** PENDIENTE  
**Dependencias:** Fases 3 y 6.

### Objetivo de negocio

Distinguir stock físico, reservado, disponible, en producción, consumido, scrap, recuperado y en compra.

### Alcance obligatorio

- Ledger de reservas/asignaciones separado de movimientos físicos.
- Reserva por campaña, OT, ítem, lote o demanda normalizada.
- Disponible = físico utilizable − reservado/asignado vigente.
- Ciclo de reserva: solicitada, confirmada, parcial, liberada, consumida/cancelada.
- Consumo real contra lote/nodo y comparación planificado vs. real.
- Scrap y recuperación con movimientos explícitos.
- Soporte opcional de lotes de materia prima y política por material.
- Selección de ubicación/lote; FIFO/FEFO sólo donde se configure.
- Prevención de sobre-reserva mediante transacciones y locking apropiado.
- Visibilidad de faltantes y fecha esperada de cobertura.
- Integración con cotizador/ETA sin prometer disponibilidad falsa.

### Invariantes

- Reservar no mueve físicamente stock.
- Consumir requiere asignación o excepción auditada.
- Liberar devuelve disponibilidad.
- Los saldos materializados siempre se pueden reconstruir desde ledgers.

### Criterios de salida

- Sobre físico 120 y reservado 70, mostrar disponible 50.
- Impedir reservas concurrentes que excedan disponibilidad salvo política explícita.
- Consumir parcialmente y liberar remanente.
- Trazar consumo/scrap/recuperación hasta OT/lote/campaña.

---

## Fase 10 — Abastecimiento y tercerización completa

**Estado inicial:** PENDIENTE  
**Dependencias:** Fase 9; reutiliza tercerización existente.

### Objetivo de negocio

Convertir faltantes y pasos tercerizados en un ciclo controlado de solicitud, orden, recepción y costo real.

### Alcance obligatorio

- Demanda de compra derivada de reservas/faltantes y demanda manual.
- Solicitud/requisición de compra con aprobación configurable.
- Orden de compra con proveedor, moneda, líneas, cantidades, precio, impuestos, fechas y condiciones.
- Recepción total/parcial, rechazo/devolución y entrada a stock.
- Asignación automática o asistida de lo recibido a la demanda origen.
- Documentos y eventos.
- Vínculo con egreso/factura del proveedor sin doble contabilización del costo.
- Tercerización: cantidad enviada, recibida, rechazada y pendiente; fechas prometida/real.
- OC desde paso tercerizado y conciliación del costo estimado vs. real.
- Estados de compra y alertas de atraso.

### Invariantes

- Una recepción no puede superar la OC sin excepción explícita.
- Una cantidad recibida no se asigna a dos demandas.
- El egreso paga; la recepción mueve stock; el motor calcula costo. Sus responsabilidades no se mezclan.

### Criterios de salida

- Detectar déficit de 70 placas, generar solicitud y OC, recibir parcialmente y reservar a campaña.
- Enviar 100 unidades a tercerizar, recibir 96+4 y liberar el nodo dependiente sólo al cumplir la regla.
- Mostrar variación estimado/real sin duplicar costo contable.

---

## Fase 11 — Planificación avanzada, Gantt y fecha hacia atrás

**Estado inicial:** PENDIENTE  
**Dependencias:** Fases 4, 6, 9 y 10.

### Objetivo de negocio

Planificar campañas y órdenes con capacidad finita, recursos, materiales y proveedores, tanto hacia adelante como desde una fecha objetivo.

### Alcance obligatorio

- Scheduler en backend como fuente única para escenarios persistibles.
- Capacidad por estación, máquina y mano de obra/dotación cuando aplique.
- Calendarios, turnos, feriados, mantenimiento y excepciones.
- Dependencias DAG, lotes, lead times, materiales y terceros.
- Forward scheduling y backward scheduling desde entrega/instalación.
- Buffers configurables por logística, calidad y riesgo.
- Identificación de cuello de botella y riesgo de atraso por campaña.
- Escenarios “qué pasa si”, sin alterar plan vigente hasta publicar.
- Plan publicado/versionado y replanificación ante eventos.
- Gantt por campaña, OT, estación y recurso.
- Intervenciones manuales como restricciones auditadas.
- Alertas por sobrecarga, atraso, material o proveedor.
- Métricas de precisión plan vs. real reutilizando ETA histórica.

### Invariantes

- El Gantt refleja el plan calculado.
- Publicar un escenario es una acción explícita y versionada.
- La fecha prometida muestra nivel de confianza/supuestos.
- Backward scheduling nunca oculta inviabilidad: informa el inicio requerido en pasado o la sobrecarga.

### Criterios de salida

- Detectar Mesa 118% y Armado 136% para una fecha.
- Calcular hacia atrás desde instalación el 20/10 incluyendo logística, packing, armado y producción.
- Publicar un escenario y explicar por qué una campaña está en riesgo.
- Replanificar tras atraso de proveedor conservando plan anterior.

---

## Fase 12 — Modelo shopper: entregables, kits y destinos

**Estado inicial:** PENDIENTE  
**Dependencias:** Fases 1, 6, 8 y 9.

### Objetivo de negocio

Traducir producción por producto en demanda por kit y destino retail.

### Alcance obligatorio

- Entregables de campaña independientes de cómo se dividan en OTs.
- Definición versionada de kit con componentes/cantidades.
- Cantidad de kits requerida y explosión de demanda.
- Destinos de campaña con dirección, contacto, restricciones y ventanas.
- Matriz destino × entregable/kit × cantidad.
- Validación de totales y redondeos.
- Instancias de kit cuando haga falta trazabilidad individual; agregación cuando no.
- Asignación de producción buena disponible a demanda de kits.
- Estados de completitud derivados, no manuales.
- Ampliaciones de destinos/cantidades sin reescribir la distribución original.
- Importación/exportación tabular idempotente para cientos de locales.

### Invariantes

- La demanda explotada de kits coincide con sus componentes.
- Un producto asignado a un kit no puede estar asignado simultáneamente a otro destino.
- Cambiar la definición crea revisión; no modifica kits ya preparados.

### Criterios de salida

- Definir KIT SUCURSAL y producir 120 kits.
- Distribuir cantidades entre Palermo, Pilar, Córdoba y Mendoza.
- Detectar faltantes por componente/destino.
- Importar nuevamente la misma planilla sin duplicar destinos o demanda.

---

## Fase 13 — Picking, packing, unidades logísticas y QR

**Estado inicial:** PENDIENTE  
**Dependencias:** Fase 12 y QC de Fase 7.

### Objetivo de negocio

Preparar kits y bultos sin errores, bloqueando el despacho incompleto.

### Alcance obligatorio

- Orden/lista de picking por campaña, ola, kit o destino.
- Confirmación por escaneo o ingreso manual controlado.
- Packing por kit con checklist derivado de definición y distribución.
- Unidades logísticas: caja, bulto, pallet y relaciones de contenido.
- Numeración `Caja 2/3`, peso/dimensiones opcionales y etiquetas.
- QR tipado para OT, lote, kit, caja y pallet.
- Resolver QR a una vista segura y contextual.
- Estados: pendiente, preparando, incompleto, completo, cerrado, despachado.
- Gate backend que impide despachar contenido incompleto, sin QC o no asignado.
- Reapertura/ajuste con auditoría.
- Inventario de producción terminada y movimientos a área de packing/despacho.

### Invariantes

- Una unidad física no puede estar en dos cajas.
- Cerrar una caja congela contenido; modificar exige reapertura auditada.
- “Completo” se deriva de requeridos vs. confirmados.

### Criterios de salida

- Mostrar KIT #034 incompleto por falta de banner.
- Escanear el banner, completar el kit y habilitar despacho.
- Generar y leer QR de kit/caja/pallet con contenido y destino correctos.
- Impedir doble asignación mediante escaneo repetido.

---

## Fase 14 — Logística multidestino y prueba de entrega

**Estado inicial:** PENDIENTE  
**Dependencias:** Fase 13.

### Objetivo de negocio

Controlar el movimiento de unidades logísticas desde despacho hasta cada destino.

### Alcance obligatorio

- Entidad Envío/Entrega con destino, contacto, ventana, transportista y costo.
- Asociación de bultos/cajas/pallets.
- Estados preparado, despachado, en tránsito, entregado, incidencia/devolución.
- Tracking/código del transportista y eventos.
- Remito/documentos y comprobante de entrega.
- Entrega parcial y múltiples envíos al mismo destino.
- POD: receptor, fecha, firma/foto/archivo y observaciones.
- Link público o portal mínimo de seguimiento sin datos internos.
- Conciliación de bultos enviados/recibidos y gestión de faltantes/daños.
- Cargos logísticos y rentabilidad por campaña/destino.

### Invariantes

- Sólo unidades cerradas/completas pueden despacharse.
- Entregar requiere evidencia mínima configurable.
- Un bulto no puede estar en dos envíos activos.

### Criterios de salida

- Preparar, despachar, seguir y entregar parcialmente a múltiples destinos.
- Adjuntar remito/POD y resolver una incidencia de faltante.
- Ver costo logístico consolidado por campaña.

---

## Fase 15 — Órdenes de instalación en campo

**Estado inicial:** PENDIENTE  
**Dependencias:** Fases 11, 12 y 14.

### Objetivo de negocio

Planificar y certificar instalaciones por local como último tramo de la campaña.

### Alcance obligatorio

- Orden de instalación vinculada a campaña/destino/envío.
- Fecha/ventana, cuadrilla/instalador, skills y responsable.
- Materiales/bultos requeridos y confirmación de disponibilidad.
- Checklist versionado por tipo de instalación.
- Estados programada, en camino, en ejecución, pausada, completada, observada/cancelada.
- Fotos antes/durante/después, firma y conformidad del cliente.
- Incidencias y retrabajo/segunda visita.
- Tiempo y costo real de cuadrilla, viáticos y cargos.
- Agenda/mapa cuando aporte valor, sin convertir esta fase en un TMS completo.
- Cierre de destino/campaña condicionado según configuración.

### Criterios de salida

- Programar Carrefour Pilar con Equipo #2, materiales y checklist.
- Confirmar llegada de todos los bultos antes de iniciar.
- Cerrar con fotos y firma, o generar una revisita por incidencia.
- Reflejar costo y estado en campaña.

---

## Fase 16 — Consolidación, rentabilidad, rollout y endurecimiento

**Estado inicial:** PENDIENTE  
**Dependencias:** todas las anteriores.

### Objetivo de negocio

Convertir el conjunto de módulos en un producto operable, medible y desplegable sin depender de conocimiento tribal.

### Alcance obligatorio

- Dashboard final de campaña por diseño, producción, materiales, calidad, packing, despacho e instalación.
- Rentabilidad consolidada planificada vs. real, incluyendo reproceso, compras, terceros, logística e instalación.
- KPIs de yield, scrap, OTIF, precisión ETA, costo de calidad, utilización y cumplimiento por destino.
- Configuración de capacidades/módulos por tenant.
- Onboarding y plantillas shopper/POP.
- Roles y permisos revisados end-to-end.
- Performance sobre campañas grandes, cientos de destinos y miles de lotes/unidades.
- Observabilidad, jobs reintentables, alertas y reconciliaciones.
- Exportaciones/auditoría.
- Pruebas de migración, rollback operativo y recuperación.
- Piloto controlado con datos reales de Visual Ilusión.
- Correcciones del piloto y aceptación formal.
- Revisión final del 100% de la matriz de trazabilidad.

### Criterios de salida

- Ejecutar una campaña real o gemelo representativo desde brief hasta entrega/instalación.
- No tener capacidades del plan sin estado/evidencia.
- Regresión completa aprobada.
- Backup/restore ensayado sobre la versión final.
- Decisión explícita y separada para integrar en `main`.

---

## 8. Dependencias entre fases

```text
F0 Gobierno
 └─ F1 Campañas
     ├─ F2 Arte y aprobaciones
     │   └─ F2.5 Tiempo real/notificaciones
     │       └─ F3 Recetas/BOM
     │           └─ F4 DAG y gates
     │               ├─ F5 Nesting/corte
     │               └─ F6 Lotes/parcialidad
     │                   ├─ F7 Calidad/reproceso
     │                   ├─ F8 Variantes
     │                   └─ F9 Reservas/inventario
     │                       └─ F10 Compras/tercerización
     └─────────────────────────┐
F4 + F6 + F9 + F10 ───────────┴─ F11 Planificación
F1 + F6 + F8 + F9 ────────────── F12 Kits/destinos
F7 + F12 ──────────────────────── F13 Picking/packing/QR
F13 ───────────────────────────── F14 Logística
F11 + F12 + F14 ───────────────── F15 Instalaciones
Todas ─────────────────────────── F16 Consolidación/rollout
```

La numeración expresa el orden recomendado, no prohíbe investigación paralela. No se debe implementar una fase dependiente sobre contratos todavía inestables.

---

## 9. Matriz de trazabilidad del informe funcional

Esta tabla es el control maestro contra pérdida de alcance.

| Req. | Capacidad                                                              | Fase primaria | Fases relacionadas | Estado inicial                                               |
| ---: | ---------------------------------------------------------------------- | ------------- | ------------------ | ------------------------------------------------------------ |
|    1 | No cambiar el corazón de Grafo                                         | Todas         | F0, F16            | Gobernado                                                    |
|    2 | Proyecto/Campaña                                                       | F1            | F16                | Implementado; consolidación en F16                           |
|    3 | Múltiples órdenes y ampliaciones                                       | F1            | F12                | Implementado; se extiende en F12                             |
|    4 | BOM/receta avanzada                                                    | F3            | F4, F9             | Implementada y validada en F3                                |
|    5 | Rutas dinámicas/condicionales                                          | F3–F4         | F2                 | Parcial hoy                                                  |
|    6 | Rutas paralelas y convergencia                                         | F4            | F11                | Pendiente                                                    |
|    7 | Subproductos/componentes                                               | F3–F4         | F6                 | Costeo/versionado en F3; ejecución independiente en F4       |
|    8 | Prototipos y muestras                                                  | F2            | F1                 | Implementado y validado                                      |
|    9 | Versionado de archivos                                                 | F2            | F5                 | Implementado y validado                                      |
|   10 | Aprobaciones                                                           | F2            | F4, F7, F10        | Implementado; se amplía en fases relacionadas                |
|   11 | Mesa de corte como centro                                              | F5            | F11                | Parcial hoy                                                  |
|   12 | Nesting como entidad                                                   | F5            | F9                 | Parcial hoy                                                  |
|   13 | Gestión de lotes                                                       | F6            | F13                | Pendiente                                                    |
|   14 | Producción parcial/yield                                               | F6            | F7                 | Pendiente                                                    |
|   15 | Incidencias/reprocesos                                                 | F7            | F6, F16            | Pendiente                                                    |
|   16 | Calidad/QC                                                             | F7            | F2, F13            | Pendiente                                                    |
|   17 | Variantes/matriz                                                       | F8            | F12                | Parcial hoy                                                  |
|   18 | Kits                                                                   | F12           | F13                | Pendiente                                                    |
|   19 | Distribución multidestino                                              | F12           | F14                | Pendiente                                                    |
|   20 | Packing/picking                                                        | F13           | F7, F12            | Pendiente                                                    |
|   21 | Etiquetas y QR                                                         | F13           | F6, F14            | Infraestructura parcial                                      |
|   22 | Logística                                                              | F14           | F12, F13           | Pendiente                                                    |
|   23 | Instalaciones                                                          | F15           | F11, F14           | Parcial hoy                                                  |
|   24 | Stock físico/reservado/disponible/en compra                            | F9–F10        | F11                | Parcial hoy                                                  |
|   25 | Stock comprometido y trazabilidad                                      | F9            | F6, F7             | Pendiente                                                    |
|   26 | Compras vinculadas a proyectos                                         | F10           | F1, F9             | Pendiente                                                    |
|   27 | Tercerizaciones                                                        | F10           | F3, F11            | Parcial hoy                                                  |
|   28 | Capacidad productiva                                                   | F11           | F4, F10            | Avanzado parcialmente                                        |
|   29 | Planificador visual/Gantt                                              | F11           | F1                 | Pendiente                                                    |
|   30 | Fecha objetivo hacia atrás                                             | F11           | F14, F15           | Pendiente                                                    |
|   31 | Actualización en tiempo real y notificaciones internas por usuario/rol | F2.5          | Todas, F16         | Implementado y validado; se amplía por catálogo en cada fase |

> El archivo original se cortó dentro del requerimiento 30. El requerimiento 31 se agregó el 29/08/2026 a partir de la validación real de Campañas; si se recibe más contenido del informe original, se agrega aquí antes de cerrar la fase afectada.

---

## 10. Requisitos transversales que cada fase debe revisar

Estos trabajos no forman una fase aislada; acompañan toda implementación.

### Seguridad y permisos

- permisos por lectura, gestión, supervisión y ejecución;
- separación de información económica;
- links públicos mínimos y revocables;
- logs sin tokens ni datos sensibles;
- aislamiento tenant probado.

### Auditoría e idempotencia

- actor, origen, fecha y diff/evento;
- idempotency keys para importaciones, emisiones, movimientos y operaciones reintentables;
- protección contra doble click y reintentos de red.

### Archivos

- tipos MIME verificados;
- cuota y lifecycle;
- referencias antes de borrar;
- storage local y R2 equivalentes;
- antivirus/scan cuando se habilite infraestructura.

### Dinero y costeo

- moneda y redondeos explícitos;
- separación de costo estimado, estándar y real;
- evitar doble conteo entre motor, inventario, compras y egresos;
- snapshots financieros históricos.

### Tiempo y calendarios

- zona horaria del tenant;
- fechas de negocio vs. timestamps;
- calendarios/feriados/turnos;
- estimado vs. medido con fuente explícita.

### Performance

- índices por tenant, estado, campaña, fecha y relaciones de consulta frecuente;
- paginación en históricos;
- proyecciones livianas para tableros;
- cálculos intensivos fuera del request si superan umbrales medidos.

### Tiempo real y notificaciones internas

- cada fase registra los eventos nuevos en el catálogo transversal y define destinatarios explícitos;
- las vistas operativas declaran qué eventos invalidan sus proyecciones;
- no abrir una conexión por widget: el dashboard comparte un único canal por sesión;
- la falta de conexión se muestra y degrada a polling/foco sin bloquear comandos;
- WhatsApp y la bandeja interna son canales diferentes aunque nazcan del mismo hecho de negocio.

### Accesibilidad y operación de piso

- mobile/tablet para taller, packing e instalación;
- estados visibles por texto además de color;
- scanner sin depender de foco frágil;
- confirmaciones resistentes a uso con guantes/ritmo operativo;
- degradación clara sin conexión sólo si una fase la diseña explícitamente.

### Lenguaje visual y control de calidad de interfaz

- cada fase declara qué familia visual usa: Gestión ejecutiva, Operación técnica o una combinación jerarquizada;
- Tesorería y la Orden de Trabajo son las referencias canónicas, no la apariencia por defecto de una librería de componentes;
- shadcn se limita a primitivas de comportamiento, accesibilidad y composición; el acabado visual pertenece a Grafoprint;
- los estilos específicos viven en CSS Modules y reutilizan tokens existentes antes de introducir variantes nuevas;
- desktop, tablet, mobile, estados vacíos, carga, error, permisos restringidos y alto volumen deben verificarse;
- ninguna interfaz se acepta sin comparación visual documentada contra las referencias del contrato.

### Reportes

- cada métrica debe indicar fuente y denominador;
- no mezclar planificado, comprometido, ejecutado y facturado;
- exportaciones deben respetar permisos de dinero/datos personales.

---

## 11. Estrategia de migración y compatibilidad

### Regla expand-and-contract

Para cambios transversales:

1. agregar modelos/campos nuevos opcionales;
2. escribir compatibilidad dual;
3. backfill observable e idempotente;
4. leer/probar en shadow mode cuando aplique;
5. cambiar la fuente principal;
6. retirar legacy sólo en una fase posterior y con evidencia.

### Rutas lineales

No se eliminan. Se representan como caso particular del DAG y se mantiene una batería de equivalencia.

### Inventario

El saldo actual no se reinterpreta como reservado o asignado. Las reservas empiezan en cero y nacen de eventos nuevos, salvo migración explícita revisada.

### Archivos

Los adjuntos existentes no se declaran “aprobados” automáticamente. Siguen como adjuntos legacy; el control documental se activa por entidad o flujo.

### Órdenes en vuelo

Las OTs emitidas conservan sus snapshots y ejecución actual. Adoptar DAG/lotes en una OT en vuelo debe ser una acción explícita o estar prohibido inicialmente.

---

## 12. Estrategia de validación con Visual Ilusión

El programa debe trabajar con un conjunto anonimizado de casos patrón:

1. campaña con múltiples productos y ampliación;
2. exhibidor con tres componentes paralelos y armado;
3. textil con curva talle/color;
4. producción grande en cuatro lotes;
5. incidencia con reposición;
6. faltante de material que genera compra;
7. paso tercerizado con recepción parcial;
8. kit por sucursal;
9. campaña con muchos destinos;
10. packing incompleto que bloquea despacho;
11. entrega con POD;
12. instalación con fotos y firma.

Cada fase tomará el subconjunto pertinente y agregará fixtures automatizados cuando sea posible. La Fase 16 ejecutará el journey completo.

---

## 13. Registro de decisiones maestras

| ID     | Decisión                                                                  | Estado  | Motivo                                                                                                                                               |
| ------ | ------------------------------------------------------------------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| DM-001 | Un solo Grafoprint con módulos avanzados                                  | Cerrada | El núcleo compartido es dominante; un fork duplicaría costos y bugs.                                                                                 |
| DM-002 | Campaña es contenedor opcional, no OT                                     | Cerrada | Preserva ciclos, numeración y facturación existentes.                                                                                                |
| DM-003 | Recetas y rutas se versionan/snapshotean                                  | Cerrada | Evita mutar trabajos históricos o en vuelo.                                                                                                          |
| DM-004 | DAG se incorpora de forma compatible con rutas lineales                   | Cerrada | Reduce riesgo de regresión.                                                                                                                          |
| DM-005 | Lote productivo y tanda de máquina son distintos                          | Cerrada | Representan identidades y cantidades diferentes.                                                                                                     |
| DM-006 | Kits/packing/multidestino forman vertical shopper                         | Cerrada | Reutilizan producción/inventario sin contaminar el flujo simple.                                                                                     |
| DM-007 | Planificador visual es proyección del scheduler                           | Cerrada | Evita dos fuentes de verdad.                                                                                                                         |
| DM-008 | Datos operativos centrales serán relacionales                             | Cerrada | Necesitan integridad, concurrencia, auditoría y reporting.                                                                                           |
| DM-009 | SSE + outbox durable para frescura; inbox interno separado de WhatsApp    | Cerrada | La comunicación es unidireccional, debe sobrevivir reconexiones/varias instancias y no puede mezclar permisos internos con consentimiento externo.   |
| DM-010 | La instancia hija se configura por bindings de parámetros                 | Cerrada | Combina defaults, fijos, contexto padre, fórmulas y decisiones de cotización sin duplicar configuradores ni acoplar JobContexts internos.            |
| DM-011 | Los hijos comparten sólo outputs públicos mediante un DAG de cálculo      | Cerrada | Preserva JobContexts aislados, permite dependencias entre componentes y evita convertir una dependencia de cálculo en una precedencia física.        |
| DM-012 | La incorporación vive en la relación BOM y se agrupa en un paso compuesto | Cerrada | El mismo hijo puede incorporarse de formas diferentes; fabricación e incorporación necesitan tiempos y costos separados sin perder una ruta legible. |

Las decisiones nuevas se agregan, no se reemplazan silenciosamente. Si una decisión se revoca, se conserva la fila y se añade la sucesora.

---

## 14. Registro de ejecución de fases

Esta tabla se actualizará al integrar cada fase.

| Fase | Estado            | Rama                                                 | Documento técnico                                                       | Evidencia/commit                                           | Observaciones                                                                                                       |
| ---: | ----------------- | ---------------------------------------------------- | ----------------------------------------------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
|    0 | COMPLETA          | `visual-ilusion/analisis`                            | Diagnóstico + Plan Maestro                                              | `1d50db6c`                                                 | Backup verificado; tag `restauracion-visual-ilusion-pre-plan-20260829`                                              |
|    1 | COMPLETA          | `visual-ilusion/fase-1-campanas`                     | `docs/visual-ilusion-fase-1-campanas-diseno.md`                         | `41ead4c3`, `8077992a`, `4290c512`                         | Journey, seguridad, regresión y QA visual desktop/móvil aprobados                                                   |
|    2 | COMPLETA          | `visual-ilusion/fase-2-desarrollo-aprobaciones`      | `docs/visual-ilusion-fase-2-desarrollo-aprobaciones-diseno.md`          | `bf2df97a`, `52538507`                                     | Validación técnica y funcional aprobadas; integración en rama madre habilitada                                      |
|  2.5 | COMPLETA          | `visual-ilusion/fase-2-5-tiempo-real-notificaciones` | `docs/visual-ilusion-fase-2-5-tiempo-real-notificaciones-diseno.md`     | `46316989`                                                 | Dos usuarios, audiencia, persistencia, replay, fallback, protección de edición, regresión y QA responsive aprobados |
|    3 | COMPLETA          | `visual-ilusion/fase-3-receta-bom`                   | `docs/visual-ilusion-fase-3-receta-bom-diseno.md`                       | `b68d0c79`, `2962bddd`, `29fcf613`, `91f2f155`, `5537881b` | Receta/BOM industrial, componentes recursivos, recursos, trazabilidad, regresión y QA responsive aprobados          |
|    4 | EN DESARROLLO     | `visual-ilusion/fase-4-rutas-dag`                    | `docs/visual-ilusion-fase-4-rutas-dag-diseno.md`                        | `ca5109f0`, `c7a42076`                                     | Validación abrió ampliación de configuración padre–componente antes del cierre                                      |
|  4.1 | IMPLEMENTADA      | `visual-ilusion/fase-4-rutas-dag`                    | `docs/visual-ilusion-fase-4-1-composicion-contextual-diseno.md`         | commit de implementación de Fase 4.1                       | Outputs públicos entre hijos y parámetros del oficio tercerizado; pendiente validación funcional del usuario        |
|  4.2 | IMPLEMENTADA      | `visual-ilusion/fase-4-rutas-dag`                    | `docs/visual-ilusion-fase-4-2-pasos-compuestos-incorporacion-diseno.md` | commit de Fase 4.2 + 199 suites API + 544 pruebas frontend | Pendiente validación funcional y QA visual desktop/mobile de las operaciones agrupadas en pasos compuestos          |
|    5 | PENDIENTE         | —                                                    | —                                                                       | —                                                          | —                                                                                                                   |
|    6 | PENDIENTE         | —                                                    | —                                                                       | —                                                          | —                                                                                                                   |
|    7 | PENDIENTE         | —                                                    | —                                                                       | —                                                          | —                                                                                                                   |
|    8 | PENDIENTE         | —                                                    | —                                                                       | —                                                          | —                                                                                                                   |
|    9 | PENDIENTE         | —                                                    | —                                                                       | —                                                          | —                                                                                                                   |
|   10 | PENDIENTE         | —                                                    | —                                                                       | —                                                          | —                                                                                                                   |
|   11 | PENDIENTE         | —                                                    | —                                                                       | —                                                          | —                                                                                                                   |
|   12 | PENDIENTE         | —                                                    | —                                                                       | —                                                          | —                                                                                                                   |
|   13 | PENDIENTE         | —                                                    | —                                                                       | —                                                          | —                                                                                                                   |
|   14 | PENDIENTE         | —                                                    | —                                                                       | —                                                          | —                                                                                                                   |
|   15 | PENDIENTE         | —                                                    | —                                                                       | —                                                          | —                                                                                                                   |
|   16 | PENDIENTE         | —                                                    | —                                                                       | —                                                          | —                                                                                                                   |

---

## 15. Checklist para iniciar cualquier fase

- [ ] Rama integradora actualizada y sin cambios accidentales.
- [ ] Fase anterior integrada y gate acumulado aprobado.
- [ ] Alcance de esta fase releído en este Plan Maestro.
- [ ] Familia y criterios del contrato visual asignados a cada superficie de la fase.
- [ ] Requerimientos de la matriz identificados.
- [ ] Casos reales/fixtures disponibles.
- [ ] Modelos y estados diseñados antes de migrar.
- [ ] Estrategia de compatibilidad y backfill definida.
- [ ] Permisos, auditoría e idempotencia definidos.
- [ ] Criterios de aceptación convertidos en plan de pruebas.
- [ ] Documento técnico de fase creado.

## 16. Checklist para cerrar cualquier fase

- [ ] Todo el alcance obligatorio implementado.
- [ ] Criterios de salida demostrados.
- [ ] Flujos simples sin regresiones.
- [ ] Migraciones probadas sobre copia representativa.
- [ ] Tests de tenant/permisos/idempotencia.
- [ ] Build y suites relevantes aprobadas.
- [ ] Documentación actualizada según código real.
- [ ] Pendientes reasignados explícitamente.
- [ ] Matriz y registro de ejecución actualizados.
- [ ] Integración en `visual-ilusion/analisis` verificada.
- [ ] Rama siguiente creada desde la integración correcta.

---

## 17. Condición para integrar el programa en `main`

No se integrará a `main` únicamente porque todas las ramas estén mergeadas. Se requiere:

1. cobertura completa o decisión formal sobre todos los requisitos;
2. journey end-to-end representativo aprobado;
3. regresión del producto actual aprobada;
4. seguridad, permisos y aislamiento revisados;
5. performance aceptable con volumen objetivo;
6. migración ensayada sobre copia de datos;
7. punto de restauración final y procedimiento de rollback;
8. piloto aceptado;
9. plan de rollout por tenant/capacidad;
10. aprobación explícita para fusionar a `main`.

Hasta entonces, `visual-ilusion/analisis` es la línea integradora y recuperable del programa.
