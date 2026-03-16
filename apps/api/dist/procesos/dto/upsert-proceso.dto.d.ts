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
export declare enum EstadoConfiguracionProcesoDto {
    borrador = "borrador",
    incompleta = "incompleta",
    lista = "lista"
}
export declare enum TipoOperacionProcesoDto {
    preflight = "preflight",
    preprensa = "preprensa",
    impresion = "impresion",
    corte = "corte",
    mecanizado = "mecanizado",
    grabado = "grabado",
    terminacion = "terminacion",
    curado = "curado",
    laminado = "laminado",
    transferencia = "transferencia",
    control_calidad = "control_calidad",
    empaque = "empaque",
    logistica = "logistica",
    tercerizado = "tercerizado",
    otro = "otro"
}
export declare enum ModoProductividadProcesoDto {
    fija = "fija",
    variable = "variable"
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
    ciclo = "ciclo",
    unidad = "unidad",
    kg = "kg",
    litro = "litro",
    lote = "lote"
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
    activo: boolean;
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
