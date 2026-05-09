import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { RoundedBox, Text } from "@react-three/drei";
import { getCardRankLabel, getCardRankNumber, getCardSuitCode } from "../data/cards";
import { tableSeats } from "../data/characters";

const suitColor = {
  Espada: "#d9d1af",
  Basto: "#7aa15a",
  Oro: "#c98b2b",
  Copa: "#b54835",
  "Yu-Gi-Oh": "#8e6bd7",
  Trucoloco: "#dd6a32"
};

const suitGlyph = {
  Espada: "ESP",
  Basto: "BAS",
  Oro: "ORO",
  Copa: "COP",
  "Yu-Gi-Oh": "YGO",
  Trucoloco: "LOCO"
};

const CARD_FACE = "#f0e1bf";
const CARD_FACE_HIGHLIGHT = "#f7edd5";
const CARD_EDGE = "#745132";
const CARD_BACK = "#5b2d20";
const CARD_BACK_LINE = "#b78a4e";
const CARD_TEXT = "#23170f";
const CARD_TEXT_SOFT = "#6c4e34";
const TABLE_WOOD = "#4b2112";
const TABLE_WOOD_DARK = "#281109";
const TABLE_BRASS = "#b07a36";
const FELT_BASE = "#173826";
const FELT_DEEP = "#10251a";

function AnimatedTableCard({ card, position, rotation = [0, 0, 0], animationKey }) {
  const groupRef = useRef(null);
  const shadowRef = useRef(null);
  const progressRef = useRef(0);
  const fromX = card.side === "A" ? 0 : 1.9;
  const fromZ = card.side === "A" ? 3.2 : -2.8;
  const fromY = 1.6;
  const initialRotX = 0.62;
  const initialRotZ = card.side === "A" ? -0.34 : 0.34;

  useEffect(() => {
    progressRef.current = 0;
    if (groupRef.current) {
      groupRef.current.position.set(fromX, fromY, fromZ);
      groupRef.current.rotation.set(initialRotX, 0, initialRotZ);
      groupRef.current.scale.setScalar(0.82);
    }
  }, [animationKey, fromX, fromZ, card.owner, initialRotZ]);

  useFrame((_, delta) => {
    if (!groupRef.current) {
      return;
    }

    progressRef.current = Math.min(1, progressRef.current + delta * 2.8);
    const t = 1 - Math.pow(1 - progressRef.current, 3);

    groupRef.current.position.x = fromX + (position[0] - fromX) * t;
    groupRef.current.position.y = fromY + (position[1] - fromY) * t;
    groupRef.current.position.z = fromZ + (position[2] - fromZ) * t;
    groupRef.current.rotation.x = initialRotX + (rotation[0] - initialRotX) * t;
    groupRef.current.rotation.z = initialRotZ + (rotation[2] - initialRotZ) * t;
    const scale = 0.82 + (1 - 0.82) * t;
    groupRef.current.scale.setScalar(scale);

    if (shadowRef.current) {
      shadowRef.current.material.opacity = 0.34 * t;
    }
  });

  return (
    <group ref={groupRef}>
      <mesh name={`Shadow_${card.owner}_${card.id}`} ref={shadowRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.16, 0]}>
        <circleGeometry args={[0.78, 28]} />
        <meshBasicMaterial color="#000000" transparent opacity={0} />
      </mesh>
      <RoundedBox name={`Card_${card.owner}_${card.id}`} args={[1.02, 0.055, 1.48]} radius={0.07} castShadow receiveShadow>
        <meshStandardMaterial color={CARD_EDGE} roughness={0.72} />
      </RoundedBox>
      <RoundedBox args={[0.92, 0.028, 1.36]} radius={0.052} position={[0, 0.016, 0]} castShadow receiveShadow>
        <meshStandardMaterial color={CARD_FACE} roughness={0.58} />
      </RoundedBox>
      <mesh position={[0, 0.032, -0.58]}>
        <boxGeometry args={[0.86, 0.01, 0.09]} />
        <meshStandardMaterial color={card.tone ?? suitColor[card.suit] ?? CARD_FACE_HIGHLIGHT} roughness={0.48} />
      </mesh>
      <Text
        position={[-0.33, 0.041, -0.47]}
        rotation={[-Math.PI / 2, 0, 0]}
        fontSize={0.16}
        color={CARD_TEXT}
        anchorX="center"
        anchorY="middle"
      >
        {getCardRankNumber(card)}
      </Text>
      <Text
        position={[-0.31, 0.041, -0.31]}
        rotation={[-Math.PI / 2, 0, 0]}
        fontSize={0.052}
        color={CARD_TEXT_SOFT}
        anchorX="center"
        anchorY="middle"
      >
        {getCardSuitCode(card)}
      </Text>
      <Text
        position={[0, 0.04, 0.04]}
        rotation={[-Math.PI / 2, 0, 0]}
        fontSize={0.13}
        maxWidth={0.84}
        lineHeight={1}
        color={CARD_TEXT}
        anchorX="center"
        anchorY="middle"
      >
        {card.name}
      </Text>
      <Text
        position={[0.31, 0.041, 0.5]}
        rotation={[-Math.PI / 2, 0, Math.PI]}
        fontSize={0.16}
        color={CARD_TEXT}
        anchorX="center"
        anchorY="middle"
      >
        {getCardRankNumber(card)}
      </Text>
    </group>
  );
}

