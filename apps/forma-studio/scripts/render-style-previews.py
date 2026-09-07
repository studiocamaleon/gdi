"""Render estático con Blender de las mallas exportadas por nuestro motor.
blender --background --factory-startup --python scripts/render-style-previews.py -- INPUT_JSON OUTPUT_DIR
"""
import bpy
import json
import math
import os
import sys
from mathutils import Vector

args = sys.argv[sys.argv.index("--") + 1:]
with open(args[0]) as source:
    previews = json.load(source)
if len(args) > 2:
    previews = [preview for preview in previews if preview['id'] in args[2:]]
output = os.path.abspath(args[1])
os.makedirs(output, exist_ok=True)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
scene = bpy.context.scene
scene.render.engine = 'CYCLES'
scene.cycles.samples = 40
scene.cycles.use_denoising = True
scene.render.resolution_x = 512
scene.render.resolution_y = 384
scene.render.resolution_percentage = 100
scene.render.threads_mode = 'FIXED'
scene.render.threads = 4
scene.render.image_settings.file_format = 'PNG'
scene.render.image_settings.color_mode = 'RGBA'
scene.render.film_transparent = True
scene.world.use_nodes = True
scene.world.node_tree.nodes['Background'].inputs[0].default_value = (0.72, 0.77, 0.83, 1)
scene.world.node_tree.nodes['Background'].inputs[1].default_value = 0.5
scene.view_settings.view_transform = 'AgX'

def material(name, color, metallic=0, roughness=0.4):
    result = bpy.data.materials.new(name)
    result.diffuse_color = (*color, 1)
    result.use_nodes = True
    shader = result.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Base Color'].default_value = (*color, 1)
    shader.inputs['Metallic'].default_value = metallic
    shader.inputs['Roughness'].default_value = roughness
    return result

body = material('Cuerpo · aluminio mate', (0.32, 0.39, 0.46), 0.35, 0.31)
face = material('Frente · grafito', (0.018, 0.032, 0.052), 0.1, 0.3)
back = material('Fondo · porcelana', (0.73, 0.77, 0.81), 0.05, 0.4)
cut = material('Sección · naranja Grafo3D', (1.0, 0.13, 0.002), 0.0, 0.34)
neon_body = material('Canal · relleno de estudio', (0.32, 0.39, 0.46), 0.0, 0.45)
# Relleno uniforme para que el fondo de 1,2 mm sea legible en la tarjeta.
neon_shader = neon_body.node_tree.nodes.get('Principled BSDF')
neon_shader.inputs['Emission Color'].default_value = (0.20, 0.27, 0.35, 1)
neon_shader.inputs['Emission Strength'].default_value = 0.5

camera_data = bpy.data.cameras.new('Cámara')
camera = bpy.data.objects.new('Cámara', camera_data)
scene.collection.objects.link(camera)
scene.camera = camera
camera_data.type = 'ORTHO'
camera_data.clip_end = 10000

def light(name, location, power, size, color):
    data = bpy.data.lights.new(name, 'AREA')
    data.energy = power
    data.shape = 'DISK'
    data.size = size
    data.color = color
    obj = bpy.data.objects.new(name, data)
    scene.collection.objects.link(obj)
    obj.location = location
    obj.rotation_euler = (-obj.location).to_track_quat('-Z', 'Y').to_euler()
    return obj

light('Softbox principal', (-170, -220, 320), 450000, 220, (1, 0.93, 0.86))
light('Relleno', (220, -80, 150), 250000, 180, (0.80, 0.89, 1))
light('Contraluz', (40, 230, 260), 550000, 160, (1, 1, 1))

for preview in previews:
    objects = []
    for i, part in enumerate(preview['parts']):
        mesh = bpy.data.meshes.new(f"{preview['id']}-{i}")
        mesh.from_pydata(part['vertices'], [], part['triangles'])
        mesh.update()
        obj = bpy.data.objects.new(mesh.name, mesh)
        scene.collection.objects.link(obj)
        objects.append(obj)
        base_material = body if part['layer'] == 'body' else face if part['layer'] == 'face' else back
        if preview['id'] == 'perforated' and part['layer'] == 'face':
            base_material = back
        if preview['id'] == 'neon':
            base_material = neon_body
        mesh.materials.append(base_material)
        mesh.materials.append(cut)
        for polygon in mesh.polygons:
            if preview['id'] != 'curved' and part['layer'] == 'body' and all(abs(mesh.vertices[v].co.y) < 0.001 for v in polygon.vertices):
                polygon.material_index = 1
        # Brillo de borde sólo visual: los archivos fabricables no se modifican.
        if len(part['vertices']) < 20000 and preview['id'] != 'neon':
            bevel = obj.modifiers.new('Microbisel de presentación', 'BEVEL')
            bevel.width = 0.15
            bevel.segments = 2
            bevel.limit_method = 'ANGLE'
            bevel.angle_limit = math.radians(35)
            normal = obj.modifiers.new('Normales de caras', 'WEIGHTED_NORMAL')
            normal.keep_sharp = True

    coords = [obj.matrix_world @ Vector(c) for obj in objects for c in obj.bound_box]
    low = Vector(tuple(min(v[a] for v in coords) for a in range(3)))
    high = Vector(tuple(max(v[a] for v in coords) for a in range(3)))
    center = (low + high) / 2
    direction = Vector((1.0, -1.65, 1.15)).normalized()
    if preview['id'] == 'curved':
        direction = Vector((1.1, -1.7, 0.95)).normalized()
    camera.location = center + direction * 550
    camera.rotation_euler = (center - camera.location).to_track_quat('-Z', 'Y').to_euler()
    bpy.context.view_layer.update()
    inverse = camera.matrix_world.inverted()
    projected = [inverse @ (obj.matrix_world @ v.co) for obj in objects for v in obj.data.vertices]
    min_x, max_x = min(v.x for v in projected), max(v.x for v in projected)
    min_y, max_y = min(v.y for v in projected), max(v.y for v in projected)
    # Centrar la silueta proyectada, no solamente su caja en el espacio.
    camera.location += camera.rotation_euler.to_matrix() @ Vector(((min_x+max_x)/2, (min_y+max_y)/2, 0))
    camera_data.ortho_scale = max(max_x-min_x, (max_y-min_y)*4/3) * 1.16
    scene.render.filepath = os.path.join(output, preview['id'] + '.png')
    bpy.ops.render.render(write_still=True)
    for obj in objects:
        mesh = obj.data
        bpy.data.objects.remove(obj, do_unlink=True)
        bpy.data.meshes.remove(mesh)
