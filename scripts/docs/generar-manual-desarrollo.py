"""Genera el manual a partir de su Markdown, con diagramas vectoriales.

Requiere ReportLab. No consulta servicios ni lee credenciales.
"""

from __future__ import annotations

import argparse
import html
import re
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.pdfdoc import PDFString
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas
from reportlab.platypus import Flowable, Paragraph, Table, TableStyle


ROOT = Path(__file__).resolve().parents[2]
INK = colors.HexColor('#17201d')
MUTED = colors.HexColor('#596760')
ACCENT = colors.HexColor('#e75225')
PAPER = colors.HexColor('#fcfbf7')
PALE = colors.HexColor('#f7e9df')
LINE = colors.HexColor('#d7ddd5')
GREEN = colors.HexColor('#2f6b50')
WHITE = colors.white
PAGE_W, PAGE_H = A4
MARGIN = 43
WIDTH = PAGE_W - 2 * MARGIN


def register_fonts(directory: str | None) -> None:
    if directory:
        base = Path(directory)
        names = ['DejaVuSans.ttf', 'DejaVuSans-Bold.ttf', 'DejaVuSans-Oblique.ttf', 'DejaVuSans-BoldOblique.ttf']
    else:
        base = Path('/System/Library/Fonts/Supplemental')
        names = ['Arial.ttf', 'Arial Bold.ttf', 'Arial Italic.ttf', 'Arial Bold Italic.ttf']
    for suffix, name in zip(['', '-Bold', '-Italic', '-BoldItalic'], names):
        pdfmetrics.registerFont(TTFont('Grafo' + suffix, str(base / name)))
    pdfmetrics.registerFontFamily('Grafo', normal='Grafo', bold='Grafo-Bold', italic='Grafo-Italic', boldItalic='Grafo-BoldItalic')


def styles():
    body = ParagraphStyle('body', fontName='Grafo', fontSize=10.3, leading=14.0, textColor=INK, spaceAfter=7)
    return {
        'body': body,
        'h1': ParagraphStyle('h1', parent=body, fontName='Grafo-Bold', fontSize=23, leading=27, spaceAfter=12),
        'h2': ParagraphStyle('h2', parent=body, fontName='Grafo-Bold', fontSize=19, leading=23, spaceAfter=12),
        'h3': ParagraphStyle('h3', parent=body, fontName='Grafo-Bold', fontSize=12, leading=15, spaceBefore=7, spaceAfter=6),
        'table': ParagraphStyle('table', parent=body, fontSize=9.4, leading=12.4, spaceAfter=0),
        'th': ParagraphStyle('th', parent=body, fontName='Grafo-Bold', fontSize=9.4, leading=12.4, textColor=WHITE, spaceAfter=0),
        'small': ParagraphStyle('small', parent=body, fontSize=8.6, leading=11.5, textColor=MUTED, spaceAfter=5),
        'quote': ParagraphStyle('quote', parent=body, fontSize=10.1, leading=13.5, spaceAfter=0),
        'bullet': ParagraphStyle('bullet', parent=body, leftIndent=12, firstLineIndent=-10, spaceAfter=5),
        'diagram': ParagraphStyle('diagram', parent=body, fontSize=9, leading=11.5, alignment=TA_CENTER, spaceAfter=0),
    }


def inline(text: str) -> str:
    text = html.escape(text)
    text = re.sub(r'\[([^\]]+)\]\((https?://[^)]+)\)', r'<link href="\2" color="#2f6b50"><u>\1</u></link>', text)
    text = re.sub(r'`([^`]+)`', r'<font color="#384f44">\1</font>', text)
    text = re.sub(r'\*\*([^*]+)\*\*', r'<b>\1</b>', text)
    return text


