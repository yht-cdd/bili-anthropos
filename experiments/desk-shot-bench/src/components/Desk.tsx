import {useEffect, useMemo} from 'react';
import * as THREE from 'three';

/**
 * S2-3 desk, metres. +X is screen-right, +Z faces the audience, desktop y=0.
 * The camera and principal lights are deliberately owned by the parent scene.
 * Screen image centre: (-0.05, 0.13335, -0.1828), facing (0, 0.1296, 0.9916).
 * Character landing patch on real key tops: x[-0.15, 0.05], z[-0.13,-0.065], y≈0.019.
 */

const laptopX = -0.05;
const baseZ = -0.0625;
const hingeZ = -0.178;
const tilt = -0.13;

function roundedBlock(width: number, height: number, depth: number, radius: number, bevel: number) {
  const x = width / 2;
  const y = height / 2;
  const r = Math.min(radius, x, y);
  const s = new THREE.Shape();
  s.moveTo(-x + r, -y);
  s.lineTo(x - r, -y);
  s.quadraticCurveTo(x, -y, x, -y + r);
  s.lineTo(x, y - r);
  s.quadraticCurveTo(x, y, x - r, y);
  s.lineTo(-x + r, y);
  s.quadraticCurveTo(-x, y, -x, y - r);
  s.lineTo(-x, -y + r);
  s.quadraticCurveTo(-x, -y, -x + r, -y);
  return new THREE.ExtrudeGeometry(s, {
    depth,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 2,
    curveSegments: 5,
    steps: 1,
  });
}

// Low-resolution, original, text-free UI placeholder; parent supplies the approved
// exact preceding-frame image as screenTexture for the actual match cut.
function makeFallbackScreen() {
  const w = 384;
  const h = 216;
  const data = new Uint8Array(w * h * 4);
  const fill = (x0: number, y0: number, x1: number, y1: number, rgb: readonly [number, number, number]) => {
    for (let y = Math.max(0, y0); y < Math.min(h, y1); y++) {
      for (let x = Math.max(0, x0); x < Math.min(w, x1); x++) {
        const i = (y * w + x) * 4;
        data[i] = rgb[0]; data[i + 1] = rgb[1]; data[i + 2] = rgb[2]; data[i + 3] = 255;
      }
    }
  };
  fill(0, 0, w, h, [21, 29, 43]);
  fill(0, 0, w, 15, [34, 46, 64]);
  fill(0, 15, 61, h, [30, 41, 56]);
  fill(69, 23, 233, 201, [36, 48, 66]);
  fill(243, 23, 374, 201, [26, 36, 53]);
  fill(255, 43, 357, 124, [42, 55, 75]);
  for (let row = 0; row < 7; row++) {
    fill(9, 29 + row * 22, 17, 36 + row * 22, [107, 144, 171]);
    fill(23, 31 + row * 22, 30 + ((row * 17 + 14) % 24), 34 + row * 22, [89, 111, 132]);
  }
  for (let row = 0; row < 12; row++) {
    const y = 31 + row * 13;
    const length = 75 + (row * 37) % 75;
    fill(79 + (row % 3) * 6, y, 79 + length, y + 2, row % 4 === 0 ? [111, 159, 171] : [98, 119, 145]);
  }
  fill(255, 141, 357, 145, [101, 140, 166]);
  fill(255, 150, 333, 154, [61, 173, 156]);
  fill(255, 161, 345, 164, [123, 102, 152]);
  const texture = new THREE.DataTexture(data, w, h, THREE.RGBAFormat);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
}

