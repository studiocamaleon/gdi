# Frente calado con difusor acrílico

Implementado el 5 de septiembre de 2026 como tercera etapa del relevamiento de Proled. Se encuentra en **Construcción → Frente calado · Difusor acrílico**. Es la familia número 13 de Grafo3D.

## Piezas y montaje

El cuerpo y el frente calado se imprimen juntos. Una placa de acrílico entera cubre los huecos desde adentro; se introduce por la abertura posterior hasta apoyar contra el frente. El cierre se coloca después. El difusor tiene espesor y holgura de corte propios, y puede aislarse en el visor.

Se admiten las seis [bases nuevas](./bases-y-cierre-pvc.md): interior, al ras, reborde exterior, marco con fondo PVC, doble canal y PVC con traba trapezoidal. Esta última también admite los perfiles exteriores recto, biselado, curvo y angular. El paso interior se mantiene recto y el calado se limita a la región que puede cubrir el difusor. La base clásica permanece disponible sólo en las familias anteriores.

En las coordenadas de fabricación, el frente ocupa desde Z=0 hasta su espesor y el difusor comienza inmediatamente después. El visor orienta el frente hacia arriba. El despiece retira los elementos por atrás, conservando el orden de acrílico, PVC y marco cuando corresponde.

## Patrones y parámetros

| Patrón | Medida de tamaño |
|---|---|
| Círculos | Diámetro |
| Diamantes | Diagonal del rombo |
| Cuadrados | Lado |
| Hexágonos | Diámetro entre vértices opuestos |
| Oblongos | Ancho y largo total, incluidos los extremos semicirculares |
| Triángulos | Lado del triángulo equilátero |

Cada patrón permite separación mínima entre huecos, borde sin calar, margen adicional y rotación de la retícula. Las figuras no circulares también tienen rotación individual respecto de la retícula. El paso se calcula con la envolvente de la figura girada más la separación, por lo que la distancia mínima entre figuras se conserva al rotarlas. La retícula comparte un origen para todas las letras del diseño.

El borde más el margen protegen tanto el perímetro exterior como los huecos tipográficos. Se conservan sólo figuras completas dentro de esa zona y del área del difusor, dejando además 0,6 mm de cobertura de acrílico. No se generan medias figuras contra el borde. Una letra sin espacio para el patrón muestra una advertencia; si ninguna letra admite huecos, se rechaza el diseño y se deshabilita la exportación.

Los valores iniciales son círculos de 3 mm, separación de 1,5 mm, borde de 4 mm y frente de 1,2 mm. En una exportación P2 de Proled 2.431 se midieron círculos de 3 mm con paso entre centros de 4,5 mm: [registro de medición](./evidencias-proled/frente-calado-circulos.json). Esto contrasta la definición dimensional, no garantiza igualdad de fase, cantidad de figuras o geometría para cualquier configuración. Los contornos, sólidos y miniatura de Grafo3D se generan con código propio.

Los controles aplican medidas válidas tras 400 ms sin escribir; admiten coma o punto decimal y conservan la cámara. Los parámetros se guardan por estilo, en proyectos y predefiniciones. Los proyectos anteriores reciben valores por defecto para estos campos.

## Fabricación, costos e integración

- Los huecos son sustracciones reales del sólido y atraviesan sólo el frente. Se conservan al exportar STL individual o por mesa.
- El difusor se exporta a DXF/SVG con el contorno de la letra y sus huecos tipográficos, sin replicar el patrón. Se contabiliza su superficie completa de acrílico.
- El consumo de filamento usa el volumen final del cuerpo perforado. Base, marco y PVC conservan materiales y métricas separados.
- El contrato de integración usa versión 2. `design.perforation` registra cantidad de figuras, área abierta y área del frente **antes de los cortes y perforaciones auxiliares de fabricación**. Estos datos describen el patrón; los consumos se obtienen de los componentes finales.
- Para acotar el cálculo se permiten hasta 30.000 posiciones candidatas por letra y 8.000 huecos por diseño. Si se supera el límite, el editor pide aumentar tamaño/separación o dividir el diseño. Se mantiene el límite general de tiempo del worker.

## Verificación

25 pruebas específicas cubren las seis figuras, protección de bordes y huecos tipográficos, cobertura completa del acrílico, seis bases y tres perfiles en ambas direcciones, recorrido de inserción y despiece sin intersecciones, STL binario reimportado como sólido cerrado, DXF del difusor, métricas, independencia de las piezas, persistencia y rechazo de configuraciones inválidas o demasiado densas.

La suite completa pasó **329 pruebas** en 13 archivos, incluidas las nuevas construcciones sobre letras R y ABGO. En el navegador se comprobó el patrón hexagonal, edición decimal con coma sin Enter y la miniatura generada con el propio motor. La validación geométrica no sustituye una muestra física de holgura, resistencia del frente y difusión de luz con los materiales del taller.
