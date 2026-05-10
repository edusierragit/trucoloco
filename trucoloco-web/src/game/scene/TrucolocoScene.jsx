import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { ContactShadows, Float, RoundedBox, Text } from "@react-three/drei";
import { PMREMGenerator } from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { Table } from "./Table";
import { TeamsAroundTable } from "./TeamsAroundTable";
import { tableSeats } from "../data/characters";
import { BarRoom } from "./world/BarRoom";
import { WalkablePlayer } from "./world/WalkablePlayer";

const BAR_COLORS = {
  wall: "#100b09",
  wallWarm: "#19100b",
  floor: "#1f1410",
  floorDark: "#120d0b",
  brass: "#b47a34",
  ember: "#d68632",
  teal: "#3ebfb3",
  red: "#a84332"
};

function RenderEnvironment() {
  const { gl, scene } = useThree();

  useEffect(() => {
    const previousEnvironment = scene.environment;
    const previousEnvironmentIntensity = scene.environmentIntensity;
    const roomEnvironment = new RoomEnvironment();
    const pmrem = new PMREMGenerator(gl);
    const environmentMap = pmrem.fromScene(roomEnvironment, 0.035).texture;

    scene.environment = environmentMap;
    scene.environmentIntensity = 0.54;

    return () => {
      scene.environment = previousEnvironment;
      scene.environmentIntensity = previousEnvironmentIntensity;
      environmentMap.dispose();
      pmrem.dispose();
      roomEnvironment.dispose();
    };
  }, [gl, scene]);

  return null;
}

// Modifier-reactive ambient light — pulses color and intensity based on active modifier
function ModifierAmbientFX({ modId, handClosed, outcomeTone }) {
  const keyLightRef = useRef(null);
  const fillRedRef = useRef(null);
  const fillBlueRef = useRef(null);
  const modColorRef = useRef(null);
  const timeRef = useRef(0);

  useFrame((_, delta) => {
    timeRef.current += delta;
    const t = timeRef.current;

    if (keyLightRef.current) {
      // Key light breathes slightly at rest, reacts on hand close
      let intensity = 118 + Math.sin(t * 0.4) * 5;
      if (modId === "sustancia-x") {
        intensity = 88 + Math.sin(t * 2.6) * 12;
      } else if (modId === "exodia-bolsillo") {
        intensity = 98 + (Math.random() > 0.96 ? 16 : 0) + Math.sin(t * 1.4) * 6;
      } else if (modId === "tiempo-arena") {
        intensity = 84 + Math.sin(t * 0.8) * 7;
      } else if (handClosed && outcomeTone === "win") {
        intensity = 106 + Math.sin(t * 5) * 10;
      } else if (handClosed && outcomeTone === "lose") {
        intensity = 74 + Math.sin(t * 3) * 5;
      }
      keyLightRef.current.intensity = intensity;
    }

    if (fillRedRef.current) {
      let intensity = 17 + Math.sin(t * 0.6) * 1.6;
      if (modId === "sustancia-x") intensity = 20 + Math.sin(t * 2.1) * 5;
      else if (modId === "exodia-bolsillo") intensity = 20 + Math.abs(Math.sin(t * 3)) * 6;
      else if (handClosed && outcomeTone === "lose") intensity = 24 + Math.sin(t * 4) * 6;
      fillRedRef.current.intensity = intensity;
    }

    if (fillBlueRef.current) {
      let intensity = 15 + Math.sin(t * 0.5) * 1.2;
      if (modId === "gafas-legendarias") intensity = 19 + Math.sin(t * 1.8) * 4;
      else if (modId === "tiempo-arena") intensity = 16 + Math.sin(t * 0.9) * 3;
      else if (handClosed && outcomeTone === "win") intensity = 15 + Math.sin(t * 3) * 2;
      fillBlueRef.current.intensity = intensity;
    }

    // Modifier-specific accent light
    if (modColorRef.current) {
      let intensity = 0;
      let color = "#ffffff";

      if (modId === "sustancia-x") {
        color = "#c040c0";
        intensity = 6 + Math.abs(Math.sin(t * 3.7)) * 8;
      } else if (modId === "exodia-bolsillo") {
        color = "#d4a020";
        intensity = 8 + (Math.random() > 0.93 ? 12 : 0) + Math.abs(Math.sin(t * 2)) * 4;
      } else if (modId === "gafas-legendarias") {
        color = "#20c8ff";
        intensity = 5 + Math.sin(t * 1.2) * 2;
      } else if (modId === "tiempo-arena") {
        color = "#e8a040";
        intensity = 4 + Math.abs(Math.sin(t * 0.7)) * 5;
      } else if (modId === "humo-total") {
        color = "#606060";
        intensity = 3 + Math.sin(t * 0.3) * 2;
      }

      modColorRef.current.intensity = intensity;
      modColorRef.current.color.set(color);
    }
  });

  return (
    <>
      <spotLight
        ref={keyLightRef}
        name="KeyLight_Antro"
        position={[0, 6.2, 1.35]}
        intensity={118}
        angle={0.5}
        penumbra={0.7}
        color="#ffbd74"
        castShadow
        shadow-mapSize={[1536, 1536]}
        shadow-bias={-0.00012}
      />
      <spotLight name="Card_Focus_Warm" position={[0, 3.2, 2.4]} intensity={34} angle={0.62} penumbra={0.86} color="#ffd39a" castShadow={false} />
      <pointLight ref={fillRedRef} name="FillLight_Rojo" position={[-4.5, 2.0, 1.25]} intensity={20} color="#b84b36" />
      <pointLight ref={fillBlueRef} name="FillLight_Azul" position={[4.35, 2.5, 1.05]} intensity={18} color="#3dbfb3" />
      <pointLight name="RimLight_Dorada" position={[0, 2.35, -3.15]} intensity={24} color="#d58b35" />
      <pointLight name="RimLight_Teal" position={[3.6, 1.9, -1.6]} intensity={14} color="#58d7c8" />
      <pointLight ref={modColorRef} name="Modifier_Accent" position={[0, 3.2, 0]} intensity={0} color="#ffffff" />
    </>
  );
}

