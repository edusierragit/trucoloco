import { Suspense, useEffect, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Billboard, ContactShadows, Float, RoundedBox } from "@react-three/drei";
import { PMREMGenerator, Vector3 } from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { HeldHand, Table } from "./Table";
import { sfx } from "../audio/sfx";
import { TeamsAroundTable } from "./TeamsAroundTable";
import { CharacterFigure } from "./CharacterFigure";
import { characterSkins, tableSeats, teams } from "../data/characters";
import { BarRoom } from "./world/BarRoom";
import { WalkablePlayer } from "./world/WalkablePlayer";
import { DuelStage } from "./DuelStage";
import { duelStore } from "../conflict/duel/duelStore";
import { SceneText as Text } from "./SceneText";
import { isLowPower, tierIndex } from "../perf.js";

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
    let roomEnvironment = null;
    let pmrem = null;
    let environmentMap = null;
    let cancelled = false;
    let idleId = null;
    let timeoutId = null;

    const buildEnvironment = () => {
      if (cancelled) return;

      roomEnvironment = new RoomEnvironment();
      pmrem = new PMREMGenerator(gl);
      environmentMap = pmrem.fromScene(roomEnvironment, 0.035).texture;

      if (cancelled) return;
      scene.environment = environmentMap;
      // [VISUAL] Lower IBL keeps the bar nocturnal and lets practical table lights drive the composition.
      scene.environmentIntensity = 0.42;
    };

    // PMREM is one of the heaviest GPU jobs at startup. Deferring it preserves
    // the exact same final lighting while letting mobile paint/respond first.
    if (typeof window !== "undefined" && "requestIdleCallback" in window) {
      idleId = window.requestIdleCallback(buildEnvironment, { timeout: 1500 });
    } else if (typeof window !== "undefined") {
      timeoutId = window.setTimeout(buildEnvironment, 500);
    } else {
      buildEnvironment();
    }

    return () => {
      cancelled = true;
      if (idleId !== null && typeof window !== "undefined" && typeof window.cancelIdleCallback === "function") {
        window.cancelIdleCallback(idleId);
      }
      if (timeoutId !== null) window.clearTimeout(timeoutId);
      if (scene.environment === environmentMap) {
        scene.environment = previousEnvironment;
        scene.environmentIntensity = previousEnvironmentIntensity;
      }
      environmentMap?.dispose();
      pmrem?.dispose();
      roomEnvironment?.dispose();
    };
  }, [gl, scene]);

  return null;
}

