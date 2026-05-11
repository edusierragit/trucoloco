import { useEffect, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Vector3 } from "three";
import { characterSkins } from "../../data/characters";
import { CharacterFigure } from "../CharacterFigure";

const ROOM_BOUNDS = {
  minX: -8.55,
  maxX: 4.45,
  minZ: -3.55,
  maxZ: 3.85
};

const TABLE_CLEAR_RADIUS = 3.08;
const PLAYER_Y = 0.02;
const WALK_SPEED = 1.28;
const RUN_SPEED = 2.48;
const ROOM_WORLD_OFFSET = new Vector3(0, -1.35, 0.25);
const WALK_AVATAR_SCALE = 0.94;
const WALK_CAMERA_HEIGHT = 2.92;
const WALK_CAMERA_DISTANCE = 3.88;
const WALK_CAMERA_SIDE_OFFSET = 0.86;
const WALK_TABLE_FOCUS_TARGET = new Vector3(ROOM_WORLD_OFFSET.x, ROOM_WORLD_OFFSET.y + 0.05, ROOM_WORLD_OFFSET.z);
const TRIPO_CALIBRATION_STORAGE_KEY = "trucoloco:tripo-animation-overrides:v1";

const WALK_HOTSPOTS = [
  { id: "door", x: 0, z: 3.45, radius: 0.95 },
  { id: "bar", x: 0, z: -3.12, radius: 1.05 },
  { id: "ring", x: -7.45, z: -0.9, radius: 1.08 },
  // [VISUAL] The interact ring is wider than the collision clear radius so the player reads as beside the mesa.
  { id: "table", x: 0, z: 0, radius: 3.42 }
];

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function keepOutOfTable(position) {
  const distance = Math.hypot(position.x, position.z);
  if (distance >= TABLE_CLEAR_RADIUS || distance === 0) return;

  const push = TABLE_CLEAR_RADIUS / distance;
  position.x *= push;
  position.z *= push;
}

function getNearestHotspot(position) {
  return WALK_HOTSPOTS.find((hotspot) => {
    const distance = Math.hypot(position.x - hotspot.x, position.z - hotspot.z);
    return distance <= hotspot.radius;
  })?.id ?? null;
}

function readStoredClipOverrides(characterId) {
  if (!characterId || typeof window === "undefined") return {};

  try {
    const parsed = JSON.parse(window.localStorage.getItem(TRIPO_CALIBRATION_STORAGE_KEY) ?? "{}");
    return parsed?.[characterId] && typeof parsed[characterId] === "object" ? parsed[characterId] : {};
  } catch {
    return {};
  }
}

