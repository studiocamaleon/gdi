declare module 'dxf' {
  export type DxfEntidad = {
    type: string;
    block?: string;
    rowCount?: number;
    columnCount?: number;
    startAngle?: number;
    endAngle?: number;
    degree?: number;
    knots?: number[];
    controlPoints?: Array<{ x: number; y: number }>;
    vertices?: Array<{ x: number; y: number; bulge?: number }>;
    polyfaceMesh?: boolean;
  };
  export type DxfBox = {
    min: { x: number; y: number };
    max: { x: number; y: number };
    valid: boolean;
  };

  export type DxfPolyline = {
    vertices: Array<[number, number]>;
    layer?: { name?: string; flags?: number; colorNumber?: number };
  };

  export class Helper {
    constructor(contents: string);
    readonly parsed: {
      header?: { insUnits?: number };
      entities: DxfEntidad[];
      blocks: Array<{ name: string; entities: DxfEntidad[] }>;
    };
    readonly denormalised: Array<{
      type?: string;
      handle?: string;
      closed?: boolean;
      visible?: boolean;
      layer?: string;
    }>;
    toSVG(): string;
    toPolylines(): {
      bbox: DxfBox;
      polylines: DxfPolyline[];
    };
  }
}
