/* eslint-disable @typescript-eslint/no-require-imports */

const SCHEMAS = {
  hoja_impresa: [
    ['medidas', 'Medidas/Formato'],
    ['material', 'Material'],
    ['caras', 'Caras'],
    ['impresion', 'Impresión/Color'],
  ],
  editorial: [
    ['formato_medidas', 'Formato/Medidas'],
    ['tipo_copia', 'Tipo de copia'],
    ['hojas_por_talonario', 'Hojas por talonario/block'],
    ['numeracion', 'Numeración'],
    ['encuadernacion_base', 'Encuadernación base'],
  ],
  gran_formato: [
    ['medidas', 'Medidas'],
    ['material', 'Material'],
    ['tecnologia', 'Tecnología'],
    ['uso_aplicacion', 'Uso/Aplicación'],
  ],
  rigido: [
    ['medidas', 'Medidas'],
    ['material', 'Material'],
    ['espesor', 'Espesor'],
    ['tecnologia', 'Tecnología/Proceso'],
    ['tipo_pieza', 'Tipo de pieza'],
  ],
  packaging: [
    ['medidas', 'Medidas'],
    ['material', 'Material'],
    ['tipo_pieza', 'Tipo de pieza'],
    ['sistema_estructural', 'Sistema estructural'],
  ],
  textil: [
    ['prenda_base', 'Prenda/Base'],
    ['tecnica', 'Técnica'],
    ['ubicacion', 'Ubicación'],
    ['color_talle', 'Color/Talle'],
  ],
  objeto_personalizado: [
    ['objeto_base', 'Objeto/Base'],
    ['material', 'Material'],
    ['tecnica', 'Técnica'],
    ['area_aplicacion', 'Área de aplicación'],
  ],
  proceso_decorativo: [
    ['servicio_proceso', 'Servicio/Proceso'],
    ['material_base', 'Material base'],
    ['formato_medidas', 'Medidas/Formato'],
    ['espesor', 'Espesor'],
  ],
  terminacion: [
    ['servicio_vendido', 'Servicio vendido'],
    ['material_base', 'Material base'],
    ['formato_medidas', 'Formato/Medidas'],
    ['detalle_tecnico', 'Detalle técnico'],
  ],
  instalacion: [
    ['zona', 'Zona'],
    ['superficie', 'Superficie'],
    ['altura_dificultad', 'Altura/Dificultad'],
    ['m2_medidas_instaladas', 'm² o medidas instaladas'],
    ['tipo_soporte_pieza', 'Tipo de soporte/pieza'],
  ],
  servicio: [
    ['tipo_servicio', 'Tipo de servicio'],
    ['alcance', 'Alcance'],
    ['horas_estimadas', 'Horas estimadas'],
    ['entregable', 'Entregable'],
  ],
};

function schema(template) {
  return SCHEMAS[template].map(([key, label], index) => ({
    key,
    label,
    tipo: 'text',
    visible: true,
    orden: (index + 1) * 10,
  }));
}

const CATEGORIAS_COMERCIALES = [
  ['impresion_hoja', 'Impresión comercial en hoja', 'Productos impresos sobre papel, cartulina o adhesivo en hoja.'],
  ['editorial_encuadernacion', 'Editorial, formularios y encuadernación', 'Productos editoriales, talonarios, blocks y piezas encuadernadas.'],
  ['gran_formato_flexible', 'Gran formato flexible', 'Vinilos, lonas, banners, displays y soportes flexibles por área.'],
  ['senalectica_rigidos', 'Señalética, rígidos y corpóreos', 'Rígidos impresos, placas, carteles y letras corpóreas.'],
  ['packaging_pop', 'Packaging, troquelado y POP', 'Packaging, etiquetas, troquelados y exhibidores POP.'],
  ['textil_personalizacion', 'Textil y personalización', 'Indumentaria, transfer, objetos personalizados y merchandising.'],
  ['grabado_corte_decorativo', 'Grabado, corte y decoración especial', 'Grabado láser, corte láser/CNC y acabados decorativos especiales.'],
  ['terminaciones_postproduccion', 'Terminaciones y postproducción', 'Laminados, barnices, plegados, perforados y modificaciones.'],
  ['carteleria_montaje', 'Cartelería estructural, luminosos e instalación', 'Estructuras, luminosos, montaje e instalación en sitio.'],
  ['servicios_logistica', 'Servicios profesionales, logística y custom', 'Diseño, pruebas, toma de medidas, envío y productos a medida.'],
].map(([codigo, nombre, descripcion], index) => ({
  codigo,
  nombre,
  descripcion,
  orden: index + 1,
}));

