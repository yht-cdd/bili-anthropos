# R2 · Remotion + three.js 技术调研（letter-1107）

> 调研日期：2026-11-07 ｜ 目标：Remotion 4.0.541 + React 18，1920×1080@30fps，GitHub Actions ubuntu-latest 无 GPU 渲染两段 3D（A 深夜书桌 / B 夕阳城市）
> 约定：【实测】= 本机跑过；【官方】= 官方文档或源码；【推测】= 没有直接证据的判断；查不到的写「未查到」。

---

## 0. 结论速览

| 问题 | 结论 |
|---|---|
| 包版本 | `@remotion/three@4.0.541`（peer 依赖要求 `remotion` 版本完全一致）+ `@react-three/fiber@8.18.0`（React 18 只能用 v8）+ `three@0.178.0`。drei 用 `9.122.0`，后期用 `@react-three/postprocessing@2.19.1` |
| gl 设置 | CI 上用 **`--gl=swangle`**。官方原话：「In Remotion 4.0, GitHub Actions will fail when using `angle`」，并建议无 GPU 的机器用 `swangle` |
| 并发 | 软件渲染 WebGL 时 **`--concurrency=1~2`**。【实测】并发 4 比并发 1 还慢，因为 SwiftShader 本身会吃满所有 CPU 核 |
| 单帧耗时 | 【实测，i5-1235U 12 线程】1080p：简单场景约 0.16–0.22 s/帧；400 个物体 + 2048 阴影约 0.8 s/帧。【推测】4 vCPU 的 CI 上会慢 2–3 倍，约 0.4–2.5 s/帧 |
| 拆分渲染 | **建议**：3D 段单独建 Composition，用矩阵 job 渲成 mp4，再在主合成里用 `<Video>`（@remotion/media）或 `<OffthreadVideo>` 引用 |
| 资产路线 | 书桌用「Poly Haven CC0 模型 + 程序化建模」混合；城市用 Kenney City Kit（CC0，低多边形）+ 天空/雾/灯光营造氛围；文字用 CanvasTexture |

---

## 1. @remotion/three 用法与版本对应

### 1.1 版本矩阵（npm registry 原始数据）

- `@remotion/three@4.0.541` 的 peerDependencies：`remotion: "4.0.541"`（必须完全一致）、`three >=0.137.0`、`@react-three/fiber >=8.0.0`、`react >=16.8.0`。官方开发时用的是 three 0.178.0、fiber 9.2.0、React 19.3.1。
  来源：https://registry.npmjs.org/@remotion/three/4.0.541
- `@react-three/fiber`：最新 9.8.2，peer 要求 `react >=19 <19.4`；**v8 最后一版 8.18.0**，peer 要求 `react >=18 <19`。所以 React 18 项目**只能用 fiber 8.18.0**。
  来源：https://registry.npmjs.org/@react-three/fiber
- `@react-three/drei`：9.x 最后一版 9.122.0（peer：react ^18、fiber ^8）；10.x 需要 React 19。
- `@react-three/postprocessing`：2.x 最后一版 2.19.1（peer：react ^18、fiber ^8）；3.x 需要 fiber 9。
- `troika-three-text@0.53.1`：peer 只要求 `three >=0.125`。
- 官方模板 template-three 用的是 fiber 9.2.0 + three 0.178.0 + React 19，配置里写的是 `Config.setChromiumOpenGlRenderer("angle")`。
  来源：https://github.com/remotion-dev/template-three/blob/main/package.json 、https://github.com/remotion-dev/template-three/blob/main/remotion.config.ts
- `<ThreeWebGPUCanvas>` 需要 fiber 9 + React 19，**本项目用不了**。来源：https://www.remotion.dev/docs/three-webgpu-canvas

**推荐安装命令（已在本机实测可装、可渲染）：**
```bash
npm i @remotion/three@4.0.541 three@0.178.0 @react-three/fiber@8.18.0 @types/three@0.170.0
# 按需：
npm i @react-three/drei@9.122.0 @react-three/postprocessing@2.19.1
```
> 风险：Remotion 官方用 fiber 9 测试，fiber 8 虽然满足 peer 要求，但官方没有专门测过（【推测】）。本机实测 fiber 8.18 + React 18.3.1 + remotion 4.0.541 渲染正常（见 §3.1）。如果后续出现上下文/Suspense 方面的怪问题，可以考虑把整个项目升到 React 19 + fiber 9（改动面较大）。

### 1.2 ThreeCanvas 的工作原理（读过源码）

