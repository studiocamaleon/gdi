# Auditoria de Dimensiones Canonicas (Materia Prima) - v1

## Objetivo
Revisar todas las dimensiones de plantillas de Materia Prima para detectar claves que representan el mismo concepto con distinto nombre y proponer canonizacion final.

## Resumen ejecutivo
1. La base ya esta bastante consistente (`ancho`, `alto`, `largo`, `espesor`, `gramaje`, `material`).
2. Solo detecte **2 ajustes recomendados** de canonizacion fuerte.
3. El resto de diferencias son semanticas reales (no conviene unificarlas porque no significan lo mismo).

## Ajustes recomendados
1. `materialBase` -> `material`
   - Plantilla: `tapa_encuadernacion_v1`
   - Motivo: representa el mismo concepto que `material` en otras plantillas.
   - Impacto: simplifica filtros globales por material.

2. `presentacion` -> `volumenPresentacion`
   - Plantilla: `quimico_acabado_v1`
   - Motivo: `presentacion` es ambiguo; el dato es numerico en `ml`.
   - Impacto: mejor legibilidad y evita colisiones futuras con "presentacion comercial".

## Ajustes ya resueltos
1. `canalColor` -> `color`
   - Plantilla: `tinta_impresion_v1`
   - Resultado: tinta y toner ahora comparten clave canónica `color`.

## Diferencias que deben mantenerse (no unificar)
1. `color` vs `colorLuz` vs `colorBase`
   - Son conceptos distintos:
   - `color`: color del insumo (tinta/toner).
   - `colorLuz`: temperatura/color de emision luminica.
   - `colorBase`: color de base del sustrato.

2. `diametro` vs `diametroInterno`
   - No son equivalentes fisicamente.

3. `tension`, `tensionEntrada`, `tensionSalida`, `tensionAislacion`
   - Son magnitudes distintas del dominio electrico.

4. `corrienteNominal`, `corrienteMax`, `corrienteMaxCanal`, `corrienteSalidaMax`, `corrienteTotalMax`
   - Son especificaciones diferentes.

5. `anchoCompatible`
   - No es `ancho` del producto, es compatibilidad.

## Estandar propuesto para futuras plantillas
1. Si el concepto es identico, usar la misma key global.
2. Si el concepto es diferente, mantener clave especifica.
3. La unidad vive en `unit`, no en el nombre de la key.
4. Evitar claves ambiguas (ejemplo: `presentacion` sin contexto).

## Prioridad de implementacion sugerida
1. Alta: `materialBase` -> `material`
2. Media: `presentacion` -> `volumenPresentacion`

