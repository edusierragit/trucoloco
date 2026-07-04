import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { RoundedBox, Text, useGLTF, useTexture } from "@react-three/drei";
import { Box3, Vector3 } from "three";
import { getCardRankLabel, getCardRankNumber, getCardSuitCode } from "../data/cards";
import { tableSeats } from "../data/characters";
import { assetUrl } from "../assetUrl.js";
import { sfx } from "../audio/sfx";

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
const TABLE_WOOD = "#3d1a0e";
const TABLE_WOOD_DARK = "#1d0b06";
const TABLE_BRASS = "#c08a3f";
const FELT_BASE = "#102e20";
const FELT_DEEP = "#091d14";

function CardImagePlane({ image, width, height, y = 0.036, flip = false }) {
  const texture = useTexture(image);
  
  return (
    <mesh
      position={[0, flip ? -y : y, 0]}
      rotation={flip ? [Math.PI / 2, 0, Math.PI] : [-Math.PI / 2, 0, 0]}
    >
      <planeGeometry args={[width, height]} />
      {/* polygonOffset: a distancia de mesa el depth buffer no separa 2.5mm — sin esto la textura pierde contra la caja crema (z-fighting) */}
      <meshBasicMaterial map={texture} toneMapped={false} polygonOffset polygonOffsetFactor={-4} polygonOffsetUnits={-4} />
    </mesh>
  );
}

