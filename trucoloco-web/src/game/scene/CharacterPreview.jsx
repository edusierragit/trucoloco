import { Suspense, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { ContactShadows } from "@react-three/drei";
import { CharacterFigure } from "./CharacterFigure";
import { characterSkins } from "../data/characters";

// Preview de personaje estilo "character select": el modelo 3D del personaje
// elegido, girando lento sobre una tarima con luz cálida de antro. Componente
// autónomo (su propio Canvas) para enchufar en el menú de selección sin tocar
// la escena principal del bar.

function Spinner({ skin, accent }) {
  const groupRef = useRef(null);
  useFrame((_, delta) => {
    if (groupRef.current) groupRef.current.rotation.y += delta * 0.5;
  });
  return (
    <group ref={groupRef}>
      <CharacterFigure skin={skin} accent={accent} animationMode="idle" isActiveLane />
    </group>
  );
}

function Pedestal({ accent }) {
  return (
    <group position={[0, 0, 0]}>
      <mesh position={[0, -0.06, 0]} receiveShadow>
        <cylinderGeometry args={[0.72, 0.86, 0.12, 40]} />
        <meshStandardMaterial color="#24140b" roughness={0.85} metalness={0.1} />
      </mesh>
      <mesh position={[0, 0.01, 0]}>
        <torusGeometry args={[0.72, 0.02, 10, 40]} />
        <meshStandardMaterial color={accent ?? "#c9971d"} emissive={accent ?? "#c9971d"} emissiveIntensity={0.4} roughness={0.4} metalness={0.6} />
      </mesh>
    </group>
  );
}

export function CharacterPreview({ character }) {
  const skin = character?.skinId ? characterSkins[character.skinId] : null;
  const accent = character?.accent ?? "#c9971d";

  return (
    <div className="character-preview">
      <Canvas
        shadows
        dpr={[1, 1.6]}
        camera={{ position: [0, 1.25, 3.15], fov: 34 }}
        gl={{ antialias: true, alpha: true }}
      >
        <color attach="background" args={["#140b06"]} />
        <fog attach="fog" args={["#140b06", 4.5, 9]} />
        <ambientLight intensity={0.5} color="#f0d9b0" />
        <spotLight position={[2.2, 3.4, 2.4]} angle={0.5} penumbra={0.8} intensity={22} color="#ffd9a0" castShadow />
        <spotLight position={[-2.6, 2.2, -1.2]} angle={0.6} penumbra={1} intensity={9} color="#d24b3e" />
        <pointLight position={[0, 0.6, 2]} intensity={4} color={accent} />
        <Suspense fallback={null}>
          <group position={[0, -0.9, 0]}>
            <Pedestal accent={accent} />
            <Spinner skin={skin} accent={accent} />
            <ContactShadows position={[0, 0, 0]} opacity={0.5} scale={3} blur={2.4} far={2} color="#000000" />
          </group>
        </Suspense>
      </Canvas>
    </div>
  );
}