// Animated lamp bulb — bobs and flickers
function AnimatedLamp({ modId }) {
  const bulbRef = useRef(null);
  const timeRef = useRef(0);

  useFrame((_, delta) => {
    timeRef.current += delta;
    const t = timeRef.current;

    if (!bulbRef.current) return;

    let emissiveIntensity = 1.8 + Math.sin(t * 1.1) * 0.3;

    if (modId === "sustancia-x") {
      emissiveIntensity = 2.4 + Math.sin(t * 5.3) * 1.0;
      // Slight color shift toward purple
      bulbRef.current.emissive.set("#e89aff");
    } else if (modId === "exodia-bolsillo") {
      emissiveIntensity = 2.0 + (Math.random() > 0.95 ? 2.5 : 0) + Math.sin(t * 2.4) * 0.6;
      bulbRef.current.emissive.set("#ffe880");
    } else if (modId === "tiempo-arena") {
      emissiveIntensity = 1.5 + Math.abs(Math.sin(t * 0.6)) * 0.8;
      bulbRef.current.emissive.set("#ffb15b");
    } else if (modId === "gafas-legendarias") {
      emissiveIntensity = 1.9 + Math.sin(t * 1.8) * 0.5;
      bulbRef.current.emissive.set("#a0e0ff");
    } else {
      bulbRef.current.emissive.set("#ffb15b");
    }

    bulbRef.current.emissiveIntensity = emissiveIntensity;
  });

  return (
    <Float speed={1.4} rotationIntensity={0.03} floatIntensity={0.16}>
      <group name="Lamp_Principal" position={[0, 3.22, 0.0]}>
        <mesh position={[0, 0.44, 0]}>
          <cylinderGeometry args={[0.014, 0.014, 0.94, 10]} />
          <meshStandardMaterial color="#15100c" roughness={0.68} metalness={0.36} />
        </mesh>
        <mesh position={[0, 0.16, 0]}>
          <cylinderGeometry args={[0.26, 0.17, 0.22, 32, 1, true]} />
          <meshStandardMaterial color="#3a2416" roughness={0.72} metalness={0.08} side={2} />
        </mesh>
        <mesh position={[0, 0.29, 0]}>
          <torusGeometry args={[0.26, 0.01, 8, 32]} />
          <meshStandardMaterial color="#b47a34" roughness={0.34} metalness={0.62} />
        </mesh>
        <mesh name="Lamp_Lightbulb" position={[0, 0, 0]}>
          <sphereGeometry args={[0.16, 20, 20]} />
          <meshStandardMaterial
            ref={bulbRef}
            emissive="#ffb15b"
            emissiveIntensity={1.8}
            color="#ffcf88"
          />
        </mesh>
      </group>
    </Float>
  );
}

// Modifier tag on the back wall — replaces static "LA TRAICION" when active
function ModifierWallTag({ modId, modTitle, hidden = false }) {
  const showModifier = modId && modId !== "modo-clasico";
  const meshRef = useRef(null);
  const timeRef = useRef(0);

  useFrame((_, delta) => {
    timeRef.current += delta;
    if (!meshRef.current) return;
    meshRef.current.material.opacity = 0.72 + Math.sin(timeRef.current * 1.4) * 0.18;
  });

  const tagColor =
    modId === "sustancia-x" ? "#d060d0" :
    modId === "exodia-bolsillo" ? "#d4a820" :
    modId === "gafas-legendarias" ? "#40b0d8" :
    modId === "tiempo-arena" ? "#cc8830" :
    modId === "humo-total" ? "#888888" :
    "#b38a52";

  if (hidden) {
    return null;
  }

  return (
    <group>
      <Text
        ref={meshRef}
        position={[0, 1.52, -3.88]}
        fontSize={0.14}
        color={tagColor}
        anchorX="center"
        anchorY="middle"
        letterSpacing={0.05}
        fillOpacity={0.9}
      >
        {showModifier && modTitle ? modTitle.toUpperCase() : "TRUCOLOCO"}
      </Text>
      <Text
        position={[0, 1.24, -3.88]}
        fontSize={0.07}
        color="#7a6040"
        anchorX="center"
        anchorY="middle"
        letterSpacing={0.08}
      >
        {showModifier ? "LA TRAICION" : "LA TRAICION"}
      </Text>
    </group>
  );
}

function RoomAccents() {
  return (
    <group name="Room_Accent_Lines">
      <RoundedBox args={[2.7, 0.028, 0.04]} radius={0.012} position={[0, 1.74, -4.02]}>
        <meshStandardMaterial color="#2f2117" emissive={BAR_COLORS.ember} emissiveIntensity={0.16} roughness={0.5} />
      </RoundedBox>
      <RoundedBox args={[1.6, 0.022, 0.035]} radius={0.012} position={[0, 1.46, -4.01]}>
        <meshStandardMaterial color="#173532" emissive={BAR_COLORS.teal} emissiveIntensity={0.11} roughness={0.5} />
      </RoundedBox>
      <RoundedBox args={[2.6, 0.03, 0.04]} radius={0.012} position={[-3.85, -0.32, -2.2]} rotation={[0, Math.PI / 2, 0]}>
        <meshStandardMaterial color="#173532" emissive={BAR_COLORS.teal} emissiveIntensity={0.16} roughness={0.5} />
      </RoundedBox>
      <RoundedBox args={[2.6, 0.03, 0.04]} radius={0.012} position={[3.85, -0.32, -2.2]} rotation={[0, Math.PI / 2, 0]}>
        <meshStandardMaterial color="#3b1f18" emissive={BAR_COLORS.red} emissiveIntensity={0.14} roughness={0.5} />
      </RoundedBox>
      <mesh position={[0, -1.56, 1.35]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[2.95, 3.05, 72]} />
        <meshBasicMaterial color="#d58b35" transparent opacity={0.055} depthWrite={false} />
      </mesh>
    </group>
  );
}

