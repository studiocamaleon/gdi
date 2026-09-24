# Auditoría de geometría y montaje — 5 de septiembre de 2026

Se revisaron las doce construcciones y los siete perfiles de Orgánica después
de detectar recorridos incorrectos de despiece, apoyos desconectados y defectos
en archivos STL. Las correcciones afectan tanto al visor como a los sólidos
de fabricación; no son desplazamientos cosméticos de superficies.

## Correcciones

| Problema | Corrección |
|---|---|
| El sentido del despiece se deducía de la altura del centro de cada placa. El acrílico cercano al frente podía atravesar el borde que lo retiene. | Cada construcción define su frente y el sentido de extracción de cada componente. Acrílico encastrable y Encastre trasero retiran ambas placas por la abertura posterior. |
| Los modelos impresos con el frente contra la cama se presentaban desde el reverso. | El visor gira el conjunto para mostrar el frente del cartel hacia arriba. Conserva los datos de fabricación y transforma también los marcadores de perforaciones. |
| El PVC retirado hacia atrás quedaba por debajo del piso del visor. | El piso y la cuadrícula acompañan el límite inferior del conjunto. La cámara y las piezas conservan su posición. |
| En Orgánica los apoyos podían quedar aislados dentro de una pared perfilada. | Los apoyos se extienden hasta la envolvente real del cuerpo. La unión se comprueba por componentes conexos. |
| Los hombros de Bubble y Frisos cerraban el recorrido del frente. Restar un paso recto eliminaba la interferencia, pero dejaba zonas demasiado abiertas porque el hueco original seguía el relieve exterior. | Se reconstruye toda la banda del alojamiento: guía prismática, meseta continua y rampa unida al cuerpo. Se conserva el relieve decorativo exterior. |
| Algunos alojamientos de PVC y tapas en Orgánica cambiaban de ancho con la altura. | Las bandas de encastre delanteras y traseras mantienen constante el contorno de la placa y su holgura. |
| En Orgánica con fijación trasera, el frente podía chocar con el apoyo de PVC. | Su contorno considera el paso mínimo y el apoyo posterior. Se exige un borde frontal suficientemente ancho para retenerlo. |
| El avance del frente impreso lo dejaba flotando sobre el apoyo. | Se prolonga el frente conservando la cota de asiento, también en cascarón y con arista redondeada o biselada. |
| Los vacíos de perfiles podían dejar membranas por diferencias entre alturas Float32 y operaciones en doble precisión. | Se prolongan los extremos del vacío que deben atravesar una superficie. El canal de neón conserva exactamente su cota de fondo. |
| Algunas mallas válidas antes de exportar dejaban de ser cerradas al escribir STL. | Se estabiliza la malla a la precisión de Float32 antes de exportar: resolución mínima de 0,001 mm, adaptada a la escala de coordenadas. Las normales se calculan sobre las coordenadas finales del archivo. |
| Algunas combinaciones de altura hacían solapar placas y apoyos. | El motor rechaza esas combinaciones con un mensaje de medidas incompatibles. |

## Qué lleva cada encastre

**Acrílico encastrable:** cuerpo impreso con apoyo frontal, placa de acrílico
y base impresa desmontable con pared interior. El acrílico entra por atrás y
se apoya contra el borde delantero; después se coloca la base. No lleva PVC.

**Encastre trasero:** cuerpo impreso con apoyo y borde delantero, acrílico
frontal y fondo de PVC. Ambas placas se introducen por atrás. El fondo de PVC
se retira primero para acceder al acrílico.

**Frente impreso:** cuerpo y frente forman una pieza; la base impresa se
retira por atrás. **Letra curva desmontable:** la base queda fija y la letra
se levanta del alojamiento.

El visor presenta el cartel montado. El paquete de fabricación y las mesas
apoyan cada STL individual en Z=0 y voltean las tapas que deben imprimirse
con su cara cerrada contra la cama. El botón «STL ensamblado» conserva las
posiciones relativas del conjunto.

Las paredes exterior e interior de un hueco tipográfico pueden ser dos
componentes separados en un cuerpo sin fondo impreso. Eso es distinto de un
apoyo flotante: ambos contornos forman las paredes previstas y se ensamblan
con las placas de frente y fondo.

## Comprobación reproducible

`npm test` en `apps/forma-studio`: **259 pruebas aprobadas**.

Las 85 pruebas de `tests/manufacturing.test.ts` incluyen 79 configuraciones:

- R de 100 mm en las doce construcciones y en los siete perfiles Orgánica.
- Texto GRAFO de 100 mm en los siete perfiles Orgánica, con separación para
  que el relieve de letras vecinas no se superponga.
- Texto ABGO de 100 mm en las doce construcciones: múltiples piezas, curvas
  y huecos tipográficos.
