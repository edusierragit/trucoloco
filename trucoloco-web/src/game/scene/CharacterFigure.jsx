import { Suspense, useEffect, useMemo } from "react";
import { Cylinder, RoundedBox, useAnimations, useGLTF } from "@react-three/drei";
import { Box3, Vector3 } from "three";
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

function CharacterModelAsset({
  src,
  scale = 1,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  targetHeight = 1.78,
  animationMode = null,
  animationClipMap = {}
}) {
  const { scene, animations = [] } = useGLTF(src);
  const preparedAnimations = useMemo(() => makeClipsInPlace(animations), [animations]);
  const { clonedScene, offset, normalizedScale } = useMemo(() => {
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

    return {
      clonedScene: clone,
      offset: centeredOffset,
      normalizedScale: scaleFactor
    };
  }, [scene, targetHeight]);
  const { actions } = useAnimations(preparedAnimations, clonedScene);
  const actionName = useMemo(() => {
    if (!animationMode) return null;

    const names = Object.keys(actions);
    if (!names.length) return null;

    const hasMappedMode = Object.prototype.hasOwnProperty.call(animationClipMap, animationMode);
    const mappedName = hasMappedMode ? animationClipMap[animationMode] : animationMode === "run" ? animationClipMap.walk : null;
    if (typeof mappedName === "string" && actions[mappedName]) return mappedName;

    if (animationMode === "idle") return null;

    const modeWords = animationMode === "run"
      ? ["run", "jog", "sprint"]
      : animationMode === "walk"
        ? ["walk", "walking"]
        : animationMode === "box"
          ? ["box", "fight", "punch"]
        : ["idle", "stand", "breath"];
    const matched = names.find((name) => modeWords.some((word) => name.toLowerCase().includes(word)));

    return matched ?? (animationMode === "idle" ? names[0] : names.find((name) => name.toLowerCase().includes("walk")) ?? names[0]);
  }, [actions, animationClipMap, animationMode]);

  useEffect(() => {
    if (!actionName) return undefined;

    Object.entries(actions).forEach(([name, action]) => {
      if (name === actionName) {
        action.reset().fadeIn(0.18).play();
      } else {
        action.fadeOut(0.16);
      }
    });

    return () => {
      actions[actionName]?.fadeOut(0.12);
    };
  }, [actionName, actions]);

  return (
    <group scale={scale} position={position} rotation={rotation}>
      <primitive object={clonedScene} scale={normalizedScale} position={offset} dispose={null} />
    </group>
  );
}

function CharacterBody({ skin, outfitMaterialRef, upperRef, children, isActiveLane }) {
  return (
    <>
      <mesh position={[0, 0.3, -0.04]} castShadow receiveShadow>
        <cylinderGeometry args={[0.24, 0.29, 0.22, 18]} />
        <meshStandardMaterial color="#25160f" roughness={0.9} />
      </mesh>

      <mesh position={[0, 0.5, 0]} castShadow receiveShadow>
        <sphereGeometry args={[0.32, 18, 18]} />
        <meshStandardMaterial color={skin.outfitColor} roughness={0.7} />
      </mesh>

      <Cylinder name="Character_Torso" args={[0.24, 0.31, 0.95, 18]} position={[0, 0.86, 0]} castShadow>
        <meshStandardMaterial
          ref={outfitMaterialRef}
          color={skin.shirtColor ?? skin.outfitColor}
          roughness={0.58}
          metalness={0.04}
          emissive={isActiveLane ? "#3b2418" : "#000000"}
          emissiveIntensity={isActiveLane ? 0.16 : 0}
        />
      </Cylinder>

      <mesh position={[0, 1.14, 0.03]} castShadow>
        <sphereGeometry args={[0.3, 18, 18]} />
        <meshStandardMaterial color={skin.outfitColor} roughness={0.7} />
      </mesh>

      <mesh position={[0, 1.28, 0.02]} castShadow>
        <cylinderGeometry args={[0.09, 0.12, 0.16, 14]} />
        <meshStandardMaterial color={skin.skinColor} roughness={0.84} />
      </mesh>

      <group ref={upperRef} position={[0, 1.28, 0.03]}>
        {children}
      </group>
    </>
  );
}

