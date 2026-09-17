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
    assert.deepEqual({ x: bridgeVisits[0].x, y: bridgeVisits[0].y }, internal.b?.point);
    assert.deepEqual({ x: bridgeVisits[1].x, y: bridgeVisits[1].y }, internal.a?.point);
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
    assert.deepEqual({ x: job.routeMachine[0].x, y: job.routeMachine[0].y }, { x: 0, y: 0 });
    assert.deepEqual({ x: job.routeMachine.at(-1)?.x, y: job.routeMachine.at(-1)?.y }, { x: 0, y: 0 });
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
function assertCompleteRoute(job) {
    const contourTravel = new Map();
    for (let i = 1; i < job.routeSvg.length; i += 1) {
        const a = job.routeSvg[i - 1], b = job.routeSvg[i];
        if (b.via === "contour" && b.contourId) {
            contourTravel.set(b.contourId, (contourTravel.get(b.contourId) ?? 0) + Math.hypot(a.x - b.x, a.y - b.y));
        }
    }
    for (const contour of job.parsed.contours) {
        assert.ok(Math.abs((contourTravel.get(contour.id) ?? 0) - contour.perimeter) < 1e-5, `Contorno completo una sola vez: ${contour.id}`);
    }
    for (const bridge of job.bridges) {
        assert.equal(job.routeSvg.filter(p => p.bridgeId === bridge.id).length, 2, `Ida y vuelta por ${bridge.id}`);
        if (bridge.a)
            assert.equal(bridge.aNodeId, bridge.a.contourId);
        if (bridge.b)
            assert.equal(bridge.bNodeId, bridge.b.contourId);
    }
    assert.ok(Math.abs(job.metrics.totalLengthMm - job.metrics.contourLengthMm - job.metrics.bridgeTravelLengthMm) < 1e-5);
    assert.deepEqual({ x: job.routeMachine[0].x, y: job.routeMachine[0].y }, { x: 0, y: 0 });
    assert.deepEqual({ x: job.routeMachine.at(-1).x, y: job.routeMachine.at(-1).y }, { x: 0, y: 0 });
}
const outerRing = '<path id="aro" data-piece-id="aro" d="M10 10 H150 V150 H10 Z M20 20 H140 V140 H20 Z"/>';
const nestedPart = '<path id="pieza" data-piece-id="pieza" d="M50 50 H70 V70 H50 Z"/>';
for (const reverse of [false, true]) {
    test(`conecta una pieza independiente desde el hueco de un aro (orden inverso: ${reverse})`, () => {
        const paths = reverse ? [nestedPart, outerRing] : [outerRing, nestedPart];
        const job = generateHotwireJob({
            svg: `<svg width="160mm" height="160mm" viewBox="0 0 160 160">${paths.join("")}</svg>`,
            profile: { bedWidthMm: 160, bedHeightMm: 160 },
        });
        assert.equal(job.parsed.pieces.length, 2);
        const innerPart = job.parsed.contours.find(c => c.pieceId === "pieza");
        // La contención de otra pieza no altera su identidad ni su material.
        assert.equal(innerPart.role, "outer");
        assert.equal(innerPart.parentContourId, undefined);
        const bridge = job.bridges.find(b => b.kind === "external");
        assert.ok(bridge);
        assert.deepEqual(new Set([bridge.aNodeId, bridge.bNodeId]), new Set(["aro-subpath-2", "pieza"]));
        for (let t = .1; t < 1; t += .1) {
            const x = bridge.a.point.x + t * (bridge.b.point.x - bridge.a.point.x);
            const y = bridge.a.point.y + t * (bridge.b.point.y - bridge.a.point.y);
            assert.ok(x >= 20 && x <= 140 && y >= 20 && y <= 140, 'La conexión permanece en el hueco');
            assert.ok(!(x > 50 && x < 70 && y > 50 && y < 70), 'La conexión no atraviesa la pieza alojada');
        }
        assertCompleteRoute(job);
    });
}
test("conecta varias piezas dentro de un hueco y dos niveles de anidación", () => {
    const svg = `<svg width="160mm" height="160mm" viewBox="0 0 160 160">${outerRing}
    <path id="aro-interior" data-piece-id="aro-interior" d="M30 30 H100 V100 H30 Z M40 40 H90 V90 H40 Z"/>
    ${nestedPart}
    <path id="pieza-vecina" data-piece-id="vecina" d="M115 110 H130 V125 H115 Z"/>
  </svg>`;
    const job = generateHotwireJob({ svg, profile: { bedWidthMm: 160, bedHeightMm: 160 } });
    assert.equal(job.parsed.pieces.length, 4);
    assert.equal(job.bridges.filter(b => b.kind === "internal").length, 2);
    assert.equal(job.bridges.filter(b => b.kind === "external").length, 3);
    assert.equal(job.bridges.filter(b => b.kind === "origin").length, 1);
    assertCompleteRoute(job);
});
for (const placa of [1, 2]) {
    test(`genera el recorrido del Puma de 200 cm en dos placas: placa ${placa}`, () => {
        const svg = fs.readFileSync(new URL(`../../samples/puma-200cm-anidado-placa-${placa}.svg`, import.meta.url), "utf8");
        const job = generateHotwireJob({ svg, profile: { bedWidthMm: 1200, bedHeightMm: 600 } });
        assert.equal(job.parsed.pieces.length, placa === 1 ? 5 : 3);
        assert.equal(job.parsed.contours.length, placa === 1 ? 8 : 4);
        if (placa === 1) {
            const circleHole = "pieza-5-4-subpath-2", letterR = "pieza-7-5-subpath-1";
            assert.ok(job.bridges.some(b => b.kind === "external" &&
                [b.aNodeId, b.bNodeId].includes(circleHole) && [b.aNodeId, b.bNodeId].includes(letterR)));
        }
        assertCompleteRoute(job);
    });
}
//# sourceMappingURL=integration.test.js.map