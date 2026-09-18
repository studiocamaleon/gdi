#!/usr/bin/env python3
"""Prueba física CAD de Grafo, sin enviar trabajos a una impresora.

Requiere reportlab. Desde la raíz: python3 scripts/generar-prueba-cad.py
Salida: output/pdf/grafo-prueba-cad-hp-t950.pdf (A1 y formato 900 x 350 mm).
Las medidas se trazan en mm, sin ninguna transformación de escala de página.
"""

from pathlib import Path

from reportlab.lib.colors import HexColor, CMYKColor
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "output/pdf/grafo-prueba-cad-hp-t950.pdf"
BLACK = HexColor("#101314")
ORANGE = HexColor("#ff6b3b")
GRAY = HexColor("#62676a")
RULE = HexColor("#c7cbcd")


def text(c, x, y, value, size=14, bold=False, color=BLACK, align="left"):
    c.setFont("Geist-Bold" if bold else "Geist", size)
    c.setFillColor(color)
    draw = {"left": c.drawString, "center": c.drawCentredString, "right": c.drawRightString}[align]
    draw(x * mm, y * mm, value)


def line(c, x1, y1, x2, y2, thickness=0.2, color=BLACK):
    c.setStrokeColor(color)
    c.setLineWidth(thickness * mm)
    c.line(x1 * mm, y1 * mm, x2 * mm, y2 * mm)


def rect(c, x, y, w, h, thickness=0.2, color=BLACK):
    c.setStrokeColor(color)
    c.setLineWidth(thickness * mm)
    c.rect(x * mm, y * mm, w * mm, h * mm, fill=0, stroke=1)


def brand(c, x, y):
    # Geometría del isologo actual: src/components/brand/grafoprint-isologo.tsx.
    k = 0.72
    points = [(x + a * k, y - b * k) for a, b in [(5.5, 6.5), (18, 6.5), (12, 17.5)]]
    for a, b in zip(points, points[1:] + points[:1]):
        line(c, *a, *b, thickness=1.4 * k, color=ORANGE)
    c.setFillColor(ORANGE)
    for px, py in points:
        c.circle(px * mm, py * mm, 2.2 * k * mm, stroke=0, fill=1)
    text(c, x + 22, y - 12, "grafoprint", size=32, bold=True)
    tx = (x + 22) * mm + pdfmetrics.stringWidth("grafoprint", "Geist-Bold", 32)
    c.setFillColor(ORANGE)
    c.drawString(tx, (y - 12) * mm, ".")


def frame(c, w, h, page):
    rect(c, 10, 10, w - 20, h - 20, color=RULE)
    for x, y, sx, sy in [(10, 10, 1, 1), (w - 10, 10, -1, 1), (10, h - 10, 1, -1), (w - 10, h - 10, -1, -1)]:
        line(c, x, y, x + 7 * sx, y, 0.45, ORANGE)
        line(c, x, y, x, y + 7 * sy, 0.45, ORANGE)
    text(c, w - 24, h - 30, f"PRUEBA CAD / {page:02d}", 14, color=GRAY, align="right")
    text(c, 24, 17, "Grafo · Validación física de impresión · Medir entre centros de las marcas", 12, color=GRAY)
    text(c, w - 24, 17, f"{page} / 2", 12, color=GRAY, align="right")


def dimension(c, x1, y1, x2, y2, label, vertical=False):
    line(c, x1, y1, x2, y2, color=GRAY)
    if vertical:
        for y in [y1, y2]:
            line(c, x1 - 2, y, x1 + 2, y, color=GRAY)
        c.saveState()
        c.translate((x1 - 5) * mm, ((y1 + y2) / 2) * mm)
        c.rotate(90)
        text(c, 0, 0, label, 15, bold=True, align="center")
        c.restoreState()
    else:
        for x in [x1, x2]:
            line(c, x, y1 - 2, x, y1 + 2, color=GRAY)
        text(c, (x1 + x2) / 2, y1 - 8, label, 15, bold=True, align="center")


