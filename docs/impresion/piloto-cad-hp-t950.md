# Piloto CAD: HP DesignJet T950 en rollo

**Documento vivo · 18/09/2026 · v0.9**

**Estado:** piloto de configuración y prueba fija CAD implementado. El usuario instaló y agregó **HP DesignJet T950 MFP V4** en el puesto QZ `192.168.88.164`. Se comprobó mediante QZ la detección de cuatro orígenes y se guardó en Grafo **914 mm / Rollo 1**, reutilizando el origen previamente elegido por el usuario. El usuario confirmó que la copia de prueba salió perfecta. Esta confirmación corresponde a la lámina probada; no informa mediciones de reglas ni valida todos los formatos, largos y modos de color. El envío de planos reales desde OT ya está implementado, con cola persistida y preparación por página. Su validación física queda pendiente; no se ha enviado papel durante esta implementación.

## Uso del piloto ya disponible

1. En **Configuración → Impresoras → Plotter HP T950**, abrir **Prueba CAD**.
2. Revisar ancho **914 mm** y origen **Rollo 1**. Ya quedaron guardados; no hace falta volver a agregar impresora, bandeja o perfil A4.
3. Mantener **A1 · giro automático**, elegir **Color** o **B/N · Escala de grises** y pulsar **Imprimir prueba CAD**. Se envía una copia de una sola página vectorial de **914 × 604 mm**, con el A1 girado al 100% y márgenes exteriores de 5 mm. La calidad se toma de la cola de Windows; configurar Fast/Rápida allí y validar físicamente ambos modos.
4. Medir cuadrado 200 × 200 mm y regla 500 mm, revisar esquinas y giro. Luego probar **900 × 350 mm**: salida de **914 × 360 mm**.

El piloto guarda `ImpresionDestino.cad`, con control de versión y permisos de configuración. Los destinos CAD quedan fuera de la resolución A4; los perfiles previos se conservan, se invalidan sus pruebas y se ocultan mientras el destino está en modo CAD. **Volver a documentos en hojas** permite desactivar el modo y requiere volver a verificar los perfiles. Cambiar de host/cola exige elegir otra vez el origen del rollo.

Endpoint de configuración: `PUT /impresion/destinos/:id/cad`; prueba fija: `POST /impresion/destinos/:id/prueba-cad`. El cliente sólo solicita formato A1/personalizado, versión y color BN/COLOR; el servidor elige cola, original y parámetros, genera el PDF y firma el comando. Clientes anteriores sin color mantienen COLOR. Márgenes fijados en 5 mm para este piloto, ancho limitado a 300–914,4 mm. El origen puede detectarse o, mediante confirmación explícita, delegarse al Rollo predeterminado configurado en Windows.

Para evitar un segundo giro, el PDF ya preparado usa `orientation: 'portrait'` como orientación del PageFormat, con ancho físico del rollo y largo calculado; `rotation: 0`, `margins: 0`, `scaleContent: false`, `rasterize: false`, una copia y simple faz. El usuario confirmó una salida correcta con el driver V4 instalado. No equivale a certificar cualquier plano o largo.

Generador del piloto: `apps/api/src/impresion/prueba-cad.ts`. Se verificaron PDF vectoriales de ambos formatos, límites visibles, cuadrado de 200 mm y regla de 500 mm **después** de aplicar giro/traslación. Pruebas automatizadas cubren geometría, DTO, persistencia/tenant/versiones, exclusión A4 y parámetros firmados con SDK QZ simulado. La lámina descargable anterior se conserva como referencia manual; el botón usa su propio generador fijo del servidor.

## Perfiles CAD y cotización de muestra disponibles

En la tarjeta del HP se pueden crear perfiles **B/N** y **Color** vinculados a un producto/ruta existentes y a su variante exacta de rollo. Se guarda esa relación en `ImpresionPerfil.cad`; no se inventan tarifas ni se reutiliza la cotización láser. Esta primera entrega admite productos simples, un único paso de impresión por área, este plotter como máquina candidata, material fijo activo en rollo del ancho configurado y un modo de color permitido por la receta.

