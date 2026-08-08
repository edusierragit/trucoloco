import { Suspense, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Cylinder, RoundedBox, useAnimations, useGLTF } from "@react-three/drei";
import { Box3, Euler, Quaternion, Vector3 } from "three";
import { clone as cloneSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";

function isFiniteBox(box) {
  return (
    Number.isFinite(box.min.x) &&
    Number.isFinite(box.min.y) &&
    Number.isFinite(box.min.z) &&
    Number.isFinite(box.max.x) &&
    Number.isFinite(box.max.y) &&
    Number.isFinite(box.max.z)
  );
}

function getSafeObjectBounds(object) {
  object.updateMatrixWorld(true);

  const bounds = new Box3();

  object.traverse((child) => {
    const position = child.isMesh ? child.geometry?.attributes?.position : null;
    if (!position) return;

    const meshBounds = new Box3().setFromBufferAttribute(position);
    if (!isFiniteBox(meshBounds)) return;

    meshBounds.applyMatrix4(child.matrixWorld);
    if (!isFiniteBox(meshBounds)) return;

    bounds.union(meshBounds);
  });

  return bounds.isEmpty() || !isFiniteBox(bounds) ? new Box3().setFromObject(object) : bounds;
}

function makeClipsInPlace(animations) {
  return animations.map((clip) => {
    const nextClip = clip.clone();

    nextClip.tracks.forEach((track) => {
      if (track.name !== "Root.position" || track.ValueTypeName !== "vector") return;

      const values = track.values;
      const originX = values[0] ?? 0;
      const originZ = values[2] ?? 0;

      for (let index = 0; index < values.length; index += 3) {
        values[index] = originX;
        values[index + 2] = originZ;
      }
    });

    return nextClip;
  });
}

function createPoseRig(scene) {
  const names = [
    "Spine01",
    "Spine02",
    "L_Thigh",
    "L_Calf",
    "L_Foot",
    "L_ToeBase",
    "R_Thigh",
    "R_Calf",
    "R_Foot",
    "R_ToeBase",
    "L_Upperarm",
    "L_Forearm",
    "L_Hand",
    "R_Upperarm",
    "R_Forearm",
    "R_Hand"
  ];
  const bones = Object.fromEntries(names.map((name) => [name, scene.getObjectByName(name) ?? null]));
  const restQuaternions = new Map(
    Object.values(bones)
      .filter(Boolean)
      .map((bone) => [bone, bone.quaternion.clone()])
  );

  return { bones, restQuaternions };
}

function restorePoseRig(poseRig) {
  poseRig.restQuaternions.forEach((quaternion, bone) => {
    bone.quaternion.copy(quaternion);
  });
}

function aimBoneAtDirection(scene, bone, child, direction, scratch) {
  if (!bone || !child || !bone.parent || child.parent !== bone) return;

  scene.updateMatrixWorld(true);
  scratch.currentDirection.copy(child.position).normalize().applyQuaternion(bone.quaternion).normalize();
  scene.getWorldQuaternion(scratch.sceneWorldQuaternion);
  scratch.desiredWorld.copy(direction).normalize().applyQuaternion(scratch.sceneWorldQuaternion);
  bone.parent.getWorldQuaternion(scratch.parentWorldQuaternion).invert();
  scratch.desiredParent.copy(scratch.desiredWorld).applyQuaternion(scratch.parentWorldQuaternion).normalize();
  scratch.deltaQuaternion.setFromUnitVectors(scratch.currentDirection, scratch.desiredParent);
  bone.quaternion.premultiply(scratch.deltaQuaternion).normalize();
}

function CharacterModelAsset({
  src,
  scale = 1,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  targetHeight = 1.78,
  animationMode = null,
  animationClipMap = {},
  animationTimeScaleMap = {},
  animationClipOverride = null,
  poseMode = null,
  poseVariant = 0,
  gazeRef,
  onAnimationNames
}) {
  const { scene, animations = [] } = useGLTF(src);
  const preparedAnimations = useMemo(() => makeClipsInPlace(animations), [animations]);
  const animationNames = useMemo(() => preparedAnimations.map((clip) => clip.name), [preparedAnimations]);
  const { clonedScene, offset, normalizedScale, normalizedPelvisY } = useMemo(() => {
    const clone = cloneSkeleton(scene);
    clone.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });

    const bounds = getSafeObjectBounds(clone);
    const size = new Vector3();
    const center = new Vector3();
    bounds.getSize(size);
    bounds.getCenter(center);

    const hasFiniteBounds =
      Number.isFinite(size.x) &&
      Number.isFinite(size.y) &&
      Number.isFinite(size.z) &&
      Number.isFinite(center.x) &&
      Number.isFinite(center.y) &&
      Number.isFinite(center.z) &&
      Number.isFinite(bounds.min.y);

    const scaleFactor = hasFiniteBounds && size.y > 0 ? targetHeight / size.y : 1;
    const centeredOffset = hasFiniteBounds ? [-center.x * scaleFactor, -bounds.min.y * scaleFactor, -center.z * scaleFactor] : [0, 0, 0];
    const pelvis = clone.getObjectByName("Pelvis");
    const pelvisPosition = new Vector3();
    clone.updateMatrixWorld(true);
    pelvis?.getWorldPosition(pelvisPosition);
    const pelvisY = pelvis
      ? pelvisPosition.y * scaleFactor + centeredOffset[1]
      : targetHeight * 0.53;

    return {
      clonedScene: clone,
      offset: centeredOffset,
      normalizedScale: scaleFactor,
      normalizedPelvisY: pelvisY
    };
  }, [scene, targetHeight]);
  const { actions } = useAnimations(preparedAnimations, clonedScene);
  const poseRig = useMemo(() => createPoseRig(clonedScene), [clonedScene]);
  const seatedPoseBaseRef = useRef(new Map());
  const poseScratch = useMemo(
    () => ({
      currentDirection: new Vector3(),
      desiredWorld: new Vector3(),
      desiredParent: new Vector3(),
      sceneWorldQuaternion: new Quaternion(),
      parentWorldQuaternion: new Quaternion(),
      deltaQuaternion: new Quaternion()
    }),
    []
  );
  const gazePoseRef = useRef({ yaw: 0, pitch: 0, weight: 0 });
  const gazeRig = useMemo(() => {
    const head = clonedScene.getObjectByName("Head") ?? null;
    const neck = clonedScene.getObjectByName("NeckTwist02") ?? clonedScene.getObjectByName("NeckTwist01") ?? null;

    return {
      head,
      neck,
      headRest: head?.quaternion.clone() ?? null,
      neckRest: neck?.quaternion.clone() ?? null
    };
  }, [clonedScene]);
  const gazeScratch = useMemo(
    () => ({
      euler: new Euler(0, 0, 0, "YXZ"),
      quaternion: new Quaternion()
    }),
    []
  );
  const actionTimeScale = useMemo(() => {
    if (!animationMode) return 1;
    const mappedScale = animationTimeScaleMap[animationMode];
    return Number.isFinite(mappedScale) && mappedScale > 0 ? mappedScale : 1;
  }, [animationMode, animationTimeScaleMap]);
  const actionName = useMemo(() => {
    if (!animationMode) return null;

    const names = Object.keys(actions);
    if (!names.length) return null;

    if (animationClipOverride && actions[animationClipOverride]) return animationClipOverride;

    const hasMappedMode = Object.prototype.hasOwnProperty.call(animationClipMap, animationMode);
    const mappedName = hasMappedMode ? animationClipMap[animationMode] : animationMode === "run" ? animationClipMap.walk : null;
    if (hasMappedMode) return typeof mappedName === "string" && actions[mappedName] ? mappedName : null;

    if (animationMode === "idle") return null;

    const modeWords = animationMode === "run"
      ? ["run", "jog", "sprint"]
      : animationMode === "walk"
        ? ["walk", "walking"]
        : animationMode === "box"
          ? ["box", "fight", "punch"]
          : animationMode === "jump"
            ? ["jump", "leap", "hop"]
            : ["idle", "stand", "breath"];
    const matched = names.find((name) => modeWords.some((word) => name.toLowerCase().includes(word)));

    return matched ?? (animationMode === "idle" ? names[0] : names.find((name) => name.toLowerCase().includes("walk")) ?? names[0]);
  }, [actions, animationClipMap, animationClipOverride, animationMode]);

  useLayoutEffect(() => {
    restorePoseRig(poseRig);
    clonedScene.updateMatrixWorld(true);
    if (poseMode !== "seat") return undefined;

    const bone = poseRig.bones;
    const aim = (boneName, childName, direction) => {
      aimBoneAtDirection(clonedScene, bone[boneName], bone[childName], direction, poseScratch);
    };

    // Torso apenas hacia el paño: atento, no encorvado.
    aim("Spine01", "Spine02", new Vector3(0.08 + poseVariant * 0.018, 1, 0));

    // Pelvis quieta sobre el taburete; muslos hacia la mesa y pantorrillas al piso.
    aim("L_Thigh", "L_Calf", new Vector3(0.8 + poseVariant * 0.035, -0.58, -0.055));
    aim("R_Thigh", "R_Calf", new Vector3(0.76 - poseVariant * 0.03, -0.64, 0.055));
    aim("L_Calf", "L_Foot", new Vector3(-0.04 + poseVariant * 0.025, -1, -0.025));
    aim("R_Calf", "R_Foot", new Vector3(-0.1 - poseVariant * 0.02, -0.99, 0.025));
    aim("L_Foot", "L_ToeBase", new Vector3(0.94, -0.08, -0.04));
    aim("R_Foot", "R_ToeBase", new Vector3(0.94, -0.08, 0.04));

    // Codos cerca del cuerpo y manos sobre el regazo/borde, con asimetría por personaje.
    aim("L_Upperarm", "L_Forearm", new Vector3(0.06, -1, -0.09 - poseVariant * 0.025));
    aim("R_Upperarm", "R_Forearm", new Vector3(0.03, -1, 0.08 + poseVariant * 0.02));
    aim("L_Forearm", "L_Hand", new Vector3(0.5 + poseVariant * 0.04, -0.84, -0.18));
    aim("R_Forearm", "R_Hand", new Vector3(0.42 - poseVariant * 0.035, -0.88, 0.2));
    clonedScene.updateMatrixWorld(true);
    seatedPoseBaseRef.current = new Map(
      [bone.Spine01, bone.L_Upperarm, bone.R_Upperarm, bone.L_Forearm, bone.R_Forearm]
        .filter(Boolean)
        .map((joint) => [joint, joint.quaternion.clone()])
    );

    return () => {
      seatedPoseBaseRef.current.clear();
      restorePoseRig(poseRig);
      clonedScene.updateMatrixWorld(true);
    };
  }, [clonedScene, poseMode, poseRig, poseScratch, poseVariant]);

  useFrame((state, delta) => {
    if (!gazeRig.head && !gazeRig.neck) return;

    if (poseMode === "seat" && seatedPoseBaseRef.current.size) {
      const t = state.clock.elapsedTime + poseVariant * 1.7;
      const breath = Math.sin(t * 0.82) * 0.009;
      const weightShift = Math.sin(t * 0.37 + 0.8) * 0.006;
      const applyIdle = (bone, x, y, z) => {
        const base = seatedPoseBaseRef.current.get(bone);
        if (!bone || !base) return;
        bone.quaternion.copy(base);
        gazeScratch.euler.set(x, y, z, "YXZ");
        gazeScratch.quaternion.setFromEuler(gazeScratch.euler);
        bone.quaternion.multiply(gazeScratch.quaternion);
      };

      applyIdle(poseRig.bones.Spine01, breath, weightShift, weightShift * 0.6);
      applyIdle(poseRig.bones.L_Upperarm, breath * 0.35, 0, weightShift * 0.45);
      applyIdle(poseRig.bones.R_Upperarm, breath * 0.28, 0, -weightShift * 0.4);
      applyIdle(poseRig.bones.L_Forearm, -breath * 0.22, weightShift * 0.24, 0);
      applyIdle(poseRig.bones.R_Forearm, -breath * 0.18, -weightShift * 0.2, 0);
    }

    const target = gazeRef?.current;
    const pose = gazePoseRef.current;
    const alpha = 1 - Math.exp(-Math.min(delta, 0.1) * 7.5);
    const targetWeight = target?.weight ?? 0;
    pose.weight += (targetWeight - pose.weight) * alpha;
    pose.yaw += (((target?.yaw ?? 0) * pose.weight) - pose.yaw) * alpha;
    pose.pitch += (((target?.pitch ?? 0) * pose.weight) - pose.pitch) * alpha;

    const applyLook = (bone, restQuaternion, yawShare, pitchShare) => {
      if (!bone || !restQuaternion) return;
      // Sin clip activo partimos de la pose importada. Con un clip, useAnimations
      // actualiza primero el hueso y esta rotacion se mezcla aditivamente encima.
      if (!actionName) bone.quaternion.copy(restQuaternion);
      gazeScratch.euler.set(pose.pitch * pitchShare, pose.yaw * yawShare, 0, "YXZ");
      gazeScratch.quaternion.setFromEuler(gazeScratch.euler);
      bone.quaternion.multiply(gazeScratch.quaternion);
    };

    applyLook(gazeRig.neck, gazeRig.neckRest, 0.34, 0.28);
    applyLook(gazeRig.head, gazeRig.headRest, 0.66, 0.72);
  });

  useEffect(() => {
    if (!animationNames.length) return undefined;
    onAnimationNames?.(animationNames);
    return undefined;
  }, [animationNames, onAnimationNames]);

  useEffect(() => {
    if (!actionName) {
      Object.values(actions).forEach((action) => {
        action.fadeOut(0.12);
      });
      return undefined;
    }

    Object.entries(actions).forEach(([name, action]) => {
      if (name === actionName) {
        action.timeScale = actionTimeScale;
        action.reset().fadeIn(0.18).play();
      } else {
        action.timeScale = 1;
        action.fadeOut(0.16);
      }
    });

    return () => {
      actions[actionName]?.fadeOut(0.12);
    };
  }, [actionName, actionTimeScale, actions]);

  const posedPosition = poseMode === "seat"
    ? [position[0], 0.59 - normalizedPelvisY * scale, position[2] - 0.5]
    : position;

  return (
    <group scale={scale} position={posedPosition} rotation={rotation}>
      <primitive object={clonedScene} scale={normalizedScale} position={offset} dispose={null} />
    </group>
  );
}

