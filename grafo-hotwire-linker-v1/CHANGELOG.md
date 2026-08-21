# Changelog

## 1.0.0

- Postprocesador calibrado con `andina.tap` real de VectorLinker.
- Encabezado exacto, `Z.24`, `F350`, seis decimales y CRLF.
- Eliminación de `M30` y comentarios del TAP.
- Origen de máquina inferior izquierdo.
- Transformación SVG Y-down → máquina Y-up.
- Área útil configurada en 1250 × 600 mm.
- Estrategia automática de origen basada en bounding box con entrada de 8 mm.
- Una sola conexión al origen.
- Validación de límites, coordenadas negativas y cierre en X0 Y0.
- Evitación de cruces entre uniones exteriores e interiores.
- API `generateHotwireJob()` reutilizable desde Grafo.
- Analizador de TAP.
- Reporte, ruta JSON y simulador HTML.
- Pruebas de integración con el SVG del Puma y el TAP de referencia.
