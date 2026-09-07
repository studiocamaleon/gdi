# Correspondencia funcional

| Función de referencia | Forma Studio | Verificación / diferencia |
|---|---|---|
| SVG y texto | Implementada | SVG con escala, huecos y 16 fuentes locales; texto hasta 100 caracteres. |
| Visor y despiece | Implementada | Órbita, tres vistas, cuadrícula, capas, color y separación; giro libre en lugar de un botón específico de 180°. |
| 12 estilos | Implementados con geometría propia | Acceso Maker inspeccionado; cotas y secciones comparadas con STL/DXF de referencia. Ver `modelos-letramaker-premium.md` para muestras y límites. |
| Espesores y tolerancias | Implementados por familia | Paredes, base, frente, apoyos inclinados/planos, bordes, retrocesos, holguras, bandeja con retención, espejo y pestaña exterior con ancho/altura. |
| Organic | Siete perfiles implementados | Zigzag, barriga, pedestal/S, ondas, bumper, bubble y frisos; variantes de frente/fondo y fijación posterior. El barrido requiere conservar la topología de los contornos. |
| Curva | Barrido angular implementado | Ángulo, radio, centro y segmentos; base redondeada, unida o separada con encastres y holgura. |
| Neón | Pleno y contorno implementados | Fondo, paredes, ancho de canal y traba triangular continua con posición/altura/profundidad. |
| Perforaciones | Implementadas | Circular, rectángulo/oblongo, X/Y y arrastre. Las flechas de los campos sustituyen al joystick. |
| Pines | Implementados | Retroiluminación, diámetro/altura y agujero ciego. |
| Capas y revestimiento blanco | Implementados | Visibilidad, color y sólido interior separado de 0,6 mm. |
| Encastre esférico | Implementado | Parámetros, dos piezas, montaje, sección visual, inclinación, métricas y JSON; ajuste mecánico aún sin ensayo físico. |
| STL por letra / pieza | Implementado | Paquete por pieza, exportación por capa o pieza y conjunto ensamblado. |
| DXF / SVG de corte | Implementados | Milímetros; usa la holgura del modelo. No tiene un segundo offset exclusivamente para DXF. |
| Fondos PVC y plantillas LED | Implementados | PVC con tarifa y área propias; plantillas LED en el ZIP, sin imputarlas como componentes físicos. |
| Predefiniciones | Implementadas localmente | Se guardan en el navegador; sin sincronización en cuenta. |
| Corte de piezas grandes | Implementado | Planos X/Y, separación y sólidos cerrados. Sin encastre dentado automático entre secciones. |
| Mesas de impresión | Implementadas | Distribución por rectángulos y rotación 90°, STL por mesa. Sin arrastre manual de piezas. |
| Aprovechamiento de acrílico beta | Implementado como distribución rectangular | No se afirma nesting irregular; la referencia lo anuncia como función futura/beta. |
| Costos y PDF | Implementados | Tarifas editables, masa, horas, costo, precio, marca y checklist. No hay laminador. |
| Historial | Implementado localmente | Numeración y proyecto por ficha; al reabrir se recalcula con el motor vigente. |
| Ayuda | Guía propia | No se replicaron vídeos ni contenidos de proveedores de LetraMaker. |
| Idioma / tema / paneles | Español, tema claro/oscuro y panel plegable | No se implementó traducción completa a otros idiomas ni intercambio de posición de ambos paneles. |
| Cuenta, planes y pagos | Pendiente del producto comercial | No se creó una compra, suscripción ni cuenta externa. Modelo de venta consultado al usuario. |
| Integración con Grafo | Contrato versionado y diseño del adaptador | Sin conexión activa al motor; requiere catálogo y autenticación del receptor. |
| Vazado Paramétrico adicional | Relevado, sin implementar | Tarjeta adicional observada en Maker; queda fuera de las doce familias solicitadas. |
