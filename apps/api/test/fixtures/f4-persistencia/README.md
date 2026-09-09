# Aceptación de persistencia de F4

Capturas del catálogo de prueba «Exhibidor · prueba de archivos y patrones», tomadas el 09/09/2026 con la misma revisión de receta para 50/100/150 unidades: 450/900/1350 piezas, 32/64/96 placas y cinco layouts.

Se conservan en JSON compartido (codec puro `common/json-compartido.ts`) y gzip para evitar versionar 70 MB de contornos repetidos. Son resultados completos, no geometría simplificada. El catálogo contiene únicamente los productos y revisiones necesarios para reproducir su materialización en un tenant efímero de `gdi_saas_test`.

La prueba sustituye la búsqueda geométrica por estas capturas; usa los servicios reales de guardado, recotización, OT, ejecución, reportes y tracking. El transporte HTTP/BullMQ y el motor real se verifican en sus suites específicas. No prueba el óptimo global ni calibra maquinaria física.

No usa la transacción exterior de rollback del soporte histórico: cada comando conserva el timeout normal de Prisma. El tenant se elimina al terminar, incluso si una expectativa falla. Las pruebas de concurrencia esperan todos los intentos antes de limpiar.
