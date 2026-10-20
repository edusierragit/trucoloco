import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { characterSkins } from "../data/characters";
import { CharacterFigure } from "./CharacterFigure";
import { useDuel } from "../conflict/duel/duelStore";
import { CHAMBERS } from "../conflict/duel/duelEngine";

// ─────────────────────────────────────────────────────────────────────────────
// Escenario del duelo de bardo. Lee el store del duelo (unos pocos renders por
// ronda); todo lo continuo —giro del revólver, vuelo del corcho, caída— vive en
// refs y useFrame. Cero setState por frame.
// ─────────────────────────────────────────────────────────────────────────────

const TABLE_Y = 0.5;
// de perfil, un toque abiertos hacia cámara para que se les vea la cara
const FACE = { p1: Math.PI / 2 - 0.5, p2: -Math.PI / 2 + 0.5 };
const SIDE_SIGN = { p1: -1, p2: 1 };
// el caño apunta a +x local: yaw 0 → p2, yaw π → p1
const AIM = { p1: Math.PI, p2: 0 };
const TAU = Math.PI * 2;

function fighterMode(duel, side) {
  if (!duel) return "idle";
  if (duel.phase === "over") return duel.loser === side ? "idle" : "jump";
  if (duel.phase === "retort" && duel.exchange?.by === side) return "box";
  const justAnswered = duel.phase === "pull" && !duel.lastPull;
  if (justAnswered && duel.exchange?.outcome === "highlight" && duel.exchange.by !== side) return "jump";
  return "idle";
}

function DuelFighter({ side, character, mode, fallen, tense, spread }) {
  const tiltRef = useRef(null);
  const skin = character?.skinId ? characterSkins[character.skinId] : null;

  useFrame((_, delta) => {
    const tilt = tiltRef.current;
    if (!tilt) return;
    // cae de espaldas como tabla cuando le salta el corcho
    const target = fallen ? -1.38 : tense ? 0.1 : 0;
    const speed = fallen ? 7 : 4;
    tilt.rotation.x += (target - tilt.rotation.x) * (1 - Math.exp(-delta * speed));
  });

  if (!skin?.modelSrc) return null;

  return (
    <group name={`Duel_Fighter_${side}`} position={[SIDE_SIGN[side] * spread, 0, 0]} rotation={[0, FACE[side], 0]}>
      <group ref={tiltRef}>
        <group scale={0.72} rotation={[0, skin.walkFacingOffset ?? 0, 0]}>
          <CharacterFigure skin={skin} accent={character.accent} isActiveLane={mode !== "idle"} animationMode={fallen ? "idle" : mode} />
        </group>
      </group>
    </group>
  );
}

function DuelTable() {
  return (
    <group name="Duel_Table">
      <mesh position={[0, TABLE_Y, 0]} receiveShadow>
        <cylinderGeometry args={[0.36, 0.36, 0.045, 40]} />
        <meshStandardMaterial color="#4a1416" roughness={0.9} />
      </mesh>
      <mesh position={[0, TABLE_Y - 0.01, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.36, 0.022, 8, 40]} />
        <meshStandardMaterial color="#b47a34" roughness={0.4} metalness={0.6} />
      </mesh>
      <mesh position={[0, TABLE_Y / 2, 0]}>
        <cylinderGeometry args={[0.035, 0.05, TABLE_Y, 10]} />
        <meshStandardMaterial color="#1a0c08" roughness={0.6} metalness={0.3} />
      </mesh>
      <mesh position={[0, 0.02, 0]}>
        <cylinderGeometry args={[0.2, 0.22, 0.04, 24]} />
        <meshStandardMaterial color="#1a0c08" roughness={0.6} metalness={0.3} />
      </mesh>
    </group>
  );
}

