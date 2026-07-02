import { chmodSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { nestPackingSolverRectangle } from './packingsolver-rectangle';

describe('nestPackingSolverRectangle', () => {
  let workdir: string;

  beforeEach(() => {
    workdir = mkdtempSync(join(tmpdir(), 'gdi-packingsolver-test-'));
  });

  afterEach(() => {
    rmSync(workdir, { recursive: true, force: true });
  });

  it('traduce el certificado de PackingSolver al shape de placements del motor', async () => {
    const fakeBin = join(workdir, 'packingsolver_rectangle_fake.sh');
    writeFileSync(
      fakeBin,
      [
        '#!/bin/sh',
        'cert=""',
        'while [ "$#" -gt 0 ]; do',
        '  if [ "$1" = "--certificate" ]; then shift; cert="$1"; fi',
        '  shift',
        'done',
        'cat > "$cert" <<CSV',
        'TYPE,ID,COPIES,BIN,X,Y,LX,LY,GROUP_ID',
        'BIN,0,1,0,0,0,1840,2760,',
        'ITEM,0,1,0,0,0,1005,505,0',
        'ITEM,1,1,0,1005,0,505,1005,0',
        'CSV',
      ].join('\n'),
    );
    chmodSync(fakeBin, 0o755);

    const result = await nestPackingSolverRectangle(
      [
        { id: 'pieza_0', widthMm: 1000, heightMm: 500, quantity: 1 },
        { id: 'pieza_1', widthMm: 1000, heightMm: 500, quantity: 1 },
      ],
      {
        kind: 'sheet',
        widthMm: 1830,
        heightMm: 2750,
        margins: { leftMm: 15, rightMm: 5, topMm: 5, bottomMm: 5 },
      },
      {
        binaryPath: fakeBin,
        separationHMm: 5,
        separationVMm: 5,
        allowRotation: true,
      },
    );

    expect(result).not.toBeNull();
    expect(result!.algorithm).toBe('packingsolver-rectangle');
    expect(result!.substrates).toHaveLength(1);
    expect(result!.placements).toEqual([
      expect.objectContaining({
        pieceId: 'pieza_0',
        xMm: 15,
        yMm: 5,
        widthMm: 1000,
        heightMm: 500,
        rotated: false,
      }),
      expect.objectContaining({
        pieceId: 'pieza_1',
        xMm: 1020,
        yMm: 5,
        widthMm: 500,
        heightMm: 1000,
        rotated: true,
      }),
    ]);
    expect(result!.perSubstrate[0].consumedLengthMm).toBe(1010);
  });
});
