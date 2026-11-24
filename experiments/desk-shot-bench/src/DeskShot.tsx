import React, {useLayoutEffect} from 'react';
import * as THREE from 'three';
import {useLoader, useThree} from '@react-three/fiber';
import {ThreeCanvas} from '@remotion/three';
import {AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame} from 'remotion';
import {Desk} from './components/Desk';
import {Crab} from './components/Crab';

const ease = (n: number) => {
  const t = Math.min(1, Math.max(0, n));
  return t * t * (3 - 2 * t);
};
const blend = (a: number, b: number, t: number) => a + (b - a) * t;

const CameraMove: React.FC<{frame: number}> = ({frame}) => {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  useLayoutEffect(() => {
    const reveal = ease((frame - 42) / 195);
    const inspect = ease((frame - 305) / 145);
    const settle = ease((frame - 450) / 135);
    // Recede to reveal the desk, move closer for the keyboard contact,
    // then reopen the framing for the line about human direction.
    const x = blend(-0.055, 0.12, reveal) + 0.025 * inspect - 0.045 * settle;
    const y = blend(0.174, 0.405, reveal) - 0.10 * inspect + 0.10 * settle;
    const z = blend(0.07, 0.765, reveal) - 0.23 * inspect + 0.21 * settle;
    camera.position.set(x, y, z);
    const lookX = blend(-0.055, -0.005, reveal) - 0.075 * inspect + 0.07 * settle;
    const lookY = blend(0.169, 0.092, reveal) - 0.05 * inspect + 0.05 * settle;
    const lookZ = blend(-0.236, -0.055, reveal) - 0.05 * inspect + 0.045 * settle;
    camera.lookAt(lookX, lookY, lookZ);
    camera.fov = blend(39, 42, reveal);
    camera.near = 0.005;
    camera.far = 30;
    camera.updateProjectionMatrix();
  }, [camera, frame]);
  return null;
};

const DeskWorld: React.FC<{frame: number}> = ({frame}) => {
  const screenTexture = useScreenTexture();
  const dim = 1 - 0.23 * ease((frame - 588) / 72);
  return <>
    <color attach="background" args={['#111014']} />
    <fog attach="fog" args={['#111014', 1.7, 5]} />
    <ambientLight intensity={0.4 * dim} color="#b9bfd0" />
    <pointLight position={[-0.05, 0.42, -0.03]} color="#d4e4ff" intensity={2.7 * dim} distance={1.5} decay={2} />
    <directionalLight position={[0.6, 1.4, 0.85]} intensity={0.75 * dim} color="#d7baa5" castShadow shadow-mapSize-width={1024} shadow-mapSize-height={1024} shadow-bias={-0.0003} />
    <Desk frame={frame} screenTexture={screenTexture} />
    <Crab frame={frame} />
    <CameraMove frame={frame} />
  </>;
};

function useScreenTexture(): THREE.Texture {
  // useLoader suspends the renderer until the privacy-safe illustration has loaded.
  const texture = useLoader(THREE.TextureLoader, staticFile('terminal.svg'));
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export const DeskShot: React.FC = () => {
  const frame = useCurrentFrame();
  const opening = interpolate(frame, [0, 33, 66], [1, 1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const closing = interpolate(frame, [465, 505, 590, 635], [0, 1, 1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const fadeToBlack = interpolate(frame, [628, 659], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  return <AbsoluteFill style={{backgroundColor: '#111014', overflow: 'hidden'}}>
    <ThreeCanvas width={1920} height={1080} style={{position: 'absolute', inset: 0}}>
      <DeskWorld frame={frame} />
    </ThreeCanvas>
    <AbsoluteFill style={{opacity: opening, pointerEvents: 'none'}}>
      <Img src={staticFile('terminal.svg')} style={{width: '100%', height: '100%'}} />
    </AbsoluteFill>
    <AbsoluteFill style={{opacity: closing, pointerEvents: 'none', justifyContent: 'flex-end', alignItems: 'flex-end', padding: '0 145px 150px 0'}}>
      <div style={{maxWidth: 780, padding: '26px 40px', color: '#f9f4ed', background: 'rgba(14,15,20,.58)', borderLeft: '5px solid #e6956f', fontSize: 47, lineHeight: 1.42, fontFamily: '"Noto Sans SC", sans-serif', textShadow: '0 2px 12px #000'}}>
        镜头后面，有人决定这条片子怎么做。
      </div>
    </AbsoluteFill>
    <div style={{position: 'absolute', left: 48, bottom: 35, font: '24px "Noto Sans SC", sans-serif', color: '#cbb7a8', textShadow: '0 2px 6px #000', letterSpacing: 1}}>
      3D 动效样片 · 原创角色与模拟界面 · 未用于发布
    </div>
    <AbsoluteFill style={{backgroundColor: '#101014', opacity: fadeToBlack, pointerEvents: 'none'}} />
  </AbsoluteFill>;
};