function BackBarDressing() {
  const bottleColors = ["#2b4a38", "#4b231d", "#57401f", "#213a42", "#38251c", "#523428", "#1d332c"];

  return (
    <group name="BackBar_Dressing">
      {[-0.95, 0.05, 1.05].map((y, rowIndex) => (
        <group key={y} position={[0, y, -4.0]}>
          <RoundedBox args={[5.8, 0.08, 0.18]} radius={0.018} position={[0, 0, 0]}>
            <meshStandardMaterial color="#2b1b12" roughness={0.7} metalness={0.04} />
          </RoundedBox>
          {bottleColors.map((color, index) => {
            const x = -2.45 + index * 0.82 + (rowIndex % 2) * 0.18;
            const height = 0.42 + ((index + rowIndex) % 3) * 0.08;

            return (
              <group key={`${rowIndex}-${color}-${index}`} position={[x, 0.25, 0.08]}>
                <mesh castShadow receiveShadow>
                  <cylinderGeometry args={[0.07, 0.085, height, 12]} />
                  <meshStandardMaterial color={color} roughness={0.36} metalness={0.02} transparent opacity={0.82} />
                </mesh>
                <mesh position={[0, height * 0.5 + 0.075, 0]} castShadow>
                  <cylinderGeometry args={[0.028, 0.038, 0.15, 10]} />
                  <meshStandardMaterial color="#1a100b" roughness={0.42} />
                </mesh>
              </group>
            );
          })}
        </group>
      ))}
      <RoundedBox args={[6.35, 3.05, 0.08]} radius={0.04} position={[0, 0.22, -4.08]}>
        <meshStandardMaterial color="#1a100b" roughness={0.96} transparent opacity={0.22} />
      </RoundedBox>
    </group>
  );
}