源码：https://github.com/remotion-dev/remotion/blob/main/packages/three/src/ThreeCanvas.tsx
- 必须传 `width` 和 `height`（用来绕开 Studio 里 scale 变换导致的布局 bug）。
- **渲染时会强制设成 `frameloop='never'`**；每当 `useCurrentFrame()` 变化，`ManualFrameRenderer` 就会调用一次 `advance(performance.now())`，然后释放这一帧的 `delayRender`。也就是说，**每帧只画一次，画面完全由 React props 决定**。
- 外层包了 `<Suspense>`，fallback 里挂着 `delayRender('Waiting for <Suspense /> of <ThreeCanvas /> to resolve')`。所以 **`useLoader`/`useGLTF`/`useTexture` 这类会挂起（Suspense）的加载器会自动阻塞截图**，不会截到纹理还没加载完的画面。
  来源：https://github.com/remotion-dev/remotion/blob/main/packages/three/src/SuspenseLoader.tsx
- 继承 `<Sequence>` 的 props（`from`、`durationInFrames`、`premountFor` 等）。
- 在 Canvas 里面用 `<Sequence>` 时必须加 `layout="none"`。
- 官方文档原文：「Instead of using React Three Fibers `useFrame` API, you can (and must) write your animations fully declaratively using Remotions `useCurrentFrame` API」。
  来源：https://www.remotion.dev/docs/three-canvas 、https://www.remotion.dev/docs/three

### 1.3 逐帧确定性的规矩

来源：https://www.remotion.dev/docs/flickering 、https://www.remotion.dev/docs/random

1. 所有动画都写成 `f(frame)`：用 `interpolate` / `spring({frame, fps})` 算位置、旋转、光强、相机参数。
2. **禁止使用**：`useFrame`、`THREE.Clock`、`requestAnimationFrame`、`Date.now()`、`performance.now()` 参与动画计算、`Math.random()`。随机数用 `random('seed')`。
3. 禁止「增量式」状态（例如 `pos += v`）。渲染时多个标签页会乱序渲染不同帧。粒子、鲸鱼游动轨迹都要写成解析式，比如 `pos = curve.getPointAt(t(frame))`。
4. AnimationMixer（骨骼动画）：不能用 `mixer.update(delta)`，要写成 `mixer.setTime(frame / fps)`，这样每帧都是绝对时间【推测，three API 支持 setTime】。
5. 相机：在子组件里用 `useThree().camera` 直接设置 position/lookAt（本机实测可行），或者用 drei 的 `<PerspectiveCamera makeDefault position={...}/>`。
6. 异步更新的纹理（例如视频帧）更新后必须调用 `advance(performance.now())`，不能只调 `invalidate()`。来源：https://www.remotion.dev/docs/videos/as-threejs-texture
7. 已知：Chrome 158（4.0.540+ 自带的版本）在 Windows 上即使用 swiftshader，也存在 1–13 个像素级的不确定性。肉眼看不出来，只会影响哈希比对。来源：https://github.com/remotion-dev/remotion/issues/12929

### 1.4 截图贴到笔记本屏幕
```tsx
const tex = useTexture(staticFile('screen.png'));   // drei，会走 Suspense，自动 delayRender
tex.colorSpace = THREE.SRGBColorSpace;
<mesh><planeGeometry args={[0.33,0.21]}/><meshBasicMaterial map={tex} toneMapped={false}/></mesh>
```
屏幕要“发光”：用 `meshBasicMaterial` + `toneMapped={false}`，再加一盏 RectAreaLight 或 PointLight 朝人脸/键盘方向打屏幕溢光。

---

## 2. 无 GPU 的 Linux CI 上怎么渲染 WebGL

### 2.1 官方说法（原文摘录）

来源：https://www.remotion.dev/docs/gl-options
- 「In Remotion 4.0 … On a machine with no GPU, `swangle` is recommended. Rendering might be slow.」
- 「⚠️ Memory leaks are a known problem with angle. We recommend to split up long renders into multiple parts」
- 「**In Remotion 4.0, GitHub Actions will fail when using angle**, since Actions runners don't have a GPU.」
- 可选值：`null`（4.0 默认）、`angle`、`egl`、`swiftshader`、`vulkan`（4.0.41+）、`angle-egl`（4.0.52+）、`swangle`（Lambda/Cloud Run 的默认值）。
- 历史：v2.4.3–v2.6.6 曾经默认用 angle，后来发现内存泄漏会让长视频渲染崩溃，于是改回 null。来源：https://www.remotion.dev/docs/options/gl 、PR https://github.com/remotion-dev/remotion/pull/834
- `troubleshooting/webgl2-context`：「If you are on a machine without a GPU (for example AWS Lambda), use `--gl=swangle`」。来源：https://www.remotion.dev/docs/troubleshooting/webgl2-context
- Issue #1761（ThreeCanvas 报 “Error creating WebGL context”）：JonnyBurger 曾把模板默认改成 angle，但「This broke rendering in GitHub Actions, so reverted」。来源：https://github.com/remotion-dev/remotion/issues/1761
- Issue #9524（v5 规划）：「In v4, explicit angle remains useful for GPU acceleration; Chromium can already provide software WebGL without it.」也就是说，v4 用默认 null 时 Chromium 也可能走软件 WebGL，但 three 的文档仍然建议显式指定。来源：https://github.com/remotion-dev/remotion/issues/9524

