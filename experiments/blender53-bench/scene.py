"""Inspect or render one trusted Blender demo. Run under Blender, not CPython."""
import bpy
import hashlib
import json
import os
from pathlib import Path
import platform
import resource
import time


def attrs(obj, names):
    return {k: getattr(obj, k, None) for k in names.split()}


def dump(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + '\n')


def config(s):
    r = s.render
    output = attrs(r, 'engine resolution_x resolution_y resolution_percentage fps fps_base film_transparent threads_mode threads use_motion_blur compositor_device use_persistent_data')
    output['image_settings'] = attrs(r.image_settings, 'file_format color_mode color_depth color_management')
    fps = r.fps / r.fps_base
    return {
        'scene': s.name,
        'frame_start': s.frame_start, 'frame_end': s.frame_end,
        'frame_step': s.frame_step, 'frame_current': s.frame_current,
        'timeline_seconds': len(range(s.frame_start, s.frame_end + 1, s.frame_step)) / fps,
        'render': output,
        'color_management': attrs(s.view_settings, 'view_transform look exposure gamma'),
        'cycles': attrs(s.cycles, 'device samples preview_samples use_adaptive_sampling adaptive_threshold adaptive_min_samples use_denoising denoiser denoising_start_sample denoising_input_passes denoising_prefilter denoising_quality denoising_use_gpu max_bounces'),
        'eevee': attrs(s.eevee, 'taa_render_samples taa_samples use_raytracing use_gtao'),
        'actions': len(bpy.data.actions),
        'objects_with_animation_data': sorted(o.name for o in s.objects if o.animation_data),
        'camera': s.camera.name if s.camera else None,
    }


def sha(path):
    with path.open('rb') as f:
        return hashlib.file_digest(f, 'sha256').hexdigest()


def main():
    out = Path(os.environ['RESULT_DIR']).resolve()
    s = bpy.context.scene
    source = Path(bpy.data.filepath)
    original = config(s)
    report = {
        'blender': bpy.app.version_string,
        'blend_saved_version': list(bpy.data.version),
        'blend_sha256': sha(source),
        'unpacked_dependencies': sorted(bpy.utils.blend_paths(packed=False, absolute=False)),
        'active_scene': original,
        'scenes': [config(scene) for scene in bpy.data.scenes],
    }
    mode = os.environ['BENCH_MODE']
    if mode == 'inspect':
        dump(out / 'scene.json', report)
        print(json.dumps(report, ensure_ascii=False, indent=2), flush=True)
        return
    if s.render.engine != 'CYCLES':
        raise RuntimeError(f'Expected original Cycles scene, got {s.render.engine}; no silent engine override')
    s.cycles.device = 'CPU'
    s.cycles.denoising_use_gpu = False
    s.render.compositor_device = 'CPU'
    s.render.threads_mode = 'FIXED'
    s.render.threads = min(4, len(os.sched_getaffinity(0)))
    s.render.resolution_percentage = int(os.environ['PERCENT'])
    s.cycles.samples = int(os.environ['SAMPLES'])
    s.render.image_settings.file_format = 'PNG'
    start, stride = int(os.environ['FRAME_START']), int(os.environ['FRAME_STEP'])
    n, shards, shard = map(int, (os.environ['FRAME_COUNT'], os.environ['SHARDS'], os.environ['SHARD']))
    if not s.camera or not s.frame_start <= start <= s.frame_end:
        raise ValueError('Source frame must be in the original scene range and have a camera')
    indices = range(shard * n // shards, (shard + 1) * n // shards)
    if not indices:
        raise ValueError('Empty shard')
    s.frame_set(start)
    derived = mode != 'inspect' and s.frame_start == s.frame_end
    if derived:
        if stride != 1:
            raise ValueError('The derived camera sweep requires stride 1')
        # Preserve the source pose and animation. Create a new, unattached camera at
        # the original evaluated transform and sweep only the horizontal lens shift.
        dg = bpy.context.evaluated_depsgraph_get()
        src_camera = s.camera.evaluated_get(dg)
        world = src_camera.matrix_world.copy()
        camera_data = s.camera.data.copy()
        camera_data.animation_data_clear()
        base_shift = src_camera.data.shift_x
        camera = bpy.data.objects.new('Benchmark camera', camera_data)
        s.collection.objects.link(camera)
        camera.matrix_world = world
        s.camera = camera
    elif start + indices[-1] * stride > s.frame_end:
        raise ValueError('Frame range exceeds the original scene')
    report.update({'effective_scene': config(s), 'shard': shard, 'shards': shards, 'platform': platform.machine(),
                   'visible_logical_cpus': len(os.sched_getaffinity(0)), 'frames': [],
                   'sequence_kind': 'derived-lens-shift' if derived else 'native-frames'})
    for i in indices:
        frame = i + 1 if derived else start + i * stride
        source_frame = start if derived else frame
        shift = None
        if derived:
            shift = base_shift + (-0.035 + 0.070 * i / (n - 1) if n > 1 else 0.0)
            camera.data.shift_x = shift
        else:
            s.frame_set(source_frame)
        path = out / f'frame-{frame:06}.png'
        s.render.filepath = str(path)
        t = time.monotonic()
        result = bpy.ops.render.render(write_still=True)
        elapsed = time.monotonic() - t
        with path.open('rb') as f:
            header = f.read(24)
        if 'FINISHED' not in result or header[:8] != b'\x89PNG\r\n\x1a\n':
            raise RuntimeError(f'Invalid render for frame {frame}')
        width, height = (int.from_bytes(header[i:i+4], 'big') for i in (16, 20))
        report['frames'].append({'frame': frame, 'source_frame': source_frame, 'lens_shift_x': shift, 'seconds': round(elapsed, 3), 'width': width, 'height': height,
                                 'bytes': path.stat().st_size, 'sha256': sha(path)})
        # Check every output; retain a preview for the pilot, not 100 PNG uploads.
        if mode != 'pilot':
            path.unlink()
        dump(out / 'result.json', report)
    report['max_rss_kib'] = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
    dump(out / 'result.json', report)


main()
