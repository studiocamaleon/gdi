# Auditoría de modelos con acceso Maker

Inspección realizada el 05/09/2026 en la sesión autorizada de https://letramaker.comunicacao3d.com/, con acceso Maker. Se recorrieron las doce familias, sus deslizadores, opciones condicionales y despiece. Las doce construcciones y sus controles específicos están implementados en Forma Studio con geometría propia. Esta auditoría sustituye las suposiciones del relevamiento Explorer.

Muestra común: **R, Bebas Neue, 100 mm de altura, espaciado 0**. El contorno mide 48,4 × 100 mm; los STL de referencia conservan el margen tipográfico X (aprox. 5,857 mm). Se usó también **I de 3000 mm** para medir perfiles sin colapsos de offset en trazos estrechos. Las muestras descargadas mediante la interfaz están en `tmp/letramaker-models/` (no se distribuyen con la app). Se inspeccionaron las superficies y las piezas exportadas, sin acceder al código propietario.

## Parámetros y comportamiento observados

Valores en mm salvo indicación. La notación `valor [mín–máx]` registra los límites visibles de los deslizadores.

1. **Face Acrílico – Fundo impresso.** Base 2, pared exterior 2, pared interior 2, altura de pared 35, acrílico 3,1. Altura total 37. Espejo desactivado, pestaña exterior opcional. Exporta cuerpo, frente STL, acrílico DXF y base LED DXF. El cuerpo tiene niveles Z 0, 1,98, 33,88 y 37: el apoyo interior es una pared continua; no sólo un anillo cerca del frente.
2. **Face Acrílico – Fundo Vazado.** Exterior 2 [1–5], interior 2 [0–5], altura 35 [0–150], acrílico 3,1 [0–150]. Sin base impresa; altura total 35. Interior 0 elimina la segunda pared/asiento. Pestaña exterior y espejo. Exporta cuerpo STL, acrílico y PVC DXF.
3. **Face Acrílico – Apoio Duplo.** Acrílico 3 [1–10], PVC 3 [0–20], exterior 2 [1–5], altura exterior 45 [10–150], ancho de apoyos 1 [0,5–5], ángulo de apoyos 30° [25–60]. Apoyo plano opcional; pestaña exterior; espejo. Dos apoyos inclinados, frente y fondo de material de corte. Exporta cuerpo, acrílico y PVC.
4. **Face Acrílico – Apoio Único.** Acrílico 3 [1–10], exterior 2 [1–5], altura exterior 45 [10–150], apoyo 1 [0,5–5], ángulo 30° [25–60], fondo impreso 2 [0,5–20]. Apoyo plano, pestaña y espejo. Altura total 45. Exporta cuerpo y acrílico.
5. **Face Acrílico – Back Fit.** Ancho de borde 0,5 [0–10], espesor de borde 1 [0,5–20], exterior 2 [1–5], interior 2 [0–5], altura 35 [0–150], PVC 10 [0–50]. Espejado por defecto. Exporta cuerpo, PVC y acrílico DXF. No es la bandeja a presión del retroiluminado.
6. **Retroiluminado clásico.** Fondo 2 [0,5–10], pared 4 [1–12], altura de pared 50 [5–80]. Total 52. Espejado por defecto; herramienta de pines. Un cuerpo STL.
7. **Face Acrílico – Encaixe.** Acrílico 3,1 [1–10], borde ancho 2 [0–10], borde espesor 1 [0,5–20], exterior 2 [1–5], altura exterior 45 [0–150], retroceso exterior 0 [0–50], interior 2 [0,5–5], holgura 0,1 [0–2], fondo 1 [0,5–10], reducción de pared interior 20 [0–40,8, máximo dinámico]. Espejado por defecto. Tres componentes al desmontar: moldura, acrílico y tapa. Exporta `moldura.stl`, `tampa.stl`, acrílico DXF.
8. **Face Impressa – Encaixe.** Base frontal 2 [0,5–20], exterior 2 [1–5], altura 45 [0–150], interior 2 [0,5–5], holgura 0,1 [0–2], retroceso exterior 0 [0–50], fondo 1 [0,5–10], reducción interior 20 [0–42,8, dinámico]. Espejado por defecto. Exporta parte frontal y tapa en STL.
9. **Led Duplo.** Base 2 [0,5–20], acrílico 3,1 [1–10], exterior 2 [1–5], altura exterior 35 [0–150], interior 2 [0,5–5], distancia entre paredes 10 [1–30], segunda pared interior 2 [0,5–5]. Espejo desactivado. Exporta cuerpo, acrílico y base LED. Son paredes separadas por un canal: la muestra ancha confirmó pared exterior+apoyo 4, espacio 10 y segunda pared 2, sin tabique horizontal. La R pequeña de referencia tiene solapamientos y no es una referencia fiable de volumen.
10. **Letra Curva.** Extrusión angular 60° [10–360], radio 60 [10–400], centro de rotación 120 [−500–500], segmentos 128 [20–128]. Base activada: espesor 10 [1–100], ancho lateral 20 [0–300], profundidad 15 [0–200], avance frontal 0 [0–300], esquinas radio 5 [0–100]. Montaje unido o separado; separado agrega profundidad de encastre 8 [1–80] y holgura 0,2 [0–3]. Espejo opcional. La muestra mide 88,4 × 205 × 252,5. Es una extrusión de la letra por un arco, con base de apoyo, no una tapa levemente arqueada. Exporta cuerpo unido o letra y base separados.
11. **Neon LED 2ª Geração.** Altura pared 7 [1–60], fondo 1,2 [0,5–20], pared 1,2 [0,5–10]; pared crece hacia afuera del contorno. Traba: posición 5 [0–40], profundidad 0,8 [0–8], altura 1,5 [0,4–20]. Perfil triangular de retención continuo hacia el canal. Modo contorno opcional añade ancho de canal 10 [0,5–100]. Espejo opcional. Total Z 8,2. Exporta un cuerpo STL; no genera una tapa de acrílico.
12. **Organic.** Familia detallada debajo. Por defecto Zig-zag, frente acrílico, fondo impreso; R 56 × 106 × 38. Exporta cuerpo y acrílico DXF.