function makeCrumpledBag() {
  const nx = 10;
  const ny = 8;
  const width = 0.155;
  const height = 0.104;
  const positions: number[] = [];
  const colors: number[] = [];
  const point = (ix: number, iy: number, face: 1 | -1): [number, number, number] => {
    const u = ix / nx;
    const v = iy / ny;
    const pinch = 1 - 0.20 * (1 - v);
    const x = (u - 0.5) * width * pinch + 0.005 * Math.sin(v * 8 + u * 4);
    const y = (v - 0.5) * height + 0.0025 * Math.sin(ix * 2.7 + iy * 1.6);
    const crease = 0.004 * Math.sin(ix * 2.6 + iy * 2.9) + 0.002 * Math.sin(ix * 6.2 - iy * 1.9);
    const z = face * (0.011 + crease) + 0.004 * Math.sin(u * 7 + v * 5);
    return [x, y, z];
  };
  const triangle = (a: number[], b: number[], c: number[], color: [number, number, number]) => {
    positions.push(...a, ...b, ...c);
    for (let i = 0; i < 3; i++) colors.push(...color);
  };
  for (let iy = 0; iy < ny; iy++) for (let ix = 0; ix < nx; ix++) {
    const pale = (ix + 2 * iy) % 9 < 3;
    const hue: [number, number, number] = pale ? [0.65, 0.69, 0.53] : [0.73, 0.68, 0.47];
    const a = point(ix, iy, 1), b = point(ix + 1, iy, 1);
    const c = point(ix, iy + 1, 1), d = point(ix + 1, iy + 1, 1);
    triangle(a, b, c, hue); triangle(b, d, c, hue);
    const aa = point(ix, iy, -1), bb = point(ix + 1, iy, -1);
    const cc = point(ix, iy + 1, -1), dd = point(ix + 1, iy + 1, -1);
    triangle(aa, cc, bb, hue); triangle(bb, cc, dd, hue);
  }
  const rim: [number, number, number] = [0.59, 0.57, 0.40];
  for (let iy = 0; iy < ny; iy++) for (const ix of [0, nx]) {
    const a = point(ix, iy, 1), b = point(ix, iy + 1, 1);
    const c = point(ix, iy, -1), d = point(ix, iy + 1, -1);
    triangle(a, c, b, rim); triangle(b, c, d, rim);
  }
  for (let ix = 0; ix < nx; ix++) for (const iy of [0, ny]) {
    const a = point(ix, iy, 1), b = point(ix + 1, iy, 1);
    const c = point(ix, iy, -1), d = point(ix + 1, iy, -1);
    triangle(a, b, c, rim); triangle(b, d, c, rim);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  return geometry;
}

function Pen({kind, position, angle}: {
  kind: 'marker' | 'pen';
  position: [number, number, number];
  angle: number;
}) {
  const marker = kind === 'marker';
  const r = marker ? 0.0063 : 0.0037;
  const length = marker ? 0.132 : 0.151;
  return (
    <group position={position} rotation={[0, angle, 0]}>
      {/* Cylinders normally run along Y: turn their axes into the desk's X direction. */}
      <mesh rotation={[0, 0, -Math.PI / 2]} castShadow receiveShadow>
        <cylinderGeometry args={[r, r, length, 14]} />
        <meshStandardMaterial color={marker ? '#9c252e' : '#202329'} metalness={marker ? 0.18 : 0.09} roughness={marker ? 0.19 : 0.43} />
      </mesh>
      <mesh position={[-length / 2 + 0.011, 0.0003, 0]} rotation={[0, 0, -Math.PI / 2]} castShadow>
        <cylinderGeometry args={[r * 1.08, r * 1.08, 0.026, 14]} />
        <meshStandardMaterial color={marker ? '#661a23' : '#101317'} roughness={marker ? 0.27 : 0.36} metalness={0.12} />
      </mesh>
      <mesh position={[length / 2 + 0.004, 0, 0]} rotation={[0, 0, -Math.PI / 2]} castShadow>
        <coneGeometry args={[r * 0.8, 0.018, 14]} />
        <meshStandardMaterial color={marker ? '#362d2d' : '#a8aaa3'} metalness={marker ? 0.1 : 0.69} roughness={marker ? 0.53 : 0.18} />
      </mesh>
      <mesh position={[length / 2 - 0.012, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
        <cylinderGeometry args={[r * 1.03, r * 1.03, 0.003, 14]} />
        <meshStandardMaterial color={marker ? '#dcc4a8' : '#777d82'} roughness={0.2} metalness={marker ? 0.42 : 0.7} />
      </mesh>
      {!marker && (
        <mesh position={[-0.047, 0.0048, 0]} rotation={[0, 0, -Math.PI / 2]}>
          <boxGeometry args={[0.002, 0.033, 0.0015]} />
          <meshStandardMaterial color="#929da7" metalness={0.76} roughness={0.17} />
        </mesh>
      )}
    </group>
  );
}

function Notebook() {
  const paper = useMemo(() => roundedBlock(0.174, 0.224, 0.001, 0.003, 0.0003), []);
  return (
    <group position={[0.371, 0, 0.142]} rotation={[0, 0.08, 0]}>
      <mesh position={[0, 0.006, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.189, 0.011, 0.241]} />
        <meshStandardMaterial color="#494741" roughness={0.83} />
      </mesh>
      {[0, 1, 2, 3].map((i) => (
        <mesh key={i} geometry={paper} rotation={[-Math.PI / 2, 0, 0]} position={[0.005 + i * 0.00045, 0.012 + i * 0.0015, -0.001 + i * 0.00055]} castShadow receiveShadow>
          <meshStandardMaterial color={i === 3 ? '#e4dfd0' : '#ccc8bb'} roughness={0.93} side={THREE.DoubleSide} />
        </mesh>
      ))}
      {/* Real individual spiral turns, not a spiral drawing on the paper. */}
      {Array.from({length: 19}, (_, i) => {
        const z = -0.104 + i * 0.0117;
        return (
          <group key={i}>
            <mesh position={[-0.075, 0.01794, z]} rotation={[-Math.PI / 2, 0, 0]}>
              <circleGeometry args={[0.0033, 10]} />
              <meshStandardMaterial color="#48484a" roughness={0.7} side={THREE.DoubleSide} />
            </mesh>
            <mesh position={[-0.083, 0.023, z]} castShadow>
              <torusGeometry args={[0.0082, 0.00115, 6, 14]} />
              <meshStandardMaterial color="#90918c" metalness={0.74} roughness={0.26} />
            </mesh>
          </group>
        );
      })}
      {/* Faint ruled paper and non-linguistic revisions: no handwriting or names. */}
      {Array.from({length: 12}, (_, i) => (
        <mesh key={i} position={[0.013, 0.01796, -0.088 + i * 0.0154]} receiveShadow>
          <boxGeometry args={[0.139, 0.00012, 0.00025]} />
          <meshStandardMaterial color="#a7b4bb" transparent opacity={0.38} roughness={1} />
        </mesh>
      ))}
      {[[-0.017, 0.038, 0.033], [0.033, 0.009, 0.018], [0.005, -0.038, 0.046]]
        .map(([x, z, width], i) => (
          <mesh key={i} position={[x, 0.01804, z]} rotation={[0, 0.025 * (i - 1), 0]}>
            <boxGeometry args={[width, 0.00014, 0.0007]} />
            <meshStandardMaterial color={i === 1 ? '#a16c6a' : '#747872'} roughness={1} />
          </mesh>
        ))}
    </group>
  );
}

function SnackBag() {
  const surface = useMemo(makeCrumpledBag, []);
  return (
    <group position={[-0.388, 0.054, -0.083]} rotation={[0.11, -0.24, -0.12]}>
      <mesh geometry={surface} castShadow receiveShadow>
        <meshStandardMaterial vertexColors roughness={0.66} metalness={0.035} side={THREE.DoubleSide} flatShading />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh key={side} position={[0, side * 0.051, 0.008]} rotation={[0, 0, side * 0.045]} castShadow>
          <boxGeometry args={[0.153, 0.0065, 0.004]} />
          <meshStandardMaterial color={side === 1 ? '#b4ac79' : '#8d855d'} metalness={0.12} roughness={0.57} />
        </mesh>
      ))}
      {Array.from({length: 12}, (_, i) => (
        <mesh key={i} position={[-0.067 + i * 0.012, 0.052, 0.011]}>
          <boxGeometry args={[0.0008, 0.0069, 0.0046]} />
          <meshStandardMaterial color="#777955" roughness={0.7} />
        </mesh>
      ))}
      {[[-0.045, -0.020, 0.037], [0.022, -0.012, 0.048], [-0.028, 0.025, 0.034]]
        .map(([x, y, width], i) => (
          <mesh key={i} position={[x, y, 0.016]} rotation={[0, 0, (i - 1) * 0.26]}>
            <boxGeometry args={[width, 0.002, 0.0004]} />
            <meshStandardMaterial color={i === 1 ? '#dad0a0' : '#8b946b'} roughness={0.68} />
          </mesh>
        ))}
    </group>
  );
}

