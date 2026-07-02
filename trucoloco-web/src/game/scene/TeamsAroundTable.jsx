import { useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Billboard, Text } from "@react-three/drei";
import { characterSkins, tableSeats, teams } from "../data/characters";
import { CharacterFigure } from "./CharacterFigure";

function getVisibleRosterSeats(match) {
  const playersById = [...teams.A, ...teams.B].reduce((lookup, player) => {
    lookup[player.id] = player;
    return lookup;
  }, {});

  return tableSeats.map((seat) => ({
    ...seat,
    key: seat.seatId,
    character: playersById[seat.playerId]
  }));
}

// Individual character — ring pulses based on role and active modifier
function CharacterSeat({
  seat,
  character,
  modId,
  handClosed,
  outcomeTone,
  lastWinner,
  isSelectedLane,
  isCurrentActor,
  isRoleSelect,
  isPlayerSeat,
  isSelectedCharacter,
  isSeatedView,
  isAwayFromSeat,
  showFloatingLabel,
  lowPower,
  actingSeatPos
}) {
  const ringRef = useRef(null);
  const outerRingRef = useRef(null);
  const torsoRef = useRef(null);
  const upperRef = useRef(null);
  const groupRef = useRef(null);
  const timeRef = useRef(Math.random() * Math.PI * 2); // offset per character

  const skin = character.skinId ? characterSkins[character.skinId] : null;
  const roleScale = skin?.modelSrc
    ? character.role === "Jugador Estrella" ? 1.04 : character.role === "Negociante" ? 0.96 : 1
    : character.role === "Jugador Estrella" ? 0.94 : 0.96;
  const chairSeatColor = skin?.chairSeatColor ?? "#2d1d16";
  const chairBackColor = skin?.chairBackColor ?? "#231813";
  const upperBaseY = skin?.modelSrc ? 1.28 : 1.47;
  const seatYaw = Math.atan2(-seat.position[0], -seat.position[2]);
  const chairPull = isPlayerSeat && isRoleSelect ? -0.2 : isPlayerSeat ? 0.08 : 0;
  const chairScale = isPlayerSeat ? 1.04 : 1;
  const useSimplifiedModel = lowPower && !isPlayerSeat && !isSelectedCharacter && !isCurrentActor;

  // Is this character "special" under any active modifier?
  const isGazpacho = character.id === "gazpacho";
  const isGafasTarget = modId === "gafas-legendarias"; // Edu lore; affects whole enemy team visually
  const isSustancia = modId === "sustancia-x";
  const isExodia = modId === "exodia-bolsillo";
  const isTiempo = modId === "tiempo-arena";

  useFrame((_, delta) => {
    timeRef.current += delta;
    const t = timeRef.current;

    // ---- Ring pulse ----
    if (ringRef.current) {
      let opacity = isCurrentActor ? 0.78 : isSelectedCharacter ? 0.72 : isSelectedLane ? 0.5 : 0.18;
      let color = character.accent;
      let scale = isCurrentActor ? 1.12 : isSelectedCharacter ? 1.11 : isSelectedLane ? 1.02 : 0.96;

      // Winner team flash
      if (handClosed) {
        const isWinnerTeam = lastWinner === seat.team;
        if (isWinnerTeam && outcomeTone === "win") {
          opacity = 0.7 + Math.abs(Math.sin(t * 5)) * 0.3;
          scale = 1.0 + Math.abs(Math.sin(t * 5)) * 0.08;
        } else if (!isWinnerTeam && outcomeTone === "lose") {
          opacity = 0.15 + Math.sin(t * 2) * 0.05;
        }
      }

      // Modifier boosts
      if (isSustancia) {
        opacity = 0.52 + Math.sin(t * 3.8 + timeRef.current * 0.3) * 0.22;
        scale = 1.0 + Math.abs(Math.sin(t * 3.8)) * 0.05;
      }

      if (isExodia && isGazpacho) {
        // Gazpacho glows gold under Exodia
        color = "#d4a020";
        opacity = 0.7 + Math.abs(Math.sin(t * 2.4)) * 0.28;
        scale = 1.0 + Math.abs(Math.sin(t * 2.4)) * 0.1;
      }

      if (isGafasTarget && seat.team === "A") {
        // Gafas Legendarias: team A characters get a blue shimmer (Edu's lenses in effect)
        color = "#40b0d8";
        opacity = 0.55 + Math.sin(t * 1.8) * 0.2;
      }

      if (isTiempo) {
        // Tiempo Arena: rings strobe slowly like a ticking clock
        opacity = 0.44 + Math.abs(Math.sin(t * 0.9)) * 0.3;
        scale = 1.0 + Math.abs(Math.sin(t * 0.9)) * 0.04;
      }

      ringRef.current.material.color.set(color);
      ringRef.current.material.opacity = opacity;
      ringRef.current.scale.setScalar(scale);
    }

    // ---- Outer ring — only for special states ----
      if (outerRingRef.current) {
        let opacity = 0.0;
        let scale = 1.12;

        if (isSelectedCharacter || isSelectedLane || isCurrentActor) {
          opacity = (isSelectedCharacter ? 0.14 : 0.08) + Math.abs(Math.sin(t * 1.4)) * 0.06;
        }

        if (isExodia && isGazpacho) {
          opacity = 0.3 + Math.abs(Math.sin(t * 1.8 + 1.0)) * 0.2;
          scale = 1.12 + Math.abs(Math.sin(t * 1.8)) * 0.06;
        } else if (isSustancia) {
        opacity = 0.12 + Math.abs(Math.sin(t * 2.8 + 0.8)) * 0.1;
        scale = 1.12 + Math.abs(Math.sin(t * 2.8)) * 0.05;
      } else if (handClosed && outcomeTone === "win" && lastWinner === seat.team) {
        opacity = 0.18 + Math.abs(Math.sin(t * 4)) * 0.14;
        scale = 1.14 + Math.abs(Math.sin(t * 4)) * 0.06;
      }

      outerRingRef.current.material.opacity = opacity;
      outerRingRef.current.scale.setScalar(scale);
    }

    // ---- Torso subtle emissive pulse ----
      if (torsoRef.current) {
        let emissive = "#000000";
        let emissiveIntensity = 0.0;

        if (isCurrentActor || isSelectedCharacter || isSelectedLane) {
          emissive = character.accent;
          emissiveIntensity = isCurrentActor
            ? 0.18 + Math.abs(Math.sin(t * 2.4)) * 0.12
            : isSelectedCharacter
              ? 0.12 + Math.abs(Math.sin(t * 1.4)) * 0.07
              : 0.05 + Math.abs(Math.sin(t * 1.4)) * 0.04;
        }

        if (isExodia && isGazpacho) {
          emissive = "#d4a020";
        emissiveIntensity = 0.3 + Math.abs(Math.sin(t * 2)) * 0.3;
      } else if (isSustancia) {
        emissive = character.accent;
        emissiveIntensity = 0.08 + Math.abs(Math.sin(t * 3.2)) * 0.1;
      } else if (handClosed && outcomeTone === "win" && lastWinner === seat.team) {
        emissive = character.accent;
        emissiveIntensity = 0.15 + Math.abs(Math.sin(t * 4.5)) * 0.1;
      }

      torsoRef.current.emissive.set(emissive);
      torsoRef.current.emissiveIntensity = emissiveIntensity;
    }

    // ---- Head bob — each character has a tiny idle motion ----
    if (upperRef.current) {
      upperRef.current.position.y = upperBaseY + Math.sin(t * 0.9 + timeRef.current * 0.4) * 0.012;
    }

    // ---- Everyone glances at whoever is acting — the table feels alive ----
    if (groupRef.current) {
      let lookYaw = seatYaw;
      if (actingSeatPos && !isCurrentActor && !isRoleSelect) {
        const dx = actingSeatPos[0] - seat.position[0];
        const dz = actingSeatPos[2] - seat.position[2];
        if (Math.hypot(dx, dz) > 0.5) {
          let turn = Math.atan2(dx, dz) - seatYaw;
          while (turn > Math.PI) turn -= Math.PI * 2;
          while (turn < -Math.PI) turn += Math.PI * 2;
          // heads turn, bodies stay planted: cap the twist
          lookYaw = seatYaw + Math.max(-0.5, Math.min(0.5, turn));
        }
      }
      let yawDelta = lookYaw - groupRef.current.rotation.y;
      while (yawDelta > Math.PI) yawDelta -= Math.PI * 2;
      while (yawDelta < -Math.PI) yawDelta += Math.PI * 2;
      groupRef.current.rotation.y += yawDelta * Math.min(1, delta * 2.4);
    }
  });

  return (
    <group
      key={`${seat.team}-${character.id}`}
      ref={groupRef}
      name={`Seat_${character.name}`}
      position={seat.position}
      rotation={[0, seatYaw, 0]}
      scale={roleScale}
    >
      {/* Chair */}
      <mesh position={[0, 0.14, -0.12 + chairPull]} scale={[chairScale, 1, chairScale]} castShadow receiveShadow>
        <boxGeometry args={[0.72, 0.18, 0.64]} />
        <meshStandardMaterial color={chairSeatColor} roughness={0.92} />
      </mesh>
      <mesh position={[0, 0.46, chairPull]} scale={[chairScale, 1, chairScale]} castShadow>
        <boxGeometry args={[0.56, 0.58, 0.22]} />
        <meshStandardMaterial color={chairBackColor} roughness={0.94} />
      </mesh>

      {isPlayerSeat ? (
        <group name={`SeatState_${character.name}`}>
          <mesh position={[0, 0.025, -0.03]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.6, 0.7, 36]} />
            <meshBasicMaterial color={isSeatedView ? "#91e9f6" : "#d9b36c"} transparent opacity={isSeatedView ? 0.32 : 0.16} depthWrite={false} />
          </mesh>
          <Text
            position={[0, 0.13, -0.82]}
            rotation={[-Math.PI / 2, 0, 0]}
            fontSize={0.078}
            color={isSeatedView ? "#91e9f6" : "#d9b36c"}
            anchorX="center"
            anchorY="middle"
            letterSpacing={0.08}
          >
            {isSeatedView ? "SENTADO" : "TU SILLA"}
          </Text>
        </group>
      ) : null}

      {isAwayFromSeat ? (
        <group name={`SeatAway_${character.name}`}>
          <mesh position={[0, 0.74, -0.05]} rotation={[0, 0, -0.08]} castShadow>
            <boxGeometry args={[0.34, 0.08, 0.22]} />
            <meshStandardMaterial color={character.accent} roughness={0.72} metalness={0.12} />
          </mesh>
          <Text
            position={[0, 0.95, -0.5]}
            rotation={[0, -seatYaw, 0]}
            fontSize={0.075}
            color="#91e9f6"
            anchorX="center"
            anchorY="middle"
            letterSpacing={0.08}
          >
            EN EL ANTRO
          </Text>
        </group>
      ) : (
        <CharacterFigure
          skin={skin}
          accent={character.accent}
          outfitMaterialRef={torsoRef}
          upperRef={upperRef}
          isActiveLane={isSelectedLane || isCurrentActor}
          forceProcedural={useSimplifiedModel}
        />
      )}

      {showFloatingLabel && !isAwayFromSeat ? (
        <Billboard position={[0, 2.02, 0]} follow>
          <Text
            fontSize={isCurrentActor ? 0.18 : isSelectedLane ? 0.16 : 0.11}
            color={isCurrentActor ? "#91e9f6" : isSelectedLane ? "#f0ddb4" : "#8f7755"}
            anchorX="center"
            anchorY="middle"
            letterSpacing={0.04}
          >
            {isCurrentActor ? "ACTUA" : character.name.toUpperCase()}
          </Text>
          <Text
            position={[0, -0.18, 0]}
            fontSize={0.07}
            color={isCurrentActor || isSelectedCharacter || isSelectedLane ? character.accent : "#66513b"}
            anchorX="center"
            anchorY="middle"
            letterSpacing={0.08}
          >
            {isCurrentActor ? character.name.toUpperCase() : isSelectedCharacter ? "ELEGIDO" : character.role.toUpperCase()}
          </Text>
        </Billboard>
      ) : null}

      {/* Base ring */}
      <mesh name={`Ring_${character.name}`} ref={ringRef} receiveShadow rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.32, 0.44, 28]} />
        <meshBasicMaterial color={character.accent} transparent opacity={0.44} />
      </mesh>

      {/* Outer ring — only visible during special states */}
      <mesh ref={outerRingRef} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.46, 0.54, 28]} />
        <meshBasicMaterial color={character.accent} transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  );
}