### 2.2 各选项在 GitHub Actions 上的情况

| --gl | GH Actions（无 GPU） | 说明 |
|---|---|---|
| `swangle` | ✅ **推荐** | ANGLE 套在 SwiftShader 上，提供 WebGL2；Lambda 默认就是它，最稳 |
| `swiftshader` | 可用（【推测】） | 老的纯软件路径，WebGL2 的兼容性不如 swangle |
| `null` | 不确定 | 可能回落到软件渲染，也可能拿不到 WebGL 上下文，**不建议依赖** |
| `angle` | ❌ | 官方明确说在 GH Actions 上会失败 |
| `egl` / `angle-egl` / `vulkan` | ❌ | 需要真实 GPU 或驱动（参见 cloud-gpu 文档、issue #11282） |

**推荐配置：**
```ts
// remotion.config.ts —— 本地用 GPU 预览（angle），CI 通过环境变量切换成 swangle
import {Config} from '@remotion/cli/config';
Config.setChromiumOpenGlRenderer(process.env.CI ? 'swangle' : 'angle');
Config.setDelayRenderTimeoutInMilliseconds(120000); // 软件渲染重场景时，第 0 帧加载 GLB/HDR 可能超过 30s
```
或者直接在 CLI 上写 `npx remotion render ... --gl=swangle --concurrency=1 --timeout=120000`。

### 2.3 已知坑

| 坑 | 情况 / 对策 | 来源 |
|---|---|---|
| 黑屏 / 空 canvas | v4 不指定 gl 时 Chrome Headless Shell 可能输出空 canvas → 显式写 `--gl=swangle` | https://www.remotion.dev/docs/three-webgpu-canvas （“Without it, Chrome Headless Shell may produce an empty canvas”） |
| “Error creating WebGL context” | 同上；Docker 精简镜像缺图形库时也会出现。ubuntu-latest 只需按官方依赖列表 apt 安装 | #1761；https://www.remotion.dev/docs/miscellaneous/linux-dependencies |
| 纹理没加载完就截图 | 用会挂起的加载器（useTexture/useGLTF/useLoader），ThreeCanvas 内置 Suspense→delayRender；自己写的 `new TextureLoader().load()` 必须手动 `delayRender` | ThreeCanvas 源码 |
| 第 0 帧超时 | 大 GLB / HDR 解析很慢，默认 30s 超时 → 调大 `--timeout` | https://www.remotion.dev/docs/timeout （“Expensive WebGL scenes”） |
| 阴影 | 【实测】swangle 下 PCFSoft 2048 阴影渲染正确（见截图验证），只是更慢；建议只给 1 盏主光开阴影，静态场景可以“烘焙”阴影或用 drei `<ContactShadows frames={1}>` | 本机实测 |
| 后期处理（EffectComposer） | 未查到 Remotion 官方关于后期的专门说明或 issue。原理上 EffectComposer 走的是 R3F 的 render 回调，`advance()` 会触发它，**应该可用（【推测】）**；但每多一个 pass 就多一次全屏软件着色，1080p 下开销明显。建议只用 Bloom，或者把 DOF/暗角/颗粒交给 Remotion 层的 CSS/2D 去做 | 未查到 |
| angle 内存泄漏 | 只影响 angle；swangle 未见报告。长视频依然建议分段 | gl-options 文档 |
| 私有仓库 runner 更弱 | **私有仓库**的 ubuntu-latest 只有 **2 vCPU / 8 GB**；公开仓库是 4 vCPU / 16 GB | https://docs.github.com/en/actions/reference/runners/github-hosted-runners |

---

## 3. 性能预估与拆分方案

### 3.1 本机实测基准

