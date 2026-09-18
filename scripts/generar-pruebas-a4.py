#!/usr/bin/env python3
"""Kit A4 de Grafo para validar copias, color, orientación y dúplex.

Genera cuatro PDF vectoriales y un ZIP bajo output/pdf/pruebas-a4-grafo/.
No envía impresiones ni modifica configuraciones del sistema.
Requiere reportlab; usa las fuentes de marca incluidas en el proyecto.
"""

from math import ceil
from pathlib import Path
import zipfile

from reportlab.lib.colors import CMYKColor, HexColor
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "output/pdf/pruebas-a4-grafo"
ORANGE = HexColor("#ff6b3b")
INK, MUTED, RULE, PALE = 0.07, 0.39, 0.79, 0.955


class Page:
    """Coordenadas en milímetros desde la esquina superior izquierda."""

    def __init__(self, c, w, h, color):
        self.c, self.w, self.h = c, w, h
        self.accent = ORANGE if color else INK

    def paint(self, color, stroke=False):
        if isinstance(color, (float, int)):
            (self.c.setStrokeGray if stroke else self.c.setFillGray)(color)
        else:
            (self.c.setStrokeColor if stroke else self.c.setFillColor)(color)

    def text(self, x, y, value, size=10, bold=False, color=INK, align="left"):
        self.c.setFont("Geist-Bold" if bold else "Geist", size)
        self.paint(color)
        method = {
            "left": self.c.drawString,
            "right": self.c.drawRightString,
            "center": self.c.drawCentredString,
        }[align]
        method(x * mm, (self.h - y) * mm, value)

    def line(self, x1, y1, x2, y2, width=0.2, color=RULE):
        self.paint(color, True)
        self.c.setLineWidth(width * mm)
        self.c.line(x1 * mm, (self.h - y1) * mm, x2 * mm, (self.h - y2) * mm)

    def rect(self, x, y, w, h, fill=None, stroke=None, width=0.2):
        if fill is not None:
            self.paint(fill)
        if stroke is not None:
            self.paint(stroke, True)
        self.c.setLineWidth(width * mm)
        self.c.rect(x * mm, (self.h - y - h) * mm, w * mm, h * mm,
                    fill=fill is not None, stroke=stroke is not None)

    def circle(self, x, y, r, fill=None, stroke=None, width=0.2):
        if fill is not None:
            self.paint(fill)
        if stroke is not None:
            self.paint(stroke, True)
        self.c.setLineWidth(width * mm)
        self.c.circle(x * mm, (self.h - y) * mm, r * mm,
                      fill=fill is not None, stroke=stroke is not None)

    def label(self, x, y, value):
        self.text(x, y, value, 7.5, color=MUTED)

    def cross(self, x, y):
        self.line(x - 2, y, x + 2, y, 0.16, INK)
        self.line(x, y - 2, x, y + 2, 0.16, INK)
        self.circle(x, y, 1, stroke=INK, width=0.12)


def brand(p):
    # Isologo actual de src/components/brand/grafoprint-isologo.tsx.
    k, x, y = 0.47, 17, 16
    points = [(x + a * k, y + b * k) for a, b in [(5.5, 6.5), (18, 6.5), (12, 17.5)]]
    for a, b in zip(points, points[1:] + points[:1]):
        p.line(*a, *b, width=1.4 * k, color=p.accent)
    for px, py in points:
        p.circle(px, py, 2.2 * k, fill=p.accent)
    p.text(32, 25, "grafoprint", 24, bold=True)
    offset = pdfmetrics.stringWidth("grafoprint", "Geist-Bold", 24) / mm
    p.text(32 + offset, 25, ".", 24, bold=True, color=p.accent)