const SUBCATEGORIAS_COMERCIALES = [
  ['impresion_hoja', 'tarjetas', 'Tarjetas', 'Tarjetas personales, comerciales y piezas chicas en hoja.', 'hoja_impresa'],
  ['impresion_hoja', 'volantes_folletos', 'Volantes y folletos', 'Volantes, flyers, dípticos y trípticos impresos en hoja.', 'hoja_impresa'],
  ['impresion_hoja', 'papeleria_comercial', 'Papelería comercial', 'Membretes, sobres, carpetas simples y papelería institucional.', 'hoja_impresa'],
  ['impresion_hoja', 'stickers_hoja', 'Stickers en hoja', 'Stickers y calcomanías impresas en hoja.', 'hoja_impresa'],
  ['impresion_hoja', 'postales_invitaciones', 'Postales e invitaciones', 'Piezas sociales, invitaciones, postales y tarjetas especiales.', 'hoja_impresa'],
  ['editorial_encuadernacion', 'talonarios', 'Talonarios', 'Talonarios numerados, duplicados y triplicados.', 'editorial'],
  ['editorial_encuadernacion', 'blocks_formularios', 'Blocks y formularios', 'Blocks, formularios, remitos y piezas autocopiativas.', 'editorial'],
  ['editorial_encuadernacion', 'revistas_cuadernillos', 'Revistas y cuadernillos', 'Revistas, catálogos, cuadernillos y publicaciones simples.', 'editorial'],
  ['editorial_encuadernacion', 'anillados_wire_o', 'Anillados y wire-o', 'Anillados plásticos, wire-o y encuadernaciones con espiral.', 'editorial'],
  ['editorial_encuadernacion', 'engrapados', 'Engrapados', 'Cuadernillos, revistas y piezas engrapadas.', 'editorial'],
  ['gran_formato_flexible', 'vinilos_impresos', 'Vinilos impresos', 'Vinilo adhesivo impreso, laminado o instalado.', 'gran_formato'],
  ['gran_formato_flexible', 'vinilos_corte', 'Vinilos de corte', 'Vinilo de corte, letras adhesivas y calcos sin impresión full color.', 'gran_formato'],
  ['gran_formato_flexible', 'lonas_banners', 'Lonas y banners', 'Lonas impresas, banners, front, back y blockout.', 'gran_formato'],
  ['gran_formato_flexible', 'mesh_microperforado', 'Mesh y microperforado', 'Materiales perforados o mesh para vidrieras, fachadas y exterior.', 'gran_formato'],
  ['gran_formato_flexible', 'rollups_displays', 'Roll-ups y displays', 'Roll-ups, portabanners y displays transportables.', 'gran_formato'],
  ['senalectica_rigidos', 'rigidos_impresos', 'Rígidos impresos', 'PVC, MDF, acrílico, foam y rígidos impresos o intervenidos.', 'rigido'],
  ['senalectica_rigidos', 'senaletica_placas', 'Señalética y placas', 'Placas, señalética interior/exterior y nomencladores.', 'rigido'],
  ['senalectica_rigidos', 'letras_corporeas', 'Letras corpóreas', 'Letras corpóreas en MDF, acrílico, PVC, metal o similares.', 'rigido'],
  ['senalectica_rigidos', 'cuadros_decorativos', 'Cuadros decorativos', 'Cuadros, bastidores, placas decorativas y piezas de interior.', 'rigido'],
  ['senalectica_rigidos', 'carteles_con_forma', 'Carteles con forma', 'Carteles rígidos cortados con forma, router o láser.', 'rigido'],
  ['packaging_pop', 'cajas_packaging', 'Cajas y packaging', 'Cajas, estuches, fajas y piezas de packaging.', 'packaging'],
  ['packaging_pop', 'troquelados_digitales', 'Troquelados digitales', 'Piezas con corte digital, formas especiales y prototipos.', 'packaging'],
  ['packaging_pop', 'exhibidores_pop', 'Exhibidores POP', 'Exhibidores, displays, piezas de punto de venta y material POP.', 'packaging'],
  ['packaging_pop', 'etiquetas_packaging', 'Etiquetas de packaging', 'Etiquetas, fajas, stickers y aplicaciones para packaging.', 'packaging'],
  ['textil_personalizacion', 'remeras_indumentaria', 'Remeras e indumentaria', 'Prendas impresas, estampadas o personalizadas.', 'textil'],
  ['textil_personalizacion', 'dtf_transfer', 'DTF y transfer', 'Transfers DTF, DTG, sublimación y aplicaciones térmicas.', 'textil'],
  ['textil_personalizacion', 'objetos_personalizados', 'Objetos personalizados', 'Tazas, llaveros, placas, regalos y objetos intervenidos.', 'objeto_personalizado'],
  ['textil_personalizacion', 'merchandising', 'Merchandising', 'Merchandising promocional y productos seriados personalizados.', 'objeto_personalizado'],
  ['grabado_corte_decorativo', 'grabado_laser', 'Grabado láser', 'Grabado superficial sobre acrílico, madera, metal, cuero u objetos.', 'proceso_decorativo'],
  ['grabado_corte_decorativo', 'corte_laser', 'Corte láser', 'Corte láser de placas, piezas y formas complejas.', 'proceso_decorativo'],
  ['grabado_corte_decorativo', 'corte_cnc', 'Corte CNC', 'Router CNC, cortes, fresados y piezas rígidas mecanizadas.', 'proceso_decorativo'],
  ['grabado_corte_decorativo', 'hotstamping_dorado_gofrado', 'Hotstamping, dorado y gofrado', 'Acabados decorativos con foil, relieve, gofrado o matrices.', 'proceso_decorativo'],
  ['terminaciones_postproduccion', 'laminados_plastificados', 'Laminados y plastificados', 'Laminados, plastificados y films protectores.', 'terminacion'],
  ['terminaciones_postproduccion', 'barnices', 'Barnices', 'Barnices UV, al agua, sectorizados o protectores.', 'terminacion'],
  ['terminaciones_postproduccion', 'plegados', 'Plegados', 'Plegados simples, dípticos, trípticos, acordeón y similares.', 'terminacion'],
  ['terminaciones_postproduccion', 'perforados_puntillados', 'Perforados y puntillados', 'Perforaciones, puntillados, troqueles simples y desprendibles.', 'terminacion'],
  ['terminaciones_postproduccion', 'numerado_redondeado_modificaciones', 'Numerado, redondeado y modificaciones', 'Numeración, redondeo de puntas y modificaciones manuales/postproducción.', 'terminacion'],
  ['carteleria_montaje', 'estructuras_metalicas', 'Estructuras metálicas', 'Estructuras, marcos, bastidores y herrería para cartelería.', 'rigido'],
  ['carteleria_montaje', 'luminosos_led', 'Luminosos y LED', 'Carteles luminosos, letras iluminadas, módulos LED y fuentes.', 'rigido'],
  ['carteleria_montaje', 'montaje_carteleria', 'Montaje de cartelería', 'Montaje físico, armado estructural y fijaciones de cartelería.', 'instalacion'],
  ['carteleria_montaje', 'instalacion_en_sitio', 'Instalación en sitio', 'Colocación, instalación y trabajo en domicilio del cliente.', 'instalacion'],
  ['servicios_logistica', 'diseno_grafico', 'Diseño gráfico', 'Servicio de diseño, adaptación o preparación de arte.', 'servicio'],
  ['servicios_logistica', 'proof_muestras', 'Proof y muestras', 'Pruebas de color, muestras físicas y prototipos de aprobación.', 'servicio'],
  ['servicios_logistica', 'toma_medidas', 'Toma de medidas', 'Visitas para medición, relevamiento y evaluación técnica.', 'instalacion'],
  ['servicios_logistica', 'envio_despacho', 'Envío y despacho', 'Envío, logística, flete, cadetería y despacho.', 'instalacion'],
  ['servicios_logistica', 'producto_a_medida', 'Producto a medida', 'Producto custom o pendiente de clasificación comercial.', 'servicio'],
].map(([categoriaCodigo, codigo, nombre, descripcion, schemaCodigo], index, all) => ({
  categoriaCodigo,
  codigo,
  nombre,
  descripcion,
  atributosSchemaJson: schema(schemaCodigo),
  orden: all.filter((item) => item[0] === categoriaCodigo).findIndex((item) => item[1] === codigo) + 1,
}));

