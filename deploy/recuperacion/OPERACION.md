# Operar y recuperar los backups de Grafo

## Qué protege cada pieza

- **Neon y R2**: los datos y archivos que usa Grafo diariamente.
- **Ejecutor de backups en Fly**: una aplicación separada, con una sola máquina de 512 MB, sin página pública y en otra red privada. Lee Neon/R2, cifra y copia. No puede modificar el origen ni borrar backups. El disco de 10 GB conserva el índice incremental; perderlo obliga a volver a copiar archivos, pero no impide recuperar.
- **Backblaze B2**: depósito privado independiente. Conserva las versiones cifradas con protección contra borrado durante al menos 30 días. El código de las versiones desplegadas también queda cifrado. Los objetos compartidos con copias nuevas prolongan su protección.
- **Healthchecks**: recibe una señal únicamente al completar copia y comprobante. Avisa por fallo explícito o después de 90 minutos sin señal. No recibe archivos, datos de clientes ni logs del sistema.
- **Kit en custodia del titular**: llave de descifrado, versiones de claves internas, lector B2 y firma pública para reconocer comprobantes auténticos. La llave privada de descifrado no vive en el ejecutor.

Las aplicaciones de Grafo no acceden al depósito de backups. La separación de redes/apps de Fly limita el acceso entre máquinas; no protege frente a quien controle toda la cuenta de Fly. Un atacante del ejecutor podría detener futuras copias y falsificar señales del monitor: las versiones anteriores retenidas en B2 siguen siendo la vía de recuperación. Elegir una copia anterior al incidente, no simplemente la más nueva.

## Rutina automática

El proceso copia al arrancar y luego en cada cambio de hora UTC. No acumula tareas atrasadas ni las solapa. Cada intento tiene un límite de 45 minutos. Un fallo no publica éxito. El próximo intento vuelve a ejecutarse en el horario siguiente.

El comprobante firmado se guarda en B2 y se descarga para verificarlo antes de avisar éxito. No depende de conservar un recibo en la Mac. En el arranque se usa un bloqueo del sistema operativo sobre el volumen; sólo bajo ese bloqueo se limpian restos temporales de un proceso interrumpido. No escalar el ejecutor a más de una máquina.