function NegocianteFigure({ skin, outfitMaterialRef, upperRef, isActiveLane }) {
  return (
    <CharacterBody skin={skin} outfitMaterialRef={outfitMaterialRef} upperRef={upperRef} isActiveLane={isActiveLane}>
      <mesh position={[0, 0.24, 0]} castShadow>
        <sphereGeometry args={[0.22, 24, 24]} />
        <meshStandardMaterial color={skin.skinColor} roughness={0.88} />
      </mesh>

      <mesh position={[0, 0.09, 0.1]} castShadow>
        <sphereGeometry args={[0.15, 18, 18]} />
        <meshStandardMaterial color={skin.beardColor} roughness={0.95} />
      </mesh>

      <mesh position={[0, 0.02, 0.06]} scale={[0.88, 0.58, 0.72]} castShadow>
        <sphereGeometry args={[0.18, 16, 16]} />
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
    [-0.12, 0.42, 0.01, 0.06],
    [0, 0.45, 0.04, 0.08],
    [0.12, 0.41, 0.02, 0.06],
    [-0.18, 0.34, 0.01, 0.05],
    [0.18, 0.34, 0.01, 0.05],
    [-0.06, 0.37, 0.12, 0.05],
    [0.08, 0.36, 0.12, 0.05]
  ];

  return (
    <CharacterBody skin={skin} outfitMaterialRef={outfitMaterialRef} upperRef={upperRef} isActiveLane={isActiveLane}>
      <mesh position={[0, 0.24, 0]} castShadow>
        <sphereGeometry args={[0.22, 24, 24]} />
        <meshStandardMaterial color={skin.skinColor} roughness={0.84} />
      </mesh>

      {hairTufts.map(([x, y, z, scale], index) => (
        <mesh key={index} position={[x, y, z]} castShadow>
          <sphereGeometry args={[scale, 14, 14]} />
          <meshStandardMaterial color={skin.hairColor} roughness={0.92} />
        </mesh>
      ))}

      <mesh position={[0, 0.06, 0.1]} castShadow>
        <sphereGeometry args={[0.15, 18, 18]} />
        <meshStandardMaterial color={skin.beardColor} roughness={0.96} />
      </mesh>

      <mesh position={[0, 0.12, 0.12]} scale={[0.92, 0.42, 0.54]} castShadow>
        <sphereGeometry args={[0.15, 16, 16]} />
        <meshStandardMaterial color={skin.beardColor} roughness={0.96} />
      </mesh>

      <group position={[0, 0.2, 0.18]}>
        <RoundedBox args={[0.2, 0.09, 0.038]} radius={0.04} position={[-0.11, 0, 0]}>
          <meshStandardMaterial color={skin.accessoryColor} roughness={0.14} metalness={0.1} />
        </RoundedBox>
        <RoundedBox args={[0.2, 0.09, 0.038]} radius={0.04} position={[0.11, 0, 0]}>
          <meshStandardMaterial color={skin.accessoryColor} roughness={0.14} metalness={0.1} />
        </RoundedBox>
        <mesh position={[0, 0, 0.008]}>
          <boxGeometry args={[0.07, 0.02, 0.02]} />
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
      <mesh position={[0, 0.24, 0]} castShadow>
        <sphereGeometry args={[0.22, 24, 24]} />
        <meshStandardMaterial color={skin.skinColor} roughness={0.86} />
      </mesh>

      <mesh position={[0, 0.1, 0.1]} castShadow>
        <sphereGeometry args={[0.13, 16, 16]} />
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

      <group position={[0, -0.22, 0.18]} rotation={[0.08, 0, 0]}>
        <RoundedBox args={[0.78, 0.7, 0.055]} radius={0.045} castShadow receiveShadow>
          <meshStandardMaterial color={skin.ponchoColor ?? skin.outfitColor} roughness={0.92} />
        </RoundedBox>
        <RoundedBox args={[0.18, 0.38, 0.065]} radius={0.025} position={[0, -0.02, 0.035]} castShadow>
          <meshStandardMaterial color="#17100d" roughness={0.88} />
        </RoundedBox>
        <mesh position={[0, 0.28, 0.038]}>
          <boxGeometry args={[0.62, 0.025, 0.02]} />
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

export function CharacterFigure({ skin, accent, outfitMaterialRef, upperRef, isActiveLane, animationMode = null, forceProcedural = false }) {
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
          rotation={skin.modelRotation ?? [0, 0, 0]}
          targetHeight={skin.modelTargetHeight ?? 1.78}
          animationMode={animationMode}
          animationClipMap={skin.animationClipMap ?? {}}
        />
      </Suspense>
    );
  }

  return <ProceduralCharacterFigure skin={skin} accent={accent} outfitMaterialRef={outfitMaterialRef} upperRef={upperRef} isActiveLane={isActiveLane} />;
}
