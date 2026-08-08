import { Suspense, useEffect, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Billboard } from "@react-three/drei";
import { characterSkins, tableSeats, teams } from "../data/characters";
import { CharacterFigure } from "./CharacterFigure";
import { SceneText as Text } from "./SceneText";

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

const SEATED_GROUP_RADIUS = 2.58;

function getSeatedSeatPosition(position) {
  const radius = Math.hypot(position[0], position[2]) || 1;
  const scale = Math.min(1, SEATED_GROUP_RADIUS / radius);
  return [position[0] * scale, position[1], position[2] * scale];
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
  isSeatCamera,
  isAwayFromSeat,
  showFloatingLabel,
  lowPower,
  actingSeatPos,
  netPeer
}) {
  const ringRef = useRef(null);
  const outerRingRef = useRef(null);
  const torsoRef = useRef(null);
  const upperRef = useRef(null);
  const gazeRef = useRef({ yaw: 0, pitch: 0, weight: 0 });
  const groupRef = useRef(null);
  const spawnRef = useRef(0);
  const timeRef = useRef(Math.random() * Math.PI * 2); // offset per character
  const { camera } = useThree();


  const skin = character.skinId ? characterSkins[character.skinId] : null;
  // Los GLB ya se normalizan a la altura canónica de cada persona. Escalar por
  // rol deformaba esas diferencias y, además, cambiaba el tamaño de la silla.
  const roleScale = skin?.modelSrc ? 1 : character.role === "Jugador Estrella" ? 0.94 : 0.96;
  const chairSeatColor = skin?.chairSeatColor ?? "#2d1d16";
  const upperBaseY = skin?.modelSrc ? 1.28 : 1.47;
  const seatYaw = Math.atan2(-seat.position[0], -seat.position[2]);
  const seatedSeatPosition = isRoleSelect ? seat.position : getSeatedSeatPosition(seat.position);
  const poseVariant = (([...character.id].reduce((sum, letter) => sum + letter.charCodeAt(0), 0) % 5) - 2) / 2;
  const chairPull = isPlayerSeat && isRoleSelect ? -0.2 : isPlayerSeat ? 0.08 : 0;
  const chairScale = isPlayerSeat ? 1.04 : 1;
  const isLocalFirstPerson = isPlayerSeat && isSeatCamera;
  // los GLB ya están decimados al 30% — nunca degradar a conos: los amigos SON el juego
  const useSimplifiedModel = false;
  void lowPower;

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

    // ---- Cabezas vivas (Liar's Bar): la mirada tiene una intención clara.
    // El rival de tu carril sostiene contacto visual, quien juega mira la mesa
    // y el resto sigue al actor. Los senos sólo agregan micro-saccades.
    const gaze = gazeRef.current;
    const isHumanSeat = isPlayerSeat || Boolean(netPeer);
    let gazeTarget = null;
    if (!isHumanSeat && !isRoleSelect) {
      if (isCurrentActor && !handClosed) {
        gazeTarget = [0, 0.48, 0];
      } else if (isSeatCamera && isSelectedLane) {
        gazeTarget = [camera.position.x, camera.position.y + 1.35, camera.position.z - 0.25];
      } else if (actingSeatPos) {
        gazeTarget = [actingSeatPos[0], 1.58, actingSeatPos[2]];
      } else {
        gazeTarget = [0, 0.72, 0];
      }
    }

    if (gazeTarget) {
      const dx = gazeTarget[0] - seat.position[0];
      const dz = gazeTarget[2] - seat.position[2];
      const horizontalDistance = Math.hypot(dx, dz) || 1;
      let localYaw = Math.atan2(dx, dz) - seatYaw;
      while (localYaw > Math.PI) localYaw -= Math.PI * 2;
      while (localYaw < -Math.PI) localYaw += Math.PI * 2;
      const targetPitch = -Math.atan2(gazeTarget[1] - 1.58, horizontalDistance);
      const microYaw = Math.sin(t * 0.47) * 0.018 + Math.sin(t * 0.19 + 1.3) * 0.012;
      const microPitch = Math.sin(t * 0.63) * 0.008;
      gaze.yaw = Math.max(-0.62, Math.min(0.62, localYaw + microYaw));
      gaze.pitch = Math.max(-0.3, Math.min(0.24, targetPitch + microPitch));
      gaze.weight = 1;
    } else {
      gaze.yaw = 0;
      gaze.pitch = 0;
      gaze.weight = 0;
    }

    // El fallback procedural usa el mismo controlador; los GLB reciben gazeRef
    // y aplican la rotación directamente sobre Head + NeckTwist02.
    if (upperRef.current) {
      upperRef.current.position.y = upperBaseY + Math.sin(t * 0.9 + timeRef.current * 0.4) * 0.012;
      const idleYaw = Math.sin(t * 0.47) * 0.05 + Math.sin(t * 0.19 + 1.3) * 0.028;
      const glance = Math.pow(Math.max(0, Math.sin(t * 0.28 + 0.7)), 6) * 0.13;
      const idlePitch = Math.sin(t * 0.63) * 0.018 + glance;
      upperRef.current.rotation.y = idleYaw + gaze.yaw * gaze.weight;
      upperRef.current.rotation.x = idlePitch + gaze.pitch * gaze.weight;
    }

    // El cuerpo y la silla quedan plantados. La actuación vive en cabeza/cuello,
    // evitando el giro de maniquí que antes rotaba todo el conjunto.
    if (groupRef.current) {
      let yawDelta = seatYaw - groupRef.current.rotation.y;
      while (yawDelta > Math.PI) yawDelta -= Math.PI * 2;
      while (yawDelta < -Math.PI) yawDelta += Math.PI * 2;
      groupRef.current.rotation.y += yawDelta * Math.min(1, delta * 2.4);

      // llegada: cada personaje aparece creciendo desde su silla (nadie "estuvo siempre")
      spawnRef.current = Math.min(1, spawnRef.current + delta * 2.2);
      const spawnEase = 1 - Math.pow(1 - spawnRef.current, 3);
      groupRef.current.scale.setScalar(roleScale * spawnEase);

      // ---- Body language: lean in when acting, hop when you win, sag when you lose ----
      const len = Math.hypot(seatedSeatPosition[0], seatedSeatPosition[2]) || 1;
      const leanAmount = isCurrentActor && !handClosed && !isRoleSelect ? 0.17 : 0;
      const targetX = seatedSeatPosition[0] - (seatedSeatPosition[0] / len) * leanAmount;
      const targetZ = seatedSeatPosition[2] - (seatedSeatPosition[2] / len) * leanAmount;
      let targetY = seat.position[1];
      if (handClosed && !isRoleSelect) {
        const won = lastWinner === seat.team;
        if (won && outcomeTone !== "draw") targetY += Math.abs(Math.sin(t * 5.2)) * 0.11;
        else if (!won && outcomeTone !== "draw") targetY -= 0.06;
      }
      const moveAlpha = Math.min(1, delta * 3.2);
      groupRef.current.position.x += (targetX - groupRef.current.position.x) * moveAlpha;
      groupRef.current.position.z += (targetZ - groupRef.current.position.z) * moveAlpha;
      groupRef.current.position.y += (targetY - groupRef.current.position.y) * Math.min(1, delta * 6);
    }
  });

  return (
    <group
      key={`${seat.team}-${character.id}`}
      ref={groupRef}
      name={`Seat_${character.name}`}
      position={seatedSeatPosition}
      rotation={[0, seatYaw, 0]}
      scale={roleScale}
    >
      {/* Taburete de bar: asiento acolchado, pata central y aro de bronce */}
      <group position={[0, 0, -0.52 + chairPull]} scale={chairScale}>
        <mesh position={[0, 0.42, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[0.3, 0.32, 0.09, 20]} />
          <meshStandardMaterial color={chairSeatColor} roughness={0.85} />
        </mesh>
        <mesh position={[0, 0.2, 0]} castShadow>
          <cylinderGeometry args={[0.045, 0.06, 0.4, 10]} />
          <meshStandardMaterial color="#17100b" roughness={0.6} metalness={0.35} />
        </mesh>
        <mesh position={[0, 0.02, 0]} receiveShadow>
          <cylinderGeometry args={[0.24, 0.28, 0.045, 18]} />
          <meshStandardMaterial color="#100a07" roughness={0.7} metalness={0.2} />
        </mesh>
        <mesh position={[0, 0.14, 0]}>
          <torusGeometry args={[0.2, 0.014, 8, 20]} />
          <meshStandardMaterial color="#b47a34" roughness={0.4} metalness={0.6} />
        </mesh>
      </group>

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
        </group>
      ) : isLocalFirstPerson ? null : (
        <Suspense fallback={null}>
          <CharacterFigure
            skin={skin}
            accent={character.accent}
            outfitMaterialRef={torsoRef}
            upperRef={upperRef}
            facingOffset={skin?.walkFacingOffset ?? 0}
            poseMode={isRoleSelect ? null : "seat"}
            poseVariant={poseVariant}
            gazeRef={gazeRef}
            isActiveLane={isSelectedLane || isCurrentActor}
            forceProcedural={useSimplifiedModel}
          />
        </Suspense>
      )}

      {netPeer ? (
        <Billboard position={[0, 2.35, 0]} follow>
          <Text fontSize={0.13} color="#91e9f6" anchorX="center" anchorY="middle" letterSpacing={0.08} outlineWidth={0.008} outlineColor="#04222a">
            {`● ${netPeer.name}`}
          </Text>
          <Text position={[0, -0.16, 0]} fontSize={0.065} color="#5fb9c9" anchorX="center" anchorY="middle" letterSpacing={0.18}>
            EN LÍNEA
          </Text>
        </Billboard>
      ) : null}


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