- 环境：Windows 11，i5-1235U（10 核 12 线程，无独显参与）；Remotion 4.0.541，自带 Chrome Headless Shell 158.0.8127.2-remotion-v3；`--gl=swangle`；1920×1080；60 帧；h264。
- 基准工程：`C:\Users\正星gj\AppData\Local\Temp\opencode\r2bench\src\Root.tsx`（MeshStandard 材质 + 雾 + 半球光 + 平行光 + 点光 + 物理材质的金属环面结 + CanvasTexture 中文告示牌）。

| 场景 | 并发 | 渲染 60 帧用时 | 平均 capture/帧 | 第 0 帧 |
|---|---|---|---|---|
| Light：60 个盒子，无阴影 | 1 | 13.5 s | 162 ms | 871 ms |
| Shadow：60 个盒子 + 2048 阴影 | 1 | 16.2 s | 221 ms | — |
| Heavy：400 个盒子 + 阴影（400+ draw call） | 1 | 51.9 s | 801 ms | — |
| Heavy | **4** | **57.1 s（更慢）** | 3043 ms | — |

- 输出画面经检查正确（阴影、雾、光照都在）；不加 gl 参数（null）在 Windows 上输出的 PNG 和 swangle 完全相同（字节数一致）。**Linux CI 上的行为未实测**。
- 关键发现：**SwiftShader 自带多线程光栅化，并发开高之后只会互相抢 CPU**。3D 段用 `--concurrency=1` 或 2。
- 瓶颈主要在 **draw call 数量 × 像素填充**。所以要合并几何体，大量重复物体用 InstancedMesh（城市楼宇、星星），控制在 <150 个 draw call。

### 3.2 CI 推算（【推测】）

GH 公开仓库的 runner 是 4 vCPU（AMD EPYC 级别）。SwiftShader 的吞吐大致和核数成正比，估计比本机 12 线程慢 2–3 倍：
- 中等复杂场景（≈100 draw call、1 盏阴影光、PBR + 环境贴图）：**约 0.5–1.5 s/帧**
- 加 Bloom 后期：再加约 30–60%（【推测】）
- A 段约 20 s = 600 帧 → **5–15 分钟**
- B 段约 50 s = 1500 帧 → **15–40 分钟**
- 加上 npm ci、打包、Chrome 下载、编码，**单 job 跑 3D 很可能突破目前 30 分钟的 timeout**

### 3.3 拆分方案

GitHub 限制：GitHub 托管 runner 单 job 最长 **6 小时**；Free 计划最多 20 个 job 并发。来源：https://docs.github.com/en/actions/reference/limits

**推荐架构：3D 段单独渲染成片段 → 主合成引用**
1. 在 Root 里另外注册 `Desk3D`、`City3D` 两个 Composition（同样 1920×1080@30）。
2. workflow 第 1 阶段，用 matrix 并行跑：
   ```yaml
   strategy: { matrix: { part: [desk-0, desk-1, city-0, city-1, city-2, city-3] } }
   timeout-minutes: 120
   steps:
     - run: npx remotion render src/index.ts ${{ env.COMP }} out/${{ matrix.part }}.mp4 --frames=${{ env.RANGE }} --gl=swangle --concurrency=1 --timeout=120000 --crf=16 --muted
     - uses: actions/upload-artifact@v4
   ```
   `--frames=0-399` 这种区间是闭区间。来源：https://www.remotion.dev/docs/cli/render
3. 第 2 阶段（needs: 第 1 阶段）：下载各片段，用 ffmpeg concat（同一编码参数可以 `-c copy`）拼成 `public/3d/desk.mp4`、`city.mp4`；主合成里用 `<Video>`（@remotion/media，官方推荐）或 `<OffthreadVideo>` 引用；主合成本身不含 WebGL，用默认 gl、默认并发。
4. 好处：3D 段失败不会拖垮整片；3D 片段可以缓存（按源码 hash 做 actions/cache key），文案改动不用重渲 3D；主合成渲染时间不变。
5. 注意事项：片段之间的接缝要逐帧确定（已满足），分段边界 ±1 帧检查一次；码率要高（crf 14–16），避免二次编码后画质下降；也可以用 `--codec=prores` 当中间格式（但文件很大）。

> 「单独渲染再用 Video 引用是否更稳」：**是**。理由：①官方建议长渲染分段（angle 泄漏的相关说明）；②WebGL 和普通 DOM 混合时，并发设置互相矛盾（3D 要 1，DOM 要高）；③方便重试和缓存。

---

## 4. 写实感实现路线

### 4.1 程序化 vs CC0 资产