La **pestaña exterior** de las familias 1–4 está desactivada por defecto. Al activarla aparecen ancho 5 [0,8–20] y altura 2 [0,8–5]. Rodea sólo el contorno exterior: no introduce pestañas dentro de los huecos tipográficos. Forma conserva estos parámetros por estilo; restaurar parámetros recupera los valores iniciales de la familia.

## Retroiluminado doble

Fondo 2 [0,5–10]; exterior espesor 3 [1–12], altura 40 [5–80]; espacio 2 [0,5–20]; interior espesor 3 [1–12], altura 50 [5–80]. Esquinas redondeadas, rectas o chaflán; radio 1,5 [0–3] aplicado al borde frontal y al tope de la pared exterior (geometría 3D, no sólo esquina XY).

Bandeja opcional: espesor de encastre 2 [1–5], holgura por lado 0,15 [0–0,5], retención 0,6 [0,2–1,5], ancho de pared/borde 4 [1,5–15], chapa 1,2 [0,6–3]. Filete en la pared y canal en el borde de la tapa con rampa de entrada. Exporta cuerpo y fondo de encastre STL.

## Organic: perfiles de pared

Comunes: inclinación 0 [0–20], límite angular 45° [30–60], altura del cuerpo 30 [5–120], pared 2 [0,8–10]. Inclinación abre el fondo. La opción maciza elimina cavidad, frente y fondo separados, y activa espejo.

| Perfil | Parámetros propios |
|---|---|
| Zig-zag | Amplitud 3 [0,5–15], período 10 [2–40] |
| Barriga cóncava/convexa | Profundidad 5 [−15–15]; positivo ensancha hacia afuera |
| Pedestal / S | Apertura de base 6 [0,5–20], curvatura 60 % [0–100]; 0 = rampa, 100 = S |
| Ondas | Amplitud 2 [0,5–12], período 8 [2–40], formato 50 % [0–100]; 0 cresta plana, 50 seno, 100 puntiaguda |
| Bumper | Avance 5 [0,5–20], altura recta 8 [0–60], cerrar pie en base activado; rampas limitadas por ángulo |
| Bubble | Redondeo 50 % [0–100], radio del hombro 10 [1–40] |
| Stack | Cantidad 2 [1–6], avance 1,5 [0,3–6], espacio entre frisos 2 [0–30], cerrar base a 45° activado |

Con fijación frontal, frente acrílico o impreso separado. Acrílico: espesor 3 [1–10], holgura 0,15 [0–2]. Impreso: espesor 3 [1–10], holgura 0,15 [0–2], avance 0 [0–10]; arista recta, biselada o redondeada con tamaño 1 [0,2–5]; sólido o cascarón, espesor de cascarón 1,6 [0,8–5].

Apoyo: ancho 1 [0,5–5], ángulo 45° [25–60], opción plana. Fondo impreso espesor 2 [0,6–10], o PVC espesor 10 [1–20] y holgura 0,15 [0–2]. El PVC usa el mismo ancho/ángulo de apoyo.