export function TeamsAroundTable({ match, cameraView = "table", performanceMode = "high", netRoster = [] }) {
  const modId = match.activeModifier?.id ?? "";
  const visibleRosterSeats = getVisibleRosterSeats(match);
  const isRoleSelect = match.phase === "role-select";
  const selectedCharacterId = match.selectedCharacter?.id;
  const { size } = useThree();
  const isNarrow = size.width < 640;
  const lowPower = performanceMode === "low";
  const isSeatCamera = !isRoleSelect && (cameraView === "seat" || cameraView === "table");

  const actingSeat = match.handStarted && !match.handClosed
    ? visibleRosterSeats.find((seat) => seat.character?.name === match.nextActorName)
    : null;

  // en elección de rol solo estás vos frente a la mesa vacía;
  // al repartir "llegan" los demás (antesala del modo online con salas)
  const seatsToShow = isRoleSelect
    ? visibleRosterSeats.filter(
        (seat) => seat.team === "A" && seat.character.role === match.selectedRole
      )
    : visibleRosterSeats;

  return (
    <group name="Players_Ring">
      {seatsToShow.map((seat) => {
        const character = seat.character;
        const isSelectedLane = character.role === match.selectedRole;
        const isSelectedCharacter = isRoleSelect && character.id === selectedCharacterId;
        const isPlayerSeat = seat.team === "A" && character.role === match.selectedRole;
        const isCurrentActor = match.handStarted && !match.handClosed && character.name === match.nextActorName;
        const isAwayFromSeat = cameraView === "walk" && character.id === selectedCharacterId;
        // [VISUAL] Walking mode needs a cleaner cinematic read; floating roster labels clutter the table focus.
        // En primera persona el billboard del avatar local queda pegado al lente
        // y explota de tamaño. El turno ya se comunica con anillo y mesa.
        const showFloatingLabel = !isSeatCamera && cameraView !== "walk" && (isNarrow ? isCurrentActor : isRoleSelect || isCurrentActor);
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
            isSeatedView={isPlayerSeat && isSeatCamera}
            isSeatCamera={isSeatCamera}
            isAwayFromSeat={isAwayFromSeat}
            showFloatingLabel={showFloatingLabel}
            lowPower={lowPower}
            actingSeatPos={actingSeat && actingSeat.seatId !== seat.seatId ? getSeatedSeatPosition(actingSeat.position) : null}
            netPeer={netRoster.find((peer) => peer.seatId === seat.seatId && !peer.self) ?? null}
          />
        );
      })}
    </group>
  );
}