| 维度 | 程序化（Box/Extrude/Lathe + 噪声贴图） | CC0 资产（GLB + PBR 贴图） |
|---|---|---|
| 写实度 | 中，靠灯光和材质撑 | 高（扫描/精修模型） |
| 体积 | 几乎为 0 | 每个 1k 贴图版约 1–3 MB |
| 确定性 | 好 | 好（需走 Suspense 加载） |
| 渲染耗时 | 低 | 贴图分辨率越高越慢 → **统一用 1k 贴图** |
| 适合 | 笔记本、零食袋、桌面、城市楼体、告示牌 | 笔、线圈本、台灯、路灯、街道小物 |

**推荐混合路线**：主体（笔记本、桌面）程序化 + 关键小物用 Poly Haven 1k GLB + HDRI 提供环境反射。城市用 Kenney 低多边形 + 风格化光照（不追求照片级，追求“唯美”）。

### 4.2 可用 CC0 资源（体积为 Poly Haven API 实测：glTF + 全部贴图合计）

**Poly Haven**（全部 CC0，许可：https://polyhaven.com/license ，API：https://api.polyhaven.com）

| 资产 ID | 内容 | 1k 体积 | 2k 体积 | 用途 |
|---|---|---|---|---|
| `stationery_supplies` | 磨旧的笔、彩铅、铅笔、橡皮、金属笔筒（4412 面） | 1.89 MB | 6.92 MB | 书桌右侧笔 ✅ |
| `binder_notebook` | 皮面活页本、纸、铅笔 | 1.80 MB | 4.90 MB | 线圈本的替代（不是线圈结构） |
| `office_notepads` | 便签、横线本、索引卡（666 面） | 1.27 MB | 5.46 MB | 桌面纸张 ✅ |
| `desk_lamp_arm_01` | 摇臂台灯 | 2.74 MB | 8.08 MB | 台灯 ✅ |
| `industrial_pipe_lamp` | 工业风台灯 | 2.30 MB | 8.34 MB | 台灯备选 |
| `classic_laptop` | **复古米色笔记本**（DOS 屏、轨迹球） | 2.08 MB | 5.65 MB | ❌ 不符合“银色现代本”，建议程序化 |
| `WoodenTable_01` | 木桌 | 0.53 MB | 1.74 MB | 桌面 |
| `metal_office_desk` | 金属办公桌 | 1.53 MB | 5.00 MB | 桌面备选 |
| `street_lamp_01` | 路灯 | 2.07 MB | 5.64 MB | 城市 |
| `trashbag` | 垃圾袋（塑料褶皱） | 1.62 MB | 5.03 MB | 可改色当零食袋褶皱参考【推测】 |

Poly Haven 没有现代笔记本、零食袋、线圈本、键盘的模型（按 521 个模型的关键词检索，未查到）。

**Poly Haven HDRI（CC0）**

| ID | 氛围 | 1k / 2k / 4k .hdr |
|---|---|---|
| `belfast_sunset_puresky` | 纯天空夕阳 | 1.14 / 4.35 / 16.6 MB |
| `qwantani_dusk_2_puresky` | 黄昏纯天空 | 1.11 / 4.40 / 17.1 MB |
| `venice_sunset` | 城市夕阳 | 1.37 / 5.46 / 21.8 MB |
| `spruit_sunrise` | 春光、清晨 | 1.43 / 5.66 / 22.7 MB |
| `kloppenheim_07_puresky` | 夜空纯天空 | 1.22 / 4.77 / 18.5 MB |
| `moonless_golf` | 无月夜（星空） | 1.60 / 6.38 / 25.4 MB |
| `modern_buildings_night` | 城市夜景 | 1.58 / 6.18 / 24.2 MB |

> 建议：环境光照（`scene.environment`）用 1k 版本（PMREM 只需要低频信息）；要当可见背景的天空用 2k，或者干脆用程序化 Sky 和自绘星空。

**Kenney**（CC0，页面上写着 “License: Creative Commons CC0”）
- City Kit (Commercial) 2.1：50 个文件，摩天楼、商铺 — https://kenney.nl/assets/city-kit-commercial
- City Kit (Suburban) 2.0：40 个文件 — https://kenney.nl/assets/city-kit-suburban
- City Kit (Roads) 2.2：90 个文件，**含路牌、红绿灯** — https://kenney.nl/assets/city-kit-roads
- City Kit (Industrial) 2.0：40 个文件 — https://kenney.nl/assets/city-kit-industrial
- 压缩包体积：未查到（页面没有标注；【推测】每包几 MB，低多边形 + 单张调色板贴图）。风格为卡通低多边形，搭配夕阳光照、雾、Bloom 能出“唯美插画感”，正好和像素螃蟹的风格协调。

