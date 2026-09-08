"""Inventario y exportación CAD. JSON por stdin/stdout; nunca ejecuta el DXF.

Las curvas nativas se conservan en la exportación. La aproximación de paths es
sólo para nesting, previsualización y métricas identificadas como aproximadas.
"""
import io
import json
import math
import re
import sys
import unicodedata

import ezdxf
from ezdxf import path, transform, xref
from ezdxf.math import Matrix44

ADMITIDOS = {"LINE", "LWPOLYLINE", "POLYLINE", "CIRCLE", "ARC", "ELLIPSE", "SPLINE", "TEXT", "MTEXT", "POINT", "SOLID", "TRACE", "3DFACE"}
UNIDADES = {1: "pulgadas", 2: "pies", 4: "mm", 5: "cm", 6: "m", 9: "mil", 13: "micrones", 14: "dm"}


def leer(contenido):
    doc = ezdxf.read(io.StringIO(contenido, newline=None))
    auditoria = doc.audit()
    if auditoria.has_errors:
        raise ValueError("El DXF contiene errores de estructura que impiden conservar sus entidades.")
    return doc


def inventario(doc):
    resultado = []

    def visitar(e, identidad, padre=None, profundidad=0):
        if profundidad > 16 or len(resultado) >= 1000:
            raise ValueError("El DXF supera el límite de bloques o de 1.000 entidades visibles.")
        capa = e.dxf.get("layer", "0")
        if capa == "0" and padre:
            capa = padre.dxf.layer
        layer = doc.layers.get(capa) if capa in doc.layers else None
        if (layer and (layer.is_off() or layer.is_frozen())) or e.dxf.get("invisible", 0):
            return
        e = e.copy()
        e.dxf.layer = capa
        if padre and e.dxf.get("color", 256) == 0:
            e.dxf.color = padre.dxf.get("color", 256)
            if padre.dxf.hasattr("true_color"):
                e.dxf.true_color = padre.dxf.true_color
        if e.dxftype() == "INSERT":
            if e.mcount > 1:
                for i, instancia in enumerate(e.multi_insert()):
                    visitar(instancia, f"{identidad}/m{i}", padre, profundidad + 1)
                return
            fallos = []
            hijos = list(e.virtual_entities(skipped_entity_callback=lambda entity, reason: fallos.append(reason)))
            if fallos:
                raise ValueError("No se pudo conservar un bloque del DXF: " + "; ".join(fallos))
            for i, hijo in enumerate(hijos):
                visitar(hijo, f"{identidad}/{i}", e, profundidad + 1)
            for i, atributo in enumerate(e.attribs):
                # ATTRIB tiene la geometría de TEXT. La instancia conserva su valor.
                texto = doc.modelspace().add_text(atributo.dxf.text)
                for key in ("insert", "height", "rotation", "style", "layer", "color"):
                    if atributo.dxf.hasattr(key):
                        setattr(texto.dxf, key, getattr(atributo.dxf, key))
                visitar(texto, f"{identidad}/a{i}", e, profundidad + 1)
                doc.modelspace().delete_entity(texto)
            return
        resultado.append((identidad, e))

    for i, e in enumerate(list(doc.modelspace())):
        visitar(e, e.dxf.get("handle", str(i)))
    return resultado


def describir(doc, identidad, e):
    tipo = e.dxftype()
    capa = e.dxf.layer
    layer = doc.layers.get(capa) if capa in doc.layers else None
    aci = e.dxf.get("color", 256)
    if aci in (0, 256):
        aci = abs(layer.dxf.color) if layer else 7
    rgb = e.rgb or (layer.rgb if layer else None) or ezdxf.colors.aci2rgb(aci if 1 <= aci <= 255 else 7)
    color = "#%02x%02x%02x" % tuple(rgb)
    puntos, cerrada, longitud, precision = [], False, None, None
    compatible = tipo in ADMITIDOS
    if compatible and tipo not in {"TEXT", "MTEXT", "POINT"}:
        try:
            p = path.make_path(e)
            # Tolerancia relativa a las coordenadas originales, independiente de INSUNITS.
            control = list(p.control_vertices())
            medida = max((max(v.x for v in control) - min(v.x for v in control)),
                         (max(v.y for v in control) - min(v.y for v in control)), 0.001) if control else 1
            vertices = list(p.flattening(distance=medida * 0.00001, segments=8))
            puntos = [{"x": v.x, "y": -v.y} for v in vertices]
            cerrada = p.is_closed
            longitud = sum((b - a).magnitude for a, b in zip(vertices, vertices[1:]))
            precision = "APROXIMADA"
            if tipo == "LINE":
                precision = "EXACTA"
            elif tipo == "CIRCLE":
                longitud, precision = math.tau * e.dxf.radius, "EXACTA"
            elif tipo == "ARC":
                longitud = math.radians((e.dxf.end_angle - e.dxf.start_angle) % 360) * e.dxf.radius
                precision = "EXACTA"
        except (TypeError, ValueError, AttributeError, NotImplementedError):
            compatible = False
    area = abs(sum(a["x"] * b["y"] - b["x"] * a["y"] for a, b in zip(puntos, puntos[1:] + puntos[:1]))) / 2
    xs, ys = [p["x"] for p in puntos], [p["y"] for p in puntos]
    dato = {"id": identidad, "capa": capa, "tipoEntidad": tipo, "color": color,
            "tipoLinea": e.dxf.get("linetype", "BYLAYER"), "exportable": compatible,
            "puntos": puntos, "cerrada": cerrada, "area": area,
            "apertura": math.hypot(xs[-1] - xs[0], ys[-1] - ys[0]) if xs else 0,
            "ancho": max(xs) - min(xs) if xs else 0, "alto": max(ys) - min(ys) if ys else 0,
            "longitud": longitud, "precisionLongitud": precision}
    if tipo in {"TEXT", "MTEXT"}:
        pos = e.dxf.insert
        dato["texto"] = {"contenido": e.plain_text(), "x": pos.x, "y": -pos.y,
                         "altura": e.dxf.get("height", 1) if tipo == "TEXT" else e.dxf.char_height,
                         "rotacion": -e.dxf.get("rotation", 0)}
    if not compatible:
        dato["motivoNoCompatible"] = f"{tipo}: requiere conversión en el archivo original o exclusión explícita."
    return dato