async function seedCatalogoComercial(prisma) {
  const categoriasPorCodigo = new Map();
  for (const categoria of CATEGORIAS_COMERCIALES) {
    const saved = await prisma.productoCategoriaComercial.upsert({
      where: { codigo: categoria.codigo },
      update: {
        nombre: categoria.nombre,
        descripcion: categoria.descripcion,
        orden: categoria.orden,
        activo: true,
      },
      create: {
        codigo: categoria.codigo,
        nombre: categoria.nombre,
        descripcion: categoria.descripcion,
        orden: categoria.orden,
        activo: true,
      },
    });
    categoriasPorCodigo.set(categoria.codigo, saved);
  }

  const subcategoriasPorCodigo = new Map();
  for (const subcategoria of SUBCATEGORIAS_COMERCIALES) {
    const categoria = categoriasPorCodigo.get(subcategoria.categoriaCodigo);
    const saved = await prisma.productoSubcategoriaComercial.upsert({
      where: { codigo: subcategoria.codigo },
      update: {
        categoriaId: categoria.id,
        nombre: subcategoria.nombre,
        descripcion: subcategoria.descripcion,
        atributosSchemaJson: subcategoria.atributosSchemaJson,
        orden: subcategoria.orden,
        activo: true,
      },
      create: {
        categoriaId: categoria.id,
        codigo: subcategoria.codigo,
        nombre: subcategoria.nombre,
        descripcion: subcategoria.descripcion,
        atributosSchemaJson: subcategoria.atributosSchemaJson,
        orden: subcategoria.orden,
        activo: true,
      },
    });
    subcategoriasPorCodigo.set(subcategoria.codigo, saved);
  }

  return { categoriasPorCodigo, subcategoriasPorCodigo };
}

module.exports = {
  CATEGORIAS_COMERCIALES,
  SUBCATEGORIAS_COMERCIALES,
  seedCatalogoComercial,
};
