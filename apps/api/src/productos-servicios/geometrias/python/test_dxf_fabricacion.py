import io
import math
import unittest

import ezdxf
from dxf_fabricacion import inspeccionar, exportar


def texto(doc):
    out = io.StringIO()
    doc.write(out)
    return out.getvalue()


def ejemplo(color=3):
    doc = ezdxf.new('R2010')
    doc.units = 5  # centímetros
    for nombre, aci in [('EXTERIOR', 7), ('DOBLEZ', color), ('GUIAS', 5), ('APAGADA', 1), ('CONGELADA', 1), ('BLOQUEADA', 6)]:
        doc.layers.new(nombre, dxfattribs={'color': aci})
    doc.layers.get('APAGADA').off()
    doc.layers.get('CONGELADA').freeze()
    doc.layers.get('BLOQUEADA').lock()
    m = doc.modelspace()
    m.add_lwpolyline([(10,20), (110,20), (110,80), (10,80)], close=True, dxfattribs={'layer':'EXTERIOR'})
    m.add_line((20,30), (50,30), dxfattribs={'layer':'DOBLEZ'})
    m.add_arc((40,50), 5, 0, 180, dxfattribs={'layer':'GUIAS'})
    m.add_circle((60,50), 3, dxfattribs={'layer':'GUIAS'})
    m.add_text('Doblar aquí', dxfattribs={'insert':(15,70), 'height':2, 'layer':'GUIAS'})
    for capa in ['APAGADA','CONGELADA','BLOQUEADA']:
        m.add_line((0,0), (1,1), dxfattribs={'layer':capa})
    m.add_line((0,0),(1,2),dxfattribs={'layer':'GUIAS','invisible':1})
    return doc


def fuente(doc, identidad='abcdefgh', transformaciones=None):
    contenido = texto(doc)
    inv = inspeccionar(contenido)
    entidades = [{'entidadId':e['id'],'capa':e['capa'],'conservar':True,
                  'rol':'CORTE_EXTERIOR' if e['id']==inv['sugeridaId'] else None,
                  'puntos':e['puntos']} for e in inv['entidades']]
    return {'id':identidad, 'nombrePieza':identidad, 'contenido':contenido, 'fabricacion':{'origen':{'minX':10,'minY':-80,'factorMm':10}, 'entidades':entidades},
            'instancias':[{'transformacion':t, 'soloComplementos':False} for t in (transformaciones or [[1,0,0,1,5,7]])]}


