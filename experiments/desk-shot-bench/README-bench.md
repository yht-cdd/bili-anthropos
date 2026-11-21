# DeskShot 渲染基准（Actions vs Kaggle）

同一个 Remotion 3D 项目（660 帧 / 30fps / 1920×1080，Three.js + react-three-fiber），
只渲 **前 60 帧**（0–59），对比 GitHub Actions 与 Kaggle Notebook 的实际耗时。

## 变量控制

- 同一份源码、同一 package-lock.json、同一 Remotion 4.0.541
- 都不传 `--concurrency`，让 Remotion 按各自 CPU 自动决定
- 都走 headless Chrome 的软件 WebGL（SwiftShader）—— 除非另有说明
- 计时口径：`npx remotion render` 前后 `date +%s` 差值（不含 npm ci）

## 机器规格

| | vCPU | 内存 | GPU |
|---|---|---|---|
| GitHub Actions (public repo) | 4 | 16 GB | 无 |
| Kaggle Notebook (GPU on) | 4 | 29 GB | 2× T4 |