def square_and_circle(c, x, y):
    rect(c, x, y, 200, 200, thickness=0.25)
    c.setStrokeColor(BLACK)
    c.setLineWidth(0.25 * mm)
    c.circle((x + 100) * mm, (y + 100) * mm, 50 * mm, stroke=1, fill=0)
    for cx, cy in [(x, y), (x + 200, y), (x, y + 200), (x + 200, y + 200), (x + 100, y + 100)]:
        line(c, cx - 3, cy, cx + 3, cy, color=ORANGE)
        line(c, cx, cy - 3, cx, cy + 3, color=ORANGE)
    text(c, x + 100, y + 121, "CÍRCULO", 12, color=GRAY, align="center")
    text(c, x + 100, y + 111, "Diámetro 100 mm", 17, bold=True, align="center")
    text(c, x + 100, y + 25, "Cuadrado de 200 × 200 mm", 17, bold=True, align="center")
    dimension(c, x, y - 8, x + 200, y - 8, "200 mm")
    dimension(c, x - 10, y, x - 10, y + 200, "200 mm", vertical=True)


def ruler(c, x, y, length, vertical=False):
    if vertical:
        c.saveState()
        c.translate(x * mm, y * mm)
        c.rotate(90)
        ruler(c, 0, 0, length)
        c.restoreState()
        return
    line(c, x, y, x + length, y, 0.2)
    for n in range(0, length + 1):
        tick = 5 if n % 50 == 0 else 3 if n % 10 == 0 else 1.8 if n % 5 == 0 else 1
        line(c, x + n, y, x + n, y + tick, 0.15)
        if n % 50 == 0:
            text(c, x + n, y - 7, str(n), 11, align="center")
    text(c, x + length / 2, y + 11, f"CONTROL DE LONGITUD / {length} mm", 13, bold=True, align="center")


def weights(c, x, y):
    text(c, x, y, "GROSORES DE LÍNEA", 13, bold=True)
    for i, width in enumerate([0.1, 0.18, 0.25, 0.35, 0.5]):
        yy = y - 12 - i * 10
        text(c, x, yy - 1.5, f"{width:g} mm", 13, color=GRAY)
        line(c, x + 32, yy, x + 150, yy, width)


def colors(c, x, y):
    text(c, x, y, "CONTROL VISUAL DE COLOR", 13, bold=True)
    for i, (name, color) in enumerate([
        ("Cian", CMYKColor(1, 0, 0, 0)), ("Magenta", CMYKColor(0, 1, 0, 0)),
        ("Amarillo", CMYKColor(0, 0, 1, 0)), ("Negro", CMYKColor(0, 0, 0, 1)),
    ]):
        c.setFillColor(color)
        c.rect((x + i * 36) * mm, (y - 18) * mm, 28 * mm, 8 * mm, stroke=0, fill=1)
        text(c, x + i * 36, y - 25, name, 11, color=GRAY)


def page_a1(c):
    w, h = 594, 841
    c.setPageSize((w * mm, h * mm))
    frame(c, w, h, 1)
    brand(c, 24, h - 19)
    text(c, 24, h - 66, "Prueba de impresión CAD", 40, bold=True)
    text(c, 24, h - 82, "HP DesignJet T950 · Rollo 914 mm · Tamaño real / 100%", 18, color=GRAY)
    line(c, 24, h - 99, w - 24, h - 99, color=RULE)
    for x, label, value in [(24, "PÁGINA ORIGINAL", "A1 · 594 × 841 mm"), (219, "ESCALA DE SALIDA", "100% del PDF"), (400, "GIRO ESPERADO EN GRAFO", "90° · sin deformar")]:
        text(c, x, h - 111, label, 11, color=GRAY)
        text(c, x, h - 123, value, 18, bold=True)
    text(c, 40, 694, "01 / ESCALA Y PROPORCIONES", 16, bold=True)
    square_and_circle(c, 40, 471)
    rect(c, 315, 571, 100, 100, thickness=0.25)
    text(c, 365, 623, "100 × 100 mm", 18, bold=True, align="center")
    text(c, 315, 550, "Los círculos deben quedar circulares.", 14, color=GRAY)
    text(c, 315, 539, "Compará medidas horizontales y verticales.", 14, color=GRAY)
    ruler(c, 565, 171, 500, vertical=True)
    ruler(c, 40, 408, 500)
    text(c, 40, 367, "02 / DETALLE Y COLOR", 16, bold=True)
    weights(c, 40, 344)
    colors(c, 315, 344)
    # Trazos vectoriales: detalle geométrico, sin imágenes rasterizadas.
    rect(c, 315, 227, 160, 60, thickness=0.35)
    for x in range(315, 476, 20):
        line(c, x, 227, x, 287, 0.1, RULE)
    for y in range(227, 288, 20):
        line(c, 315, y, 475, y, 0.1, RULE)
    line(c, 315, 227, 475, 287, 0.18)
    line(c, 315, 287, 475, 227, 0.18)
    text(c, 315, 215, "Retícula de 20 × 20 mm · trazo vectorial", 12, color=GRAY)
    text(c, 40, 175, "03 / VERIFICACIÓN EN PAPEL", 16, bold=True)
    for i, value in enumerate([
        "Imprimir una copia de esta página, sin ajustar al papel ni reducir.",
        "Medir el cuadrado de 200 mm en ambos ejes y las dos reglas de 500 mm.",
        "Revisar las cuatro esquinas naranjas y que no falte contenido.",
        "El giro cambia la orientación; nunca cambia las medidas del dibujo.",
    ]):
        text(c, 40, 155 - i * 13, value, 16)
    line(c, 40, 89, w - 40, 89, color=RULE)
    text(c, 40, 74, "Medido X: __________ mm     Medido Y: __________ mm     Operador: ___________________", 14)
    text(c, 40, 56, "Tamaño del PDF: 594 × 841 mm. El largo de corte depende de los márgenes del controlador.", 13, color=GRAY)
    text(c, 40, 43, "Esta lámina valida la salida a tamaño real; no certifica la escala de origen de un plano de cliente.", 13, color=GRAY)
    c.showPage()