function SceneHandCard({ card, position, rotation, faceDown = false }) {
  return (
    <group position={position} rotation={rotation}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.06, 0]}>
        <circleGeometry args={[0.62, 24]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.12} />
      </mesh>

      <RoundedBox args={[0.86, 0.05, 1.28]} radius={0.06} castShadow receiveShadow>
        <meshStandardMaterial color={CARD_EDGE} roughness={0.72} />
      </RoundedBox>

      {faceDown ? (
        <>
          <RoundedBox args={[0.78, 0.026, 1.18]} radius={0.045} position={[0, 0.014, 0]} castShadow receiveShadow>
            <meshStandardMaterial color={CARD_BACK} roughness={0.62} />
          </RoundedBox>
          <mesh position={[0, 0.03, -0.32]}>
            <boxGeometry args={[0.7, 0.008, 0.09]} />
            <meshStandardMaterial color={CARD_BACK_LINE} roughness={0.42} />
          </mesh>
          <Text
            position={[0, 0.04, 0]}
            rotation={[-Math.PI / 2, 0, 0]}
            fontSize={0.1}
            color="#f2dfbb"
            anchorX="center"
            anchorY="middle"
          >
            TRUCO
          </Text>
          <Text
            position={[0, 0.04, 0.34]}
            rotation={[-Math.PI / 2, 0, 0]}
            fontSize={0.05}
            color="#c4975a"
            anchorX="center"
            anchorY="middle"
          >
            LA TRAICION
          </Text>
        </>
      ) : (
        <>
          <RoundedBox args={[0.78, 0.026, 1.18]} radius={0.045} position={[0, 0.014, 0]} castShadow receiveShadow>
            <meshStandardMaterial color={CARD_FACE} roughness={0.58} />
          </RoundedBox>
          <mesh position={[0, 0.03, -0.48]}>
            <boxGeometry args={[0.72, 0.008, 0.08]} />
            <meshStandardMaterial color={card.tone ?? suitColor[card.suit] ?? CARD_FACE_HIGHLIGHT} roughness={0.42} />
          </mesh>
          <Text
            position={[-0.24, 0.04, -0.42]}
            rotation={[-Math.PI / 2, 0, 0]}
            fontSize={0.11}
            color={CARD_TEXT}
            anchorX="center"
            anchorY="middle"
          >
            {getCardRankNumber(card)}
          </Text>
          <Text
            position={[-0.24, 0.04, -0.28]}
            rotation={[-Math.PI / 2, 0, 0]}
            fontSize={0.045}
            color={CARD_TEXT_SOFT}
            anchorX="center"
            anchorY="middle"
          >
            {getCardRankLabel(card).toUpperCase()}
          </Text>
          <Text
            position={[0, 0.04, 0.04]}
            rotation={[-Math.PI / 2, 0, 0]}
            fontSize={0.092}
            maxWidth={0.72}
            lineHeight={1}
            color={CARD_TEXT}
            anchorX="center"
            anchorY="middle"
          >
            {card.name}
          </Text>
          <Text
            position={[0, 0.04, 0.42]}
            rotation={[-Math.PI / 2, 0, 0]}
            fontSize={0.06}
            color={CARD_TEXT_SOFT}
            anchorX="center"
            anchorY="middle"
          >
            {suitGlyph[card.suit] ?? getCardSuitCode(card)}
          </Text>
        </>
      )}
    </group>
  );
}

