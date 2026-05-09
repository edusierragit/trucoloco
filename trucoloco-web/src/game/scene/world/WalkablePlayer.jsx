import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Vector3 } from "three";

const ROOM_BOUNDS = {
  minX: -8.55,
  maxX: 4.45,
  minZ: -3.55,
  maxZ: 3.85
};

const TABLE_CLEAR_RADIUS = 2.25;
const PLAYER_Y = 0.02;
const ROOM_WORLD_OFFSET = new Vector3(0, -1.35, 0.25);

const WALK_HOTSPOTS = [
  { id: "door", x: 0, z: 3.45, radius: 0.95 },
  { id: "bar", x: 0, z: -3.12, radius: 1.05 },
  { id: "ring", x: -7.45, z: -0.9, radius: 1.08 },
  { id: "table", x: 0, z: 0, radius: 2.95 }
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

function AvatarBody({ refs }) {
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

export function WalkablePlayer({ enabled, onHotspotChange, onInteract }) {
  const { camera } = useThree();
  const groupRef = useRef(null);
  const leftLegRef = useRef(null);
  const rightLegRef = useRef(null);
  const leftArmRef = useRef(null);
  const rightArmRef = useRef(null);
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
  }, [enabled, onHotspotChange, onInteract]);

  useFrame((_, delta) => {
    if (!enabled || !groupRef.current) return;

    timeRef.current += delta;
    const keys = keysRef.current;
    const inputX = (keys.has("d") || keys.has("arrowright") ? 1 : 0) - (keys.has("a") || keys.has("arrowleft") ? 1 : 0);
    const inputZ = (keys.has("s") || keys.has("arrowdown") ? 1 : 0) - (keys.has("w") || keys.has("arrowup") ? 1 : 0);
    const moving = inputX !== 0 || inputZ !== 0;
    const speed = keys.has("shift") ? 2.9 : 1.85;
    const rotateInput = (keys.has("e") ? 1 : 0) - (keys.has("q") ? 1 : 0);

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

      groupRef.current.rotation.y = Math.atan2(velocityRef.current.x, velocityRef.current.z);
    }

    const nextHotspot = getNearestHotspot(positionRef.current);
    if (hotspotRef.current !== nextHotspot) {
      hotspotRef.current = nextHotspot;
      onHotspotChange?.(nextHotspot);
    }

    groupRef.current.position.copy(positionRef.current);

    const swing = moving ? Math.sin(timeRef.current * (keys.has("shift") ? 12 : 8)) : 0;
    if (!leftLegRef.current || !rightLegRef.current || !leftArmRef.current || !rightArmRef.current) return;

    leftLegRef.current.rotation.x = swing * 0.46;
    rightLegRef.current.rotation.x = -swing * 0.46;
    leftArmRef.current.rotation.x = -swing * 0.34;
    rightArmRef.current.rotation.x = swing * 0.34;
    groupRef.current.position.y = PLAYER_Y + (moving ? Math.abs(Math.sin(timeRef.current * 8)) * 0.025 : 0);

    worldPositionRef.current.copy(positionRef.current).add(ROOM_WORLD_OFFSET);
    desiredCameraRef.current
      .copy(worldPositionRef.current)
      .addScaledVector(forwardRef.current, -3.2)
      .setY(worldPositionRef.current.y + 2.45);

    const desiredCamera = desiredCameraRef.current;
    desiredCamera.x = clamp(desiredCamera.x, ROOM_BOUNDS.minX + 0.3, ROOM_BOUNDS.maxX - 0.3);
    desiredCamera.z = clamp(desiredCamera.z, ROOM_BOUNDS.minZ + 0.6 + ROOM_WORLD_OFFSET.z, ROOM_BOUNDS.maxZ + 1.55 + ROOM_WORLD_OFFSET.z);

    camera.position.lerp(desiredCamera, 1 - Math.exp(-Math.min(delta, 0.08) * 6.5));
    cameraTargetRef.current
      .copy(worldPositionRef.current)
      .addScaledVector(forwardRef.current, 0.95)
      .setY(worldPositionRef.current.y + 0.95);
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
        refs={{
          leftArm: leftArmRef,
          rightArm: rightArmRef,
          leftLeg: leftLegRef,
          rightLeg: rightLegRef
        }}
      />
    </group>
  );
}
