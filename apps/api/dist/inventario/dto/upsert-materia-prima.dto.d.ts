export declare enum FamiliaMateriaPrimaDto {
    sustrato = "sustrato",
    tinta_colorante = "tinta_colorante",
    transferencia_laminacion = "transferencia_laminacion",
    quimico_auxiliar = "quimico_auxiliar",
    aditiva_3d = "aditiva_3d",
    electronica_carteleria = "electronica_carteleria",
    neon_luminaria = "neon_luminaria",
    metal_estructura = "metal_estructura",
    pintura_recubrimiento = "pintura_recubrimiento",
    terminacion_editorial = "terminacion_editorial",
    magnetico_fijacion = "magnetico_fijacion",
    pop_exhibidor = "pop_exhibidor",
    herraje_accesorio = "herraje_accesorio",
    adhesivo_tecnico = "adhesivo_tecnico",
    packing_instalacion = "packing_instalacion"
}
export declare enum SubfamiliaMateriaPrimaDto {
    sustrato_hoja = "sustrato_hoja",
    sustrato_rollo_flexible = "sustrato_rollo_flexible",
    sustrato_rigido = "sustrato_rigido",
    objeto_promocional_base = "objeto_promocional_base",
    tinta_impresion = "tinta_impresion",
    toner = "toner",
    film_transferencia = "film_transferencia",
    papel_transferencia = "papel_transferencia",
    laminado_film = "laminado_film",
    quimico_acabado = "quimico_acabado",
    auxiliar_proceso = "auxiliar_proceso",
    polvo_dtf = "polvo_dtf",
    filamento_3d = "filamento_3d",
    resina_3d = "resina_3d",
    modulo_led_carteleria = "modulo_led_carteleria",
    fuente_alimentacion_led = "fuente_alimentacion_led",
    cableado_conectica = "cableado_conectica",
    controlador_led = "controlador_led",
    neon_flex_led = "neon_flex_led",
    accesorio_neon_led = "accesorio_neon_led",
    chapa_metalica = "chapa_metalica",
    perfil_estructural = "perfil_estructural",
    pintura_carteleria = "pintura_carteleria",
    primer_sellador = "primer_sellador",
    anillado_encuadernacion = "anillado_encuadernacion",
    tapa_encuadernacion = "tapa_encuadernacion",
    iman_ceramico_flexible = "iman_ceramico_flexible",
    fijacion_auxiliar = "fijacion_auxiliar",
    accesorio_exhibidor_carton = "accesorio_exhibidor_carton",
    accesorio_montaje_pop = "accesorio_montaje_pop",
    semielaborado_pop = "semielaborado_pop",
    argolla_llavero_accesorio = "argolla_llavero_accesorio",
    ojal_ojalillo_remache = "ojal_ojalillo_remache",
    portabanner_estructura = "portabanner_estructura",
    sistema_colgado_montaje = "sistema_colgado_montaje",
    perfil_bastidor_textil = "perfil_bastidor_textil",
    cinta_doble_faz_tecnica = "cinta_doble_faz_tecnica",
    adhesivo_liquido_estructural = "adhesivo_liquido_estructural",
    velcro_cierre_tecnico = "velcro_cierre_tecnico",
    embalaje_proteccion = "embalaje_proteccion",
    etiquetado_identificacion = "etiquetado_identificacion",
    consumible_instalacion = "consumible_instalacion"
}
export declare enum UnidadMateriaPrimaDto {
    unidad = "unidad",
    pack = "pack",
    caja = "caja",
    kit = "kit",
    hoja = "hoja",
    pliego = "pliego",
    resma = "resma",
    rollo = "rollo",
    metro_lineal = "metro_lineal",
    m2 = "m2",
    m3 = "m3",
    mm = "mm",
    cm = "cm",
    litro = "litro",
    ml = "ml",
    kg = "kg",
    gramo = "gramo",
    pieza = "pieza",
    par = "par"
}
export declare enum PlantillaMaquinariaDto {
    router_cnc = "router_cnc",
    corte_laser = "corte_laser",
    impresora_3d = "impresora_3d",
    impresora_dtf = "impresora_dtf",
    impresora_dtf_uv = "impresora_dtf_uv",
    impresora_uv_mesa_extensora = "impresora_uv_mesa_extensora",
    impresora_uv_cilindrica = "impresora_uv_cilindrica",
    impresora_uv_flatbed = "impresora_uv_flatbed",
    impresora_uv_rollo = "impresora_uv_rollo",
    impresora_solvente = "impresora_solvente",
    impresora_inyeccion_tinta = "impresora_inyeccion_tinta",
    impresora_latex = "impresora_latex",
    impresora_sublimacion_gran_formato = "impresora_sublimacion_gran_formato",
    impresora_laser = "impresora_laser",
    plotter_cad = "plotter_cad",
    mesa_de_corte = "mesa_de_corte",
    plotter_de_corte = "plotter_de_corte"
}
export declare enum ModoUsoCompatibilidadMateriaPrimaDto {
    sustrato_directo = "sustrato_directo",
    tinta = "tinta",
    transferencia = "transferencia",
    laminacion = "laminacion",
    auxiliar = "auxiliar",
    montaje = "montaje",
    embalaje = "embalaje"
}
export declare class MateriaPrimaVarianteItemDto {
    sku: string;
    nombreVariante?: string;
    activo: boolean;
    atributosVariante: Record<string, unknown>;
    unidadStock?: UnidadMateriaPrimaDto;
    unidadCompra?: UnidadMateriaPrimaDto;
    precioReferencia?: number;
    moneda?: string;
    proveedorReferenciaId?: string;
}
export declare class MateriaPrimaCompatibilidadItemDto {
    varianteId?: string;
    varianteSku?: string;
    plantillaMaquinaria?: PlantillaMaquinariaDto;
    maquinaId?: string;
    perfilOperativoId?: string;
    modoUso: ModoUsoCompatibilidadMateriaPrimaDto;
    consumoBase?: number;
    unidadConsumo?: UnidadMateriaPrimaDto;
    mermaBasePct?: number;
    activo: boolean;
}
export declare class UpsertMateriaPrimaDto {
    codigo: string;
    nombre: string;
    descripcion?: string;
    familia: FamiliaMateriaPrimaDto;
    subfamilia: SubfamiliaMateriaPrimaDto;
    tipoTecnico: string;
    templateId: string;
    unidadStock: UnidadMateriaPrimaDto;
    unidadCompra: UnidadMateriaPrimaDto;
    esConsumible: boolean;
    esRepuesto: boolean;
    activo: boolean;
    atributosTecnicos: Record<string, unknown>;
    variantes: MateriaPrimaVarianteItemDto[];
    compatibilidades: MateriaPrimaCompatibilidadItemDto[];
}
