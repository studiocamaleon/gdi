# Bases desmontables y cierre de PVC

Implementado el 5 de septiembre de 2026 como segunda etapa del relevamiento de Proled. Ubicación: **Acrílico encastrable / Frente impreso → Parámetros → Construcción de la base**.

## Variantes disponibles

| Variante | Construcción y parámetros propios |
|---|---|
| Base clásica | Geometría anterior, con retroceso y altura derivada o explícita. Los proyectos existentes conservan esta opción. |
| Base interior sin reborde | Suelo y pared de encastre contenidos dentro del cuerpo. |
| Base al ras | Suelo alineado con el contorno exterior; el cuerpo termina antes del suelo, dejando la holgura axial. |
| Base con reborde exterior | Suelo ampliado, pared interior y reborde exterior con altura y espesor propios. La pared del cuerpo entra entre ambos. |
| Marco con fondo de PVC | Marco impreso con pared y apoyo inferior; PVC separado, con espesor y holgura propios. Ancho de apoyo configurable. |
| Base de doble canal | Suelo, primera y segunda pared, separación, altura de segunda pared y altura del suelo del canal. |
| PVC con traba trapezoidal | Cuerpo con tope trapezoidal, fondo PVC y frente. Profundidad y altura de traba, retranqueo del fondo, espesor y holgura de PVC independientes. No lleva base impresa. |

La profundidad total mantiene el frente en Z=0 y el cierre en Z máximo. La altura de base incluye su suelo y se conserva al modificar el cuerpo. Cambiar de construcción conserva las medidas compatibles y ajusta la altura de base al intervalo de la nueva receta. Los ajustes clásicos permanecen guardados, aunque no se muestran en las nuevas variantes.

## Perfil y recorrido de montaje

El cierre trapezoidal admite exterior **recto, biselado, curvo y angular**, hacia adentro o afuera, ángulo y tramos rectos frontal/posterior. Es una implementación propia del comportamiento observado, no una copia de los STL ni una certificación de igualdad geométrica con Proled.

La cavidad interior permanece prismática. Se dimensiona con el menor contorno del perfil para conservar el espesor mínimo y el paso de las placas. Un perfil hacia adentro puede reducir el área útil de acrílico y PVC. El perfil curvo usa una transición sinusoidal; el ángulo representa su pendiente máxima. El biselado desplaza progresivamente el contorno; el angular forma dos rampas.

La traba es un **tope de apoyo**, no un clip elástico que bloquee la extracción en ambas direcciones. El PVC entra desde atrás y se detiene en su cara posterior. El acrílico se recorta para atravesar también la sección más estrecha de la traba y llegar al labio frontal. Los apoyos deben superar las holguras de corte, aplicadas por lado.

En la variante de marco se coloca primero el PVC desde la cara abierta del marco y luego se introduce el conjunto por detrás del cuerpo. El despiece retira el conjunto antes de separar sus elementos, manteniendo el orden: acrílico, PVC y marco. El PVC nunca atraviesa el suelo del marco.

El esquema representa una sección local con las medidas de la receta. Las letras con huecos, como R y O, pueden tener paredes interiores separadas del perímetro exterior cuando el frente es acrílico; el STL conserva ambas islas, como en las construcciones anteriores.

## Archivos, costos y compatibilidad

- Nueva capa `pvc`. Los proyectos antiguos reciben su color por defecto y abren con `fitBaseType: legacy`.
- Cuerpo y base/marco: STL. Acrílico y PVC: DXF/SVG de corte, cada uno con su material y consumo. No se imputa PVC al filamento.
- Las perforaciones afectan también al nuevo fondo PVC.
- Contrato `grafo.fabrication-design` **versión 2** para las seis recetas nuevas; el resto conserva versión 1. Incluye el tipo de base y parámetros en `design.parameters`, y permite `components[].layer: pvc`. Sin conexión activa con la API de Grafo.
- Guardado, predefiniciones e historial conservan los nuevos parámetros y opciones validadas.
- Se mantienen el debounce de 400 ms y la cámara estable durante la edición.

## Verificación

40 pruebas nuevas en `tests/fit-bases.test.ts`: seis bases y dos frentes sobre un anillo de 160 mm y una R de 100 mm; tres perfiles no rectos en ambas direcciones; reconstrucción de STL individuales y girados en mesa; apoyo de PVC, recorrido completo de placas y montaje sin intersecciones; independencia de altura de base; archivos y consumos por material; persistencia y parámetros incompatibles.

La R de 100 mm usa paredes y canales reducidos para su ancho de trazo. El motor rechaza bases o canales sin espacio útil. La validación es geométrica; falta la prueba física de holgura con los materiales y el perfil de impresión del taller.

El [frente calado con difusor](./frente-calado.md) se incorporó posteriormente y usa estas mismas seis bases. Quedan pendientes las posiciones adicionales del acrílico a media pared, la combinación reborde exterior + marco PVC, las guillotinas con uniones, Neon Flex por trayectorias y el resto del roadmap de Proled.