function writeStoredClipOverrides(characterId, overrides) {
  if (!characterId || typeof window === "undefined") return;

  try {
    const parsed = JSON.parse(window.localStorage.getItem(TRIPO_CALIBRATION_STORAGE_KEY) ?? "{}");
    const nextOverrides = Object.fromEntries(Object.entries(overrides).filter(([, value]) => Boolean(value)));
    const next = { ...parsed };

    if (Object.keys(nextOverrides).length) {
      next[characterId] = nextOverrides;
    } else {
      delete next[characterId];
    }

    window.localStorage.setItem(TRIPO_CALIBRATION_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Calibration is a dev convenience; ignore private-mode/storage failures.
  }
}

function getMappedClipName(character, mode, overrides = {}) {
  const skin = character?.skinId ? characterSkins[character.skinId] : null;
  if (!skin || !mode || mode === "idle") return null;

  const override = overrides[mode];
  if (override) return override;

  const mapped = skin.animationClipMap?.[mode] ?? (mode === "run" ? skin.animationClipMap?.walk : null);
  return typeof mapped === "string" ? mapped : null;
}

function AvatarBody({ refs, character, motionMode }) {
  const skin = character?.skinId ? characterSkins[character.skinId] : null;
  const facingOffset = skin?.walkFacingOffset ?? 0;

  if (character && skin) {
    return (
      <group name={`Walkable_AvatarBody_${character.id}`} scale={WALK_AVATAR_SCALE} rotation={[0, facingOffset, 0]}>
        <CharacterFigure
          skin={skin}
          accent={character.accent}
          outfitMaterialRef={refs.outfitMaterial}
          upperRef={refs.upper}
          isActiveLane
          animationMode={motionMode}
          animationClipOverride={refs.clipOverrides[motionMode] ?? null}
          onAnimationNames={refs.onAnimationNames}
        />
        <mesh position={[0, 0.025, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.34, 0.46, 36]} />
          <meshBasicMaterial color={character.accent ?? "#91e9f6"} transparent opacity={0.16} depthWrite={false} />
        </mesh>
      </group>
    );
  }

  return (
    <group name="Walkable_AvatarBody">
      <mesh position={[0, 0.62, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.22, 0.28, 0.78, 16]} />
        <meshStandardMaterial color="#3a2419" roughness={0.82} />
      </mesh>
      <mesh position={[0, 1.12, 0]} castShadow>
        <sphereGeometry args={[0.22, 18, 14]} />
        <meshStandardMaterial color="#c28a62" roughness={0.7} />
      </mesh>
      <mesh position={[0, 1.0, 0.02]} castShadow>
        <torusGeometry args={[0.25, 0.04, 10, 24]} />
        <meshStandardMaterial color="#d6b56d" roughness={0.52} metalness={0.12} />
      </mesh>

      <group ref={refs.leftArm} position={[-0.28, 0.72, 0]}>
        <mesh position={[0, -0.17, 0]} rotation={[0, 0, 0.18]} castShadow>
          <cylinderGeometry args={[0.045, 0.055, 0.42, 10]} />
          <meshStandardMaterial color="#22150f" roughness={0.86} />
        </mesh>
      </group>
      <group ref={refs.rightArm} position={[0.28, 0.72, 0]}>
        <mesh position={[0, -0.17, 0]} rotation={[0, 0, -0.18]} castShadow>
          <cylinderGeometry args={[0.045, 0.055, 0.42, 10]} />
          <meshStandardMaterial color="#22150f" roughness={0.86} />
        </mesh>
      </group>

      <group ref={refs.leftLeg} position={[-0.1, 0.23, 0]}>
        <mesh position={[0, -0.19, 0]} castShadow>
          <cylinderGeometry args={[0.055, 0.065, 0.42, 10]} />
          <meshStandardMaterial color="#18100c" roughness={0.9} />
        </mesh>
      </group>
      <group ref={refs.rightLeg} position={[0.1, 0.23, 0]}>
        <mesh position={[0, -0.19, 0]} castShadow>
          <cylinderGeometry args={[0.055, 0.065, 0.42, 10]} />
          <meshStandardMaterial color="#18100c" roughness={0.9} />
        </mesh>
      </group>

      <mesh position={[0, 0.025, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.36, 0.48, 36]} />
        <meshBasicMaterial color="#91e9f6" transparent opacity={0.36} depthWrite={false} />
      </mesh>
    </group>
  );
}

export function WalkablePlayer({ enabled, character, virtualInput, onHotspotChange, onInteract, onAnimationDebugChange }) {
  const { camera } = useThree();
  const groupRef = useRef(null);
  const leftLegRef = useRef(null);
  const rightLegRef = useRef(null);
  const leftArmRef = useRef(null);
  const rightArmRef = useRef(null);
  const upperRef = useRef(null);
  const outfitMaterialRef = useRef(null);
  const keysRef = useRef(new Set());
  const yawRef = useRef(0);
  const positionRef = useRef(new Vector3(0, PLAYER_Y, 3.15));
  const velocityRef = useRef(new Vector3());
  const forwardRef = useRef(new Vector3(0, 0, -1));
  const rightRef = useRef(new Vector3(1, 0, 0));
  const moveRef = useRef(new Vector3());
  const worldPositionRef = useRef(new Vector3());
  const desiredCameraRef = useRef(new Vector3());
  const cameraTargetRef = useRef(new Vector3());
  const hotspotRef = useRef(null);
  const timeRef = useRef(0);
  const motionModeRef = useRef("idle");
  const actionUntilRef = useRef(0);
  const animationNamesRef = useRef([]);
  const clipOverridesRef = useRef({});
  const virtualInputRef = useRef({ x: 0, z: 0, rotate: 0, sprint: false, boxToken: 0, jumpToken: 0 });
  const lastBoxTokenRef = useRef(0);
  const lastJumpTokenRef = useRef(0);
  const actionModeRef = useRef("box");
  const [motionMode, setMotionMode] = useState("idle");
  const [clipOverrides, setClipOverrides] = useState({});
  const [animationNames, setAnimationNames] = useState([]);

  useEffect(() => {
    const storedOverrides = readStoredClipOverrides(character?.id);
    clipOverridesRef.current = storedOverrides;
    setClipOverrides(storedOverrides);
  }, [character?.id]);

  useEffect(() => {
    if (!enabled) {
      onAnimationDebugChange?.(null);
      return undefined;
    }

    onAnimationDebugChange?.({
      characterName: character?.name ?? "Avatar",
      mode: motionMode,
      clip: getMappedClipName(character, motionMode, clipOverrides),
      override: Boolean(clipOverrides[motionMode]),
      clips: animationNames
    });

    return undefined;
  }, [animationNames, character, clipOverrides, enabled, motionMode, onAnimationDebugChange]);

  useEffect(() => {
    virtualInputRef.current = virtualInput ?? { x: 0, z: 0, rotate: 0, sprint: false, boxToken: 0, jumpToken: 0 };
  }, [virtualInput]);

  useEffect(() => {
    if (!enabled) {
      onHotspotChange?.(null);
      return undefined;
    }

    const handleKeyDown = (event) => {
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      const target = event.target;
      if (target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.isContentEditable) return;

      const key = event.key.toLowerCase();
      if (key === "f" && hotspotRef.current) {
        event.preventDefault();
        onInteract?.(hotspotRef.current);
        return;
      }

      if (key === "j") {
        event.preventDefault();
        actionUntilRef.current = timeRef.current + 0.85;
        actionModeRef.current = "box";
        motionModeRef.current = "box";
        setMotionMode("box");
        return;
      }

      if (key === " " || event.code === "Space") {
        event.preventDefault();
        actionUntilRef.current = timeRef.current + 0.72;
        actionModeRef.current = "jump";
        motionModeRef.current = "jump";
        setMotionMode("jump");
        return;
      }

      if (key === "[" || key === "]") {
        const names = animationNamesRef.current;
        const mode = motionModeRef.current;

        if (names.length && mode !== "idle") {
          event.preventDefault();
          const currentName = clipOverridesRef.current[mode] ?? null;
          const currentIndex = Math.max(0, names.indexOf(currentName));
          const direction = key === "]" ? 1 : -1;
          const nextName = names[(currentIndex + direction + names.length) % names.length];
          const nextOverrides = {
            ...clipOverridesRef.current,
            [mode]: nextName
          };

          clipOverridesRef.current = nextOverrides;
          setClipOverrides(nextOverrides);
          writeStoredClipOverrides(character?.id, nextOverrides);
        }

        return;
      }

      if (key === "0") {
        const mode = motionModeRef.current;

        if (mode !== "idle" && clipOverridesRef.current[mode]) {
          event.preventDefault();
          const nextOverrides = { ...clipOverridesRef.current };
          delete nextOverrides[mode];
          clipOverridesRef.current = nextOverrides;
          setClipOverrides(nextOverrides);
          writeStoredClipOverrides(character?.id, nextOverrides);
        }

        return;
      }

      keysRef.current.add(key);
    };

    const handleKeyUp = (event) => {
      keysRef.current.delete(event.key.toLowerCase());
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      keysRef.current.clear();
      hotspotRef.current = null;
      onHotspotChange?.(null);
    };
  }, [character?.id, enabled, onHotspotChange, onInteract]);

  useFrame((_, delta) => {
    if (!enabled || !groupRef.current) return;

    timeRef.current += delta;
    const keys = keysRef.current;
    const virtual = virtualInputRef.current;
    if (virtual.boxToken && virtual.boxToken !== lastBoxTokenRef.current) {
      lastBoxTokenRef.current = virtual.boxToken;
      actionUntilRef.current = timeRef.current + 0.85;
      actionModeRef.current = "box";
      motionModeRef.current = "box";
      setMotionMode("box");
    }
    if (virtual.jumpToken && virtual.jumpToken !== lastJumpTokenRef.current) {
      lastJumpTokenRef.current = virtual.jumpToken;
      actionUntilRef.current = timeRef.current + 0.72;
      actionModeRef.current = "jump";
      motionModeRef.current = "jump";
      setMotionMode("jump");
    }

    const inputX = clamp(
      (keys.has("d") || keys.has("arrowright") ? 1 : 0) - (keys.has("a") || keys.has("arrowleft") ? 1 : 0) + (virtual.x ?? 0),
      -1,
      1
    );
    const inputZ = clamp(
      (keys.has("s") || keys.has("arrowdown") ? 1 : 0) - (keys.has("w") || keys.has("arrowup") ? 1 : 0) + (virtual.z ?? 0),
      -1,
      1
    );
    const moving = inputX !== 0 || inputZ !== 0;
    const sprinting = keys.has("shift") || Boolean(virtual.sprint);
    const speed = sprinting ? RUN_SPEED : WALK_SPEED;
    const nextMotionMode = timeRef.current < actionUntilRef.current
      ? actionModeRef.current
      : moving
        ? sprinting ? "run" : "walk"
        : "idle";

    if (motionModeRef.current !== nextMotionMode) {
      motionModeRef.current = nextMotionMode;
      setMotionMode(nextMotionMode);
    }

    const rotateInput = clamp((keys.has("e") ? 1 : 0) - (keys.has("q") ? 1 : 0) + (virtual.rotate ?? 0), -1, 1);

    if (rotateInput) {
      yawRef.current += rotateInput * Math.min(delta, 0.05) * 1.95;
    }

    const yaw = yawRef.current;
    forwardRef.current.set(-Math.sin(yaw), 0, -Math.cos(yaw));
    rightRef.current.set(Math.cos(yaw), 0, -Math.sin(yaw));

    moveRef.current.set(0, 0, 0);
    moveRef.current.addScaledVector(rightRef.current, inputX);
    moveRef.current.addScaledVector(forwardRef.current, -inputZ);

    velocityRef.current.copy(moveRef.current);
    if (velocityRef.current.lengthSq() > 0) {
      velocityRef.current.normalize().multiplyScalar(speed * Math.min(delta, 0.05));
      positionRef.current.add(velocityRef.current);
      positionRef.current.x = clamp(positionRef.current.x, ROOM_BOUNDS.minX, ROOM_BOUNDS.maxX);
      positionRef.current.z = clamp(positionRef.current.z, ROOM_BOUNDS.minZ, ROOM_BOUNDS.maxZ);
      keepOutOfTable(positionRef.current);

      const targetYaw = Math.atan2(velocityRef.current.x, velocityRef.current.z);
      const deltaYaw = Math.atan2(Math.sin(targetYaw - groupRef.current.rotation.y), Math.cos(targetYaw - groupRef.current.rotation.y));
      groupRef.current.rotation.y += deltaYaw * (1 - Math.exp(-Math.min(delta, 0.08) * 12));
    }

    const nextHotspot = getNearestHotspot(positionRef.current);
    if (hotspotRef.current !== nextHotspot) {
      hotspotRef.current = nextHotspot;
      onHotspotChange?.(nextHotspot);
    }

    groupRef.current.position.copy(positionRef.current);

    const swing = moving ? Math.sin(timeRef.current * (sprinting ? 12 : 8)) : 0;
    if (leftLegRef.current) leftLegRef.current.rotation.x = swing * 0.46;
    if (rightLegRef.current) rightLegRef.current.rotation.x = -swing * 0.46;
    if (leftArmRef.current) leftArmRef.current.rotation.x = -swing * 0.34;
    if (rightArmRef.current) rightArmRef.current.rotation.x = swing * 0.34;
    groupRef.current.position.y = PLAYER_Y + (moving ? Math.abs(Math.sin(timeRef.current * 8)) * 0.025 : 0);

    worldPositionRef.current.copy(positionRef.current).add(ROOM_WORLD_OFFSET);
    const tableDistance = Math.hypot(positionRef.current.x, positionRef.current.z);
    const tableFocus = 1 - clamp((tableDistance - TABLE_CLEAR_RADIUS) / 1.25, 0, 1);

    // [VISUAL] Keep full character scale, then solve table readability with camera composition instead of shrinking the player.
    desiredCameraRef.current
      .copy(worldPositionRef.current)
      .addScaledVector(forwardRef.current, -WALK_CAMERA_DISTANCE - tableFocus * 0.44)
      .addScaledVector(rightRef.current, WALK_CAMERA_SIDE_OFFSET + tableFocus * 0.48)
      .setY(worldPositionRef.current.y + WALK_CAMERA_HEIGHT + tableFocus * 0.38);

    const desiredCamera = desiredCameraRef.current;
    desiredCamera.x = clamp(desiredCamera.x, ROOM_BOUNDS.minX + 0.3, ROOM_BOUNDS.maxX - 0.3);
    desiredCamera.z = clamp(desiredCamera.z, ROOM_BOUNDS.minZ + 0.6 + ROOM_WORLD_OFFSET.z, ROOM_BOUNDS.maxZ + 1.55 + ROOM_WORLD_OFFSET.z);

    camera.position.lerp(desiredCamera, 1 - Math.exp(-Math.min(delta, 0.08) * 6.5));
    cameraTargetRef.current
      .copy(worldPositionRef.current)
      .addScaledVector(forwardRef.current, 1.08 - tableFocus * 0.52)
      .setY(worldPositionRef.current.y + 1.16 + tableFocus * 0.2)
      .lerp(WALK_TABLE_FOCUS_TARGET, tableFocus * 0.38);
    camera.lookAt(cameraTargetRef.current);

    if (camera.fov !== 47) {
      camera.fov += (47 - camera.fov) * 0.12;
      camera.updateProjectionMatrix();
    }
  });

  if (!enabled) return null;

  return (
    <group ref={groupRef} name="Walkable_Player" position={[0, PLAYER_Y, 3.15]}>
      <AvatarBody
        character={character}
        motionMode={motionMode}
        refs={{
          leftArm: leftArmRef,
          rightArm: rightArmRef,
          leftLeg: leftLegRef,
          rightLeg: rightLegRef,
          upper: upperRef,
          outfitMaterial: outfitMaterialRef,
          clipOverrides,
          onAnimationNames: (names) => {
            animationNamesRef.current = names;
            setAnimationNames(names);
          }
        }}
      />
    </group>
  );
}
