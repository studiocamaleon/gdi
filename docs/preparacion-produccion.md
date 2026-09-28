# De staging a producción de Grafo

Revisión del 28/09/2026. Este documento ordena el próximo trabajo; no significa que producción esté creada ni autorizada para recibir clientes. Llamadas y reportes de operadores quedan para otra etapa.

## Dónde estamos

La web comercial y Grafo3D ya funcionan en `grafoprint.com.ar`, en Vercel desde `main`, en modo de prelanzamiento. El sistema de trabajo funciona en **staging**, con datos de ensayo, cinco aplicaciones de Fly, Neon, Redis y R2 propios. El PR #7 del Inbox ya está integrado en `main`; el PR #8 corrige recuperación ante cortes. La versión realmente desplegada y las comprobaciones están en [VALIDACION.md](../deploy/staging/VALIDACION.md).

Staging no se convierte en producción cambiándole el nombre. Hay que crear otro entorno para que las pruebas nunca afecten el trabajo real.

## Orden de trabajo

| Paso | Qué hacemos | Cuándo está terminado |
| --- | --- | --- |
| 1. Cerrar este lote | Revisar el PR #8, sus compilaciones y la recuperación del Inbox en staging. | La versión y los resultados quedan registrados; los pendientes tienen alcance explícito. |
| 2. Revisar Grafo completo | Recorrer con una empresa ficticia usuarios/permisos, clientes, presupuesto → OT, materiales/costos, archivos y PDF. Probar colas, recuperación de trabajos y correo de invitación/recuperación. | Un registro breve distingue aprobado, fallo y no probado. Inbox correcto no acredita por sí solo estos recorridos. |
| 3. Probar recuperación de datos | Restaurar una copia de Neon en un destino aislado y comprobar sus datos, sin sobrescribir staging. Definir recuperación de archivos de R2 y de trabajos en Redis. | Sabemos qué recuperar, cuánto tarda y cuántos datos recientes podrían perderse. |
| 4. Acordar el arranque | Presentar nombres, tamaños, costos vigentes, retención y límites del entorno nuevo. Definir si se inicia con empresas invitadas y qué funciones estarán disponibles. | Lucas aprueba una propuesta concreta; el presupuesto de staging no incluye automáticamente producción. |
| 5. Crear producción privada | Base/proyecto Neon, Redis, bucket R2 y aplicaciones Fly separados, con secretos nuevos y permisos mínimos. | El entorno funciona sin datos ni credenciales de ensayo. Registro público y cobros permanecen cerrados hasta su validación. |
| 6. Desplegar la versión revisada | Aplicar migraciones una vez, sin seeds ni resets; comprobar el rol de aplicación, crear el administrador inicial y desplegar los servicios. | Salud, sesión/MFA, permisos, colas, archivos y PDF pasan en el entorno nuevo. Lucas elige la clave y el segundo factor. |
| 7. Conectar dominios y ensayar | Conectar `app.grafoprint.com.ar` y `api.grafoprint.com.ar`, con HTTPS y orígenes correctos; revisar enlaces y correo. | El recorrido real funciona con una empresa invitada. Se conserva una versión anterior para volver atrás si hace falta. |
| 8. Abrir el lanzamiento | Habilitar sólo funciones y altas comprobadas. Cuando corresponda, pasar marketing a `live` y apuntar sus botones al sistema. | Se comprueba acceso público, contratación si está habilitada y observación de errores/consumo. |

## Qué necesita su propio ajuste

- **Aplicación y API:** dominios, acceso entre servidores, cookies, orígenes admitidos, límites y alertas. No basta con quitar la protección de staging.
- **Base:** propia, migrador separado y aplicación sin permisos para cambiar tablas. Definir retención y comprobar una restauración antes de datos reales.
- **Archivos:** bucket y acceso exclusivos de producción; origen de la aplicación en CORS. Definir retención, borrado y respaldo. La durabilidad del proveedor no sustituye recuperar un borrado accidental.
- **Colas:** Redis separado, con persistencia, límites y recuperación de trabajos comprobados. Medir antes de aumentar capacidad.
- **Correo:** configurar y verificar envío de invitaciones y recuperación. La casilla de soporte operativa no equivale a tener correo transaccional en la API.
- **Pagos y facturación:** staging usa modos de prueba. Si se ofrecen cobros o facturación reales, validarlos y configurar sus credenciales por separado antes de habilitarlos.
- **Operación:** quién recibe las alertas, cómo detener altas/envíos ante un incidente, qué versión volver a desplegar y cómo conservar los datos. No revertir migraciones aplicadas a ciegas al volver al código anterior.

## El punto pendiente de WhatsApp

Ya se comprobaron con el número oficial de prueba texto, medios, entrega y trabajo entre operadores. Ese acceso temporal exige renovación y no es el mecanismo con el que deberán operar los clientes.

El alta real mediante Meta, la coexistencia y la importación de historial todavía requieren su recorrido completo con una empresa autorizada. El código actual restringe el alta a empresas de ensayo elegidas en el servidor. Debemos confirmar aprobación/permisos vigentes y comprobar ese recorrido antes de ofrecer «conectar tu número y todas tus conversaciones» como disponible.

Podemos preparar producción mientras esto se resuelve. Activar WhatsApp para clientes es un paso de lanzamiento separado; no vamos a asumir que App Review aprobado, por sí solo, completa la integración. Las confirmaciones de lectura dependen también de la privacidad del destinatario.

## Cómo promovemos una versión

Rama de trabajo → PR revisado y comprobado → staging verificado → integración autorizada en `main` → despliegue explícito de producción. Se identifica el commit y las imágenes usadas; si cambia una configuración de compilación, se verifica también la imagen final. Abrir un PR o fusionarlo no despliega Fly automáticamente. El merge sí puede reconstruir la web comercial de Vercel.

El arranque con una sola máquina por servicio puede tener interrupciones durante despliegues o fallas. La reconexión del Inbox las hace manejables; no garantiza disponibilidad continua. Si se necesita esa garantía, evaluar capacidad redundante con su costo antes de contratarla.
