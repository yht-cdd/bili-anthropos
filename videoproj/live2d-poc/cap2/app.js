// Live2D lipsync capture page: pixi7 + pixi-live2d-display(cubism4) + wawa-lipsync.
// Driven frame-by-frame from precomputed wawa viseme params (capture/frame_params.json).
/* global PIXI */
(async () => {
  const DT = 1000 / 30;
  const W = 1280, H = 720;
  const mark = (m) => (window.LOG || []).push("app:" + m);

  mark("boot");
  const res = await fetch("capture/frame_params.json");
  const { frames } = await res.json();
  mark("params " + frames.length);

  const app = new PIXI.Application({ width: W, height: H, backgroundColor: 0x16161c, antialias: true });
  app.ticker.stop();
  document.body.appendChild(app.view);
  mark("pixi ok, renderer=" + (app.renderer && app.renderer.type));

  const model = await PIXI.live2d.Live2DModel.from("model/model.model3.json", { autoUpdate: false });
  mark("model ok " + model.width + "x" + model.height);
  model.anchor.set(0.5, 1);
  const scale = (H * 0.98) / model.height;
  model.scale.set(scale);
  model.x = W / 2;
  model.y = H;
  app.stage.addChild(model);

  const P_OPEN = "ParamMouthOpenY", P_FORM = "ParamMouthForm";
  const coreModel = model.internalModel.coreModel;
  let idx = -1;

  window.CAP = {
    total: frames.length,
    frame: 0,
    ready: false,
    error: null,
    step() {
      idx++;
      const [open, form] = frames[idx];
      coreModel.setParameterValueById(P_OPEN, open);
      coreModel.setParameterValueById(P_FORM, form);
      model.update(DT); // accumulate deltaTime/elapsedTime consumed by next render
      app.render();      // triggers internalModel.update once (blink/physics/breath) + draw
      window.CAP.frame = idx + 1;
      return window.CAP.frame;
    },
    pump(n) { // synchronous batch: only the last frame is guaranteed painted (screenshot is synced to compositor)
      for (let i = 0; i < n; i++) window.CAP.step();
      return window.CAP.frame;
    },
  };
  window.CAP.ready = true;
})().catch((e) => { window.CAP = { ready: false, error: String(e && e.stack || e) }; });