function CharacterBody({ skin, outfitMaterialRef, upperRef, children, isActiveLane }) {
  return (
    <>
      <mesh position={[0, 0.28, -0.035]} scale={[0.82, 0.58, 0.68]} castShadow receiveShadow>
        <sphereGeometry args={[0.26, 18, 14]} />
        <meshStandardMaterial color="#25160f" roughness={0.9} />
      </mesh>

      <mesh position={[0, 0.52, 0]} scale={[0.7, 1, 0.56]} castShadow receiveShadow>
        <sphereGeometry args={[0.26, 18, 16]} />
        <meshStandardMaterial color={skin.outfitColor} roughness={0.7} />
      </mesh>

      {/* [VISUAL] Procedural figures use slimmer human proportions so they sit beside GLB characters coherently. */}
      <Cylinder name="Character_Torso" args={[0.19, 0.25, 0.88, 18]} position={[0, 0.86, 0]} castShadow>
        <meshStandardMaterial
          ref={outfitMaterialRef}
          color={skin.shirtColor ?? skin.outfitColor}
          roughness={0.58}
          metalness={0.04}
          emissive={isActiveLane ? "#3b2418" : "#000000"}
          emissiveIntensity={isActiveLane ? 0.16 : 0}
        />
      </Cylinder>

      <mesh position={[0, 1.15, 0.025]} scale={[0.8, 0.5, 0.58]} castShadow>
        <sphereGeometry args={[0.27, 18, 16]} />
        <meshStandardMaterial color={skin.outfitColor} roughness={0.7} />
      </mesh>

      <mesh position={[0, 1.31, 0.02]} castShadow>
        <cylinderGeometry args={[0.075, 0.095, 0.15, 14]} />
        <meshStandardMaterial color={skin.skinColor} roughness={0.84} />
      </mesh>

      <group ref={upperRef} position={[0, 1.31, 0.03]}>
        {children}
      </group>
    </>
  );
}