def page_custom(c):
    w, h = 900, 350
    c.setPageSize((w * mm, h * mm))
    frame(c, w, h, 2)
    brand(c, 24, h - 19)
    text(c, 24, h - 60, "Formato personalizado · 900 × 350 mm", 32, bold=True)
    text(c, 390, h - 32, "100% DEL PDF / SIN AJUSTAR AL PAPEL", 18, bold=True)
    text(c, 390, h - 48, "Rollo 914 mm · Verificar ancho, corte y ausencia de recortes", 15, color=GRAY)
    line(c, 24, 274, w - 24, 274, color=RULE)
    square_and_circle(c, 60, 54)
    text(c, 330, 250, "01 / COMPROBAR EL TAMAÑO PERSONALIZADO", 16, bold=True)
    text(c, 330, 234, "Configurar 900 × 350 mm en el controlador y seleccionar únicamente esta página.", 16)
    text(c, 330, 220, "La lámina debe conservar sus medidas y salir completa sobre el rollo de 914 mm.", 16)
    text(c, 330, 206, "Las cuatro esquinas están a 10 mm de los bordes del PDF. No usar impresión sin bordes.", 14, color=GRAY)
    ruler(c, 330, 160, 500)
    weights(c, 330, 122)
    colors(c, 550, 122)
    text(c, 740, 122, "RESULTADO", 13, bold=True)
    text(c, 740, 104, "Cuadrado X: __________ mm", 13)
    text(c, 740, 89, "Cuadrado Y: __________ mm", 13)
    text(c, 740, 74, "Regla: _______________ mm", 13)
    text(c, 550, 65, "La salida puede conservar bandas de papel a los lados.", 13, color=GRAY)
    text(c, 550, 52, "El cortador del rollo no recorta esas bandas laterales.", 13, color=GRAY)
    c.showPage()


def main():
    fonts = ROOT / "apps/api/src/administracion/invoicing/fonts"
    pdfmetrics.registerFont(TTFont("Geist", str(fonts / "Geist-Regular.ttf")))
    pdfmetrics.registerFont(TTFont("Geist-Bold", str(fonts / "Geist-Bold.ttf")))
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    c = canvas.Canvas(str(OUTPUT), pageCompression=1, invariant=1)
    c.setTitle("Grafo - Prueba CAD HP T950 - Escala y formatos")
    c.setAuthor("Grafo")
    c.setSubject("Prueba vectorial a tamaño real: A1 y 900 x 350 mm. Imprimir cada página con su tamaño de papel.")
    page_a1(c)
    page_custom(c)
    c.save()
    print(OUTPUT)


if __name__ == "__main__":
    main()
