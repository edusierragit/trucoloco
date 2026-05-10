import { RoundedBox, Text } from "@react-three/drei";

const BAR = {
  wood: "#2b160d",
  woodDark: "#140b08",
  brass: "#b47a34",
  curtain: "#1b0d0a",
  curtainDeep: "#0c0706",
  wallTrim: "#3b2819",
  bottleGreen: "#244737",
  bottleAmber: "#5b3519",
  bottleBlue: "#1e3a43"
};

function FloorPlanks() {
  return (
    <group name="World_FloorPlanks" position={[0, -0.02, 0]}>
      {Array.from({ length: 13 }, (_, index) => {
        const z = -3.9 + index * 0.64;
        const color = index % 2 === 0 ? "#26140d" : "#1b100c";

        return (
          <RoundedBox key={index} args={[10.6, 0.018, 0.034]} radius={0.006} position={[0, -1.98, z]}>
            <meshStandardMaterial color={color} roughness={0.88} metalness={0.03} />
          </RoundedBox>
        );
      })}
      {[-4.9, -2.45, 0, 2.45, 4.9].map((x) => (
        <RoundedBox key={x} args={[0.022, 0.02, 7.7]} radius={0.006} position={[x, -1.975, -0.05]}>
          <meshStandardMaterial color="#100907" roughness={0.9} />
        </RoundedBox>
      ))}
    </group>
  );
}

function CurtainWall({ side }) {
  const x = side === "left" ? -5.29 : 5.29;
  const sign = side === "left" ? -1 : 1;
  const isLeft = side === "left";

  return (
    <group name={`World_Curtain_${side}`} position={[x, 0.55, -0.4]} rotation={[0, Math.PI / 2, 0]}>
      {isLeft ? (
        <>
          <RoundedBox args={[2.32, 3.45, 0.08]} radius={0.045} position={[-2.34, 0, 0]} receiveShadow>
            <meshStandardMaterial color={BAR.curtainDeep} roughness={0.98} />
          </RoundedBox>
          <RoundedBox args={[2.18, 3.45, 0.08]} radius={0.045} position={[2.42, 0, 0]} receiveShadow>
            <meshStandardMaterial color={BAR.curtainDeep} roughness={0.98} />
          </RoundedBox>
        </>
      ) : (
        <RoundedBox args={[7.0, 3.45, 0.08]} radius={0.045} receiveShadow>
          <meshStandardMaterial color={BAR.curtainDeep} roughness={0.98} />
        </RoundedBox>
      )}
      {Array.from({ length: 8 }, (_, index) => {
        const foldX = -3.05 + index * 0.86;
        if (isLeft && foldX > -1.12 && foldX < 1.04) return null;

        return (
        <RoundedBox
          key={index}
          args={[0.06, 3.28, 0.07]}
          radius={0.022}
          position={[foldX, 0, -0.045]}
          receiveShadow
        >
          <meshStandardMaterial color={index % 2 === 0 ? BAR.curtain : "#27110d"} roughness={0.96} />
        </RoundedBox>
        );
      })}
      <RoundedBox args={[7.05, 0.08, 0.12]} radius={0.025} position={[0, 1.76, -0.07]}>
        <meshStandardMaterial color={BAR.brass} roughness={0.42} metalness={0.55} />
      </RoundedBox>
      <pointLight position={[0.15 * sign, 0.85, -0.35]} intensity={3.4} color={side === "left" ? "#d25b3e" : "#3ebfb3"} />
    </group>
  );
}

