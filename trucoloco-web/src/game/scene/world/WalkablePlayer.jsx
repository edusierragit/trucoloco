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
const JUMP_DURATION = 0.82;
const JUMP_HEIGHT = 0.58;
const ROOM_WORLD_OFFSET = new Vector3(0, -1.35, 0.25);
const WALK_AVATAR_SCALE = 0.94;
const WALK_CAMERA_HEIGHT = 2.92;
const WALK_CAMERA_DISTANCE = 3.88;
const WALK_CAMERA_SIDE_OFFSET = 0.86;
const WALK_TABLE_FOCUS_TARGET = new Vector3(ROOM_WORLD_OFFSET.x, ROOM_WORLD_OFFSET.y + 0.05, ROOM_WORLD_OFFSET.z);
// Pasillo frontal, fuera de la mesa y de la puerta. El personaje nace mirando
// en paralelo al borde: avanzar nunca lo empuja contra la colisión de la mesa.
const WALK_SPAWN = new Vector3(-1.2, PLAYER_Y, 3.35);
const WALK_SPAWN_YAW = -Math.PI / 2;
const WALK_SPAWN_MODEL_YAW = Math.PI / 2;
const CONTROL_KEY_BY_CODE = {
  KeyW: "w",
  KeyA: "a",
  KeyS: "s",
  KeyD: "d",
  KeyQ: "q",
  KeyE: "e",
  KeyF: "f",
  KeyJ: "j",
  ArrowUp: "arrowup",
  ArrowDown: "arrowdown",
  ArrowLeft: "arrowleft",
  ArrowRight: "arrowright",
  ShiftLeft: "shift",
  ShiftRight: "shift",
  Space: " ",
  BracketLeft: "[",
  BracketRight: "]",
  Digit0: "0"
};
const MOVEMENT_KEYS = new Set([
  "w", "a", "s", "d", "q", "e",
  "arrowup", "arrowdown", "arrowleft", "arrowright", "shift"
]);
// v4 invalida overrides guardados con [/] antes del mapa verificado por
// contact sheets (2026-07-08): esos overrides viejos pisaban el mapa bueno
const TRIPO_CALIBRATION_STORAGE_KEY = "trucoloco:tripo-animation-overrides:v4";

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

function getControlKey(event) {
  return CONTROL_KEY_BY_CODE[event.code] ?? event.key?.toLowerCase?.() ?? "";
}

function keepOutOfTable(position) {
  const distance = Math.hypot(position.x, position.z);
  if (distance >= TABLE_CLEAR_RADIUS || distance === 0) return;

  const push = TABLE_CLEAR_RADIUS / distance;
  position.x *= push;
  position.z *= push;
}

