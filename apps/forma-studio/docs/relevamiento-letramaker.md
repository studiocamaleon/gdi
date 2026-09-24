# Relevamiento funcional de LetraMaker 4.0

> Registro histórico del acceso Explorer. La inspección posterior con suscripción Maker y la implementación de las doce familias se documentan en [modelos-letramaker-premium.md](modelos-letramaker-premium.md); reemplaza las limitaciones de acceso indicadas aquí para los modelos.

Fecha: 5 de septiembre de 2026. Inspección de la sesión de navegador del usuario en https://letramaker.comunicacao3d.com/. Cuenta con plan Explorer. Se preservó el SVG del proyecto original; las pruebas de texto se hicieron en otra pestaña.

## Qué resuelve

Convierte diseños vectoriales planos (SVG o texto convertido a curvas) en componentes de letras corpóreas. Sustituye el modelado CAD manual repetitivo de fondos, paredes, apoyos, tapas y fijaciones. Entrega STL para impresión y DXF para corte de acrílico; los recursos Empresa agregan documentación y organización de producción. No se observó un laminador que genere G-code.

## Funciones observadas

| Área | Comportamiento comprobado |
| --- | --- |
| Entrada | Cargar o arrastrar SVG; nombre y tamaño de archivo. Texto de hasta 30 caracteres, tipografía, altura y espaciado en mm; generación de geometría. |
| Fuentes | Syne, Bebas Neue, Oswald, Montserrat, Anton, Pacifico, Bungee, Russo One, Poppins, Raleway, Righteous, Archivo Black, Permanent Marker, Orbitron, Playfair Display y Lobster. |
| Visor | Modelo 3D, órbita, grid, rotación visual de 180°, dimensiones X/Y/Z y del SVG físico; despiece mediante control de montaje. |
| Estilos | Doce opciones: acrílico con fondo impreso, fondo abierto, apoyo doble, apoyo único, Back Fit, retroiluminado, frente de acrílico con encastre, frente impreso con encastre, LED doble, curva, Neon LED de segunda generación y Organic. Sólo el primero y retroiluminado están habilitados en Explorer. |
| Fondo impreso | Base 2 mm, pared exterior 2 mm, interior 2 mm, altura de pared 35 mm, acrílico 3,1 mm. Espejar y pestaña exterior beta. |
| Retroiluminado clásico | Fondo 2 mm, pared 4 mm, altura 50 mm; espejo por defecto para imprimir la cara sobre la mesa. |
| Retroiluminado doble | Pared exterior 3 × 40 mm, separación 2 mm, pared interior 3 × 50 mm; esquinas redondeadas, rectas o biseladas; radio 1,5 mm. |
| Fondo de encastre | Bandeja trasera separada: espesor 2 mm, holgura lateral 0,15 mm, retención 0,6 mm, borde 4 mm y chapa 1,2 mm. |
| Capas | Mostrar/ocultar cuerpo y acrílico; color por capa. |
| Perforaciones | Clic sobre base, selección y movimiento por arrastre, joystick o X/Y; diámetro 4 mm; Delete elimina; Escape sale. Forma personalizada global: rectángulo redondeado/oblongo de 10 × 5 mm, radio 2,5 mm. |
| Pines | Disponibles en retroiluminación: diámetro 10 mm, altura automática según pared; posiciones individuales, agujero central opcional 4 mm y fondo ciego. |
| Exportar | STL único o separado por letra; holgura DXF 0,1 mm; revestimiento interior blanco opcional. Descarga conjunta e individual: cuerpo STL, cara STL, acrílico DXF, base LED DXF. |
| Ayuda | Tutor interactivo, vídeos de SVG, estilos, novedades, producción y contenidos de proveedores. Selector de idioma, tema y orientación del panel. |
| Cuenta | Cuenta autenticada, plan, actualización y suscripción mensual/anual; Stripe indicado en pantalla. No se realizó compra ni cambio de plan. |

## Encastre esférico: diseñador independiente observado

Vista separada, montada y corte; masa estimada de perno y alojamiento, holgura, retención, pared mínima, flexión estimada y advertencias. Exporta STL por pieza o conjunto y configura mediante JSON.

- Esfera: diámetro 15, holgura diametral 0,4, retención 0,7, entrada achaflanada 1,8 mm.
- Base del perno: 40 × 26,5 × 4 mm, esquinas de radio 8; fijaciones Ø4,2 separadas 29,5 mm; rebajes Ø8 × 2; muescas Ø5; agujero central Ø4,2.
- Cuerpo: base Ø18 × 5, cuello Ø10 × 2,4, filete 1,2, plano de esfera Ø11, punta Ø8 a 90°.
- Alojamiento: altura 25, diámetro superior 26 e inferior 22, agujero de tornillo 5, avellanado 9, pestaña Ø32 × 2 mm.
- Flexibilidad: 4 ranuras, ancho 2,6, largo 19; alivio de raíz y adelgazamiento 2,2 mm; modo de impresión inclinada.

## Funciones anunciadas pero bloqueadas por plan

No se eludieron restricciones. Las recetas específicas de diez estilos, predefiniciones guardadas en cuenta y las herramientas Empresa no pudieron verificarse íntegramente en esta sesión.

La página de planes anuncia: ficha PDF por pieza con material, masa, filamento y costo; logotipo, contacto y checklist propios; historial numerado y reimpresión; corte de letras sobredimensionadas; distribución sobre mesas y STL por mesa. El aprovechamiento de acrílico se anuncia como próximo, aunque el editor muestra un acceso beta bloqueado. Tutorial Empresa observado: https://www.youtube.com/watch?v=2SWi8FJmjt4.

## Cómo funciona técnicamente: evidencia e inferencias

Se observó una aplicación cliente con canvas, controles Radix y un bundle JavaScript bajo `/assets/`. La composición de controles sugiere React/Radix, pero esto no confirma su código interno. Se comprobó la conversión de texto a un SVG intermedio y la regeneración del modelo cuando cambian parámetros. No se inspeccionaron tokens, almacenamiento privado, código fuente propietario ni endpoints internos.

La operación funcional requiere interpretar curvas y agujeros, aplicar offsets 2D, generar sólidos por extrusión, unir/restar fijaciones y triangular superficies. Ésta es una explicación del problema geométrico y de la arquitectura elegida para Forma, no una afirmación de que LetraMaker use una biblioteca específica. Tampoco se verificó su base de datos ni el proveedor de autenticación.

## Reconstrucción independiente

Forma Studio implementa sus propias recetas y componentes, con nombres y diseño propios. El motor usa Manifold WASM para sólidos y booleanas; Three.js para SVG y visualización; OpenType para contornos tipográficos. Los parámetros y el modelo de intercambio usan milímetros. El motor entrega componentes, materiales, área, perímetro y volumen sin depender de Grafo. Un contrato JSON versionado permite integrarlo después con costos y cotización.

Fuentes técnicas públicas: https://manifoldcad.org/docs/jsapi/documents/Using_Manifold.html, https://manifoldcad.org/docs/jsapi/classes/manifold.CrossSection.html, https://threejs.org/docs/pages/SVGLoader.html.
