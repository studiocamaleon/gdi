#!/usr/bin/env python3
"""Adaptador JSON estable entre Grafoprint y compas_nest/OpenNest."""

import json
import math
import sys
import time
import traceback
from importlib.metadata import version

SENTINEL = "GRAFO_OPENNEST_RESULT:"


def _emit(payload):
    sys.stdout.write(SENTINEL + json.dumps(payload, separators=(",", ":"), ensure_ascii=False) + "\n")
    sys.stdout.flush()


def _polyline(points, Polyline):
    values = [[float(point["x"]), float(point["y"]), 0.0] for point in points]
    # Los parsers vectoriales pueden devolver el punto de cierre con unas
    # milésimas de milímetro de diferencia. Agregar otro segmento en ese caso
    # crea una cuña microscópica que el motor interpreta como autointersección
    # y termina descartando la pieza completa.
    closing_gap = math.hypot(
        values[0][0] - values[-1][0], values[0][1] - values[-1][1]
    )
    if closing_gap <= 0.01:
        values[-1] = values[0][:]
    else:
        values.append(values[0][:])
    return Polyline(values)


def _transform(points, angle, tx, ty):
    cos_value = math.cos(angle)
    sin_value = math.sin(angle)
    return [
        {
            "x": round(float(point["x"]) * cos_value - float(point["y"]) * sin_value + tx, 6),
            "y": round(float(point["x"]) * sin_value + float(point["y"]) * cos_value + ty, 6),
        }
        for point in points
    ]


def _solve(data):
    from compas.geometry import Polyline
    from compas_nest import (
        nest_geo,
        nest_sheets,
        offset_geo,
        opennest,
        opennest_collision,
    )

    geometry = nest_geo()
    for part in data["piezas"]:
        geometry.add_part(
            _polyline(part["contorno"], Polyline),
            holes=[_polyline(hole, Polyline) for hole in part.get("huecos", [])],
            copies=int(part["cantidad"]),
            rotations=int(part["rotaciones"]),
        )

    separation = float(data["separacionMm"])
    solve_geometry = geometry
    if separation > 0:
        solve_geometry = offset_geo(geometry, separation / 2.0)
        if len(solve_geometry.parts) != len(geometry.parts):
            raise ValueError("La separación configurada consume una o más piezas")
        # La versión actual del helper offset_geo no copia este metadato.
        for index, part in enumerate(data["piezas"]):
            solve_geometry.parts[index]["rotations"] = int(part["rotaciones"])

    sheet = data["placa"]
    margin = float(sheet["margenMm"])
    width = float(sheet["anchoMm"])
    height = float(sheet["altoMm"])
    sheet_outline = Polyline(
        [
            [margin, margin, 0.0],
            [width - margin, margin, 0.0],
            [width - margin, height - margin, 0.0],
            [margin, height - margin, 0.0],
            [margin, margin, 0.0],
        ]
    )
    sheets = nest_sheets()
    for _ in range(int(sheet["maxPlacas"])):
        sheets.add_sheet(sheet_outline)

    # El timeout real lo impone Node matando este proceso. Este presupuesto
    # interno deja un margen breve para serializar y validar el candidato.
    timeout_ms = int(data["timeoutMs"])
    reserve_ms = min(5000, max(1000, timeout_ms * 0.30))
    budget_seconds = max(0.05, (timeout_ms - reserve_ms) / 1000.0)
    rotations = max(int(part["rotaciones"]) for part in data["piezas"])
    requested = sum(int(part["cantidad"]) for part in data["piezas"])
    search_budget_seconds = min(
        budget_seconds,
        max(1.5, min(20.0, requested * rotations * 0.08)),
    )
    if data["motor"] == "collision":
        # El solver collision escala el costo casi linealmente con las
        # iteraciones. Un presupuesto ligado a la tirada evita gastar 20 s en
        # dos rectángulos y conserva exploración suficiente en trabajos reales.
        iterations = min(1200, max(160, requested * 50))
        solver = opennest_collision(
            iterations=iterations,
            num_rotations=rotations,
            spacing=0.0,
            seed=int(data["semilla"]),
            n_starts=1,
            part_holes_mode=1,
            final_compact=2,
            fit_mode=0,
            max_sheets=int(sheet["maxPlacas"]),
            time_budget_secs=search_budget_seconds,
            verbose=False,
        )
    else:
        solver = opennest(
            generations=10000,
            rotations=rotations,
            placement_type=1,
            spacing=0.0,
            seed=int(data["semilla"]),
            use_holes=True,
            try_all_rotations=False,
            mode=2,
            num_seeds=2,
            use_parallel=True,
            time_budget_secs=search_budget_seconds,
            max_sheets=int(sheet["maxPlacas"]),
            verbose=False,
        )

    started = time.monotonic()
    result = solver.solve(solve_geometry, sheets)
    duration_ms = round((time.monotonic() - started) * 1000, 3)
    copies = {}
    placements = []
    for placement in result.placements:
        part_index = int(placement["part_index"])
        part = data["piezas"][part_index]
        part_id = part["id"]
        copy_index = copies.get(part_id, 0)
        copies[part_id] = copy_index + 1
        sheet_id = int(placement["sheet_id"])
        if sheet_id < 0:
            continue
        origin_x, origin_y = result.sheet_origins[sheet_id]
        angle = float(placement["angle"])
        tx = float(placement["tx"]) + float(origin_x)
        ty = float(placement["ty"]) + float(origin_y)
        placements.append(
            {
                "piezaId": part_id,
                "copia": copy_index,
                "placa": sheet_id,
                "rotacionGrados": round(math.degrees(angle), 6),
                "traslacion": {"x": round(tx, 6), "y": round(ty, 6)},
                "contorno": _transform(part["contorno"], angle, tx, ty),
                "huecos": [
                    _transform(hole, angle, tx, ty) for hole in part.get("huecos", [])
                ],
            }
        )

    return {
        "schemaVersion": 1,
        "algoritmo": "opennest-v1",
        "motor": data["motor"],
        "versionMotor": version("compas_nest"),
        "cantidadSolicitada": requested,
        "cantidadColocada": len(placements),
        "placasUsadas": len({placement["placa"] for placement in placements}),
        "duracionMs": duration_ms,
        "placements": placements,
    }


def main():
    try:
        data = json.load(sys.stdin)
        if data.get("schemaVersion") != 1:
            raise ValueError("Versión de contrato no soportada")
        _emit({"ok": True, "result": _solve(data)})
    except Exception as error:
        traceback.print_exc(file=sys.stderr)
        _emit(
            {
                "ok": False,
                "error": {
                    "code": "OPENNEST_RUNNER_ERROR",
                    "message": str(error) or type(error).__name__,
                },
            }
        )
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
