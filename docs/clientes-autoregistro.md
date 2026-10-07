# Solicitudes públicas de alta de clientes

Rama `codex/clientes-autoregistro`, dependiente de la base de aplicación y permisos del PR #27 (`codex/ot-facturacion-flujos-archivos`). Mantener el PR separado de las correcciones de precios, notificaciones y operadores. Reorientarlo a `main` cuando se integre la base.

## Recorrido

En **CRM → Clientes → Solicitudes de alta**, una persona con `crm.aprobar_altas` habilita y copia el enlace propio de su empresa. Se puede desactivar o renovar; las solicitudes anteriores se conservan. El administrador predefinido recibe este permiso mediante la migración; los demás roles deben recibirlo explícitamente. El permiso incluye lectura de clientes para comparar fichas, pero no edición general.

El formulario público `/alta-cliente/<token>` está preparado para datos fiscales de Argentina. Pide nombre completo o razón social, DNI o CUIT/CUIL, condición frente al IVA, teléfono con código de área, calle y altura, y localidad. DNI se admite para Consumidor final; las demás condiciones requieren CUIT/CUIL con verificador válido. El teléfono se valida y normaliza internacionalmente. No pide contraseña, contactos adicionales ni datos de cuenta corriente, y no concede consentimiento de WhatsApp por defecto.

Enviar crea una **solicitud pendiente**, nunca un cliente ni un acceso. La condición fiscal y el domicilio son declarados por el solicitante: esta versión no consulta ARCA ni afirma que esos datos estén verificados. El equipo puede aprobar, rechazar con un motivo interno o vincular a un cliente coincidente. Vincular no reemplaza su ficha. La resolución conserva actor, fecha, decisión y referencia al cliente, incluso si más adelante se borra al usuario o al cliente.

## Duplicados y protección

- El documento se normaliza. Los CUIT/CUIL personales se comparan también por DNI; un documento existente impide crear otra ficha. Las fichas inhabilitadas también se consideran.
- Nombre y teléfono coincidentes exigen revisión explícita. Un teléfono compartido no prohíbe registrar a otra persona. La restricción existente de nombre único del catálogo sigue vigente.
- Los envíos repetidos de un documento pendiente no reemplazan los datos recibidos. La respuesta pública no revela si el cliente existe.
- La aprobación vuelve a comprobar coincidencias dentro de la transacción; resoluciones concurrentes no crean dos clientes. Los índices únicos existentes de clientes son la última defensa ante altas simultáneas de otros recorridos.
- Token aleatorio de 192 bits; autorización por tipo, caducidad, revocación y capacidad del plan. Sin identificador de tenant tomado del formulario.
- Máximo 10 envíos por minuto por IP mediante el limitador compartido de la API; máximo 100 solicitudes nuevas por empresa en 24 horas, contando también las resueltas. Campo trampa adicional. No hay correo automático ni llamadas públicas a ARCA.
- La API exige el permiso para listar, ver, resolver y administrar enlaces. La interfaz confirma ese permiso antes de consultar datos. La ruta pública no abre rutas privadas con prefijos similares.

## Comprobación local

Migración aditiva `20261007210000_clientes_autoregistro`, aplicada únicamente a la base local de pruebas. Sin seed ni cambios sobre datos de usuarios. Probar antes del despliegue la habilitación del permiso en roles existentes y aplicar la migración antes de iniciar la versión nueva.

Pruebas HTTP con PostgreSQL y guards reales: campos fiscales, duplicados, coincidencias cruzadas DNI/CUIT, rechazo, vinculación sin sobreescritura, auditoría, concurrencia, aislamiento entre empresas, permisos, rotación/revocación y límite diario. Pruebas web del formulario, permiso de página y rutas públicas.

Resultado: 21 pruebas HTTP del recorrido, 32 de permisos y 48 de web aprobadas. Tipos completos de API y focalizados de los archivos web aprobados. Comprobación visual del formulario a 390 px y de la bandeja: envío, aprobación y actor/fecha visibles, sin desbordamiento horizontal. Los servidores y datos ficticios temporales se retiraron después de la prueba. No se desplegó staging ni producción.
