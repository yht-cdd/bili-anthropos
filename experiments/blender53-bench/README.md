# Blender 5.3 official scene benchmark

Manual-only benchmark for Blender Cycles on standard Ubuntu GitHub-hosted CPU runners. The repository carries only the runner code; the official [Blender 5.3 splash scene](https://download.blender.org/demo/splash/blender-5.3-splash.blend) and [Blender 5.3 Linux build](https://download.blender.org/release/Blender5.3/) are fetched once into an Actions cache. No third-party source assets or render images are published by this workflow.

1. `inspect`: report the original active scene, original render configuration, version and asset dependency paths without rendering.
2. `pilot`: validate one CPU-rendered PNG before scaling up. Use the report to check whether the scene is animated and decide the frame range, resolution and samples.
3. `benchmark`: split 100 valid scene frames over 1, 20 or 100 jobs. Keep input options identical between runs. The platform determines actual concurrent runner availability.

Each shard records validated PNG dimensions, SHA-256, render wall-clock duration and peak Blender RSS. The result artifacts are JSON only. Overall elapsed time includes runner setup, cache restore, extraction, scene load and artifact upload. Compare job intervals to measure peak actual job overlap. Render-stage timing is distinct from queue and preparation time; no video encoding is included.
