import { useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { RoundedBox, Text } from "@react-three/drei";

const BAR = {
  wood: "#2b160d",
  woodDark: "#140b08",
  brass: "#b47a34",
  curtain: "#1b0d0a",
  curtainDeep: "#0c0706",
  wallTrim: "#3b2819",
  bottleGreen: "#244737",
  bottleAmber: "#5b3519",
  bottleBlue: "#1e3a43"
};

function FloorPlanks() {
  return (
    <group name="World_FloorPlanks" position={[0, -0.02, 0]}>
      {Array.from({ length: 13 }, (_, index) => {
        const z = -3.9 + index * 0.64;
        const color = index % 2 === 0 ? "#26140d" : "#1b100c";

        return (
          <RoundedBox key={index} args={[10.6, 0.018, 0.034]} radius={0.006} position={[0, -1.98, z]}>
            <meshStandardMaterial color={color} roughness={0.88} metalness={0.03} />
          </RoundedBox>
        );
      })}
      {[-4.9, -2.45, 0, 2.45, 4.9].map((x) => (
        <RoundedBox key={x} args={[0.022, 0.02, 7.7]} radius={0.006} position={[x, -1.975, -0.05]}>
          <meshStandardMaterial color="#100907" roughness={0.9} />
        </RoundedBox>
      ))}
    </group>
  );
}

function CurtainWall({ side }) {
  const x = side === "left" ? -5.29 : 5.29;
  const sign = side === "left" ? -1 : 1;
  const isLeft = side === "left";

  return (
    <group name={`World_Curtain_${side}`} position={[x, 0.55, -0.4]} rotation={[0, Math.PI / 2, 0]}>
      {isLeft ? (
        <>
          <RoundedBox args={[2.32, 3.45, 0.08]} radius={0.045} position={[-2.34, 0, 0]} receiveShadow>
            <meshStandardMaterial color={BAR.curtainDeep} roughness={0.98} />
          </RoundedBox>
          <RoundedBox args={[2.18, 3.45, 0.08]} radius={0.045} position={[2.42, 0, 0]} receiveShadow>
            <meshStandardMaterial color={BAR.curtainDeep} roughness={0.98} />
          </RoundedBox>
        </>
      ) : (
        <RoundedBox args={[7.0, 3.45, 0.08]} radius={0.045} receiveShadow>
          <meshStandardMaterial color={BAR.curtainDeep} roughness={0.98} />
        </RoundedBox>
      )}
      {Array.from({ length: 8 }, (_, index) => {
        const foldX = -3.05 + index * 0.86;
        if (isLeft && foldX > -1.12 && foldX < 1.04) return null;

        return (
        <RoundedBox
          key={index}
          args={[0.06, 3.28, 0.07]}
          radius={0.022}
          position={[foldX, 0, -0.045]}
          receiveShadow
        >
          <meshStandardMaterial color={index % 2 === 0 ? BAR.curtain : "#27110d"} roughness={0.96} />
        </RoundedBox>
        );
      })}
      <RoundedBox args={[7.05, 0.08, 0.12]} radius={0.025} position={[0, 1.76, -0.07]}>
        <meshStandardMaterial color={BAR.brass} roughness={0.42} metalness={0.55} />
      </RoundedBox>
      <pointLight position={[0.15 * sign, 0.85, -0.35]} intensity={3.4} color={side === "left" ? "#d25b3e" : "#3ebfb3"} />
    </group>
  );
}

function BackCounter() {
  const bottleColors = [BAR.bottleGreen, BAR.bottleAmber, BAR.bottleBlue, "#4f2118", "#302a15"];

  return (
    <group name="World_BackCounter">
      <RoundedBox args={[6.7, 0.7, 0.62]} radius={0.08} position={[0, -1.15, -3.58]} castShadow receiveShadow>
        <meshStandardMaterial color={BAR.wood} roughness={0.74} metalness={0.06} />
      </RoundedBox>
      <RoundedBox args={[6.9, 0.12, 0.72]} radius={0.04} position={[0, -0.73, -3.58]} castShadow receiveShadow>
        <meshStandardMaterial color="#3c2112" roughness={0.58} metalness={0.08} />
      </RoundedBox>
      <RoundedBox args={[6.5, 0.04, 0.08]} radius={0.012} position={[0, -0.66, -3.2]}>
        <meshStandardMaterial color={BAR.brass} roughness={0.34} metalness={0.62} />
      </RoundedBox>

      {[-1.1, 0.08, 1.22].map((y, row) => (
        <group key={y} position={[0, y, -3.93]}>
          <RoundedBox args={[5.8, 0.065, 0.16]} radius={0.016}>
            <meshStandardMaterial color={BAR.woodDark} roughness={0.72} />
          </RoundedBox>
          {[-2.72, -1.36, 0, 1.36, 2.72].map((x) => (
            <RoundedBox key={`bracket-${x}`} args={[0.055, 0.26, 0.075]} radius={0.012} position={[x, -0.16, 0.02]} castShadow receiveShadow>
              <meshStandardMaterial color="#120907" roughness={0.74} metalness={0.08} />
            </RoundedBox>
          ))}
          {Array.from({ length: 10 }, (_, index) => {
            const x = -2.45 + index * 0.55 + (row % 2) * 0.16;
            const height = 0.28 + ((row + index) % 3) * 0.09;
            const color = bottleColors[(row + index) % bottleColors.length];

            return (
              <group key={index} position={[x, 0.18, 0.1]}>
                <mesh castShadow>
                  <cylinderGeometry args={[0.045, 0.06, height, 10]} />
                  <meshStandardMaterial color={color} roughness={0.35} transparent opacity={0.78} />
                </mesh>
                <mesh position={[0, height * 0.5 + 0.055, 0]} castShadow>
                  <cylinderGeometry args={[0.02, 0.026, 0.11, 8]} />
                  <meshStandardMaterial color="#0d0806" roughness={0.5} />
                </mesh>
              </group>
            );
          })}
        </group>
      ))}
    </group>
  );
}

function RoomSeams() {
  return (
    <group name="World_RoomSeams">
      <RoundedBox args={[10.9, 0.12, 0.12]} radius={0.025} position={[0, -1.72, -4.0]} receiveShadow>
        <meshStandardMaterial color="#090504" roughness={0.86} />
      </RoundedBox>
      <RoundedBox args={[0.12, 0.12, 8.2]} radius={0.025} position={[-5.18, -1.72, 0.05]} receiveShadow>
        <meshStandardMaterial color="#090504" roughness={0.86} />
      </RoundedBox>
      <RoundedBox args={[0.12, 0.12, 8.2]} radius={0.025} position={[5.18, -1.72, 0.05]} receiveShadow>
        <meshStandardMaterial color="#090504" roughness={0.86} />
      </RoundedBox>
      <RoundedBox args={[10.8, 0.16, 0.12]} radius={0.025} position={[0, 2.72, -3.96]}>
        <meshStandardMaterial color={BAR.wallTrim} roughness={0.76} />
      </RoundedBox>
      <RoundedBox args={[0.12, 0.16, 7.8]} radius={0.025} position={[-5.18, 2.72, -0.08]}>
        <meshStandardMaterial color={BAR.wallTrim} roughness={0.76} />
      </RoundedBox>
      <RoundedBox args={[0.12, 0.16, 7.8]} radius={0.025} position={[5.18, 2.72, -0.08]}>
        <meshStandardMaterial color={BAR.wallTrim} roughness={0.76} />
      </RoundedBox>
    </group>
  );
}

function BoothSilhouettes() {
  return (
    <group name="World_BoothSilhouettes">
      {[-3.8, 3.8].map((x, index) => (
        <group key={x} position={[x, -1.58, 2.72]} rotation={[0, x < 0 ? -0.35 : 0.35, 0]}>
          <RoundedBox args={[1.28, 0.24, 0.76]} radius={0.08} castShadow receiveShadow>
            <meshStandardMaterial color={index === 0 ? "#24120e" : "#131d1b"} roughness={0.92} />
          </RoundedBox>
          <RoundedBox args={[1.18, 0.94, 0.18]} radius={0.06} position={[0, 0.48, 0.29]} castShadow receiveShadow>
            <meshStandardMaterial color={index === 0 ? "#301611" : "#172824"} roughness={0.96} />
          </RoundedBox>
          <mesh position={[-0.36, 0.76, 0.03]} castShadow>
            <sphereGeometry args={[0.12, 12, 10]} />
            <meshStandardMaterial color="#070504" roughness={0.9} />
          </mesh>
          <mesh position={[0.26, 0.7, 0.03]} castShadow>
            <sphereGeometry args={[0.1, 12, 10]} />
            <meshStandardMaterial color="#080605" roughness={0.9} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function EntryPortal() {
  return (
    <group name="World_EntryPortal" position={[0, -0.22, 4.06]}>
      <RoundedBox args={[2.2, 2.75, 0.22]} radius={0.08} receiveShadow>
        <meshStandardMaterial color="#0a0605" roughness={0.92} />
      </RoundedBox>
      <RoundedBox args={[1.54, 2.24, 0.08]} radius={0.04} position={[0, -0.06, 0.08]}>
        <meshStandardMaterial color="#070404" roughness={0.98} emissive="#4d210f" emissiveIntensity={0.14} />
      </RoundedBox>
      <RoundedBox args={[1.84, 0.09, 0.16]} radius={0.025} position={[0, 1.18, 0.16]}>
        <meshStandardMaterial color={BAR.brass} roughness={0.34} metalness={0.52} />
      </RoundedBox>
      <pointLight position={[0, 0.4, 0.54]} intensity={5.2} color="#d35f2d" />
      <Text position={[0, 1.42, 0.17]} fontSize={0.095} color="#d0a15d" anchorX="center" anchorY="middle" letterSpacing={0.16}>
        ENTRADA
      </Text>
    </group>
  );
}

function CeilingBeams() {
  return (
    <group name="World_CeilingBeams">
      {[-3.1, -1.55, 0, 1.55, 3.1].map((x) => (
        <RoundedBox key={x} args={[0.09, 0.1, 7.1]} radius={0.02} position={[x, 4.18, -0.42]} receiveShadow>
          <meshStandardMaterial color="#20120c" roughness={0.86} />
        </RoundedBox>
      ))}
      <RoundedBox args={[10.8, 0.08, 0.12]} radius={0.022} position={[0, 4.05, -3.82]}>
        <meshStandardMaterial color={BAR.wallTrim} roughness={0.72} />
      </RoundedBox>
    </group>
  );
}


// ── pase de arte (Claude): techo, frente, neón, alfombra, lámparas, humo ─────

function CeilingPlane() {
  return (
    <group name="World_Ceiling">
      <mesh position={[0, 4.32, -0.4]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[11.2, 8.6]} />
        <meshStandardMaterial color="#150c08" roughness={0.96} />
      </mesh>
    </group>
  );
}

function FrontWall() {
  return (
    <group name="World_FrontWall" position={[0, 0.55, 4.18]}>
      <RoundedBox args={[4.1, 5.2, 0.18]} radius={0.05} position={[-3.45, 0.5, 0]} receiveShadow>
        <meshStandardMaterial color="#0e0806" roughness={0.97} />
      </RoundedBox>
      <RoundedBox args={[4.1, 5.2, 0.18]} radius={0.05} position={[3.45, 0.5, 0]} receiveShadow>
        <meshStandardMaterial color="#0e0806" roughness={0.97} />
      </RoundedBox>
      <RoundedBox args={[11, 1.6, 0.18]} radius={0.05} position={[0, 2.5, 0]} receiveShadow>
        <meshStandardMaterial color="#0e0806" roughness={0.97} />
      </RoundedBox>
    </group>
  );
}

// el cartel del antro: neón cálido con parpadeo de tubo viejo
function NeonSign() {
  const textRef = useRef(null);
  const lightRef = useRef(null);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    // parpadeo de neón barato: casi siempre pleno, cada tanto tiembla
    const flicker = Math.sin(t * 31) > 0.96 || Math.sin(t * 7.3 + 2) > 0.995 ? 0.35 : 1;
    if (textRef.current) textRef.current.fillOpacity = 0.92 * flicker;
    if (lightRef.current) lightRef.current.intensity = 6.2 * flicker;
  });

  return (
    <group name="World_NeonSign" position={[0, 2.05, -3.86]}>
      <Text
        ref={textRef}
        fontSize={0.56}
        color="#ff5c3a"
        anchorX="center"
        anchorY="middle"
        letterSpacing={0.24}
        outlineWidth={0.016}
        outlineColor="#5e130a"
        outlineOpacity={0.9}
      >
        TRUCOLOCO
      </Text>
      <pointLight ref={lightRef} position={[0, -0.1, 0.7]} intensity={6.2} distance={7} color="#ff6a3c" />
    </group>
  );
}

function TableRug() {
  return (
    <group name="World_TableRug" position={[0, -1.955, 0.25]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[4.35, 56]} />
        <meshStandardMaterial color="#2a0f0d" roughness={0.98} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.004, 0]}>
        <ringGeometry args={[3.85, 4.1, 56]} />
        <meshStandardMaterial color="#7a4a1e" roughness={0.85} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.004, 0]}>
        <ringGeometry args={[3.1, 3.2, 56]} />
        <meshStandardMaterial color="#53200f" roughness={0.9} />
      </mesh>
    </group>
  );
}