**ambientCG**（全部 CC0 1.0，许可原文：“All ambientCG assets are provided under the Creative Commons CC0 1.0 Universal License”）— https://docs.ambientcg.com/license/
- 可用材质类别：Wood（桌面木纹）、Plastic、Metal（笔记本铝壳，Brushed Metal）、Paper、Fabric、Asphalt/PavingStones（城市地面）。具体资产 ID 和体积未逐个查（1K-JPG 包通常 2–6 MB【推测】）。

### 4.3 天空、水、雾、体积光、后期在 Remotion 里是否可行

| 效果 | 方案 | 可行性 |
|---|---|---|
| 夕阳天空 | `three/examples/jsm/objects/Sky.js`（drei 9 的 `<Sky sunPosition=…/>`）；参数 turbidity/rayleigh/mieCoefficient 由 frame 插值 → 三种氛围（春光/午后/星空）平滑过渡 | ✅ 纯着色器，确定性好【推测：开销 = 1 次全屏片元着色】 |
| 星空 | `<Stars>`（drei）**内部用了 Math.random** → 必须自己用 `random(seed)` 生成 Points；闪烁写成 `sin(frame*k+phase)` | ✅ 自绘 |
| 水面 | `three/examples/jsm/objects/Water.js` 用 `time` uniform 驱动 → 把 `material.uniforms.time.value = frame/fps`；但它每帧还要额外渲染一次反射，**软件渲染下很贵**，建议不用或改为静态反射平面 | ⚠️ |
| 雾 | `scene.fog = new Fog/FogExp2`，颜色跟着天空变 | ✅ 几乎免费 |
| 体积光感 | 用“假体积光”：加法混合的圆锥 mesh + 渐变贴图（god-ray cone）；后期 GodRays pass 太贵 | ✅（假体积光） |
| Bloom | `@react-three/postprocessing@2.19.1` 的 `<EffectComposer><Bloom mipmapBlur luminanceThreshold={0.8}/></EffectComposer>` | ⚠️【推测可用，未实测】+30–60% 耗时 |
| 景深 | DOF pass 很贵 → 改为在 Remotion 层用 CSS `filter: blur()` 叠加前景层，或者用 2.5D 分层 | ⚠️ 建议降级 |
| 暗角 / 颗粒 | Remotion 层用 CSS 径向渐变 + 噪点 PNG 叠加 | ✅ 便宜 |

### 4.4 中文文字上屏

**首选：CanvasTexture**（【实测】基准工程里的中文告示牌在 swangle 下渲染正常）
- 在 `useMemo` 里创建 2D canvas，`fillText` 中文 → `new THREE.CanvasTexture(c)`，`colorSpace = SRGBColorSpace`，`anisotropy = 4~8`。
- 字体：CI 上已装 `fonts-noto-cjk`，canvas 字体写 `"Noto Sans CJK SC"`。更稳的做法是 `public/` 里放一份子集化字体，用 `@remotion/fonts` 的 `loadFont()`（或 `FontFace` + `delayRender`）**等字体加载完再画**，否则可能用回退字体画出“豆腐块”或错误字形。来源：https://www.remotion.dev/docs/flickering （“Ensure you correctly wait for fonts to load”）
- “一段一切”逐段浮现：每段一张纹理（预先画好），按帧切换 opacity / emissiveIntensity；手写逐字效果可以每帧重画 canvas（`needsUpdate = true`）。canvas 重绘也是确定性的。
- 黑板、报纸、广告牌：同一套逻辑，换底色和字体（黑板用白色粉笔字体 + 噪声擦痕）。

**troika-three-text（drei `<Text>`）**：
- 能用中文，但有两个坑：①字体缺字时会通过 unicode-font-resolver **从 jsDelivr CDN 拉回退字体**（自托管全套约 300 MB），CI 网络抖动会导致超时或不确定；②排版在 Web Worker 里**异步**完成（要监听 `synccomplete`），和 ThreeCanvas 的“每帧 advance 一次”配合，需要手动 delayRender + advance。来源：https://github.com/protectwise/troika/blob/main/packages/troika-three-text/README.md
- 如果要用：传入本地的**子集化**中文 TTF/WOFF（例如只含片中用到的几百个字，用 fonttools pyftsubset 生成，几十 KB），在 `onSync` 里调用 `continueRender` 和 `advance()`。
- **结论：CanvasTexture 更简单、更稳；troika 只在需要 3D 空间里清晰缩放的大字时才考虑。**

### 4.5 小螃蟹与鲸鱼

