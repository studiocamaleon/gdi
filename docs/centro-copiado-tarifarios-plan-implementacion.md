# Centro de copiado: implementación de oferta y tarifarios

Estado: implementación local en curso. Base funcional:
[decisiones D01–D38](centro-copiado-oferta-tarifarios-decisiones.md).
Rama: `codex/centro-copiado-tarifarios`, desde `origin/main` actualizado,
incorporando la rama documental por avance directo. Sin despliegues.

## Diseño técnico

El motor conserva geometría, materiales, tiempos, costos e impuestos. Una capa
comercial de Centro de copiado resuelve la oferta y el precio de impresión del
pedido completo, antes de componer sus renglones. Los adicionales conservan su
cálculo y se agregan una sola vez. Todos los recorridos deben consumir ese mismo
resultado: cotizar, construir, guardar, editar, recotizar y emitir.

La oferta se identifica por papel/gramaje y tamaño en hojas, y material/ancho
de rollo en CAD. Primero se incorpora la restricción opcional por gramaje a la
configuración actual. Ausente conserva la selección general existente;
presente expresa una lista explícita de formatos. Una lista vacía ofrece cero
formatos. El selector y el servidor cruzan oferta y posibilidad productiva.
El JSON existente permite esta ampliación sin migrar ni borrar datos.

Los tarifarios requerirán identidades estables y revisiones separadas: borrador
editable con versión optimista, y publicaciones inmutables con vigencia. Cada
publicación incluye reglas y celdas; una cotización guarda la versión usada y
el desglose. Canales referencian una política general heredada o una excepción.
La activación explícita es independiente de guardar o simular un borrador.

El cálculo comercial trabajará con cantidades decimales controladas y cantidades
físicas independientes. Orden: resolver política/oferta → clasificar caras y
cobertura → acumular → buscar tramo → redondear ML → resolver precio/acuerdo →
ajustes autorizados → preparación y mínimo únicos → terminaciones → control
de margen. Un precio pendiente conserva su estado hasta resolverlo.

La simulación reutilizará los adaptadores y el motor para todas las celdas;
guardará cantidad, configuración productiva y errores. No publicará precios.
Pouch reutilizará su familia del motor con un modo individual explícito, material
compatible y selección persistida por segmento.

## Bloques y validación

| Bloque | Resultado verificable | Estado |
| --- | --- | --- |
| Oferta por papel y gramaje | Configurar formatos, conservar selecciones al guardar y rechazar combinaciones no ofrecidas en la API. | Implementado y probado localmente con servicios simulados; prueba de entorno y CI pendientes |
| Cálculo comercial | Casos de D09–D25 y D27–D35, agrupación del pedido, sin repetir mínimos/preparación. | Pendiente |
| Tarifarios y canales | Persistencia, edición, versiones, activación y herencia con aislamiento por tenant. | Pendiente |
| Recorridos del pedido | Vista previa, guardado, recálculo y emisión comparten cantidades, versiones y precios. | Pendiente |
| Pouch y tomos | Material por hoja, caras/copias/juegos correctos, edición y adicionales sin duplicación. | Pendiente |
| Herramientas de precios | Matriz, pegado, duplicación, ajustes masivos y simulación de todas las celdas. | Pendiente |
| Validación del conjunto | Empresas sin activar, permisos, históricos y casos funcionales; después CI y staging autorizado. | Pendiente |

Las pruebas usan datos ficticios. Las suites que necesitan PostgreSQL se
ejecutan sólo en una base local de test. No usar seeds ni resets sobre local con
datos; no compilar contenedores o web de producción en esta Mac.

## Registro de verificación

### 10 de octubre de 2026 — oferta por papel y gramaje

- En Configuración → Centro de copiado → Oferta, cada papel permite heredar
  formatos generales o elegirlos por gramaje. Sólo se muestran formatos que
  pueden producir las variantes activas de ese gramaje. Un gramaje puede quedar
  sin formatos ofrecidos. Las restricciones generales se aplican además de las
  particulares, y desactivar un formato general conserva la selección particular.
- La selección se guarda en `papelesJson`, se recupera al editar y viaja en las
  opciones del cotizador. Elegir todos los papeles no descarta sus restricciones.
  No requiere migraciones, seeds ni cambios de precios.
- El servidor valida pertenencia del papel, gramajes, formatos y duplicados al
  configurar, y rechaza combinaciones no ofrecidas al cotizar o construir un
  pedido. Omitir gramaje con varios gramajes disponibles no permite eludir la
  oferta explícita. Una lista general de tamaños vacía ya no se interpreta como
  “todos”. La oferta heredada sin restricciones nuevas conserva su funcionamiento.
- La prueba rápida busca una combinación ofrecida de papel, gramaje y tamaño;
  exige guardar cambios antes de probar para evitar usar dos configuraciones.
- Pruebas API: 22 casos en oferta, adaptador, dominio y módulo. Las nuevas pruebas
  cubren el contrato anidado, validación operativa, actualización y lectura con
  Prisma simulado, y rechazo de material ajeno antes de escribir.
- Pruebas web: 27 casos entre API cliente, configuración y cotizador. Incluyen
  guardar y recuperar la oferta con los controles reales, volver a heredar,
  gramajes sin formatos, formatos globales deshabilitados y permiso de gestión.
- ESLint de los archivos web modificados y revisión del diff sin errores.
  Revisión de tipos limitada a los archivos modificados; la comprobación global
  se interrumpió por el costo de recursos locales y queda para CI.
- Pendiente: prueba con PostgreSQL y recorrido visual en un entorno de aplicación,
  CI y apertura del PR. No se desplegó staging ni producción. No están
  implementados aún las matrices comerciales, sus versiones/canales, pouch ni la
  simulación masiva de costos; conservan el alcance inicial del documento funcional.

Para comprobar el bloque en un entorno de aplicación: habilitar A3 para un papel
de 80 g y sólo A4 para el mismo papel de 150 g, guardar y volver a abrir. Confirmar
que el cotizador sólo ofrece los formatos elegidos por gramaje y rechaza un pedido
A3/150 g enviado directamente a la API. Usar materiales y empresa ficticios.

Una prueba de este bloque no acredita la integración del módulo completo. El
siguiente bloque es el cálculo comercial puro con cantidades físicas separadas,
acumulación, última hoja impar y tramos; después se conecta a las versiones de
tarifarios y a todos los recorridos del pedido.
