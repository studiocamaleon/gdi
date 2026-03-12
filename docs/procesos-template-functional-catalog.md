# Catalogo Funcional de Plantillas de Procesos (por Plantilla de Maquinaria)

## Objetivo

Definir un catalogo funcional de `plantillas de procesos` para las 17 plantillas de maquinaria existentes en el sistema, con foco en:

- secuencia operativa realista por tecnologia
- variables necesarias para costeo y futura cotizacion
- reglas de validacion entre proceso, maquina y centro de costo
- base para el futuro modulo `Productos y servicios`

Fecha de corte de investigacion: `2026-03-11`.

## Alcance y criterio

Este documento cubre la gran mayoria de procesos usados en la industria para las tecnologias hoy disponibles en el ERP.
No busca cubrir todos los casos especiales de cada planta, sino definir un `baseline` robusto para implementar V1.

## Hallazgos de investigacion (sintesis simple)

1. Los ERP/MIS maduros modelan `operaciones secuenciales`, no solo etapas descriptivas.
2. Cada operacion necesita unidad, tiempo, velocidad y centro/workstation.
3. Setup y run deben separarse para tener costo realista.
4. Velocidad y merma suelen manejarse por reglas/tablas, no por un unico valor fijo.
5. En print&cut y finishing digital, marcas de registro y codigos de trabajo (barcode) son un patron fuerte de automatizacion.
6. La interoperabilidad MIS-produccion se modela por rol `manager/worker` (CIP4 ICS), y estados/reportes de proceso.

## Patron comun propuesto para todas las plantillas

### Macro-operaciones canonicas

- `preflight_archivo`
- `preparacion_sustrato`
- `setup_maquina`
- `produccion_principal`
- `post_proceso` (segun tecnologia)
- `control_calidad`
- `embalaje_despacho` (cuando aplique)

### Variables minimas por operacion

- `setupMin`
- `cleanupMin`
- `modoProductividad` (`fija|formula|tabla`)
- `velocidadBase` o `reglaVelocidadJson`
- `mermaSetup` y/o `mermaRunPct`
- `centroCostoId` (obligatorio)
- `maquinaId` (opcional)
- `perfilOperativoId` (opcional)
- `unidadEntrada` / `unidadSalida`

### Formula base (V1)

`costoOperacion = costoTiempo + costoInsumos + costoDesgaste + costoTercerizado`

donde:

- `costoTiempo = horasEfectivas * tarifaCentroPublicada(periodo)`
- `horasEfectivas = (setup + run + cleanup) / 60`

## Catalogo por plantilla de maquinaria

## 1) `router_cnc`

### Plantillas de proceso sugeridas

- `cnc_corte_perfilado`
- `cnc_grabado_fresado`

### Flujo base

`preflight_archivo -> nesting_cnc -> setup_herramientas -> mecanizado -> desbarbado_limpieza -> control_dimensional`

### Drivers de costo clave

- tiempo de setup de herramientas
- velocidad de avance/corte por material
- desgaste de fresas
- merma por nesting

## 2) `corte_laser`

### Plantillas de proceso sugeridas

- `laser_corte_plano`
- `laser_grabado_plano`

### Flujo base

`preflight_vector -> setup_laser -> corte_o_grabado -> retiro_piezas -> limpieza_bordes -> control`

### Drivers de costo clave

- potencia/frecuencia y pasadas
- velocidad por espesor/material
- tiempo de setup y limpieza

## 3) `impresora_3d`

### Plantillas de proceso sugeridas

- `fff_pieza_unica`
- `fff_lote_corto`

### Flujo base

`preparacion_modelo_3d -> slicing -> setup_impresion -> impresion -> retiro_soportes -> acabado_post`

### Drivers de costo clave

- tiempo de impresion por capa/pieza
- consumo de material por pieza
- tiempo de postprocesado

## 4) `impresora_dtf`

### Plantillas de proceso sugeridas

- `dtf_apparel_basico`
- `dtf_apparel_con_postacabado`

### Flujo base