function BarLamps() {
  return (
    <group name="World_BarLamps">
      {[-2.2, 0, 2.2].map((x) => (
        <group key={x} position={[x, 2.9, -3.35]}>
          <mesh position={[0, 0.62, 0]}>
            <cylinderGeometry args={[0.012, 0.012, 1.3, 6]} />
            <meshStandardMaterial color="#0a0705" roughness={0.8} />
          </mesh>
          <mesh castShadow>
            <coneGeometry args={[0.22, 0.24, 18, 1, true]} />
            <meshStandardMaterial color="#241209" roughness={0.6} metalness={0.25} />
          </mesh>
          <mesh position={[0, -0.06, 0]}>
            <sphereGeometry args={[0.07, 12, 10]} />
            <meshStandardMaterial color="#ffd9a0" emissive="#ffb45e" emissiveIntensity={2.6} />
          </mesh>
          <pointLight position={[0, -0.2, 0]} intensity={2.8} distance={4.5} color="#ffb45e" />
          {/* cono de luz falso: volumetría barata */}
          <mesh position={[0, -0.85, 0]}>
            <coneGeometry args={[0.72, 1.6, 20, 1, true]} />
            <meshBasicMaterial color="#ffb45e" transparent opacity={0.045} depthWrite={false} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

// ── MÁQUINA DE HUMO — clickeable: escupe humo y enturbia el antro ~20s ──────
function SmokeMachine() {
  const { scene } = useThree();
  const burstAtRef = useRef(0);
  const pendingRef = useRef(false);
  const puffsRef = useRef(
    Array.from({ length: 26 }, (_, i) => ({ seed: i * 137.5, ref: null }))
  );
  const lightRef = useRef(null);
  const fogBase = useRef(null);

  useFrame((state) => {
    const now = state.clock.elapsedTime;
    if (pendingRef.current) {
      pendingRef.current = false;
      burstAtRef.current = now;
    }
    const since = burstAtRef.current ? now - burstAtRef.current : Infinity;
    const active = since < 20;

    // el fog del antro respira: denso al tirar humo, se disipa gradual
    if (scene.fog) {
      if (!fogBase.current) fogBase.current = { near: scene.fog.near, far: scene.fog.far };
      const k = active ? Math.max(0, 1 - since / 20) : 0;
      const ease = k * k;
      scene.fog.near = fogBase.current.near - (fogBase.current.near - 1.6) * ease;
      scene.fog.far = fogBase.current.far - (fogBase.current.far - 7.5) * ease;
    }

    if (lightRef.current) {
      lightRef.current.material.emissiveIntensity = active ? 0.2 + Math.sin(now * 20) * 0.15 : 1.4;
      lightRef.current.material.emissive.set(active ? "#3aff6a" : "#ff2e1f");
    }

    for (const puff of puffsRef.current) {
      const m = puff.ref;
      if (!m) continue;
      if (!active) {
        m.visible = false;
        continue;
      }
      const life = ((since * 0.55 + puff.seed) % 4) / 4;
      const spread = life * 2.6;
      m.visible = true;
      m.position.set(
        Math.sin(puff.seed) * spread * 0.8,
        0.25 + life * 1.7,
        0.3 + Math.cos(puff.seed * 1.7) * spread * 0.5 + life * 1.4
      );
      const grow = 0.18 + life * 1.15;
      m.scale.setScalar(grow);
      m.material.opacity = 0.16 * (1 - life) * Math.min(1, since / 1.2);
    }
  });

  return (
    <group
      name="World_SmokeMachine"
      position={[-4.35, -1.72, -3.3]}
      rotation={[0, 0.6, 0]}
      onClick={(event) => {
        event.stopPropagation();
        pendingRef.current = true;
      }}
      onPointerOver={() => (document.body.style.cursor = "pointer")}
      onPointerOut={() => (document.body.style.cursor = "auto")}
    >
      <RoundedBox args={[0.62, 0.34, 0.4]} radius={0.05} castShadow receiveShadow>
        <meshStandardMaterial color="#141312" roughness={0.55} metalness={0.5} />
      </RoundedBox>
      <mesh position={[0.18, 0.06, 0.21]} rotation={[Math.PI / 2.6, 0, 0]}>
        <cylinderGeometry args={[0.055, 0.075, 0.16, 12]} />
        <meshStandardMaterial color="#0c0b0a" roughness={0.4} metalness={0.6} />
      </mesh>
      <mesh ref={lightRef} position={[-0.2, 0.1, 0.201]}>
        <boxGeometry args={[0.05, 0.05, 0.02]} />
        <meshStandardMaterial color="#1a0505" emissive="#ff2e1f" emissiveIntensity={1.4} />
      </mesh>
      <Text position={[0, 0.28, 0.1]} fontSize={0.075} color="#8f7755" anchorX="center" anchorY="middle" letterSpacing={0.1}>
        HUMO
      </Text>
      {puffsRef.current.map((puff, index) => (
        <mesh key={index} ref={(node) => (puff.ref = node)} visible={false} position={[0, 0.3, 0.3]}>
          <sphereGeometry args={[0.5, 10, 8]} />
          <meshBasicMaterial color="#b9a98f" transparent opacity={0} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
}

export function BarRoom() {
  return (
    <group name="World_BarRoom">
      <FloorPlanks />
      <CurtainWall side="left" />
      <CurtainWall side="right" />
      <BackCounter />
      <RoomSeams />
      <BoothSilhouettes />
      <EntryPortal />
      <CeilingBeams />
      <CeilingPlane />
      <FrontWall />
      <NeonSign />
      <TableRug />
      <BarLamps />
      <SmokeMachine />
    </group>
  );
}