function AnimatedTableCard({ card, position, rotation = [0, 0, 0], animationKey }) {
  const groupRef = useRef(null);
  const shadowRef = useRef(null);
  const progressRef = useRef(0);
  // the card flies in from the hand of whoever threw it, not from a generic side
  const ownerSeat = card.seatId ? tableSeats.find((seat) => seat.seatId === card.seatId) : null;
  const fromX = ownerSeat ? ownerSeat.position[0] * 0.78 : card.side === "A" ? 0 : 1.9;
  const fromZ = ownerSeat ? ownerSeat.position[2] * 0.78 : card.side === "A" ? 3.2 : -2.8;
  const fromY = ownerSeat ? 1.18 : 1.6;
  const initialRotX = 0.62;
  const initialRotY = card.side === "A" ? -0.18 : 0.18;
  const initialRotZ = card.side === "A" ? -0.34 : 0.34;

  // played cards read as real naipes, not furniture — keep them modest on the felt
  const TABLE_CARD_SCALE = 0.7;
  // giro natural determinístico (hash del id): igual en todas las pantallas del espejo
  const idHash = String(card.id ?? "x").split("").reduce((acc, ch) => (acc * 31 + ch.charCodeAt(0)) % 997, 7);
  const settleYaw = ((idHash / 997) - 0.5) * 0.22;

  useEffect(() => {
    progressRef.current = 0;
        if (groupRef.current) {
      groupRef.current.rotation.order = "YXZ";
      groupRef.current.position.set(fromX, fromY, fromZ);
      groupRef.current.rotation.set(initialRotX, initialRotY, initialRotZ);
      groupRef.current.scale.setScalar(0.82 * TABLE_CARD_SCALE);
    }
  }, [animationKey, fromX, fromZ, card.owner, initialRotY, initialRotZ]);

  useFrame((_, delta) => {
    if (!groupRef.current) {
      return;
    }

    progressRef.current = Math.min(1, progressRef.current + delta * 2.8);
    const raw = progressRef.current;
    const t = 1 - Math.pow(1 - raw, 3);
    // rebote al asentarse: la carta toca el fieltro y respira una vez
    const settle = raw > 0.82 ? Math.sin((raw - 0.82) / 0.18 * Math.PI) * (1 - raw) * 0.5 : 0;

    groupRef.current.position.x = fromX + (position[0] - fromX) * t;
    groupRef.current.position.y = fromY + (position[1] - fromY) * t + settle * 0.18;
    groupRef.current.position.z = fromZ + (position[2] - fromZ) * t;
    groupRef.current.rotation.x = initialRotX + (rotation[0] - initialRotX) * t;
    groupRef.current.rotation.y = initialRotY + ((rotation[1] ?? 0) + settleYaw - initialRotY) * t;
    groupRef.current.rotation.z = initialRotZ + (rotation[2] - initialRotZ) * t;
    const scale = (0.82 + (1 - 0.82) * t + settle * 0.06) * TABLE_CARD_SCALE;
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
      <RoundedBox name={`Card_${card.owner}_${card.id}`} args={[1.08, 0.045, 1.58]} radius={0.02} castShadow receiveShadow>
        <meshStandardMaterial color={CARD_EDGE} roughness={0.72} />
      </RoundedBox>
      <mesh position={[0, 0.026, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.98, 1.46]} />
        <meshStandardMaterial color={CARD_FACE} roughness={0.58} />
      </mesh>
      {card.image ? (
        <>
          {/* la carta jugada es pública: la cara se ve desde AMBOS lados de la mesa */}
          <CardImagePlane image={card.image} width={0.98} height={1.46} y={0.034} />
          <CardImagePlane image={card.image} width={0.98} height={1.46} y={0.034} flip />
          {/* los SVG son tenues: número y palo GRANDES para leer desde cualquier silla */}
          {[false, true].map((flipSide) => (
            <group key={flipSide ? "b" : "f"} rotation={flipSide ? [Math.PI, 0, 0] : [0, 0, 0]}>
              <mesh position={[0, 0.038, -0.52]} rotation={[-Math.PI / 2, 0, 0]}>
                <planeGeometry args={[0.9, 0.34]} />
                <meshBasicMaterial color={suitColor[card.suit] ?? "#8a6a3c"} transparent opacity={0.85} toneMapped={false} polygonOffset polygonOffsetFactor={-6} polygonOffsetUnits={-6} />
              </mesh>
              <Text
                position={[-0.16, 0.042, -0.52]}
                rotation={[-Math.PI / 2, 0, 0]}
                fontSize={0.3}
                fontWeight={800}
                color="#16100a"
                anchorX="center"
                anchorY="middle"
              >
                {String(getCardRankNumber(card))}
              </Text>
              <Text
                position={[0.22, 0.042, -0.52]}
                rotation={[-Math.PI / 2, 0, 0]}
                fontSize={0.13}
                color="#16100a"
                anchorX="center"
                anchorY="middle"
                letterSpacing={0.06}
              >
                {getCardSuitCode(card)}
              </Text>
            </group>
          ))}
        </>
      ) : (
        <>
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
        </>
      )}
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

      <RoundedBox args={[0.86, 0.045, 1.28]} radius={0.02} castShadow receiveShadow>
        <meshStandardMaterial color={CARD_EDGE} roughness={0.72} />
      </RoundedBox>

      {faceDown ? (
        <>
          <RoundedBox args={[0.78, 0.022, 1.18]} radius={0.01} position={[0, 0.014, 0]} castShadow receiveShadow>
            <meshStandardMaterial color={CARD_BACK} roughness={0.62} />
          </RoundedBox>
          {card.backImage ? (
            <CardImagePlane image={card.backImage} width={0.78} height={1.18} y={0.032} />
          ) : (
            <>
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
          )}
        </>
      ) : (
        <>
          <RoundedBox args={[0.78, 0.022, 1.18]} radius={0.01} position={[0, 0.014, 0]} castShadow receiveShadow>
            <meshStandardMaterial color={CARD_FACE} roughness={0.58} />
          </RoundedBox>
          {card.image ? (
            <CardImagePlane image={card.image} width={0.78} height={1.18} y={0.032} />
          ) : (
            <>
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
        </>
      )}
    </group>
  );
}

function ArchivedTrickCards({ trickHistory, showCurrentPair, handClosed }) {
  const archivedTricks = showCurrentPair ? trickHistory.slice(0, -1) : trickHistory;
  void handClosed;

  // como en el truco real: las vueltas resueltas se doblan boca abajo junto al
  // mazo — el centro de la mesa queda libre para las cartas vivas
  return (
    <group name="TrickHistory3D" position={[2.56, 0.2, 0.74]} rotation={[0, -0.3, 0]}>
      {archivedTricks.map((trick, index) => {
        const cards = trick.cards ?? [trick.humanCard, trick.rivalCard].filter(Boolean);

        return (
          <group key={`trick-${trick.index}`} position={[0, 0.05 + index * 0.075, 0]} rotation={[0, index * 0.22, 0]} scale={0.42}>
            {/* pila prolija: las seis cartas dobladas casi alineadas, apenas giradas */}
            {cards.slice(0, 6).map((play, cardIndex) => (
              <SceneHandCard
                key={`${trick.index}-${play.seatId ?? cardIndex}`}
                card={play.card ?? play}
                position={[cardIndex * 0.008 - 0.02, cardIndex * 0.012, cardIndex * 0.006]}
                rotation={[0, (cardIndex % 2 === 0 ? -1 : 1) * 0.05, 0]}
                faceDown
              />
            ))}
          </group>
        );
      })}
    </group>
  );
}

// las cartas jugadas se PARAN inclinadas en anillo alrededor del centro,
// de cara hacia afuera: desde cualquier asiento leés las del lado opuesto
// de frente (una carta plana sobre el fieltro es invisible a la altura de ojos)
const tableCardPoses = Array.from({ length: 6 }, (_, i) => {
  const angle = (Math.PI * 2 * i) / 6 + Math.PI / 6;
  return {
    position: [Math.sin(angle) * 1.32, 0.415, Math.cos(angle) * 1.32 + 0.08],
    rotation: [0, angle + Math.PI, 0] // plana frente a su dueño, cabecera hacia el centro
  };
});

function CardTableauGuides({ active, playedCount }) {
  return (
    <group name="Table_CardTableauGuides">
      {tableCardPoses.map((pose, index) => {
        const isNext = active && index === playedCount;
        const isPlayed = index < playedCount;

        return (
          <RoundedBox
            key={index}
            args={[0.98, 0.01, 1.44]}
            radius={0.04}
            position={[pose.position[0], 0.266, pose.position[2]]}
            rotation={[0, pose.rotation[1] ?? 0, 0]}
            receiveShadow
          >
            <meshStandardMaterial
              color={isNext ? "#172d22" : "#0d1b14"}
              emissive={isNext ? "#b98935" : "#000000"}
              emissiveIntensity={isNext ? 0.08 : 0}
              roughness={0.94}
              metalness={0.01}
              transparent
              opacity={isPlayed ? 0.04 : isNext ? 0.28 : 0.105}
            />
          </RoundedBox>
        );
      })}
    </group>
  );
}

function LastPlayedMarker({ tableCards }) {
  const markerRef = useRef(null);
  const lastCard = tableCards[tableCards.length - 1];

  useFrame((state) => {
    if (!markerRef.current) return;
    const pulse = 0.5 + Math.sin(state.clock.elapsedTime * 5.2) * 0.5;
    markerRef.current.material.opacity = 0.18 + pulse * 0.18;
    markerRef.current.scale.setScalar(1 + pulse * 0.08);
  });

  if (!lastCard) return null;

  const pose = getTableCardPose(lastCard, tableCards.length - 1);

  return (
    <group name="Table_LastPlayedMarker" position={[pose.position[0], 0.432, pose.position[2]]} rotation={[-Math.PI / 2, 0, 0]}>
      <mesh ref={markerRef}>
        <ringGeometry args={[0.46, 0.56, 54]} />
        <meshBasicMaterial color={lastCard.side === "A" ? "#63d5c5" : "#d05a44"} transparent opacity={0.2} depthWrite={false} />
      </mesh>
    </group>
  );
}

// cada carta se para frente a SU dueño, mirando hacia afuera: así ves de frente
// las cartas de los rivales de enfrente, y de atrás las de tu lado
const getTableCardPose = (card, index) => {
  const seat = card.seatId ? tableSeats.find((s) => s.seatId === card.seatId) : null;
  if (seat) {
    const angle = Math.atan2(seat.position[0], seat.position[2]);
    return {
      position: [Math.sin(angle) * 1.32, 0.415, Math.cos(angle) * 1.32 + 0.08],
      rotation: [0, angle + Math.PI, 0]
    };
  }
  return tableCardPoses[card.tableIndex ?? index] ?? {
    position: [card.side === "A" ? -0.82 : 0.82, 0.42, 0.18],
    rotation: [0, 0, (card.side === "A" ? -1 : 1) * 0.08]
  };
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

function FeltInlay({ modId, lowPower = false }) {
  const accent =
    modId === "gafas-legendarias" ? "#40b0d8" :
    modId === "sustancia-x" ? "#b55bc2" :
    modId === "exodia-bolsillo" ? "#d4a020" :
    "#c89040";
  const rings = lowPower ? [1.42] : [0.96, 1.42, 1.86];
  const radialLines = lowPower ? [0, 2] : [0, 1, 2, 3];
  const segments = lowPower ? 48 : 96;

  return (
    <group name="Felt_Inlay" position={[0, 0.255, 0]}>
      {rings.map((radius, index) => (
        <mesh key={radius} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[radius, radius + 0.012, segments]} />
          <meshBasicMaterial color={accent} transparent opacity={index === 1 ? 0.18 : 0.1} depthWrite={false} />
        </mesh>
      ))}

      {radialLines.map((index) => (
        <mesh key={index} rotation={[-Math.PI / 2, 0, (Math.PI / 2) * index]}>
          <planeGeometry args={[0.016, 3.64]} />
          <meshBasicMaterial color="#d0a15d" transparent opacity={0.075} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
}

function BrassStuds({ lowPower = false }) {
  const studCount = lowPower ? 10 : 18;

  return (
    <group name="Table_BrassStuds">
      {Array.from({ length: studCount }, (_, index) => {
        const angle = (Math.PI * 2 * index) / studCount;
        return (
          <mesh
            key={index}
            position={[Math.sin(angle) * 2.52, 0.3, Math.cos(angle) * 2.52]}
            castShadow
            receiveShadow
          >
            <sphereGeometry args={[0.035, lowPower ? 8 : 10, lowPower ? 6 : 10]} />
            <meshStandardMaterial color={TABLE_BRASS} roughness={0.26} metalness={0.68} emissive="#3a1c06" emissiveIntensity={0.025} />
          </mesh>
        );
      })}
    </group>
  );
}

function TableRimHighlights({ lowPower = false }) {
  const segments = lowPower ? 64 : 112;

  return (
    <group name="Table_RimHighlights">
      {/* [VISUAL] Thin brass lips catch the warm key light and make the mesa feel built, not primitive. */}
      <mesh position={[0, 0.285, 0]} rotation={[Math.PI / 2, 0, 0]} receiveShadow>
        <torusGeometry args={[2.76, 0.018, 8, segments]} />
        <meshStandardMaterial color={TABLE_BRASS} roughness={0.24} metalness={0.72} emissive="#2a1304" emissiveIntensity={0.02} />
      </mesh>
      <mesh position={[0, 0.295, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[2.18, 0.01, 8, segments]} />
        <meshStandardMaterial color="#7d4b22" roughness={0.36} metalness={0.28} />
      </mesh>
    </group>
  );
}

function TableUnderGlow({ lowPower = false }) {
  const segments = lowPower ? 40 : 72;

  return (
    <group name="Table_UnderGlow">
      <mesh position={[0, -0.29, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[2.62, 2.86, segments]} />
        <meshBasicMaterial color="#d58b35" transparent opacity={0.055} depthWrite={false} />
      </mesh>
      <mesh position={[0, -0.46, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[3.1, segments]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.42} depthWrite={false} />
      </mesh>
    </group>
  );
}

function TableProps({ lowPower = false }) {
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
          <meshStandardMaterial color="#4d2516" roughness={0.72} metalness={0.06} />
        </mesh>
        <mesh position={[0, 0.16, 0]} castShadow>
          <sphereGeometry args={[0.145, 18, 12]} />
          <meshStandardMaterial color="#5e321f" roughness={0.76} />
        </mesh>
        <mesh position={[0.11, 0.3, -0.04]} rotation={[0.82, 0.1, -0.28]} castShadow>
          <cylinderGeometry args={[0.013, 0.017, 0.52, 8]} />
          <meshStandardMaterial color="#c7a76d" roughness={0.22} metalness={0.78} />
        </mesh>
      </group>

      <group name="Glass_Prop_A" position={[1.72, 0.42, -0.92]} rotation={[0, 0.18, 0]}>
        <mesh castShadow receiveShadow>
          <cylinderGeometry args={[0.13, 0.1, 0.34, 20, 1, true]} />
          <meshPhysicalMaterial color="#d7ece7" transparent opacity={0.18} roughness={0.04} transmission={0.36} />
        </mesh>
        <mesh position={[0, -0.13, 0]}>
          <cylinderGeometry args={[0.102, 0.092, 0.035, 20]} />
          <meshStandardMaterial color="#5b2415" roughness={0.46} transparent opacity={0.64} />
        </mesh>
      </group>

      {!lowPower ? (
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
      ) : null}

      {!lowPower ? coinPositions.map(([x, y, z], index) => (
        <mesh key={index} name={`Coin_${index + 1}`} position={[x, y, z]} rotation={[-Math.PI / 2, 0, index * 0.38]} castShadow receiveShadow>
          <cylinderGeometry args={[0.08, 0.08, 0.018, 18]} />
          <meshStandardMaterial color={TABLE_BRASS} roughness={0.25} metalness={0.72} />
        </mesh>
      )) : null}
    </group>
  );
}

function DuelProp({ position, rotation = [0, 0, 0], flipped = false }) {
  const gripX = flipped ? -0.16 : 0.16;

  return (
    <group name="Mesa_Duelo_Prop" position={position} rotation={rotation}>
      <RoundedBox args={[0.62, 0.075, 0.14]} radius={0.035} position={[0.03, 0.02, 0]} castShadow receiveShadow>
        <meshStandardMaterial color="#17110e" roughness={0.44} metalness={0.42} />
      </RoundedBox>
      <mesh position={[-0.34, 0.02, 0]} rotation={[0, 0, Math.PI / 2]} castShadow receiveShadow>
        <cylinderGeometry args={[0.055, 0.055, 0.28, 18]} />
        <meshStandardMaterial color="#2b241d" roughness={0.36} metalness={0.55} />
      </mesh>
      <RoundedBox args={[0.22, 0.055, 0.34]} radius={0.028} position={[gripX, -0.055, 0.16]} rotation={[0.34, 0, flipped ? -0.32 : 0.32]} castShadow receiveShadow>
        <meshStandardMaterial color="#5b2b16" roughness={0.74} metalness={0.04} />
      </RoundedBox>
      <RoundedBox args={[0.46, 0.026, 0.03]} radius={0.01} position={[-0.44, 0.035, 0]}>
        <meshStandardMaterial color="#8a6a45" roughness={0.28} metalness={0.62} />
      </RoundedBox>
    </group>
  );
}

function DecorativeCardFan() {
  const cards = [
    [-0.2, -0.1, 0.22],
    [-0.1, -0.03, 0.1],
    [0, 0, 0],
    [0.1, -0.03, -0.1],
    [0.2, -0.1, -0.22]
  ];

  return (
    <group name="Mesa_Cartas_Duelo" position={[0.72, 0.44, -1.22]} rotation={[-Math.PI / 2, 0, -0.2]}>
      {cards.map(([x, z, angle], index) => (
        <group key={index} position={[x, 0.004 * index, z]} rotation={[0, 0, angle]}>
          <RoundedBox args={[0.28, 0.018, 0.42]} radius={0.022} castShadow receiveShadow>
            <meshStandardMaterial color="#eadfbe" roughness={0.58} metalness={0.02} />
          </RoundedBox>
          <RoundedBox args={[0.2, 0.02, 0.3]} radius={0.012} position={[0, 0.012, 0]}>
            <meshStandardMaterial color={index % 2 ? "#7a1f18" : "#1d4151"} roughness={0.66} />
          </RoundedBox>
        </group>
      ))}
    </group>
  );
}

function TableDangerProps({ lowPower = false }) {
  if (lowPower) return null;

  return (
    <group name="Table_Danger_Props">
      <DuelProp position={[-1.28, 0.46, 1.28]} rotation={[0, 0.82, 0]} />
      <DuelProp position={[1.36, 0.46, 1.2]} rotation={[0, -0.88, 0]} flipped />
      <DecorativeCardFan />
      <mesh name="Duelo_Claim_Ring" position={[0, 0.456, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1.02, 1.045, 96]} />
        <meshBasicMaterial color="#f0ddb4" transparent opacity={0.22} depthWrite={false} />
      </mesh>
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

// quién es MANO esta mano: anillo quieto y sobrio en su lugar de la mesa
function ManoMarker({ match }) {
  if (!match.manoSeatId || !match.handStarted || match.handClosed) return null;
  const pose = getTurnMarkerPose(match.manoSeatId);
  return (
    <group name="Mano_Marker" position={[pose.position[0], pose.position[1] - 0.012, pose.position[2]]} rotation={pose.rotation}>
      <mesh>
        <ringGeometry args={[0.5, 0.53, 40]} />
        <meshBasicMaterial color="#d9b36c" transparent opacity={0.4} depthWrite={false} />
      </mesh>
      <Text position={[0, -0.66, 0.01]} fontSize={0.09} color="#d9b36c" anchorX="center" anchorY="middle" letterSpacing={0.2}>
        MANO
      </Text>
    </group>
  );
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
    <group name="Hexagono_Central" position={[0, 0.255, 0.08]} scale={0.55}>
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

function ImportedHexBoardAsset() {
  const { scene } = useGLTF(assetUrl("assets/characters/tablero.glb"));
  const modelRef = useRef(null);
  const glowRef = useRef(null);
  const { clonedScene, normalizedScale, offset } = useMemo(() => {
    const clone = scene.clone();

    clone.traverse((child) => {
      if (!child.isMesh) return;

      child.castShadow = true;
      child.receiveShadow = true;

      const usesMaterialArray = Array.isArray(child.material);
      const materials = usesMaterialArray ? child.material : [child.material];
      child.material = materials.map((material) => {
        if (!material) return material;
        const nextMaterial = material.clone();
        if ("roughness" in nextMaterial) nextMaterial.roughness = Math.max(nextMaterial.roughness ?? 0.64, 0.56);
        if ("metalness" in nextMaterial) nextMaterial.metalness = Math.min(nextMaterial.metalness ?? 0.04, 0.18);
        return nextMaterial;
      });
      if (!usesMaterialArray) child.material = child.material[0];
    });

    const bounds = new Box3().setFromObject(clone);
    const size = new Vector3();
    const center = new Vector3();
    bounds.getSize(size);
    bounds.getCenter(center);

    const maxFootprint = Math.max(size.x, size.z, 0.001);
    const scaleFactor = 1.74 / maxFootprint;

    return {
      clonedScene: clone,
      normalizedScale: scaleFactor,
      offset: [-center.x * scaleFactor, -bounds.min.y * scaleFactor, -center.z * scaleFactor]
    };
  }, [scene]);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (modelRef.current) {
      modelRef.current.position.y = Math.sin(t * 1.4) * 0.018;
      modelRef.current.rotation.y = Math.sin(t * 0.42) * 0.055;
    }
    if (glowRef.current) {
      glowRef.current.material.opacity = 0.18 + Math.sin(t * 2.2) * 0.035;
      glowRef.current.scale.setScalar(1 + Math.sin(t * 1.7) * 0.035);
    }
  });

  return (
    <group name="Tablero_Holograma_Asset">
      <mesh ref={glowRef} position={[0, -0.014, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.88, 72]} />
        <meshBasicMaterial color="#f0a34f" transparent opacity={0.18} depthWrite={false} />
      </mesh>
      <mesh position={[0, -0.002, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.82, 0.96, 96]} />
        <meshBasicMaterial color="#91e9f6" transparent opacity={0.18} depthWrite={false} />
      </mesh>
      <primitive
        ref={modelRef}
        object={clonedScene}
        scale={normalizedScale * 1.12}
        position={offset}
        dispose={null}
      />
    </group>
  );
}

function ImportedHexBoard({ handClosed, outcomeTone, modId }) {
  return (
    <group name="Imported_Tablero_Central" position={[0, 0.34, 0.08]} rotation={[0, 0, 0]} scale={0.5}>
      <Suspense fallback={null}>
        <ImportedHexBoardAsset />
      </Suspense>
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
      color = "#151613";
    } else if (modId === "exodia-bolsillo") {
      color = "#232411";
    } else if (modId === "gafas-legendarias") {
      color = "#102b3a";
    }

    feltRef.current.material.color.set(color);
  });

  return (
    <mesh ref={feltRef} name="Table_Felt" receiveShadow position={[0, 0.18, 0]}>
      <cylinderGeometry args={[2.15, 2.15, 0.12, 48]} />
      <meshStandardMaterial color={FELT_BASE} roughness={0.94} metalness={0.005} />
    </mesh>
  );
}

export function Table({ match, performanceMode = "high" }) {
  const modId = match.activeModifier?.id ?? "";
  const showCurrentPair = match.tableCards.length >= 6 && !match.handClosed;
  const showActiveTableCards = match.tableCards.length > 0 && !match.handClosed;
  const lowPower = performanceMode === "low";

  return (
    <group name="Table_Setup">
      <TableUnderGlow lowPower={lowPower} />

      <mesh name="Table_WoodRim" receiveShadow position={[0, 0, 0]}>
        <cylinderGeometry args={[2.8, 2.8, 0.5, 48]} />
        <meshStandardMaterial color={TABLE_WOOD} roughness={0.5} metalness={0.06} />
      </mesh>

      <mesh name="Table_DarkLowerRim" receiveShadow position={[0, -0.22, 0]}>
        <cylinderGeometry args={[2.76, 2.62, 0.18, 48]} />
        <meshStandardMaterial color={TABLE_WOOD_DARK} roughness={0.8} metalness={0.04} />
      </mesh>

      <TableRimHighlights lowPower={lowPower} />
      <FeltSurface modId={modId} />
      <FeltInlay modId={modId} lowPower={lowPower} />
      <BrassStuds lowPower={lowPower} />
      <TableProps lowPower={lowPower} />
      <TableDangerProps lowPower={lowPower} />

      <ImportedHexBoard handClosed={match.handClosed} outcomeTone={match.outcomeTone} modId={modId} />

      <mesh name="Table_Pedestal" castShadow receiveShadow position={[0, -1.05, 0]}>
        <cylinderGeometry args={[0.42, 0.58, 1.75, 24]} />
        <meshStandardMaterial color="#34180d" roughness={0.78} metalness={0.04} />
      </mesh>

      <TensionRing handClosed={match.handClosed} outcomeTone={match.outcomeTone} modId={modId} />
      <TurnMarker match={match} />
      <ManoMarker match={match} />
      <CardTableauGuides active={showActiveTableCards} playedCount={match.tableCards.length} />
      <LastPlayedMarker tableCards={match.tableCards} />

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

// ─────────────────────────────────────────────────────────────────────────────
// HeldHand — Liar's Bar style: your cards physically held in front of the
// camera while seated. Hover raises a card, click throws it to the felt.
// Mounted OUTSIDE the room group (world space), only in "seat" view.
// ─────────────────────────────────────────────────────────────────────────────

function HeldCardFace({ image, dimmed }) {
  const texture = useTexture(image);
  return (
    <mesh position={[0, 0, 0.011]}>
      <planeGeometry args={[0.285, 0.43]} />
      <meshBasicMaterial map={texture} toneMapped={false} color={dimmed ? "#9c9285" : "#ffffff"} />
    </mesh>
  );
}

function HeldCard({ card, offset, hovered, selected, dimmed, onOver, onOut, onPlay }) {
  const ref = useRef(null);

  useFrame((_, delta) => {
    const g = ref.current;
    if (!g) return;
    const lift = selected ? 0.26 : hovered ? 0.15 : 0;
    const tx = offset * 0.315;
    const ty = -Math.abs(offset) * 0.05 + lift;
    const tz = selected ? 0.16 : hovered ? 0.1 : 0;
    const rz = selected ? -offset * 0.06 : -offset * 0.17;
    const alpha = 1 - Math.exp(-Math.min(delta, 0.1) * 13);
    g.position.x += (tx - g.position.x) * alpha;
    g.position.y += (ty - g.position.y) * alpha;
    g.position.z += (tz - g.position.z) * alpha;
    g.rotation.z += (rz - g.rotation.z) * alpha;
    const targetScale = selected ? 1.14 : hovered ? 1.09 : 1;
    const s = g.scale.x + (targetScale - g.scale.x) * alpha;
    g.scale.setScalar(s);
  });

  return (
    <group ref={ref} name={`HeldCard_${card.id}`}>
      <group
        onPointerOver={(event) => {
          event.stopPropagation();
          onOver();
        }}
        onPointerOut={(event) => {
          event.stopPropagation();
          onOut();
        }}
        onClick={(event) => {
          event.stopPropagation();
          onPlay();
        }}
      >
        <RoundedBox args={[0.33, 0.475, 0.018]} radius={0.02} castShadow>
          <meshStandardMaterial color={CARD_EDGE} roughness={0.7} />
        </RoundedBox>
        <mesh position={[0, 0, 0.0095]}>
          <planeGeometry args={[0.305, 0.45]} />
          <meshBasicMaterial color={CARD_FACE} toneMapped={false} />
        </mesh>
        {card.image ? (
          <Suspense fallback={null}>
            <HeldCardFace image={card.image} dimmed={dimmed} />
          </Suspense>
        ) : (
          <Text position={[0, 0, 0.012]} fontSize={0.055} maxWidth={0.26} color={CARD_TEXT} anchorX="center" anchorY="middle">
            {card.name}
          </Text>
        )}
        {(hovered || selected) && !dimmed ? (
          <mesh position={[0, 0, -0.012]}>
            <planeGeometry args={[0.39, 0.53]} />
            <meshBasicMaterial color={selected ? "#91e9f6" : "#ffd98a"} transparent opacity={selected ? 0.5 : 0.35} toneMapped={false} />
          </mesh>
        ) : null}
        {selected && !dimmed ? (
          <Text position={[0, -0.31, 0.02]} fontSize={0.055} color="#91e9f6" anchorX="center" anchorY="middle" letterSpacing={0.14}>
            TOCÁ DE NUEVO PARA TIRAR
          </Text>
        ) : null}
      </group>
    </group>
  );
}

export function HeldHand({ match }) {
  const groupRef = useRef(null);
  const [hoverId, setHoverId] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const canPlay = Boolean(match.canPlayCard);
  const cards = match.humanHand ?? [];

  useEffect(() => {
    if (!canPlay) {
      setHoverId(null);
      setSelectedId(null);
    }
  }, [canPlay]);

  useEffect(
    () => () => {
      document.body.style.cursor = "auto";
    },
    []
  );

  useFrame((state) => {
    const g = groupRef.current;
    if (!g) return;
    // viewmodel: ride the camera, park the fan low like cards held at the chest
    g.position.copy(state.camera.position);
    g.quaternion.copy(state.camera.quaternion);
    g.translateZ(-1.08);
    g.translateY(-0.45);
    g.rotateX(0.3);
    g.rotateZ(Math.sin(state.clock.elapsedTime * 0.7) * 0.01); // breathing
  });

  if (!cards.length) return null;

  const midpoint = (cards.length - 1) / 2;

  return (
    <group ref={groupRef} name="HeldHand3D" renderOrder={40}>
      {cards.map((card, index) => (
        <HeldCard
          key={card.handIndex}
          card={card}
          offset={index - midpoint}
          hovered={hoverId === card.handIndex}
          selected={selectedId === card.handIndex}
          dimmed={!canPlay}
          onOver={() => {
            if (!canPlay) return;
            setHoverId(card.handIndex);
            sfx.tick();
            document.body.style.cursor = "pointer";
          }}
          onOut={() => {
            setHoverId((value) => (value === card.handIndex ? null : value));
            document.body.style.cursor = "auto";
          }}
          onPlay={() => {
            if (!canPlay) return;
            // dos toques: el primero la levanta (pensala), el segundo la tira
            if (selectedId !== card.handIndex) {
              setSelectedId(card.handIndex);
              sfx.tick();
              return;
            }
            document.body.style.cursor = "auto";
            setSelectedId(null);
            match.playCard(card.handIndex);
          }}
        />
      ))}
    </group>
  );
}
