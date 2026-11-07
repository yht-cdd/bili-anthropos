/* Live2D 口型驱动 capture：pixi.js7 + pixi-live2d-display(cubism4) + wawa-lipsync
 * 两遍法：
 *  Pass1 __record()        实时播放 audio + wawa 逐帧采 viseme → window.__timeline
 *  Pass2 __renderFrames()  离线确定性推进：查表 viseme + 手动 internalModel.update(ms)
 *                          + beforeModelUpdate 事件里写嘴参数（在 updateParameters 前）
 */
(function () {
  const FPS = 30, DTMS = 1000 / FPS;

  // ---- 虚拟时钟（wawa 用 performance.now 做 viseme 持续性判断）----
  let vnow = 0;
  const realNow = performance.now.bind(performance);
  performance.now = () => vnow;

  const RAC = window.AudioContext;
  window.AudioContext = window.webkitAudioContext = function (o) {
    return new RAC({ sampleRate: 48000, ...(o || {}) });
  };

  window.__status = { stage: 'boot' };
  window.__frameDone = 0;
  window.__timeline = null;
  window.__frames = [];

  const Live2DModel = PIXI.live2d.Live2DModel;

  const W = 1080, H = 1080;
  const app = new PIXI.Application({
    width: W, height: H,
    background: '#f2eee8',
    backgroundColor: 0xf2eee8,
    transparent: false,
    autoStart: false,
    powerPreference: 'low-power',
    preserveDrawingBuffer: true,
  });
  document.body.appendChild(app.view);

  const vis2open = {
    viseme_sil: 0.0, viseme_PP: 0.05, viseme_FF: 0.15, viseme_TH: 0.25,
    viseme_DD: 0.55, viseme_kk: 0.45, viseme_CH: 0.4, viseme_SS: 0.2,
    viseme_nn: 0.35, viseme_RR: 0.3, viseme_aa: 0.95, viseme_E: 0.6,
    viseme_I: 0.45, viseme_O: 0.7, viseme_U: 0.35,
  };
  const vis2form = {
    viseme_aa: 0.0, viseme_E: 0.4, viseme_I: 0.6, viseme_O: -0.5, viseme_U: -0.8,
  };

  const audio = new Audio('voice.mp3');
  audio.preload = 'auto';
  let lipsync = null, model = null;
  let mouthOpen = 0, mouthForm = 0;

  Live2DModel.from('model/model.model3.json', {
    autoUpdate: false, autoInteract: false,
  }).then(m => {
    model = m;
    const s = Math.min(W / m.width, H / m.height) * 0.95;
    m.scale.set(s); m.anchor.set(0.5, 0.5); m.x = W / 2; m.y = H / 2;
    app.stage.addChild(m);
    // 嘴参数必须在 internalModel.update 末尾 updateParameters() 之前写入
    model.internalModel.on('beforeModelUpdate', () => {
      const cm = model.internalModel.coreModel;
      cm.setParameterValueById('ParamMouthOpenY', mouthOpen);
      cm.setParameterValueById('ParamMouthForm', mouthForm);
    });
    lipsync = new window['Wawa-lipsync'].Lipsync({ fftSize: 2048, historySize: 10 });
    window.__model = m;
    window.__app = app;
    window.__status = { stage: 'model-ready' };
  }).catch(e => {
    window.__status = { stage: 'error', err: String((e && e.stack) || e) };
  });

  // ---- Pass 1：实时录 viseme 时间线 ----
  window.__record = function () {
    return new Promise(resolve => {
      function begin() {
        lipsync.connectAudio(audio);
        const t0 = realNow();
        const tl = [];
        vnow = 0;
        audio.play().then(() => {
          function step() {
            vnow = realNow() - t0;
            lipsync.processAudio();
            tl.push([Math.round(vnow), lipsync.viseme]);
            if (audio.ended || audio.paused) {
              window.__timeline = tl;
              window.__status = { stage: 'recorded', n: tl.length, dur: audio.duration };
              resolve(tl.length);
              return;
            }
            requestAnimationFrame(step);
          }
          requestAnimationFrame(step);
        }).catch(e => {
          window.__status = { stage: 'play-err', err: String(e) };
          resolve(-1);
        });
      }
      if (audio.readyState >= 1) begin(); else audio.onloadedmetadata = begin;
    });
  };

  // ---- Pass 2：离线确定性渲染（库自带眨眼/呼吸/物理走 internalModel）----
  window.__renderFrames = function () {
    const tl = window.__timeline;
    const total = Math.ceil((audio.duration || 10.776) * FPS);
    let ptr = 0, vis = 'viseme_sil';
    mouthOpen = 0; mouthForm = 0;
    window.__frames = [];
    window.__mouthLog = [];
    for (let f = 0; f < total; f++) {
      vnow = f * DTMS;
      while (ptr + 1 < tl.length && tl[ptr + 1][0] <= vnow) { ptr++; vis = tl[ptr][1]; }
      const tO = vis2open[vis] ?? 0, tF = vis2form[vis] ?? 0.1;
      mouthOpen += (tO - mouthOpen) * 0.4;
      mouthForm += (tF - mouthForm) * 0.25;
      model.internalModel.update(DTMS, DTMS);
      app.render();
      window.__mouthLog.push([f, vis.slice(7), +mouthOpen.toFixed(2), +model.internalModel.coreModel.getParameterValueById('ParamMouthOpenY').toFixed(2)]);
      window.__frames.push(app.view.toDataURL('image/jpeg', 0.9));
      window.__frameDone = f + 1;
    }
    window.__status = { stage: 'rendered', frames: total };
    return total;
  };
})();