def frame(p, code, n, total):
    for x, y, sx, sy in [(10, 10, 1, 1), (p.w - 10, 10, -1, 1),
                         (10, p.h - 10, 1, -1), (p.w - 10, p.h - 10, -1, -1)]:
        p.line(x, y, x + sx * 5, y, 0.25, RULE)
        p.line(x, y, x, y + sy * 5, 0.25, RULE)
    brand(p)
    p.label(p.w - 62, 21, "KIT DE VALIDACIÓN / A4")
    p.text(p.w - 62, 27, code, 9, bold=True)
    p.line(18, 35, p.w - 18, 35)
    p.line(18, 35, 38, 35, 0.8, p.accent)
    # Indicador de orientación, dentro del área imprimible habitual.
    p.line(p.w / 2, 20, p.w / 2, 12, 0.3, INK)
    p.line(p.w / 2, 12, p.w / 2 - 1.5, 14, 0.3, INK)
    p.line(p.w / 2, 12, p.w / 2 + 1.5, 14, 0.3, INK)
    p.text(p.w / 2, 24, "ARRIBA", 6, color=MUTED, align="center")
    p.line(18, p.h - 21, p.w - 18, p.h - 21)
    p.text(18, p.h - 15, "GRAFO / PRUEBAS DE IMPRESIÓN", 7, bold=True)
    p.text(18, p.h - 10.5, "Material de prueba · sin datos de clientes · edición 01", 6.5, color=MUTED)
    p.text(p.w - 18, p.h - 14, f"{n:02d} / {total:02d}", 10, bold=True, align="right")


def section(p, y, label):
    p.text(18, y, label, 8, bold=True)
    p.line(18, y + 3, p.w - 18, y + 3)


def checklist(p, y, lines):
    for i, value in enumerate(lines):
        yy = y + i * 6.1
        p.rect(18, yy - 2.6, 2.6, 2.6, stroke=MUTED, width=0.18)
        p.text(23, yy, value, 8.5)


def ruler(p, y):
    p.label(18, y - 5, "REFERENCIA DE 100 mm / MEDIR SÓLO A TAMAÑO REAL (100%)")
    p.line(18, y, 118, y, 0.2, INK)
    for n in range(101):
        size = 3 if n % 10 == 0 else 1.8 if n % 5 == 0 else 1
        p.line(18 + n, y, 18 + n, y + size, 0.12, INK)
        if n % 20 == 0:
            p.text(18 + n, y + 6.5, str(n), 6.5, color=MUTED, align="center")


def swatches(p, y, color, width=174):
    if color:
        samples = [
            ("CIAN", CMYKColor(1, 0, 0, 0)),
            ("MAGENTA", CMYKColor(0, 1, 0, 0)),
            ("AMARILLO", CMYKColor(0, 0, 1, 0)),
            ("NEGRO", CMYKColor(0, 0, 0, 1)),
        ]
        cell = width / 4
        for i, (label, col) in enumerate(samples):
            x = 18 + i * cell
            p.rect(x, y, cell - 3, 13, fill=col)
            p.label(x, y + 18, label)
        p.text(18, y + 26, "Las cuatro muestras deben distinguirse y mantener un relleno uniforme.", 8.5)
        p.text(18, y + 32, "Control visual de presencia de color; no es una carta de calibración.", 7.5, color=MUTED)
    else:
        cell = width / 11
        for i in range(11):
            p.rect(18 + i * cell, y, cell, 14, fill=1 - i / 10,
                   stroke=RULE if i == 0 else None)
            p.text(18 + (i + 0.5) * cell, y + 19, f"{i * 10}%", 6.8, align="center")
        p.text(18, y + 27, "Del blanco al negro: buscá transiciones visibles, sin bandas ni manchas.", 8.5)
        p.text(18, y + 33, "El archivo usa sólo grises. Grafo debe enviarlo en blanco y negro.", 7.5, color=MUTED)


def line_samples(p, y):
    for i, weight in enumerate([0.10, 0.20, 0.35, 0.50]):
        yy = y + i * 7
        p.text(18, yy + 1, f"{weight:.2f} mm", 7.5, color=MUTED)
        p.line(43, yy, 99, yy, weight, INK)
    for i, size in enumerate([6, 8, 10, 12]):
        p.text(111, y + i * 7 + 1, f"{size} pt / Grafo 0123456789", size)


