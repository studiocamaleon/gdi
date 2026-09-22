# Nesting: planes y presentación en la web

## Distribución comercial

| Función | Esencial | Pro / Co-founder Pro | Avanzado / Co-founder Avanzado |
| --- | --- | --- | --- |
| Rectangular en rollos, placas y pliegos | Incluido | Incluido | Incluido |
| Irregular por contornos sobre placas | No incluido | Incluido | Incluido |

La clave `aprovechamiento_cotizacion` conserva el aprovechamiento rectangular. La nueva clave `nesting_irregular` se administra desde el editor de Plataforma y requiere la anterior. No cambia precios, usuarios, almacenamiento ni condiciones de implementación.

El motor irregular actual trabaja sobre placas. La web no promete nesting de contornos en rollos.

## Contratos y migración

- El catálogo pasa a versión 2, con 66 funciones.
- La migración `20260922165000_nesting_irregular_planes` actualiza los borradores y sus revisiones. Esencial queda sin irregular; Pro, Avanzado y sus variantes Co-founder lo incluyen cuando tienen habilitado aprovechamiento.
- Las versiones publicadas, ofertas y suscripciones existentes son inmutables. Los contratos de catálogo 1 conservan el alcance anterior: si incluían aprovechamiento, conservan irregular.
- Los contratos de catálogo 2 sólo conceden irregular cuando la función está explícitamente incluida. Su ausencia no habilita acceso.
- Founder y los planes históricos sin contrato versionado conservan compatibilidad.
- Las nuevas ofertas se publican y sincronizan en Paddle sandbox mediante los servicios habituales, con auditoría y una sesión personal vigente de administrador con MFA. Producción queda para el lanzamiento.

## Controles técnicos

- Solicitudes vectoriales explícitas, colecciones, referencias, cachés y overrides de componentes exigen irregular al cotizar.
- Los endpoints de optimización, preparaciones y admisión de trabajos exigen la función. Medición y análisis sin nesting siguen separados.
- El dispatcher del motor exige irregular antes de calcular o reutilizar contornos de una receta, incluyendo cálculos internos. Las medidas rectangulares y estimaciones manuales por placas conservan su recorrido.
- El servicio asincrónico verifica también los resultados inmediatos y cachés. El worker revalida antes de adquirir capacidad de ejecución, incluso para trabajos internos.
- La interfaz no ofrece un análisis nuevo cuando falta la función. Los diseños y resultados históricos se conservan para consulta.

## Web

Nueva sección `#nesting`, accesible como **GrafoNest** en la navegación:

1. Exhibidor POP: armado, despiece y distribución de las mismas siete piezas sobre una placa.
2. Rectángulos sobre rollo.
3. Rectángulos sobre placa.
4. Contornos irregulares sobre placa.

La animación es una ilustración identificada como tal, no una simulación del solver. Permite repetir el acomodo y respeta movimiento reducido. No muestra porcentajes de ahorro inventados. La disponibilidad de cada modo se obtiene de las ofertas publicadas, igual que la comparativa de planes.

El exhibidor es una geometría vectorial proyectada, sin vídeo ni nuevas dependencias. Incluye dos laterales, tres estantes, cabecera y frente; sus contornos y marcas se conservan al separar y acomodar las piezas. La secuencia comienza una vez al entrar en pantalla, permite pausar/continuar y seleccionar cualquier etapa, y se pausa fuera de vista. Con movimiento reducido se omite la reproducción automática y los cambios son inmediatos. Los paquetes decorativos desaparecen al desarmar y no forman parte del nesting.

Comprobadas visualmente las tres etapas, las marcas adheridas a las piezas y los controles de reproducción mediante Chrome. TypeScript y lint focalizado correctos para esta ampliación.

## Verificación

- Pruebas de permisos del catálogo, dependencia, contratos v1/v2, cachés, cálculo interno, worker y conservación del acomodo rectangular.
- Suites de geometría, dispatcher, edición, comparación, publicación, asignación, ofertas y sincronización de Paddle en la base de prueba.
- Pruebas de UI de Plataforma y acceso a herramientas de fabricación; 11 pruebas de marketing.
- Compilación de API, TypeScript de aplicación y marketing, y lint focalizado de la nueva sección.
- Interacción y composición visual de escritorio comprobadas. La comprobación adicional en móvil quedó interrumpida por el bloqueo de automatización de Chrome.

## Estado local

Migración aplicada en desarrollo y pruebas; API y worker reiniciados con los nuevos controles. La sección visual ya está disponible en `http://localhost:3003/#nesting`.

Pendiente de activar nuevas ofertas: al intentar publicar no había una sesión personal vigente de Plataforma con MFA. Se solicitó iniciar sesión para completar la publicación. Hasta entonces, la tabla comparativa y el texto de disponibilidad siguen mostrando las ofertas publicadas anteriormente; no se sobreescribe esa información con los borradores.
