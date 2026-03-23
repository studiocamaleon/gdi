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
export declare enum EstadoConfiguracionProcesoDto {
    borrador = "borrador",
    incompleta = "incompleta",
    lista = "lista"
}
export declare enum TipoOperacionProcesoDto {
    preprensa = "preprensa",
    prensa = "prensa",
    postprensa = "postprensa",
    acabado = "acabado",
    servicio = "servicio",
    instalacion = "instalacion"
}
export declare enum ModoProductividadProcesoDto {
    fija = "fija",
    variable = "variable"
}
export declare enum ModoProductividadNivelDto {
    fija = "fija",
    variable_manual = "variable_manual",
    variable_perfil = "variable_perfil"
}
export declare enum UnidadProcesoDto {
    ninguna = "ninguna",
    hora = "hora",
    minuto = "minuto",
    hoja = "hoja",
    copia = "copia",
    a4_equiv = "a4_equiv",
    m2 = "m2",
    metro_lineal = "metro_lineal",
    pieza = "pieza",
    corte = "corte",
    ciclo = "ciclo",
    unidad = "unidad",
    kg = "kg",
    litro = "litro",
    lote = "lote"
}
export declare enum BaseCalculoProductividadDto {
    cantidad = "cantidad",
    area_total_m2 = "area_total_m2",
    metro_lineal_total = "metro_lineal_total",
    perimetro_total_ml = "perimetro_total_ml"
}
export declare class ProcesoOperacionItemDto {
    codigo?: string;
    nombre: string;
    tipoOperacion: TipoOperacionProcesoDto;
    centroCostoId?: string;
    maquinaId?: string;
    perfilOperativoId?: string;
    orden?: number;
    setupMin?: number;
    runMin?: number;
    cleanupMin?: number;
    tiempoFijoMin?: number;
    modoProductividad?: ModoProductividadProcesoDto;
    productividadBase?: number;
    unidadEntrada?: UnidadProcesoDto;
    unidadSalida?: UnidadProcesoDto;
    unidadTiempo?: UnidadProcesoDto;
    mermaSetup?: number;
    mermaRunPct?: number;
    reglaVelocidad?: Record<string, unknown>;
    reglaMerma?: Record<string, unknown>;
    detalle?: Record<string, unknown>;
    baseCalculoProductividad?: BaseCalculoProductividadDto;
    niveles?: ProcesoOperacionNivelDto[];
    activo: boolean;
}
export declare class ProcesoOperacionNivelDto {
    id?: string;
    nombre: string;
    orden?: number;
    activo?: boolean;
    modoProductividadNivel: ModoProductividadNivelDto;
    tiempoFijoMin?: number;
    productividadBase?: number;
    unidadSalida?: UnidadProcesoDto;
    unidadTiempo?: UnidadProcesoDto;
    maquinaId?: string;
    perfilOperativoId?: string;
    setupMin?: number;
    cleanupMin?: number;
    detalle?: Record<string, unknown>;
}
export declare class UpsertProcesoDto {
    codigo?: string;
    nombre: string;
    descripcion?: string;
    plantillaMaquinaria?: PlantillaMaquinariaDto;
    estadoConfiguracion?: EstadoConfiguracionProcesoDto;
    activo: boolean;
    observaciones?: string;
    operaciones: ProcesoOperacionItemDto[];
}