def inspeccionar(contenido):
    doc = leer(contenido)
    entidades = [describir(doc, identidad, e) for identidad, e in inventario(doc)]
    if sum(len(e["puntos"]) for e in entidades) > 50000:
        raise ValueError("El DXF supera los 50.000 puntos de previsualización.")
    candidatas = sorted((e for e in entidades if e["area"] > 0 and e["exportable"]), key=lambda e: -e["area"])
    if not candidatas:
        raise ValueError("No se encontró una silueta con superficie.")
    unidad = UNIDADES.get(doc.units)
    avisos = [] if unidad else ["El DXF no declara unidades. Confirmá la unidad antes de guardar."]
    avisos.extend(e["motivoNoCompatible"] for e in entidades if not e["exportable"])
    return {"formato": "DXF", "dxfNativo": True, "unidadDeclarada": unidad, "entidades": entidades,
            "sugeridaId": candidatas[0]["id"], "avisos": avisos}


def firma_recurso(e):
    attrs = e.dxf.all_existing_dxf_attribs()
    for key in ("handle", "owner", "name"):
        attrs.pop(key, None)
    if e.dxftype() == "LAYER":
        # Los handles sólo identifican objetos dentro de un documento. Dos
        # archivos con el mismo material/estilo no deben crear capas distintas.
        for key in ("material_handle", "plotstyle_handle"):
            handle = attrs.get(key)
            recurso = e.doc.entitydb.get(handle) if handle and e.doc else None
            if recurso is None:
                continue
            valores = recurso.dxf.all_existing_dxf_attribs()
            for identidad in ("handle", "owner"):
                valores.pop(identidad, None)
            if key == "plotstyle_handle":
                tabla = e.doc.rootdict.get("ACAD_PLOTSTYLENAME")
                nombres = sorted(nombre for nombre, valor in tabla.items() if valor.dxf.handle == handle) if tabla else []
                if not nombres:
                    continue  # No mezclar estilos cuyo significado se desconoce.
                valores["nombres"] = nombres
            attrs[key] = {"tipo": recurso.dxftype(), "definicion": valores}
    if e.dxftype() == "LTYPE":
        attrs["patron"] = [(t.code, t.value) for t in e.pattern_tags.tags]
    return json.dumps(attrs, sort_keys=True, default=str)


def separar_recursos(doc, destino, originales, prefijo):
    # KEEP sólo es seguro cuando las definiciones compartidas coinciden.
    # Un mismo nombre de fuente o tipo de línea puede tener otra definición.
    for tabla_nombre, atributo in (("styles", "style"), ("linetypes", "linetype")):
        tabla, otra = getattr(doc, tabla_nombre), getattr(destino, tabla_nombre)
        cambios = {}
        for recurso in list(tabla):
            nombre = recurso.dxf.name
            if nombre not in otra or firma_recurso(recurso) == firma_recurso(otra.get(nombre)):
                continue
            # Un archivo anterior puede haber resuelto ya este conflicto.
            # Reutilizar su definición evita renombrar la misma capa por copia.
            equivalente = next((r for r in otra if firma_recurso(r) == firma_recurso(recurso)
                                and (r.dxf.name not in tabla or firma_recurso(tabla.get(r.dxf.name)) == firma_recurso(recurso))), None)
            nuevo = equivalente.dxf.name if equivalente is not None else f"{prefijo}_{nombre}"
            if equivalente is None:
                n = 2
                while nuevo in tabla or nuevo in otra:
                    nuevo = f"{prefijo}_{n}_{nombre}"
                    n += 1
            if nuevo not in tabla:
                tabla.duplicate_entry(nombre, nuevo)
            cambios[nombre.casefold()] = nuevo
        for e in originales.values():
            nombre = e.dxf.get(atributo) if e.dxf.is_supported(atributo) else None
            if nombre and nombre.casefold() in cambios:
                setattr(e.dxf, atributo, cambios[nombre.casefold()])
        if atributo == "linetype":
            for layer in doc.layers:
                if layer.dxf.linetype.casefold() in cambios:
                    layer.dxf.linetype = cambios[layer.dxf.linetype.casefold()]


