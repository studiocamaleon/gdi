#!/usr/bin/env python3
"""Adaptador JSON estable entre Grafoprint y compas_nest/OpenNest."""

import json
import math
import os
import sys
import time
import traceback
from importlib.metadata import version

if os.environ.get('GRAFONEST_GUARD_FD'):
    from process_guard import start_guard
    start_guard()

SENTINEL = "GRAFO_OPENNEST_RESULT:"
_native_handle = None


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


def _solve_until(solver, geometry, sheets, deadline):
    """El plazo es global, incluso cuando el driver nativo reparte tiempo por placa.

    Un snapshot sigue siendo un candidato: Node comprueba demanda, poses,
    solapamientos y separación antes de aceptarlo. No se presupone su validez.
    """
    global _native_handle
    if time.monotonic() >= deadline:
        raise TimeoutError("El presupuesto se agotó preparando la geometría.")
    handle = solver.start(geometry, sheets)
    _native_handle = handle
    while handle.is_running() and time.monotonic() < deadline:
        time.sleep(min(0.02, max(0.0, deadline - time.monotonic())))
    if not handle.is_running():
        return handle.wait()
    handle.cancel()
    grace = time.monotonic() + 0.15
    while handle.is_running() and time.monotonic() < grace:
        time.sleep(0.01)
    return handle.snapshot() if handle.is_running() else handle.wait()


def _solve(data):
    preparation_started = time.monotonic()
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

    # Se cancela el cálculo al vencer el plazo global; Node termina el proceso
    # como respaldo. El margen permite serializar y validar el candidato.
    timeout_ms = int(data["timeoutMs"])
    reserve_ms = min(5000, max(1000, timeout_ms * 0.30))
    budget_seconds = max(0.05, (timeout_ms - reserve_ms) / 1000.0)
    rotations = max(int(part["rotaciones"]) for part in data["piezas"])
    requested = sum(int(part["cantidad"]) for part in data["piezas"])
    # El presupuesto incluye imports y preparación. No se recorta según el
    # número de piezas/rotaciones: los trabajos chicos también pueden ser difíciles.
    budget_seconds = max(0.05, budget_seconds - (time.monotonic() - preparation_started))
    if data["motor"] == "collision":
        # Las primeras vueltas usan un calendario de relajación reproducible.
        # El modo por tiempo cambia ese calendario con la carga de CPU y puede
        # perder una solución alcanzable en pocos cientos de iteraciones.
        # Node conserva el límite externo y continúa la búsqueda si no alcanza.
        iterations = data.get("iteraciones")
        if iterations is not None and (not isinstance(iterations, int) or not 1 <= iterations <= 4000):
            raise ValueError("Presupuesto de iteraciones inválido")
        solver = opennest_collision(
            iterations=iterations or 4000,
            num_rotations=rotations,
            spacing=0.0,
            seed=int(data["semilla"]),
            n_starts=1,
            part_holes_mode=1,
            final_compact=2,
            fit_mode=0,
            max_sheets=int(sheet["maxPlacas"]),
            time_budget_secs=0.0 if iterations else budget_seconds,
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
            try_all_rotations=True,
            # El modo 2 de 0.1.1.post4 ignora tiempo y reemplaza la semilla.
            mode=1,
            num_seeds=1,
            use_parallel=True,
            time_budget_secs=budget_seconds,
            max_sheets=int(sheet["maxPlacas"]),
            verbose=False,
        )

    started = time.monotonic()
    result = _solve_until(
        solver, solve_geometry, sheets,
        preparation_started + (timeout_ms - reserve_ms) / 1000.0,
    )
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
    exit_code = main()
    if _native_handle is not None and _native_handle.is_running():
        # El proceso es descartable. Evita destruir globals de C++ mientras
        # un hilo todavía termina una operación no cancelable; la salida JSON
        # ya fue emitida. El OS libera todos los hilos de este proceso.
        sys.stdout.flush()
        sys.stderr.flush()
        os._exit(exit_code)
    raise SystemExit(exit_code)
