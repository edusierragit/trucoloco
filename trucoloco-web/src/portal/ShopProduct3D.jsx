import { Canvas, useFrame } from "@react-three/fiber";
import { ContactShadows } from "@react-three/drei";
import { useRef, useState } from "react";
import * as THREE from "three";

const GLASS_PALETTES = [
  ["#7a241d", "#d59b42"],
  ["#381354", "#d8b16a"],
  ["#142d55", "#d9d9cf"],
  ["#0c5a3d", "#caa85b"],
  ["#171815", "#d6bd78"],
  ["#c4aa62", "#eee5cf"]
];

const SKIN_PALETTES = [
  ["#7c1f2a", "#eee2c5", "#cfaa4e"],
  ["#18352b", "#d8c7a2", "#9e7a3a"],
  ["#123d30", "#eadfbe", "#caa85b"],
  ["#123f72", "#f0e2bd", "#d3a83e"],
  ["#eee7d3", "#153d31", "#bb913d"],
  ["#171a1c", "#63211d", "#c7a65a"]
];

const CHIP_PALETTES = [
  ["#722c36", "#e7dcc1", "#b77943"],
  ["#121313", "#d4ac55", "#8e6a2d"],
  ["#0d553c", "#eee0bf", "#c89e46"]
];

function Turntable({ children, hovered, speed = .32 }) {
  const ref = useRef();
  useFrame((_, delta) => {
    if (!ref.current) return;
    ref.current.rotation.y += delta * (hovered ? speed * 2.35 : speed);
  });
  return <group ref={ref}>{children}</group>;
}

function GlassesModel({ variant, hovered }) {
  const [lens, metal] = GLASS_PALETTES[variant % GLASS_PALETTES.length];
  const sides = variant % 3 === 1 ? 8 : variant % 3 === 2 ? 10 : 6;
  const lensScale = variant % 2 ? [1, .86, 1] : [1, .78, 1];
  return (
    <Turntable hovered={hovered} speed={.42}>
      <group rotation={[.08, -.16, -.04]} scale={1.16}>
        {[-.78, .78].map((x) => (
          <group position={[x, 0, 0]} scale={lensScale} key={x}>
            <mesh rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[.62, .62, .075, sides]} />
              <meshPhysicalMaterial color={lens} metalness={.03} roughness={.08} transmission={.68} transparent opacity={.78} thickness={.42} ior={1.52} clearcoat={1} clearcoatRoughness={.08} />
            </mesh>
            <mesh>
              <torusGeometry args={[.65, .055, 8, sides]} />
              <meshPhysicalMaterial color={metal} metalness={.96} roughness={.16} clearcoat={.75} clearcoatRoughness={.12} />
            </mesh>
          </group>
        ))}
        <mesh position={[0, .02, .02]}>
          <boxGeometry args={[.36, .08, .08]} />
          <meshPhysicalMaterial color={metal} metalness={.97} roughness={.14} clearcoat={.7} />
        </mesh>
        {[-1, 1].map((direction) => (
          <group key={direction}>
            <mesh position={[direction * 1.55, .08, -.17]} rotation={[0, direction * -.46, direction * -.02]}>
              <boxGeometry args={[1.05, .055, .075]} />
              <meshPhysicalMaterial color={metal} metalness={.94} roughness={.18} clearcoat={.6} />
            </mesh>
            <mesh position={[direction * 1.98, .1, -.48]} rotation={[0, direction * -.62, 0]}>
              <boxGeometry args={[.52, .075, .095]} />
              <meshPhysicalMaterial color={lens} metalness={.2} roughness={.24} clearcoat={.72} />
            </mesh>
          </group>
        ))}
      </group>
    </Turntable>
  );
}