function TableLightCone({ isClassic }) {
  return (
    <group name="Table_LightCone">
      <mesh position={[0, 1.72, 0.18]}>
        <cylinderGeometry args={[1.14, 0.28, 1.9, 36, 1, true]} />
        <meshStandardMaterial color="#d48e44" transparent opacity={isClassic ? 0.018 : 0.06} side={2} depthWrite={false} />
      </mesh>
      <mesh position={[0, -0.54, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[3.25, 72]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.22} depthWrite={false} />
      </mesh>
    </group>
  );
}

function BarAtmosphere({ active }) {
  const motesRef = useRef([]);
  const glowRef = useRef(null);
  const timeRef = useRef(0);
  const motes = useRef(
    Array.from({ length: 28 }, (_, index) => ({
      x: -2.2 + ((index * 0.73) % 4.4),
      y: 0.55 + ((index * 0.37) % 1.65),
      z: -1.2 + ((index * 0.51) % 2.8),
      phase: index * 0.71,
      speed: 0.45 + (index % 5) * 0.08,
      size: 0.012 + (index % 4) * 0.005
    }))
  ).current;

  useFrame((_, delta) => {
    timeRef.current += delta;
    const t = timeRef.current;

    motesRef.current.forEach((mote, index) => {
      if (!mote) return;
      const config = motes[index];
      mote.position.x = config.x + Math.sin(t * config.speed + config.phase) * 0.12;
      mote.position.y = config.y + Math.sin(t * 0.33 + config.phase) * 0.08;
      mote.position.z = config.z + Math.cos(t * config.speed * 0.7 + config.phase) * 0.1;
      mote.material.opacity = (active ? 0.22 : 0.12) + Math.sin(t * 0.7 + config.phase) * 0.035;
    });

    if (glowRef.current) {
      glowRef.current.material.opacity = active ? 0.09 + Math.sin(t * 0.9) * 0.018 : 0.045;
      glowRef.current.rotation.z = t * 0.035;
    }
  });

  return (
    <group name="Bar_Atmosphere">
      <mesh ref={glowRef} position={[0, -0.47, 0.04]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1.72, 2.92, 96]} />
        <meshBasicMaterial color="#d49a4f" transparent opacity={0.07} depthWrite={false} />
      </mesh>
      {motes.map((mote, index) => (
        <mesh
          key={index}
          ref={(node) => {
            motesRef.current[index] = node;
          }}
          position={[mote.x, mote.y, mote.z]}
        >
          <sphereGeometry args={[mote.size, 8, 6]} />
          <meshBasicMaterial color={index % 5 === 0 ? "#91e9f6" : "#f0c06a"} transparent opacity={0.12} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
}

function DebateFighter({ side, action }) {
  const groupRef = useRef(null);
  const headRef = useRef(null);
  const leftArmRef = useRef(null);
  const rightArmRef = useRef(null);
  const lastTokenRef = useRef(action?.token ?? 0);
  const impactRef = useRef(0);
  const isPlayer = side === "player";
  const baseX = isPlayer ? -0.34 : 0.34;
  const bodyColor = isPlayer ? "#3a2119" : "#173431";
  const accent = isPlayer ? "#d66a3f" : "#63d5c5";
  const lane = isPlayer ? action?.playerLane ?? -0.18 : action?.rivalLane ?? 0.18;
  const playerWon = action?.resolved && (action?.player ?? 0) > (action?.rival ?? 0);
  const rivalWon = action?.resolved && (action?.rival ?? 0) >= (action?.player ?? 0);
  const hasFallen = isPlayer ? rivalWon : playerWon;

  useFrame((state, delta) => {
    if (!groupRef.current) return;

    if (action?.token !== lastTokenRef.current) {
      lastTokenRef.current = action?.token ?? 0;
      impactRef.current = 1;
    }

    const t = state.clock.elapsedTime;
    const impact = impactRef.current;
    const direction = isPlayer ? 1 : -1;
    const playerAttack = action?.kind === "golpe" || action?.kind === "empujon";
    const rivalAttack = action?.kind === "rival";
    const attack = ((isPlayer && playerAttack) || (!isPlayer && rivalAttack)) ? impact : 0;
    const hitReaction = ((!isPlayer && playerAttack) || (isPlayer && rivalAttack)) ? impact : 0;
    const shove = action?.kind === "empujon" ? impact : 0;
    const recoil = isPlayer ? -(hitReaction * 0.2 + shove * 0.08) : -(hitReaction * 0.18 + shove * 0.16);
    const bob = Math.sin(t * 3.6 + (isPlayer ? 0 : 1.2)) * 0.018;

    groupRef.current.position.x = baseX + recoil * direction;
    groupRef.current.position.y = hasFallen ? -0.22 : bob;
    groupRef.current.position.z += ((0.05 + lane * 0.58) - groupRef.current.position.z) * 0.18;
    groupRef.current.rotation.z = hasFallen ? direction * 1.18 : (attack * -0.28 + hitReaction * 0.36) * direction;
    groupRef.current.rotation.x = hasFallen ? -1.18 : attack * 0.18 - hitReaction * 0.18;

    if (headRef.current) {
      headRef.current.position.x = Math.sin(t * 2.4) * 0.012 - (isPlayer ? 0 : impact * 0.08);
      headRef.current.rotation.z = (isPlayer ? -0.08 : 0.18) * impact;
    }

    if (leftArmRef.current && rightArmRef.current) {
      leftArmRef.current.rotation.x = isPlayer ? -0.45 - attack * 0.92 : 0.12 + impact * 0.64;
      rightArmRef.current.rotation.x = isPlayer ? -0.18 - attack * 1.18 : 0.2 + impact * 0.74;
    }

    impactRef.current = Math.max(0, impact - delta * 2.8);
  });

  return (
    <group ref={groupRef} name={`Debate_Fighter_${side}`} position={[baseX, 0.16, 0.05 + lane * 0.58]} rotation={[0, isPlayer ? 0.28 : -0.28, 0]}>
      <mesh position={[0, 0.34, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.13, 0.17, 0.54, 14]} />
        <meshStandardMaterial color={bodyColor} roughness={0.78} metalness={0.04} />
      </mesh>
      <mesh ref={headRef} position={[0, 0.72, 0]} castShadow>
        <sphereGeometry args={[0.15, 18, 14]} />
        <meshStandardMaterial color="#c58c62" roughness={0.66} />
      </mesh>
      <mesh position={[0, 0.58, 0.118]} castShadow>
        <boxGeometry args={[0.22, 0.035, 0.025]} />
        <meshStandardMaterial color="#100909" roughness={0.32} />
      </mesh>
      <group ref={leftArmRef} position={[-0.16, 0.46, 0.02]}>
        <mesh position={[0, -0.14, 0]} rotation={[0, 0, 0.28]} castShadow>
          <cylinderGeometry args={[0.027, 0.034, 0.34, 8]} />
          <meshStandardMaterial color="#130b08" roughness={0.86} />
        </mesh>
      </group>
      <group ref={rightArmRef} position={[0.16, 0.46, 0.02]}>
        <mesh position={[0, -0.14, 0]} rotation={[0, 0, -0.28]} castShadow>
          <cylinderGeometry args={[0.027, 0.034, 0.34, 8]} />
          <meshStandardMaterial color="#130b08" roughness={0.86} />
        </mesh>
      </group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <ringGeometry args={[0.2, 0.27, 28]} />
        <meshBasicMaterial color={accent} transparent opacity={0.34} depthWrite={false} />
      </mesh>
    </group>
  );
}

function DebateImpactFX({ action }) {
  const groupRef = useRef(null);
  const lastTokenRef = useRef(action?.token ?? 0);
  const progressRef = useRef(1);
  const color = action?.kind === "empujon" ? "#f3dfb6" : action?.kind === "corchazo" ? "#e06b4a" : action?.kind?.startsWith("rival") ? "#e06b4a" : action?.kind === "move" ? "#d98a36" : "#63d5c5";

  useFrame((_, delta) => {
    if (!groupRef.current) return;

    if (action?.token !== lastTokenRef.current) {
      lastTokenRef.current = action?.token ?? 0;
      progressRef.current = 0;
    }

    progressRef.current = Math.min(1, progressRef.current + delta * 2.9);
    const t = progressRef.current;
    const scale = 0.22 + t * 1.35;
    const opacity = Math.max(0, 0.42 * (1 - t));

    groupRef.current.scale.setScalar(scale);
    groupRef.current.children.forEach((child) => {
      if (child.material) {
        child.material.opacity = opacity;
      }
    });
  });

  return (
    <group ref={groupRef} name="Debate_ImpactFX" position={[0, 0.58, 0.02 + ((action?.playerLane ?? 0) + (action?.rivalLane ?? 0)) * 0.28]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.24, 0.32, 42]} />
        <meshBasicMaterial color={color} transparent opacity={0} depthWrite={false} />
      </mesh>
      <mesh rotation={[0, 0, Math.PI / 4]}>
        <ringGeometry args={[0.12, 0.16, 28]} />
        <meshBasicMaterial color="#e06b4a" transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  );
}

function CorkRevolverStation({ side, active, trigger = 0, popped }) {
  const isPlayer = side === "player";
  const x = isPlayer ? -0.52 : 0.52;
  const color = isPlayer ? "#e06b4a" : "#63d5c5";
  const label = isPlayer ? "VOS" : "MESA";
  const rotation = isPlayer ? -0.18 : 0.18;

  return (
    <group name={`Cork_Revolver_${side}`} position={[x, 0.2, 0.08]} rotation={[0, rotation, 0]}>
      <RoundedBox args={[0.54, 0.16, 0.7]} radius={0.06} position={[0, -0.02, 0]} castShadow receiveShadow>
        <meshStandardMaterial color={active ? "#2b1810" : "#140d0a"} roughness={0.62} metalness={0.08} />
      </RoundedBox>
      <mesh position={[0, 0.1, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[0.16, 0.16, 0.16, 24]} />
        <meshStandardMaterial color="#21130e" roughness={0.38} metalness={0.34} />
      </mesh>
      <RoundedBox args={[0.16, 0.09, 0.58]} radius={0.035} position={[0, 0.13, -0.34]} rotation={[0.08, 0, 0]} castShadow>
        <meshStandardMaterial color="#16100d" roughness={0.32} metalness={0.42} />
      </RoundedBox>
      <RoundedBox args={[0.12, 0.28, 0.12]} radius={0.035} position={[0.12, -0.12, 0.18]} rotation={[0, 0, -0.34]} castShadow>
        <meshStandardMaterial color="#2b160d" roughness={0.7} metalness={0.1} />
      </RoundedBox>
      <mesh position={[0, 0.12, -0.68]} castShadow>
        <sphereGeometry args={[0.045, 12, 8]} />
        <meshStandardMaterial
          color={popped ? "#f3dfb6" : "#c38335"}
          emissive={popped ? "#e06b4a" : color}
          emissiveIntensity={popped ? 0.75 : active ? 0.24 : 0.05}
          roughness={0.44}
          metalness={0.2}
        />
      </mesh>
      {[0, 1, 2, 3, 4, 5].map((index) => {
        const angle = (index / 6) * Math.PI * 2;
        const filled = index < trigger;

        return (
          <mesh key={index} position={[Math.cos(angle) * 0.105, 0.19, Math.sin(angle) * 0.105]} rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[0.018, 12]} />
            <meshBasicMaterial color={filled ? color : "#3a2a1d"} transparent opacity={filled ? 0.95 : 0.48} depthWrite={false} />
          </mesh>
        );
      })}
      <Text position={[0, 0.03, 0.44]} rotation={[-Math.PI / 2, 0, 0]} fontSize={0.07} color={active ? "#f3dfb6" : color} anchorX="center" anchorY="middle" letterSpacing={0.12}>
        {label} {trigger}/6
      </Text>
    </group>
  );
}

function DebateRing({ debateAction, position = [0, 0, 0], rotation = [0, 0, 0] }) {
  const isResolved = debateAction?.resolved;
  const isRoulette = debateAction?.mode === "ruleta";
  const ringVerdict = isResolved
    ? (debateAction?.player ?? 0) > (debateAction?.rival ?? 0)
      ? "GANA TU VERSION"
      : "GANA LA MESA"
    : isRoulette
      ? debateAction?.turn === "player"
        ? "TE TOCA APRETAR"
        : "APRIETA LA MESA"
    : debateAction?.kind === "rival"
      ? "TE APURAN"
      : debateAction?.kind === "rival-move"
        ? "TE BUSCAN"
        : "A DOS PASOS";

  return (
    <group name="Debate_Ring" position={position} rotation={rotation}>
      <pointLight name="DebateRing_RedFill" position={[-0.82, 1.45, 0.18]} intensity={5.8} color="#c54c32" />
      <pointLight name="DebateRing_TealFill" position={[0.82, 1.32, -0.12]} intensity={4.8} color="#45c7bd" />

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.022, 0]}>
        <ringGeometry args={[0.88, 1.12, 72]} />
        <meshBasicMaterial color="#d98a36" transparent opacity={0.4} depthWrite={false} />
      </mesh>
      <RoundedBox args={[2.15, 0.18, 2.15]} radius={0.09} position={[0, -0.06, 0]} castShadow receiveShadow>
        <meshStandardMaterial color="#24120d" roughness={0.78} metalness={0.04} />
      </RoundedBox>
      <RoundedBox args={[1.82, 0.04, 1.82]} radius={0.045} position={[0, 0.055, 0]} receiveShadow>
        <meshStandardMaterial color="#4b1f18" roughness={0.72} metalness={0.02} />
      </RoundedBox>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.081, 0]}>
        <ringGeometry args={[0.34, 0.38, 48]} />
        <meshBasicMaterial color="#f3dfb6" transparent opacity={0.18} depthWrite={false} />
      </mesh>
      <RoundedBox args={[1.62, 0.014, 0.014]} radius={0.004} position={[0, 0.09, 0]}>
        <meshStandardMaterial color="#d9b36c" emissive="#d9b36c" emissiveIntensity={0.14} roughness={0.5} />
      </RoundedBox>

      {[
        [-0.98, -0.98],
        [0.98, -0.98],
        [-0.98, 0.98],
        [0.98, 0.98]
      ].map(([x, z]) => (
        <group key={`${x}-${z}`} position={[x, 0.32, z]}>
          <mesh castShadow>
            <cylinderGeometry args={[0.04, 0.055, 0.74, 10]} />
            <meshStandardMaterial color="#1a0d08" roughness={0.58} metalness={0.22} />
          </mesh>
          <mesh position={[0, 0.4, 0]}>
            <sphereGeometry args={[0.075, 12, 8]} />
            <meshStandardMaterial color="#c38335" roughness={0.38} metalness={0.48} />
          </mesh>
        </group>
      ))}

      {[-0.5, 0, 0.5].map((y, index) => (
        <group key={y} position={[0, 0.18 + index * 0.2, 0]}>
          <RoundedBox args={[2.04, 0.024, 0.024]} radius={0.006} position={[0, 0, -1.02]}>
            <meshStandardMaterial color={index === 1 ? "#63d5c5" : "#c45b3d"} roughness={0.45} metalness={0.12} />
          </RoundedBox>
          <RoundedBox args={[2.04, 0.024, 0.024]} radius={0.006} position={[0, 0, 1.02]}>
            <meshStandardMaterial color={index === 1 ? "#63d5c5" : "#c45b3d"} roughness={0.45} metalness={0.12} />
          </RoundedBox>
          <RoundedBox args={[0.024, 0.024, 2.04]} radius={0.006} position={[-1.02, 0, 0]}>
            <meshStandardMaterial color={index === 1 ? "#63d5c5" : "#c45b3d"} roughness={0.45} metalness={0.12} />
          </RoundedBox>
          <RoundedBox args={[0.024, 0.024, 2.04]} radius={0.006} position={[1.02, 0, 0]}>
            <meshStandardMaterial color={index === 1 ? "#63d5c5" : "#c45b3d"} roughness={0.45} metalness={0.12} />
          </RoundedBox>
        </group>
      ))}

      {[
        { x: -0.43, color: "#c54c32", label: "NO" },
        { x: 0.43, color: "#45c7bd", label: "SI" }
      ].map((podium) => (
        <group key={podium.label} position={[podium.x, 0.2, 0]}>
          <RoundedBox args={[0.26, 0.24, 0.32]} radius={0.04} castShadow receiveShadow>
            <meshStandardMaterial color="#150b08" roughness={0.66} metalness={0.08} />
          </RoundedBox>
          <mesh position={[0, 0.18, -0.05]} rotation={[0.42, 0, 0]}>
            <cylinderGeometry args={[0.012, 0.012, 0.22, 8]} />
            <meshStandardMaterial color="#caa05f" roughness={0.34} metalness={0.72} />
          </mesh>
          <mesh position={[0, 0.29, -0.12]}>
            <sphereGeometry args={[0.035, 10, 8]} />
            <meshStandardMaterial color={podium.color} emissive={podium.color} emissiveIntensity={0.18} roughness={0.5} />
          </mesh>
          <Text position={[0, 0.14, 0.17]} rotation={[-Math.PI / 2, 0, 0]} fontSize={0.08} color={podium.color} anchorX="center" anchorY="middle" letterSpacing={0.12}>
            {podium.label}
          </Text>
        </group>
      ))}

      {[-0.42, 0, 0.42].map((z, index) => (
        <mesh key={z} position={[0, 0.095, z]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.08 + index * 0.012, 0.095 + index * 0.012, 28]} />
          <meshBasicMaterial color={index === 1 ? "#f3dfb6" : "#d98a36"} transparent opacity={index === 1 ? 0.18 : 0.11} depthWrite={false} />
        </mesh>
      ))}

      <DebateFighter side="player" action={debateAction} />
      <DebateFighter side="rival" action={debateAction} />
      <DebateImpactFX action={debateAction} />

      {isRoulette ? (
        <group name="Cork_Roulette_Prop" position={[0, 0.03, 0.02]}>
          <RoundedBox args={[1.54, 0.08, 0.98]} radius={0.08} position={[0, 0.12, 0.02]} castShadow receiveShadow>
            <meshStandardMaterial color="#130b08" roughness={0.72} metalness={0.08} />
          </RoundedBox>
          <CorkRevolverStation
            side="player"
            active={debateAction?.turn === "player" && !isResolved}
            trigger={debateAction?.playerTrigger ?? 0}
            popped={isResolved && (debateAction?.rival ?? 0) > (debateAction?.player ?? 0)}
          />
          <CorkRevolverStation
            side="rival"
            active={debateAction?.turn === "rival" && !isResolved}
            trigger={debateAction?.rivalTrigger ?? 0}
            popped={isResolved && (debateAction?.player ?? 0) > (debateAction?.rival ?? 0)}
          />
          <Text position={[0, 0.16, 0.58]} rotation={[-Math.PI / 2, 0, 0]} fontSize={0.06} color="#f3dfb6" anchorX="center" anchorY="middle" letterSpacing={0.14}>
            DOS TAMBORES · 6 POSICIONES
          </Text>
        </group>
      ) : null}

      <Text position={[0, 1.08, 0.82]} fontSize={0.12} color={isResolved ? "#f3dfb6" : "#63d5c5"} anchorX="center" anchorY="middle" letterSpacing={0.16}>
        {ringVerdict}
      </Text>
      <Text position={[0, 0.82, -1.18]} fontSize={0.15} color="#f3dfb6" anchorX="center" anchorY="middle" letterSpacing={0.12}>
        {isRoulette ? "RULETA DEL CONFLICTO" : "RING DEL CONFLICTO"}
      </Text>
      <Text position={[0, 0.64, -1.18]} fontSize={0.06} color="#c99b58" anchorX="center" anchorY="middle" letterSpacing={0.14}>
        {isRoulette ? "UN CORCHO DECIDE LA JURISPRUDENCIA" : "SE DISCUTE CON EL CUERPO"}
      </Text>
    </group>
  );
}

