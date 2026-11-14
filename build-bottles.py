"""Build the two showroom GLBs with Blender 4.3.

Run: blender -b --python build-bottles.py -- /path/to/stock-rose.glb .
The stock model is linked in README.md.
"""
import math
from pathlib import Path
import sys

import bpy


def material(name, color, roughness, metal=0, transmission=0, coat=0):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*color, 1)
    mat.use_nodes = True
    surface = mat.node_tree.nodes.get('Principled BSDF')
    for key, value in {
        'Base Color': (*color, 1), 'Roughness': roughness, 'Metallic': metal,
        'Transmission Weight': transmission, 'Coat Weight': coat
    }.items():
        surface.inputs[key].default_value = value
    return mat


def lathe(name, profile, mat, segments=96, exponent=1):
    """Profile rings in (height, half-width, half-depth) coordinates."""
    vertices = []
    for height, width, depth in profile:
        for i in range(segments):
            angle = i * math.tau / segments
            u, v = math.cos(angle), math.sin(angle)
            vertices.append((
                width * math.copysign(abs(u) ** exponent, u),
                depth * math.copysign(abs(v) ** exponent, v),
                height
            ))
    faces = [
        tuple(reversed(range(segments))),
        tuple(range(len(vertices) - segments, len(vertices)))
    ]
    for row in range(len(profile) - 1):
        for column in range(segments):
            start = row * segments
            next_column = (column + 1) % segments
            faces.append((start + column, start + next_column,
                          start + segments + next_column, start + segments + column))
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(mat)
    for face in mesh.polygons:
        face.use_smooth = face.index >= 2
    return obj


def ring(name, bottom, top, radius, mat):
    return lathe(name, [
        (bottom, radius * .94, radius * .94),
        (bottom + .002, radius, radius),
        (top - .002, radius, radius),
        (top, radius * .94, radius * .94)
    ], mat)


def export(path):
    bpy.ops.export_scene.gltf(
        filepath=str(path), export_format='GLB', export_yup=True,
        export_texcoords=True, export_normals=True
    )


stock, destination = map(Path, sys.argv[sys.argv.index('--') + 1:])
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(stock))
rose_parts = {obj.name.rsplit('_', 1)[-1]: obj for obj in bpy.context.scene.objects if obj.type == 'MESH'}
# The original opaque body includes a baked heart label. Make a fresh collar
# above the existing flask so its curved glass front stays clear.
for part in ('body', 'cap'):
    bpy.data.objects.remove(rose_parts[part], do_unlink=True)
obsidian = material('Obsidian lacquer', (.010, .008, .009), .105, .26, coat=.55)
bpy.ops.mesh.primitive_uv_sphere_add(segments=64, ring_count=40, radius=.0193, location=(0, 0, .0952))
cap = bpy.context.object
cap.name = 'Polished obsidian sphere'
cap.data.materials.append(obsidian)
for polygon in cap.data.polygons:
    polygon.use_smooth = True
for key, mat in {
    'glass': material('Rose crystal', (.99, .80, .84), .07, transmission=.96),
    'fluid': material('Rose eau de parfum', (.73, .23, .34), .30, transmission=.14, coat=.28),
}.items():
    rose_parts[key].data.materials.clear()
    rose_parts[key].data.materials.append(mat)
rose_gold = material('Polished rose gold', (.69, .36, .23), .16, .86)
ring('Rose gold collar', .0685, .083, .0151, rose_gold)
ring('Rose gold lower trim', .067, .0705, .0164, rose_gold)
export(destination / 'rose-lune.glb')

bpy.ops.wm.read_factory_settings(use_empty=True)
glass = material('Clear sage crystal', (.79, .94, .59), .068, transmission=.97)
liquid = material('Galet eau de parfum', (.41, .61, .16), .2, transmission=.52, coat=.55)
gold = material('Polished champagne brass', (.68, .51, .27), .15, .88)
ivory = material('Pearlescent ivory', (.86, .77, .57), .22, .14, coat=.65)

lathe('Sculpted glass flacon', [
    (.000, .033, .0165), (.0012, .037, .0193), (.004, .0394, .0217),
    (.009, .0408, .0229), (.016, .0418, .0235), (.026, .0422, .0238),
    (.047, .0422, .0238), (.056, .0416, .0235), (.062, .0399, .0223),
    (.0665, .0356, .0198), (.0697, .028, .016), (.071, .018, .0127),
    (.073, .0133, .0124), (.0748, .0128, .0122),
], glass, exponent=.47)
lathe('Green perfume inside glass', [
    (.010, .032, .016), (.013, .0355, .0185), (.019, .0374, .0198),
    (.026, .0383, .0206), (.045, .0383, .0206), (.052, .0379, .020),
    (.055, .0371, .0194),
], liquid, exponent=.52)
ring('Gold neck', .0705, .0855, .014, gold)
ring('Lower neck trim', .0708, .074, .0152, gold)
ring('Upper neck trim', .082, .085, .0157, gold)

pebble = []
for i in range(41):
    angle = math.pi * i / 40
    y = .0965 - .0142 * math.cos(angle)
    curve = max(.002, math.sin(angle))
    pebble.append((y, .0235 * curve, .0194 * curve))
lathe('Polished ivory pebble', pebble, ivory)
export(destination / 'galet.glb')
