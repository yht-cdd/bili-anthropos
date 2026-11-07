# live2d-lipsync-poc

Live2D 口型驱动 PoC：voice.mp3 → wawa-lipsync 采 viseme → pixi-live2d-display 驱动 ParamMouthOpenY/Form → 30fps 逐帧渲染 → ffmpeg 合音轨出 mp4。

- 模型：FXYXL/dafeiyu-coo-figure（Coopanion base64 封装已解包进 model/）
- 关键坑：pixi 必须 6.x（0.4.0 的 cubism4.min.js 是 pixi6 构建）；core 必须 SDK5 官方 live2dcubismcore（仓库自带 2019 版不认 moc3 v5）；嘴参数须在 internalModel.update 的 beforeModelUpdate 事件里写
- 跑法：`npm i && npm run capture`（需要本机 chrome，`CHROME_PATH` 可覆盖）
