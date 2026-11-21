# Blender 5.3 official scene benchmark

Manual-only benchmark for Blender Cycles on standard Ubuntu GitHub-hosted CPU runners. The repository carries only the runner code. The official [Blender 5.3 splash scene](https://download.blender.org/demo/splash/blender-5.3-splash.blend) and [Blender 5.3 Linux build](https://download.blender.org/release/Blender5.3/) are fetched once into an Actions cache.

Scene attribution: [Blender Studio, OVERGROWN — Blender 5.3 Splash Screen Study](https://studio.blender.org/blog/blender-5-3-splash-screen-study/), by Andy Goralczyk and Anastasia Rudina, [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). The original file is not changed. Benchmark derivatives use CPU Cycles and CPU compositing, reduce sampling/resolution, and sweep the lens shift as documented below.

1. `inspect`: report the original active scene, original render configuration, version and asset dependency paths without rendering.
2. `pilot`: validate one CPU-rendered PNG before scaling up.
3. `benchmark`: split 100 renders over 1, 20 or 100 jobs. This official splash file outputs only frame 396, so for this benchmark the subjects remain at pose 396 and an unparented copy of the evaluated original camera sweeps horizontal lens shift from −0.035 to +0.035 relative to the original. This measures rendering 100 views of the same scene, not rendering a native animation. Keep input options identical between runs. The platform determines actual concurrent runner availability.

Each shard records validated PNG dimensions, SHA-256, render wall-clock duration and peak Blender RSS. The result artifacts are JSON only. Overall elapsed time includes runner setup, cache restore, extraction, scene load and artifact upload. Compare job intervals to measure peak actual job overlap. Render-stage timing is distinct from queue and preparation time; no video encoding is included.
