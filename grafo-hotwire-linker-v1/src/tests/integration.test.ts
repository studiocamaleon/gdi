import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { CORPOREARTE_POLIFAN_PROFILE, generateHotwireJob, parseSvg } from "../index.js";
import { analyzeTap } from "../tap-analyzer.js";

const sampleSvgPath = new URL("../../samples/puma-logo-placa-1.svg", import.meta.url);
const referenceTapPath = new URL("../../reference/andina.tap", import.meta.url);

test("separa los subpaths de una pieza y conserva el hueco interior", () => {
  const svg = [
    '<svg xmlns="http://www.w3.org/2000/svg" width="120mm" height="60mm" viewBox="0 0 120 60">',
    '<path id="letra-p" data-piece-id="letra-p" d="M20 10 L90 10 L90 50 L20 50 Z M45 20 L70 20 L70 40 L45 40 Z" fill-rule="evenodd" />',
    '</svg>',
  ].join('');

  const parsed = parseSvg(svg);
  assert.equal(parsed.pieces.length, 1);
  assert.equal(parsed.contours.length, 2);
  assert.equal(parsed.contours.filter((contour) => contour.role === "hole").length, 1);

  const job = generateHotwireJob({
    svg,
    profile: {
      bedWidthMm: 120,
      bedHeightMm: 60,
      feedRateMmPerMin: 350,
    },
  });
  const internal = job.bridges.find((bridge) => bridge.kind === "internal");
  assert.ok(internal);
  assert.equal(job.bridges.filter((bridge) => bridge.kind === "internal").length, 1);
  assert.equal(job.metrics.contourCount, 2);

  const bridgeVisits = job.routeSvg.filter((point) => point.bridgeId === internal.id);
  assert.equal(bridgeVisits.length, 2);
  assert.deepEqual(
    { x: bridgeVisits[0].x, y: bridgeVisits[0].y },
    internal.b?.point,
  );
  assert.deepEqual(
    { x: bridgeVisits[1].x, y: bridgeVisits[1].y },
    internal.a?.point,
  );
});

test("genera una red continua para el SVG real de Grafo", () => {
  const svg = fs.readFileSync(sampleSvgPath, "utf8");
  const job = generateHotwireJob({ svg, sourceName: "puma-logo-placa-1.svg" });

  assert.equal(job.parsed.widthMm, 1200);
  assert.equal(job.parsed.heightMm, 600);
  assert.equal(job.parsed.pieces.length, 7);
  assert.equal(job.parsed.contours.length, 11);
  assert.equal(job.bridges.length, 11);
  assert.equal(job.bridges.filter((bridge) => bridge.kind === "origin").length, 1);
  assert.equal(job.bridges.filter((bridge) => bridge.kind === "internal").length, 4);

  assert.deepEqual(
    { x: job.routeMachine[0].x, y: job.routeMachine[0].y },
    { x: 0, y: 0 },
  );
  assert.deepEqual(
    { x: job.routeMachine.at(-1)?.x, y: job.routeMachine.at(-1)?.y },
    { x: 0, y: 0 },
  );

  const xs = job.routeMachine.map((point) => point.x);
  const ys = job.routeMachine.map((point) => point.y);
  assert.ok(Math.min(...xs) >= -1e-8);
  assert.ok(Math.min(...ys) >= -1e-8);
  assert.ok(Math.max(...xs) <= CORPOREARTE_POLIFAN_PROFILE.bedWidthMm);
  assert.ok(Math.max(...ys) <= CORPOREARTE_POLIFAN_PROFILE.bedHeightMm);
});

test("emite el dialecto TAP observado en VectorLinker", () => {
  const svg = fs.readFileSync(sampleSvgPath, "utf8");
  const job = generateHotwireJob({ svg });
  const expectedHeader = [
    "G17 G90 G21",
    "G94",
    "G92 X0 Y0 Z0",
    "G54",
    "T08",
    "G00 S0 M03",
    "Z.24",
    "G1 F350 ",
    "X0.000000 Y0.000000",
    "X0.000000 Y0.000000",
  ].join("\r\n");

  assert.ok(job.tap.startsWith(expectedHeader));
  assert.ok(job.tap.endsWith("X0.000000 Y0.000000\r\n\r\n"));
  assert.ok(!job.tap.includes("M30"));
  assert.ok(!job.tap.includes(";"));

  const analysis = analyzeTap(job.tap);
  assert.equal(analysis.lineEnding, "CRLF");
  assert.equal(analysis.feedRateMmPerMin, 350);
  assert.deepEqual(analysis.decimalsObserved, [6]);
  assert.equal(analysis.closed, true);
  assert.deepEqual(analysis.start, { x: 0, y: 0 });
  assert.deepEqual(analysis.end, { x: 0, y: 0 });
});

test("el analizador reproduce las propiedades del TAP de referencia andina.tap", () => {
  const tap = fs.readFileSync(referenceTapPath, "utf8");
  const analysis = analyzeTap(tap);

  assert.equal(analysis.lineEnding, "CRLF");
  assert.deepEqual(analysis.headerLines, [
    "G17 G90 G21",
    "G94",
    "G92 X0 Y0 Z0",
    "G54",
    "T08",
    "G00 S0 M03",
    "Z.24",
    "G1 F350 ",
  ]);
  assert.equal(analysis.coordinateCount, 21407);
  assert.equal(analysis.zeroLengthMoves, 95);
  assert.equal(analysis.closed, true);
  assert.ok(Math.abs((analysis.bounds?.maxX ?? 0) - 1226.961331) < 1e-6);
  assert.ok(Math.abs((analysis.bounds?.maxY ?? 0) - 555.855823) < 1e-6);
  assert.ok(Math.abs(analysis.routeLengthMm - 26568.59954) < 1e-3);
});