- Anillo cuadrado de 160 mm en los siete perfiles Orgánica, combinando
  fijación delantera/trasera y fondo impreso/PVC.
- Bandeja halo, barriga negativa, ondas inclinadas, diez frisos, pie abierto,
  cascarón redondeado con avance, frente biselado, apoyo plano, pestaña,
  retroceso de cuerpo, neón de contorno y curvas con base unida/desmontable.

Para cada componente se reabre el STL individual y otro colocado en mesa
con giro de 90° y traslación decimal. Se comprueban cierre de la malla,
ausencia de triángulos degenerados, normales exteriores, volumen conservado
y apoyo en Z=0. La prueba usa los bytes exportados, no sólo la malla interna.

Se comprueban intersecciones entre componentes montados y a separaciones
de 0,5, 2, 5, 15, 35, 80 mm y una distancia mayor que la profundidad del
modelo. En la bandeja halo con retención elástica sólo se exige ausencia de
interferencia en las posiciones montada y completamente retirada: la traba
requiere flexión y no se valida como deslizamiento rígido.

Los perfiles Orgánica de anillo incluyen comprobaciones de continuidad del
cuerpo y rayos por el espacio interior para detectar membranas. Otras seis
pruebas validan el asiento del frente con avance y rechazan dimensiones
incompatibles. Doce pruebas independientes verifican el sentido de montaje;
el visor se monta con cámara y OrbitControls reales para comprobar que no
se mueve la cámara, el frente apunta hacia arriba y los marcadores acompañan
la orientación.

### Alojamientos rectos y referencia independiente

La comparación posterior con Letramaker descubrió un límite de las pruebas
anteriores: una placa podía pasar sin colisionar y aun así tener un alojamiento
demasiado ancho o un apoyo incompleto. `tests/letter-seats.test.ts` agrega 49
pruebas que miden secciones a distintas alturas, tanto en la pared exterior
como alrededor del hueco tipográfico. Incluyen los siete perfiles Orgánica
con fijación delantera/trasera y fondo impreso/PVC, y las otras construcciones
que alojan acrílico. Se comprueba también el volumen barrido por las placas
durante todo su recorrido de extracción, no sólo posiciones aisladas.

Las cotas se contrastaron con exportaciones de una I de 3000 mm de la
referencia. Con pared de 2 mm y acrílico de 3 mm, la guía de Bubble/Frisos
está a 1,2 mm del contorno original; los otros perfiles la mantienen a 2 mm.
Con holgura de 0,15 mm, el frente de Bubble/Frisos se recorta a 1,35 mm. La
meseta inferior está a 2,2 mm y tiene 2 mm de altura con apoyo de 1 mm a 45°.
Estas cotas se reproducen mediante geometría propia; los STL de referencia
no forman parte del producto.

En el anillo de prueba se mide una banda de apoyo continua de 748 mm².
El booleano prolonga 0,005 mm el vacío en su extremo para impedir membranas
coplanares; se comprueba que ese margen axial se mantiene por debajo de
0,006 mm. No se amplía la holgura lateral configurada por el usuario.

### Transiciones de huecos y caras colapsadas

Bubble con GRAFO de 100 mm puso de manifiesto otro caso: el relieve puede
cerrar una boca abierta o un hueco en una altura y volver a abrirlo en otra.
El barrido ahora localiza esas transiciones a 0,001 mm de offset y une las
secciones con una banda cerrada, en lugar de conectar contornos diferentes
por su índice. Las pruebas analíticas incluyen una C cuya boca se cierra y
un anillo cuyo hueco desaparece y vuelve a abrirse; el error de volumen está
por debajo de una parte por millón en esas muestras.

Si el redondeo deja caras colineales, el motor simplifica el sólido cerrado
antes de exportarlo. Se aplica sólo a las mallas afectadas, con una tolerancia
máxima de seis veces la resolución de la malla. No se eliminan esas caras
por separado dejando aristas abiertas.

## Muestra y límite de la comprobación

Se generó `output/auditoria-fabricacion/muestra-R-100-acrilico-encastrable.zip`
desde la misma función que utiliza «Descargar paquete de fabricación».
Contiene dos STL de impresión, el acrílico en DXF/SVG y el proyecto editable.
Para regenerarlo:

```sh
GRAFO_AUDIT_OUTPUT=output/auditoria-fabricacion npx vitest run tests/manufacturing.test.ts -t 'R · acrylic-fit'
```

Se verificó geometría y montaje digital de las configuraciones indicadas.
No se imprimió una muestra física ni se generó G-code. El ajuste del encastre
depende de la impresora, material, laminado y tolerancias de corte. La primera
pieza debe servir para comprobar esa holgura. No se certifican todas las combinaciones posibles de parámetros.