function NegocianteFigure({ skin, outfitMaterialRef, upperRef, isActiveLane }) {
  return (
    <CharacterBody skin={skin} outfitMaterialRef={outfitMaterialRef} upperRef={upperRef} isActiveLane={isActiveLane}>
      <mesh position={[0, 0.22, 0]} castShadow>
        <sphereGeometry args={[0.195, 24, 24]} />
        <meshStandardMaterial color={skin.skinColor} roughness={0.88} />
      </mesh>

      <mesh position={[0, 0.075, 0.095]} castShadow>
        <sphereGeometry args={[0.125, 18, 18]} />
        <meshStandardMaterial color={skin.beardColor} roughness={0.95} />
      </mesh>

      <mesh position={[0, 0.01, 0.055]} scale={[0.78, 0.48, 0.62]} castShadow>
        <sphereGeometry args={[0.155, 16, 16]} />
        <meshStandardMaterial color={skin.beardColor} roughness={0.98} />
      </mesh>

      <group position={[0, 0.17, 0.18]}>
        <RoundedBox args={[0.17, 0.1, 0.025]} radius={0.025} position={[-0.11, 0, 0]}>
          <meshPhysicalMaterial color="#dfe7ef" transparent opacity={0.22} roughness={0.05} transmission={0.55} />
        </RoundedBox>
        <RoundedBox args={[0.17, 0.1, 0.025]} radius={0.025} position={[0.11, 0, 0]}>
          <meshPhysicalMaterial color="#dfe7ef" transparent opacity={0.22} roughness={0.05} transmission={0.55} />
        </RoundedBox>
        <mesh position={[0, 0, 0.006]}>
          <boxGeometry args={[0.06, 0.018, 0.018]} />
          <meshStandardMaterial color={skin.accessoryColor} roughness={0.28} metalness={0.38} />
        </mesh>
        <mesh position={[-0.11, 0, 0]}>
          <boxGeometry args={[0.19, 0.12, 0.01]} />
          <meshStandardMaterial color={skin.accessoryColor} roughness={0.3} metalness={0.32} />
        </mesh>
        <mesh position={[0.11, 0, 0]}>
          <boxGeometry args={[0.19, 0.12, 0.01]} />
          <meshStandardMaterial color={skin.accessoryColor} roughness={0.3} metalness={0.32} />
        </mesh>
      </group>

      <mesh position={[0.025, 0.095, 0.205]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.023, 0.004, 10, 24]} />
        <meshStandardMaterial color="#c7a98a" roughness={0.2} metalness={0.7} />
      </mesh>
    </CharacterBody>
  );
}