class Diagram(Flowable):
    HEIGHTS = {'recorrido': 95, 'arquitectura': 154, 'ramas': 104, 'despliegue': 105, 'produccion': 112}

    def __init__(self, kind: str, sty):
        super().__init__()
        self.kind, self.sty = kind, sty
        self.width, self.height = WIDTH, self.HEIGHTS[kind]
        self.spaceAfter = 9

    def box(self, x, y, w, h, title, sub='', fill=WHITE, dark=False):
        c = self.canv
        c.setFillColor(fill)
        c.setStrokeColor(LINE if not dark else fill)
        c.roundRect(x, y, w, h, 7, fill=1, stroke=1)
        style = ParagraphStyle('node', parent=self.sty['diagram'], textColor=WHITE if dark else INK)
        content = '<b>' + title + '</b>' + ('<br/><font size="8.1">' + sub + '</font>' if sub else '')
        p = Paragraph(content, style)
        _, ph = p.wrap(w - 12, h)
        if ph > h - 6:
            raise ValueError(f'Diagrama: caja insuficiente para {title}')
        p.drawOn(c, x + 6, y + (h - ph) / 2)

    def arrow(self, x1, y1, x2, y2, color=ACCENT):
        import math
        c = self.canv
        c.setStrokeColor(color)
        c.setFillColor(color)
        c.setLineWidth(1.4)
        c.line(x1, y1, x2, y2)
        angle = math.atan2(y2-y1, x2-x1)
        p = c.beginPath()
        p.moveTo(x2, y2)
        p.lineTo(x2-5*math.cos(angle-.5), y2-5*math.sin(angle-.5))
        p.lineTo(x2-5*math.cos(angle+.5), y2-5*math.sin(angle+.5))
        p.close()
        c.drawPath(p, fill=1, stroke=0)

    def label(self, text, x, y, w, size=8.2, color=MUTED):
        st = ParagraphStyle('caption', parent=self.sty['diagram'], fontSize=size, leading=size+2.5, textColor=color)
        p = Paragraph(text, st)
        _, h = p.wrap(w, 50)
        p.drawOn(self.canv, x, y-h)

    def draw(self):
        if self.kind == 'recorrido':
            labels = [('Idea', 'Qué debe resolver'), ('Rama + PR', 'Construir y revisar'), ('Staging', 'Ensayar y aceptar'), ('Producción', 'Publicar al estar lista')]
            w, gap = 115, (WIDTH-460)/3
            for i, (title, sub) in enumerate(labels):
                x = i*(w+gap)
                self.box(x, 35, w, 44, title, sub, INK if i==0 else PALE if i==3 else WHITE, i==0)
                if i<3: self.arrow(x+w+3, 57, x+w+gap-3, 57)
            self.label('Cada paso deja evidencia. Hoy el SaaS llega hasta staging; producción es la siguiente etapa.', 0, 23, WIDTH)
        elif self.kind == 'arquitectura':
            self.box(0, 108, 122, 38, 'Visita comercial', 'grafoprint.com.ar')
            self.box(146, 108, 126, 38, 'Vercel', 'Web de venta')
            self.arrow(124,127,143,127)
            self.label('Web comercial independiente', 285, 145, 224)
            self.box(0, 53, 122, 42, 'Aplicación · Fly', 'Pantallas del usuario', INK, True)
            self.box(146, 53, 126, 42, 'API · Fly', 'Reglas y permisos', INK, True)
            self.box(303, 80, 91, 35, 'Neon', 'Registros')
            self.box(418, 80, 91, 35, 'R2', 'Archivos')
            self.box(303, 28, 91, 35, 'Redis', 'Trabajos en espera')
            self.box(418, 28, 91, 35, '2 workers · Fly', 'Cálculos / PDF')
            self.arrow(124,74,143,74)
            self.arrow(274,83,300,97)
            # API a R2: ruta por encima del par de depósitos.
            self.canv.setStrokeColor(ACCENT)
            self.canv.setLineWidth(1.4)
            self.canv.line(281,83,281,119)
            self.canv.line(281,119,459,119)
            self.arrow(459,119,459,115)
            self.arrow(274,66,300,45)
            self.arrow(397,45,415,45)
            self.label('Worker PDF → Gotenberg interno → archivo PDF', 240, 18, 269, 8.0)
            self.label('Esquema simplificado', 0, 18, 190, 8.0)
        elif self.kind == 'ramas':
            self.label('<b>main</b> · base común', 0, 100, 140, 9.2, INK)
            self.canv.setStrokeColor(GREEN)
            self.canv.setLineWidth(2)
            self.canv.line(45,60,464,60)
            for x in [62,176,443]:
                self.canv.setFillColor(GREEN)
                self.canv.circle(x,60,4,fill=1,stroke=0)
            self.arrow(64,57,105,27)
            self.box(109,8,230,38,'Rama de una tarea','Cambios + commits + pruebas',PALE)
            self.arrow(340,27,439,58)
            self.label('PR + revisión', 342, 28, 135, 9, ACCENT)
            self.label('Integración aprobada', 327, 86, 182, 8.5)
        elif self.kind == 'despliegue':
            labels = [('Código', 'Commit elegido'), ('Compilar', 'Servidor temporal'), ('Imagen', 'Paquete guardado'), ('Fly', 'Ejecuta la versión'), ('Prueba', 'Recorrido real')]
            w, gap = 91, (WIDTH-455)/4
            for i,(title,sub) in enumerate(labels):
                x=i*(w+gap)
                self.box(x,52,w,42,title,sub,INK if i==3 else WHITE,i==3)
                if i<4: self.arrow(x+w+2,73,x+w+gap-2,73)
            self.label('<b>Migración, si hace falta:</b> un cambio controlado en Neon antes del recambio compatible.',0,39,WIDTH)
            self.label('Reemplazar el programa no reemplaza la base de datos ni el depósito de archivos.',0,18,WIDTH)
        elif self.kind == 'produccion':
            self.box(0,40,205,61,'STAGING · activo','Ensayo con datos ficticios<br/>Fly + Neon + Redis + R2',WHITE)
            self.box(304,40,205,61,'PRODUCCIÓN · futura','Trabajo con datos reales<br/>Recursos y claves propios',PALE)
            self.arrow(211,69,297,69)
            self.label('Código<br/>aprobado',211,57,87,8.5,ACCENT)
            self.label('Se comparte el programa. Se mantienen separados los datos, archivos, colas y accesos.',0,24,WIDTH)


