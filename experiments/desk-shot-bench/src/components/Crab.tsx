import * as THREE from 'three';

/**
 * Original folded-ceramic/metal paper crab, sized in metres. This is deliberately
 * not an adaptation of any company's pixel mascot or official character.
 * All animation is an absolute function of the S2-3 local frame (0–659 @ 30fps).
 * The face points toward +Z; screen is at Z≈−0.2 and keyboard top at Y≈0.025.
 */

const shellShape = new THREE.Shape();
shellShape.moveTo(-0.018, -0.008);
shellShape.quadraticCurveTo(-0.023, -0.004, -0.018, 0.002);
shellShape.lineTo(-0.004, 0.013);
shellShape.quadraticCurveTo(0, 0.016, 0.004, 0.013);
shellShape.lineTo(0.018, 0.002);
shellShape.quadraticCurveTo(0.023, -0.004, 0.018, -0.008);
shellShape.quadraticCurveTo(0, -0.014, -0.018, -0.008);
const shellGeometry = new THREE.ExtrudeGeometry(shellShape, {
  depth: 0.004,
  steps: 1,
  bevelEnabled: true,
  bevelThickness: 0.0011,
  bevelSize: 0.0011,
  bevelSegments: 2,
  curveSegments: 5,
});
shellGeometry.translate(0, 0, -0.002);

// A small angular glaze insert makes the carapace read as folded paper.
const glazeShape = new THREE.Shape();
glazeShape.moveTo(-0.011, 0.001);
glazeShape.lineTo(0, 0.009);
glazeShape.lineTo(0.011, 0.001);
glazeShape.lineTo(0, 0.003);
glazeShape.closePath();
const glazeGeometry = new THREE.ShapeGeometry(glazeShape);

const segmentGeometry = new THREE.CylinderGeometry(1, 1, 1, 6);
const pearlGeometry = new THREE.SphereGeometry(1, 10, 7);
const paperSquareGeometry = new THREE.BoxGeometry(1, 1, 1);
const rust = new THREE.MeshStandardMaterial({color: '#b4613e', metalness: 0.57, roughness: 0.37});
const rim = new THREE.MeshStandardMaterial({color: '#e4a975', metalness: 0.66, roughness: 0.29});
const cream = new THREE.MeshStandardMaterial({color: '#e9d8b9', metalness: 0.31, roughness: 0.34, side: THREE.DoubleSide});
const ink = new THREE.MeshStandardMaterial({color: '#263f48', metalness: 0.18, roughness: 0.28});

const up = new THREE.Vector3(0, 1, 0);
type Point = readonly [number, number, number];

function Strut({a, b, radius, material}: {
  a: Point;
  b: Point;
  radius: number;
  material: THREE.Material;
}) {
  const start = new THREE.Vector3(...a);
  const end = new THREE.Vector3(...b);
  const delta = end.clone().sub(start);
  const length = delta.length();
  return (
    <mesh
      position={start.add(end).multiplyScalar(0.5)}
      quaternion={new THREE.Quaternion().setFromUnitVectors(up, delta.normalize())}
      scale={[radius, length, radius]}
      geometry={segmentGeometry}
      material={material}
      castShadow
    />
  );
}

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));
const smooth = (from: number, to: number, n: number) => {
  const t = clamp01((n - from) / (to - from));
  return t * t * (3 - 2 * t);
};
const pulse = (frame: number, center: number, width: number) =>
  Math.exp(-Math.pow((frame - center) / width, 2));

function Legs({frame}: {frame: number}) {
  return (
    <>
      {([-1, 1] as const).flatMap((side) =>
        [0, 1, 2].map((row) => {
          const gait = frame >= 330 ? 0.0006 * Math.sin(frame * 0.095 + row * 2.1 + side) : 0;
          const z = -0.010 + row * 0.011;
          const hip: Point = [side * (0.014 + row * 0.001), -0.005, z];
          const knee: Point = [side * (0.028 + row * 0.002), -0.007 + gait, z - 0.003];
          const toe: Point = [side * (0.035 + row * 0.003), -0.024 + gait * 0.3, z + (row - 1) * 0.005];
          return (
            <group key={`${side}-${row}`}>
              <Strut a={hip} b={knee} radius={0.00094} material={rim} />
              <Strut a={knee} b={toe} radius={0.00070} material={rust} />
              <mesh position={knee} scale={[0.00145, 0.00145, 0.00145]} geometry={pearlGeometry} material={cream} />
            </group>
          );
        }),
      )}
    </>
  );
}