// Modifier-reactive ambient light — pulses color and intensity based on active modifier
function ModifierAmbientFX({ modId, handClosed, outcomeTone, lowPower = false, shadowsOn = true, shadowMapSize = 1024 }) {
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
      let intensity = 92 + Math.sin(t * 0.4) * 4;
      if (modId === "sustancia-x") {
        intensity = 74 + Math.sin(t * 2.6) * 10;
      } else if (modId === "exodia-bolsillo") {
        intensity = 82 + (Math.random() > 0.96 ? 12 : 0) + Math.sin(t * 1.4) * 5;
      } else if (modId === "tiempo-arena") {
        intensity = 72 + Math.sin(t * 0.8) * 6;
      } else if (handClosed && outcomeTone === "win") {
        intensity = 88 + Math.sin(t * 5) * 8;
      } else if (handClosed && outcomeTone === "lose") {
        intensity = 64 + Math.sin(t * 3) * 4;
      }
      keyLightRef.current.intensity = intensity;
    }

    if (fillRedRef.current) {
      let intensity = 10 + Math.sin(t * 0.6) * 1.1;
      if (modId === "sustancia-x") intensity = 14 + Math.sin(t * 2.1) * 3.5;
      else if (modId === "exodia-bolsillo") intensity = 13 + Math.abs(Math.sin(t * 3)) * 4;
      else if (handClosed && outcomeTone === "lose") intensity = 16 + Math.sin(t * 4) * 4;
      fillRedRef.current.intensity = intensity;
    }

    if (fillBlueRef.current) {
      let intensity = 9 + Math.sin(t * 0.5) * 0.9;
      if (modId === "gafas-legendarias") intensity = 13 + Math.sin(t * 1.8) * 3;
      else if (modId === "tiempo-arena") intensity = 11 + Math.sin(t * 0.9) * 2;
      else if (handClosed && outcomeTone === "win") intensity = 10 + Math.sin(t * 3) * 1.6;
      fillBlueRef.current.intensity = intensity;
    }

    // Modifier-specific accent light
    if (modColorRef.current) {
      let intensity = 0;
      let color = "#ffffff";

      if (modId === "sustancia-x") {
        color = "#c040c0";
        intensity = 4 + Math.abs(Math.sin(t * 3.7)) * 5;
      } else if (modId === "exodia-bolsillo") {
        color = "#d4a020";
        intensity = 5 + (Math.random() > 0.93 ? 8 : 0) + Math.abs(Math.sin(t * 2)) * 3;
      } else if (modId === "gafas-legendarias") {
        color = "#20c8ff";
        intensity = 3.5 + Math.sin(t * 1.2) * 1.5;
      } else if (modId === "tiempo-arena") {
        color = "#e8a040";
        intensity = 3 + Math.abs(Math.sin(t * 0.7)) * 3.5;
      } else if (modId === "humo-total") {
        color = "#606060";
        intensity = 2 + Math.sin(t * 0.3) * 1.4;
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
        intensity={92}
        angle={0.42}
        penumbra={0.76}
        color="#ffbd74"
        castShadow={shadowsOn}
        shadow-mapSize={[shadowMapSize, shadowMapSize]}
        shadow-bias={-0.00012}
      />
      <spotLight name="Card_Focus_Warm" position={[0, 3.35, 2.05]} intensity={42} angle={0.38} penumbra={0.9} color="#ffd39a" castShadow={false} />
      <pointLight ref={fillRedRef} name="FillLight_Rojo" position={[-4.5, 2.0, 1.25]} intensity={10} color="#b84b36" />
      <pointLight ref={fillBlueRef} name="FillLight_Azul" position={[4.35, 2.5, 1.05]} intensity={9} color="#3dbfb3" />
      <pointLight name="RimLight_Dorada" position={[0, 2.35, -3.15]} intensity={16} color="#d58b35" />
      <pointLight name="RimLight_Teal" position={[3.6, 1.9, -1.6]} intensity={9} color="#58d7c8" />
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
      <group name="Lamp_Principal" position={[0.62, 3.22, -0.16]}>
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

function MainRoomShell({ hideSideRoom = false }) {
  return (
    <group name="Room_SolidShell">
      <RoundedBox name="Ceiling_BackSoffit_Antro" args={[11.45, 0.24, 1.05]} radius={0.1} position={[0, 2.82, -4.02]} receiveShadow>
        <meshStandardMaterial color="#080605" roughness={0.98} metalness={0.02} />
      </RoundedBox>
      <RoundedBox name="Ceiling_FrontSoffit_Antro" args={[14.0, 0.22, 0.9]} radius={0.1} position={[0, 2.82, 4.48]} receiveShadow>
        <meshStandardMaterial color="#080605" roughness={0.98} metalness={0.02} />
      </RoundedBox>
      <RoundedBox name="Ceiling_LeftSoffit_Antro" args={[1.0, 0.22, 8.8]} radius={0.1} position={[-5.95, 2.82, 0.04]} receiveShadow>
        <meshStandardMaterial color="#080605" roughness={0.98} metalness={0.02} />
      </RoundedBox>
      <RoundedBox name="Ceiling_RightSoffit_Antro" args={[1.0, 0.22, 8.8]} radius={0.1} position={[5.95, 2.82, 0.04]} receiveShadow>
        <meshStandardMaterial color="#080605" roughness={0.98} metalness={0.02} />
      </RoundedBox>
      <RoundedBox name="FrontWall_Left_Antro" args={[5.45, 4.75, 0.34]} radius={0.14} position={[-4.55, 0.38, 4.72]} receiveShadow>
        <meshStandardMaterial color="#120b08" roughness={0.98} />
      </RoundedBox>
      <RoundedBox name="FrontWall_Right_Antro" args={[5.45, 4.75, 0.34]} radius={0.14} position={[4.55, 0.38, 4.72]} receiveShadow>
        <meshStandardMaterial color="#0c1110" roughness={0.98} />
      </RoundedBox>
      <RoundedBox name="FrontWall_Header_Antro" args={[3.15, 1.22, 0.34]} radius={0.12} position={[0, 2.16, 4.72]} receiveShadow>
        <meshStandardMaterial color="#0b0706" roughness={0.98} />
      </RoundedBox>
      <RoundedBox name="FrontWall_BrassLintel" args={[2.46, 0.08, 0.16]} radius={0.025} position={[0, 1.47, 4.52]} castShadow receiveShadow>
        <meshStandardMaterial color={BAR_COLORS.brass} roughness={0.36} metalness={0.58} />
      </RoundedBox>
      <RoundedBox name="FrontBaseboard_Antro" args={[13.8, 0.16, 0.13]} radius={0.035} position={[0, -1.61, 4.33]} receiveShadow>
        <meshStandardMaterial color="#0b0605" roughness={0.86} />
      </RoundedBox>
      <RoundedBox name="LeftBaseboard_Antro" args={[0.14, 0.16, 8.55]} radius={0.035} position={[-5.38, -1.61, 0.05]} receiveShadow>
        <meshStandardMaterial color="#0b0605" roughness={0.86} />
      </RoundedBox>
      <RoundedBox name="RightBaseboard_Antro" args={[0.14, 0.16, 8.55]} radius={0.035} position={[5.38, -1.61, 0.05]} receiveShadow>
        <meshStandardMaterial color="#0b0605" roughness={0.86} />
      </RoundedBox>
      {/* El pasillo lateral se mete dentro de la sala del conflicto: en el
          duelo la cámara está adentro y la sala tiene sus propias paredes. */}
      {!hideSideRoom ? (
        <>
        <RoundedBox name="SideRoom_FloorBridge" args={[2.34, 0.34, 2.55]} radius={0.12} position={[-6.42, -1.78, -0.9]} receiveShadow>
          <meshStandardMaterial color="#160c09" roughness={0.9} metalness={0.04} />
        </RoundedBox>
        <RoundedBox name="SideRoom_OuterSkirt" args={[0.26, 1.16, 2.82]} radius={0.08} position={[-7.64, -1.14, -0.9]} receiveShadow>
          <meshStandardMaterial color="#090605" roughness={0.98} />
        </RoundedBox>
        <RoundedBox name="SideRoom_InnerSkirt" args={[0.18, 0.82, 2.72]} radius={0.06} position={[-5.22, -1.28, -0.9]} receiveShadow>
          <meshStandardMaterial color="#100806" roughness={0.96} />
        </RoundedBox>
        <RoundedBox name="SideRoom_CeilingBridge" args={[2.48, 0.2, 2.68]} radius={0.08} position={[-6.43, 2.22, -0.9]} receiveShadow>
          <meshStandardMaterial color="#070504" roughness={0.98} />
        </RoundedBox>
        <RoundedBox name="SideRoom_BackClosure" args={[2.2, 3.4, 0.2]} radius={0.08} position={[-6.42, 0.35, -2.28]} receiveShadow>
          <meshStandardMaterial color="#0e0807" roughness={0.98} />
        </RoundedBox>
        <RoundedBox name="SideRoom_FrontClosure" args={[2.2, 3.4, 0.2]} radius={0.08} position={[-6.42, 0.35, 0.48]} receiveShadow>
          <meshStandardMaterial color="#180b08" roughness={0.96} />
        </RoundedBox>
        </>
      ) : null}
    </group>
  );
}

function BackBarDressing({ lowPower = false }) {
  const bottleColors = ["#2b4a38", "#4b231d", "#57401f", "#213a42", "#38251c", "#523428", "#1d332c"];
  const rows = lowPower ? [0.05] : [-0.95, 0.05, 1.05];
  const visibleBottleColors = lowPower ? bottleColors.slice(0, 4) : bottleColors;

  return (
    <group name="BackBar_Dressing">
      {rows.map((y, rowIndex) => (
        <group key={y} position={[0, y, -4.0]}>
          <RoundedBox args={[5.8, 0.08, 0.18]} radius={0.018} position={[0, 0, 0]}>
            <meshStandardMaterial color="#2b1b12" roughness={0.7} metalness={0.04} />
          </RoundedBox>
          {visibleBottleColors.map((color, index) => {
            const x = lowPower ? -1.25 + index * 0.82 : -2.45 + index * 0.82 + (rowIndex % 2) * 0.18;
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
      <RoundedBox args={[6.35, lowPower ? 2.2 : 3.05, 0.08]} radius={0.04} position={[0, 0.22, -4.08]}>
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
        {/* forceSinglePass: transparente + doble cara = 2 pasadas y needsUpdate x2 por frame */}
        <meshStandardMaterial color="#d48e44" transparent opacity={isClassic ? 0.014 : 0.045} side={2} forceSinglePass depthWrite={false} />
      </mesh>
      <mesh position={[0, -0.54, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[3.25, 72]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.28} depthWrite={false} />
      </mesh>
    </group>
  );
}

function BarAtmosphere({ active, lowPower = false }) {
  const motesRef = useRef([]);
  const glowRef = useRef(null);
  const timeRef = useRef(0);
  const motes = useRef(
    Array.from({ length: lowPower ? 8 : 18 }, (_, index) => ({
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
      mote.material.opacity = (active ? 0.14 : 0.07) + Math.sin(t * 0.7 + config.phase) * 0.025;
    });

    if (glowRef.current) {
      glowRef.current.material.opacity = active ? 0.06 + Math.sin(t * 0.9) * 0.014 : 0.032;
      glowRef.current.rotation.z = t * 0.035;
    }
  });

  return (
    <group name="Bar_Atmosphere">
      <mesh ref={glowRef} position={[0, -0.47, 0.04]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1.72, 2.92, lowPower ? 40 : 64]} />
        <meshBasicMaterial color="#d49a4f" transparent opacity={0.045} depthWrite={false} />
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
          <meshBasicMaterial color={index % 5 === 0 ? "#91e9f6" : "#f0c06a"} transparent opacity={0.08} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
}

function DebateRoom({ playerCharacter, rivalCharacter }) {

  return (
    <group name="Debate_Room" position={[-7.45, -1.14, -0.9]}>
      <RoundedBox name="DebateRoom_Floor" args={[5.65, 0.26, 4.75]} radius={0.14} position={[0, -0.16, 0]} receiveShadow>
        <meshStandardMaterial color="#160c09" roughness={0.88} metalness={0.05} />
      </RoundedBox>
      <RoundedBox args={[4.95, 0.035, 4.12]} radius={0.06} position={[0, -0.005, 0.02]} receiveShadow>
        <meshStandardMaterial color="#22120d" roughness={0.82} metalness={0.03} />
      </RoundedBox>
      <RoundedBox name="DebateRoom_Ceiling" args={[5.7, 0.22, 4.8]} radius={0.1} position={[0, 2.34, 0]} receiveShadow>
        <meshStandardMaterial color="#080605" roughness={0.98} metalness={0.02} />
      </RoundedBox>
      <RoundedBox name="DebateRoom_FrontWall" args={[5.45, 2.42, 0.22]} radius={0.08} position={[0, 1.02, 2.36]} receiveShadow>
        <meshStandardMaterial color="#120907" roughness={0.98} />
      </RoundedBox>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.018, 0]}>
        <ringGeometry args={[1.42, 1.55, 96]} />
        <meshBasicMaterial color="#d98a36" transparent opacity={0.16} depthWrite={false} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <ringGeometry args={[2.05, 2.08, 96]} />
        <meshBasicMaterial color="#63d5c5" transparent opacity={0.1} depthWrite={false} />
      </mesh>
      <RoundedBox args={[5.45, 2.55, 0.22]} radius={0.08} position={[0, 1.0, -2.38]} receiveShadow>
        <meshStandardMaterial color="#0e0807" roughness={0.98} />
      </RoundedBox>
      <RoundedBox args={[0.22, 2.55, 4.45]} radius={0.08} position={[-2.82, 1.0, 0]} receiveShadow>
        <meshStandardMaterial color="#210f0b" roughness={0.96} />
      </RoundedBox>
      <RoundedBox name="DebateRoom_RightWall_Back" args={[0.2, 2.55, 1.5]} radius={0.08} position={[2.82, 1.0, -1.52]} receiveShadow>
        <meshStandardMaterial color="#0d0a08" roughness={0.98} />
      </RoundedBox>
      <RoundedBox name="DebateRoom_RightWall_Front" args={[0.2, 2.55, 1.18]} radius={0.08} position={[2.82, 1.0, 1.62]} receiveShadow>
        <meshStandardMaterial color="#1b0d0a" roughness={0.98} />
      </RoundedBox>
      <RoundedBox name="DebateRoom_RightDoorHeader" args={[0.22, 0.34, 4.22]} radius={0.04} position={[2.82, 2.02, 0]} receiveShadow>
        <meshStandardMaterial color="#b47a34" roughness={0.38} metalness={0.54} />
      </RoundedBox>
      {[[-2.72, -2.2], [2.72, -2.2], [-2.72, 2.2], [2.72, 2.2]].map(([x, z]) => (
        <RoundedBox key={`${x}-${z}`} args={[0.2, 2.28, 0.2]} radius={0.045} position={[x, 0.95, z]} castShadow receiveShadow>
          <meshStandardMaterial color="#1a0c08" roughness={0.74} metalness={0.12} />
        </RoundedBox>
      ))}
      <RoundedBox name="DebateRoom_BackBaseboard" args={[5.18, 0.14, 0.12]} radius={0.03} position={[0, -0.02, -2.22]} receiveShadow>
        <meshStandardMaterial color="#080504" roughness={0.88} />
      </RoundedBox>
      <RoundedBox name="DebateRoom_FrontBaseboard" args={[5.18, 0.14, 0.12]} radius={0.03} position={[0, -0.02, 2.22]} receiveShadow>
        <meshStandardMaterial color="#080504" roughness={0.88} />
      </RoundedBox>
      <RoundedBox args={[4.65, 0.045, 0.065]} radius={0.025} position={[0, 2.42, 1.98]} receiveShadow>
        <meshStandardMaterial color="#d98a36" emissive="#d98a36" emissiveIntensity={0.08} roughness={0.52} metalness={0.22} transparent opacity={0.62} />
      </RoundedBox>
      <RoundedBox args={[1.18, 0.11, 1.38]} radius={0.055} position={[2.18, -0.045, 0.18]} rotation={[0, 0.04, 0]} receiveShadow>
        <meshStandardMaterial color="#2c170f" roughness={0.72} metalness={0.08} />
      </RoundedBox>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[2.17, 0.02, 0.18]}>
        <ringGeometry args={[0.48, 0.54, 48]} />
        <meshBasicMaterial color="#e06b4a" transparent opacity={0.18} depthWrite={false} />
      </mesh>
      <RoundedBox args={[0.92, 0.05, 0.08]} radius={0.03} position={[2.18, 0.06, -0.36]}>
        <meshStandardMaterial color="#d98a36" emissive="#d98a36" emissiveIntensity={0.18} roughness={0.48} />
      </RoundedBox>
      <RoundedBox args={[0.92, 0.05, 0.08]} radius={0.03} position={[2.18, 0.06, 0.72]}>
        <meshStandardMaterial color="#63d5c5" emissive="#63d5c5" emissiveIntensity={0.12} roughness={0.48} />
      </RoundedBox>

      <pointLight name="DebateRoom_Practical_Red" position={[-1.35, 1.35, 0.9]} intensity={3.2} color="#c54c32" />
      <pointLight name="DebateRoom_Practical_Teal" position={[1.55, 1.15, -0.65]} intensity={3} color="#45c7bd" />
      <pointLight name="DebateRoom_Threshold" position={[2.08, 0.58, 0.16]} intensity={1.8} color="#e06b4a" />
      <pointLight name="DebateRoom_TopSpot" position={[0, 2.32, 0.28]} intensity={5.6} color="#f3c172" />
      <pointLight name="DebateRoom_TopGlow" position={[0, 2.05, 0.1]} intensity={2.2} color="#f3c172" />

      <Text position={[2.18, 0.16, 0.18]} rotation={[-Math.PI / 2, 0, 0]} fontSize={0.08} color="#f3dfb6" anchorX="center" anchorY="middle" letterSpacing={0.14}>
        UMBRAL
      </Text>

      {[-1.8, -1.15, -0.5, 0.5, 1.15, 1.8].map((x, index) => (
        <group key={x} position={[x, 0.06, 1.58]}>
          <mesh castShadow>
            <cylinderGeometry args={[0.07, 0.095, 0.36, 12]} />
            <meshStandardMaterial color={index % 2 ? "#1b342f" : "#34150f"} roughness={0.72} />
          </mesh>
          <mesh position={[0, 0.24, 0]} castShadow>
            <sphereGeometry args={[0.105, 14, 10]} />
            <meshStandardMaterial color="#120907" roughness={0.9} />
          </mesh>
        </group>
      ))}

      <group position={[0, 0.02, DUEL_STAGE_Z]}>
        <DuelStage playerCharacter={playerCharacter} rivalCharacter={rivalCharacter} />
      </group>
    </group>
  );
}

function DebateEntrance() {
  return (
    <group name="Debate_Entrance" position={[-5.42, -1.08, -0.9]}>
      <RoundedBox args={[0.22, 2.18, 2.14]} radius={0.07} position={[0.02, 0.98, 0]} castShadow receiveShadow>
        <meshStandardMaterial color="#070504" roughness={0.96} metalness={0.08} />
      </RoundedBox>
      <RoundedBox args={[0.075, 1.54, 1.54]} radius={0.04} position={[0.14, 0.82, 0]} castShadow receiveShadow>
        <meshStandardMaterial color="#120806" roughness={0.96} emissive="#2c120b" emissiveIntensity={0.16} />
      </RoundedBox>
      <RoundedBox args={[0.13, 1.72, 0.07]} radius={0.025} position={[-0.02, 0.84, -0.98]} castShadow receiveShadow>
        <meshStandardMaterial color="#2b160d" roughness={0.64} metalness={0.12} />
      </RoundedBox>
      <RoundedBox args={[0.13, 1.72, 0.07]} radius={0.025} position={[-0.02, 0.84, 0.98]} castShadow receiveShadow>
        <meshStandardMaterial color="#2b160d" roughness={0.64} metalness={0.12} />
      </RoundedBox>
      <RoundedBox args={[0.14, 0.09, 2.0]} radius={0.035} position={[-0.02, 1.62, 0]} castShadow receiveShadow>
        <meshStandardMaterial color="#b47a34" emissive="#6b3518" emissiveIntensity={0.1} roughness={0.38} metalness={0.5} />
      </RoundedBox>
      <RoundedBox args={[0.86, 0.05, 1.48]} radius={0.04} position={[-0.42, 0.024, 0]} receiveShadow>
        <meshStandardMaterial color="#1d0f0a" roughness={0.82} metalness={0.06} />
      </RoundedBox>
      <RoundedBox args={[0.045, 0.05, 1.34]} radius={0.018} position={[-0.79, 0.09, 0]} receiveShadow>
        <meshStandardMaterial color="#e06b4a" emissive="#e06b4a" emissiveIntensity={0.22} roughness={0.46} />
      </RoundedBox>
      <RoundedBox args={[0.045, 0.05, 1.34]} radius={0.018} position={[-0.08, 0.09, 0]} receiveShadow>
        <meshStandardMaterial color="#63d5c5" emissive="#63d5c5" emissiveIntensity={0.14} roughness={0.46} />
      </RoundedBox>
      <mesh position={[-0.42, 0.105, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.42, 0.56, 48]} />
        <meshBasicMaterial color="#e06b4a" transparent opacity={0.18} depthWrite={false} />
      </mesh>
      <Text position={[0.18, 1.18, 0]} rotation={[0, Math.PI / 2, 0]} fontSize={0.062} color="#f3dfb6" anchorX="center" anchorY="middle" letterSpacing={0.15}>
        SALA DE
      </Text>
      <Text position={[0.18, 0.92, 0]} rotation={[0, Math.PI / 2, 0]} fontSize={0.054} color="#e06b4a" anchorX="center" anchorY="middle" letterSpacing={0.13}>
        CONFLICTO
      </Text>
      <Text position={[-0.42, 0.058, 0]} rotation={[-Math.PI / 2, 0, Math.PI / 2]} fontSize={0.052} color="#c99b58" anchorX="center" anchorY="middle" letterSpacing={0.14}>
        UMBRAL
      </Text>
      <pointLight position={[-0.32, 0.58, 0]} intensity={2.4} color="#e06b4a" />
    </group>
  );
}

// Edu: "sacá los 200 círculos que no sirven para nada". Ahora solo hay UN
// punto de luz sutil cuando estás parado sobre un hotspot; el hint de la
// esquina ya explica qué tecla apretar.
const HOTSPOT_DOTS = {
  table: [0, 0.06, 2.86],
  door: [0, 0.06, 3.62],
  bar: [0, 0.06, -3.06],
  ring: [-7.45, 0.06, -0.9]
};

function WalkHotspots({ activeHotspot }) {
  const position = HOTSPOT_DOTS[activeHotspot];
  if (!position) return null;
  return (
    <group name="Walk_Hotspots">
      <mesh position={position} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.18, 24]} />
        <meshBasicMaterial color="#f3dfb6" transparent opacity={0.32} depthWrite={false} />
      </mesh>
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

// ¡TRUCO! / ¡ENVIDO! como momento: texto gigante sobre la mesa + stinger de audio
function CantoVoice({ match }) {
  const [voice, setVoice] = useState(null);
  const groupRef = useRef(null);
  const prevRef = useRef({ envido: false, truco: false, bet: match.activeBet ?? 1, deal: false, responseKey: null, chaosId: null });

  // EL CAOS: cuando el Jugador Estrella baja una carta de Yu-Gi-Oh (group bonus)
  const chaosPlay = (match.tableCards ?? []).find((play) => play.group === "bonus");

  useEffect(() => {
    const prev = prevRef.current;
    let voiceNext = null;
    if (!prev.deal && match.agreementApplied) voiceNext = { text: "¡TRATO!", color: "#ffce6e" };
    if (!prev.envido && match.envidoPending) voiceNext = { text: "¡ENVIDO!", color: "#ffce6e" };
    if (!prev.truco && match.trucoPending) {
      const bet = match.activeBet ?? 1;
      voiceNext = { text: bet >= 3 ? "¡VALE CUATRO!" : bet === 2 ? "¡RETRUCO!" : "¡TRUCO!", color: "#ffce6e" };
    }

    // la RESPUESTA al canto, visible y clara (antes: "cantabas y no pasaba nada")
    const resp = match.trucoResponse;
    const responseKey = resp ? `${resp.responder}-${resp.label}-${resp.accepted}-${resp.raised ?? false}` : null;
    if (resp && responseKey !== prev.responseKey) {
      const lane = match.activeLane;
      const who = resp.responder === lane?.human?.team ? lane?.human?.name : lane?.rival?.name;
      const whoName = who ?? "El rival";
      if (resp.raised) {
        voiceNext = { text: `¡${(resp.raiseLabel ?? "RE").toUpperCase()}!`, color: "#ffce6e" };
      } else if (resp.accepted) {
        voiceNext = { text: "¡QUIERO!", color: "#8be29a", sub: `${whoName} juega. Vale ${resp.points ?? match.activeBet ?? 2}.` };
      } else {
        voiceNext = { text: "¡NO QUIERO!", color: "#f0776a", sub: `${whoName} se achica. Cobrás ${resp.points ?? 1}.` };
      }
    }

    // EL CAOS pisa cualquier otro canto: es EL momento del Estrella
    const chaosId = chaosPlay ? `${chaosPlay.id}-${chaosPlay.seatId}` : null;
    if (chaosPlay && chaosId !== prev.chaosId) {
      voiceNext = { text: `¡${chaosPlay.name.toUpperCase()}!`, color: "#c77dff", sub: `${chaosPlay.owner} rompe la mesa. Deciden los negociantes.`, chaos: true };
    }

    prevRef.current = {
      envido: !!match.envidoPending,
      truco: !!match.trucoPending,
      bet: match.activeBet ?? 1,
      deal: !!match.agreementApplied,
      responseKey: responseKey ?? prev.responseKey,
      chaosId: chaosId ?? prev.chaosId
    };
    if (voiceNext) {
      setVoice({ ...voiceNext, born: performance.now() });
      sfx.ensure();
      sfx.canto();
    }
  }, [match.envidoPending, match.trucoPending, match.activeBet, match.agreementApplied, match.trucoResponse, match.activeLane, chaosPlay]);

  useFrame(() => {
    if (!voice) return;
    const age = performance.now() - voice.born;
    if (age > (voice.chaos ? 3200 : 2400)) {
      setVoice(null);
      return;
    }
    if (groupRef.current) {
      // golpe de entrada con rebote, después respira
      const punch = age < 220 ? 0.4 + (age / 220) * 0.75 : 1.15 - Math.min(0.15, (age - 220) / 1400);
      groupRef.current.scale.setScalar(punch);
    }
  });

  if (!voice) return null;

  return (
    <Billboard position={[0, 0.85, 0.33]} follow>
      <group ref={groupRef}>
        <Text
          fontSize={0.52}
          color={voice.color ?? "#ffce6e"}
          anchorX="center"
          anchorY="middle"
          letterSpacing={0.06}
          outlineWidth={0.02}
          outlineColor="#2a0d05"
        >
          {voice.text}
        </Text>
        {voice.sub ? (
          <Text
            position={[0, -0.42, 0]}
            fontSize={0.17}
            color="#f4e7c8"
            anchorX="center"
            anchorY="middle"
            outlineWidth={0.01}
            outlineColor="#2a0d05"
          >
            {voice.sub}
          </Text>
        ) : null}
      </group>
    </Billboard>
  );
}

// ── caminantes remotos: los otros jugadores de la sala, en carne y hueso ────
function RemoteWalker({ peer, posRef }) {
  const groupRef = useRef(null);
  const speedRef = useRef(0);
  const modeRef = useRef("idle");
  const [animMode, setAnimMode] = useState("idle");
  const initial = posRef.current[peer.peerId];
  const allPlayers = [...teams.A, ...teams.B];
  const characterDef = allPlayers.find((player) => player.id === peer.characterId) ?? allPlayers[0];
  const skin = characterDef?.skinId ? characterSkins[characterDef.skinId] : null;

  useFrame((_, delta) => {
    const g = groupRef.current;
    const target = posRef.current[peer.peerId];
    if (!g || !target) return;
    const alpha = 1 - Math.exp(-Math.min(delta, 0.1) * 15);
    g.position.x += (target.x - g.position.x) * alpha;
    g.position.z += (target.z - g.position.z) * alpha;
    let deltaYaw = (target.yaw ?? 0) - g.rotation.y;
    while (deltaYaw > Math.PI) deltaYaw -= Math.PI * 2;
    while (deltaYaw < -Math.PI) deltaYaw += Math.PI * 2;
    g.rotation.y += deltaYaw * alpha;

    // el remoto camina/corre según cuánto le falta llegar a su target:
    // sin esto quedaba una estatua deslizándose por el piso
    let next = typeof target.mode === "string" ? target.mode : null;
    if (!next) {
      // peers con version vieja no mandan modo: inferirlo por movimiento
      const gap = Math.hypot(target.x - g.position.x, target.z - g.position.z);
      speedRef.current = speedRef.current * 0.85 + gap * 0.15;
      next = speedRef.current > 0.5 ? "run" : speedRef.current > 0.05 ? "walk" : "idle";
    }
    if (next !== modeRef.current) {
      modeRef.current = next;
      setAnimMode(next);
    }
  });

  if (!initial) return null;

  return (
    <group ref={groupRef} position={[initial.x, 0.02, initial.z]}>
      <Suspense fallback={null}>
        <CharacterFigure
          skin={skin}
          accent={characterDef?.accent ?? "#91e9f6"}
          isActiveLane={false}
          animationMode={animMode}
          animationClipMap={skin?.animationClipMap ?? {}}
          animationTimeScaleMap={skin?.animationTimeScaleMap ?? {}}
        />
      </Suspense>
      <Billboard position={[0, 2.1, 0]} follow>
        <Text fontSize={0.12} color="#91e9f6" anchorX="center" anchorY="middle" letterSpacing={0.08} outlineWidth={0.008} outlineColor="#04222a">
          {peer.name}
        </Text>
      </Billboard>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <ringGeometry args={[0.3, 0.38, 24]} />
        <meshBasicMaterial color="#91e9f6" transparent opacity={0.3} depthWrite={false} />
      </mesh>
    </group>
  );
}

function RemoteWalkers({ walkers, posRef }) {
  return (
    <group name="Remote_Walkers">
      {walkers.map((peer) => (
        <RemoteWalker key={peer.peerId} peer={peer} posRef={posRef} />
      ))}
    </group>
  );
}

const ROOM_OFFSET = { x: 0, y: -1.35, z: 0.25 };

function getOwnSeat(match) {
  return tableSeats.find((seat) => seat.team === "A" && seat.role === match.selectedRole) ?? tableSeats[0];
}

function getSeatWorld(seat) {
  return {
    x: seat.position[0] + ROOM_OFFSET.x,
    y: seat.position[1] + ROOM_OFFSET.y,
    z: seat.position[2] + ROOM_OFFSET.z
  };
}

function getActiveTurnSeat(match) {
  const seatId = match.nextActorSeatId ?? match.currentTurnSeatId;
  return tableSeats.find((seat) => seat.seatId === seatId) ?? null;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

// OJO: estas son las coords del ring DENTRO del group "Room_Runtime", que está
// desplazado. <DebateRoom> se monta ahí con este mismo position, pero la cámara
// trabaja en WORLD: hay que sumarle el offset del group o la cámara termina por
// encima del techo del ring y sólo se ve negro.
const ROOM_RUNTIME_OFFSET = { x: 0, y: -1.35, z: 0.25 };
const RING_WORLD_ORIGIN = { x: -7.45, y: -1.14, z: -0.9 };
const RING_ORIGIN_WORLD = {
  x: RING_WORLD_ORIGIN.x + ROOM_RUNTIME_OFFSET.x,
  y: RING_WORLD_ORIGIN.y + ROOM_RUNTIME_OFFSET.y,
  z: RING_WORLD_ORIGIN.z + ROOM_RUNTIME_OFFSET.z
};

// Plano de duelo: cámara fija a la altura del pecho, con la mesa y el
// revólver al centro y los dos egos de perfil. El pasillo lateral
// (SideRoom_*) atraviesa esta sala: en modo ring no se dibuja.
const DUEL_STAGE_Z = -0.2;

function getRingCameraPose(isNarrow) {
  return {
    position: [
      RING_ORIGIN_WORLD.x,
      RING_ORIGIN_WORLD.y + (isNarrow ? 1.08 : 1.0),
      RING_ORIGIN_WORLD.z + (isNarrow ? 1.95 : 1.7)
    ],
    target: [RING_ORIGIN_WORLD.x, RING_ORIGIN_WORLD.y + (isNarrow ? 0.6 : 0.64), RING_ORIGIN_WORLD.z + DUEL_STAGE_Z - 0.05],
    fov: isNarrow ? 62 : 44
  };
}

function getCameraPose({ match, isNarrow, cameraView }) {
  const isRoleSelect = match.phase === "role-select";
  const ownSeat = getOwnSeat(match);
  const ownSeatWorld = getSeatWorld(ownSeat);

  // La vista por defecto ("table") durante la mano se comporta como "seat":
  // las cartas SIEMPRE se ven sostenidas en primera persona, nunca en angulo
  // cenital/aereo (pedido tajante del usuario). En role-select "table" mantiene
  // su encuadre propio (mesa completa).
  const view = cameraView === "table" && !isRoleSelect ? "seat" : cameraView;

  if (view === "entry") {
    return {
      position: isNarrow ? [0, 2.95, 9.2] : [0, 2.65, 9.85],
      target: [0, -0.74, -0.45],
      fov: isNarrow ? 46 : 42
    };
  }

  if (view === "seat") {
    // Liar's Bar framing: seated eye-level at your own chair, the rivals'
    // faces across the felt. The gaze drifts toward whoever is acting.
    const sx = ownSeatWorld.x;
    const sz = ownSeatWorld.z;
    const len = Math.hypot(sx, sz) || 1;
    const inX = -sx / len;
    const inZ = -sz / len;
    const eyeX = sx + inX * 0.06;
    const eyeZ = sz + inZ * 0.06;
    const selectedSkin = match.selectedCharacter?.skinId ? characterSkins[match.selectedCharacter.skinId] : null;
    const characterHeight = selectedSkin?.modelTargetHeight ?? 1.78;
    // Pelvis local 0.59 + ~40% de altura hasta los ojos + offset del Room.
    // La cámara anterior (0.62) flotaba muy por encima de todos los sentados.
    const eyeY = ROOM_OFFSET.y + 0.59 + characterHeight * 0.4 + 0.035;

    // static gaze at the table heart — the player looks around by dragging,
    // the camera never wanders on its own (pedido explícito del usuario)
    return {
      position: [eyeX, eyeY, eyeZ],
      // en vertical el fov ve mucho techo: la mirada baja hacia el fieltro
      target: [-sx * 0.2, eyeY - (isNarrow ? 0.6 : 0.08), -sz * 0.2],
      fov: isNarrow ? 68 : 47
    };
  }

  if (view === "ring") {
    return getRingCameraPose(isNarrow);
  }

  // ANTESALA: plano héroe. La cámara se para del lado de la mesa y mira al
  // personaje elegido a la altura del pecho; el borde de la mesa queda en
  // primer plano. En desktop el panel ocupa la derecha, así que el héroe se
  // corre al tercio izquierdo; en el teléfono la hoja ocupa abajo y el héroe
  // sube al tercio superior.
  if (isRoleSelect && view === "table") {
    const heroSeat = tableSeats.find((seat) => seat.playerId === match.selectedCharacter?.id) ?? ownSeat;
    const hero = getSeatWorld(heroSeat);
    const radius = Math.hypot(hero.x - ROOM_OFFSET.x, hero.z - ROOM_OFFSET.z) || 1;
    const inX = -(hero.x - ROOM_OFFSET.x) / radius;
    const inZ = -(hero.z - ROOM_OFFSET.z) / radius;
    const distance = isNarrow ? 3.35 : 2.9;
    // derecha de pantalla vista desde la cámara (mirando hacia -in)
    const sideX = inZ;
    const sideZ = -inX;
    const side = isNarrow ? 0 : 0.62;
    const chestY = hero.y + 1.12;
    return {
      position: [hero.x + inX * distance, chestY + (isNarrow ? 0.18 : 0.12), hero.z + inZ * distance],
      target: [hero.x + sideX * side, chestY - (isNarrow ? 0.52 : 0.08), hero.z + sideZ * side],
      fov: isNarrow ? 52 : 40
    };
  }

  const activeSeat = !isRoleSelect && match.handStarted && !match.handClosed ? getActiveTurnSeat(match) : null;
  if (activeSeat) {
    const activeSeatWorld = getSeatWorld(activeSeat);
    const focusX = clamp(activeSeatWorld.x * 0.34, -1.05, 1.05);
    const focusZ = clamp(activeSeatWorld.z * 0.32, -0.96, 1.05);

    return {
      position: isNarrow
        ? [focusX * 0.35, 4.62, 6.9 + focusZ * 0.22]
        : [focusX * 0.46, 4.0, 5.46 + focusZ * 0.18],
      target: [focusX, 0.2, focusZ],
      fov: isNarrow ? 36 : 33
    };
  }

  return {
    position: isNarrow
      ? isRoleSelect
        ? [0, 5.7, 7.85]
        : [0, 4.75, 6.95]
      : isRoleSelect
        ? [0.35, 5.05, 6.75]
        : [0, 4.05, 5.55],
    // La mesa vive dentro de Room_Runtime (y -1.35). Este target está en WORLD:
    // apuntar a y positiva mostraba sólo techo y una pantalla inicial negra.
    target: [0, isRoleSelect ? -1.05 : 0.16, isRoleSelect ? -0.15 : isNarrow ? 0.2 : 0.02],
    fov: isNarrow ? (isRoleSelect ? 50 : 36) : isRoleSelect ? 40 : 33
  };
}

export function TrucolocoScene({
  match,
  netRoster = [],
  remoteWalkers = [],
  remotePosRef,
  onWalkerMove,
  cameraView = "table",
  selectedWalkCharacter,
  performanceMode = "high",
  walkHotspot,
  walkTouchInput,
  onWalkHotspotChange,
  onWalkInteract,
  onWalkAnimationDebugChange
}) {
  const modId = match.activeModifier?.id ?? "";
  const modTitle = match.activeModifier?.title ?? "";
  const { camera, size } = useThree();
  const isClassic = modId === "modo-clasico";
  const isRoleSelect = match.phase === "role-select";
  const isNarrow = size.width < 640;
  const isWalkMode = cameraView === "walk";
  const isRingMode = cameraView === "ring";
  const quality = tierIndex(performanceMode);
  const lowPower = isLowPower(performanceMode);
  // Sin sombras la escena se apaga: el tier bajo/medio compensa con ambiente.
  const shadowsOn = quality >= 2;
  const contactShadowsOn = quality >= 1;
  const debatePlayerCharacter = selectedWalkCharacter ?? match.selectedCharacter ?? match.activeLane.human;
  const debateRivalCharacter = match.activeLane.rival;
  const ringShakeRef = useRef(0);
  useEffect(() => {
    let lastSeq = -1;
    return duelStore.subscribe(() => {
      const duel = duelStore.get();
      if (!duel || duel.seq === lastSeq) return;
      lastSeq = duel.seq;
      if (duel.lastPull?.kind === "corchazo") ringShakeRef.current = 0.09;
      else if (duel.lastPull?.kind === "click") ringShakeRef.current = 0.018;
    });
  }, []);
  const cameraTargetRef = useRef(new Vector3(0, 0.16, 0.02));
  const targetLookAtRef = useRef(new Vector3(0, 0.16, 0.02));
  const seatLookRef = useRef({ yaw: 0, pitch: 0 });

  // seated free-look: drag on empty space swivels your head (clicks on cards still play)
  const { gl } = useThree();
  useEffect(() => {
    if (cameraView !== "seat") return undefined;
    const el = gl.domElement;
    let dragging = false;
    let lastX = 0;
    let lastY = 0;
    const down = (event) => {
      if (event.button !== 0) return;
      dragging = true;
      lastX = event.clientX;
      lastY = event.clientY;
    };
    const move = (event) => {
      if (!dragging) return;
      const dx = event.clientX - lastX;
      const dy = event.clientY - lastY;
      lastX = event.clientX;
      lastY = event.clientY;
      const look = seatLookRef.current;
      look.yaw = Math.max(-1.35, Math.min(1.35, look.yaw - dx * 0.0042));
      look.pitch = Math.max(-0.28, Math.min(0.22, look.pitch + dy * 0.0026));
    };
    const up = () => {
      dragging = false;
    };
    // la cámara nunca se recentra sola (pedido de Edu): doble toque = "mirá la mesa"
    const recenter = () => {
      seatLookRef.current = { yaw: 0, pitch: 0 };
    };
    el.addEventListener("dblclick", recenter);
    el.addEventListener("pointerdown", down);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      el.removeEventListener("dblclick", recenter);
      el.removeEventListener("pointerdown", down);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      seatLookRef.current = { yaw: 0, pitch: 0 };
    };
  }, [cameraView, gl]);

  useFrame((state, delta) => {
    if (isWalkMode) return;

    const cameraPose = getCameraPose({ match, isNarrow, cameraView });
    const activeTurnSeat = getActiveTurnSeat(match);
    const [targetX, targetY, targetZ] = cameraPose.position;
    const targetLookAt = targetLookAtRef.current.set(...cameraPose.target);

    // seated free-look: swivel the gaze around the eye by the dragged offset
    if (cameraView === "seat") {
      const look = seatLookRef.current;
      if (look.yaw !== 0 || look.pitch !== 0) {
        const ex = cameraPose.position[0];
        const ey = cameraPose.position[1];
        const ez = cameraPose.position[2];
        const dx = targetLookAt.x - ex;
        const dy = targetLookAt.y - ey;
        const dz = targetLookAt.z - ez;
        const cos = Math.cos(look.yaw);
        const sin = Math.sin(look.yaw);
        const rx = dx * cos - dz * sin;
        const rz = dx * sin + dz * cos;
        const flat = Math.hypot(dx, dz);
        targetLookAt.set(ex + rx, ey + dy + look.pitch * flat, ez + rz);
      }
    }
    const cameraSpeed = cameraView === "ring" ? 8.2 : cameraView === "seat" ? 4.7 : 3.45;
    const targetSpeed = cameraView === "ring" ? 8.8 : 5.2;
    const cameraAlpha = 1 - Math.exp(-Math.min(delta, 0.12) * cameraSpeed);
    const targetAlpha = 1 - Math.exp(-Math.min(delta, 0.12) * targetSpeed);

    if (
      !Number.isFinite(camera.position.x) ||
      !Number.isFinite(camera.position.y) ||
      !Number.isFinite(camera.position.z) ||
      Math.abs(camera.position.x) > 100 ||
      Math.abs(camera.position.y) > 100 ||
      Math.abs(camera.position.z) > 100
    ) {
      camera.position.set(targetX, targetY, targetZ);
      cameraTargetRef.current.copy(targetLookAt);
    } else {
      // [VISUAL] Smooth both camera position and gaze target so view changes feel intentional, not floaty.
      camera.position.x += (targetX - camera.position.x) * cameraAlpha;
      camera.position.y += (targetY - camera.position.y) * cameraAlpha;
      camera.position.z += (targetZ - camera.position.z) * cameraAlpha;
      cameraTargetRef.current.lerp(targetLookAt, targetAlpha);
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

    camera.lookAt(cameraTargetRef.current);

    if (import.meta.env.DEV && typeof window !== "undefined") {
      window.__TRUCOLOCO_CAMERA_DEBUG__ = {
        activeSeatId: activeTurnSeat?.seatId ?? null,
        position: [camera.position.x, camera.position.y, camera.position.z],
        target: [cameraTargetRef.current.x, cameraTargetRef.current.y, cameraTargetRef.current.z]
      };
    }
  });

  return (
    <>
      <RenderEnvironment />
      <ambientLight intensity={lowPower ? 0.24 : 0.18} color="#9d6b45" />
      <hemisphereLight intensity={lowPower ? 0.36 : 0.28} color="#dba66e" groundColor="#070b08" />
      <ModifierAmbientFX
        modId={modId}
        handClosed={match.handClosed}
        outcomeTone={match.outcomeTone}
        lowPower={lowPower}
        shadowsOn={shadowsOn}
        shadowMapSize={quality >= 3 ? 2048 : quality >= 2 ? 1024 : 512}
      />

      {/* mano 3D sostenida: en silla y tambien en la vista por defecto (table)
          durante la mano — las cartas nunca se muestran en angulo cenital */}
      {(cameraView === "seat" || cameraView === "table") && !isRoleSelect ? (
        <Suspense fallback={null}>
          <HeldHand match={match} />
        </Suspense>
      ) : null}

      {!isRingMode ? <CantoVoice match={match} /> : null}

      <group name="Room_Runtime" position={[0, -1.35, 0.25]}>
        <RoundedBox name="Floor_Antro" args={[14, 0.4, 10]} radius={0.18} position={[0, -1.9, 0]} receiveShadow>
          <meshStandardMaterial color={BAR_COLORS.floor} roughness={0.94} metalness={0.05} />
        </RoundedBox>

        <MainRoomShell hideSideRoom={isRingMode} />

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

        <BackBarDressing lowPower={lowPower} />
        <BarRoom />
        {isWalkMode ? <DebateEntrance /> : null}
        {isRingMode ? (
          <DebateRoom
            playerCharacter={debatePlayerCharacter}
            rivalCharacter={debateRivalCharacter}
          />
        ) : null}
        {!lowPower ? <RoomAccents /> : null}

        {!isRingMode ? <TableLightCone isClassic={isClassic} /> : null}
        <BarAtmosphere active={isWalkMode || isRingMode || !isRoleSelect} lowPower={lowPower} />

        {!isRingMode ? (
          <>
            {contactShadowsOn ? (
              <ContactShadows
                name="Table_ContactShadows"
                position={[0, -1.66, 0.04]}
                scale={[7.4, 7.4]}
                opacity={0.42}
                blur={2.7}
                far={3.2}
                resolution={512}
                color="#050302"
                frames={1}
              />
            ) : null}
            <Table match={match} performanceMode={performanceMode} />
            <TeamsAroundTable match={match} cameraView={cameraView} performanceMode={performanceMode} netRoster={netRoster} />
            {cameraView === "seat" ? <SeatViewFocus match={match} /> : null}
            {isWalkMode ? <WalkHotspots activeHotspot={walkHotspot} lowPower={lowPower} /> : null}
            {remoteWalkers.length ? <RemoteWalkers walkers={remoteWalkers} posRef={remotePosRef} /> : null}
            <WalkablePlayer
              enabled={isWalkMode}
              onMove={onWalkerMove}
              character={selectedWalkCharacter}
              virtualInput={walkTouchInput}
              onHotspotChange={onWalkHotspotChange}
              onInteract={onWalkInteract}
              onAnimationDebugChange={onWalkAnimationDebugChange}
            />

            <AnimatedLamp modId={modId} />
            <ModifierWallTag modId={modId} modTitle={modTitle} hidden={isNarrow} />
          </>
        ) : null}
      </group>
    </>
  );
}