export function Desk({screenTexture, frame}: {screenTexture?: THREE.Texture; frame: number}) {
  const frameGeometry = useMemo(() => roundedBlock(0.363, 0.218, 0.0075, 0.009, 0.0015), []);
  const baseGeometry = useMemo(() => roundedBlock(0.37, 0.235, 0.012, 0.011, 0.0013), []);
  const keyboardWell = useMemo(() => roundedBlock(0.338, 0.124, 0.0004, 0.004, 0.00025), []);
  const keyGeometry = useMemo(() => roundedBlock(0.0207, 0.016, 0.0023, 0.002, 0.00055), []);
  const trackpadGeometry = useMemo(() => roundedBlock(0.116, 0.033, 0.00015, 0.0038, 0.00015), []);
  const fallbackTexture = useMemo(makeFallbackScreen, []);
  useEffect(() => () => fallbackTexture.dispose(), [fallbackTexture]);
  const keyPositions = useMemo(() => Array.from({length: 70}, (_, n) => {
    const row = Math.floor(n / 14);
    const col = n % 14;
    return [laptopX - 0.145 + col * 0.02245, 0.0161, -0.146 + row * 0.0203] as const;
  }), []);
  const screenFade = frame < 600 ? 1 : Math.max(0.1, 1 - ((frame - 600) / 60) * 0.9);
  const glimmer = 1 + 0.009 * Math.sin(frame * 0.38);
  const luminance = screenFade * glimmer;

  return (
    <group>
      {/* Neutral dark taupe desk and quiet wall: neither contains a visible lamp. */}
      <mesh position={[0, -0.017, 0.015]} receiveShadow castShadow>
        <boxGeometry args={[1.22, 0.034, 0.75]} />
        <meshStandardMaterial color="#514d49" roughness={0.88} metalness={0.025} />
      </mesh>
      <mesh position={[0, 0.192, -0.385]} receiveShadow>
        <boxGeometry args={[1.4, 0.47, 0.014]} />
        <meshStandardMaterial color="#4e4b49" roughness={0.97} />
      </mesh>
      <mesh position={[laptopX, 0.0013, baseZ]} rotation={[-Math.PI / 2, 0, 0]} geometry={baseGeometry} castShadow receiveShadow>
        <meshStandardMaterial color="#a9aca9" metalness={0.57} roughness={0.32} />
      </mesh>
      <mesh position={[laptopX, 0.015, -0.098]} rotation={[-Math.PI / 2, 0, 0]} geometry={keyboardWell} receiveShadow>
        <meshStandardMaterial color="#3a3e44" metalness={0.17} roughness={0.62} />
      </mesh>
      <instancedMesh
        args={[keyGeometry, undefined, keyPositions.length]}
        castShadow
        receiveShadow
        onUpdate={(mesh: THREE.InstancedMesh) => {
          const matrix = new THREE.Matrix4();
          const rot = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);
          const scale = new THREE.Vector3(1, 1, 1);
          keyPositions.forEach(([x, y, z], i) => {
            matrix.compose(new THREE.Vector3(x, y, z), rot, scale);
            mesh.setMatrixAt(i, matrix);
            const row = Math.floor(i / 14);
            mesh.setColorAt(i, new THREE.Color(row === 0 ? '#343740' : (i + row) % 11 === 0 ? '#272c34' : '#252932'));
          });
          mesh.instanceMatrix.needsUpdate = true;
          if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
        }}
      >
        <meshStandardMaterial color="#ffffff" metalness={0.12} roughness={0.56} />
      </instancedMesh>
      {[-0.134, -0.109, -0.083, 0.076].map((x, i) => (
        <mesh key={i} position={[laptopX + x, 0.0174, -0.045]} castShadow>
          <boxGeometry args={[i === 2 ? 0.099 : 0.0206, 0.003, 0.0158]} />
          <meshStandardMaterial color="#292d35" metalness={0.11} roughness={0.58} />
        </mesh>
      ))}
      <mesh position={[laptopX, 0.01585, 0.020]} rotation={[-Math.PI / 2, 0, 0]} geometry={trackpadGeometry} receiveShadow>
        <meshStandardMaterial color="#999d9a" roughness={0.42} metalness={0.47} />
      </mesh>
      {[-0.145, 0.145].map((dx) => (
        <mesh key={dx} position={[laptopX + dx, 0.018, hingeZ]} rotation={[0, 0, -Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.0048, 0.0048, 0.039, 12]} />
          <meshStandardMaterial color="#696d6c" metalness={0.66} roughness={0.27} />
        </mesh>
      ))}
      <group position={[laptopX, 0.018, hingeZ]} rotation={[tilt, 0, 0]}>
        <mesh geometry={frameGeometry} position={[0, 0.115, 0]} castShadow receiveShadow>
          <meshStandardMaterial color="#969b9a" roughness={0.29} metalness={0.54} />
        </mesh>
        <mesh position={[0, 0.115, 0.00935]}>
          <planeGeometry args={[0.353, 0.202]} />
          <meshStandardMaterial color="#11151c" metalness={0.15} roughness={0.48} />
        </mesh>
        {/* This face is +Z in screen-local space; its 16:9 UVs accept an authored texture. */}
        <mesh position={[0, 0.115, 0.0102]}>
          <planeGeometry args={[0.345, 0.194]} />
          <meshBasicMaterial map={screenTexture ?? fallbackTexture} color={new THREE.Color().setScalar(luminance)} toneMapped={false} />
        </mesh>
        {/* Narrow glass-edge sheen, clear of the legible image. */}
        <mesh position={[-0.1754, 0.115, 0.01035]}>
          <planeGeometry args={[0.00055, 0.19]} />
          <meshBasicMaterial color="#bfc8c8" transparent opacity={0.24} depthWrite={false} />
        </mesh>
      </group>
      <pointLight position={[laptopX, 0.146, -0.134]} color="#b8d5f5" intensity={0.18 * screenFade} distance={0.60} decay={2} />
      <SnackBag />
      <Pen kind="marker" position={[0.304, 0.0074, -0.202]} angle={-0.18} />
      <Pen kind="pen" position={[0.319, 0.0046, -0.090]} angle={0.13} />
      <Notebook />
    </group>
  );
}