function ArchivedTrickCards({ trickHistory, showCurrentPair, handClosed }) {
  const archivedTricks = showCurrentPair ? trickHistory.slice(0, -1) : trickHistory;

  return (
    <group name="TrickHistory3D">
      {archivedTricks.map((trick, index) => {
        const z = handClosed ? -0.42 + index * 0.38 : -0.16 + index * 0.48;
        const x = handClosed ? (index % 2 === 0 ? -0.14 : 0.14) : 0;
        const scale = handClosed ? 0.72 : 0.82;

        return (
          <group key={`trick-${trick.index}`} position={[x, handClosed ? 0.22 : 0.27, z]} scale={scale}>
            {trick.cards ? (
              trick.cards.slice(0, 6).map((play, cardIndex) => {
                const row = cardIndex < 3 ? -0.24 : 0.24;
                const column = (cardIndex % 3) - 1;

                return (
                  <SceneHandCard
                    key={`${trick.index}-${play.seatId}`}
                    card={play.card ?? play}
                    position={[column * 0.42, 0, row]}
                    rotation={[0, 0, (column * 0.04)]}
                  />
                );
              })
            ) : (
              <>
                <SceneHandCard
                  card={trick.humanCard}
                  position={[-0.52, 0, 0]}
                  rotation={[0, 0, -0.08]}
                />
                <SceneHandCard
                  card={trick.rivalCard}
                  position={[0.52, 0, 0]}
                  rotation={[0, Math.PI, 0.08]}
                />
              </>
            )}
            <Text
              position={[0, 0.08, 0.85]}
              rotation={[-Math.PI / 2, 0, 0]}
              fontSize={0.07}
              color="#c9a46a"
              anchorX="center"
              anchorY="middle"
            >
              {`V ${trick.index}`}
            </Text>
          </group>
        );
      })}
    </group>
  );
}

const tableCardPoses = [
  { position: [-1.05, 0.42, 0.84], rotation: [0, 0, -0.14] },
  { position: [0, 0.43, 1.0], rotation: [0, 0, 0] },
  { position: [1.05, 0.42, 0.84], rotation: [0, 0, 0.14] },
  { position: [1.05, 0.42, -0.52], rotation: [0, 0, 0.14] },
  { position: [0, 0.43, -0.7], rotation: [0, 0, 0] },
  { position: [-1.05, 0.42, -0.52], rotation: [0, 0, -0.14] }
];

const getTableCardPose = (card, index) =>
  tableCardPoses[card.tableIndex ?? index] ?? {
    position: [card.side === "A" ? -0.82 : 0.82, 0.42, 0.18],
    rotation: [0, 0, (card.side === "A" ? -1 : 1) * 0.08]
  };

