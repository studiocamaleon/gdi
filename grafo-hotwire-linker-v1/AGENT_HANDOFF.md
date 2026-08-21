# Handoff para el agente de desarrollo de Grafo

## Objetivo

Incorporar en Grafo el motor que toma el SVG final de nesting de polifan, agrega uniones continuas al estilo VectorLinker y exporta un `.tap` para GRBL Control.

## Decisiones ya confirmadas

No volver a asumir ni cambiar estos valores sin una prueba física:

```text
Área útil máquina: 1250 × 600 mm
Origen: inferior izquierdo
X: aumenta hacia la derecha
Y: aumenta hacia arriba
Unidades: milímetros
Modo: coordenadas absolutas
Feed habitual: F350
Precisión: 6 decimales
Saltos de línea: CRLF
Código final: vacío
Z inicial: Z.24
```

Encabezado confirmado mediante `reference/andina.tap`:

```gcode
G17 G90 G21
G94
G92 X0 Y0 Z0
G54
T08
G00 S0 M03
Z.24
G1 F350 
```

Después se escriben únicamente coordenadas `X... Y...`. El archivo comienza con dos líneas `X0 Y0`, termina en `X0 Y0` y deja una línea vacía final.

## Estado del motor

El código ya:

- parsea el SVG real generado por Grafo;
- detecta 7 piezas y 11 contornos en la muestra;
- identifica 4 huecos;
- genera 11 uniones, incluyendo una sola conexión al origen;
- evita atravesar piezas y evita cruces entre uniones seleccionadas;
- crea un árbol continuo;
- recorre contornos una vez y uniones de ida/vuelta;
- transforma SVG Y-down a máquina Y-up;
- valida límites y coordenadas negativas;
- genera TAP, SVG vinculado, HTML de simulación, JSON de reporte y JSON de ruta;
- reproduce el dialecto de VectorLinker;
- pasa todas las pruebas automatizadas.

## Entrada pública

```ts
import { generateHotwireJob } from "@grafo/hotwire-linker";

const job = generateHotwireJob({
  svg: nestingSvg,
  sourceName: "placa-123.svg",
});
```

Usar:

```ts
job.tap
job.linkedSvg
job.previewHtml
job.bridges
job.routeSvg
job.routeMachine
job.metrics
job.report
```

## Integración mínima recomendada

1. Copiar este proyecto a `packages/hotwire-linker`.
2. Agregar dependencia workspace al backend NestJS.
3. Crear endpoint de generación por placa/revisión.
4. Persistir SVG original, TAP, ruta, perfil y versión del motor.
5. Mostrar `linkedSvg` o dibujar `routeSvg` en la UI.
6. Exigir aprobación manual antes de habilitar descarga.
7. Descargar el TAP como bytes ASCII, preservando CRLF.
8. Crear una revisión nueva ante cualquier cambio de SVG, perfil o versión.

## No hacer

- No convertir el TAP a finales de línea LF al guardarlo.
- No agregar `M30`, `M5` ni comentarios al archivo sin validación física.
- No eliminar `T08`, `G54`, `G00 S0 M03` o `Z.24` por parecer redundantes.
- No cambiar a tres decimales.
- No tratar el origen SVG superior izquierdo como origen de máquina.
- No regenerar silenciosamente una revisión ya aprobada.
- No enviar directamente por serial en esta primera integración.

## Origen automático

El perfil usa `geometry-bounds` con 8 mm de entrada. Esto mueve el cero lógico debajo/a la izquierda del conjunto de piezas, en vez de conservar el gran vacío inferior del SVG completo.

Puede deshabilitarse con:

```ts
profile: { originStrategy: "plate-corner" }
```

O puede pasarse un punto arrastrado por el operario:

```ts
originSvg: { x: 2, y: 414.463 }
```

## Prueba física pendiente

El formato está calibrado con un TAP real, pero el recorrido nuevo todavía necesita una primera corrida física:

1. abrir el TAP del Puma en GRBL Control;
2. ejecutar con hilo apagado;
3. comprobar X/Y, escala y retorno;
4. probar una geometría simple;
5. probar una letra con hueco;
6. cortar el Puma en descarte;
7. guardar el TAP aprobado como fixture.

No marcar el módulo como productivo antes de completar esta prueba.

## Próxima mejora sugerida

Editor manual de uniones dentro de Grafo. El motor ya entrega los puntos y segmentos necesarios. Agregar selección de una unión, arrastre de sus extremos sobre contornos, validación de cruces y regeneración del circuito.