function Claws({frame}: {frame: number}) {
  return (
    <>
      {([-1, 1] as const).map((side) => {
        const wave = frame < 330 ? 0 : Math.sin(frame * 0.071 + side * 1.4) * 0.12;
        return (
          <group key={side} position={[side * 0.016, 0.003, 0.006]} rotation={[0, 0, side * wave]}>
            <Strut a={[0, 0, 0]} b={[side * 0.010, 0.005, 0.004]} radius={0.0017} material={rim} />
            <mesh position={[side * 0.014, 0.007, 0.005]} scale={[0.006, 0.005, 0.0037]} geometry={pearlGeometry} material={rust} castShadow />
            <Strut a={[side * 0.017, 0.009, 0.005]} b={[side * 0.027, 0.009, 0.007]} radius={0.0014} material={rim} />
            <Strut a={[side * 0.017, 0.005, 0.005]} b={[side * 0.025, 0.006, 0.008]} radius={0.00125} material={cream} />
          </group>
        );
      })}
    </>
  );
}

function Eyes({frame}: {frame: number}) {
  // Late glance toward the desk edge, not a logo-style four-legged square face.
  const gaze = smooth(475, 530, frame) * 0.00095;
  return (
    <>
      {([-1, 1] as const).map((side) => (
        <group key={side}>
          <Strut a={[side * 0.007, 0.010, 0.000]} b={[side * 0.009, 0.022, 0.000]} radius={0.0010} material={rim} />
          <mesh position={[side * 0.009, 0.024, 0.000]} scale={[0.0035, 0.0035, 0.0035]} geometry={pearlGeometry} material={cream} castShadow />
          <mesh position={[side * 0.009 + gaze, 0.024, 0.00316]} scale={[0.00148, 0.00172, 0.00065]} geometry={pearlGeometry} material={ink} />
        </group>
      ))}
    </>
  );
}

/** Tiny fixed-count square folds converge into the shell; never random particles. */
function FoldFlecks({frame}: {frame: number}) {
  if (frame >= 310) return null;
  const scattered = 1 - smooth(235, 299, frame);
  const size = 1 - smooth(284, 309, frame);
  return (
    <>
      {Array.from({length: 9}, (_, i) => {
        const angle = i * 2.39996;
        const distance = 0.012 + (i % 3) * 0.004;
        return (
          <mesh
            key={i}
            position={[
              scattered * Math.cos(angle) * distance,
              scattered * Math.sin(angle) * distance,
              scattered * ((i % 4) - 2) * 0.004 + 0.004,
            ]}
            rotation={[frame * (i % 2 ? -0.035 : 0.025) + i, angle, frame * 0.027 + i]}
            scale={[0.0025 * size, 0.0025 * size, 0.0007 * size]}
            geometry={paperSquareGeometry}
            material={i % 3 === 0 ? cream : i % 3 === 1 ? rim : rust}
          />
        );
      })}
    </>
  );
}

export function Crab({frame}: {frame: number}) {
  if (frame < 210 || frame > 659) return null;

  const travel = smooth(210, 310, frame);
  const assembly = 0.035 + 0.965 * smooth(234, 299, frame);
  const landing = -0.0032 * pulse(frame, 314, 5.5) + 0.0021 * pulse(frame, 326, 7);
  const typing = -0.0024 * (
    pulse(frame, 364, 5) + pulse(frame, 405, 5) + pulse(frame, 446, 5)
  );
  const breathing = smooth(333, 348, frame) * 0.00048 * Math.sin(frame * 0.075);
  const x = -0.080 - 0.015 * travel;
  // At frame 310 the six toes meet the key-top surface (Y≈0.019), not the palm rest.
  const y = 0.055 - 0.012 * travel + 0.019 * Math.sin(Math.PI * travel) + landing + typing + breathing;
  const z = -0.196 + 0.091 * travel;

  return (
    <group position={[x, y, z]} rotation={[0, 0.11 * (1 - travel) + 0.018 * Math.sin(frame * 0.042), 0]}>
      <FoldFlecks frame={frame} />
      <group scale={[assembly, assembly, assembly]}>
        <Legs frame={frame} />
        <Claws frame={frame} />
        <mesh geometry={shellGeometry} material={rust} castShadow receiveShadow />
        <mesh geometry={glazeGeometry} material={cream} position={[0, 0, 0.0044]} />
        <Strut a={[-0.011, -0.007, 0.004]} b={[0, -0.010, 0.004]} radius={0.00048} material={rim} />
        <Strut a={[0, -0.010, 0.004]} b={[0.011, -0.007, 0.004]} radius={0.00048} material={rim} />
        <Eyes frame={frame} />
      </group>
    </group>
  );
}