function DebateRoom({ debateAction }) {
  return (
    <group name="Debate_Room" position={[-7.45, -1.14, -0.9]}>
      <RoundedBox name="DebateRoom_Floor" args={[5.2, 0.26, 4.4]} radius={0.12} position={[0, -0.16, 0]} receiveShadow>
        <meshStandardMaterial color="#170c09" roughness={0.9} metalness={0.04} />
      </RoundedBox>
      <RoundedBox args={[5.15, 2.85, 0.22]} radius={0.08} position={[0, 1.04, -2.24]} receiveShadow>
        <meshStandardMaterial color="#100807" roughness={0.98} />
      </RoundedBox>
      <RoundedBox args={[0.22, 2.85, 4.3]} radius={0.08} position={[-2.58, 1.04, 0]} receiveShadow>
        <meshStandardMaterial color="#210f0b" roughness={0.96} />
      </RoundedBox>
      <RoundedBox args={[0.18, 2.36, 2.56]} radius={0.08} position={[2.48, 0.82, -0.8]} receiveShadow>
        <meshStandardMaterial color="#0c0b09" roughness={0.98} transparent opacity={0.72} />
      </RoundedBox>
      <RoundedBox args={[0.18, 0.2, 3.85]} radius={0.04} position={[2.48, 2.18, 0]} receiveShadow>
        <meshStandardMaterial color="#b47a34" roughness={0.38} metalness={0.54} />
      </RoundedBox>
      <RoundedBox args={[4.75, 0.12, 0.16]} radius={0.04} position={[0, 2.34, 1.84]} receiveShadow>
        <meshStandardMaterial color="#2b160d" roughness={0.72} metalness={0.1} />
      </RoundedBox>
      <RoundedBox args={[0.18, 2.36, 1.55]} radius={0.08} position={[2.42, 0.82, 1.1]} receiveShadow>
        <meshStandardMaterial color="#1b0d0a" roughness={0.98} />
      </RoundedBox>

      <pointLight name="DebateRoom_Practical_Red" position={[-1.35, 1.35, 0.9]} intensity={7.5} color="#c54c32" />
      <pointLight name="DebateRoom_Practical_Teal" position={[1.55, 1.15, -0.65]} intensity={6.4} color="#45c7bd" />
      <pointLight name="DebateRoom_TopSpot" position={[0, 2.42, 0.28]} intensity={18} color="#f3c172" castShadow />
      <pointLight name="DebateRoom_TopGlow" position={[0, 2.05, 0.1]} intensity={10} color="#f3c172" />

      <Text position={[0, 1.94, -2.08]} fontSize={0.105} color="#f3dfb6" anchorX="center" anchorY="middle" letterSpacing={0.16}>
        SALA DE CONFLICTO
      </Text>
      <Text position={[2.18, 0.42, 1.08]} rotation={[0, -Math.PI / 2, 0]} fontSize={0.08} color="#d9b36c" anchorX="center" anchorY="middle" letterSpacing={0.12}>
        ENTRADA DESDE EL ANTRO
      </Text>

      {[-1.42, -0.72, 0.72, 1.42].map((x, index) => (
        <group key={x} position={[x, 0.06, 1.34]}>
          <mesh castShadow>
            <cylinderGeometry args={[0.08, 0.1, 0.38, 12]} />
            <meshStandardMaterial color={index % 2 ? "#1b342f" : "#34150f"} roughness={0.72} />
          </mesh>
          <mesh position={[0, 0.26, 0]} castShadow>
            <sphereGeometry args={[0.12, 14, 10]} />
            <meshStandardMaterial color="#120907" roughness={0.9} />
          </mesh>
        </group>
      ))}

      <DebateRing debateAction={debateAction} position={[0, 0.02, 0]} rotation={[0, -0.08, 0]} />
    </group>
  );
}

