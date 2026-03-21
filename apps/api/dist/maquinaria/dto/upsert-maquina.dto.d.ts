export declare enum PlantillaMaquinariaDto {
    router_cnc = "router_cnc",
    corte_laser = "corte_laser",
    guillotina = "guillotina",
    laminadora_bopp_rollo = "laminadora_bopp_rollo",
    redondeadora_puntas = "redondeadora_puntas",
    perforadora = "perforadora",
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
export declare enum EstadoMaquinaDto {
    activa = "activa",
    inactiva = "inactiva",
    mantenimiento = "mantenimiento",
    baja = "baja"
}
export declare enum EstadoConfiguracionMaquinaDto {
    borrador = "borrador",
    incompleta = "incompleta",
    lista = "lista"
}
export declare enum GeometriaTrabajoMaquinaDto {
    pliego = "pliego",
    rollo = "rollo",
    plano = "plano",
    cilindrico = "cilindrico",
    volumen = "volumen"
}
export declare enum UnidadProduccionMaquinaDto {
    hora = "hora",
    hoja = "hoja",
    copia = "copia",
    ppm = "ppm",
    a4_equiv = "a4_equiv",
    m2 = "m2",
    m2_h = "m2_h",
    metro_lineal = "metro_lineal",
    piezas_h = "piezas_h",
    pieza = "pieza",
    ciclo = "ciclo",
    cortes_min = "cortes_min",
    golpes_min = "golpes_min",
    pliegos_min = "pliegos_min",
    m_min = "m_min"
}
export declare enum TipoPerfilOperativoMaquinaDto {
    impresion = "impresion",
    corte = "corte",
    laminado = "laminado",
    mecanizado = "mecanizado",
    grabado = "grabado",
    fabricacion = "fabricacion",
    mixto = "mixto"
}
export declare enum ModoImpresionPerfilDto {
    cmyk = "cmyk",
    k = "k"
}
export declare enum CarasPerfilDto {
    simple_faz = "simple_faz",
    doble_faz = "doble_faz"
}
export declare enum TipoConsumibleMaquinaDto {
    toner = "toner",
    tinta = "tinta",
    barniz = "barniz",
    primer = "primer",
    film = "film",
    polvo = "polvo",
    adhesivo = "adhesivo",
    resina = "resina",
    lubricante = "lubricante",
    otro = "otro"
}
export declare enum UnidadConsumoMaquinaDto {
    ml = "ml",
    litro = "litro",
    gramo = "gramo",
    kg = "kg",
    unidad = "unidad",
    m2 = "m2",
    metro_lineal = "metro_lineal",
    pagina = "pagina",
    a4_equiv = "a4_equiv"
}
export declare enum TipoComponenteDesgasteMaquinaDto {
    fusor = "fusor",
    drum = "drum",
    drum_opc = "drum_opc",
    developer = "developer",
    developer_unit = "developer_unit",
    charge_unit = "charge_unit",
    drum_cleaning_blade = "drum_cleaning_blade",
    correa_transferencia = "correa_transferencia",
    transfer_belt_itb = "transfer_belt_itb",
    transfer_roller = "transfer_roller",
    fuser_belt = "fuser_belt",
    pressure_roller = "pressure_roller",
    fuser_cleaning_web = "fuser_cleaning_web",
    wax_lubricant_bar = "wax_lubricant_bar",
    fuser_stripper_finger = "fuser_stripper_finger",
    waste_toner_subsystem = "waste_toner_subsystem",
    cabezal = "cabezal",
    lampara_uv = "lampara_uv",
    fresa = "fresa",
    cuchilla = "cuchilla",
    filtro = "filtro",
    kit_mantenimiento = "kit_mantenimiento",
    otro = "otro"
}
export declare enum UnidadDesgasteMaquinaDto {
    copias_a4_equiv = "copias_a4_equiv",
    m2 = "m2",
    metros_lineales = "metros_lineales",
    horas = "horas",
    ciclos = "ciclos",
    piezas = "piezas"
}
export declare class MaquinaPerfilOperativoItemDto {
    id?: string;
    nombre: string;
    tipoPerfil: TipoPerfilOperativoMaquinaDto;
    activo: boolean;
    anchoAplicable?: number;
    altoAplicable?: number;
    operationMode?: string;
    printMode?: ModoImpresionPerfilDto;
    printSides?: CarasPerfilDto;
    productivityValue?: number;
    productivityUnit?: UnidadProduccionMaquinaDto;
    setupMin?: number;
    cleanupMin?: number;
    feedReloadMin?: number;
    sheetThicknessMm?: number;
    maxBatchHeightMm?: number;
    materialPreset?: string;
    cantidadPasadas?: number;
    dobleFaz?: boolean;
    detalle?: Record<string, unknown>;
}
export declare class MaquinaConsumibleItemDto {
    id?: string;
    materiaPrimaVarianteId: string;
    nombre: string;
    tipo: TipoConsumibleMaquinaDto;
    unidad: UnidadConsumoMaquinaDto;
    rendimientoEstimado?: number;
    consumoBase?: number;
    perfilOperativoId?: string;
    activo: boolean;
    detalle?: Record<string, unknown>;
    observaciones?: string;
}
export declare class MaquinaComponenteDesgasteItemDto {
    id?: string;
    materiaPrimaVarianteId: string;
    nombre: string;
    tipo: TipoComponenteDesgasteMaquinaDto;
    vidaUtilEstimada?: number;
    unidadDesgaste: UnidadDesgasteMaquinaDto;
    modoProrrateo?: string;
    activo: boolean;
    detalle?: Record<string, unknown>;
    observaciones?: string;
}
export declare class UpsertMaquinaDto {
    codigo?: string;
    nombre: string;
    plantilla: PlantillaMaquinariaDto;
    plantillaVersion?: number;
    fabricante?: string;
    modelo?: string;
    numeroSerie?: string;
    plantaId: string;
    centroCostoPrincipalId?: string;
    estado: EstadoMaquinaDto;
    estadoConfiguracion?: EstadoConfiguracionMaquinaDto;
    geometriaTrabajo: GeometriaTrabajoMaquinaDto;
    unidadProduccionPrincipal: UnidadProduccionMaquinaDto;
    anchoUtil?: number;
    largoUtil?: number;
    altoUtil?: number;
    espesorMaximo?: number;
    pesoMaximo?: number;
    fechaAlta?: string;
    activo: boolean;
    observaciones?: string;
    parametrosTecnicos?: Record<string, unknown>;
    capacidadesAvanzadas?: Record<string, unknown>;
    perfilesOperativos: MaquinaPerfilOperativoItemDto[];
    consumibles: MaquinaConsumibleItemDto[];
    componentesDesgaste: MaquinaComponenteDesgasteItemDto[];
}