// Pulsing tension ring around center badge — intensity driven by match state
function TensionRing({ handClosed, outcomeTone, modId }) {
  const ringRef = useRef(null);
  const ring2Ref = useRef(null);
  const timeRef = useRef(0);

  useFrame((_, delta) => {
    timeRef.current += delta;
    const t = timeRef.current;

    if (!ringRef.current || !ring2Ref.current) return;

    // Base color by outcome or modifier
    let color = "#8c6238";
    let opacity = 0.0;
    let scale = 1.0;
    let opacity2 = 0.0;
    let scale2 = 1.0;

    if (!handClosed) {
      // Mid-hand: gentle amber pulse
      opacity = 0.18 + Math.sin(t * 1.6) * 0.08;
      scale = 1.0 + Math.sin(t * 1.6) * 0.03;
      opacity2 = 0.08 + Math.sin(t * 1.6 + 1.2) * 0.04;
      scale2 = 1.06 + Math.sin(t * 1.6 + 1.2) * 0.04;
      color = "#c89040";

      if (modId === "sustancia-x") {
        color = "#c040c0";
        opacity = 0.28 + Math.sin(t * 4.2) * 0.14;
        scale = 1.0 + Math.sin(t * 4.2) * 0.05;
      } else if (modId === "exodia-bolsillo") {
        color = "#d4a020";
        opacity = 0.3 + (Math.random() > 0.92 ? 0.2 : 0) + Math.abs(Math.sin(t * 3)) * 0.1;
        scale = 1.0 + Math.abs(Math.sin(t * 2.8)) * 0.06;
      } else if (modId === "gafas-legendarias") {
        color = "#40b0d8";
        opacity = 0.22 + Math.sin(t * 2.0) * 0.1;
        scale = 1.0 + Math.sin(t * 2.0) * 0.04;
      } else if (modId === "tiempo-arena") {
        color = "#cc8830";
        opacity = 0.2 + Math.abs(Math.sin(t * 0.7)) * 0.12;
        scale = 1.0 + Math.abs(Math.sin(t * 0.7)) * 0.04;
      }
    } else {
      // Hand resolved: strong flash then fade
      if (outcomeTone === "win") {
        color = "#2f7b52";
        opacity = 0.55 + Math.sin(t * 6) * 0.25;
        scale = 1.0 + Math.abs(Math.sin(t * 6)) * 0.12;
        opacity2 = 0.28 + Math.sin(t * 6 + 1.5) * 0.15;
        scale2 = 1.1 + Math.abs(Math.sin(t * 6 + 1.5)) * 0.08;
      } else if (outcomeTone === "lose") {
        color = "#7c2f28";
        opacity = 0.48 + Math.sin(t * 4.5) * 0.18;
        scale = 1.0 + Math.abs(Math.sin(t * 4.5)) * 0.08;
        opacity2 = 0.22;
        scale2 = 1.08;
      } else {
        // draw
        color = "#8c6d3d";
        opacity = 0.3 + Math.sin(t * 3) * 0.12;
        scale = 1.0 + Math.sin(t * 3) * 0.04;
        opacity2 = 0.14;
        scale2 = 1.06;
      }
    }

    ringRef.current.material.color.set(color);
    ringRef.current.material.opacity = opacity;
    ringRef.current.scale.setScalar(scale);

    ring2Ref.current.material.color.set(color);
    ring2Ref.current.material.opacity = opacity2;
    ring2Ref.current.scale.setScalar(scale2);
  });

  return (
    <group name="TensionRings" position={[0, 0.335, 0.08]} rotation={[-Math.PI / 2, 0, 0]}>
      <mesh ref={ringRef}>
        <ringGeometry args={[0.62, 0.74, 48]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      <mesh ref={ring2Ref}>
        <ringGeometry args={[0.76, 0.84, 48]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  );
}

function FeltInlay({ modId }) {
  const accent =
    modId === "gafas-legendarias" ? "#40b0d8" :
    modId === "sustancia-x" ? "#b55bc2" :
    modId === "exodia-bolsillo" ? "#d4a020" :
    "#c89040";

  return (
    <group name="Felt_Inlay" position={[0, 0.255, 0]}>
      {[0.96, 1.42, 1.86].map((radius, index) => (
        <mesh key={radius} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[radius, radius + 0.012, 96]} />
          <meshBasicMaterial color={accent} transparent opacity={index === 1 ? 0.18 : 0.1} depthWrite={false} />
        </mesh>
      ))}

      {[0, 1, 2, 3].map((index) => (
        <mesh key={index} rotation={[-Math.PI / 2, 0, (Math.PI / 2) * index]}>
          <planeGeometry args={[0.016, 3.64]} />
          <meshBasicMaterial color="#d0a15d" transparent opacity={0.075} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
}

function BrassStuds() {
  return (
    <group name="Table_BrassStuds">
      {Array.from({ length: 18 }, (_, index) => {
        const angle = (Math.PI * 2 * index) / 18;
        return (
          <mesh
            key={index}
            position={[Math.sin(angle) * 2.52, 0.3, Math.cos(angle) * 2.52]}
            castShadow
            receiveShadow
          >
            <sphereGeometry args={[0.035, 10, 10]} />
            <meshStandardMaterial color={TABLE_BRASS} roughness={0.32} metalness={0.56} emissive="#4a2508" emissiveIntensity={0.03} />
          </mesh>
        );
      })}
    </group>
  );
}

function TableUnderGlow() {
  return (
    <group name="Table_UnderGlow">
      <mesh position={[0, -0.29, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[2.62, 2.86, 72]} />
        <meshBasicMaterial color="#d58b35" transparent opacity={0.08} depthWrite={false} />
      </mesh>
      <mesh position={[0, -0.46, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[3.1, 72]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.34} depthWrite={false} />
      </mesh>
    </group>
  );
}

function TableProps() {
  const coinPositions = [
    [1.68, 0.36, 0.82],
    [1.75, 0.39, 0.86],
    [1.61, 0.42, 0.9],
    [-1.74, 0.36, -0.74],
    [-1.67, 0.39, -0.8]
  ];

  return (
    <group name="Table_CriolloProps">
      <group name="Mate_Prop" position={[-1.72, 0.42, 0.88]} rotation={[0, -0.24, 0]}>
        <mesh castShadow receiveShadow>
          <cylinderGeometry args={[0.13, 0.18, 0.28, 18]} />
          <meshStandardMaterial color="#5b2d1a" roughness={0.66} metalness={0.08} />
        </mesh>
        <mesh position={[0, 0.16, 0]} castShadow>
          <sphereGeometry args={[0.145, 18, 12]} />
          <meshStandardMaterial color="#6b3a22" roughness={0.7} />
        </mesh>
        <mesh position={[0.11, 0.3, -0.04]} rotation={[0.82, 0.1, -0.28]} castShadow>
          <cylinderGeometry args={[0.013, 0.017, 0.52, 8]} />
          <meshStandardMaterial color="#c7a76d" roughness={0.28} metalness={0.72} />
        </mesh>
      </group>

      <group name="Glass_Prop_A" position={[1.72, 0.42, -0.92]} rotation={[0, 0.18, 0]}>
        <mesh castShadow receiveShadow>
          <cylinderGeometry args={[0.13, 0.1, 0.34, 20, 1, true]} />
          <meshPhysicalMaterial color="#d7ece7" transparent opacity={0.24} roughness={0.05} transmission={0.32} />
        </mesh>
        <mesh position={[0, -0.13, 0]}>
          <cylinderGeometry args={[0.102, 0.092, 0.035, 20]} />
          <meshStandardMaterial color="#6b2c1a" roughness={0.38} transparent opacity={0.72} />
        </mesh>
      </group>

      <group name="Ashtray_Prop" position={[-1.28, 0.35, -1.05]} rotation={[0, 0.42, 0]}>
        <mesh castShadow receiveShadow>
          <cylinderGeometry args={[0.24, 0.2, 0.055, 24]} />
          <meshStandardMaterial color="#27211b" roughness={0.48} metalness={0.28} />
        </mesh>
        <mesh position={[0.12, 0.045, 0.02]} rotation={[0, 0.15, 0]}>
          <boxGeometry args={[0.2, 0.018, 0.038]} />
          <meshStandardMaterial color="#d7c6a8" roughness={0.62} />
        </mesh>
        <mesh position={[0.22, 0.055, 0.025]}>
          <sphereGeometry args={[0.026, 8, 8]} />
          <meshStandardMaterial color="#d47b35" emissive="#d47b35" emissiveIntensity={0.28} roughness={0.5} />
        </mesh>
      </group>

      {coinPositions.map(([x, y, z], index) => (
        <mesh key={index} name={`Coin_${index + 1}`} position={[x, y, z]} rotation={[-Math.PI / 2, 0, index * 0.38]} castShadow receiveShadow>
          <cylinderGeometry args={[0.08, 0.08, 0.018, 18]} />
          <meshStandardMaterial color="#c28a3a" roughness={0.34} metalness={0.64} />
        </mesh>
      ))}
    </group>
  );
}

function getTurnMarkerPose(seatId) {
  const orderedSeats = [...tableSeats].sort((a, b) => a.tableOrder - b.tableOrder);
  const seatIndex = Math.max(0, orderedSeats.findIndex((seat) => seat.seatId === seatId));
  const angle = (Math.PI * 2 * seatIndex) / orderedSeats.length;

  return {
    position: [Math.sin(angle) * 1.72, 0.43, Math.cos(angle) * 1.72],
    rotation: [-Math.PI / 2, 0, -angle]
  };
}

function TurnMarker({ match }) {
  const ringRef = useRef(null);
  const timeRef = useRef(0);
  const isVisible = match.handStarted && !match.handClosed && match.phase !== "role-select";
  const actingSeatId = match.nextActorSeatId ?? match.currentTurnSeatId;
  const actingSeat = tableSeats.find((seat) => seat.seatId === actingSeatId);
  const markerPose = getTurnMarkerPose(actingSeatId);
  const isOwnTeam = actingSeat?.team === "A";
  const color = isOwnTeam ? "#63d5c5" : "#d05a44";
  const label = isOwnTeam ? "EQUIPO SUR" : "EQUIPO NORTE";

  useFrame((_, delta) => {
    timeRef.current += delta;
    if (!ringRef.current) return;

    const pulse = 0.5 + Math.sin(timeRef.current * 2.6) * 0.5;
    ringRef.current.material.opacity = isVisible ? 0.24 + pulse * 0.18 : 0;
    ringRef.current.scale.setScalar(1 + pulse * 0.08);
  });

  if (!isVisible) {
    return null;
  }

  return (
    <group name="TurnMarker_3D" position={markerPose.position}>
      <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.34, 0.46, 40]} />
        <meshBasicMaterial color={color} transparent opacity={0.28} depthWrite={false} />
      </mesh>
      <Text
        position={[0, 0.035, 0]}
        rotation={markerPose.rotation}
        fontSize={0.09}
        color={color}
        anchorX="center"
        anchorY="middle"
        letterSpacing={0.08}
      >
        ACTUA
      </Text>
      <Text
        position={[0, 0.035, 0.18]}
        rotation={markerPose.rotation}
        fontSize={0.055}
        color="#f0ddb4"
        anchorX="center"
        anchorY="middle"
        letterSpacing={0.04}
      >
        {match.nextActorName ?? label}
      </Text>
    </group>
  );
}

// Animated center badge — glows and scales on hand resolution
function CenterBadge({ handClosed, outcomeTone, modId }) {
  const badgeRef = useRef(null);
  const glowRef = useRef(null);
  const timeRef = useRef(0);

  const badgeColor =
    outcomeTone === "win" ? "#2f7b52" :
    outcomeTone === "lose" ? "#7c2f28" :
    outcomeTone === "draw" ? "#8c6d3d" :
    "#8c6238";

  useFrame((_, delta) => {
    timeRef.current += delta;
    const t = timeRef.current;

    if (badgeRef.current) {
      badgeRef.current.material.color.set(badgeColor);

      let scale = 1.0;
      if (handClosed && outcomeTone === "win") {
        scale = 1.0 + Math.abs(Math.sin(t * 4.8)) * 0.08;
      } else if (handClosed && outcomeTone === "lose") {
        scale = 0.96 + Math.sin(t * 3.2) * 0.02;
      } else if (!handClosed) {
        // Breathing while waiting
        scale = 1.0 + Math.sin(t * 1.2) * 0.02;
      }
      badgeRef.current.scale.setScalar(scale);
    }

    if (glowRef.current) {
      let opacity = 0.0;
      if (modId === "sustancia-x") opacity = 0.14 + Math.abs(Math.sin(t * 3.5)) * 0.1;
      else if (modId === "exodia-bolsillo") opacity = 0.18 + (Math.random() > 0.9 ? 0.12 : 0) + Math.abs(Math.sin(t * 2)) * 0.08;
      else if (handClosed && outcomeTone === "win") opacity = 0.22 + Math.abs(Math.sin(t * 5)) * 0.12;
      glowRef.current.material.opacity = opacity;
    }
  });

  return (
    <group position={[0, 0.34, 0.08]} rotation={[-Math.PI / 2, 0, 0]}>
      {/* Glow disc behind badge */}
      <mesh ref={glowRef} position={[0, 0, -0.002]}>
        <circleGeometry args={[0.72, 32]} />
        <meshBasicMaterial color={badgeColor} transparent opacity={0} depthWrite={false} />
      </mesh>
      <mesh ref={badgeRef} receiveShadow>
        <circleGeometry args={[0.52, 32]} />
        <meshStandardMaterial color={badgeColor} roughness={0.9} />
      </mesh>
    </group>
  );
}

function HexagonHub({ handClosed, outcomeTone, modId }) {
  const coreRef = useRef(null);
  const timeRef = useRef(0);

  useFrame((_, delta) => {
    timeRef.current += delta;
    const t = timeRef.current;
    if (!coreRef.current) return;

    let color = "#4a2418";
    let emissive = "#000000";
    let emissiveIntensity = 0;

    if (!handClosed) {
      color = "#3d2416";
      emissive = modId === "sustancia-x" ? "#6e235f" : modId === "exodia-bolsillo" ? "#705214" : "#2f140d";
      emissiveIntensity = modId === "sustancia-x" ? 0.36 + Math.abs(Math.sin(t * 3.2)) * 0.18 : 0.1;
    } else if (outcomeTone === "win") {
      color = "#27462e";
      emissive = "#2c7a4f";
      emissiveIntensity = 0.35 + Math.abs(Math.sin(t * 4.4)) * 0.18;
    } else if (outcomeTone === "lose") {
      color = "#5b231d";
      emissive = "#8d3024";
      emissiveIntensity = 0.28 + Math.abs(Math.sin(t * 3.4)) * 0.14;
    }

    coreRef.current.material.color.set(color);
    coreRef.current.material.emissive.set(emissive);
    coreRef.current.material.emissiveIntensity = emissiveIntensity;
  });

  return (
    <group name="Hexagono_Central" position={[0, 0.255, 0.08]}>
      <mesh position={[0, 0, 0]} receiveShadow castShadow>
        <cylinderGeometry args={[0.96, 1.08, 0.12, 6]} />
        <meshStandardMaterial color="#6a301d" roughness={0.84} />
      </mesh>
      <mesh ref={coreRef} position={[0, 0.08, 0]} receiveShadow castShadow>
        <cylinderGeometry args={[0.46, 0.52, 0.1, 6]} />
        <meshStandardMaterial color="#4a2418" roughness={0.72} emissive="#000000" emissiveIntensity={0} />
      </mesh>
    </group>
  );
}

// Felt surface with modifier-reactive color tint
function FeltSurface({ modId }) {
  const feltRef = useRef(null);
  const timeRef = useRef(0);

  useFrame((_, delta) => {
    timeRef.current += delta;
    const t = timeRef.current;
    if (!feltRef.current) return;

    let color = FELT_BASE;
    if (modId === "sustancia-x") {
      // Felt shifts toward purple-green
      const lerp = 0.5 + 0.5 * Math.sin(t * 1.8);
      const r = Math.round(0x17 + (0x33 - 0x17) * lerp);
      const g = Math.round(0x38 + (0x2a - 0x38) * lerp);
      const b = Math.round(0x26 + (0x3c - 0x26) * lerp);
      color = `rgb(${r},${g},${b})`;
    } else if (modId === "humo-total") {
      color = "#1b1b19";
    } else if (modId === "exodia-bolsillo") {
      color = "#292914";
    } else if (modId === "gafas-legendarias") {
      color = "#173041";
    }

    feltRef.current.material.color.set(color);
  });

  return (
    <mesh ref={feltRef} name="Table_Felt" receiveShadow position={[0, 0.18, 0]}>
      <cylinderGeometry args={[2.15, 2.15, 0.12, 48]} />
      <meshStandardMaterial color={FELT_BASE} roughness={0.88} metalness={0.01} />
    </mesh>
  );
}

export function Table({ match }) {
  const modId = match.activeModifier?.id ?? "";
  const showCurrentPair = match.tableCards.length >= 6 && !match.handClosed;
  const showActiveTableCards = match.tableCards.length > 0 && !match.handClosed;

  return (
    <group name="Table_Setup">
      <TableUnderGlow />

      <mesh name="Table_WoodRim" receiveShadow position={[0, 0, 0]}>
        <cylinderGeometry args={[2.8, 2.8, 0.5, 48]} />
        <meshStandardMaterial color={TABLE_WOOD} roughness={0.54} metalness={0.08} />
      </mesh>

      <mesh name="Table_DarkLowerRim" receiveShadow position={[0, -0.22, 0]}>
        <cylinderGeometry args={[2.76, 2.62, 0.18, 48]} />
        <meshStandardMaterial color={TABLE_WOOD_DARK} roughness={0.74} metalness={0.06} />
      </mesh>

      <FeltSurface modId={modId} />
      <FeltInlay modId={modId} />
      <BrassStuds />
      <TableProps />

      <HexagonHub handClosed={match.handClosed} outcomeTone={match.outcomeTone} modId={modId} />

      <mesh name="Table_Pedestal" castShadow receiveShadow position={[0, -1.05, 0]}>
        <cylinderGeometry args={[0.42, 0.58, 1.75, 24]} />
        <meshStandardMaterial color="#34180d" roughness={0.78} metalness={0.04} />
      </mesh>

      {[0, 1, 2, 3, 4, 5].map((index) => {
        const angle = (Math.PI * 2 * index) / 6;
        return (
          <mesh
            name={`HexSlot_${index + 1}`}
            key={index}
            position={[Math.sin(angle) * 1.28, 0.32, Math.cos(angle) * 1.28]}
            rotation={[0, -angle, 0]}
            castShadow
          >
            <boxGeometry args={[0.22, 0.16, 0.68]} />
            <meshStandardMaterial color="#603019" roughness={0.62} metalness={0.08} />
          </mesh>
        );
      })}

      <CenterBadge handClosed={match.handClosed} outcomeTone={match.outcomeTone} modId={modId} />

      <TensionRing handClosed={match.handClosed} outcomeTone={match.outcomeTone} modId={modId} />
      <TurnMarker match={match} />

      <ArchivedTrickCards trickHistory={match.trickHistory} showCurrentPair={showCurrentPair} handClosed={match.handClosed} />

      {showActiveTableCards
        ? match.tableCards.map((card, index) => {
            const pose = getTableCardPose(card, index);

            return (
              <AnimatedTableCard
                key={`${match.pendingAnimationKey}-${card.owner}-${card.id}`}
                animationKey={match.pendingAnimationKey}
                card={card}
                position={pose.position}
                rotation={pose.rotation}
              />
            );
          })
        : null}

      <group name="Decks_Stack" position={[2.62, 0.2, -0.38]} rotation={[0, -0.28, 0]}>
        {["Mazo", "Descarte"].map((label, index) => (
          <group key={label} name={`Deck_${label}`} position={[0, index * 0.1, index * 0.16]}>
            <RoundedBox args={[0.7, 0.05, 1]} radius={0.05}>
              <meshStandardMaterial
                color={index === 0 ? "#c49b48" : "#71442c"}
                roughness={0.68}
              />
            </RoundedBox>
            <Text
              position={[0, 0.07, 0]}
              rotation={[-Math.PI / 2, 0, 0]}
              fontSize={0.1}
              color="#1d1610"
              anchorX="center"
              anchorY="middle"
            >
              {label}
            </Text>
          </group>
        ))}
      </group>
    </group>
  );
}
