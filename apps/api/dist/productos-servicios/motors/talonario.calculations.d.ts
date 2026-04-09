export type TipoCopiaValor = 'COPIA_SIMPLE' | 'DUPLICADO' | 'TRIPLICADO' | 'CUADRUPLICADO';
export type PapelCapa = {
    capaIndex: number;
    capaLabel: string;
    papelVarianteId: string | null;
    colorPapel: string;
};
export type TipoCopiaDefinicion = {
    valor: TipoCopiaValor;
    capas: number;
    numerosXTalonarioSugerido: number;
    papeles: PapelCapa[];
};
export type EncuadernacionConfig = {
    tipo: 'abrochado' | 'emblocado';
    cantidadGrapas?: number | null;
    posicionGrapas?: string | null;
    bordeEncolar?: string | null;
};
export type PuntilladoConfig = {
    habilitado: boolean;
    tipo?: string | null;
    distanciaBordeMm?: number | null;
    borde?: string | null;
};
export type TalonarioMotorConfig = {
    tamanoPliegoImpresion: {
        codigo: string;
        nombre: string;
        anchoMm: number;
        altoMm: number;
    };
    tipoCorte: string;
    demasiaCorteMm: number;
    lineaCorteMm: number;
    mermaAdicionalPct: number;
    numerosXTalonarioDefault: number;
    tipoCopiaDefiniciones: TipoCopiaDefinicion[];
    encuadernacion: EncuadernacionConfig;
    puntillado: PuntilladoConfig;
    modoTalonarioIncompleto: 'aprovechar_pliego' | 'pose_completa';
    materialesExtra: {
        cartonBase: {
            habilitado: boolean;
            materiaPrimaVarianteId?: string | null;
        };
        hojaBlancaSuperior: {
            habilitado: boolean;
            materiaPrimaVarianteId?: string | null;
        };
    };
    numeracion: {
        habilitado: boolean;
        posicion?: string | null;
    };
};
export type ImposicionBase = {
    piezasPorPliego: number;
    orientacion: string;
    cols: number;
    rows: number;
    anchoImprimibleMm: number;
    altoImprimibleMm: number;
    anchoDisponibleMm: number;
    altoDisponibleMm: number;
    demasiaCorteMm: number;
    lineaCorteMm: number;
    piezaAnchoMm: number;
    piezaAltoMm: number;
    piezaAnchoEfectivoMm: number;
    piezaAltoEfectivoMm: number;
    sheetAnchoMm: number;
    sheetAltoMm: number;
    normal: number;
    rotada: number;
    tipoCorte: string;
    machineMargins: {
        leftMm: number;
        rightMm: number;
        topMm: number;
        bottomMm: number;
    };
};
export type TalonarioImposicionResult = ImposicionBase & {
    teteBeche: boolean;
    puntilladoLineMm: number | null;
    puntilladoBorde: string | null;
    encuadernacionTipo: string;
};
export declare function applyTalonarioImposicionConstraints(base: ImposicionBase, config: TalonarioMotorConfig): TalonarioImposicionResult;
export type TalonarioGroupingResult = {
    talonariosEfectivos: number;
    talonariosPedidos: number;
    posesXPliego: number;
    talonariosPorGrupo: number;
    gruposCompletos: number;
    talonariosResiduo: number;
    pliegosXCapa: number;
    pliegosDesperdicio: number;
    numerosXTalonario: number;
    modoIncompleto: string;
};
export declare function calculateTalonarioGrouping(input: {
    cantidadTalonarios: number;
    posesXPliego: number;
    numerosXTalonario: number;
    modoTalonarioIncompleto: 'aprovechar_pliego' | 'pose_completa';
}): TalonarioGroupingResult;
export type PaperLayerCost = {
    capaIndex: number;
    capaLabel: string;
    colorPapel: string;
    papelVarianteId: string | null;
    pliegos: number;
    costoUnitario: number;
    costoTotal: number;
};
export declare function calculateTalonarioPaperCosts(input: {
    pliegosXCapa: number;
    tipoCopiaDefinicion: TipoCopiaDefinicion;
    papelPrecioByVarianteId: Map<string, number>;
    pliegosPorSustratoByVarianteId: Map<string, number>;
}): {
    layers: PaperLayerCost[];
    totalPapel: number;
};
export type ExtraMaterialCost = {
    tipo: string;
    nombre: string;
    cantidad: number;
    costoUnitario: number;
    costoTotal: number;
};
export declare function calculateTalonarioExtraMaterials(input: {
    cantidadTalonarios: number;
    numerosXTalonario: number;
    grouping: TalonarioGroupingResult;
    config: TalonarioMotorConfig;
    materialPrecioByVarianteId: Map<string, number>;
}): {
    items: ExtraMaterialCost[];
    total: number;
};
export type GuillotinadoResult = {
    espesorTalonarioHojas: number;
    talonariosXTanda: number;
    tandas: number;
};
export declare function calculateTalonarioGuillotinado(input: {
    cantidadTalonarios: number;
    numerosXTalonario: number;
    capas: number;
    tieneCarton: boolean;
    tieneHojaBlanca: boolean;
    capacidadMaxHojas: number;
}): GuillotinadoResult;
export declare function parseTalonarioMotorConfig(raw: Record<string, unknown>): TalonarioMotorConfig;
export declare function resolveTipoCopia(config: TalonarioMotorConfig, tipoCopiaSeleccionado: string | null | undefined): TipoCopiaDefinicion | null;