function GazpachoFigure({ skin, outfitMaterialRef, upperRef, isActiveLane }) {
  const hairTufts = [
    [-0.105, 0.37, 0.01, 0.046],
    [0, 0.4, 0.035, 0.06],
    [0.105, 0.36, 0.02, 0.046],
    [-0.155, 0.3, 0.01, 0.04],
    [0.155, 0.3, 0.01, 0.04],
    [-0.055, 0.33, 0.105, 0.04],
    [0.07, 0.32, 0.105, 0.04]
  ];

  return (
    <CharacterBody skin={skin} outfitMaterialRef={outfitMaterialRef} upperRef={upperRef} isActiveLane={isActiveLane}>
      <mesh position={[0, 0.22, 0]} castShadow>
        <sphereGeometry args={[0.195, 24, 24]} />
        <meshStandardMaterial color={skin.skinColor} roughness={0.84} />
      </mesh>

      {hairTufts.map(([x, y, z, scale], index) => (
        <mesh key={index} position={[x, y, z]} castShadow>
          <sphereGeometry args={[scale, 14, 14]} />
          <meshStandardMaterial color={skin.hairColor} roughness={0.92} />
        </mesh>
      ))}

      <mesh position={[0, 0.055, 0.095]} castShadow>
        <sphereGeometry args={[0.12, 18, 18]} />
        <meshStandardMaterial color={skin.beardColor} roughness={0.96} />
      </mesh>

      <mesh position={[0, 0.105, 0.11]} scale={[0.8, 0.36, 0.5]} castShadow>
        <sphereGeometry args={[0.13, 16, 16]} />
        <meshStandardMaterial color={skin.beardColor} roughness={0.96} />
      </mesh>

      <group position={[0, 0.18, 0.16]}>
        <RoundedBox args={[0.16, 0.07, 0.03]} radius={0.03} position={[-0.09, 0, 0]}>
          <meshStandardMaterial color={skin.accessoryColor} roughness={0.14} metalness={0.1} />
        </RoundedBox>
        <RoundedBox args={[0.16, 0.07, 0.03]} radius={0.03} position={[0.09, 0, 0]}>
          <meshStandardMaterial color={skin.accessoryColor} roughness={0.14} metalness={0.1} />
        </RoundedBox>
        <mesh position={[0, 0, 0.008]}>
          <boxGeometry args={[0.052, 0.016, 0.016]} />
          <meshStandardMaterial color={skin.accessoryColor} roughness={0.16} />
        </mesh>
      </group>

      <group position={[-0.045, 0.01, 0.2]} rotation={[0.82, -0.24, -0.16]}>
        <mesh position={[0, -0.18, 0]} castShadow>
          <cylinderGeometry args={[0.018, 0.028, 0.42, 12]} />
          <meshStandardMaterial color="#3b2d21" roughness={0.52} />
        </mesh>
        <mesh position={[0.02, -0.38, -0.02]} castShadow>
          <sphereGeometry args={[0.08, 14, 14]} />
          <meshStandardMaterial color="#5a331f" roughness={0.62} />
        </mesh>
        <mesh position={[0.025, -0.38, -0.02]} castShadow>
          <sphereGeometry args={[0.045, 10, 10]} />
          <meshStandardMaterial color="#120d0a" roughness={0.22} />
        </mesh>
      </group>
    </CharacterBody>
  );
}