def geometry(p, y):
    p.rect(18, y, 50, 50, stroke=INK, width=0.25)
    p.circle(43, y + 25, 20, stroke=p.accent, width=0.4)
    p.cross(43, y + 25)
    p.text(79, y + 8, "Precisión en cada detalle.", 17, bold=True)
    p.text(79, y + 18, "Cuadrado: 50 × 50 mm", 10)
    p.text(79, y + 25, "Círculo: 40 mm de diámetro", 10)
    p.text(79, y + 36, "Medidas válidas al imprimir al 100%.", 8, color=MUTED)
    p.text(79, y + 42, "Sin estirar ni deformar el contenido.", 8, color=MUTED)
    # Pequeña trama vectorial para observar continuidad.
    for n in range(26):
        p.line(18 + n * 2, y + 60, 18 + n * 2, y + 67, 0.12, INK)
    p.label(79, y + 65, "TRAZOS FINOS / NEGRO SOBRE BLANCO")


def duplex_marks(p, y, n, color):
    back = n % 2 == 0
    p.rect(18, y, 174, 46, stroke=RULE)
    for xx in [22, 188]:
        for yy in [y + 4, y + 42]:
            p.cross(xx, yy)
    p.circle(105, y + 23, 17, stroke=p.accent, width=0.6)
    p.text(105, y + 22, "DORSO" if back else "FRENTE", 12, bold=True, align="center")
    p.text(105, y + 29, f"HOJA {ceil(n / 2):02d}", 8, color=MUTED, align="center")
    p.text(30, y + 25, "IZQUIERDA", 6.5, color=MUTED)
    p.text(180, y + 25, "DERECHA", 6.5, color=MUTED, align="right")
    p.text(18, y + 53, "Girá por el borde largo, como un libro. Frente y dorso deben quedar derechos.", 8)
    if color:
        for i, col in enumerate([CMYKColor(1, 0, 0, 0), CMYKColor(0, 1, 0, 0),
                                 CMYKColor(0, 0, 1, 0), CMYKColor(0, 0, 0, 1)]):
            p.rect(18 + i * 17, y + 58, 14, 6, fill=col)
        p.label(93, y + 62, "COLOR PRESENTE EN AMBAS CARAS")
    else:
        for i in range(6):
            p.rect(18 + i * 12, y + 58, 12, 6, fill=1 - i / 5)
        p.label(99, y + 62, "GRISES CONSISTENTES ENTRE CARAS")