function SkinModel({ variant, hovered }) {
  const [primary, secondary, accent] = SKIN_PALETTES[variant % SKIN_PALETTES.length];
  const role = Math.floor((variant % 6) / 2);
  const executive = role === 0;
  const athlete = role === 1;
  const warrior = role === 2;
  return (
    <Turntable hovered={hovered} speed={.3}>
      <group position={[0, -.15, 0]} scale={.92}>
        <mesh position={[0, 1.05, 0]} scale={[.92, 1.22, .48]}>
          <boxGeometry args={[1.15, 1.35, .62]} />
          <meshPhysicalMaterial color={primary} roughness={.72} metalness={.02} sheen={.72} sheenColor={secondary} sheenRoughness={.78} />
        </mesh>
        <mesh position={[0, 1.12, .34]} scale={[.57, .93, .08]}>
          <boxGeometry args={[1, 1, 1]} />
          <meshPhysicalMaterial color={secondary} roughness={.82} sheen={.35} sheenColor={primary} />
        </mesh>
        {executive ? <mesh position={[0, 1.35, .42]} scale={[.11, .58, .05]} rotation={[0, 0, variant % 2 ? .05 : 0]}><boxGeometry /><meshStandardMaterial color={variant % 2 ? accent : "#1a211d"} /></mesh> : null}
        {athlete ? <><mesh position={[0, 1.18, .42]}><torusGeometry args={[.26, .045, 8, 28]} /><meshStandardMaterial color={accent} metalness={.65} roughness={.28} /></mesh><mesh position={[0, 1.15, .44]}><planeGeometry args={[.48, .42]} /><meshStandardMaterial color={secondary} /></mesh></> : null}
        {warrior ? <mesh position={[0, 1.28, .4]} rotation={[0, 0, -.12]}><boxGeometry args={[1.04, .12, .08]} /><meshStandardMaterial color={accent} metalness={.7} roughness={.28} /></mesh> : null}
        {[-1, 1].map((side) => <mesh key={`arm-${side}`} position={[side * .72, .97, 0]} rotation={[0, 0, side * -.11]}><capsuleGeometry args={[.16, 1.25, 5, 12]} /><meshStandardMaterial color={primary} roughness={.5} /></mesh>)}
        {[-1, 1].map((side) => <mesh key={`leg-${side}`} position={[side * .3, -.22, 0]}><capsuleGeometry args={[.22, 1.55, 6, 14]} /><meshStandardMaterial color={athlete && variant % 2 === 0 ? secondary : primary} roughness={.58} /></mesh>)}
        {[-1, 1].map((side) => <mesh key={`shoe-${side}`} position={[side * .3, -1.18, .15]} scale={[.34, .18, .62]}><boxGeometry /><meshStandardMaterial color={warrior ? primary : "#171a18"} roughness={.3} metalness={.18} /></mesh>)}
        <mesh position={[0, .32, .35]}><boxGeometry args={[1.05, .12, .12]} /><meshStandardMaterial color={accent} metalness={.72} roughness={.3} /></mesh>
        {warrior && variant % 2 === 1 ? <><mesh position={[.74, .95, -.16]} rotation={[0, 0, -.48]}><boxGeometry args={[.08, 2.35, .08]} /><meshStandardMaterial color={accent} metalness={.85} roughness={.22} /></mesh><mesh position={[.74, 1.95, -.16]} rotation={[0, 0, -.48]}><coneGeometry args={[.13, .5, 4]} /><meshStandardMaterial color="#d8d8cf" metalness={.88} roughness={.16} /></mesh></> : null}
      </group>
    </Turntable>
  );
}

function ChipStack({ variant, hovered }) {
  const refs = useRef([]);
  const [primary, secondary, metal] = CHIP_PALETTES[variant % CHIP_PALETTES.length];
  const targets = [[-.2, .03], [.16, -.02], [-.12, .08], [.2, .05], [0, 0]];
  useFrame((_, delta) => {
    refs.current.forEach((chip, index) => {
      if (!chip) return;
      const targetX = hovered ? targets[index][0] : 0;
      const targetZ = hovered ? targets[index][1] : 0;
      chip.position.x = THREE.MathUtils.damp(chip.position.x, targetX, 7, delta);
      chip.position.z = THREE.MathUtils.damp(chip.position.z, targetZ, 7, delta);
    });
  });
  return (
    <Turntable hovered={hovered} speed={.28}>
      <group rotation={[-.08, 0, -.14]} position={[0, -.32, 0]}>
        {Array.from({ length: 5 }, (_, index) => (
          <group ref={(node) => { refs.current[index] = node; }} position={[0, index * .18, 0]} rotation={[0, index * .18, 0]} key={index}>
            <mesh>
              <cylinderGeometry args={[.78, .78, .16, 48]} />
              <meshPhysicalMaterial color={index % 2 ? secondary : primary} metalness={.08} roughness={.34} clearcoat={.92} clearcoatRoughness={.16} />
            </mesh>
            <mesh position={[0, .083, 0]} rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[.55, .055, 8, 48]} />
              <meshPhysicalMaterial color={metal} metalness={.82} roughness={.18} clearcoat={.9} />
            </mesh>
            <mesh position={[0, .086, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <circleGeometry args={[.44, 48]} />
              <meshPhysicalMaterial color={primary} metalness={.06} roughness={.3} clearcoat={.84} />
            </mesh>
          </group>
        ))}
      </group>
    </Turntable>
  );
}

export default function ShopProduct3D({ type, variant = 0, compact = false }) {
  const [hovered, setHovered] = useState(false);
  const label = type === "lentes" ? "Modelo tridimensional de lentes" : type === "skins" ? "Modelo tridimensional de skin" : "Modelo tridimensional de fichines";
  return (
    <div className={compact ? "portal-product-3d portal-product-3d-compact" : "portal-product-3d"} role="img" aria-label={label} onPointerEnter={() => setHovered(true)} onPointerLeave={() => setHovered(false)}>
      <Canvas shadows dpr={[1.35, 2]} camera={{ position: [0, .15, type === "skins" ? 6.2 : 5], fov: type === "skins" ? 34 : 32 }} gl={{ alpha: true, antialias: true }} onCreated={({ gl }) => { gl.toneMapping = THREE.ACESFilmicToneMapping; gl.toneMappingExposure = 1.08; }}>
        <ambientLight intensity={.58} />
        <directionalLight castShadow position={[3, 5, 5]} intensity={3.1} color="#ffe1a1" shadow-mapSize={[1024, 1024]} />
        <directionalLight position={[-4, 2, 2]} intensity={1.45} color="#c98f5e" />
        <spotLight position={[0, -1, 4]} intensity={1.1} color="#d6ad58" angle={.55} penumbra={.7} />
        {type === "lentes" ? <GlassesModel variant={variant} hovered={hovered} /> : null}
        {type === "skins" ? <SkinModel variant={variant} hovered={hovered} /> : null}
        {type === "fichines" ? <ChipStack variant={variant} hovered={hovered} /> : null}
        <ContactShadows position={[0, -1.75, 0]} opacity={.48} scale={5.2} blur={2.4} far={5} color="#080402" />
      </Canvas>
    </div>
  );
}
