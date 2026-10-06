# OT: contacto, archivos y edición; perfiles estructurales

Trabajo local en `codex/ot-archivos-perfiles`, basado en `6cb80c98b` de
`codex/niveles-perfiles-maquina`. Depende del PR #25 (incluye los descuentos de
OT persistida). Esta preparación no publica staging ni producción.

## Orden de trabajo

- El detalle de la OT entrega el teléfono completo del cliente y ofrece copiarlo
  junto a su nombre, tanto en Datos como en el resumen. No requiere abrir CRM;
  conserva el permiso de lectura de la orden. Si falta el número, no hay botón.
- Descuento y cupón requieren «Editar orden». Al cancelar la edición se cierran
  los controles abiertos. El diálogo confirma y guarda el descuento mediante su
  operación específica; no recotiza los pasos de producción. Conserva los
  controles de versión, facturación y cobros. Durante la solicitud no se puede
  guardar/cancelar simultáneamente la edición general.
- «Descargar todo» crea un ZIP: en la OT incluye adjuntos de la orden y sus
  productos; en Operación diaria incluye los adjuntos del trabajo abierto.
  Usa carpetas e índices para conservar nombres repetidos. Excluye papelera,
  subidas incompletas y documentos generados por el sistema, como los listados.
- Endpoints `GET /archivos/de-orden/:id/zip` y `GET /archivos/de-item/:id/zip`:
  sesión, permisos comerciales o de tablero y empresa explícita. `?comprobar=1`
  valida acceso y tamaño antes de iniciar la descarga. ZIP secuencial desde R2 o
  disco, retransmitido por el BFF al navegador; no reúne todos los bytes en RAM.
  Límite: 500 archivos o 2 GiB. Un archivo faltante/incompleto aborta el paquete.

## Caño estructural

- Nueva unidad `BARRA`, mediante migración aditiva
  `20261006175000_unidad_barra`. Regenerar Prisma al compilar. Las fichas nuevas
  de perfil compran/guardan barras y consumen metros lineales. Para usar barras
  se exige largo comercial positivo; no se supone que todas miden seis metros.
- Las variantes exponen largo de barra (m), ancho y alto exterior (mm), espesor
  de pared (mm) y material. Los datos antiguos `20×30 mm` se interpretan en ambos
  ejes; los campos estructurados prevalecen. No se reescriben precios ni saldos
  existentes, ni se cambia automáticamente la unidad de materiales existentes.
- `estructura_bastidor` permite girar el perfil rectangular: el lado que ocupa
  el plano del marco y el que ocupa profundidad son distintos. El despiece,
  superficie de pintura y visor usan esas dimensiones. El espesor debe ser
  físicamente compatible con la sección cuando está informado.
- El despiece conserva la política de barras enteras e incluye pérdida de corte.
  Ahora expresa esas barras en la unidad de consumo configurada: 3 barras de
  6 m son 18 metros, no 3 metros. La reserva invierte correctamente la conversión
  hacia la unidad de stock. La merma adicional explícita del paso sigue su regla
  habitual posterior al despiece; no se cambia silenciosamente su porcentaje.
- El motor rechaza piezas mayores que la barra y secciones incompatibles con
  las dimensiones del bastidor. La traza separa metros de piezas, metros de barras
  y sobrantes. Los materiales que comparten la plantilla histórica, como
  anclajes, pueden conservar una descripción no rectangular.
- La biblioteca instala estas unidades sólo para nuevas variantes de caño; no se
  ejecuta el instalador ni se reemplazan variantes existentes durante la migración.

## Comprobación local

- 134 pruebas API: ZIP y permisos HTTP, confinamiento de archivos locales,
  derivadores, barras, unidades y necesidades/reservas de materiales.
- 60 pruebas web: controles de OT y edición, copia/descarga, plantillas/unidades
  y concordancia de geometría del visor con el motor.
- Migración aplicada correctamente únicamente en `gdi_saas_test`, junto con la
  migración aditiva de personal que esa base tenía pendiente. Sin seed/reset.
- Revisión visual con componentes reales y datos ficticios: descuento/cupón
  bloqueados fuera de edición, cierre del cupón al cancelar, copia del teléfono,
  botones de descarga y variante con sección/largo decimal. La página temporal se
  retiró tras la comprobación; no se guardaron fichas ni se emitieron órdenes.
- La descarga HTTP se comprobó descomprimiendo el ZIP y verificando sus bytes;
  storage e identidades fueron ficticios, sin consultar archivos de clientes.
  Pendiente el recorrido integrado en staging cuando se publique el lote.

## Acceso del taller y ficha comercial

- «Ver orden» en el detalle operativo y «Ver OT» al terminar exigen
  `comercial.ordenes.ver`. El alcance compartido del tablero no concede ese
  permiso. El listado y la ficha comprueban el permiso antes de cargar datos;
  una sesión sin permisos confirmados o una revocación devuelve la vista sin
  acceso, sin interrumpir la pantalla.
- La API de listado/detalle comercial deja de admitir sólo el permiso de
  producción. Conserva la lectura para comprobantes que usa el recorrido de
  facturación. Esto no habilita la página comercial del usuario.
- El sheet obtiene materiales, nota de producción y actividad operativa por
  `GET /ordenes-trabajo/tablero/items/:itemId/detalle`. Selecciona explícitamente
  empresa/trabajo, admite únicamente trabajos visibles en el tablero y devuelve
  un contrato cerrado sin precios, costos, snapshots, datos de cobros, tokens ni
  eventos comerciales. Los componentes fabricados pueden usar su propio
  snapshot operativo. Los adjuntos conservan su consulta y sus permisos propios.
- Se reprodujo primero el acceso indebido con una sesión ficticia y HTTP real
  (200 donde se esperaba 403). Con la corrección pasan 30 pruebas de acceso a
  módulos y separación de empresas, más 214 pruebas de permisos, ejecución y
  archivos. Pasan 16 pruebas web sobre sheet, aviso de finalización, sesión y
  URL directa; incluyen materiales/actividad/archivos y cambio entre productos.
- Tipos de los ocho archivos productivos de esta corrección sin diagnósticos y
  lint web sin errores. No requiere migración de base de datos. Comprobado en
  local; la publicación sigue pendiente junto con el resto del lote.