**Fijación desde atrás:** activa espejo y usa frente acrílico. Borde frontal: ancho 2 [0,5–10] y espesor 2 [0,5–10]. Con tapa impresa aparecen chapa 1,2 [0,6–5], altura de paredes 8 [2–30], espesor de paredes 1,6 [0,8–5] y holgura 0,15 [0–1]. El cuerpo de altura nominal 30 llega a 39,7; la tapa mide 9,2. Con PVC se mantiene la altura total 30 y aparece «apoyo para PVC», activado por defecto, con ancho 1 y ángulo 45°. Esta variante tiene su propia construcción, no sólo un traslado del frente del modelo frontal.

Secciones observadas con I ancha y valores por defecto:

| Perfil | Comportamiento medido y reconstrucción |
|---|---|
| Zigzag | Tres ciclos completos de amplitud 3 en altura 30. Se redondea la cantidad de ciclos para cerrar el período en ambos extremos. |
| Barriga | Perfil senoidal entre extremos, profundidad máxima 5; admite concavidad con valores negativos. |
| Pedestal | Apertura 6 y transición en S; interpolación simétrica con exponente 1 + 3 × curvatura/100, contrastada en 60 %. |
| Ondas | Cuatro ondas en altura 30 con período nominal 8: período efectivo 7,5; formato 50 % senoidal. |
| Bumper | Comienza en Z 0, cierra el pie con rampa hasta avance 5, conserva un tramo recto de 8 y vuelve al contorno; altura total 35,65. |
| Bubble | Hombro circular de radio 10 y arco de 67,5° con redondeo 50 %; avance máximo 6,173 y altura de hombro 9,239. Altura total 32,3. |
| Stack | Dos bandas, avance máximo 2,3 (= avance 1,5 + 0,8), separación 2 y cierre a 45°; altura total 30. |

Zigzag, barriga, pedestal y ondas con fondo impreso arrancan el perfil en 2,3 y terminan el cuerpo en 32,3. El asiento y el frente llevan la altura total a 37,95. Bubble y Stack tienen un alojamiento frontal distinto: con pared 2 y holgura 0,15, el corte frontal queda a 1,35 del contorno original. Estas diferencias se conservan en el motor y en el diagrama de sección.

## Opción adicional observada: Vazado Paramétrico

No figuraba en el primer relevamiento de 12 tarjetas; ahora está visible. Espejo automático; cara 1, exterior/interior 2, altura 35, PVC 3,1 o fondo impreso. Patrones: perforado u ondas. Perforado: círculo, diamante, cuadrado, hexágono, oblongo o triángulo; grilla recta o triangular. Diámetro 3, separación 1,5, rotación 0°. Gradiente lineal/radial/angular con dirección 0°, tamaño mínimo 1,5 y máximo 4. Avanzado: margen 1,5, resistencia 0,8, densidad ninguna/vertical/radial/horizontal, semilla 42 y aleatorizar. Ondas: amplitud 3, frecuencia 5, espesor 1, cantidad 4, zoom 100 %, rotación 0°.

Esta tarjeta adicional no está implementada; no se cuenta dentro de las doce familias solicitadas.

## Implementación y validación

- `src/core/letter-models.ts`: paredes, frentes, apoyos, tapas, retenciones y perfiles Organic. `profile-sweep.ts` une secciones reales de offset, conserva huecos y cierra las mallas. `engine.ts` agrega el barrido angular y la base de Letra Curva.
- `src/components/ModelParameters.tsx`: parámetros numéricos y deslizadores por familia, opciones condicionales, diagrama Organic y restauración de valores. `project.ts` y `storage.ts` conservan parámetros por estilo y migran proyectos anteriores.
- `output.ts`: STL por pieza y mesa con tapas orientadas para imprimir, DXF/SVG de acrílico y PVC y plantillas de base LED. PVC tiene consumo y tarifa separados; las plantillas no se cobran como una placa adicional.
- 66 pruebas en cinco archivos, incluido `premium-models.test.ts`: las doce familias sobre R100, siete perfiles Organic, variantes macizas y de frente/fondo, bandeja con retención, neón contorno, base curva desmontable, apoyo plano, pestaña, retroceso, exportación y persistencia. Se comprobaron mallas cerradas y ausencia de interferencias volumétricas entre componentes.
- Revisión visual en el navegador de las formas y sus despieces. La referencia se operó mediante su interfaz, incluidos los botones explícitos de generación que requieren Curva y Organic.