function DuelRevolver({ duel }) {
  const yawRef = useRef(null);
  const drumRef = useRef(null);
  const corkRef = useRef(null);
  const flashRef = useRef(null);
  const anim = useRef({ yaw: 0, yawTarget: 0, drum: 0, drumTarget: 0, corkT: -1 });
  const lastSeq = useRef(-1);

  // Traduce eventos del duelo a objetivos de animación (una vez por evento).
  useEffect(() => {
    if (!duel || duel.seq === lastSeq.current) return;
    const fresh = lastSeq.current === -1 || duel.seq < lastSeq.current;
    lastSeq.current = duel.seq;
    const a = anim.current;

    if (fresh) {
      a.drumTarget = 0;
      a.drum = 0;
      a.corkT = -1;
    }

    if (duel.phase === "pull" && !duel.lastPull) {
      // la botellita: dos vueltas y media y clava al que le toca
      const aim = AIM[duel.puller];
      let target = a.yaw + TAU * 2;
      target += ((aim - target) % TAU + TAU) % TAU;
      a.yawTarget = target;
    }
    if (duel.lastPull?.kind === "click") a.drumTarget += TAU / CHAMBERS;
    if (duel.lastPull?.kind === "spin") a.drumTarget += TAU * 3 + Math.random() * TAU;
    if (duel.lastPull?.kind === "corchazo") {
      a.drumTarget += TAU / CHAMBERS;
      a.corkT = 0;
    }
  }, [duel]);

  useFrame((_, delta) => {
    const a = anim.current;
    a.yaw += (a.yawTarget - a.yaw) * (1 - Math.exp(-delta * 2.6));
    a.drum += (a.drumTarget - a.drum) * (1 - Math.exp(-delta * 9));
    if (yawRef.current) yawRef.current.rotation.y = a.yaw;
    if (drumRef.current) drumRef.current.rotation.x = a.drum;

    const cork = corkRef.current;
    if (cork) {
      if (a.corkT >= 0) {
        a.corkT = Math.min(a.corkT + delta, 1.2);
        const t = Math.min(a.corkT / 0.55, 1);
        // sale disparado hacia la cara del que aprieta y rebota al piso
        cork.position.set(0.2 + t * 0.62, 0.02 + Math.sin(t * Math.PI) * 0.34 - (a.corkT > 0.55 ? (a.corkT - 0.55) * 0.9 : 0), 0);
        cork.rotation.z += delta * 18;
        cork.visible = true;
      } else {
        cork.position.set(0.2, 0.02, 0);
        cork.visible = false;
      }
    }
    if (flashRef.current) {
      const flash = a.corkT >= 0 && a.corkT < 0.3 ? 1 - a.corkT / 0.3 : 0;
      flashRef.current.intensity = flash * 14;
    }
  });

  return (
    <group position={[0, TABLE_Y + 0.045, 0]}>
      <group ref={yawRef} name="Duel_Revolver">
        {/* caño */}
        <mesh position={[0.1, 0.035, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.013, 0.013, 0.2, 12]} />
          <meshStandardMaterial color="#2b2622" roughness={0.3} metalness={0.9} />
        </mesh>
        {/* tambor: 6 recámaras, gira con cada click */}
        <group ref={drumRef} position={[-0.012, 0.035, 0]}>
          <mesh rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.035, 0.035, 0.055, 6]} />
            <meshStandardMaterial color="#3a332c" roughness={0.35} metalness={0.85} />
          </mesh>
        </group>
        {/* culata de nácar gastado */}
        <mesh position={[-0.075, 0.0, 0]} rotation={[0, 0, -0.5]}>
          <boxGeometry args={[0.035, 0.1, 0.03]} />
          <meshStandardMaterial color="#e6d3b0" roughness={0.5} />
        </mesh>
        <mesh ref={corkRef} visible={false}>
          <cylinderGeometry args={[0.016, 0.012, 0.03, 10]} />
          <meshStandardMaterial color="#b98a52" roughness={0.95} />
        </mesh>
        <pointLight ref={flashRef} position={[0.24, 0.05, 0]} intensity={0} distance={2.4} color="#ffcf8a" />
      </group>
    </group>
  );
}

export function DuelStage({ playerCharacter, rivalCharacter }) {
  const duel = useDuel();
  // en celular no entran los dos a 0.86: se acercan a la mesa
  const narrow = useThree((state) => state.size.width < 640);
  const spread = narrow ? 0.56 : 0.82;
  const tense = duel?.phase === "pull" && duel.lastPull?.kind !== "spin" ? duel.puller : null;
  const fallen = duel?.phase === "over" ? duel.loser : null;

  return (
    <group name="Duel_Stage">
      <DuelTable />
      <DuelRevolver duel={duel} />
      <DuelFighter side="p1" character={playerCharacter} mode={fighterMode(duel, "p1")} fallen={fallen === "p1"} tense={tense === "p1"} spread={spread} />
      <DuelFighter side="p2" character={rivalCharacter} mode={fighterMode(duel, "p2")} fallen={fallen === "p2"} tense={tense === "p2"} spread={spread} />
    </group>
  );
}