def portrait(c, code, n, total, color, duplex):
    c.setPageSize((210 * mm, 297 * mm))
    p = Page(c, 210, 297, color)
    frame(p, code, n, total)
    p.label(18, 47, "PRUEBA DE IMPRESIÓN / CENTRO DE COPIADO")
    p.text(18, 62, "Color." if color else "Blanco y negro.", 28, bold=True)
    p.text(18, 74, "Doble faz / borde largo" if duplex else "Simple faz / una cara por hoja", 13, bold=True)
    p.text(192, 77, f"{n:02d}", 58, bold=True, color=0.85, align="right")
    p.rect(18, 86, 174, 23, fill=PALE)
    papel = f"Hoja {ceil(n / 2)} · {'Dorso' if n % 2 == 0 else 'Frente'}" if duplex else f"Hoja {n} · Frente"
    for x, label, value in [
        (22, "FORMATO DEL ORIGINAL", "A4 · 210 × 297 mm"),
        (81, "ESTA PÁGINA", papel),
        (139, "CONFIGURAR EN GRAFO", "2 copias · Todas"),
    ]:
        p.label(x, 94, label)
        p.text(x, 102, value, 9.2, bold=True)
    if duplex:
        section(p, 119, "01 / ORDEN, CARAS Y ORIENTACIÓN")
        duplex_marks(p, 127, n, color)
    elif n == 1:
        section(p, 119, "01 / COLOR Y UNIFORMIDAD" if color else "01 / GRISES Y UNIFORMIDAD")
        swatches(p, 128, color)
        line_samples(p, 171)
    elif n == 2:
        section(p, 119, "01 / TIPOGRAFÍA Y DETALLE")
        p.text(18, 136, "Diseñamos para que", 23, bold=True)
        p.text(18, 147, "todo fluya.", 23, bold=True, color=p.accent)
        p.text(18, 158, "Árbol · señal · impresión · pingüino · 0123456789", 10)
        p.text(18, 166, "Revisá acentos, curvas, números y trazos pequeños.", 8.5, color=MUTED)
        line_samples(p, 179)
    else:
        section(p, 119, "01 / PROPORCIÓN Y CONTINUIDAD")
        geometry(p, 128)
    section(p, 214, "02 / RESULTADO ESPERADO")
    hojas = ceil(total / 2) if duplex else total
    checks = [f"Con 2 copias completas: {hojas * 2} hojas físicas en total."]
    if duplex and n == total and total % 2:
        checks += [f"Esta página {n} es el último frente. Su dorso debe quedar en blanco.",
                   "Cada copia comienza en un frente nuevo; no mezclar los juegos."]
    elif duplex:
        checks += [f"Páginas {2 * ceil(n / 2) - 1} y {2 * ceil(n / 2)}: frente y dorso de la misma hoja.",
                   "Verificá ambas caras y después confirmá la salida en Grafo."]
    else:
        checks += ["Una página por hoja; todos los dorsos deben quedar en blanco.",
                   "Cada copia conserva el orden del archivo y todas sus páginas."]
    checklist(p, 224, checks)
    ruler(p, 254)
    c.showPage()


def landscape(c, code, n, total):
    c.setPageSize((297 * mm, 210 * mm))
    p = Page(c, 297, 210, True)
    frame(p, code, n, total)
    p.label(18, 46, "PRUEBA DE IMPRESIÓN / ORIENTACIÓN MIXTA")
    p.text(18, 60, "Color en horizontal.", 29, bold=True)
    p.text(18, 70, "Mismo archivo A4. Esta página cambia de orientación.", 11, color=MUTED)
    p.text(279, 70, f"{n:02d}", 58, bold=True, color=0.85, align="right")
    p.rect(18, 80, 261, 20, fill=PALE)
    for x, label, value in [(22, "ORIGINAL", "A4 · 297 × 210 mm"),
                             (112, "CONFIGURAR EN GRAFO", "Color · Simple faz"),
                             (205, "CANTIDAD Y RANGO", "2 copias · Todas")]:
        p.label(x, 87, label)
        p.text(x, 95, value, 10, bold=True)
    section(p, 109, "01 / COLOR, GIRO Y CONTENIDO COMPLETO")
    swatches(p, 116, True, width=164)
    p.rect(205, 116, 50, 50, stroke=INK, width=0.25)
    p.circle(230, 141, 20, stroke=p.accent, width=0.5)
    p.text(230, 143, "50 × 50 mm", 9, bold=True, align="center")
    p.text(18, 158, "Las cuatro esquinas deben verse. El contenido debe quedar completo y legible.", 8.5)
    p.text(18, 165, "Orden: página 1 vertical, página 2 horizontal, página 3 vertical. Dorsos en blanco.", 8.5)
    p.text(18, 173, "Resultado con 2 copias: 6 hojas físicas. El PDF no configura la faz de la impresora.", 8.5)
    p.label(205, 173, "MEDIR SÓLO AL 100%")
    c.showPage()


SPECS = [
    ("grafo-a4-01-byn-simple-faz.pdf", "GF-A4-01 / BN-S", 3, False, False),
    ("grafo-a4-02-byn-doble-faz-impar.pdf", "GF-A4-02 / BN-D", 5, False, True),
    ("grafo-a4-03-color-simple-faz-mixto.pdf", "GF-A4-03 / C-S", 3, True, False),
    ("grafo-a4-04-color-doble-faz.pdf", "GF-A4-04 / C-D", 4, True, True),
]