- **像素螃蟹**：首选 2D sprite（NearestFilter 纹理的 Plane，`magFilter = NearestFilter`、`generateMipmaps=false`），跳出屏幕的抛物线写成 `y = h·4t(1-t)`，落地用 spring 做挤压回弹。体素版可以用 InstancedMesh 拼 8×8×4 的方块（一个 draw call）。
- **DeepSeek 风格鲸鱼**：程序化。LatheGeometry 或 CatmullRom 管道做身体 + 顶点着色器按 `sin(x - frame·k)` 做摆尾；蓝色渐变 + 轻微自发光，配合 Bloom。漫游路径用 `CatmullRomCurve3.getPointAt(t)`，朝向用 `getTangentAt`。
- 官方 DeepSeek 鲸鱼 logo 有商标问题，做成“风格致敬”的原创造型【推测：合规风险提示】。

---

## 5. 书桌场景建模清单（最省事又像的方案）

| 物件 | 方案 | 要点 |
|---|---|---|
| 银色笔记本 | **程序化**：底座 = RoundedBox（drei `<RoundedBox radius={0.008}>`）0.31×0.015×0.215 m；屏幕盖同样做成圆角盒，绕后边铰链旋转约 105°；材质 `meshPhysicalMaterial({color:'#c9ccd1', metalness:1, roughness:0.35, clearcoat:0.3})` + ambientCG 拉丝金属的粗糙度贴图 | 金属需要环境贴图才好看 → 用 1k 室内 HDRI 当 `environment`（不显示），并把 `environmentIntensity` 压暗 |
| 屏幕 | Plane + `meshBasicMaterial({map: 截图, toneMapped:false})`，外圈黑色边框 | 加一盏 RectAreaLight（尺寸同屏幕，暖白偏蓝，intensity 3–5）朝向键盘和用户，模拟屏幕光 |
| 键盘 | **程序化 InstancedMesh**：约 78 个键帽用一个 InstancedMesh（1 个 draw call），深灰 roughness 0.45；键盘凹槽用略深的平面 | “键盘反光”= 屏幕 RectAreaLight 在低粗糙度键帽上的高光 + 底座金属反射 |
| 触控板 | Plane，roughness 0.25 | — |
| 零食袋 | **程序化**：PlaneGeometry(细分 32×48) → 顶点 shader/CPU 用 `random(seed)` 位移做褶皱和鼓胀；顶部/底部封口压扁成锯齿边；材质 metalness 0.6 roughness 0.3（镀铝膜）+ 自绘 CanvasTexture 包装图案（可以放自创品牌，中文“薯片”字样） | 不用找模型，可控性强；褶皱一次性生成后缓存 |
| 笔 | **Poly Haven `stationery_supplies` 1k（1.89 MB）**，可以拆出 2–3 支笔单独摆放 | 直接用，最像 |
| 线圈笔记本 | **程序化**：封面/封底 Box + 内页 Box（米白、横线 CanvasTexture）+ 线圈 = 沿书脊排列的 TorusGeometry（InstancedMesh，约 20 个，金属） | Poly Haven 没有线圈本；`office_notepads` 可以作为桌上散纸补充 |
| 桌面 | Plane + ambientCG 木纹（Wood 系列 1K：Color/Roughness/Normal） | 深色胡桃木，roughness 0.55，暖光下有细微高光 |
| 台灯光照 | 主光 = SpotLight（暖 2700K ≈ `#ffb46b`，angle 0.6，penumbra 0.8，**唯一开阴影的光**，mapSize 1024–2048）；台灯模型用 `desk_lamp_arm_01` 1k，可以只露出画面边缘的一部分 | 屏幕冷光 + 台灯暖光的冷暖对比 = 深夜氛围；ambient ≤ 0.05 |
| 背景 | 远处墙面贴暗色、雾 `FogExp2('#0b0806', 0.25)`，营造景深感 | 景深用模糊背景板（预先模糊的贴图），不用 DOF pass |
| 镜头推近 | `camera.position = lerp(远, 近, easeInOut(frame/dur))`，fov 35 | 微小手持晃动用 `noise(frame)`，必须用确定性噪声（例如 simplex 以 frame 为输入） |
| 阴影 | `shadows="soft"` 只给 SpotLight；地面再加 drei `<ContactShadows frames={1}>`（只算一次，便宜）给物件“接地” | `frames={1}` 只在第一帧渲染，但多标签页并发下每个页面都会算一次，结果确定 |

预计 draw call：约 40–60 个，【推测】CI 上约 0.5–1 s/帧。

---

## 6. 风险清单与降级方案

