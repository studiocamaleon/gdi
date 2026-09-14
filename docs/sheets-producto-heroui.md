# Sheets de producto · Comparación HeroUI

**12/09/2026 · H1 y H2 pendientes de elección.** Laboratorio exclusivo de
desarrollo: `/dev/diseno/sheets`. Las dos propuestas comparten controles y datos
ficticios; ninguna sustituye todavía el configurador operativo.

## Las dos propuestas

| Propuesta | Composición | Comportamiento |
| --- | --- | --- |
| H1 · Continuo | Panel de 720 px, bloques sobre fondo neutro | Configuración, opcionales, producción, archivos y desglose en un recorrido vertical; cabecera y pie fijos |
| H2 · Por secciones | Panel de 1.040 px, pestañas T2 y resumen lateral | Configuración, producción y archivos se navegan por separado; el resumen permanece visible |

En móvil ambas ocupan la pantalla. H2 coloca el resumen después del contenido.
El pie permanece accesible y sólo se desplaza el área de trabajo. El comparador
H1/H2 conserva los valores del producto; también se conservan al volver al
catálogo durante la sesión. Recargar descarta todos los datos de muestra.

Se reutilizan `ActionButton` C/S2, `NavigationTabList` T2 y `SegmentedControl` G4.
El contenedor usa [Drawer de HeroUI 3](https://heroui.com/en/docs/react/components/drawer),
con foco modal, cierre por teclado y bloqueo del scroll exterior. Los campos
usan Input, NumberField, Select, Checkbox, TextArea y Accordion de HeroUI.
El alcance visual y el tema atraviesan los portales del Drawer y de los Select.
El foco de campos usa el borde interior único aprobado.

## Cobertura relevada

El inventario se tomó de `agregar-producto-sheet.tsx`, `centro-copiado-sheet.tsx`,
`sello-editor-sheet.tsx`, `brief-diseno-form.tsx` y los contratos de producto.
No se reduce al buscador del catálogo.

| Caso | Elementos representados |
| --- | --- |
| Tarjetas personales | Cantidad, formato, papel y gramaje, color, caras y terminaciones |
| Lona impresa | Material en rollo, calidad, lista repetible de piezas, ancho/alto/unidades, superficie, instalación |
| Letras en acrílico | Material, espesor, color, complejidad, archivo vectorial, asignación de capas y esquema desplegable de corte |
| Exhibidor compuesto | Ancho/alto/profundidad, componentes, archivos heredados y armado |
| Folletos tercerizados | Proveedor, formato, tirada, plazo, matriz/costo manual y aviso de mínimo |
| Tazas personalizadas | Modelo, color, técnica, área de impresión y nombres variables |
| Sello automático | Cuerpo, tinta, texto, tipografía y vista previa tipográfica |
| Diseño de identidad | Horas, objetivo, público, alcance, entregables, revisiones y referencias |
| Centro de copiado | Documentos repetibles, páginas, copias, papel, faz, color, agrupación/nombre de tomo y tipo de anillo |
| Talonarios | Formato, originales/copias, hojas, numeración y terminaciones |
| Letras corpóreas | Texto, volumen, tecnología, iluminación, componentes y montaje |

Todos incluyen entrega, prioridad, notas, ruta alternativa, equipo/proveedor,
perfil, tiempo manual y un desglose de costos ilustrativo. Los archivos tienen
estados, etiquetas, agregado y eliminación de muestras. El buscador incluye
familias, búsqueda sin distinción de tildes y estado sin resultados.

El control «Estado del cálculo» permite ver precio disponible, calculando,
datos pendientes y error recuperable. Los tres últimos bloquean agregar.
Agregar sólo actualiza una orden de muestra en memoria; no llama APIs.

## Límites de la muestra

Las cantidades y los opcionales cambian un precio ilustrativo, expresamente
identificado. Los materiales, piezas, documentos y parámetros técnicos permiten
comparar su presentación e interacción, pero **no ejecutan cotización, nesting,
lectura de PDFs, persistencia ni edición 3D real**. Las vistas de corte y sello
son representaciones visuales del espacio que ocuparán las herramientas reales.

En la migración elegida se conservarán los motores y contratos actuales,
validaciones condicionales, dependencias entre opcionales, permisos de costos,
archivos reales, canales de error y guardado. La muestra no define nuevas reglas
comerciales ni reemplaza esos contratos.

## Separación y corrección de compatibilidad

- `product-sheet-fixtures.ts`: casos y estado local ilustrativo.
- `product-sheet-fields.tsx`: controles y contenido de cada caso.
- `product-sheet-preview.tsx`: comparador, catálogo y composición H1/H2.
- `product-sheet-preview.module.css`: sólo estilos de las dos muestras.
- La página es Server Component y devuelve 404 fuera de desarrollo.

La rotura del sheet heredado provenía de perder el ancestro `.ot-v1` al migrar
la raíz de la ficha. `AgregarProductoSheet` ahora incluye su propio contenedor
`.ot-v1`, que reactiva los selectores existentes sólo en ese configurador. No
se devolvió esa clase a la raíz de OT ni se añadieron reglas a `globals.css`.
Es un puente de compatibilidad hasta migrar el sheet elegido; al hacerlo se
retirarán sus selectores cuando no queden consumidores.

Una vez elegida H1 o H2, promover el contenedor y los campos necesarios fuera de
`preview/`, conservar el controlador comercial y migrar cada familia con su
validación. Retirar CSS heredado por componente, sin crear otro archivo global.

## Verificación

TypeScript y lint focal pasan; 9 pruebas de cantidades comerciales y aislamiento
CSS pasan. `css:guard` conserva 40.456 líneas y 1.311 clases globales.
Verificado en navegador: recuperación del sheet operativo (panel de 720 px),
H1/H2, selección por teclado, conservación de opcionales al alternar, selectores
portaleados, error recuperable con confirmación bloqueada, archivos de muestra y
agrupación de tomos. En oscuro y 390 px, el diálogo no desborda horizontalmente
y el pie permanece visible.
