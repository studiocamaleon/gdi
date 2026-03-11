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
    ciclo = "ciclo"
}
export declare enum TipoPerfilOperativoMaquinaDto {
    impresion = "impresion",
    corte = "corte",
    mecanizado = "mecanizado",
    grabado = "grabado",
    fabricacion = "fabricacion",
    mixto = "mixto"
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
    developer = "developer",
    correa_transferencia = "correa_transferencia",
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
    nombre: string;
    tipoPerfil: TipoPerfilOperativoMaquinaDto;
    activo: boolean;
    anchoAplicable?: number;
    altoAplicable?: number;
    modoTrabajo?: string;
    calidad?: string;
    productividad?: number;
    unidadProductividad?: UnidadProduccionMaquinaDto;
    tiempoPreparacionMin?: number;
    tiempoCargaMin?: number;
    tiempoDescargaMin?: number;
    tiempoRipMin?: number;
    cantidadPasadas?: number;
    dobleFaz?: boolean;
    detalle?: Record<string, unknown>;
}
export declare class MaquinaConsumibleItemDto {
    nombre: string;
    tipo: TipoConsumibleMaquinaDto;
    unidad: UnidadConsumoMaquinaDto;
    costoReferencia?: number;
    rendimientoEstimado?: number;
    consumoBase?: number;
    perfilOperativoNombre?: string;
    activo: boolean;
    detalle?: Record<string, unknown>;
    observaciones?: string;
}
export declare class MaquinaComponenteDesgasteItemDto {
    nombre: string;
    tipo: TipoComponenteDesgasteMaquinaDto;
    vidaUtilEstimada?: number;
    unidadDesgaste: UnidadDesgasteMaquinaDto;
    costoReposicion?: number;
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