`preflight -> impresion_film -> aplicado_polvo_hotmelt -> curado_horno -> transfer_prensa_termica -> pelado_fijado`

### Drivers de costo clave

- ancho ocupado en film
- polvo + film + tinta
- tiempos de curado y transferencia

## 5) `impresora_dtf_uv`

### Plantillas de proceso sugeridas

- `dtf_uv_sticker_transfer`

### Flujo base

`preflight_capas -> impresion_uv_film -> laminado_transfer -> corte_contorno -> aplicacion_sobre_objeto`

### Drivers de costo clave

- capas (color/blanco/barniz/primer segun equipo)
- film A/B y laminacion
- precision de corte y descarte

## 6) `impresora_uv_mesa_extensora`

### Plantillas de proceso sugeridas

- `uv_mesa_extensora_carteleria`
- `uv_mesa_extensora_multicapa`

### Flujo base

`preflight_capas -> setup_jig_o_mesa -> impresion_uv -> control_tactil/color -> terminacion`

### Drivers de costo clave

- setup de jig y posicionamiento
- capas de tinta (incluye blanco/barniz/primer)
- tiempos de curado por modo

## 7) `impresora_uv_cilindrica`

### Plantillas de proceso sugeridas

- `uv_cilindrico_360`

### Flujo base

`preflight_circunferencia -> setup_rotativo -> impresion_360 -> curado -> control_alineacion`

### Drivers de costo clave

- setup de eje/rotacion por diametro
- velocidad por geometria
- merma por mala alineacion inicial

## 8) `impresora_uv_flatbed`

### Plantillas de proceso sugeridas

- `uv_flatbed_directo`
- `uv_flatbed_multicapa_efectos`

### Flujo base

`preflight_capas -> setup_sustrato -> impresion_uv_plana -> curado -> control`

### Drivers de costo clave

- consumo de blanco/barniz/primer
- tiempos por capas
- manipuleo de sustrato rigido

## 9) `impresora_uv_rollo`

### Plantillas de proceso sugeridas

- `uv_rollo_print_cut`
- `uv_rollo_multicapa`

### Flujo base

`preflight -> setup_rollo -> impresion_uv_rollo -> opcional_laminado -> corte_contorno`

### Drivers de costo clave

- velocidad por modo/calidad
- compensacion por deformacion (registro)
- laminado y corte

## 10) `impresora_solvente`

### Plantillas de proceso sugeridas

- `solvente_rollo_print_cut`
- `solvente_rollo_laminado`

### Flujo base

`preflight -> setup_rollo -> impresion_solvente -> secado_outgassing -> laminado -> corte`

### Drivers de costo clave

- tinta + metraje
- tiempo de secado/estabilizacion
- merma en print&cut

## 11) `impresora_inyeccion_tinta`

### Plantillas de proceso sugeridas

- `inkjet_rollo_estandar`
- `inkjet_rollo_con_terminacion`

### Flujo base

`preflight -> setup -> impresion -> secado/curado_seg_tecnologia -> terminacion`

### Drivers de costo clave

- velocidad por modo
- cobertura de tinta
- tiempo de secado

## 12) `impresora_latex`

### Plantillas de proceso sugeridas

- `latex_rollo_print_cut`
- `latex_rollo_laminado`

### Flujo base

`preflight -> setup_rollo -> impresion_latex -> registro_para_corte -> corte_contorno`

### Drivers de costo clave

- tiempo de setup por sustrato
- registro OPOS/barcode para print&cut
- consumo tinta + material

## 13) `impresora_sublimacion_gran_formato`

### Plantillas de proceso sugeridas

- `sublimacion_transfer_textil`
- `sublimacion_transfer_hardgoods`

### Flujo base

`diseno_espejado -> impresion_papel_transfer -> preparado_prensa -> transferencia_termica -> enfriado_retiro_papel -> control`

### Drivers de costo clave

- consumo papel transfer + tinta
- tiempos de plancha/calandra
- merma por transferencia incompleta

## 14) `impresora_laser` (digital hoja)

### Plantillas de proceso sugeridas