def main():
    fonts = ROOT / "apps/api/src/administracion/invoicing/fonts"
    for name in ["Regular", "Bold"]:
        pdfmetrics.registerFont(TTFont("Geist" if name == "Regular" else "Geist-Bold",
                                      str(fonts / f"Geist-{name}.ttf")))
    OUT.mkdir(parents=True, exist_ok=True)
    for filename, code, pages, color, duplex in SPECS:
        c = canvas.Canvas(str(OUT / filename), pagesize=(210 * mm, 297 * mm), pageCompression=1)
        c.setTitle(f"Grafo | A4 | {'Color' if color else 'Blanco y negro'} | {'Doble' if duplex else 'Simple'} faz")
        c.setAuthor("Grafo / Grafoprint")
        c.setSubject("Kit de validación de impresión: copias, caras, orientación y detalle")
        for n in range(1, pages + 1):
            if color and not duplex and n == 2:
                landscape(c, code, n, pages)
            else:
                portrait(c, code, n, pages, color, duplex)
        c.save()
        print(f"{filename}: {pages} páginas")
    guide = """# Grafo / Kit A4 de validación de impresión

Los PDF no activan por sí mismos color, copias o dúplex. Elegí esos parámetros
en Centro de copiado. Usá perfiles y bandejas ya probados, con el papel cargado.

## Primera prueba: todas las páginas, 2 copias de cada archivo

| Archivo | Páginas | Modo en Grafo | Hojas físicas esperadas |
| --- | ---: | --- | ---: |
| 01 / B/N simple | 3 | A4, B/N, Simple, 2 copias | 6 |
| 02 / B/N doble impar | 5 | A4, B/N, Doble, borde largo, 2 copias | 6 |
| 03 / Color simple mixto | 3 | A4, Color, Simple, 2 copias | 6 |
| 04 / Color doble | 4 | A4, Color, Doble, borde largo, 2 copias | 4 |

Total si se imprimen los cuatro completos: 22 hojas / 30 caras impresas.
Primero podés hacer 1 copia: 11 hojas / 15 caras impresas.

- El 02 tiene 5 páginas: 1/2 y 3/4 forman pares; 5 queda en el frente de
  la tercera hoja, con dorso en blanco. La siguiente copia empieza otra hoja.
- El 03 alterna vertical / horizontal / vertical, siempre en A4 y simple faz.
- El 04 tiene dos hojas a doble faz por copia, con color en ambas caras.
- Numeración, indicación ARRIBA y marcas de esquina permiten comprobar giro,
  integridad y orden. Las marcas compartidas de frente/dorso ayudan a observar
  registro a contraluz; no se establece una tolerancia mecánica universal.
- Las reglas y cuadrados tienen medidas exactas en el PDF, válidas en papel
  cuando se imprime al 100%. El ajuste al área imprimible puede reducirlas.
- La franja CMYK permite comprobar presencia de color, no calibrar el equipo.
- El contenido B/N usa sólo DeviceGray; las fuentes están incrustadas y los
  gráficos son vectoriales. No hay formularios, QR ni acciones interactivas.

## Segunda prueba opcional: rangos y cantidades

Usá el archivo 02, rango 1-2,5 y 2 copias, doble faz: se envían las páginas
originales 1, 2 y 5, en ese orden. Esperado: 4 hojas físicas en total, con
el último dorso de cada copia en blanco. Las leyendas del PDF describen la
prueba completa; para este ensayo usá los resultados de este párrafo.

## Cierre

Compará el papel real con la configuración y recién después usá
“Verifiqué la salida” en el Asistente Grafo. El estado de Windows no confirma
por sí solo la calidad ni la salida física.
"""
    (OUT / "LEEME.md").write_text(guide)
    zip_path = OUT.parent / "grafo-kit-pruebas-a4.zip"
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as z:
        for filename, *_ in SPECS:
            z.write(OUT / filename, filename)
        z.write(OUT / "LEEME.md", "LEEME.md")
    print(zip_path)


if __name__ == "__main__":
    main()
