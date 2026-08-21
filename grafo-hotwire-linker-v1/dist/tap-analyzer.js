import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
const COORDINATE = /^X([-+]?(?:\d+(?:\.\d*)?|\.\d+))\s+Y([-+]?(?:\d+(?:\.\d*)?|\.\d+))\s*$/i;
function distance(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
}
function pointEquals(a, b, tolerance = 1e-6) {
    return Boolean(a && b && distance(a, b) <= tolerance);
}
export function analyzeTap(tap) {
    const crlf = (tap.match(/\r\n/g) ?? []).length;
    const loneLf = (tap.match(/(?<!\r)\n/g) ?? []).length;
    const lineEnding = crlf > 0 && loneLf === 0 ? "CRLF" : crlf === 0 && loneLf > 0 ? "LF" : "MIXED_OR_UNKNOWN";
    const lines = tap.split(/\r?\n/);
    const points = [];
    const headerLines = [];
    const decimals = new Set();
    let feedRateMmPerMin = null;
    let startedCoordinates = false;
    for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line)
            continue;
        const match = line.match(COORDINATE);
        if (match) {
            startedCoordinates = true;
            points.push({ x: Number(match[1]), y: Number(match[2]) });
            const dx = match[1].split(".")[1]?.length ?? 0;
            const dy = match[2].split(".")[1]?.length ?? 0;
            decimals.add(dx);
            decimals.add(dy);
            continue;
        }
        if (!startedCoordinates)
            headerLines.push(rawLine.replace(/\r$/, ""));
        const feed = line.match(/(?:^|\s)F([-+]?\d*\.?\d+)/i);
        if (feed)
            feedRateMmPerMin = Number(feed[1]);
    }
    let routeLengthMm = 0;
    let zeroLengthMoves = 0;
    for (let i = 1; i < points.length; i += 1) {
        const segment = distance(points[i - 1], points[i]);
        routeLengthMm += segment;
        if (segment <= 1e-9)
            zeroLengthMoves += 1;
    }
    let bounds = null;
    if (points.length > 0) {
        bounds = points.reduce((acc, point) => ({
            minX: Math.min(acc.minX, point.x),
            minY: Math.min(acc.minY, point.y),
            maxX: Math.max(acc.maxX, point.x),
            maxY: Math.max(acc.maxY, point.y),
        }), { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity });
    }
    const start = points[0] ?? null;
    const end = points[points.length - 1] ?? null;
    return {
        lineEnding,
        totalLines: lines.length,
        nonEmptyLines: lines.filter((line) => line.trim().length > 0).length,
        headerLines,
        coordinateCount: points.length,
        zeroLengthMoves,
        start,
        end,
        closed: pointEquals(start, end),
        bounds,
        routeLengthMm,
        feedRateMmPerMin,
        estimatedSeconds: feedRateMmPerMin && feedRateMmPerMin > 0 ? (routeLengthMm / feedRateMmPerMin) * 60 : null,
        decimalsObserved: [...decimals].sort((a, b) => a - b),
    };
}
function main() {
    const input = process.argv[2];
    if (!input)
        throw new Error("Uso: node dist/tap-analyzer.js <archivo.tap> [salida.json]");
    const inputPath = path.resolve(input);
    const analysis = analyzeTap(fs.readFileSync(inputPath, "utf8"));
    const json = JSON.stringify({ file: path.basename(inputPath), ...analysis }, null, 2);
    const output = process.argv[3];
    if (output)
        fs.writeFileSync(path.resolve(output), json + "\n");
    console.log(json);
}
const isDirectExecution = Boolean(process.argv[1]) && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isDirectExecution) {
    try {
        main();
    }
    catch (error) {
        console.error(error instanceof Error ? error.stack ?? error.message : String(error));
        process.exitCode = 1;
    }
}
//# sourceMappingURL=tap-analyzer.js.map