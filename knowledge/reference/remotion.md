# Remotion 参考：动画与提示词

抓取时间：2026/10/31 11:34:41

> 写 brief 时对照这里。**动画不是加得越多越好，是每一帧都在推进信息。**

## Remotion advanced animation techniques transitions sequences best practices

- **[🎬 Remotion Development Guidelines for Claude](https://cdn.jsdelivr.net/npm/@endlessblink/rough-cuts-mcp@4.5.10/claude-dev-guidelines/ADVANCED/REMOTION_ANIMATION_RULES.md)**
  ## ⚡ QUICK START - ALWAYS IMPLEMENT THESE ### Professional Animation Checklist: - ✅ Overlapping scenes - No empty screen time (15-frame overlaps) - ✅ Movement + fades - Never fade-only transitions - ✅ Quick timing - 20-frame entries, 15-frame exits - ✅ Proper sizing - 16px+ text, 18px+ badges, 20px+ buttons, 44px+ touch targets - ✅ Professional typography - Use modern sans-serif fonts with proper hierarchy - ✅ Staggered elements - 5-8 frame delays within scenes - ✅ Safe interpolation - Always us

- **[Remotion Best Practices | From Animated Slides to Real Videos | Skillwire](https://skillwire.ai/en/skills/remotion-best-practices)**
  You installed Remotion, followed the docs, and your video renders. It also looks like a PowerPoint presentation that learned to move. Every element fades in at the same speed. Text appears and sits there. Transitions are basic cuts or dissolves. You know the video should look better but you don't know what "better" means in motion design terms. The Remotion API docs explain how spring() works. They don't explain when to use a spring with overshoot versus a damped settle, why staggered entries lo

- **[Remotion 场景转场完全指南：基于 TransitionSeries 打造专业无缝画面切换（Prompt to Motion Graphics 实战） -](https://blog.gitcode.com/4cf165a5e8c83e13e6a2e6300ea36fc1.html)**
  Remotion 场景转场完全指南：基于 TransitionSeries 打造专业无缝画面切换（Prompt to Motion Graphics 实战） - AtomGit | GitCode博客 # Remotion 场景转场完全指南：基于 TransitionSeries 打造专业无缝画面切换（Prompt to Motion Graphics 实战） 原创 2026-09-07 10:41:49 1,976 阅读

- **[remotion-video-creation](https://skillsmp.com/creators/affaan-m/ecc/skills-remotion-video-creation)**
  Best practices for Remotion - Video creation in React. 29 domain-specific rules covering 3D, animations, audio, captions, charts, transitions, and more. Use when building video in React with Remotion — animations, audio, captions, charts, or transitions. ... ## When to use Use this skills whenever you are dealing with Remotion code to obtain the domain-specific knowledge. ## How to use Read individual rule files for detailed explanations and code examples: - [rules/3d.md](rules/3d.md) - 3D conte

- **[remotion-best-practices | searchpo](https://www.claudepluginhub.com/skills/sunflowerslwtech-searchpo-plugins-searchpo/remotion-best-practices)**
  #### Composition Design - `src/Composition.tsx` owns the global video shell. Scene-specific blocks live under `src/scenes/`, and storyboard contract/timing helpers live in `src/storyboard.ts`. - Props are typed via `Payload` interface. Data comes from `remotion_input_props.json` at render time and should include a validated `storyboard`; `video_spec.json` is the renderer-neutral planning artifact compiled into `render_payload.json`, and legacy `cards` are only a compatibility fallback. - The sto

- **[plugins/searchpo/.claude/skills/remotion-best-practices/SKILL.md](https://github.com/SunflowersLwtech/sunkit/blob/main/plugins/searchpo/.claude/skills/remotion-best-practices/SKILL.md)**
  ## Architecture Rules ### Composition Design - `src/Composition.tsx` owns the global video shell. Scene-specific blocks live under `src/scenes/`, and storyboard contract/timing helpers live in `src/storyboard.ts`. - Props are typed via `Payload` interface. Data comes from `remotion_input_props.json` at render time and should include a validated `storyboard`; `video_spec.json` is the renderer-neutral planning artifact compiled into `render_payload.json`, and legacy `cards` are only a compatibilit

## Remotion spring interpolate easing cinematic motion design tutorial

- **[remotion-composer/src/CinematicRenderer.tsx](https://github.com/calesthio/OpenMontage/blob/9066dcb2/remotion-composer/src/CinematicRenderer.tsx)**
  const FPS = 30; const { fontFamily } = loadFont("normal", { weights: ["400", "500", "700"], subsets: ["latin"], }); const toneGradient = (tone: CinematicTone) => { switch (tone) { case "steel": return "linear-gradient(180deg, rgba(6,12,18,0.18) 0%, rgba(2,4,8,0.48) 100%)"; case "void": return "linear-gradient(180deg, rgba(2,4,8,0.14) 0%, rgba(0,0,0,0.56) 100%)"; case "neutral": return "linear-gradient(180deg, rgba(10,10,12,0.16) 0%, rgba(0,0,0,0.42) 100%)"; case "cold": default: return "linear-g

- **[skills/frame-smith/references/motion-floor.md](https://github.com/mouse-lin/frame-smith/blob/main/skills/frame-smith/references/motion-floor.md)**
  # motion-floor.md — The Universal Motion Craft Floor > Applies to **both** registers (cinematic + short). This is the thin, consistent layer that separates an expensive-looking clip from a slideshow. Lay it first, every build. The forks (orientation, safe zones, subtitles) are marked. ... ## 1. Time is authored in seconds — never raw frames ```ts const FPS = 30; // all HyperFrames are 30fps. Do not use 24 or 60. const f = (s: number) => Math.round(s * FPS); // second → frame. Every beat & delay 

- **[skills/ad-creative-video/references/batch-ad-pipeline.md](https://github.com/iart-ai/ad-video-skills/blob/main/skills/ad-creative-video/references/batch-ad-pipeline.md)**
  ## 2. Aspect config Drive layout from a single aspect prop so one composition reframes to every placement. Dimensions and the keep-clear bottom band differ per aspect. ```ts // aspects.ts export type Aspect = "9x16" | "4x5" | "1x1" | "16x9"; export const ASPECTS: Record<Aspect, {w: number; h: number; bottomSafe: number}> = { "9x16": {w: 1080, h: 1920, bottomSafe: 540}, // captions + CTA + username stack here "4x5": {w: 1080, h: 1350, bottomSafe: 135}, "1x1": {w: 1080, h: 1080, bottomSafe: 110}, 

- **[Remotion text typewriter effect](https://gist.github.com/willhalling/e76edc84003b68d860f05a0bcf280734)**
  ## gistfile1.txt ```txt import {spring, useCurrentFrame, interpolate, Easing, useVideoConfig} from 'remotion'; /* Pass params into component like this: <TitleThree titleText={`But I watch and learn from them. I like the little they know, which is so much.`} titleColor="white" backgroundColor="black" fontSize={60} fontFamily="Lora" /> */ export const TitleThree: React.FC<{ titleText: string; titleColor: string; fontSize: number; fontFamily: string; backgroundColor: string; textShadow: string; }> 

- **[Video Automation - The Full Remotion Suite Skill | Antigravity Skills Directory](https://antigravityskills.directory/skills/video-automation-the-full-remotion-suite)**
  ## 📚 Required Reading For detailed technical implementation, refer to the `remotion-best-practices` skill which contains 16 comprehensive rule files: | Core Rules | Description | | --- | --- | | `animations.md` | Frame-based animations with `useCurrentFrame()` | | `timing.md` | Springs, easing, interpolation curves | | `sequencing.md` | ` ` and ` ` patterns | | `transitions.md` | Scene transitions with `@remotion/transitions` | | `audio.md` | Audio import, trimming, volume control | | `videos.m

- **[Make Marketing Videos with Claude Code + Remotion: Step-by-Step Tutorial (2026) ](https://cc4.life/claude-code/tutorials/remotion-video-creation/)**
  ## What is Remotion? Remotion is a framework that creates videos using React code instead of timeline editors. Instead of dragging clips, you write (or have Claude write) components that render frame-by-frame. Why this matters for non-coders: You don’t need to understand React. You describe what you want. Claude Code writes the React. You get the video. The magic is in translation: you say “bouncy”, Claude writes `spring({ config: { damping: 8 } })`. You say “smooth fade”, Claude writes `interpo

## Remotion video composition data visualization chart animation

- **[skills/remotion-video/references/templates/data-viz.tsx](https://github.com/mathews-tom/armory/blob/main/skills/remotion-video/references/templates/data-viz.tsx)**
  /** * data-viz.tsx — Animated chart composition template. * * Structure: Data intro → Animated bar chart → Callouts / insights * Config-driven: all data and labels via props. * * Usage: * Register in Root.tsx as * * Requires: * npm install @remotion/google-fonts */ import React from 'react'; import { loadFont } from '@remotion/google-fonts/Inter'; import { AbsoluteFill, Composition, Sequence, Series, interpolate, interpolateColors, spring, useCurrentFrame, useVideoConfig, } from 'remotion'; impo

- **[Remotion Video Toolkit — AI Skill — Termo](https://termo.ai/skills/remotion-video-toolkit)**
  Complete toolkit for programmatic video creation with Remotion + React. Covers animations, timing, rendering (CLI/Node.js/Lambda/Cloud Run), captions, 3D, charts, text effects, transitions, and media handling. Use when writing Remotion code, building video generation pipelines, or creating data-driven video templates. ... Personalized video at scale Feed user data as JSON props, render a unique video per user. Think Spotify Wrapped, GitHub Unwrapped, onboarding walkthroughs — one template, thous

- **[remotion-composer skill by yonatangross/orchestkit](https://playbooks.com/skills/yonatangross/orchestkit/remotion-composer)**
  This skill composes polished demo videos using Remotion, weaving terminal recordings, Manim animations, and branded overlays for marketing impact. ... ``` ... # Remotion Composer Production-quality video composition with AnimStats-level animations. Supports data visualization, spring physics, easing presets, and cinematic transitions. ## Quick Start ```bash # Install enhanced packages cd orchestkit-demos && npm install # Add composition for a skill ./scripts/add-composition.sh explore # Render n

- **[Remotion Video Toolkit — ClawHub](https://clawhub.ai/shreefentsar/skills/remotion-video-toolkit)**
  Complete toolkit for programmatic video creation with Remotion + React. Covers animations, timing, rendering (CLI/Node.js/Lambda/Cloud Run), captions, 3D, charts, text effects, transitions, and media handling. Use when writing Remotion code, building video generation pipelines, or creating data-driven video templates. ... Render server-side via API or Lambda. Animated data visualizations Turn dashboards and KPI reports into shareable video clips with animated charts and transitions. ... ### Core

- **[skills/remotion-video-toolkit/SKILL.md](https://github.com/sundial-org/awesome-openclaw-skills/blob/main/skills/remotion-video-toolkit/SKILL.md)**
  --- name: remotion-video-toolkit description: Complete toolkit for programmatic video creation with Remotion + React. Covers animations, timing, rendering (CLI/Node.js/Lambda/Cloud Run), captions, 3D, charts, text effects, transitions, and media handling. Use when writing Remotion code, building video generation pipelines, or creating data-driven video templates. ... **Personalized video at scale** Feed user data as JSON props, render a unique video per user. Think Spotify Wrapped, GitHub Unwrap

- **[remotion-video-toolkit](https://skillsmp.com/creators/zai-org/synapse/setup-skills-clawhub-skills-remotion-video-toolkit)**
  # remotion-video-toolkit Complete toolkit for programmatic video creation with Remotion + React. Covers animations, timing, rendering (CLI/Node.js/Lambda/Cloud Run), captions, 3D, charts, text effects, transitions, and media handling. Use when writing Remotion code, building video generation pipelines, or creating data-driven video templates. ... # Remotion Video Toolkit Write React components, get real MP4 videos. This skill teaches your AI agent how to build with Remotion — from a first animat