function DebateEntrance() {
  return (
    <group name="Debate_Entrance" position={[-5.42, -1.08, -0.9]}>
      <RoundedBox args={[0.2, 2.48, 0.16]} radius={0.04} position={[0, 1.12, -0.98]} castShadow receiveShadow>
        <meshStandardMaterial color="#2b160d" roughness={0.74} metalness={0.08} />
      </RoundedBox>
      <RoundedBox args={[0.2, 2.48, 0.16]} radius={0.04} position={[0, 1.12, 0.98]} castShadow receiveShadow>
        <meshStandardMaterial color="#2b160d" roughness={0.74} metalness={0.08} />
      </RoundedBox>
      <RoundedBox args={[0.2, 0.16, 2.12]} radius={0.04} position={[0, 2.38, 0]} castShadow receiveShadow>
        <meshStandardMaterial color="#b47a34" roughness={0.38} metalness={0.52} />
      </RoundedBox>
      <mesh position={[-0.02, 0.14, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.72, 0.88, 48]} />
        <meshBasicMaterial color="#e06b4a" transparent opacity={0.22} depthWrite={false} />
      </mesh>
      <Text position={[-0.08, 1.84, 0]} rotation={[0, Math.PI / 2, 0]} fontSize={0.12} color="#f3dfb6" anchorX="center" anchorY="middle" letterSpacing={0.12}>
        CONFLICTO
      </Text>
      <pointLight position={[-0.42, 1.0, 0]} intensity={5.5} color="#e06b4a" />
    </group>
  );
}

