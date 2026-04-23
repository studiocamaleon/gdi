export type BucketsSubtotales = {
    centroCosto: number;
    materiasPrimas: number;
    cargosFlat: number;
};
export type PasoCotizado = {
    id: string;
    tipo: string;
    nombre: string;
    costoCentroCosto: number;
    costoMateriasPrimas: number;
    cargosFlat: number;
    trazabilidad?: Record<string, unknown>;
};
export type CotizacionCanonica = {
    motorCodigo: string;
    motorVersion: number;
    periodo: string;
    cantidad: number;
    total: number;
    unitario: number;
    subtotales: BucketsSubtotales;
    pasos: PasoCotizado[];
    subProductos: CotizacionCanonica[];
    warnings: string[];
    trazabilidad?: Record<string, unknown>;
};