La comparación verifica muestras y cotas seleccionadas, no todas las combinaciones del espacio de parámetros. Los perfiles suaves son una reconstrucción a partir de secciones observadas; no se conoce la función propietaria exacta. No hay ensayo de impresión o encastre físico. Los offsets que cierran/dividen huecos en trazos estrechos pueden requerir aumentar el tamaño o reducir el relieve; el barrido muestra un error cuando no puede conservar la topología, en lugar de exportar una malla inválida. Los valores físicamente incompatibles (p. ej. tapa más alta que el cuerpo) se rechazan aunque cada deslizador por separado permita ese número.

## Medidas de STL y DXF

`tmp/letramaker-models/measure.py` y `measurements.json` guardan alturas, secciones y volúmenes firmados de las descargas. Cuidado: varios archivos espejados tienen orientación invertida; algunos contienen mallas superpuestas, por lo que su volumen firmado no representa de forma fiable el sólido unido. En particular, el frente impreso y LED doble de la R pequeña arrojan áreas de sección mayores que su rectángulo exterior. La comparación debe usar contornos y componentes unidos, no copiar esos defectos.

- Fondo impreso: sección base 3440,986 mm²; paredes hasta 33,88: 1819,206; último tramo: 910,917. Fondo abierto repite esas paredes entre 0/31,88/35.
- Apoyo doble: exterior hueco área 910,917; dos anillos triangulares en Z 3–4,1547 y 40,8453–42. Para ancho 1 y ángulo 30°, cada medio perfil tiene altura `tan(30°) × 1 = 0,57735`: el apoyo es un saliente triangular. La opción plana cambia sólo el superior: comienza en 41,4226 y termina con cara horizontal en 42; el inferior mantiene su sección triangular.
- Apoyo único: igual apoyo superior y base 2; STL lleva pequeño desplazamiento de 0,02 mm, altura 45,02, aunque UI muestra 45.
- Back Fit: Z 0/0,98/24,98/35; primer tramo anillo espesor exterior+interior+0,5, tramo medio exterior+interior, tramo final exterior sólo. PVC entra desde atrás; acrílico descansa sobre el borde frontal.
- Encastre acrílico: moldura Z 0/0,98/45, sección inferior exterior+2 de borde y paredes exteriores de 2. Tapa: placa 1 y pared de 2 hasta 20,8. Altura de tapa = 45 − 1 de borde − 3,1 de acrílico − 20 de reducción − 0,1 de holgura. La tapa se exporta orientada para impresión y se invierte al montar.
- Encastre impreso: tapa de altura 22,8 = 45 − 2 de frente − 20 de reducción − 0,2 (margen de montaje).
- Encastre acrílico con retroceso 8 y reducción 10: moldura hasta Z 37, tapa de altura 30,8. La chapa recupera todo el contorno de la letra y agrega una falda exterior de altura 7,9 (= retroceso − holgura), para continuar la pared exterior acortada. La pared de encastre interior conserva el offset exterior+holgura.
- Curva: el barrido sin base ni encastre ocupa X ±24,2143, Y −89,9998…99,9992, Z 0…242,486. Se corresponde con radio radial entre 180 y 280 (radio 60 + centro 120 + coordenada Y); 280 × sen(60°) = 242,487. Base separada 88,4286 × 129,9992 × 10. Al pulsar explícitamente «Gerar Letra Curva» con montaje separado, la letra incorpora encastres de 8 y mide Z 250,486; la base tiene alojamientos desde Z 2 hasta 10. La descarga anterior al botón conservaba el modelo previo y se descartó para esa comparación. La variante unida mide 88,4286 × 205 × 252,487.
- Neón pleno: base offset hacia afuera 1,2, pared externa 1,2, altura total 8,2. Traba triangular centrada Z 6,2 = base 1,2 + posición 5; comienza 5,45 y termina 6,95, avance máximo 0,8.
- Neón contorno: mantiene contorno exterior de entrada; pared hacia adentro y hueco/canal limitado por espaciado.
- La bandeja retroiluminada sobre R100 quedó degenerada (menos de 0,4 mm de espesor y casi volumen nulo). Se repitió con I3000: las paredes ocupan 3 + 2 de separación + 3, el alojamiento de bandeja tiene holgura 0,15 y la retención se desarrolla entre Z 50,2/50,8/51,76 para altura total 52. La tapa mide 2, con chapa 1,2 y ranura de retención. Ésta es la muestra válida usada para reconstruirla.

Los archivos de referencia incluyen en ocasiones desplazamientos de 0,02 mm y sólidos invertidos. Forma conserva las dimensiones nominales y resuelve uniones booleanas; no reproduce esos artefactos. Las medidas de comparación redondean las diferencias de discretización de curvas, no los espesores o las holguras de fabricación.