function WalkMarker({ active, label, position, color = "#63d5c5" }) {
  const groupRef = useRef(null);

  useFrame((state) => {
    if (!groupRef.current) return;
    const pulse = active ? 1 + Math.sin(state.clock.elapsedTime * 4) * 0.045 : 1;
    groupRef.current.scale.setScalar(pulse);
  });

  return (
    <group ref={groupRef} name={`Walk_Hotspot_${label}`} position={position}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.42, 0.54, 42]} />
        <meshBasicMaterial color={active ? "#f3dfb6" : color} transparent opacity={active ? 0.46 : 0.22} depthWrite={false} />
      </mesh>
      <Text
        position={[0, 0.013, 0.16]}
        rotation={[-Math.PI / 2, 0, 0]}
        fontSize={0.14}
        color={active ? "#f3dfb6" : color}
        anchorX="center"
        anchorY="middle"
        letterSpacing={0.08}
      >
        {label}
      </Text>
    </group>
  );
}

function WalkHotspots({ activeHotspot }) {
  return (
    <group name="Walk_Hotspots">
      <mesh position={[0, 0.055, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[2.56, 2.7, 96]} />
        <meshBasicMaterial
          color={activeHotspot === "table" ? "#f0c06a" : "#63d5c5"}
          transparent
          opacity={activeHotspot === "table" ? 0.34 : 0.14}
          depthWrite={false}
        />
      </mesh>
      <WalkMarker active={activeHotspot === "table"} label="F SENTARSE" position={[0, 0.062, 2.86]} color="#8bded3" />
      <WalkMarker active={activeHotspot === "door"} label="F PUERTA" position={[0, 0.064, 3.62]} color="#d9b36c" />
      <WalkMarker active={activeHotspot === "bar"} label="F BARRA" position={[0, 0.064, -3.06]} color="#8bded3" />
      <WalkMarker active={activeHotspot === "ring"} label="F PELEAR" position={[-7.45, 0.066, -0.9]} color="#e06b4a" />
    </group>
  );
}

function SeatViewFocus({ match }) {
  const seat = getOwnSeat(match);

  return (
    <group name="Seat_ViewFocus" position={[seat.position[0], 0.085, seat.position[2]]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.82, 1.02, 56]} />
        <meshBasicMaterial color="#f3dfb6" transparent opacity={0.34} depthWrite={false} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1.08, 1.16, 56]} />
        <meshBasicMaterial color="#63d5c5" transparent opacity={0.22} depthWrite={false} />
      </mesh>
      <Text
        position={[0, 0.035, -0.98]}
        rotation={[-Math.PI / 2, 0, 0]}
        fontSize={0.13}
        color="#f3dfb6"
        anchorX="center"
        anchorY="middle"
        letterSpacing={0.08}
      >
        TU LUGAR
      </Text>
    </group>
  );
}

const ROOM_OFFSET = { x: 0, y: -1.35, z: 0.25 };

