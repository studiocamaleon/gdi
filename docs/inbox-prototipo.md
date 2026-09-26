# Inbox de Grafo: prototipo de diseño

Esta versión permite recorrer el diseño antes de conectar el inbox con datos reales. Usa la identidad compartida de Grafo: grafito, fondo cálido, naranja y tipografía Geist. Se desarrolló en la rama `codex/diseno-inbox`, a partir del piloto de recepción; no lo reemplaza ni lo activa.

La primera implementación de lectura del piloto ya está desarrollada en local, en `codex/inbox-lectura`. Su alcance y validaciones están en [Inbox: primera lectura conectada](inbox-lectura-piloto.md). El prototipo de esta página sigue siendo una muestra independiente.

## Abrirlo en local

Desde la raíz de esta rama, con Node 24 y las dependencias instaladas:

```sh
node scripts/preview-inbox.mjs
```

Abrir `http://127.0.0.1:3015` para ver el inbox sin sidebar. El acceso de demostración `http://127.0.0.1:3015/abrir` abre el inbox en una pestaña nueva con un enlace `target="_blank"` y `rel="noopener noreferrer"`. Detener con Ctrl+C. Para usar otro puerto, anteponer `INBOX_PREVIEW_PORT=3016`.

El comando inicia únicamente una vista de diseño en esta Mac. No necesita API, Docker, una cuenta ni claves. Crea un proyecto temporal que reutiliza los componentes del repositorio; no carga sus archivos `.env`. No modifica la protección de acceso de la aplicación. La ruta `/dev/diseno/inbox` también existe dentro de la aplicación en desarrollo, con su acceso habitual; en producción devuelve 404. Su acceso de demostración está en `/dev/diseno/inbox/abrir`. Estas rutas están fuera del layout del dashboard; no se agregó todavía un acceso al menú operativo.

## Cómo recorrer la muestra

1. **Bandeja:** buscar por cliente o último mensaje; alternar Abiertas, Mías, Sin leer y Resueltas. La operadora ficticia es Camila.
2. **Conversación:** escribir una respuesta, agregar una nota interna y cambiar de cliente. Los borradores de respuesta y de nota se conservan por separado mientras la página siga abierta.
3. **Contexto:** abrir la orden OT-0186 y pulsar «Preparar respuesta». El texto queda para revisar antes de enviarlo. Consultar también el presupuesto y el saldo de muestra.
4. **Equipo:** cambiar el responsable, resolver y reabrir una conversación. «Mías» muestra las asignadas a Camila.
5. **Contexto por teléfono:** Alma se reconoce automáticamente. El número no registrado permite crear una ficha ficticia con su teléfono precargado. Alex muestra dos coincidencias y requiere elegir una antes de mostrar información del cliente.
6. **Casos especiales:** Bruno permite probar una plantilla en lugar de respuesta libre. El menú del chat permite simular un fallo y reintentar el mismo mensaje.
7. **Pantallas pequeñas:** la lista, el chat y el contexto se recorren en vistas separadas. El icono de persona abre la ficha del cliente. La luna alterna el tema oscuro.

«Reiniciar muestra» restaura los siete casos, incluidas las fichas y elecciones de contexto. Recargar también descarta los cambios. El inbox utiliza toda la pestaña, sin sidebar; una cabecera compacta identifica la gráfica y a la operadora.

## Qué está simulado

Todos los contactos, importes, documentos, estados, asignaciones y mensajes son ficticios y viven en la memoria del navegador. «Enviar» no contacta WhatsApp. «Preparar presupuesto» no crea un presupuesto en Grafo; el adjunto tampoco contiene un PDF real. Las plantillas son ejemplos, sin aprobación de Meta. Esta vista no verifica permisos reales ni guarda historial.

## Identificación automática del cliente

La propuesta busca el teléfono de quien escribe entre los clientes y sus contactos, exclusivamente dentro de la gráfica que recibe el mensaje:

- **Una ficha:** mostrar su contexto automáticamente, aunque el número coincida con un contacto secundario.
- **Ninguna ficha:** permitir conversar; ofrecer crear el cliente con el teléfono ya cargado. Si corresponde a un cliente existente, habrá que registrar o corregir el teléfono en esa ficha.
- **Varias fichas:** mostrar las coincidencias y pedir cuál corresponde a esa conversación. No elegir la primera ni mostrar sus órdenes o saldos antes de resolverlo.

El prototipo consulta un directorio ficticio con números internacionales ya normalizados. No consulta la API. La API ya cuenta con `WhatsappContextoService`, usado por la integración Chrome, que normaliza los números, busca en `Cliente` y `ClienteContacto`, compara el número completo y restringe la consulta por empresa y permisos. La integración Cloud deberá reutilizar o extraer esa lógica, adaptando el acceso al canal Cloud; no asumir que la ruta de Chrome sirve directamente. Los espacios o guiones no deben alterar el resultado, y nunca se debe decidir por los últimos dígitos solamente.

## Orden para convertirlo en el inbox real

1. Revisar este diseño y acordar las acciones necesarias para la primera versión.
2. Conectar lectura de conversaciones y mensajes al piloto, con aislamiento entre empresas, permisos y paginación.
3. Persistir la asignación, resolución y notas internas; asegurar que las notas nunca entren en el envío al cliente.
4. Incorporar el envío real, estados de entrega, reglas de la ventana de respuesta y plantillas del canal. Las validaciones deben ejecutarse en la API, además de la interfaz.
5. Incorporar el reconocimiento por teléfono y los casos sin coincidencia o con varias fichas; conectar presupuestos, órdenes y archivos según los permisos del integrante. Agregar al menú de Grafo el acceso que abre la ruta independiente del inbox en otra pestaña.
6. Validar un lote coherente en local, revisarlo mediante PR y desplegarlo en staging para pruebas con destinatarios autorizados.

El prototipo no requiere desplegar en staging ni modificar los PR anteriores. Su rama depende de la base del piloto: al abrir un PR habrá que elegir la base correcta para no mezclar cambios pendientes.

## Verificación de esta versión

Revisado el 25 de septiembre de 2026 en Chrome, en escritorio y a 390 × 844: temas claro y oscuro; búsqueda sin resultados; asignación; resolver/reabrir; borradores separados por contacto y tipo; respuesta desde una orden; notas; reconocimiento automático del contacto; documentos y plantilla de muestra; error y reintento sin duplicado. Sin errores ni advertencias en la consola observada. TypeScript, ESLint de los archivos nuevos y guardia de CSS pasaron. No se realizó una compilación de producción: es una entrega local de diseño.

Revisión posterior: eliminada la navegación lateral, compactada la cabecera y comprobados el acceso en nueva pestaña, reconocimiento único, alta ficticia con teléfono precargado y selección ante coincidencias múltiples. El funcionamiento sigue siendo local, sin conexiones reales ni cambios en la API.