| # | 风险 | 可能性 | 影响 | 对策 / 降级 |
|---|---|---|---|---|
| 1 | **CI 渲染超时**（30 分钟 timeout 不够；私有仓库只有 2 vCPU） | 高 | 整片渲染失败 | 3D 段拆成独立 workflow + matrix 分段，timeout 改 120–360 分钟；仓库设成公开以获得 4 vCPU；降分辨率渲染（3D 段 `--scale=0.75` 再放大，或 1600×900 内部渲染）【推测：画质损失可接受】 |
| 2 | **swangle 在 Linux CI 上黑屏或拿不到 WebGL 上下文**（本调研只在 Windows 上实测过） | 中 | 3D 段全黑 | 先在 CI 上跑一个 `npx remotion still ... --frame=0 --gl=swangle` 的冒烟测试 job，检查 PNG 不是纯色；失败就试 `--gl=swiftshader`；再失败就走降级方案 B |
| 3 | **React 18 + fiber 8 和 @remotion/three 4.0.541 的兼容性**（官方用 fiber 9 / React 19 测试） | 低–中 | 上下文丢失、Suspense 不阻塞 | 本机已实测基础渲染正常；如果出问题，整个项目升 React 19 + fiber 9.2.0 + three 0.178.0（和官方模板一致） |
| 4 | 后期处理（Bloom）软件渲染太慢或出现异常 | 中 | 耗时 +50% | 只保留 Bloom（低分辨率 mipmapBlur），或者完全去掉后期，用 emissive + 加法混合光晕 sprite 模拟 |
| 5 | 中文字体没加载完就截图 / 回退字体 | 中 | 豆腐块、字形跳变 | 本地子集字体 + `loadFont` + delayRender；不用 troika 的 CDN 回退 |
| 6 | 第 0 帧加载 GLB/HDR 超时 | 中 | 渲染中断 | 统一 1k 贴图、GLB 用 gltf-transform 压缩（不用 Draco/KTX2，避免 Worker/WASM 加载的不确定性【推测】）；`--timeout=120000` |
| 7 | 写实度不够“高精度” | 中 | 观感廉价 | 靠灯光（冷暖对比 + 屏幕溢光）+ 环境贴图 + 雾掩盖细节；城市段改走“唯美低多边形插画风”而不是照片级 |
| 8 | drei 组件内部用随机数或时钟（`<Stars>`、`<Sparkles>`、`<Float>`、`<Cloud>` 等） | 高（如果用了） | 闪烁、帧间跳变 | 不用这些组件，自己写确定性版本；用之前读源码确认是否有 `Math.random`/`clock` |
| 9 | Chrome 158 像素级不确定性 | 已知 | 只影响哈希比对 | 忽略；或者固定使用 Chrome 157（`--browser-executable`） |

### 降级方案

- **方案 B：2.5D 视差图层（最稳）**
  预先用 AI 生图或本地 GPU 渲染出分层 PNG（背景墙 / 桌面 / 笔记本 / 零食 / 笔 / 前景虚化物），在 Remotion 里用 CSS `transform: translate3d + scale` 做相机推近的视差，螃蟹是 2D sprite 跳出。城市段：天空层（三种氛围的 PNG 交叉淡化）+ 远/中/近楼层 + 文字载体层（HTML 文本叠加，配 `perspective` 斜贴到告示牌上），鲸鱼用 SVG/PNG 序列。**CPU 开销极低，主合成可以直接一起渲。**
- **方案 C：本地 GPU 预渲染**
  在有 GPU 的本地机器上用 `--gl=angle` 渲出 3D 片段 mp4（本机 swangle 已能跑约 0.2–0.8 s/帧；用 angle 走 GPU 会更快【推测】），提交到仓库或上传网盘，CI 只用 `<Video>` 引用。3D 代码不变，只是改了渲染地点，**强烈建议作为第一备份**。
- **方案 D：降规格 3D**
  关阴影 → 只用 ContactShadows；去掉后期；内部分辨率 0.75×；InstancedMesh 合批。

---

## 附：本次调研的实测环境与文件

- 基准工程：`C:\Users\正星gj\AppData\Local\Temp\opencode\r2bench\`（`src/Root.tsx`、渲染日志 `out_*.log`、截图 `out/heavy30.png`）
- 依赖：remotion / @remotion/cli / @remotion/three 4.0.541，three 0.178.0，@react-three/fiber 8.18.0，react 18.3.1
- 浏览器：Chrome Headless Shell 158.0.8127.2-remotion-v3（Windows）
- 未实测：Linux CI 上的 swangle 表现、EffectComposer/Bloom、troika 中文、GLB 加载耗时