function getOwnSeat(match) {
  return tableSeats.find((seat) => seat.team === "A" && seat.role === match.selectedRole) ?? tableSeats[0];
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function getCameraPose({ match, isNarrow, cameraView }) {
  const isRoleSelect = match.phase === "role-select";
  const ownSeat = getOwnSeat(match);
  const ownSeatWorld = {
    x: ownSeat.position[0] + ROOM_OFFSET.x,
    y: ownSeat.position[1] + ROOM_OFFSET.y,
    z: ownSeat.position[2] + ROOM_OFFSET.z
  };

  if (cameraView === "entry") {
    return {
      position: isNarrow ? [0, 2.95, 9.2] : [0, 2.65, 9.85],
      target: [0, -0.74, -0.45],
      fov: isNarrow ? 46 : 42
    };
  }

  if (cameraView === "seat") {
    const target = [ownSeatWorld.x * 0.18, -0.82, ownSeatWorld.z * 0.14];
    const dx = ownSeatWorld.x - target[0];
    const dz = ownSeatWorld.z - target[2];
    const length = Math.hypot(dx, dz) || 1;
    const distance = isNarrow ? 2.56 : 2.72;
    const cameraX = clamp(target[0] + (dx / length) * distance, -4.25, 4.25);
    const cameraZ = clamp(target[2] + (dz / length) * distance, -3.18, 3.62);

    return {
      position: [
        cameraX,
        isNarrow ? 2.08 : 1.46,
        cameraZ
      ],
      target,
      fov: isNarrow ? 46 : 39
    };
  }

  if (cameraView === "ring") {
    return {
      position: isNarrow ? [-7.45, 0.52, 2.82] : [-7.45, 0.22, 2.62],
      target: [-7.45, -0.9, -0.12],
      fov: isNarrow ? 42 : 34
    };
  }

  return {
    position: isNarrow
      ? isRoleSelect
        ? [0, 4.6, 8.35]
        : [0, 4.75, 6.95]
      : isRoleSelect
        ? [0, 4.05, 7.05]
        : [0, 4.05, 5.55],
    target: [0, isRoleSelect ? 0.42 : 0.16, isNarrow ? 0.2 : 0.02],
    fov: isNarrow ? (isRoleSelect ? 42 : 36) : isRoleSelect ? 38 : 33
  };
}

export function TrucolocoScene({ match, cameraView = "table", debateAction, selectedWalkCharacter, walkHotspot, onWalkHotspotChange, onWalkInteract }) {
  const modId = match.activeModifier?.id ?? "";
  const modTitle = match.activeModifier?.title ?? "";
  const { camera, size } = useThree();
  const isClassic = modId === "modo-clasico";
  const isRoleSelect = match.phase === "role-select";
  const isNarrow = size.width < 640;
  const isWalkMode = cameraView === "walk";
  const isRingMode = cameraView === "ring";
  const debateTokenRef = useRef(debateAction?.token ?? 0);
  const ringShakeRef = useRef(0);

  useFrame((state, delta) => {
    if (isWalkMode) return;

    if (cameraView === "ring" && debateAction?.token !== debateTokenRef.current) {
      debateTokenRef.current = debateAction?.token ?? 0;
      ringShakeRef.current = debateAction?.kind === "empujon" ? 0.16 : debateAction?.kind === "golpe" ? 0.09 : 0;
    }

    const cameraPose = getCameraPose({ match, isNarrow, cameraView });
    const [targetX, targetY, targetZ] = cameraPose.position;

    if (
      !Number.isFinite(camera.position.x) ||
      !Number.isFinite(camera.position.y) ||
      !Number.isFinite(camera.position.z) ||
      Math.abs(camera.position.x) > 100 ||
      Math.abs(camera.position.y) > 100 ||
      Math.abs(camera.position.z) > 100
    ) {
      camera.position.set(targetX, targetY, targetZ);
    } else {
      const alpha = 1 - Math.exp(-Math.min(delta, 0.12) * 3.6);
      camera.position.x += (targetX - camera.position.x) * alpha;
      camera.position.y += (targetY - camera.position.y) * alpha;
      camera.position.z += (targetZ - camera.position.z) * alpha;
    }

    if (cameraView === "ring" && ringShakeRef.current > 0) {
      const shake = ringShakeRef.current;
      camera.position.x += Math.sin(state.clock.elapsedTime * 64) * shake;
      camera.position.y += Math.cos(state.clock.elapsedTime * 58) * shake * 0.28;
      ringShakeRef.current = Math.max(0, shake - delta * 1.9);
    }

    if (camera.fov !== cameraPose.fov) {
      camera.fov += (cameraPose.fov - camera.fov) * 0.16;
      camera.updateProjectionMatrix();
    }

    camera.lookAt(...cameraPose.target);
  });

  return (
    <>
      <RenderEnvironment />
      <ambientLight intensity={0.23} color="#9a6a45" />
      <hemisphereLight intensity={0.32} color="#d59b65" groundColor="#070b07" />
      <ModifierAmbientFX modId={modId} handClosed={match.handClosed} outcomeTone={match.outcomeTone} />

      <group name="Room_Runtime" position={[0, -1.35, 0.25]}>
        <RoundedBox name="Floor_Antro" args={[14, 0.4, 10]} radius={0.18} position={[0, -1.9, 0]} receiveShadow>
          <meshStandardMaterial color={BAR_COLORS.floor} roughness={0.94} metalness={0.05} />
        </RoundedBox>

        <RoundedBox name="BackWall_Antro" args={[11.2, 4.8, 0.3]} radius={0.18} position={[0, 0.4, -4.2]} receiveShadow>
          <meshStandardMaterial color={BAR_COLORS.wall} roughness={0.98} />
        </RoundedBox>

        <RoundedBox args={[0.32, 4.8, 2.35]} radius={0.12} position={[-5.45, 0.4, -3.26]} receiveShadow>
          <meshStandardMaterial color={BAR_COLORS.wallWarm} roughness={0.98} />
        </RoundedBox>

        <RoundedBox args={[0.32, 4.8, 2.55]} radius={0.12} position={[-5.45, 0.4, 2.36]} receiveShadow>
          <meshStandardMaterial color={BAR_COLORS.wallWarm} roughness={0.98} />
        </RoundedBox>

        <RoundedBox args={[0.32, 4.8, 7.8]} radius={0.12} position={[5.45, 0.4, -0.55]} receiveShadow>
          <meshStandardMaterial color={BAR_COLORS.wallWarm} roughness={0.98} />
        </RoundedBox>

        <RoundedBox args={[11.2, 0.2, 7.2]} radius={0.14} position={[0, -0.2, -0.65]} receiveShadow>
          <meshStandardMaterial color={BAR_COLORS.floorDark} roughness={0.9} />
        </RoundedBox>

        <BackBarDressing />
        <BarRoom />
        <DebateEntrance />
        <DebateRoom debateAction={debateAction} />
        <RoomAccents />

        {!isRingMode ? <TableLightCone isClassic={isClassic} /> : null}
        <BarAtmosphere active={isWalkMode || isRingMode || !isRoleSelect} />

        {!isRingMode ? (
          <>
            <ContactShadows
              name="Table_ContactShadows"
              position={[0, -1.66, 0.04]}
              scale={[7.4, 7.4]}
              opacity={0.42}
              blur={2.7}
              far={3.2}
              resolution={1024}
              color="#050302"
              frames={1}
            />
            <Table match={match} />
            <TeamsAroundTable match={match} cameraView={cameraView} />
            {cameraView === "seat" ? <SeatViewFocus match={match} /> : null}
            {isWalkMode ? <WalkHotspots activeHotspot={walkHotspot} /> : null}
            <WalkablePlayer
              enabled={isWalkMode}
              character={selectedWalkCharacter}
              onHotspotChange={onWalkHotspotChange}
              onInteract={onWalkInteract}
            />

            <AnimatedLamp modId={modId} />
            <ModifierWallTag modId={modId} modTitle={modTitle} hidden={isNarrow} />
          </>
        ) : null}
      </group>
    </>
  );
}