export function TeamsAroundTable({ match, cameraView = "table", performanceMode = "high" }) {
  const modId = match.activeModifier?.id ?? "";
  const visibleRosterSeats = getVisibleRosterSeats(match);
  const isRoleSelect = match.phase === "role-select";
  const selectedCharacterId = match.selectedCharacter?.id;
  const { size } = useThree();
  const isNarrow = size.width < 640;
  const lowPower = performanceMode === "low";

  const actingSeat = match.handStarted && !match.handClosed
    ? visibleRosterSeats.find((seat) => seat.character?.name === match.nextActorName)
    : null;

  return (
    <group name="Players_Ring">
      {visibleRosterSeats.map((seat) => {
        const character = seat.character;
        const isSelectedLane = character.role === match.selectedRole;
        const isSelectedCharacter = isRoleSelect && character.id === selectedCharacterId;
        const isPlayerSeat = seat.team === "A" && character.role === match.selectedRole;
        const isCurrentActor = match.handStarted && !match.handClosed && character.name === match.nextActorName;
        const isAwayFromSeat = cameraView === "walk" && character.id === selectedCharacterId;
        // [VISUAL] Walking mode needs a cleaner cinematic read; floating roster labels clutter the table focus.
        const showFloatingLabel = cameraView !== "walk" && (isNarrow ? isCurrentActor : isRoleSelect || isCurrentActor);
        return (
          <CharacterSeat
            key={seat.key}
            seat={seat}
            character={character}
            modId={modId}
            handClosed={match.handClosed}
            outcomeTone={match.outcomeTone}
            lastWinner={match.lastWinner}
            isSelectedLane={isSelectedLane}
            isCurrentActor={isCurrentActor}
            isRoleSelect={isRoleSelect}
            isPlayerSeat={isPlayerSeat}
            isSelectedCharacter={isSelectedCharacter}
            isSeatedView={isPlayerSeat && cameraView === "seat"}
            isAwayFromSeat={isAwayFromSeat}
            showFloatingLabel={showFloatingLabel}
            lowPower={lowPower}
            actingSeatPos={actingSeat && actingSeat.seatId !== seat.seatId ? actingSeat.position : null}
          />
        );
      })}
    </group>
  );
}