def table_rows(lines, sty, page):
    raw = [[x.strip() for x in line.strip().strip('|').split('|')] for line in lines]
    rows = [raw[0]] + raw[2:]
    if len(rows[0]) == 3:
        widths = [WIDTH*.18, WIDTH*.39, WIDTH*.43]
    elif page == 1:
        widths = [WIDTH-60, 60]
    elif page == 2:
        widths = [WIDTH*.25, WIDTH*.75]
    elif page == 4:
        widths = [WIDTH*.24, WIDTH*.76]
    elif page == 10:
        widths = [WIDTH*.32, WIDTH*.68]
    else:
        widths = [WIDTH*.30, WIDTH*.70]
    cells = [[Paragraph(inline(cell), sty['th' if i == 0 else 'table']) for cell in row] for i,row in enumerate(rows)]
    t = Table(cells, colWidths=widths, hAlign='LEFT')
    t.setStyle(TableStyle([
        ('BACKGROUND',(0,0),(-1,0),INK),
        ('ROWBACKGROUNDS',(0,1),(-1,-1),[WHITE,colors.HexColor('#f1f3ee')]),
        ('VALIGN',(0,0),(-1,-1),'TOP'),
        ('LEFTPADDING',(0,0),(-1,-1),9),('RIGHTPADDING',(0,0),(-1,-1),9),
        ('TOPPADDING',(0,0),(-1,-1),5),('BOTTOMPADDING',(0,0),(-1,-1),5),
        ('LINEBELOW',(0,0),(-1,0),1,ACCENT),
        ('LINEBELOW',(0,1),(-1,-1),.4,LINE),
    ]))
    t.spaceAfter = 10
    return t


