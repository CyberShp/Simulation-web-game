"""Render a bound walk as fixed-camera transparent frames for desktop review.

Run Blender with the motion blend, then this script and -- --output DIR.
This creates presentation copies of materials and never saves over the input.
"""
import argparse
import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector


def arguments():
    parser = argparse.ArgumentParser()
    parser.add_argument('--output', required=True)
    parser.add_argument('--start', type=float)
    parser.add_argument('--end', type=float)
    parser.add_argument('--count', type=int, default=16)
    parser.add_argument('--duration', type=float)
    parser.add_argument('--stride', type=float, default=0)
    parser.add_argument('--yaw', type=float, default=40)
    parser.add_argument('--elevation', type=float, default=25)
    parser.add_argument('--samples', type=int, default=32)
    parser.add_argument('--only', type=int)
    parser.add_argument('--outline', type=float, default=0)
    return parser.parse_args(sys.argv[sys.argv.index('--') + 1:])


def area(name, position, power, size, color, target):
    light = bpy.data.lights.new(name, 'AREA')
    light.energy, light.shape, light.size, light.color = power, 'DISK', size, color
    obj = bpy.data.objects.new(name, light)
    bpy.context.scene.collection.objects.link(obj)
    obj.location = position
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat('-Z', 'Y').to_euler()


