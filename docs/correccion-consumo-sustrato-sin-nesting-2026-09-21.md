# Consumo de sustratos en cotización por medidas

## Caso reproducido

En **Acrilico impreso en UV**, con la impresión opcional desactivada y corte láser activo, 33 piezas rectangulares de 90 × 40 mm suman 0,1188 m². El paso extra de corte tenía `DIRECT_FROM_JOBCONTEXT` y su sustrato `por_unidad_productiva`. Al elegir acrílico de 8 mm (precio de placa ARS 170.000, formato 1,22 × 1,22 m), el motor interpretaba las 33 piezas como 33 m² y calculaba ARS 3.769.148,08 de material.

## Corrección compartida

En `calcularMateriales`, los slots declarados como sustratos de familias con geometría, sin nesting y con cantidad directa por unidad productiva, consumen el área de las piezas. El precio se convierte a esa misma unidad mediante el contexto de unidades del material. Los pasos normales y extras usan el mismo cálculo.

La línea corregida es **0,1188 m² × ARS 114.216,6084/m² = ARS 13.568,93**. La interfaz redondea la superficie a 0,12 m². Se requiere geometría válida para evitar cotizar material con costo cero.

Se conservan las reglas explícitas de base × factor, las fórmulas por pieza/fijas, los materiales heredados y los resultados de nesting. Con nesting se sigue cobrando según su estrategia configurada (placa completa, tramos o área); sus consumos pueden legítimamente superar la superficie neta de piezas.

## Alcance y verificación

- Reproducción completa antes/después sobre el catálogo local, sin emitir ni guardar órdenes: acrílico UV y acrílico sin impresión con corte láser.
- El barrido de configuración encontró también pasos de hilo caliente en productos de Polyfan/exhibidores; su ejecución habitual puede usar nesting. La corrección sólo interviene cuando se cumple el caso sin nesting y cantidad directa.
- **86 pruebas aprobadas en siete suites**: corte láser, CNC, troquelado digital, hilo caliente, unidades de material, cantidades mixtas, merma, herencia, cadenas de material, personalizaciones y regresiones de placas/rollos.
- TypeScript de API correcto.
- API y worker reiniciados. Verificación en la pestaña abierta del usuario: el detalle muestra **0,12 m² y ARS 13.569 de acrílico**; el total del ítem con sus condiciones comerciales es **ARS 42.712 con impuestos**. Se recalculó el ítem en construcción, sin emitir la OT.

Los snapshots históricos guardados conservan sus importes; esta corrección se aplica al cotizar o recalcular.

## Ampliación de verificación a todos los rígidos activos del catálogo local

Se ejecutó el cálculo de consumo con **27 variantes reales** de PVC espumado, corrugado plástico, Alto Impacto, MDF, Metalex, acrílico, Polyfan y la hoja ilustración para UV registrada en ese grupo. Se probaron las cuatro familias de corte (láser, CNC, troquelado digital e hilo caliente) con la misma geometría de 33 × 90 × 40 mm: **108 verificaciones correctas**. Esta matriz verifica el consumo compartido, no la compatibilidad física de cada material con cada máquina ni todas las rutas comerciales posibles.

El barrido detectó ocho variantes de Polyfan cuya placa estaba nombrada `UNIDAD`. La conversión compartida ahora reconoce su área a partir de las medidas de la plantilla `sustrato_rigido_v1`, igual que una placa. No se deduce esa relación para otros tipos de material ni sin dimensiones, y las equivalencias explícitas del usuario prevalecen. No se modificaron precios ni datos del catálogo.

La regresión de API ampliada aprobó **125 pruebas en ocho suites**, incluyendo la conversión de unidades genéricas de rígidos, sus exclusiones y la preservación de coeficientes explícitos.