- `digital_hoja_simplex`
- `digital_hoja_duplex_terminado`

### Flujo base

`preflight_pdf -> setup_papel -> impresion -> opcional_terminacion_inline_offline -> control`

### Drivers de costo clave

- setup por soporte/gramaje
- click-cost o costo por copia
- tiempo de terminacion (si aplica)

## 15) `plotter_cad`

### Plantillas de proceso sugeridas

- `cad_plot_mono`
- `cad_plot_color_lote`

### Flujo base

`recepcion_archivo_tecnico -> batch_print -> ploteo -> corte_formato -> control_lineas_texto`

### Drivers de costo clave

- tiempo de procesamiento y cola
- velocidad de salida por calidad
- consumo de papel y tinta

## 16) `mesa_de_corte`

### Plantillas de proceso sugeridas

- `mesa_corte_digital_plano`
- `mesa_hendido_perforado_plano`

### Flujo base

`import_corte -> registro_marcas -> corte_hendido_perforado -> depanelizado -> control`

### Drivers de costo clave

- tiempo de registro/camara
- herramientas usadas
- merma por desviacion de registro

## 17) `plotter_de_corte`

### Plantillas de proceso sugeridas

- `plotter_corte_contorno_rollo`
- `plotter_vinilo_texto_logos`

### Flujo base

`carga_contornos -> impresion_marcas_si_aplica -> lectura_marcas -> corte_kiss_o_full -> descarte_pelado`

### Drivers de costo clave

- lectura de marcas y realineacion
- velocidad/presion de cuchilla
- tiempos de pelado y aplicacion

## Mapa de compatibilidad (resumen)

### Vinculo proceso-maquina

Regla recomendada:

- cada `ProcesoOperacion` debe tener `plantillaMaquinariaCompatible[]`
- `maquinaId` solo se permite si su plantilla pertenece al set compatible

### Vinculo proceso-centro de costo

Regla recomendada:

- `centroCostoId` obligatorio en todas las operaciones productivas
- sin tarifa publicada del periodo -> resultado tecnico en estado `provisorio` o bloqueo

## Estructura de plantilla de proceso (propuesta tecnica)

```ts
type PlantillaProcesoSistema = {
  id: string;
  nombre: string;
  familia: string;
  plantillaMaquinariaCompatibles: string[];
  operaciones: Array<{
    codigo: string;
    nombre: string;
    tipoOperacion: "preprensa" | "impresion" | "corte" | "terminacion" | "logistica" | "tercerizado";
    obligatoria: boolean;
    unidadEntrada: "ninguna" | "hora" | "minuto" | "hoja" | "copia" | "a4_equiv" | "m2" | "metro_lineal" | "pieza" | "ciclo" | "unidad" | "kg" | "litro" | "lote";
    unidadSalida: "ninguna" | "hora" | "minuto" | "hoja" | "copia" | "a4_equiv" | "m2" | "metro_lineal" | "pieza" | "ciclo" | "unidad" | "kg" | "litro" | "lote";
    unidadTiempo: "hora" | "minuto";
    setupMinDefault?: number;
    cleanupMinDefault?: number;
    modoProductividadDefault: "fija" | "formula" | "tabla";
    reglaVelocidadDefault?: Record<string, unknown>;
    reglaMermaDefault?: Record<string, unknown>;
  }>;
};
```

## Prioridad recomendada para implementacion V1

### Alta prioridad (impacto comercial alto)

1. `impresora_laser`
2. `impresora_latex`
3. `impresora_solvente`
4. `impresora_uv_rollo`
5. `impresora_uv_flatbed`
6. `plotter_de_corte`
7. `mesa_de_corte`

### Prioridad media

8. `impresora_dtf`
9. `impresora_sublimacion_gran_formato`
10. `router_cnc`
11. `corte_laser`
12. `plotter_cad`

### Prioridad siguiente iteracion

13. `impresora_dtf_uv`
14. `impresora_uv_cilindrica`
15. `impresora_uv_mesa_extensora`
16. `impresora_inyeccion_tinta`
17. `impresora_3d`