def parse_page(text, sty, page):
    result, lines, i = [], text.strip().splitlines(), 0
    while i < len(lines):
        line = lines[i].strip()
        i += 1
        if not line:
            continue
        if line.startswith('{{'):
            result.append(Diagram(line.strip('{}'), sty))
        elif line.startswith('|'):
            table = [line]
            while i < len(lines) and lines[i].strip().startswith('|'):
                table.append(lines[i].strip()); i += 1
            result.append(table_rows(table, sty, page))
        elif line.startswith('> '):
            p = Paragraph(inline(line[2:]), sty['quote'])
            t = Table([[p]], colWidths=[WIDTH])
            t.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,-1),PALE),('LINEBEFORE',(0,0),(-1,-1),3,ACCENT),('LEFTPADDING',(0,0),(-1,-1),12),('RIGHTPADDING',(0,0),(-1,-1),12),('TOPPADDING',(0,0),(-1,-1),10),('BOTTOMPADDING',(0,0),(-1,-1),10)]))
            t.spaceBefore, t.spaceAfter = 3, 10
            result.append(t)
        elif line.startswith('#'):
            level = len(line)-len(line.lstrip('#'))
            st = sty['h'+str(min(level,3))]
            if page == 1 and level == 1:
                st = ParagraphStyle('cover', parent=st, fontSize=39, leading=42, spaceAfter=4)
            result.append(Paragraph(inline(line.lstrip('#').strip()),st))
        elif line.startswith('- ') or re.match(r'^\d+\. ',line):
            content = '&#8226;  ' + inline(line[2:]) if line.startswith('- ') else inline(line)
            result.append(Paragraph(content,sty['bullet']))
        else:
            while i<len(lines) and lines[i].strip() and not re.match(r'^(#|\||>|\{\{|\- |\d+\. )',lines[i].strip()):
                line += ' ' + lines[i].strip(); i += 1
            st = sty['small'] if line.startswith(('Fuentes:', 'Referencia:', 'Referencias:', 'Procedimiento técnico:', 'Esta edición')) else sty['body']
            result.append(Paragraph(inline(line),st))
    return result


def decoration(c, number):
    c.setFillColor(PAPER)
    c.rect(0,0,PAGE_W,PAGE_H,fill=1,stroke=0)
    c.setFillColor(ACCENT)
    c.rect(MARGIN,PAGE_H-34,25,3,fill=1,stroke=0)
    c.setFillColor(MUTED)
    c.setFont('Grafo-Bold',8)
    c.drawString(MARGIN+34,PAGE_H-34,'GRAFOPRINT  /  GUÍA DE DESARROLLO')
    c.setFont('Grafo',8)
    c.drawRightString(PAGE_W-MARGIN,PAGE_H-34,'EDICIÓN 01 · SEPTIEMBRE 2026')
    c.setStrokeColor(LINE)
    c.setLineWidth(.6)
    c.line(MARGIN,39,PAGE_W-MARGIN,39)
    c.setFont('Grafo',8)
    c.drawString(MARGIN,25,'De la idea a una publicación segura')
    c.setFont('Grafo-Bold',9)
    c.drawRightString(PAGE_W-MARGIN,25,f'{number:02d} / 10')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--font-dir')
    parser.add_argument('--output', type=Path, default=ROOT/'output/pdf/manual-desarrollo-grafoprint.pdf')
    args = parser.parse_args()
    register_fonts(args.font_dir)
    sty = styles()
    source = (ROOT/'docs/manual-desarrollo-grafoprint.md').read_text()
    sections = source.split('\n---\n')
    if len(sections) != 10:
        raise ValueError('El manual debe tener diez secciones/páginas; actualizar índice si cambia.')
    pages, fits = [], []
    for number, section in enumerate(sections,1):
        flows = parse_page(section,sty,number)
        height = sum(f.getSpaceBefore()+f.wrap(WIDTH,PAGE_H)[1]+f.getSpaceAfter() for f in flows)
        fits.append((number,round(height,1)))
        pages.append(flows)
    usable = PAGE_H-65-54
    overflow = [(n,h) for n,h in fits if h > usable]
    if overflow:
        raise ValueError(f'Contenido excede {usable:.1f} puntos: {overflow}. Alturas: {fits}. Reducir texto; no recortar.')
    args.output.parent.mkdir(parents=True,exist_ok=True)
    c = canvas.Canvas(str(args.output),pagesize=A4,pageCompression=1)
    c.setTitle('Grafoprint | Manual de trabajo seguro')
    c.setAuthor('Grafoprint')
    c.setSubject('Infraestructura, desarrollo, ramas, revisión y despliegue para vibecoders')
    c.setKeywords('Grafoprint, desarrollo, staging, producción, GitHub, manual')
    c._doc.Catalog.Lang = PDFString('es-AR')
    for number, flows in enumerate(pages,1):
        decoration(c,number)
        y = PAGE_H-65
        for f in flows:
            y -= f.getSpaceBefore()
            _,h = f.wrap(WIDTH,y-54)
            f.drawOn(c,MARGIN,y-h)
            y -= h+f.getSpaceAfter()
        c.showPage()
    c.save()
    print(f'PDF generado: {args.output}')
    print(f'Páginas: {len(pages)}. Alturas utilizadas (pt): {fits}')


if __name__ == '__main__':
    main()