class ConservacionDXF(unittest.TestCase):
    def exportar(self, fuentes):
        return ezdxf.read(io.StringIO(exportar({'baseDxf':texto(ezdxf.new('R2010')), 'altoMm':2000, 'fuentes':fuentes})['dxf']))

    def test_saltos_de_linea_windows(self):
        contenido = texto(ejemplo())
        self.assertEqual(inspeccionar(contenido), inspeccionar(contenido.replace("\n", "\r\n")))

    def test_visibilidad_entidades_y_capas(self):
        inv = inspeccionar(texto(ejemplo()))
        self.assertEqual(len(inv['entidades']),6)
        self.assertEqual({e['capa'] for e in inv['entidades']}, {'EXTERIOR','DOBLEZ','GUIAS','BLOQUEADA'})
        self.assertEqual(inv['unidadDeclarada'],'cm')
        linea = next(e for e in inv['entidades'] if e['capa']=='DOBLEZ')
        self.assertEqual(linea['longitud'],30)
        self.assertEqual(linea['precisionLongitud'],'EXACTA')
        arco = next(e for e in inv['entidades'] if e['tipoEntidad']=='ARC')
        self.assertAlmostEqual(arco['longitud'],math.pi*5)

    def test_curvas_texto_colores_y_registro_de_dos_copias(self):
        f = fuente(ejemplo(), transformaciones=[[1,0,0,1,5,7], [0,1,-1,0,1500,20]])
        out = self.exportar([f])
        m = out.modelspace()
        self.assertEqual(len(m),12)
        self.assertEqual(len(m.query('ARC')),2)
        self.assertEqual(len(m.query('CIRCLE')),2)
        self.assertEqual(len(m.query('TEXT')),2)
        self.assertEqual(out.layers.get('DOBLEZ').dxf.color,3)
        lineas = list(m.query('LINE[layer=="DOBLEZ"]'))
        self.assertAlmostEqual(lineas[0].dxf.start.x,105)
        self.assertAlmostEqual(lineas[0].dxf.start.y,1493)
        self.assertAlmostEqual(lineas[1].dxf.start.x,1000)
        self.assertAlmostEqual(lineas[1].dxf.start.y,1880)
        self.assertEqual(m.query('TEXT')[0].dxf.text,'Doblar aquí')
        self.assertFalse(out.audit().has_errors)

    def test_exclusion_y_common_line_no_duplican_exterior(self):
        f = fuente(ejemplo())
        f['instancias'][0]['soloComplementos'] = True
        for e in f['fabricacion']['entidades']:
            if e['capa']=='GUIAS':
                e['conservar']=False
        out = self.exportar([f])
        self.assertEqual(len(out.modelspace()),2)
        self.assertEqual(len(out.modelspace().query('LWPOLYLINE')),0)

    def test_capas_homonimas_con_colores_distintos(self):
        out = self.exportar([fuente(ejemplo(3),'primero1'),fuente(ejemplo(1),'segundo2')])
        self.assertEqual(out.layers.get('DOBLEZ').dxf.color,3)
        self.assertEqual(out.layers.get('segundo2_DOBLEZ').dxf.color,1)
        self.assertEqual(len(out.modelspace().query('LINE[layer=="DOBLEZ"]')),1)
        self.assertEqual(len(out.modelspace().query('LINE[layer=="segundo2_DOBLEZ"]')),1)

    def test_conflicto_identificado_por_pieza_sin_exponer_uuid(self):
        primera, segunda, tercera = fuente(ejemplo(3),'cuerpo-id'), fuente(ejemplo(1),'e21a33ce-id'), fuente(ejemplo(5),'otro-id')
        segunda['nombrePieza'] = tercera['nombrePieza'] = 'Faldón'
        out = self.exportar([primera, segunda, tercera])
        self.assertEqual(out.layers.get('Faldón_DOBLEZ').dxf.color,1)
        self.assertEqual(out.layers.get('Faldón_2_DOBLEZ').dxf.color,5)
        self.assertNotIn('e21a33ce_DOBLEZ',out.layers)
        self.assertEqual(len(out.modelspace()),18)
        self.assertEqual(len(out.modelspace().query('ARC')),3)

    def test_archivo_como_respaldo_y_caracteres_validos_en_nombres(self):
        primera, segunda = fuente(ejemplo(3)), fuente(ejemplo(1),'uuid-interno')
        segunda.pop('nombrePieza')
        segunda['nombreArchivo'] = 'Faldón / lateral.dxf'
        out = self.exportar([primera,segunda])
        self.assertIn('Faldón_lateral_DOBLEZ',out.layers)
        self.assertEqual(len(out.modelspace()),12)

    def test_capas_iguales_con_handles_de_material_distintos_conservan_su_nombre(self):
        primero, segundo = ejemplo(), ejemplo()
        segundo.materials.new('Otro material')
        for doc in (primero, segundo):
            material = doc.materials.new('Material compartido')
            doc.layers.get('DOBLEZ').dxf.material_handle = material.dxf.handle
        self.assertNotEqual(primero.layers.get('DOBLEZ').dxf.material_handle, segundo.layers.get('DOBLEZ').dxf.material_handle)
        out = self.exportar([fuente(primero,'primero1'), fuente(segundo,'segundo2')])
        self.assertEqual(len(out.modelspace().query('LINE[layer=="DOBLEZ"]')),2)
        self.assertNotIn('segundo2_DOBLEZ',out.layers)

    def test_reutiliza_el_tipo_de_linea_renombrado_al_combinar_varios_archivos(self):
        primero, segundo = ejemplo(), ejemplo()
        for doc in (primero, segundo):
            doc.linetypes.get('Continuous').dxf.description = 'Continua del original'
        out = self.exportar([fuente(primero,'primero1'),fuente(segundo,'segundo2')])
        self.assertEqual(len(out.modelspace().query('LINE[layer=="DOBLEZ"]')),2)
        self.assertNotIn('segundo2_DOBLEZ',out.layers)

    def test_tipos_de_linea_y_fuentes_homonimos_no_se_reemplazan(self):
        primero, segundo = ejemplo(), ejemplo()
        for doc, patron, font in [(primero,[1,.5,-.5],'arial.ttf'), (segundo,[2,1,-1],'cour.ttf')]:
            doc.linetypes.new('TRAZO', dxfattribs={'description':'Trazo', 'pattern':patron})
            doc.layers.get('DOBLEZ').dxf.linetype='TRAZO'
            doc.styles.new('ROTULO',dxfattribs={'font':font})
            doc.modelspace().query('TEXT')[0].dxf.style='ROTULO'
        out=self.exportar([fuente(primero,'primero1'),fuente(segundo,'segundo2')])
        self.assertEqual(out.layers.get('DOBLEZ').dxf.linetype,'TRAZO')
        self.assertEqual(out.layers.get('segundo2_DOBLEZ').dxf.linetype,'segundo2_TRAZO')
        fonts={out.styles.get(e.dxf.style).dxf.font for e in out.modelspace().query('TEXT')}
        self.assertEqual(fonts,{'arial.ttf','cour.ttf'})

    def test_bloques_repetidos_visibles_tienen_identidades_distintas(self):
        doc = ejemplo()
        bloque = doc.blocks.new('marcas')
        bloque.add_line((0,0),(1,2))
        m = doc.modelspace()
        m.add_blockref('marcas',(20,30),dxfattribs={'layer':'GUIAS'})
        m.add_blockref('marcas',(40,50),dxfattribs={'layer':'GUIAS'})
        m.add_blockref('marcas',(40,50),dxfattribs={'layer':'APAGADA'})
        inv = inspeccionar(texto(doc))
        bloques = [e for e in inv['entidades'] if '/' in e['id']]
        self.assertEqual(len(bloques),2)
        self.assertNotEqual(bloques[0]['id'],bloques[1]['id'])
        self.assertNotEqual(bloques[0]['puntos'],bloques[1]['puntos'])
        self.assertEqual(bloques[0]['capa'],'GUIAS')
        self.assertEqual(len(self.exportar([fuente(doc)]).modelspace()),8)

    def test_entidad_no_compatible_se_informa(self):
        doc = ejemplo()
        doc.modelspace().add_hatch()
        inv = inspeccionar(texto(doc))
        hatch = next(e for e in inv['entidades'] if e['tipoEntidad']=='HATCH')
        self.assertFalse(hatch['exportable'])
        self.assertTrue(inv['avisos'])


if __name__ == '__main__':
    unittest.main()
