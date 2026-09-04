# Motor de nesting irregular generalizado — Fase 4.4.3

**Estado:** IMPLEMENTADO · PENDIENTE DE VALIDACIÓN FUNCIONAL DEL USUARIO
**Frontera:** Fase 5 no se inicia hasta aprobar esta validación.

## 1. Objetivo

Convertir el nesting vectorial existente en una capacidad neutral del motor,
independiente de productos concretos, capaz de recibir varias demandas con
cantidades y propietarios distintos y de consolidar componentes compatibles.

El solver continúa siendo reemplazable y mejorable. El contrato estable es la
demanda y la solución, no la heurística utilizada internamente.

## 2. Contrato canónico

`DemandaNesting` identifica una necesidad física:

- identidad estable de demanda;
- cantidad propia;
- propietario opcional: producto, componente, ocurrencia, paso y archivo;
- geometría `RECTANGULO | POLIGONO`;
- contornos, huecos, cortes internos, área y perímetro cuando es poligonal.

`ProblemaNesting` agrega:

- superficie `PLACA | ROLLO`;
- formato físico;
- márgenes y separación;
- rotación, segmentación y configuración de encastres;
- política de preservación de la composición original.

`SolucionNesting` congela:

- problema completo y hash SHA-256;
- algoritmo y versión;
- sustratos, placements y transformaciones;
- área comprada/útil, aprovechamiento y recorrido;
- identidad de cada demanda y propietario.

La versión actual resuelve geometría irregular sobre placa. El contrato ya
admite rollo para que una futura estrategia pueda implementarlo sin cambiar a
los consumidores.

## 3. Compatibilidad con el motor anterior

- SVG continúa analizándose y normalizándose en el servidor.
- El flujo individual atraviesa ahora el contrato universal.
- Se conservan rotaciones, huecos, segmentación, encastres y composición
  original.
- La caché almacena el mismo problema y solución versionados.
- Las pruebas de paridad comparan el resultado anterior con el adaptador nuevo.

## 4. Estimación manual

Ingresar manualmente placas y metros de corte no constituye nesting. Se separa
como algoritmo `manual-vector-estimate-v1`:

- no publica placements;
- no afirma aprovechamiento geométrico;
- no participa de consolidación automática;
- conserva placas y recorrido declarados para cotizar.

## 5. Consolidación irregular dentro de un producto compuesto

Dos o más componentes se consolidan únicamente si coinciden estrictamente en:

- material y formato de placa;
- máquina, perfil y tecnología;
- familia productiva;
- márgenes, separación y rotación;
- política de segmentación y encastres;
- estrategia de costeo, merma y preparación;
- política de ejecución independiente.

El motor combina sus `DemandaNesting`, les asigna identidad namespaced por
componente/paso y ejecuta una única solución. Cada placement conserva producto,
componente, ocurrencia, paso, pieza y copia de origen.

El contrato público de cotización expone `disenoVectorialFuente` como una
herramienta compleja del producto hijo. Por eso cada componente —y cada
ocurrencia repetible— puede aportar su propio SVG y una medida final sin
crear inputs específicos para frente, dorso, manga u otro producto concreto.

### Fuentes geométricas compartidas

La geometría dejó de inferirse únicamente desde la familia productiva. El
producto declara en `atributosComercialesJson.geometriasComerciales`:

- modo aceptado: `RECTANGULAR | VECTORIAL | AMBAS`;
- una colección de fuentes nombradas y estables;
- si cada fuente es obligatoria u opcional al cotizar.

El sheet congela una sola vez los SVG recibidos bajo
`jobContext.geometriasVectoriales[fuenteId]`. La configuración BOM no copia un
archivo: el binding `disenoVectorialFuente` del hijo apunta a la ruta nombrada
del padre, por ejemplo `geometriasVectoriales.contorno_cartel`. Al ejecutar el
componente, el resolver entrega esa fuente al contrato vectorial normal del
hijo.

El SVG es la única fuente de verdad dimensional de una geometría vectorial:

- el comercial elige si define ancho o alto e ingresa sólo ese valor;
- el otro eje se calcula siempre de manera proporcional;
- la proporción se mide con los contornos fabricables del servidor, no con el
  lienzo `viewBox`, que puede contener márgenes vacíos;
- un hijo que hereda el SVG no vuelve a pedir ancho y alto;
- el resolver deriva `medidaCustomMm` desde la caja final del vector para que
  los pasos rectangulares y vectoriales del hijo compartan las mismas medidas;
- el motor vuelve a normalizar la geometría en el servidor antes de costear.

Esto cubre sin conceptos específicos por producto:

- un contorno del padre compartido por Polyfan y acrílico, con nesting y
  archivos de máquina independientes por material/proceso;
- lateral, estante, base y frente como fuentes diferentes de un exhibidor;
- dos componentes compatibles que heredan diseños distintos y se consolidan
  en un único problema de nesting;
- ocurrencias agregadas al cotizar que conservan un SVG propio cuando el
  binding usa `COTIZACION`.

Los productos anteriores siguen interpretándose como `RECTANGULAR` si no
poseen el nuevo contrato. La dimensionalidad `2D | 3D` continúa expresando qué
ejes se solicitan; no se utiliza para inferir la forma.

La solución sólo reemplaza las individuales cuando no aumenta placas ni costo.
Material y preparación se reparten por área real de los polígonos y la suma
reconcilia exactamente con el costo del lote.

## 6. Exclusiones seguras

No se reanidan automáticamente:

- composiciones que deben conservar el negativo o disposición original;
- estimaciones manuales sin geometría;
- layouts heredados de una impresión ya posicionada;
- materiales, máquinas o configuraciones con firma distinta;
- problemas que no puedan ubicar toda la demanda.

Un layout impresión→corte ya registrado conserva su posición física. Mezclarlo
exige propagar una misma solución compartida a ambos procesos; nunca se permite
que impresión y corte calculen acomodos diferentes.

Mientras esa propagación compartida no exista, el resultado rectangular de la
impresión se marca como `layoutVinculadoGeometriaVectorial` y queda excluido de
la consolidación. Es una barrera de exactitud productiva, no un fallback visual.

## 7. Validación requerida antes de Fase 5

1. Cotizar un producto vectorial individual y comparar placas, posiciones,
   aprovechamiento, perímetro y costo con el comportamiento anterior.
2. Probar huecos y rotaciones libres.
3. Probar una pieza mayor que la placa con y sin segmentación.
4. Cargar SVG y medidas distintas en dos componentes vectoriales compatibles y
   confirmar que el lote consolidado ahorre una placa.
5. Confirmar en el visor la identidad y color de cada componente.
6. Confirmar que componentes incompatibles permanezcan independientes.
7. Confirmar que “preservar composición original” no se consolide.
8. Confirmar que el modo manual se presente como estimación y no como nesting.
9. Declarar una fuente en un padre compuesto, hacer que dos hijos la hereden y
   comprobar que ambos reciben exactamente el mismo contorno y escala.
10. Declarar varias fuentes en un exhibidor y verificar que el lote consolidado
    conserva la identidad de lateral, estante, base y frente.

Sólo después de esta aprobación se habilita el comienzo de Fase 5 y la
persistencia operativa de `PlanNesting`.