function CartachinFigure({ skin, outfitMaterialRef, upperRef, isActiveLane }) {
  return (
    <CharacterBody skin={skin} outfitMaterialRef={outfitMaterialRef} upperRef={upperRef} isActiveLane={isActiveLane}>
      <mesh position={[0, 0.22, 0]} castShadow>
        <sphereGeometry args={[0.195, 24, 24]} />
        <meshStandardMaterial color={skin.skinColor} roughness={0.86} />
      </mesh>

      <mesh position={[0, 0.085, 0.095]} castShadow>
        <sphereGeometry args={[0.11, 16, 16]} />
        <meshStandardMaterial color={skin.beardColor} roughness={0.96} />
      </mesh>

      <group position={[0, 0.4, 0.02]}>
        <mesh castShadow>
          <cylinderGeometry args={[0.29, 0.24, 0.09, 24]} />
          <meshStandardMaterial color="#17110d" roughness={0.82} />
        </mesh>
        <mesh position={[0, 0.06, 0]} castShadow>
          <cylinderGeometry args={[0.18, 0.2, 0.12, 20]} />
          <meshStandardMaterial color="#20150f" roughness={0.86} />
        </mesh>
      </group>

      <group position={[0, -0.18, 0.165]} rotation={[0.08, 0, 0]}>
        <RoundedBox args={[0.58, 0.56, 0.048]} radius={0.04} castShadow receiveShadow>
          <meshStandardMaterial color={skin.ponchoColor ?? skin.outfitColor} roughness={0.92} />
        </RoundedBox>
        <RoundedBox args={[0.15, 0.32, 0.055]} radius={0.022} position={[0, -0.02, 0.032]} castShadow>
          <meshStandardMaterial color="#17100d" roughness={0.88} />
        </RoundedBox>
        <mesh position={[0, 0.22, 0.034]}>
          <boxGeometry args={[0.46, 0.02, 0.018]} />
          <meshStandardMaterial color={skin.accessoryColor} roughness={0.38} metalness={0.2} />
        </mesh>
      </group>

      <group position={[0.22, 0.04, 0.22]} rotation={[0.18, -0.24, -0.12]}>
        <RoundedBox args={[0.16, 0.025, 0.24]} radius={0.018} castShadow>
          <meshStandardMaterial color="#f0e1bf" roughness={0.52} />
        </RoundedBox>
        <mesh position={[0, 0.018, -0.07]}>
          <boxGeometry args={[0.13, 0.01, 0.025]} />
          <meshStandardMaterial color="#b4472d" roughness={0.42} />
        </mesh>
      </group>
    </CharacterBody>
  );
}

