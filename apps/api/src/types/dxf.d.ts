declare module 'dxf' {
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
