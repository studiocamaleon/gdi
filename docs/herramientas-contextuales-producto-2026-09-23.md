# Herramientas contextuales y pestaña Nesting

## Organización de la ficha

- La pestaña **Nesting** reemplaza a Herramientas y contiene la preparación de nestings guardados que antes estaba en Comercial.
- Se mantiene la ruta preferida (o la primera si no existe preferida), las cantidades preparadas y la reutilización de resultados existente.
- Los enlaces antiguos con `tab=herramientas` abren Nesting.
- Los indicadores antiguos de herramientas dentro de `atributosComercialesJson` se conservan como datos históricos, pero ya no habilitan funciones. No se requiere migración de la base.

## Importar medidas desde PDF

Se ofrece al cotizar un producto simple con ancho y alto libres o mixtos, en modalidad de medidas rectangulares y con una ruta ejecutable activa. Aplica, por ejemplo, a planos, lonas, vinilos o piezas rectangulares de materiales rígidos.

No se ofrece en productos de medida fija, productos compuestos, ingreso vectorial ni estimación por placas. Se excluyen rutas con páginas como multiplicador, imposición de caballete, abrochado de caballete o encuadernado anillado: las páginas de esos documentos no representan piezas independientes.

Se pueden elegir archivos con el botón o arrastrar uno o varios PDF sobre toda la tarjeta de medidas. La zona se resalta durante el arrastre. Ambos ingresos usan la misma revisión y validación de archivos, y un archivo inválido no descarta los válidos del lote.

La importación lee el tamaño de cada página, no los dibujos ni los contornos. Antes de incorporar datos permite seleccionar páginas y aplicar una escala positiva común. Cada página confirmada genera una pieza con cantidad inicial 1, conserva sus medidas originales y referencia al archivo. Se adjuntan únicamente los archivos con páginas confirmadas. Cancelar no agrega piezas ni archivos; también descarta resultados de lectura que lleguen después de cerrar.

## Editor de sello

Se decide por los materiales de la ruta y sus pasos activos, sin depender del nombre del producto o de su categoría comercial.

- Material: cuerpo automático/manual identificado por plantilla o subfamilia; alternativamente, goma laserable para sellos.
- Fabricación: grabado láser, o preparación de arte (preprensa/diseño gráfico) más trabajo manual/ensamble. Esta segunda combinación conserva las rutas de sellos existentes.
- Un cuerpo requiere ancho y alto del polímero y cantidad de líneas de texto. Si faltan, se explica qué completar en su variante.
- En goma suelta se usa la medida final de la pieza, nunca el tamaño de la placa de materia prima. Las líneas de texto se pueden ajustar entre 1 y 30.
- Si hay cuerpos con áreas distintas o más de una medida final para la goma, se solicita separar los diseños en ítems.
- La reventa de cuerpos, tintas o almohadillas sin fabricación no habilita el editor.

Las selecciones del comercial y los pasos opcionales activos se respetan al resolver el contexto. Los diseños ya guardados mantienen su formato de persistencia y archivos de producción.

## Verificación

- Pruebas unitarias de capacidades, materiales de sello, exclusiones y rutas activas.
- Pruebas de importación: selección, escala, cancelación, archivos inválidos y lectura tardía.
- Integración en el sheet: PDF según modalidad, editor de sello según ruta y conservación del flujo de geometría.
- Revisión en navegador autenticado: Nesting separado de Comercial; editor Trodat 3912; PDF de dos páginas, importando únicamente la primera con escala 10 y comprobando una pieza de 100 × 200 cm.