function getNearestHotspot(position, activeHotspot = null) {
  return WALK_HOTSPOTS.find((hotspot) => {
    const distance = Math.hypot(position.x - hotspot.x, position.z - hotspot.z);
    // Un pequeño margen de salida evita que el cartel alterne cuando el
    // personaje queda exactamente sobre el borde de una zona interactiva.
    const exitMargin = activeHotspot === hotspot.id ? 0.18 : 0;
    return distance <= hotspot.radius + exitMargin;
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
          animationClipMap={skin.animationClipMap ?? {}}
          animationTimeScaleMap={skin.animationTimeScaleMap ?? {}}
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

export function WalkablePlayer({ enabled, character, virtualInput, onHotspotChange, onInteract, onAnimationDebugChange, onMove }) {
  const { camera, gl } = useThree();
  const groupRef = useRef(null);
  const camZoomRef = useRef(1);
  const leftLegRef = useRef(null);
  const rightLegRef = useRef(null);
  const leftArmRef = useRef(null);
  const rightArmRef = useRef(null);
  const upperRef = useRef(null);
  const outfitMaterialRef = useRef(null);
  const keysRef = useRef(new Set());
  const yawRef = useRef(WALK_SPAWN_YAW);
  const positionRef = useRef(WALK_SPAWN.clone());
  const velocityRef = useRef(new Vector3());
  const targetVelocityRef = useRef(new Vector3());
  const forwardRef = useRef(new Vector3(0, 0, -1));
  const rightRef = useRef(new Vector3(1, 0, 0));
  const moveRef = useRef(new Vector3());
  const worldPositionRef = useRef(new Vector3());
  const desiredCameraRef = useRef(new Vector3());
  const cameraTargetRef = useRef(new Vector3());
  const hotspotRef = useRef(null);
  const pendingHotspotRef = useRef(null);
  const hotspotSinceRef = useRef(0);
  const timeRef = useRef(0);
  const motionModeRef = useRef("idle");
  const actionUntilRef = useRef(0);
  const animationNamesRef = useRef([]);
  const clipOverridesRef = useRef({});
  const virtualInputRef = useRef({ x: 0, z: 0, rotate: 0, sprint: false, boxToken: 0, jumpToken: 0 });
  const lastBoxTokenRef = useRef(0);
  const lastJumpTokenRef = useRef(0);
  const actionModeRef = useRef("box");
  const jumpStartedAtRef = useRef(-1);
  const onHotspotChangeRef = useRef(onHotspotChange);
  const onInteractRef = useRef(onInteract);
  const onMoveRef = useRef(onMove);
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

  // El lobby y el HUD actualizan callbacks sin que eso deba reiniciar WASD.
  useEffect(() => {
    onHotspotChangeRef.current = onHotspotChange;
    onInteractRef.current = onInteract;
    onMoveRef.current = onMove;
  }, [onHotspotChange, onInteract, onMove]);

  // zoom con la rueda mientras caminás: acerca/aleja la cámara de tercera
  // persona (rueda arriba = acercar). Sentado no lleva zoom: solo giro lateral.
  useEffect(() => {
    if (!enabled) return undefined;
    const el = gl.domElement;
    const onWheel = (event) => {
      event.preventDefault();
      const dir = event.deltaY > 0 ? 1 : -1; // abajo aleja, arriba acerca
      camZoomRef.current = clamp(camZoomRef.current + dir * 0.12, 0.62, 1.7);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [enabled, gl]);

  useEffect(() => {
    if (!enabled) {
      onHotspotChangeRef.current?.(null);
      return undefined;
    }

    keysRef.current.clear();

    // Crear/unirse puede dejar el foco en un input o botón. El canvas recibe
    // foco al entrar al paseo para que WASD funcione en el primer intento.
    const canvas = gl.domElement;
    canvas.tabIndex = 0;
    if (typeof document !== "undefined" && typeof document.activeElement?.blur === "function") {
      document.activeElement.blur();
    }
    const focusFrame = window.requestAnimationFrame(() => {
      try {
        canvas.focus({ preventScroll: true });
      } catch {
        canvas.focus();
      }
    });

    // Saneá posiciones persistidas por la versión cuyo spawn quedaba dentro
    // de la mesa; no teletransporta a quien ya estaba caminando correctamente.
    if (Math.hypot(positionRef.current.x, positionRef.current.z) < TABLE_CLEAR_RADIUS + 0.08) {
      positionRef.current.copy(WALK_SPAWN);
    }

    const handleKeyDown = (event) => {
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      const target = event.target;
      if (target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.isContentEditable) return;

      const key = getControlKey(event);
      if (MOVEMENT_KEYS.has(key)) event.preventDefault();

      if (key === "f" && hotspotRef.current) {
        event.preventDefault();
        if (!event.repeat) onInteractRef.current?.(hotspotRef.current);
        return;
      }

      if (key === "j") {
        event.preventDefault();
        if (event.repeat) return;
        actionUntilRef.current = timeRef.current + 0.85;
        actionModeRef.current = "box";
        motionModeRef.current = "box";
        setMotionMode("box");
        return;
      }

      if (key === " " || event.code === "Space") {
        event.preventDefault();
        if (event.repeat) return;
        jumpStartedAtRef.current = timeRef.current;
        actionUntilRef.current = timeRef.current + JUMP_DURATION;
        actionModeRef.current = "jump";
        motionModeRef.current = "jump";
        setMotionMode("jump");
        return;
      }

      if (key === "[" || key === "]") {
        const names = animationNamesRef.current;
        const mode = motionModeRef.current === "idle" ? actionModeRef.current : motionModeRef.current;

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
      keysRef.current.delete(getControlKey(event));
    };

    const clearInput = () => {
      keysRef.current.clear();
      targetVelocityRef.current.set(0, 0, 0);
      velocityRef.current.set(0, 0, 0);
    };

    const handleVisibilityChange = () => {
      if (document.hidden) clearInput();
    };

    // Capture impide que un panel superpuesto consuma WASD antes del juego.
    window.addEventListener("keydown", handleKeyDown, true);
    window.addEventListener("keyup", handleKeyUp, true);
    window.addEventListener("blur", clearInput);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.cancelAnimationFrame(focusFrame);
      window.removeEventListener("keydown", handleKeyDown, true);
      window.removeEventListener("keyup", handleKeyUp, true);
      window.removeEventListener("blur", clearInput);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      clearInput();
      hotspotRef.current = null;
      onHotspotChangeRef.current?.(null);
    };
  }, [character?.id, enabled, gl]);

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
      jumpStartedAtRef.current = timeRef.current;
      actionUntilRef.current = timeRef.current + JUMP_DURATION;
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
    const hasMovementInput = inputX !== 0 || inputZ !== 0;
    const sprinting = keys.has("shift") || Boolean(virtual.sprint);
    const speed = sprinting ? RUN_SPEED : WALK_SPEED;

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

    const frameDelta = Math.min(delta, 0.05);
    targetVelocityRef.current.copy(moveRef.current);
    if (targetVelocityRef.current.lengthSq() > 0) {
      targetVelocityRef.current.normalize().multiplyScalar(speed);
    }

    // Respuesta rápida pero continua: evita saltos al repetir keydown y hace
    // que soltar la tecla frene sin cortar la cámara de golpe.
    velocityRef.current.lerp(
      targetVelocityRef.current,
      1 - Math.exp(-frameDelta * (hasMovementInput ? 20 : 16))
    );
    if (!hasMovementInput && velocityRef.current.lengthSq() < 0.0004) {
      velocityRef.current.set(0, 0, 0);
    }

    const moving = velocityRef.current.lengthSq() > 0.0004;
    if (moving) {
      positionRef.current.addScaledVector(velocityRef.current, frameDelta);
      positionRef.current.x = clamp(positionRef.current.x, ROOM_BOUNDS.minX, ROOM_BOUNDS.maxX);
      positionRef.current.z = clamp(positionRef.current.z, ROOM_BOUNDS.minZ, ROOM_BOUNDS.maxZ);
      keepOutOfTable(positionRef.current);

      const targetYaw = Math.atan2(velocityRef.current.x, velocityRef.current.z);
      const deltaYaw = Math.atan2(Math.sin(targetYaw - groupRef.current.rotation.y), Math.cos(targetYaw - groupRef.current.rotation.y));
      groupRef.current.rotation.y += deltaYaw * (1 - Math.exp(-Math.min(delta, 0.08) * 12));
    }

    const nextMotionMode = timeRef.current < actionUntilRef.current
      ? actionModeRef.current
      : moving
        ? sprinting && hasMovementInput ? "run" : "walk"
        : "idle";

    if (motionModeRef.current !== nextMotionMode) {
      motionModeRef.current = nextMotionMode;
      setMotionMode(nextMotionMode);
    }

    const nextHotspot = getNearestHotspot(positionRef.current, hotspotRef.current);
    if (pendingHotspotRef.current !== nextHotspot) {
      pendingHotspotRef.current = nextHotspot;
      hotspotSinceRef.current = timeRef.current;
    }
    // histeresis: el cartel solo cambia si el hotspot se mantiene 0.25s
    // (antes titilaba como loco al caminar por los bordes de las zonas)
    if (hotspotRef.current !== nextHotspot && timeRef.current - hotspotSinceRef.current > 0.25) {
      hotspotRef.current = nextHotspot;
      onHotspotChangeRef.current?.(nextHotspot);
    }

    groupRef.current.position.copy(positionRef.current);

    const swing = moving ? Math.sin(timeRef.current * (sprinting ? 12 : 8)) : 0;
    const jumpProgress = actionModeRef.current === "jump" && timeRef.current < actionUntilRef.current
      ? clamp((timeRef.current - jumpStartedAtRef.current) / JUMP_DURATION, 0, 1)
      : 1;
    const jumpLift = jumpProgress < 1 ? Math.sin(jumpProgress * Math.PI) * JUMP_HEIGHT : 0;
    if (leftLegRef.current) leftLegRef.current.rotation.x = swing * 0.46;
    if (rightLegRef.current) rightLegRef.current.rotation.x = -swing * 0.46;
    if (leftArmRef.current) leftArmRef.current.rotation.x = -swing * 0.34;
    if (rightArmRef.current) rightArmRef.current.rotation.x = swing * 0.34;
    groupRef.current.position.y = PLAYER_Y + (moving ? Math.abs(Math.sin(timeRef.current * 8)) * 0.025 : 0) + jumpLift;

    worldPositionRef.current.copy(positionRef.current).add(ROOM_WORLD_OFFSET);
    const tableDistance = Math.hypot(positionRef.current.x, positionRef.current.z);
    const tableFocus = 1 - clamp((tableDistance - TABLE_CLEAR_RADIUS) / 1.25, 0, 1);

    // [VISUAL] Keep full character scale, then solve table readability with camera composition instead of shrinking the player.
    // zoom de la rueda: escala distancia y altura (la altura mas suave para no
    // subir de mas al alejar y no clavar la vista en el piso al acercar).
    const camZoom = camZoomRef.current;
    const heightZoom = 0.5 + camZoom * 0.5;
    desiredCameraRef.current
      .copy(worldPositionRef.current)
      .addScaledVector(forwardRef.current, (-WALK_CAMERA_DISTANCE - tableFocus * 0.44) * camZoom)
      .addScaledVector(rightRef.current, WALK_CAMERA_SIDE_OFFSET + tableFocus * 0.48)
      .setY(worldPositionRef.current.y + (WALK_CAMERA_HEIGHT + tableFocus * 0.38) * heightZoom);

    const desiredCamera = desiredCameraRef.current;
    desiredCamera.x = clamp(desiredCamera.x, ROOM_BOUNDS.minX + 0.3, ROOM_BOUNDS.maxX - 0.3);
    // la cámara NUNCA sale de la sala: si cruza la pared frontal, la pared
    // tapa todo y el jugador ve negro al spawnear cerca de la puerta
    desiredCamera.z = clamp(desiredCamera.z, ROOM_BOUNDS.minZ + 0.6 + ROOM_WORLD_OFFSET.z, ROOM_BOUNDS.maxZ - 0.2 + ROOM_WORLD_OFFSET.z);

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

    // La sincronización P2P es best-effort: nunca puede cortar el movimiento,
    // la animación o la cámara local si el relay todavía no tiene pares.
    try {
      const pendingMove = onMoveRef.current?.(
        positionRef.current.x,
        positionRef.current.z,
        groupRef.current.rotation.y,
        moving,
        motionModeRef.current
      );
      pendingMove?.catch?.(() => {});
    } catch {
      // El siguiente frame sigue funcionando y reintentará al ritmo normal.
    }
  });

  if (!enabled) return null;

  return (
    <group
      ref={groupRef}
      name="Walkable_Player"
      position={[WALK_SPAWN.x, WALK_SPAWN.y, WALK_SPAWN.z]}
      rotation={[0, WALK_SPAWN_MODEL_YAW, 0]}
    >
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