def main():
    args = arguments()
    if args.count < 2:
        raise ValueError('At least two distinct frames are required')
    out = Path(args.output).resolve()
    out.mkdir(parents=True, exist_ok=True)
    scene = bpy.context.scene
    rig = bpy.data.objects.get('ShenYan_Rig')
    if not rig or rig.type != 'ARMATURE':
        raise ValueError('Expected the preserved ShenYan_Rig')
    meshes = [o for o in scene.objects if o.type == 'MESH' and any(
        m.type == 'ARMATURE' and m.object == rig for m in o.modifiers)]
    if len(meshes) != 2:
        raise ValueError(f'Expected body and head, found {len(meshes)} bound meshes')
    for obj in list(scene.objects):
        if obj not in meshes and obj != rig:
            obj.hide_render = True
    for obj in meshes:
        obj.hide_render = False
    previous_pose = rig.data.pose_position
    rig.data.pose_position = 'REST'
    bpy.context.view_layer.update()
    deps = bpy.context.evaluated_depsgraph_get()
    rest = []
    for obj in meshes:
        evaluated = obj.evaluated_get(deps)
        rest.extend(evaluated.matrix_world @ Vector(v) for v in evaluated.bound_box)
    zmin, zmax = min(v.z for v in rest), max(v.z for v in rest)
    rig.data.pose_position = previous_pose
    bpy.context.view_layer.update()

    width, height, source_height = 256, 320, 222
    pivot = [128, 280]
    yaw, elevation = math.radians(args.yaw), math.radians(args.elevation)
    direction = Vector((-math.sin(yaw) * math.cos(elevation),
                        -math.cos(yaw) * math.cos(elevation), math.sin(elevation)))
    right = Vector((math.cos(yaw), -math.sin(yaw), 0))
    up = direction.cross(right)
    world_height = zmax - min(0, zmin)
    pixels_per_unit = source_height / (world_height * math.cos(elevation))
    target = up * ((pivot[1] - height / 2) / pixels_per_unit)
    camera_data = bpy.data.cameras.new('MotionReviewCamera')
    camera = bpy.data.objects.new('MotionReviewCamera', camera_data)
    scene.collection.objects.link(camera)
    camera.location = target + direction * 5
    camera.rotation_euler = (-direction).to_track_quat('-Z', 'Y').to_euler()
    camera_data.type = 'ORTHO'
    camera_data.ortho_scale = height / pixels_per_unit
    scene.camera = camera

    scene.world = bpy.data.worlds.new('MotionReviewWorld')
    scene.world.use_nodes = True
    tree = scene.world.node_tree
    tree.nodes.clear()
    background = tree.nodes.new('ShaderNodeBackground')
    output = tree.nodes.new('ShaderNodeOutputWorld')
    tree.links.new(background.outputs[0], output.inputs['Surface'])
    background.inputs['Color'].default_value = (.72, .78, .86, 1)
    background.inputs['Strength'].default_value = .45
    area('MotionReviewKey', right * 2.2 + direction * 2 + Vector((0, 0, 3.4)),
         250, 3.5, (1, .91, .77), (0, 0, .7))
    area('MotionReviewFill', -right * 2 + direction + Vector((0, 0, 1.5)),
         60, 3.0, (.76, .85, 1), (0, 0, .7))
    adjustments = []
    for obj in meshes:
        for slot in obj.material_slots:
            if not slot.material:
                continue
            material = slot.material.copy()
            slot.material = material
            if material.use_nodes:
                for node in material.node_tree.nodes:
                    if node.type == 'BSDF_PRINCIPLED':
                        changes = {}
                        for label, limit, operation in [('Roughness', .65, max), ('Specular IOR Level', .20, min)]:
                            socket = node.inputs.get(label)
                            if socket and not socket.is_linked:
                                before = socket.default_value
                                socket.default_value = operation(before, limit)
                                changes[label] = [before, socket.default_value]
                        adjustments.append({'material': material.name, 'changes': changes})
    scene.render.engine = 'CYCLES'
    scene.cycles.samples = args.samples
    scene.cycles.use_denoising = True
    scene.cycles.seed = 0
    scene.cycles.use_animated_seed = False
    scene.render.resolution_x, scene.render.resolution_y = width, height
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = True
    scene.render.image_settings.file_format = 'PNG'
    scene.render.image_settings.color_mode = 'RGBA'
    scene.render.image_settings.color_depth = '8'
    scene.view_settings.view_transform = 'Standard'
    scene.view_settings.look = 'None'
    scene.view_settings.exposure = 0
    scene.view_settings.gamma = 1
    scene.render.use_freestyle = args.outline > 0
    if args.outline > 0:
        settings = bpy.context.view_layer.freestyle_settings
        lines = settings.linesets[0] if settings.linesets else settings.linesets.new('Silhouette')
        lines.select_silhouette = True
        lines.select_border = True
        lines.select_crease = False
        lines.select_material_boundary = False
        lines.select_edge_mark = False
        lines.select_external_contour = True
        if lines.linestyle is None:
            lines.linestyle = bpy.data.linestyles.new('MotionReviewSilhouette')
        lines.linestyle.color = (.014, .022, .022)
        lines.linestyle.thickness = args.outline
    start = args.start if args.start is not None else float(scene.frame_start)
    end = args.end if args.end is not None else float(scene.frame_end + 1)
    duration = args.duration if args.duration is not None else (end - start) / (scene.render.fps / scene.render.fps_base)
    frames, source_frames = [], []
    for i in range(args.count):
        frame = start + (end - start) * i / args.count
        filename = f'walk-{i:03d}.png'
        frames.append(filename)
        source_frames.append(frame)
        if args.only is not None and i != args.only:
            continue
        scene.frame_set(math.floor(frame), subframe=frame % 1)
        scene.render.filepath = str(out / filename)
        bpy.ops.render.render(write_still=True)
    forward = Vector((0, -1, 0))
    manifest = {'kind': 'offline-character-motion-study', 'frames': frames,
                'fps': args.count / duration, 'frameSize': [width, height], 'pivot': pivot,
                'sourceHeight': source_height, 'nominalHeight': 111, 'duration': duration,
                'strideWorld': args.stride, 'worldHeight': world_height,
                'forwardScreenPerWorld': [forward.dot(right) * pixels_per_unit, -forward.dot(up) * pixels_per_unit],
                'camera': {'projection': 'orthographic', 'yawDegrees': args.yaw, 'elevationDegrees': args.elevation,
                           'pixelsPerWorldUnit': pixels_per_unit, 'fixedForEveryFrame': True},
                'inputBlend': bpy.data.filepath, 'sourceFrameRange': [start, end], 'sourceFrames': source_frames,
                'render': {'engine': 'Cycles', 'samples': args.samples, 'transparent': True,
                           'silhouetteLinePixels': args.outline, 'materials': adjustments}}
    filename = 'manifest.json' if args.only is None else f'calibration-{args.only:03d}.json'
    (out / filename).write_text(json.dumps(manifest, indent=2) + '\n')
    print(json.dumps({'output': str(out), 'manifest': filename, 'frames': args.count, 'duration': duration}))


if __name__ == '__main__':
    main()