- **Cotizar A1** simula una unidad, simple faz, 594 × 841 mm, con la receta completa y el modo BN/CMYK seleccionado. Muestra subtotal, impuestos y total; no crea OT ni envía papel. Una unidad de precio sin confirmar o un costo faltante bloquea el cálculo con el error del motor.
- **Imprimir prueba A1** prepara la lámina fija con el color del perfil, rollo/origen del destino, giro y escala 100%. La calidad se hereda de Windows.
- El perfil conserva modo de preparación, prioridad y verificación física declarada. Cambiar material, color, gramaje o configuración del destino invalida su prueba. No se marca verificado al recibir una aceptación de QZ.
- Guardar, cotizar e imprimir comprueban tenant, permisos, compatibilidad y versiones. La prueba firmada vuelve a comprobar el perfil dentro del bloqueo del destino.

Endpoints: `GET /impresion/cad/destinos/:id/opciones`, `POST /impresion/cad/perfiles`, `PUT /impresion/cad/perfiles/:id`, `POST /impresion/cad/perfiles/:id/cotizar-muestra` y `POST /impresion/cad/perfiles/:id/prueba`.

Se crearon **Planos B/N** y **Planos Color** para **Plano CAD impreso / Estandar**, con Obra 80 g, rollo 914 mm y preparación por operario. Ambos quedan pendientes de verificación física. El usuario confirmó la base de los costos ya cargados: papel por metro lineal y las cuatro tintas por ml; se registraron las unidades desde la ficha de materiales sin cambiar importes. Comprobación en la UI con los costos actuales: A1 B/N, subtotal AR$ 4.961,29 y total AR$ 6.003,16; A1 Color, subtotal AR$ 5.208,61 y total AR$ 6.302,42. Son valores de esa simulación, no tarifas fijas. No se envió papel durante esta implementación.

