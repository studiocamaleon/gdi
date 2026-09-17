# Changelog

## 1.0.1

- Conecta piezas alojadas por OpenNest en huecos de otras piezas, conservando
  identidades y roles de los contornos originales. El árbol externo incorpora
  anclajes en huecos y se expande sobre las conexiones internas existentes.
- Mantiene validaciones de cruces, material y límites, además del recorrido
  único de cada contorno y el retorno de cada puente.
- Agrega regresiones para piezas anidadas, anidación en dos niveles y las dos
  placas reales del Puma de 200 cm (incluida la R dentro del círculo).

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