function FallbackFigure({ accent, outfitMaterialRef, upperRef, isActiveLane }) {
  return (
    <>
      <Cylinder name="Character_Torso" args={[0.22, 0.3, 0.92, 16]} position={[0, 0.82, 0]} castShadow>
        <meshStandardMaterial
          ref={outfitMaterialRef}
          color={accent}
          roughness={0.58}
          metalness={0.05}
          emissive={isActiveLane ? accent : "#000000"}
          emissiveIntensity={isActiveLane ? 0.08 : 0}
        />
      </Cylinder>

      <mesh ref={upperRef} position={[0, 1.47, 0.03]} castShadow>
        <sphereGeometry args={[0.18, 18, 18]} />
        <meshStandardMaterial color="#d8b68f" roughness={0.78} />
      </mesh>

      <mesh position={[0, 1.16, 0.24]} castShadow>
        <boxGeometry args={[0.12, 0.18, 0.16]} />
        <meshStandardMaterial color="#1d1410" roughness={0.85} />
      </mesh>
    </>
  );
}

function ProceduralCharacterFigure({ skin, accent, outfitMaterialRef, upperRef, isActiveLane }) {
  if (skin?.modelKind === "negociante") {
    return <NegocianteFigure skin={skin} outfitMaterialRef={outfitMaterialRef} upperRef={upperRef} isActiveLane={isActiveLane} />;
  }

  if (skin?.modelKind === "gazpacho") {
    return <GazpachoFigure skin={skin} outfitMaterialRef={outfitMaterialRef} upperRef={upperRef} isActiveLane={isActiveLane} />;
  }

  if (skin?.modelKind === "cartachin") {
    return <CartachinFigure skin={skin} outfitMaterialRef={outfitMaterialRef} upperRef={upperRef} isActiveLane={isActiveLane} />;
  }

  return <FallbackFigure accent={accent} outfitMaterialRef={outfitMaterialRef} upperRef={upperRef} isActiveLane={isActiveLane} />;
}