## Integracion con el futuro modulo `Productos y servicios`

Si: ese modulo deberia combinar `Producto/Servicio + Proceso + Maquina + Costos`.

Propuesta de relacion:

1. `ProductoServicio` referencia una o mas `ProcesoDefinicion` permitidas.
2. `ProcesoDefinicion` define la ruta operativa y consumo tecnico.
3. `Operacion` referencia centro y opcional maquina/perfil.
4. Costos calcula tarifa por centro y periodo.
5. Cotizacion usa ese snapshot tecnico para precio base.

## Riesgos a controlar antes de implementar

1. Querer cubrir todos los edge-cases en V1.
2. Mezclar reglas de cotizacion comercial con logica tecnica de proceso.
3. No normalizar unidades (rompe comparacion y costos).
4. Dejar procesos sin versionado (rompe trazabilidad futura).

## Fuentes usadas (oficiales / primarias)

- PrintVis Job Costing: [learn.printvis.com/Legacy/JobCosting/JobCosting](https://learn.printvis.com/Legacy/JobCosting/JobCosting/)
- PrintVis Estimating: [learn.printvis.com/Legacy/Estimation/Estimating](https://learn.printvis.com/Legacy/Estimation/Estimating/)
- PrintVis Speed Tables: [learn.printvis.com/Legacy/Estimation/SpeedTable](https://learn.printvis.com/Legacy/Estimation/SpeedTable/)
- PrintVis Scrap Tables: [learn.printvis.com/Legacy/Estimation/ScrapTable](https://learn.printvis.com/Legacy/Estimation/ScrapTable/)
- PrintVis Cost Center Configurations: [learn.printvis.com/Pages/pvscostcenterconfig](https://learn.printvis.com/Pages/pvscostcenterconfig/)
- Odoo Work Centers (v19): [odoo.com/documentation/19.0/.../using_work_centers.html](https://www.odoo.com/documentation/19.0/applications/inventory_and_mrp/manufacturing/advanced_configuration/using_work_centers.html)
- ERPNext Workstation: [docs.frappe.io/erpnext/workstation](https://docs.frappe.io/erpnext/workstation)
- ERPNext Routing: [docs.frappe.io/erpnext/v13/user/manual/en/manufacturing/routing](https://docs.frappe.io/erpnext/v13/user/manual/en/manufacturing/routing)
- CIP4 JDF/XJDF overview: [cip4.org/print-automation/jdf](https://www.cip4.org/print-automation/jdf)
- CIP4 What is ICS: [cip4.org/print-automation/ics](https://www.cip4.org/print-automation/ics)
- CIP4 MIS ICS 2.2 (PDF): [cip4.org/files/cip4/documents/Management%20Information%20System%20ICS%202.2.pdf](https://www.cip4.org/files/cip4/documents/Management%20Information%20System%20ICS%202.2.pdf)
- CIP4 IDP ICS update (2026-01-13): [cip4.org/news-detail/cip4-publishes-a-new-version-of-the-integrated-digital-printing-ics](https://www.cip4.org/news-detail/cip4-publishes-a-new-version-of-the-integrated-digital-printing-ics)
- Epson DTF Film Printing Guide (PDF): [files.support.epson.com/docid/other/cmp0437-00_en.pdf](https://files.support.epson.com/docid/other/cmp0437-00_en.pdf)
- Mimaki DTF product/news:
  - [mimaki.com/news/product/entry-402725.html/1000](https://mimaki.com/news/product/entry-402725.html/1000/)
  - [mimaki.com/product/inkjet/dtf/txf300-75](https://mimaki.com/product/inkjet/dtf/txf300-75/)
- HP Latex Print&Cut workflow:
  - [lkc.hp.com/printers/hp-latex-115-pc/blog/introducing-hp-flexiprint-and-cut-rip](https://lkc.hp.com/printers/hp-latex-115-pc/blog/introducing-hp-flexiprint-and-cut-rip)
  - [lkc.hp.com/storage/app/uploads/public/612/66e/0fc/61266e0fcb034652634474.pdf](https://lkc.hp.com/storage/app/uploads/public/612/66e/0fc/61266e0fcb034652634474.pdf)
  - [lkc.hp.com/applications/good-practices-ensure-correct-cutting-accuracy-hp-latex-print-and-cut-solution](https://lkc.hp.com/applications/good-practices-ensure-correct-cutting-accuracy-hp-latex-print-and-cut-solution)
- HP Latex white workflow: [lkc.hp.com/blog/hp-latex-white-ink-workflow-printing-white-ink](https://lkc.hp.com/blog/hp-latex-white-ink-workflow-printing-white-ink)
- Roland UV / print&cut:
  - [global.rolanddg.com/products/printers/dgxpress-ug-series](https://global.rolanddg.com/products/printers/dgxpress-ug-series)
  - [rolanddg.com/en/news/2023/231018-lg-one-pass-multilayer](https://www.rolanddg.com/en/news/2023/231018-lg-one-pass-multilayer)
  - [downloadcenter.rolanddg.com/.../Print%20%26%20Cut%20in%20Tool%20Mode](https://downloadcenter.rolanddg.com/contents/manuals/GS2-24_USE_EN/ebi1628142314481.html)
  - [downloadcenter.rolanddg.com/.../Printing%20on%20a%20Cylindrical%20Object](https://downloadcenter.rolanddg.com/contents/manuals/VW6_English/yun1720757613841.html)
- Epson UV/solvente/sublimacion:
  - [epson.com/For-Work/Printers/Large-Format/SureColor-V7000-...](https://epson.com/For-Work/Printers/Large-Format/SureColor-V7000-10-Color-4%27-x-8%27-UV-Flatbed-Printer/p/SCV7000PE)
  - [epson.com/For-Work/Printers/Large-Format/SureColor-S60600-...](https://epson.com/For-Work/Printers/Large-Format/SureColor-S60600-Print-Cut-Edition/p/SCS60600PC)
  - [epson.com/sublimation-printers-for-makers](https://epson.com/sublimation-printers-for-makers)
- Mimaki UV cilindrico:
  - [mimaki.com/product/inkjet/i-option/kebab-mkII-series](https://mimaki.com/product/inkjet/i-option/kebab-mkII-series/)
- Corte digital/registro:
  - [docs.esko.com/.../to_icut_marks.html](https://docs.esko.com/docs/en-us/icutlayoutplus/14/userguide/en-us/common/icp/topic/to_icut_marks.html)
  - [summa.com/media/gkdnxozd/usermanual_goproduceflatbededition_en.pdf](https://www.summa.com/media/gkdnxozd/usermanual_goproduceflatbededition_en.pdf)
- CNC/CAM:
  - [autodesk.com/learn/ondemand/.../creating-a-digital-cam-setup](https://www.autodesk.com/learn/ondemand/course/haas-fusion-360-blueprints-cad-cam-cnc/module/3QoVEIV0axuxs4JmslQshP)
  - [autodesk.com/products/featurecam/overview](https://www.autodesk.com/products/featurecam/overview)
- Laser workflow:
  - [troteclaser.com/.../prepare-screen](https://www.troteclaser.com/en-us/helpcenter/software/ruby/prepare-screen)
  - [troteclaser.com/.../setting-up-and-managing-material-parameters](https://www.troteclaser.com/en-us/helpcenter/software/ruby/setting-up-and-managing-material-parameters)
- Plotter CAD:
  - [downloads.canon.com/nw/pdfs/printers/imagePROGRAF-TZ-Series-Brochure.pdf](https://downloads.canon.com/nw/pdfs/printers/imagePROGRAF-TZ-Series-Brochure.pdf)

## Nota de inferencia

Algunas secuencias operativas del catalogo se infieren a partir de:

- comportamiento tipico de las tecnologias
- guias operativas de fabricantes
- patrones de modelado en MIS/ERP

Estas inferencias se usaron para construir una propuesta implementable y coherente para V1.