def prefijo_fuente(fuente):
    nombre = fuente.get("nombrePieza") or fuente.get("nombreArchivo") or "Pieza"
    nombre = re.sub(r"\.(dxf|svg)$", "", nombre, flags=re.IGNORECASE)
    nombre = unicodedata.normalize("NFC", nombre)
    nombre = re.sub(r'[<>/\\":;?*|=\x00-\x1f\s]+', "_", nombre).strip("_")
    return nombre[:80] or "Pieza"


def exportar(data):
    destino = leer(data["baseDxf"])
    destino.units = ezdxf.units.MM
    capas = {}
    for layer in destino.layers:
        capas[layer.dxf.name.casefold()] = (firma_recurso(layer), ())
    for fuente in data["fuentes"]:
        doc = leer(fuente["contenido"])
        originales = dict(inventario(doc))
        prefijo = prefijo_fuente(fuente)
        separar_recursos(doc, destino, originales, prefijo)
        fabricacion = fuente["fabricacion"]
        seleccionadas = [r for r in fabricacion["entidades"] if r["conservar"]]
        nombres = {}
        for capa in sorted({r["capa"] for r in seleccionadas}):
            layer = doc.layers.get(capa) if capa in doc.layers else doc.layers.new(capa)
            roles = tuple(sorted({r["rol"] or "REFERENCIA" for r in seleccionadas if r["capa"] == capa}))
            firma = (firma_recurso(layer), roles)
            nombre = capa
            if nombre.casefold() in capas and capas[nombre.casefold()] != firma:
                nombre = f'{prefijo}_{capa}'
            contador = 2
            while (nombre.casefold() in capas and capas[nombre.casefold()] != firma) or (nombre != capa and nombre in doc.layers):
                nombre = f'{prefijo}_{contador}_{capa}'
                contador += 1
            capas[nombre.casefold()] = firma
            nombres[capa] = nombre
            if nombre != capa:
                attrs = layer.dxf.all_existing_dxf_attribs()
                for key in ("handle", "owner", "name"):
                    attrs.pop(key, None)
                doc.layers.new(nombre, dxfattribs=attrs)
        copias = []
        origen = fabricacion["origen"]
        f, minx, miny = origen["factorMm"], origen["minX"], origen["minY"]
        for instancia in fuente["instancias"]:
            a, b, c, d, tx, ty = instancia["transformacion"]
            # CAD -> pieza local (Y invertida) -> placa -> CAD (Y invertida).
            matriz = Matrix44([a*f, -b*f, 0, 0, -c*f, d*f, 0, 0, 0, 0, f, 0,
                               tx-f*(a*minx+c*miny), data["altoMm"]-ty+f*(b*minx+d*miny), 0, 1])
            for recorrido in seleccionadas:
                if instancia.get("soloComplementos") and recorrido["rol"] == "CORTE_EXTERIOR":
                    continue
                identidad = recorrido["entidadId"]
                if identidad not in originales:
                    raise ValueError("La interpretación ya no coincide con el archivo original.")
                e = originales[identidad].copy()
                if e.dxftype() not in ADMITIDOS:
                    raise ValueError("La exportación contiene entidades CAD no compatibles.")
                e.dxf.layer = nombres[recorrido["capa"]]
                errores = transform.inplace([e], matriz)
                if len(errores):
                    raise ValueError("No se pudo transformar una entidad CAD: " + str(list(errores)))
                copias.append(e)
                if recorrido["rol"] == "CORTE_EXTERIOR" and fuente.get("cerrarExterior"):
                    ps = recorrido["puntos"]
                    primero, ultimo = ps[0], ps[-1]
                    def en_placa(p):
                        return (a*p["x"]+c*p["y"]+tx, data["altoMm"]-(b*p["x"]+d*p["y"]+ty))
                    cierre = doc.modelspace().add_line(en_placa(ultimo), en_placa(primero), dxfattribs={"layer": e.dxf.layer})
                    copias.append(cierre.copy())
        doc.modelspace().delete_all_entities()
        for e in copias:
            doc.modelspace().add_entity(e)
        loader = xref.Loader(doc, destino, conflict_policy=xref.ConflictPolicy.KEEP)
        loader.load_modelspace()
        loader.execute()
    if destino.audit().has_errors:
        raise ValueError("El archivo exportado no superó la validación CAD.")
    salida = io.StringIO()
    destino.write(salida)
    return {"dxf": salida.getvalue()}


if __name__ == "__main__":
    try:
        entrada = json.load(sys.stdin)
        resultado = inspeccionar(entrada["contenido"]) if entrada["accion"] == "inspeccionar" else exportar(entrada)
        print(json.dumps(resultado, ensure_ascii=False, allow_nan=False))
    except Exception as error:
        print(json.dumps({"error": str(error)}, ensure_ascii=False))
        sys.exit(1)