La detección/cotización CAD, el envío desde OT, la liberación del rollo y la cola durable están implementados. El asistente Grafo organiza una columna por máquina; los trabajos CAD son páginas con sus cantidades. Ver el recorrido de aceptación en el [plan operativo](plan-impresion-operativa.md#10-prueba-de-aceptación-de-esta-entrega). El conector residente sigue pendiente.

## 1. Decisión de producto

Conservar **Configuración → Impresoras**, con dos tipos de destino: **Documentos · Hojas** y **Planos CAD · Rollo**. Reutilizar conexión QZ, descubrimiento, máquina, permisos, perfiles y seguimiento; dar a CAD su propia configuración y preparación del archivo. No crear otra isla de impresoras ni habilitar planos como si fueran A4.

La primera prueba usa la PC Windows existente, `192.168.88.164`. Esa es la IP del puesto QZ, **no la IP del plotter**. El controlador de Windows envía a la IP propia del HP. Agregar una cola de impresora al mismo QZ no requiere generar otro certificado de Grafo ni otra CA.

**Regla principal:** imprimir al **100% del tamaño físico del PDF**. Un dibujo que ya está representado a 1:100 en el PDF debe seguir a 1:100 en papel. No inferir ni corregir automáticamente la escala del dibujo a partir de su rótulo.

## 2. Relevamiento inicial de Grafo (antecedente)

| Parte | Existe | Diferencia que debe resolver CAD |
| --- | --- | --- |
| `src/lib/pdf-medidas.ts` | Medida por página, rotación y `/UserUnit`, redondeo a 0,1 mm. | Lee dimensiones del MediaBox; orientación usa área visible. Definir una política única para CropBox/MediaBox. |
| `centro-copiado-sheet.tsx` | Lee PDF, páginas, rangos y orientaciones. | No conserva las dimensiones detectadas de cada página; el tamaño del trabajo viene de la configuración elegida. No basta con ampliar el selector A4. |
| `agregar-producto-sheet.tsx` | Adjuntar planos crea piezas con ancho/alto y origen de archivo/página. | Hay que vincular cada pieza a un archivo persistido inequívoco, conservando su transformación y copias. |
| `src/lib/planos-persistir.ts` | Sube originales a archivos del ítem, marca `medida_pdf`. | El envío actual sólo considera `centro-copiado`; debe incorporarse esta fuente explícitamente. Si una subida falla, el plano no es imprimible. |
| `documentos-orden.service.ts` | Valida archivo, producción, perfil y firma QZ; conserva intentos. | Tamaño de salida fijo 210 × 297 mm, `scaleContent: true`. CAD debe tener una ruta distinta y sin escalado. |
| Perfiles de impresión | Material, gramaje, color, faz, preparación y prueba declarada. | Faltan rollo, márgenes, límite de largo probado y política de escala/giro. |

El documento anterior `docs/planos-persistir-diseno.md` describe una fase previa: actualmente sí se retienen y suben los originales. El estado de esta tabla se basa en el código actual.

## 3. Modelo de configuración CAD

- **Destino:** tipo CAD_ROLLO, máquina de producción, puesto QZ, nombre literal de la cola, controlador/versión observados.
- **Origen de papel:** selector detectado mediante QZ, con el código exacto del rollo. No asumir `Roll`, `roll` ni numeración. Si el driver no expone origen, admitir solamente una cola dedicada con origen Rollo configurado y probado; mostrar esa dependencia.
- **Capacidad:** ancho máximo, largo mínimo/máximo admitido y probado por ese controlador; simple faz. No confundir largo del rollo cargado con largo máximo de un trabajo.
- **Carga actual:** ancho de rollo, material/variante, gramaje, confirmante y versión. Usar el ancho efectivo del driver/equipo: 36 pulgadas son 914,4 mm, aunque comercialmente se denomine 914 mm. Conservar ambos datos y no redondear el transporte a ciegas.
- **Perfil:** material, gramaje, B/N o Color, calidad, origen, márgenes y modo de preparación. La calidad y ciertos ajustes HP podrían depender de las preferencias de una cola dedicada; no afirmar que QZ controla todas las opciones del fabricante.
- **Política fija:** escala 100%, sin ajuste ni reducción, giro 0/90° para caber y ahorrar largo. Un caso incompatible queda en revisión con causa; nunca se corrige achicándolo.
- **Verificación:** ligada a cola/controlador, ancho, márgenes y perfil. Cambiar esos datos invalida la prueba correspondiente. La preparación del papel tiene su propio estado y versión.

## 4. Geometría y elección de orientación

HP publica márgenes de **5 mm por lado** para rollo. Es una referencia inicial que se debe contrastar con el controlador instalado. Para un ancho declarado de 914 mm y márgenes de 5 + 5 mm, quedan **904 mm de ancho imprimible**. [Ficha técnica del T950](https://h20195.www2.hp.com/v2/getpdf.aspx/c08758185.pdf).

La política inicial propuesta conserva toda la página, incluidos sus bordes: colocar el original al 100% sobre una página de salida del ancho del rollo, con márgenes reservados. No depende de que el borde del original parezca blanco.

Para una página de ancho `W`, alto `H`, rollo `R` y márgenes `L,T,D,B`:

1. Normalizar el área visible elegida, origen de coordenadas, `/Rotate` y `/UserUnit` sin cambiar su tamaño físico. Guardar los valores originales y la política aplicada.
2. Evaluar sin giro: cabe si `W ≤ R-L-D`; largo de salida `H+T+B`.
3. Evaluar giro de 90°: cabe si `H ≤ R-L-D`; largo de salida `W+T+B`.
4. Descartar candidatos fuera de límites probados de largo/formato. Elegir el menor largo; si empatan, conservar la orientación original.
5. Centrar dentro del ancho útil y trasladar verticalmente al margen superior. Sólo giro/traslación en unidades físicas; no multiplicar por un factor de ajuste.
6. Si ninguno cabe, bloquear el envío automático y explicar qué dimensión excede el ancho. Otro rollo/plotter o una reducción autorizada requiere otro flujo y, cuando cambie lo cotizado, recotización.

Ejemplos con rollo **914 mm y 5 mm por lado**, usando la política que añade margen fuera de la página original:

| Página original | Ancho del dibujo sobre el rollo | Largo de salida calculado | Resultado |
| --- | ---: | ---: | --- |
| A2, 420 × 594 mm | 594 mm | 430 mm | Giro 90°, escala 100%. |
| A1, 594 × 841 mm | 841 mm | 604 mm | Giro 90°, escala 100%. |
| A0, 841 × 1189 mm | 841 mm | 1199 mm | Sin giro, escala 100%. |
| 900 × 350 mm | 900 mm | 360 mm | Sin giro, escala 100%. |
| 910 × 1200 mm | Ninguna orientación cabe en 904 mm | — | Revisar; no reducir. |

Estos largos son **resultados del algoritmo propuesto**, no medidas de corte ya comprobadas en el HP. El firmware puede introducir avance/corte adicional. El cortador corta a lo largo del avance; no elimina las bandas laterales del rollo.

### Área visible y márgenes

La opción inicial recomendada es preservar la intersección visible de CropBox y MediaBox, teniendo en cuenta rotación y unidades, tal como se ve en el visor. Si difiere de la medida cotizada actual del MediaBox, mostrar la diferencia y revisar la cotización antes de enviar. No sustituir la medida silenciosamente. Rechazar cajas inválidas o dimensiones no finitas.

El manual HP ofrece modos estándar, sobredimensionado y recorte por márgenes. Si Grafo ya reserva los márgenes en el PDF de salida, el controlador no debe volver a añadirlos ni ajustar esa página. Hay que validar el modo concreto del controlador; `margins: 0` en QZ no elimina márgenes físicos. [Manual T850/T950, apartados de tamaño personalizado, márgenes y escalado](https://kaas.hpcloud.hp.com/pdf-public/pdf_5759089_en-US-1.pdf).

## 5. Transporte QZ propuesto

**PDF vectorial → QZ → controlador oficial de Windows → plotter.** No enviar PDF como comandos RAW suponiendo que todas las variantes T950 tengan el mismo intérprete. No rasterizar previamente un A0 a alta resolución desde Grafo. El controlador puede hacer su propia conversión final.

QZ permite tamaño personalizado en mm, desactivar el escalado y seleccionar origen. Candidatos: `units: 'mm'`, `size: {width, height, custom: true}`, `scaleContent: false`, `rasterize: false`, `duplex: false`, `printerTray` validado y `colorType` según el perfil. No forzar `density`, porque en PDF activa rasterizado. [Opciones oficiales QZ](https://qz.io/api/qz.configs).

**Esto no es todavía una configuración certificada para el HP.** Debemos comprobar cómo el controlador y Java interpretan ancho/alto y `orientation` en páginas más anchas que largas. La página preparada ya tendrá el giro aplicado: evitar que QZ y el driver vuelvan a girarla de manera incompatible. No fijar `orientation: null` a ciegas ni asumir que declarar un tamaño personalizado obliga al driver a aceptarlo.

Para un PDF de tamaños mixtos, generar envíos por página con su tamaño propio. Inicialmente una sola página y una sola copia por envío; secuencia por juego: páginas seleccionadas en orden, luego el siguiente juego. Evitar que dos copias se conviertan accidentalmente en `1,1,2,2` cuando se esperan `1,2,1,2`. No aplicar la imposición ni los blancos de doble faz de A4.

Revalidar en servidor original, permisos/tenant, paso productivo, perfil, preparación, página, dimensiones y versión antes de firmar. Identificar por ID de archivo y huella, no sólo por nombre. Guardar original/página/juego, tamaño físico, giro, rollo, márgenes y payload en el intento. No repetir automáticamente un envío cuyo resultado sea incierto.

Limitar bytes, páginas, dimensiones, concurrencia y memoria. Extraer/preparar páginas de forma acotada; no generar todos los juegos de un plano grande simultáneamente ni disparar una conexión por hoja. El seguimiento de Windows informa la cola, no certifica que la escala o el corte físicos sean correctos.

## 6. Instalación y primera prueba en Windows

1. Conectar el HP a la red y comprobar su IP en el panel. Instalarlo **en la PC que ejecuta QZ**, actualmente `192.168.88.164`, usando la IP propia del plotter. No cambiar el host QZ por la IP del HP.
2. Descargar el controlador del **modelo exacto y la versión de Windows** desde [HP T950: software y controladores](https://support.hp.com/us-en/drivers/hp-designjet-t950-printer/2101367273). Preferir para este piloto la cola del controlador oficial V4 PCL3/raster para el T950 si está disponible; HP Click como aplicación no sustituye por sí sola la cola instalada que necesita QZ.
3. Evitar elegir por defecto un HP-GL/2 genérico: HP documenta que no dispone de comunicación bidireccional y que eso puede afectar giro y asignación de rollo. Registrar cuál se instala realmente. [HP: controladores](https://support.hp.com/nz-en/document/ish_13050726-13050614-16), [software del T850/T950](https://support.hp.com/us-en/document/ish_9946540-9754606-16).
4. En Preferencias de impresión, preparar una cola CAD con **origen Rollo**, ancho cargado de 36 pulgadas, material real, **100% / tamaño real**, simple faz y corte según el soporte. Desactivar ajustar/reducir/ampliar al papel. Para las pruebas del giro calculado por Grafo, la rotación adicional del driver debe estar desactivada o demostrarse que respeta el tamaño y avance solicitados.
5. Confirmar que QZ detecta esa cola, su controlador y sus orígenes. No inventar el nombre del rollo si no aparece; registrar esa limitación y validar la cola dedicada.
6. Probar primero el PDF de este documento **desde Windows**, una página cada vez, seleccionando el formato correcto. Esto separa un problema de instalación/driver de uno de QZ/Grafo. No marcarlo como prueba CAD de Grafo completada: después se debe enviar y medir la misma lámina por QZ.
7. Página 1: A1, **594 × 841 mm**, una copia, tamaño real. Puede girarse para usar 841 mm de ancho de rollo. Página 2: **900 × 350 mm**, una copia; crear ese tamaño personalizado en el controlador si no existe. No enviar ambas con un único tamaño fijo A1 o A4.
8. Revisar las cuatro esquinas, medir las reglas y ambos ejes del cuadrado. Registrar medida, controlador, origen, giro y largo real de corte. Una impresión visualmente correcta o un trabajo finalizado en Windows no basta para aprobar CAD.

HP describe la creación de formatos en `Basic → Document size → (+) Create`; los rótulos varían con idioma/versión. Los tamaños creados pueden ser locales a una cola. En el piloto se debe verificar también que QZ vea y use el formato personalizado, o que acepte tamaños dinámicos sin registrarlos manualmente.

## 7. Lámina de prueba y validación

Generador reproducible: `scripts/generar-prueba-cad.py`, requiere Python con ReportLab y usa las fuentes Geist existentes del repositorio.

```sh
python3 scripts/generar-prueba-cad.py
```

Salida: `output/pdf/grafo-prueba-cad-hp-t950.pdf` (el directorio de artefactos no se versiona).

- Página 1: A1 vertical; reglas horizontales y verticales de 500 mm, cuadrado de 200 mm, cuadrado de 100 mm y círculo de diámetro 100 mm.
- Página 2: formato 900 × 350 mm; cuadrado de 200 mm y regla de 500 mm, para probar un tamaño no estándar cercano al ancho útil.
- Ambas: identidad visual actual de Grafoprint, esquinas, trazos vectoriales de diferentes grosores y muestras de color. Las muestras sirven para verificar presencia de color, no para calibración cromática.
- Verificación digital: dimensiones de MediaBox con error menor a 0,001 mm de serialización; cuadrados de 200 mm; sin imágenes rasterizadas; texto dentro de página; render de ambas páginas revisado.
- Pendiente físico: ausencia de recorte, medidas X/Y, orientación sobre el rollo, selección de origen, largo de corte, orden de páginas/juegos y resultado QZ. La aceptación dimensional debe acordarse según uso, soporte e instrumento de medición; no prometer error físico cero ni corregirlo mediante escalado automático.

La primera prueba no cubre PDF malformados, cifrados, anotaciones, fuentes ausentes ni una página larga como A0. Esos casos requieren validación antes de abrir el envío automático a documentos de clientes.

## 8. Secuencia de implementación

1. **Instalación y caracterización:** cola T950 en Windows, driver/origen reales y prueba física local. Datos pendientes: Windows/controlador, nombre exacto, código del rollo, ancho efectivo y límites reales.
2. **Piloto CAD en Configuración → Impresoras:** tipo CAD/Rollo, perfil de preparación, selector de origen y botón para la lámina fija. Endpoint de prueba con payload calculado y firmado por el servidor; no aceptar comandos arbitrarios del navegador. Validar primero márgenes, tamaño dinámico y giro mediante QZ.
3. **Integración con OT:** conservar dimensiones por página en Centro de copiado, enlazar originales de planos, planificación de rangos/copias por página, reserva/historial, resumen compacto. Ejemplo: `Plano.pdf · pág. 2 · 594 × 841 → 841 × 594 mm · 100% · HP T950 · Rollo 914 mm`.
4. **Preparación y cola durable:** los planos sin rollo/material compatible esperan al operario. Integrar en la etapa de cola del plan general; no afirmar que cerrar el navegador conserva un ejecutor residente.

Casos mínimos antes de habilitar automático: A1 con giro; A0 sin giro; formato personalizado; mezcla de tamaños y rotaciones; CropBox distinto, `/UserUnit` y coordenadas no cero; rangos/copias/juegos; ninguno de los lados cabe; cambio de rollo entre vista previa y envío; driver que ignora tamaño; fallo parcial y resultado incierto. Los originales con anotaciones relevantes deben conservarlas o bloquearse explícitamente; incrustar una página como Form XObject puede omitirlas.

Este piloto anticipa parte de la ampliación de formatos solicitada por el usuario; no sustituye las etapas pendientes de cola durable y conector del [plan general](plan-impresion-operativa.md).

## 9. Revisión posterior a la prueba física: Centro de copiado, calidad y concurrencia

**Implementados:** perfiles, Centro de copiado CAD, despacho de planos de OT por página, cola persistida, liberación del rollo y seguimiento de varias impresoras del mismo puesto QZ. **Pendiente:** aceptación física del nuevo recorrido y conector residente.

### Detección y cotización de planos

`leerMedidasPdf` conserva dimensiones visibles por página (intersección CropBox/MediaBox, UserUnit y Rotate), sin redondearlas para calcular. Centro de copiado conserva todos los originales al aplicar rangos. La carga se separa en pestañas **Documentos** y **Planos CAD**, cada una con sus valores iniciales y área de arrastre. Al cargar desde Documentos, un PDF con alguna página que supera los formatos en hojas disponibles pasa automáticamente a CAD; un PDF mixto conserva todas sus páginas en el mismo archivo. Desde CAD se admiten planos PDF de cualquier tamaño, incluidos A4/A3. En el detalle se puede mover un archivo entre pestañas. El total y Agregar a la OT incluyen ambas, con advertencias por pestaña para archivos incompletos o con errores.

**Desglose de copias:** en Planos CAD, **Desglosar páginas** abre una tabla compacta con cantidades por página del PDF original. Respeta el rango seleccionado y conserva las cantidades de páginas temporalmente excluidas. La tabla pagina de a 50 filas para poder editar PDFs largos sin montar miles de inputs. Se puede volver a la cantidad común con **Usar N copias en todas**; antes de mover a Documentos hay que unificarlas. Documentos mantiene cantidades por archivo.

Se conserva **un solo ítem comercial y un solo PDF adjunto**. `copiasPorPagina?: { pagina, copias }[]` contiene excepciones al valor común `copias`; un array vacío activa el desglose sin excepciones. La cotización suma las cantidades efectivas sólo de páginas seleccionadas y pasa las mismas cantidades a `jobContext.piezas`; no cotiza cada página como un trabajo independiente. `_centroCopiado` conserva el desglose para editarlo y `planes[]` guarda las copias efectivas de cada página. API valida índices originales únicos, enteros positivos, hasta 10.000 copias por página y 10.000 impresiones totales por documento. Rechaza este campo en modo HOJAS.

El envío CAD usa esas cantidades por página y las revalida con el PDF persistido. Cada página tiene reserva, intentos e historial propios; una reimpresión explícita sólo afecta a esa página.

En CAD, el perfil determina producto/ruta, rollo, gramaje, plotter y modo B/N/Color. Los perfiles se consultan mediante `/centro-copiado/opciones-cad`, con permisos comerciales y sin exponer hosts o colas Windows. Se elige automáticamente sólo un perfil compatible único o de prioridad inequívoca. El selector permite resolver las otras alternativas. Cambiar color busca el perfil equivalente de la misma receta, material y destino.

Se valida cada página seleccionada con `planPaginaCad`: giro de 0°/90°, escala 100%, ancho útil y largo de salida con márgenes. Si alguna no entra se bloquea la cotización; el rango permite excluirla. Se admiten hasta 5.000 páginas seleccionadas y 10.000 impresiones por documento. Simple faz, sin tomos ni anillado CAD.

`CentroCopiadoCadService` usa el motor existente con piezas de las medidas originales y sus copias, máquina y material de la receta. Guarda `_centroCopiado.modo = CAD`, medidas, selección, versiones del perfil/destino y geometría calculada. El ítem conserva la identidad del producto CAD y puede editarse desde Centro de copiado. La cotización valida medidas comerciales y el envío las contrasta con el PDF persistido; revalida perfil, geometría y preparación antes de firmar.

Pruebas: PDF mixto A1/A0/910×1200 mm con rollo 914 mm; rechazo de la tercera página, rango 1–2 y dos copias, cambio B/N–Color, carga mixta con A4 y edición posterior. Tests cubren límites, rangos, tenant, versiones, parámetros de la receta y dimensiones con CropBox/UserUnit/Rotate. No se envió papel durante esta validación.

Recorrido implementado (pendiente la aceptación física desde OT):

1. Conservar las dimensiones físicas de **cada página** al adjuntar un PDF, incluso con tamaños mixtos y rangos. Mostrar el formato estándar si coincide y las medidas exactas para los demás.
2. Clasificar automáticamente como **Planos CAD** los PDF que superan los formatos en hojas disponibles. Permitir cargarlos directamente desde la pestaña CAD o moverlos de pestaña: el tamaño no permite clasificar el contenido con certeza.
3. En modo CAD, fijar tamaño del original, escala 100% y simple faz. Mantener copias/rangos y permitir B/N o Color. Validar cada página contra el rollo; no reducirla para que entre.
4. Cotizar con la ruta CAD del motor, material en rollo y máquina correspondientes, conservando los criterios de precio configurados. No reutilizar las tarifas láser por hoja ni inventar una tarifa universal por m². Si falta esa configuración, indicar qué debe completarse antes de cotizar.
5. Resolver el perfil de impresión a partir de lo cotizado. Preparar y firmar las páginas con el tamaño/giro calculados por el servidor; registrar cada envío para poder distinguir un fallo parcial. Mantener el orden del original, enviando todas las copias de una página antes de la siguiente; esta entrega no intercala juegos completos.

La tabla compacta puede mostrar: `Plano.pdf · 3 páginas · tamaños mixtos · B/N · Rápida · HP T950`. Medidas, giro y largo de cada página quedan en el detalle. El resumen previo a emitir debe separar documentos en hojas y planos sin esconder un archivo incompatible.

### Calidad y perfiles B/N / Color

El piloto permite elegir Color o B/N y firma respectivamente `colorType: 'color'` o `'grayscale'`. No envía densidad ni un parámetro ficticio de calidad HP. El nombre del trabajo y la confirmación de envío incluyen el modo elegido. Las pruebas automatizadas verifican ambos modos, la firma y la conservación de la geometría; el usuario probará Fast y B/N en el equipo real. Ya existen perfiles CAD de material/color vinculados a la receta, con cotización de muestra y prueba fija. La calidad sigue en Windows; los planos de OT usan ese mismo criterio. Los perfiles A4 quedan expresamente excluidos en destinos CAD.

Para comenzar, proponer dos perfiles del mismo plotter y rollo:

| Perfil | Modo de color solicitado | Calidad prevista |
| --- | --- | --- |
| Planos B/N · Rápida | Escala de grises | Fast del controlador HP |
| Planos Color · Rápida | Color | Fast del controlador HP |

La calidad HP **Fast** se configura en Windows, en **Basic → Print quality**. **Economode** es otra opción, en **Advanced → Color and quality**; se debe probar por separado. Los nombres pueden variar según el idioma del controlador. [Manual oficial T850/T950, páginas impresas 44 y 47](https://kaas.hpcloud.hp.com/pdf-public/pdf_5759089_en-US-1.pdf).

QZ documenta selección de color y densidad, pero no una opción genérica que seleccione el modo HP Fast. `density: 'draft'` selecciona la menor densidad publicada y, en PDF, activa rasterización: no es equivalente al modo rápido del HP. Mantener PDF vectorial y probar la calidad heredada de una cola Windows dedicada. Si se necesitan varias calidades simultáneas, evaluar colas separadas con preferencias fijas, vinculadas a la misma máquina física; no cambiar preferencias globales entre trabajos. No mostrar un selector como aplicado por Grafo si el transporte no puede garantizarlo. [Opciones de QZ](https://qz.io/api/qz.configs).

En el HP, **Grayscale** mantiene tonos grises; el manual indica uso de tinta negra con papel no brillante y una excepción para papel brillante. **Pure black and white** elimina grises. Para planos sobre papel obra, empezar por escala de grises y probar la correspondencia de `colorType: 'grayscale'` con el controlador. QZ por sí solo no certifica qué cartuchos utilizó el equipo. [Manual oficial, página impresa 48](https://kaas.hpcloud.hp.com/pdf-public/pdf_5759089_en-US-1.pdf).

### Impresión simultánea y seguimiento

`DocumentosImpresionProvider.despachar` alterna trabajos de distintas máquinas y espera cada llamada a `imprimirDocumentoOrden`. El SDK queda protegido por `exclusivo`, porque comparte conexión y firma activa. El siguiente trabajo se envía cuando QZ confirma el envío anterior, **sin esperar la impresión física**. Por eso la Ricoh B/N, la Ricoh Color y el HP pueden trabajar al mismo tiempo una vez recibidos sus trabajos. El inicio no es sincronizado; preparar/transmitir un PDF grande puede demorar el despacho siguiente. [Contrato de `qz.print`](https://qz.io/api/qz).

El monitor escucha todas las impresoras involucradas del mismo host QZ y asocia eventos por impresora y `jobName`. Minimizar conserva esa escucha. Cambiar a otro puesto QZ cierra la conexión anterior; cerrar/recargar la pestaña interrumpe la recepción de eventos. La cola y los últimos estados conocidos permanecen en la base y **no se repiten envíos automáticamente**. [Estados de impresoras QZ](https://qz.io/docs/printer-status).

Las columnas agrupan por máquina física. La cola conserva prioridad por fecha de entrega, número de OT, paso y página. Un trabajo pendiente de papel o incierto impide saltarlo dentro de esa máquina, pero no frena las demás. El servidor reserva bajo bloqueo y verifica el último intento; un fallo parcial CAD conserva las páginas ya enviadas. No se usa `Promise.all` para imprimir mientras conexión y firma siguen compartidas.

### Preparación del PDF real

`pdf-cad.ts` usa CropBox ∩ MediaBox, UserUnit y Rotate; incrusta contenido vectorial con transformación física y aplica únicamente giro/traslación. No escala ni rasteriza. PDF cifrado, geometría discrepante y anotaciones que no pueden conservarse se rechazan con motivo. La salida usa rollo × largo calculado, `scaleContent: false`, `rasterize: false`, márgenes QZ 0 (ya incorporados al PDF) y tamaño personalizado.

Pruebas digitales: geometría 0/90/180/270°, copias/rangos, versión y destino, reserva concurrente única, aislamiento por tenant, prioridad entre OT, confirmación por página y liberación por lote. Render revisado con área visible desplazada y UserUnit 2: cuatro esquinas conservadas y cuadrado de 200 mm. No sustituye medición física del HP.

### Orden de trabajo siguiente

1. **Implementado:** perfiles CAD y cotización de muestra vinculada a la receta. **Pendiente físico:** probar ambos perfiles con Fast configurado en Windows.
2. **Implementado:** detección por página y modo Planos en Centro de copiado, conectado a su cotización CAD. Agregado y edición de ítems conservan originales/rangos/copias/perfil.
3. **Implementado:** documentos de OT con rangos, cantidades por página, geometría y trazabilidad. **Pendiente físico:** OT mixta A4/CAD, medidas, B/N/Color y fallo parcial.
4. **Implementado:** seguimiento de varias impresoras del mismo QZ y cola durable con liberación. **Siguiente etapa:** conector, instalación asistida y continuidad sin navegador según el plan general.