function BackCounter() {
  const bottleColors = [BAR.bottleGreen, BAR.bottleAmber, BAR.bottleBlue, "#4f2118", "#302a15"];

  return (
    <group name="World_BackCounter">
      <RoundedBox args={[6.7, 0.7, 0.62]} radius={0.08} position={[0, -1.15, -3.58]} castShadow receiveShadow>
        <meshStandardMaterial color={BAR.wood} roughness={0.74} metalness={0.06} />
      </RoundedBox>
      <RoundedBox args={[6.9, 0.12, 0.72]} radius={0.04} position={[0, -0.73, -3.58]} castShadow receiveShadow>
        <meshStandardMaterial color="#3c2112" roughness={0.58} metalness={0.08} />
      </RoundedBox>
      <RoundedBox args={[6.5, 0.04, 0.08]} radius={0.012} position={[0, -0.66, -3.2]}>
        <meshStandardMaterial color={BAR.brass} roughness={0.34} metalness={0.62} />
      </RoundedBox>

      {[-1.1, 0.08, 1.22].map((y, row) => (
        <group key={y} position={[0, y, -3.93]}>
          <RoundedBox args={[5.8, 0.065, 0.16]} radius={0.016}>
            <meshStandardMaterial color={BAR.woodDark} roughness={0.72} />
          </RoundedBox>
          {Array.from({ length: 10 }, (_, index) => {
            const x = -2.45 + index * 0.55 + (row % 2) * 0.16;
            const height = 0.28 + ((row + index) % 3) * 0.09;
            const color = bottleColors[(row + index) % bottleColors.length];

            return (
              <group key={index} position={[x, 0.18, 0.1]}>
                <mesh castShadow>
                  <cylinderGeometry args={[0.045, 0.06, height, 10]} />
                  <meshStandardMaterial color={color} roughness={0.35} transparent opacity={0.78} />
                </mesh>
                <mesh position={[0, height * 0.5 + 0.055, 0]} castShadow>
                  <cylinderGeometry args={[0.02, 0.026, 0.11, 8]} />
                  <meshStandardMaterial color="#0d0806" roughness={0.5} />
                </mesh>
              </group>
            );
          })}
        </group>
      ))}
    </group>
  );
}

function BoothSilhouettes() {
  return (
    <group name="World_BoothSilhouettes">
      {[-3.8, 3.8].map((x, index) => (
        <group key={x} position={[x, -1.58, 2.72]} rotation={[0, x < 0 ? -0.35 : 0.35, 0]}>
          <RoundedBox args={[1.28, 0.24, 0.76]} radius={0.08} castShadow receiveShadow>
            <meshStandardMaterial color={index === 0 ? "#24120e" : "#131d1b"} roughness={0.92} />
          </RoundedBox>
          <RoundedBox args={[1.18, 0.94, 0.18]} radius={0.06} position={[0, 0.48, 0.29]} castShadow receiveShadow>
            <meshStandardMaterial color={index === 0 ? "#301611" : "#172824"} roughness={0.96} />
          </RoundedBox>
          <mesh position={[-0.36, 0.76, 0.03]} castShadow>
            <sphereGeometry args={[0.12, 12, 10]} />
            <meshStandardMaterial color="#070504" roughness={0.9} />
          </mesh>
          <mesh position={[0.26, 0.7, 0.03]} castShadow>
            <sphereGeometry args={[0.1, 12, 10]} />
            <meshStandardMaterial color="#080605" roughness={0.9} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function EntryPortal() {
  return (
    <group name="World_EntryPortal" position={[0, -0.22, 4.06]}>
      <RoundedBox args={[2.2, 2.75, 0.22]} radius={0.08} receiveShadow>
        <meshStandardMaterial color="#0a0605" roughness={0.92} />
      </RoundedBox>
      <RoundedBox args={[1.54, 2.24, 0.08]} radius={0.04} position={[0, -0.06, 0.08]}>
        <meshStandardMaterial color="#070404" roughness={0.98} emissive="#4d210f" emissiveIntensity={0.14} />
      </RoundedBox>
      <RoundedBox args={[1.84, 0.09, 0.16]} radius={0.025} position={[0, 1.18, 0.16]}>
        <meshStandardMaterial color={BAR.brass} roughness={0.34} metalness={0.52} />
      </RoundedBox>
      <pointLight position={[0, 0.4, 0.54]} intensity={5.2} color="#d35f2d" />
      <Text position={[0, 1.42, 0.17]} fontSize={0.095} color="#d0a15d" anchorX="center" anchorY="middle" letterSpacing={0.16}>
        ENTRADA
      </Text>
    </group>
  );
}

function CeilingBeams() {
  return (
    <group name="World_CeilingBeams">
      {[-3.1, -1.55, 0, 1.55, 3.1].map((x) => (
        <RoundedBox key={x} args={[0.14, 0.16, 8.2]} radius={0.025} position={[x, 3.56, -0.2]} receiveShadow>
          <meshStandardMaterial color="#160b07" roughness={0.86} />
        </RoundedBox>
      ))}
      <RoundedBox args={[10.8, 0.1, 0.16]} radius={0.025} position={[0, 3.42, -3.8]}>
        <meshStandardMaterial color={BAR.wallTrim} roughness={0.72} />
      </RoundedBox>
    </group>
  );
}

export function BarRoom() {
  return (
    <group name="World_BarRoom">
      <FloorPlanks />
      <CurtainWall side="left" />
      <CurtainWall side="right" />
      <BackCounter />
      <BoothSilhouettes />
      <EntryPortal />
      <CeilingBeams />
    </group>
  );
}