La política de reinicio de Fly es `always`: vuelve a arrancar si termina el proceso principal, incluso con salida normal. Esto no sustituye la alerta externa ni garantiza recuperación automática ante pérdida del volumen o de la cuenta. Referencia: [política de reinicio de Fly](https://fly.io/docs/machines/guides-examples/machine-restart-policy/).

## Custodia en el teléfono

El titular conserva cuatro notas cortas, numeradas y con una marca `FIN GRAFO N/4`: llave del respaldo, clave interna de Grafo, lector B2 y firma pública. Se deben guardar y volver a abrir las cuatro para comprobar que no fueron recortadas. La nota larga anterior resultó incompleta y no es una custodia válida. No copiar claves a chats, tickets ni Git.

Las cuatro notas permiten leer los comprobantes remotos y descifrar los respaldos sin la configuración del ejecutor. También hay una copia auxiliar cifrada del kit y un índice firmado bajo `staging/custodia/`; elegir versiones anteriores al incidente y validar con la firma pública conservada por el titular. El kit auxiliar no reemplaza esas notas ni es una llave de recuperación alternativa si se pierde la identidad privada. Al rotar accesos o claves, actualizar la custodia y repetir la comprobación.

## Si llega una alerta

1. Revisar si dice fallo o ausencia de señal. Una alerta no significa que se hayan perdido las copias anteriores.
2. Comprobar el estado de la máquina de respaldo, su disco y los últimos mensajes de ejecución. No pegar configuraciones, URLs de monitor ni claves en tickets públicos.
3. Revisar disponibilidad de Neon, R2 y B2, límites de consumo, vencimientos/permisos de sus lectores y cambios recientes de esquema o despliegue. El control exige un lector sin escritura y una base sin migraciones incompletas.
4. Corregir la causa. Ejecutar una copia con el mismo servicio y verificar el comprobante remoto. No silenciar el monitor ni enviar una señal de éxito manual para ocultar el problema.
5. Si pasó más de una hora sin copia, registrar el intervalo sin protección nueva. Evaluar si conviene detener cambios sensibles hasta recuperar la cobertura.

Si B2 rechaza operaciones por una cuota, revisar **Caps & Alerts** y la situación de facturación de esa cuenta. Registrar qué límite se alcanzó antes de cambiarlo; un código como `download_cap_exceeded` no basta para determinar el consumo concreto. Establecer el margen dentro del presupuesto aprobado y conservar las alertas. No dejar el gasto ilimitado como solución automática ni reducir la retención para liberar espacio.

Una subida puede haber terminado aunque falle la comprobación posterior: no repetir cargas en un bucle ni considerar válido ese respaldo. Después de resolver el límite, comprobar una copia nueva, sus versiones retenidas y su firma, y verificar que el monitor reciba el éxito real. En un ensayo de recuperación, prever también el consumo de **descargar** base, archivos y código. Los contadores diarios de B2 se reinician a las 00:00 GMT; esperar ese reinicio no restablece las copias omitidas. Ver [límites y alertas de B2](https://www.backblaze.com/docs/en/cloud-storage-data-caps-and-alerts).

## Cuando se despliega una versión de Grafo

Además de validar staging, actualizar la configuración privada del copiador con los commits e imágenes realmente desplegados. Archivar el código de esas revisiones mediante `git archive`, cifrarlo con el destinatario público de recuperación y guardar las referencias exactas en `artefactos`. No incluir entornos, credenciales ni archivos sin seguimiento de Git. El manifiesto protege y registra esas referencias en cada copia posterior.

Una rotación de la clave interna de Grafo o de la llave del backup exige actualizar la custodia y conservar las anteriores mientras exista alguna copia que las necesite. Al cambiar la llave del backup, volver a cifrar los artefactos del código con su nuevo destinatario; el ejecutor rechaza mezclar llaves.

## Recuperar tras una caída o un ataque

1. **Contener el incidente.** Si hubo un ataque, revocar accesos comprometidos desde un dispositivo confiable. No restaurar sobre el sistema afectado.
2. **Obtener el kit.** Usar la identidad `age`, el lector B2 y las claves internas conservadas por el titular. El copiador no tiene la llave para ayudar a descifrar.
3. **Elegir el punto.** Listar versiones de comprobantes con `comprobantes.mjs` y seleccionar una anterior al incidente. Considerar la fecha de subida que informa B2; no confiar sólo en la fecha declarada por el archivo.
4. **Verificar la raíz.** Descargar ese `fileId` y verificarlo con la firma pública del kit, nunca con una clave obtenida del mismo archivo descargado. Guardar el recibo en una carpeta privada. Configuración de referencia: `recuperar.example.json`, con lector y clave pública, sin clave privada de firma.
5. **Descifrar y comprobar.** `recuperar.mjs` descarga versiones exactas, verifica huellas y prepara base, archivos y fuentes del código. No ejecuta SQL, no extrae automáticamente archivos comprimidos ni arranca Grafo. Una firma, llave o huella incorrecta detiene la recuperación.
6. **Crear infraestructura limpia.** PostgreSQL 16, bucket privado nuevo y Redis vacío. Crear usuarios de base separados para migraciones y operación. Restaurar el dump sin propietarios/permisos del sistema anterior; recuperar archivos con las claves originales indicadas por `archivos-verificados.json`. Conservar backups anteriores.
7. **Preparar el arranque.** Usar las imágenes fijadas o reconstruir las revisiones de `fuentes-verificadas.json`. El archivo de fuentes incluye código y archivos de dependencias; reconstruir sigue requiriendo herramientas y acceso a sus registros. Cargar claves internas desde custodia, generar nuevos secretos de sesiones y accesos, revocar sesiones/dispositivos recordados anteriores. Deshabilitar correo, Meta, cobros, facturación, tareas programadas y workers.
8. **Comprobar.** Migraciones y recuentos; ingreso y MFA; aislamiento de dos empresas; lectura de archivos y una operación de negocio. Revisar subidas pendientes, purgas, generación de documentos y trabajos incompletos. Redis vacío evita reproducir automáticamente una cola anterior; los pendientes en PostgreSQL requieren revisión igualmente.
9. **Reabrir el servicio.** Ajustar dominios/DNS y verificar acceso. Reconciliar envíos, cobros y facturas con los proveedores antes de habilitarlos: no repetirlos ciegamente. Habilitar cada worker e integración de manera controlada.
10. **Recuperar la protección.** Volver a conectar los nuevos orígenes al copiador, hacer una copia completa y comprobar sus avisos. Registrar pérdida real de datos y tiempo total de recuperación.

La disponibilidad de DNS, cuentas y proveedores alternativos forma parte de la operación de recuperación. Los ensayos locales no garantizan que una migración a otra nube tenga el mismo tiempo.

Si hubo exposición de secretos, recuperar la misma clave no elimina el acceso del atacante. Revocar y emitir de nuevo los accesos afectados (proveedores, sesiones, integraciones y firma de comprobantes). Si se expusieron los secretos de MFA, exigir su nueva inscripción; volver a cifrar un secreto ya conocido no lo vuelve seguro. Conservar las claves antiguas necesarias sólo para leer los backups históricos y migrar los datos recuperados a claves nuevas antes de reabrir. Si se expuso la identidad privada del respaldo, las copias antiguas cifradas con ella ya no recuperan confidencialidad mediante una rotación: contener también el acceso a esas copias y crear una nueva generación de respaldos. Definir el alcance según evidencia del incidente, sin reactivar automáticamente las credenciales restauradas.

## Retención, costos y mantenimiento

Los 30 días son un **mínimo protegido**, no una orden de borrado al día 31. No hay limpieza remota automática: un archivo antiguo puede seguir siendo necesario para copias nuevas. El copiador tampoco tiene permiso para borrarlo.

Cada mes, revisar volumen de versiones, consumo facturado, avisos y hacer un ensayo aislado de recuperación. Para retirar copias viejas, primero validar todos los manifiestos que se conservarán y sus referencias; elaborar un listado por versión exacta, comprobar retenciones vencidas y revisarlo antes de conceder un acceso temporal de borrado. Nunca aplicar una regla genérica «borrar archivos de más de 30 días».

Con el conjunto pequeño medido el 30/09/2026, cada base cifrada ocupó aproximadamente 1 MB: 720 copias sumarían 0,73 GB, más archivos modificados, manifiestos y código. Ese ejemplo no limita el costo de una base en crecimiento. El presupuesto acordado para backups es de USD 15–25 mensuales como estimación; no es un tope automático. Revisar tamaños y consumo antes de ampliar recursos.

## Qué está probado y qué no

Ver el registro vigente de `deploy/staging/VALIDACION.md`. El ensayo del 30/09 comprobó recuperación de datos, MFA, consultas, alta de cliente, denegación entre empresas y 13 archivos a través del almacenamiento aislado. Se probó un adjunto de cliente por su ruta autenticada. Los adjuntos de Inbox se verificaron desde el almacenamiento recuperado; no se renovó el canal externo de Meta para probar su pantalla.

No equivale a un ensayo completo de pérdida simultánea de todos los proveedores, interfaz web y workers en una nube sustituta. Tampoco se ensayó recuperar la nota del teléfono tras perder ese teléfono: la custodia en ese dispositivo fue la elección del titular.

Referencias: [precios de Fly](https://docs.fly.io/about/pricing/), [monitor Healthchecks](https://healthchecks.io/docs/), [protección de B2](https://www.backblaze.com/docs/cloud-storage-object-lock).
