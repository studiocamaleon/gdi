export declare enum TipoCentroCostoDto {
    productivo = "productivo",
    apoyo = "apoyo",
    administrativo = "administrativo",
    comercial = "comercial",
    logistico = "logistico",
    tercerizado = "tercerizado"
}
export declare enum CategoriaGraficaCentroCostoDto {
    preprensa = "preprensa",
    impresion = "impresion",
    terminacion = "terminacion",
    empaque = "empaque",
    logistica = "logistica",
    calidad = "calidad",
    mantenimiento = "mantenimiento",
    administracion = "administracion",
    comercial = "comercial",
    tercerizado = "tercerizado"
}
export declare enum ImputacionPreferidaCentroCostoDto {
    directa = "directa",
    indirecta = "indirecta",
    reparto = "reparto"
}
export declare enum UnidadBaseCentroCostoDto {
    ninguna = "ninguna",
    hora_maquina = "hora_maquina",
    hora_hombre = "hora_hombre",
    pliego = "pliego",
    unidad = "unidad",
    m2 = "m2",
    kg = "kg"
}
export declare class UpsertCentroCostoDto {
    plantaId: string;
    areaCostoId: string;
    codigo: string;
    nombre: string;
    descripcion?: string;
    tipoCentro: TipoCentroCostoDto;
    categoriaGrafica: CategoriaGraficaCentroCostoDto;
    imputacionPreferida: ImputacionPreferidaCentroCostoDto;
    unidadBaseFutura: UnidadBaseCentroCostoDto;
    responsableEmpleadoId?: string;
    activo: boolean;
}