export function CharacterFigure({
  skin,
  accent,
  outfitMaterialRef,
  upperRef,
  isActiveLane,
  animationMode = null,
  animationClipOverride = null,
  facingOffset = 0,
  poseMode = null,
  poseVariant = 0,
  gazeRef,
  onAnimationNames,
  forceProcedural = false
}) {
  if (forceProcedural) {
    return <ProceduralCharacterFigure skin={skin} accent={accent} outfitMaterialRef={outfitMaterialRef} upperRef={upperRef} isActiveLane={isActiveLane} />;
  }

  if (skin?.modelSrc) {
    return (
      <Suspense fallback={<ProceduralCharacterFigure skin={skin} accent={accent} outfitMaterialRef={outfitMaterialRef} upperRef={upperRef} isActiveLane={isActiveLane} />}>
        <CharacterModelAsset
          src={skin.modelSrc}
          scale={skin.modelScale ?? 1}
          position={skin.modelPosition ?? [0, 0, 0]}
          rotation={[
            skin.modelRotation?.[0] ?? 0,
            (skin.modelRotation?.[1] ?? 0) + facingOffset,
            skin.modelRotation?.[2] ?? 0
          ]}
          targetHeight={skin.modelTargetHeight ?? 1.78}
          animationMode={animationMode}
          animationClipMap={skin.animationClipMap ?? {}}
          animationTimeScaleMap={skin.animationTimeScaleMap ?? {}}
          animationClipOverride={animationClipOverride}
          poseMode={poseMode}
          poseVariant={poseVariant}
          gazeRef={gazeRef}
          onAnimationNames={onAnimationNames}
        />
      </Suspense>
    );
  }

  return <ProceduralCharacterFigure skin={skin} accent={accent} outfitMaterialRef={outfitMaterialRef} upperRef={upperRef} isActiveLane={isActiveLane} />;
}
