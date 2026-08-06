import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { RoundedBox } from "@react-three/drei";
import { CanvasTexture, RepeatWrapping } from "three";
import { assetUrl } from "../../assetUrl";
import { SceneText as Text } from "../SceneText";

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

// pared de ladrillos procedural: textura canvas (1 draw call) con hiladas
// trabadas, mortero oscuro y variacion por ladrillo — reemplaza el fondo negro
// indefinido detras del cartel y las botellas
function makeBrickTexture() {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 512;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#0b0605"; // mortero
  ctx.fillRect(0, 0, 512, 512);
  const bh = 44;
  const bw = 96;
  const gap = 5;
  for (let row = 0, y = 0; y < 512 + bh; y += bh, row++) {
    const off = row % 2 ? -bw / 2 : 0;
    for (let x = off - bw; x < 512 + bw; x += bw) {
      const shade = 0.72 + Math.random() * 0.42;
      const r = Math.min(255, Math.floor(64 * shade));
      const g = Math.min(255, Math.floor(31 * shade));
      const b = Math.min(255, Math.floor(22 * shade));
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.fillRect(x + gap, y + gap, bw - gap * 2, bh - gap * 2);
      // reflejo tenue arriba del ladrillo
      ctx.fillStyle = `rgba(255,190,150,${0.04 + Math.random() * 0.04})`;
      ctx.fillRect(x + gap, y + gap, bw - gap * 2, 4);
    }
  }
  const tex = new CanvasTexture(c);
  tex.wrapS = tex.wrapT = RepeatWrapping;
  tex.repeat.set(3, 1.4);
  return tex;
}

function BrickBackWall() {
  const tex = useMemo(() => makeBrickTexture(), []);
  return (
    <group name="World_BrickWall">
      {/* pared trasera de ladrillo: fondo definido detras del cartel y la barra */}
      <mesh position={[0, 0.5, -4.08]} receiveShadow>
        <planeGeometry args={[10.9, 6.2]} />
        <meshStandardMaterial map={tex} roughness={0.98} metalness={0.02} />
      </mesh>
    </group>
  );
}

// Botella de bar: vidrio con licor adentro (nivel real), hombro, cuello,
// tapa y etiqueta. Compuesta, cero assets. `kind` define la silueta.
function Bottle({ x = 0, z = 0, kind = "wine", glass = "#26411f", liquid = "#4c150f", label = "#dcc9a0", h = 0.56 }) {
  const rBody = kind === "whisky" ? 0.058 : kind === "gin" ? 0.05 : kind === "verm" ? 0.052 : 0.044;
  const rNeck = 0.015;
  const bodyH = h * (kind === "whisky" ? 0.5 : 0.6);
  const shoulderH = h * 0.13;
  const neckH = h * (kind === "gin" ? 0.32 : 0.24);
  const topY = bodyH + shoulderH + neckH;

  return (
    <group position={[x, 0, z]}>
      {/* cuerpo de vidrio */}
      <mesh position={[0, bodyH / 2, 0]} castShadow>
        <cylinderGeometry args={[rBody, rBody * 0.96, bodyH, 16]} />
        <meshStandardMaterial color={glass} roughness={0.08} metalness={0} transparent opacity={0.46} />
      </mesh>
      {/* licor adentro (nivel ~66%) */}
      <mesh position={[0, bodyH * 0.33, 0]}>
        <cylinderGeometry args={[rBody * 0.9, rBody * 0.88, bodyH * 0.66, 16]} />
        <meshStandardMaterial color={liquid} roughness={0.34} metalness={0.05} transparent opacity={0.92} />
      </mesh>
      {/* hombro cónico */}
      <mesh position={[0, bodyH + shoulderH / 2, 0]} castShadow>
        <cylinderGeometry args={[rNeck * 1.4, rBody, shoulderH, 16]} />
        <meshStandardMaterial color={glass} roughness={0.08} transparent opacity={0.46} />
      </mesh>
      {/* cuello */}
      <mesh position={[0, bodyH + shoulderH + neckH / 2, 0]} castShadow>
        <cylinderGeometry args={[rNeck, rNeck * 1.2, neckH, 12]} />
        <meshStandardMaterial color={glass} roughness={0.1} transparent opacity={0.55} />
      </mesh>
      {/* tapa / corcho */}
      <mesh position={[0, topY + 0.022, 0]}>
        <cylinderGeometry args={[rNeck * 1.25, rNeck * 1.25, 0.045, 10]} />
        <meshStandardMaterial color={kind === "gin" ? "#1c1c1e" : "#2a1a0c"} roughness={0.65} metalness={0.1} />
      </mesh>
      {/* etiqueta al frente */}
      <mesh position={[0, bodyH * 0.44, rBody * 0.93]}>
        <planeGeometry args={[rBody * 1.55, bodyH * 0.46]} />
        <meshStandardMaterial color={label} roughness={0.75} side={2} />
      </mesh>
      {/* filete de la etiqueta */}
      <mesh position={[0, bodyH * 0.22, rBody * 0.94]}>
        <planeGeometry args={[rBody * 1.55, bodyH * 0.04]} />
        <meshStandardMaterial color={liquid} roughness={0.6} side={2} />
      </mesh>
    </group>
  );
}

// Copa colgada boca abajo (rack de la barra)
function HangingGlass({ x }) {
  return (
    <group position={[x, 0, 0]}>
      <mesh position={[0, -0.09, 0]}>
        <cylinderGeometry args={[0.012, 0.012, 0.14, 8]} />
        <meshStandardMaterial color="#cfe0e6" roughness={0.12} transparent opacity={0.5} />
      </mesh>
      <mesh position={[0, -0.02, 0]}>
        <sphereGeometry args={[0.05, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#cfe0e6" roughness={0.1} transparent opacity={0.4} side={2} />
      </mesh>
      <mesh position={[0, -0.165, 0]}>
        <cylinderGeometry args={[0.035, 0.035, 0.008, 12]} />
        <meshStandardMaterial color="#dfeaee" roughness={0.1} transparent opacity={0.5} />
      </mesh>
    </group>
  );
}

const BOTTLE_KINDS = [
  { kind: "wine",    glass: "#26411f", liquid: "#4c150f", label: "#dcc9a0", h: 0.60 },
  { kind: "whisky",  glass: "#5a3a16", liquid: "#8a4a12", label: "#ecd6a0", h: 0.50 },
  { kind: "gin",     glass: "#274a52", liquid: "#bfe0e6", label: "#e8eef0", h: 0.58 },
  { kind: "rum",     glass: "#3a2210", liquid: "#6e3a12", label: "#c98a4a", h: 0.52 },
  { kind: "verm",    glass: "#4a1a1a", liquid: "#7a1414", label: "#e6c0a0", h: 0.55 },
  { kind: "liqueur", glass: "#3a2a52", liquid: "#7a5ad0", label: "#e0d4f0", h: 0.53 }
];

// La barra del antro: mostrador con tapa de madera + filo de bronce, panel
// frontal con boiserie, apoyapiés de bronce, espejo enmarcado atrás, tres
// estantes con botellas variadas y copas colgadas. Medida contra la pared de
// ladrillo (z ≈ -3.6 a -3.95) para no tocar la mesa central.
// Trago apoyado en la barra: vaso con líquido (y hielo/espuma según tipo).
function Drink({ x, z = -3.24, kind = "tumbler", liquid = "#a0551a" }) {
  if (kind === "wine") {
    return (
      <group position={[x, 0, z]}>
        <mesh position={[0, 0.006, 0]}><cylinderGeometry args={[0.05, 0.05, 0.012, 16]} /><meshStandardMaterial color="#dfeef2" roughness={0.1} transparent opacity={0.5} /></mesh>
        <mesh position={[0, 0.085, 0]}><cylinderGeometry args={[0.006, 0.006, 0.16, 8]} /><meshStandardMaterial color="#dfeef2" roughness={0.1} transparent opacity={0.5} /></mesh>
        <mesh position={[0, 0.185, 0]}><cylinderGeometry args={[0.052, 0.03, 0.1, 16]} /><meshStandardMaterial color="#dfeef2" roughness={0.06} transparent opacity={0.32} /></mesh>
        <mesh position={[0, 0.16, 0]}><cylinderGeometry args={[0.043, 0.028, 0.055, 16]} /><meshStandardMaterial color={liquid} roughness={0.3} transparent opacity={0.86} /></mesh>
      </group>
    );
  }
  if (kind === "beer") {
    return (
      <group position={[x, 0, z]}>
        <mesh position={[0, 0.12, 0]}><cylinderGeometry args={[0.046, 0.04, 0.24, 16]} /><meshStandardMaterial color="#e8d9b0" roughness={0.08} transparent opacity={0.3} /></mesh>
        <mesh position={[0, 0.1, 0]}><cylinderGeometry args={[0.041, 0.036, 0.19, 16]} /><meshStandardMaterial color="#c8860f" roughness={0.25} transparent opacity={0.9} /></mesh>
        <mesh position={[0, 0.215, 0]}><cylinderGeometry args={[0.046, 0.045, 0.035, 16]} /><meshStandardMaterial color="#f5edd8" roughness={0.6} /></mesh>
      </group>
    );
  }
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 0.055, 0]}><cylinderGeometry args={[0.046, 0.04, 0.11, 16]} /><meshStandardMaterial color="#dfeef2" roughness={0.06} transparent opacity={0.28} /></mesh>
      <mesh position={[0, 0.04, 0]}><cylinderGeometry args={[0.041, 0.038, 0.065, 16]} /><meshStandardMaterial color={liquid} roughness={0.3} transparent opacity={0.86} /></mesh>
      <mesh position={[0.012, 0.06, 0]} rotation={[0.3, 0.4, 0.1]}><boxGeometry args={[0.028, 0.028, 0.028]} /><meshStandardMaterial color="#eaf4f6" roughness={0.1} transparent opacity={0.55} /></mesh>
    </group>
  );
}

const BAR_DRINKS = [
  { x: -2.7, kind: "tumbler", liquid: "#9a5216" },
  { x: -1.95, kind: "wine", liquid: "#5a1410" },
  { x: -1.1, kind: "beer", liquid: "#c8860f" },
  { x: 0.5, kind: "tumbler", liquid: "#7a3a12" },
  { x: 1.4, kind: "wine", liquid: "#6a1414" },
  { x: 2.5, kind: "beer", liquid: "#caa019" }
];

// La barra del antro: mostrador de madera (tipo bar de boliche) con tragos
// apoyados arriba y filo de bronce; back-bar bajo con espejo y dos estantes
// de vidrio con botellas en filas prolijas. TODO por debajo del neón
// TRUCOLOCO (y≈2.05) para no taparlo. Medida contra la pared de ladrillo.
function BackCounter() {
  return (
    <group name="World_BackCounter">
      {/* ── mostrador (frente hacia la mesa) ── */}
      <RoundedBox args={[6.8, 0.26, 0.5]} radius={0.03} position={[0, -1.85, -3.42]} receiveShadow>
        <meshStandardMaterial color="#0b0605" roughness={0.95} />
      </RoundedBox>
      <RoundedBox args={[6.7, 1.06, 0.42]} radius={0.05} position={[0, -1.36, -3.36]} castShadow receiveShadow>
        <meshStandardMaterial color={BAR.wood} roughness={0.72} metalness={0.06} />
      </RoundedBox>
      {[-2.6, -1.55, -0.5, 0.5, 1.55, 2.6].map((x) => (
        <RoundedBox key={`batten-${x}`} args={[0.08, 0.92, 0.06]} radius={0.02} position={[x, -1.34, -3.15]} castShadow>
          <meshStandardMaterial color="#20110a" roughness={0.78} metalness={0.05} />
        </RoundedBox>
      ))}
      {/* tapa de madera con voladizo (la barra donde se apoyan los tragos) */}
      <RoundedBox args={[6.98, 0.13, 0.7]} radius={0.05} position={[0, -0.73, -3.4]} castShadow receiveShadow>
        <meshStandardMaterial color="#4a2a15" roughness={0.34} metalness={0.14} />
      </RoundedBox>
      <RoundedBox args={[6.98, 0.05, 0.05]} radius={0.02} position={[0, -0.7, -3.06]}>
        <meshStandardMaterial color={BAR.brass} roughness={0.3} metalness={0.7} />
      </RoundedBox>
      {/* apoyapiés de bronce */}
      <mesh position={[0, -1.78, -3.02]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.03, 0.03, 6.3, 12]} />
        <meshStandardMaterial color={BAR.brass} roughness={0.32} metalness={0.72} />
      </mesh>
      {[-2.9, 0, 2.9].map((x) => (
        <mesh key={`rail-${x}`} position={[x, -1.88, -3.02]}>
          <cylinderGeometry args={[0.022, 0.022, 0.2, 8]} />
          <meshStandardMaterial color={BAR.brass} roughness={0.34} metalness={0.7} />
        </mesh>
      ))}
      {/* tragos apoyados sobre la barra */}
      {BAR_DRINKS.map((d) => (
        <group key={`drink-${d.x}`} position={[0, -0.66, 0]}>
          <Drink {...d} />
        </group>
      ))}

      {/* ── back-bar: mueble bajo + espejo (todo por debajo del neón) ── */}
      {/* mueble bajo */}
      <RoundedBox args={[6.2, 0.62, 0.42]} radius={0.04} position={[0, -1.42, -3.74]} receiveShadow>
        <meshStandardMaterial color={BAR.woodDark} roughness={0.74} metalness={0.05} />
      </RoundedBox>
      <RoundedBox args={[6.3, 0.08, 0.5]} radius={0.03} position={[0, -1.06, -3.72]} castShadow receiveShadow>
        <meshStandardMaterial color="#3c2112" roughness={0.44} metalness={0.12} />
      </RoundedBox>
      {/* espejo enmarcado (bajo) */}
      <RoundedBox args={[4.5, 1.5, 0.04]} radius={0.03} position={[0, -0.15, -4.0]}>
        <meshStandardMaterial color="#100e0c" roughness={0.18} metalness={0.82} />
      </RoundedBox>
      {[[0, 0.62, 4.7, 0.09], [0, -0.92, 4.7, 0.09], [-2.3, -0.15, 0.09, 1.62], [2.3, -0.15, 0.09, 1.62]].map(([mx, my, w, hh], i) => (
        <RoundedBox key={`frame-${i}`} args={[w, hh, 0.06]} radius={0.02} position={[mx, my, -3.98]}>
          <meshStandardMaterial color={BAR.brass} roughness={0.36} metalness={0.62} />
        </RoundedBox>
      ))}

      {/* ── dos estantes de vidrio con botellas en filas prolijas ── */}
      {[-0.32, 0.52].map((y, row) => (
        <group key={y} position={[0, y, -3.86]}>
          {/* estante de vidrio */}
          <mesh position={[0, 0, 0.02]} castShadow receiveShadow>
            <boxGeometry args={[5.6, 0.03, 0.26]} />
            <meshStandardMaterial color="#bfe6ea" roughness={0.1} metalness={0.1} transparent opacity={0.34} />
          </mesh>
          {/* soportes de bronce del estante */}
          {[-2.6, 2.6].map((sx) => (
            <mesh key={`sup-${sx}`} position={[sx, -0.09, 0.02]}>
              <cylinderGeometry args={[0.012, 0.012, 0.18, 8]} />
              <meshStandardMaterial color={BAR.brass} roughness={0.34} metalness={0.68} />
            </mesh>
          ))}
          {/* tira LED cálida bajo el estante (ilumina las botellas de abajo) */}
          <mesh position={[0, -0.02, 0.12]}>
            <boxGeometry args={[5.5, 0.012, 0.012]} />
            <meshStandardMaterial color="#ffcf8a" emissive="#ffb459" emissiveIntensity={1.4} />
          </mesh>
          {/* botellas en fila */}
          {Array.from({ length: 7 }, (_, i) => {
            const spec = BOTTLE_KINDS[(i + row * 3) % BOTTLE_KINDS.length];
            const x = -2.55 + i * 0.85;
            return <Bottle key={i} x={x} z={0.03} {...spec} />;
          })}
        </group>
      ))}
    </group>
  );
}

function RoomSeams() {
  return (
    <group name="World_RoomSeams">
      <RoundedBox args={[10.9, 0.12, 0.12]} radius={0.025} position={[0, -1.72, -4.0]} receiveShadow>
        <meshStandardMaterial color="#090504" roughness={0.86} />
      </RoundedBox>
      <RoundedBox args={[0.12, 0.12, 8.2]} radius={0.025} position={[-5.18, -1.72, 0.05]} receiveShadow>
        <meshStandardMaterial color="#090504" roughness={0.86} />
      </RoundedBox>
      <RoundedBox args={[0.12, 0.12, 8.2]} radius={0.025} position={[5.18, -1.72, 0.05]} receiveShadow>
        <meshStandardMaterial color="#090504" roughness={0.86} />
      </RoundedBox>
      <RoundedBox args={[10.8, 0.16, 0.12]} radius={0.025} position={[0, 2.72, -3.96]}>
        <meshStandardMaterial color={BAR.wallTrim} roughness={0.76} />
      </RoundedBox>
      <RoundedBox args={[0.12, 0.16, 7.8]} radius={0.025} position={[-5.18, 2.72, -0.08]}>
        <meshStandardMaterial color={BAR.wallTrim} roughness={0.76} />
      </RoundedBox>
      <RoundedBox args={[0.12, 0.16, 7.8]} radius={0.025} position={[5.18, 2.72, -0.08]}>
        <meshStandardMaterial color={BAR.wallTrim} roughness={0.76} />
      </RoundedBox>
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

// La entrada del antro: arco de madera + bronce, doble puerta entreabierta con
// tableros y manijas, cartel ENTRADA iluminado, cordón de terciopelo entre
// parantes de bronce y felpudo. Todo hacia la sala (−z local). Cero assets.
function EntryPortal() {
  const yF = -1.76; // piso en coords locales (group.y=-0.22, piso world=-1.98)
  const doorH = 2.9;
  const doorTopY = yF + doorH;
  const midY = yF + doorH / 2;

  return (
    <group name="World_EntryPortal" position={[0, -0.22, 4.06]}>
      {/* arco/marco de madera oscura */}
      <RoundedBox args={[2.52, doorH + 0.26, 0.3]} radius={0.06} position={[0, midY, 0.03]} receiveShadow>
        <meshStandardMaterial color="#1a0f08" roughness={0.9} metalness={0.06} />
      </RoundedBox>
      {/* dintel de bronce */}
      <RoundedBox args={[2.66, 0.16, 0.36]} radius={0.04} position={[0, doorTopY + 0.07, 0.0]}>
        <meshStandardMaterial color={BAR.brass} roughness={0.36} metalness={0.6} />
      </RoundedBox>
      {/* hueco oscuro del pasillo */}
      <mesh position={[0, midY, 0.05]}>
        <planeGeometry args={[1.94, doorH - 0.08]} />
        <meshStandardMaterial color="#050303" roughness={1} />
      </mesh>

      {/* dos hojas entreabiertas (abren hacia adentro), con tableros y manija */}
      {[-1, 1].map((s) => (
        <group key={s} position={[s * 0.96, midY, -0.02]} rotation={[0, s * 0.3, 0]}>
          <RoundedBox args={[0.9, doorH - 0.16, 0.07]} radius={0.02} position={[-s * 0.45, 0, 0]} castShadow>
            <meshStandardMaterial color="#26150c" roughness={0.72} metalness={0.08} />
          </RoundedBox>
          {[0.75, 0.05, -0.65].map((py) => (
            <RoundedBox key={py} args={[0.58, 0.52, 0.02]} radius={0.03} position={[-s * 0.45, py, -0.05]}>
              <meshStandardMaterial color="#150b06" roughness={0.82} />
            </RoundedBox>
          ))}
          <mesh position={[-s * 0.08, 0, -0.09]}>
            <sphereGeometry args={[0.05, 12, 10]} />
            <meshStandardMaterial color={BAR.brass} roughness={0.3} metalness={0.75} />
          </mesh>
        </group>
      ))}

      {/* cartel ENTRADA iluminado, mirando a la sala */}
      <group position={[0, doorTopY + 0.34, -0.14]} rotation={[0, Math.PI, 0]}>
        <RoundedBox args={[1.52, 0.36, 0.09]} radius={0.04}>
          <meshStandardMaterial color="#0c0805" roughness={0.7} emissive="#7a2a10" emissiveIntensity={0.55} />
        </RoundedBox>
        <Text position={[0, 0, 0.06]} fontSize={0.17} color="#ff8a4a" anchorX="center" anchorY="middle" letterSpacing={0.18} outlineWidth={0.006} outlineColor="#3a0f04">
          ENTRADA
        </Text>
      </group>

      {/* cordón de terciopelo: parantes de bronce + soga que cuelga */}
      {[-1.05, 1.05].map((sx) => (
        <group key={sx} position={[sx, yF, -0.9]}>
          <mesh position={[0, 0.03, 0]}>
            <cylinderGeometry args={[0.12, 0.15, 0.05, 16]} />
            <meshStandardMaterial color="#15100c" roughness={0.5} metalness={0.4} />
          </mesh>
          <mesh position={[0, 0.55, 0]}>
            <cylinderGeometry args={[0.028, 0.034, 1.05, 12]} />
            <meshStandardMaterial color={BAR.brass} roughness={0.3} metalness={0.72} />
          </mesh>
          <mesh position={[0, 1.09, 0]}>
            <sphereGeometry args={[0.062, 14, 12]} />
            <meshStandardMaterial color={BAR.brass} roughness={0.28} metalness={0.78} />
          </mesh>
        </group>
      ))}
      {/* soga (arco vertical achatado que cuelga entre parantes) */}
      <mesh position={[0, yF + 1.09, -0.9]} rotation={[0, 0, Math.PI]} scale={[1, 0.26, 1]}>
        <torusGeometry args={[1.05, 0.03, 10, 40, Math.PI]} />
        <meshStandardMaterial color="#6a1420" roughness={0.85} />
      </mesh>

      {/* felpudo */}
      <mesh position={[0, yF + 0.012, -0.5]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[1.7, 0.92]} />
        <meshStandardMaterial color="#241611" roughness={0.98} />
      </mesh>

      <pointLight position={[0, 0.6, -0.55]} intensity={4.2} distance={4.2} color="#d35f2d" />
    </group>
  );
}

function CeilingBeams() {
  return (
    <group name="World_CeilingBeams">
      {[-3.1, -1.55, 0, 1.55, 3.1].map((x) => (
        <RoundedBox key={x} args={[0.09, 0.1, 7.1]} radius={0.02} position={[x, 4.18, -0.42]} receiveShadow>
          <meshStandardMaterial color="#20120c" roughness={0.86} />
        </RoundedBox>
      ))}
      <RoundedBox args={[10.8, 0.08, 0.12]} radius={0.022} position={[0, 4.05, -3.82]}>
        <meshStandardMaterial color={BAR.wallTrim} roughness={0.72} />
      </RoundedBox>
    </group>
  );
}


// ── pase de arte (Claude): techo, frente, neón, alfombra, lámparas, humo ─────

function CeilingPlane() {
  return (
    <group name="World_Ceiling">
      <mesh position={[0, 4.32, -0.4]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[11.2, 8.6]} />
        <meshStandardMaterial color="#150c08" roughness={0.96} />
      </mesh>
    </group>
  );
}

function FrontWall() {
  // el mismo ladrillo del fondo: la pared de la entrada era un paño negro
  // muerto y desde las sillas VISITA se miraba directo a esa nada
  const tex = useMemo(() => {
    const brickTex = makeBrickTexture();
    brickTex.repeat.set(1.4, 1.5);
    return brickTex;
  }, []);

  return (
    <group name="World_FrontWall" position={[0, 0.55, 4.18]}>
      <RoundedBox args={[4.1, 5.2, 0.18]} radius={0.05} position={[-3.45, 0.5, 0]} receiveShadow>
        <meshStandardMaterial color="#0e0806" roughness={0.97} />
      </RoundedBox>
      <RoundedBox args={[4.1, 5.2, 0.18]} radius={0.05} position={[3.45, 0.5, 0]} receiveShadow>
        <meshStandardMaterial color="#0e0806" roughness={0.97} />
      </RoundedBox>
      <RoundedBox args={[11, 1.6, 0.18]} radius={0.05} position={[0, 2.5, 0]} receiveShadow>
        <meshStandardMaterial color="#0e0806" roughness={0.97} />
      </RoundedBox>
      {/* cara interior de ladrillo */}
      <mesh position={[-3.45, 0.5, -0.11]} rotation={[0, Math.PI, 0]} receiveShadow>
        <planeGeometry args={[4.08, 5.16]} />
        <meshStandardMaterial map={tex} roughness={0.98} metalness={0.02} />
      </mesh>
      <mesh position={[3.45, 0.5, -0.11]} rotation={[0, Math.PI, 0]} receiveShadow>
        <planeGeometry args={[4.08, 5.16]} />
        <meshStandardMaterial map={tex} roughness={0.98} metalness={0.02} />
      </mesh>
      {/* zócalo de madera + línea de bronce a media altura */}
      <RoundedBox args={[11, 0.34, 0.1]} radius={0.03} position={[0, -1.96, -0.1]} receiveShadow>
        <meshStandardMaterial color="#20110a" roughness={0.8} metalness={0.06} />
      </RoundedBox>
      <RoundedBox args={[11, 0.05, 0.06]} radius={0.02} position={[0, -0.42, -0.12]}>
        <meshStandardMaterial color={BAR.brass} roughness={0.34} metalness={0.66} />
      </RoundedBox>
      {/* apliques cálidos flanqueando la entrada: la zona deja de ser una cueva */}
      {[-1.85, 1.85].map((x) => (
        <group key={x} position={[x, 1.15, -0.14]}>
          <RoundedBox args={[0.16, 0.4, 0.08]} radius={0.03}>
            <meshStandardMaterial color="#1a0f08" roughness={0.8} />
          </RoundedBox>
          <mesh position={[0, 0.08, -0.07]}>
            <sphereGeometry args={[0.075, 14, 12]} />
            <meshStandardMaterial color="#ffd9a0" emissive="#ffb45e" emissiveIntensity={2.2} toneMapped={false} />
          </mesh>
        </group>
      ))}
      <pointLight position={[0, 1.3, -0.9]} intensity={3.2} distance={6.5} color="#e8a35e" />
    </group>
  );
}

// el cartel del antro: neón cálido con parpadeo de tubo viejo
function NeonSign() {
  const textRef = useRef(null);
  const lightRef = useRef(null);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    // parpadeo de neón barato: casi siempre pleno, cada tanto tiembla
    const flicker = Math.sin(t * 31) > 0.96 || Math.sin(t * 7.3 + 2) > 0.995 ? 0.35 : 1;
    if (textRef.current) textRef.current.fillOpacity = 0.92 * flicker;
    if (lightRef.current) lightRef.current.intensity = 6.2 * flicker;
  });

  return (
    <group name="World_NeonSign" position={[0, 2.05, -3.86]}>
      <Text
        ref={textRef}
        fontSize={0.56}
        color="#ff5c3a"
        anchorX="center"
        anchorY="middle"
        letterSpacing={0.24}
        outlineWidth={0.016}
        outlineColor="#5e130a"
        outlineOpacity={0.9}
      >
        TRUCOLOCO
      </Text>
      <pointLight ref={lightRef} position={[0, -0.1, 0.7]} intensity={6.2} distance={7} color="#ff6a3c" />
    </group>
  );
}

function TableRug() {
  return (
    <group name="World_TableRug" position={[0, -1.955, 0.25]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[4.35, 56]} />
        <meshStandardMaterial color="#2a0f0d" roughness={0.98} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.004, 0]}>
        <ringGeometry args={[3.85, 4.1, 56]} />
        <meshStandardMaterial color="#7a4a1e" roughness={0.85} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.004, 0]}>
        <ringGeometry args={[3.1, 3.2, 56]} />
        <meshStandardMaterial color="#53200f" roughness={0.9} />
      </mesh>
    </group>
  );
}

function BarLamps() {
  return (
    <group name="World_BarLamps">
      {[-2.2, 0, 2.2].map((x) => (
        <group key={x} position={[x, 2.9, -3.35]}>
          <mesh position={[0, 0.62, 0]}>
            <cylinderGeometry args={[0.012, 0.012, 1.3, 6]} />
            <meshStandardMaterial color="#0a0705" roughness={0.8} />
          </mesh>
          <mesh castShadow>
            <coneGeometry args={[0.22, 0.24, 18, 1, true]} />
            <meshStandardMaterial color="#241209" roughness={0.6} metalness={0.25} />
          </mesh>
          <mesh position={[0, -0.06, 0]}>
            <sphereGeometry args={[0.07, 12, 10]} />
            <meshStandardMaterial color="#ffd9a0" emissive="#ffb45e" emissiveIntensity={2.6} />
          </mesh>
          <pointLight position={[0, -0.2, 0]} intensity={2.8} distance={4.5} color="#ffb45e" />
          {/* cono de luz falso: volumetría barata */}
          <mesh position={[0, -0.85, 0]}>
            <coneGeometry args={[0.72, 1.6, 20, 1, true]} />
            <meshBasicMaterial color="#ffb45e" transparent opacity={0.045} depthWrite={false} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

// ── MÁQUINA DE HUMO — clickeable: escupe humo y enturbia el antro ~20s ──────
function SmokeMachine() {
  const { scene } = useThree();
  const burstAtRef = useRef(0);
  const pendingRef = useRef(false);
  const puffsRef = useRef(
    Array.from({ length: 26 }, (_, i) => ({ seed: i * 137.5, ref: null }))
  );
  const lightRef = useRef(null);
  const fogBase = useRef(null);

  useFrame((state) => {
    const now = state.clock.elapsedTime;
    if (pendingRef.current) {
      pendingRef.current = false;
      burstAtRef.current = now;
    }
    const since = burstAtRef.current ? now - burstAtRef.current : Infinity;
    const active = since < 20;

    // el fog del antro respira: denso al tirar humo, se disipa gradual
    if (scene.fog) {
      if (!fogBase.current) fogBase.current = { near: scene.fog.near, far: scene.fog.far };
      const k = active ? Math.max(0, 1 - since / 20) : 0;
      const ease = k * k;
      scene.fog.near = fogBase.current.near - (fogBase.current.near - 1.6) * ease;
      scene.fog.far = fogBase.current.far - (fogBase.current.far - 7.5) * ease;
    }

    if (lightRef.current) {
      lightRef.current.material.emissiveIntensity = active ? 0.2 + Math.sin(now * 20) * 0.15 : 1.4;
      lightRef.current.material.emissive.set(active ? "#3aff6a" : "#ff2e1f");
    }

    for (const puff of puffsRef.current) {
      const m = puff.ref;
      if (!m) continue;
      if (!active) {
        m.visible = false;
        continue;
      }
      const life = ((since * 0.55 + puff.seed) % 4) / 4;
      const spread = life * 2.6;
      m.visible = true;
      m.position.set(
        Math.sin(puff.seed) * spread * 0.8,
        0.25 + life * 1.7,
        0.3 + Math.cos(puff.seed * 1.7) * spread * 0.5 + life * 1.4
      );
      const grow = 0.18 + life * 1.15;
      m.scale.setScalar(grow);
      m.material.opacity = 0.16 * (1 - life) * Math.min(1, since / 1.2);
    }
  });

  return (
    <group
      name="World_SmokeMachine"
      position={[-4.35, -1.72, -3.3]}
      rotation={[0, 0.6, 0]}
      onClick={(event) => {
        event.stopPropagation();
        pendingRef.current = true;
      }}
      onPointerOver={() => (document.body.style.cursor = "pointer")}
      onPointerOut={() => (document.body.style.cursor = "auto")}
    >
      <RoundedBox args={[0.62, 0.34, 0.4]} radius={0.05} castShadow receiveShadow>
        <meshStandardMaterial color="#141312" roughness={0.55} metalness={0.5} />
      </RoundedBox>
      <mesh position={[0.18, 0.06, 0.21]} rotation={[Math.PI / 2.6, 0, 0]}>
        <cylinderGeometry args={[0.055, 0.075, 0.16, 12]} />
        <meshStandardMaterial color="#0c0b0a" roughness={0.4} metalness={0.6} />
      </mesh>
      <mesh ref={lightRef} position={[-0.2, 0.1, 0.201]}>
        <boxGeometry args={[0.05, 0.05, 0.02]} />
        <meshStandardMaterial color="#1a0505" emissive="#ff2e1f" emissiveIntensity={1.4} />
      </mesh>
      <Text position={[0, 0.28, 0.1]} fontSize={0.075} color="#8f7755" anchorX="center" anchorY="middle" letterSpacing={0.1}>
        HUMO
      </Text>
      {puffsRef.current.map((puff, index) => (
        <mesh key={index} ref={(node) => (puff.ref = node)} visible={false} position={[0, 0.3, 0.3]}>
          <sphereGeometry args={[0.5, 10, 8]} />
          <meshBasicMaterial color="#b9a98f" transparent opacity={0} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
}


// ── pase de arte 2: lore en las paredes ─────────────────────────────────────

function WantedPoster({ position, rotation, name, crime, tone }) {
  return (
    <group position={position} rotation={rotation}>
      <RoundedBox args={[0.98, 1.3, 0.05]} radius={0.02} castShadow receiveShadow>
        <meshStandardMaterial color="#241408" roughness={0.8} />
      </RoundedBox>
      <mesh position={[0, 0, 0.032]}>
        <planeGeometry args={[0.82, 1.14]} />
        <meshStandardMaterial color="#d8c49a" roughness={0.92} />
      </mesh>
      <Text position={[0, 0.42, 0.04]} fontSize={0.13} color="#3a2210" anchorX="center" anchorY="middle" letterSpacing={0.14}>
        SE BUSCA
      </Text>
      {/* la "foto": silueta sombría */}
      <mesh position={[0, 0.05, 0.038]}>
        <circleGeometry args={[0.2, 24]} />
        <meshStandardMaterial color={tone} roughness={0.9} />
      </mesh>
      <mesh position={[0, -0.13, 0.038]}>
        <planeGeometry args={[0.34, 0.18]} />
        <meshStandardMaterial color={tone} roughness={0.9} />
      </mesh>
      <Text position={[0, -0.32, 0.04]} fontSize={0.095} color="#3a2210" anchorX="center" anchorY="middle" letterSpacing={0.06}>
        {name}
      </Text>
      <Text position={[0, -0.46, 0.04]} fontSize={0.052} color="#6b4a26" anchorX="center" anchorY="middle" maxWidth={0.76} textAlign="center">
        {crime}
      </Text>
    </group>
  );
}

function WantedWall() {
  return (
    <group name="World_WantedWall">
      <WantedPoster
        position={[-5.2, 0.72, 1.9]}
        rotation={[0, Math.PI / 2, 0.02]}
        name="EL GAZPACHO"
        crime={'"Dice que ya ganó. Siempre."'}
        tone="#5a3a20"
      />
      <WantedPoster
        position={[5.2, 0.62, 2.1]}
        rotation={[0, -Math.PI / 2, -0.03]}
        name="MYKE KETA"
        crime={'"Sospechoso de todo."'}
        tone="#2e3a44"
      />
    </group>
  );
}

function Dartboard() {
  const rings = [
    { r: 0.3, color: "#1c1108" },
    { r: 0.24, color: "#b03424" },
    { r: 0.18, color: "#d8c49a" },
    { r: 0.12, color: "#b03424" },
    { r: 0.06, color: "#d8c49a" },
    { r: 0.025, color: "#b03424" }
  ];
  return (
    <group name="World_Dartboard" position={[5.24, 0.85, -1.6]} rotation={[0, -Math.PI / 2, 0]}>
      {rings.map((ring, index) => (
        <mesh key={index} position={[0, 0, 0.01 + index * 0.004]}>
          <circleGeometry args={[ring.r, 28]} />
          <meshStandardMaterial color={ring.color} roughness={0.85} />
        </mesh>
      ))}
      {/* tres dardos clavados torcidos */}
      {[[0.06, 0.09, 0.5], [-0.1, -0.02, -0.4], [0.02, -0.13, 0.2]].map(([x, y, tilt], index) => (
        <group key={index} position={[x, y, 0.05]} rotation={[tilt * 0.4, 0, tilt]}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.006, 0.006, 0.14, 6]} />
            <meshStandardMaterial color="#c9a46a" roughness={0.4} metalness={0.5} />
          </mesh>
          <mesh position={[0, 0, 0.09]} rotation={[Math.PI / 2, 0, 0]}>
            <coneGeometry args={[0.02, 0.05, 6]} />
            <meshStandardMaterial color={index === 0 ? "#b03424" : "#2e5a44"} roughness={0.7} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

// ─── el ritual: santuario Pink Floyd en la pared izquierda ────────────────
// Un prisma refractando luz. Los que saben, saben. Los que no, igual sienten
// que en este antro se escucha OTRA cosa.
const PRISM_RAYS = [
  { color: "#c03a2e", angle: -0.30 },
  { color: "#c46d1a", angle: -0.22 },
  { color: "#c9a032", angle: -0.14 },
  { color: "#3f7a44", angle: -0.06 },
  { color: "#2e5a78", angle: 0.02 },
  { color: "#5a3a78", angle: 0.10 }
];

function PinkFloydShrine() {
  const playing = useVinylPlaying();
  const [missing, setMissing] = useState(false);
  const handleClick = (event) => {
    event.stopPropagation();
    setMissing(false);
    toggleVinyl(() => setMissing(true));
  };
  return (
    <group name="World_PrismShrine" position={[-5.22, 0.95, -0.9]} rotation={[0, Math.PI / 2, 0]}>
      {/* todo el cuadro es clickeable: play/pausa de Dark Side of the Moon */}
      <group
        onClick={handleClick}
        onPointerOver={() => { document.body.style.cursor = "pointer"; }}
        onPointerOut={() => { document.body.style.cursor = "auto"; }}
      >
        {/* marco negro profundo */}
        <RoundedBox args={[1.5, 1.5, 0.06]} radius={0.02} castShadow receiveShadow>
          <meshStandardMaterial color="#0a0a0c" roughness={0.6} />
        </RoundedBox>
        <mesh position={[0, 0, 0.034]}>
          <planeGeometry args={[1.34, 1.34]} />
          <meshStandardMaterial color="#050507" roughness={0.9} />
        </mesh>
        {/* haz blanco entrando por la izquierda */}
        <mesh position={[-0.42, -0.05, 0.04]} rotation={[0, 0, 0.32]}>
          <planeGeometry args={[0.62, 0.022]} />
          <meshStandardMaterial color="#e8e4d8" emissive="#e8e4d8" emissiveIntensity={0.55} toneMapped={false} />
        </mesh>
        {/* el prisma: triángulo de alambre */}
        <mesh position={[0, 0.02, 0.042]}>
          <ringGeometry args={[0.235, 0.26, 3]} />
          <meshStandardMaterial color="#d8d4c8" emissive="#d8d4c8" emissiveIntensity={0.3} toneMapped={false} />
        </mesh>
        {/* abanico refractado */}
        {PRISM_RAYS.map((ray, index) => (
          <mesh key={index} position={[0.36, -0.02 + index * 0.021, 0.04]} rotation={[0, 0, ray.angle]}>
            <planeGeometry args={[0.56, 0.024]} />
            <meshStandardMaterial color={ray.color} emissive={ray.color} emissiveIntensity={0.5} toneMapped={false} />
          </mesh>
        ))}
      </group>
      <Text position={[0, -0.58, 0.045]} fontSize={0.055} color="#6b5f4a" anchorX="center" anchorY="middle" letterSpacing={0.32}>
        EL LADO OSCURO DEL ANTRO
      </Text>
      <Text position={[0, 0.68, 0.05]} fontSize={0.07} color={playing ? "#8be29a" : "#c9971d"} anchorX="center" anchorY="middle" letterSpacing={0.14}>
        {playing ? "♪ SONANDO — click para parar" : missing ? "falta el disco (mp3)" : "▶ CLICK: PONÉ EL DISCO"}
      </Text>
    </group>
  );
}

// vinilos gastados colgados: la discoteca sagrada de la casa.
// Click en cualquiera => suena Dark Side of the Moon de fondo (el ritual).
// El mp3 va en public/assets/audio/dark-side.mp3 — si falta, el disco avisa.
let vinylAudio = null;
let vinylPlaying = false;
const vinylListeners = new Set();

// El disco es DE LA SALA: si uno lo pone, suena para todos. El puente con la
// red vive en App (canal fx); acá solo emitimos/escuchamos window events.
function setVinylPlaying(next, { broadcast = true, onFail } = {}) {
  if (!vinylAudio) {
    vinylAudio = new Audio(assetUrl("assets/audio/dark-side.mp3"));
    vinylAudio.loop = true;
    vinylAudio.volume = 0.3;
  }
  if (next) {
    vinylAudio.play().catch(() => {
      vinylAudio = null;
      vinylPlaying = false;
      for (const listener of vinylListeners) listener(false);
      onFail?.();
    });
  } else {
    vinylAudio.pause();
  }
  vinylPlaying = next;
  for (const listener of vinylListeners) listener(next);
  if (broadcast) {
    window.dispatchEvent(new CustomEvent("tl-vinyl-local", { detail: { playing: next } }));
  }
}

function toggleVinyl(onFail) {
  setVinylPlaying(!vinylPlaying, { onFail });
  return vinylPlaying;
}

if (typeof window !== "undefined") {
  window.addEventListener("tl-vinyl-remote", (event) => {
    const playing = Boolean(event.detail?.playing);
    if (playing !== vinylPlaying) setVinylPlaying(playing, { broadcast: false });
  });
}

// hook para que shrine y vinilos reflejen el estado compartido
function useVinylPlaying() {
  const [playing, setPlaying] = useState(vinylPlaying);
  useEffect(() => {
    vinylListeners.add(setPlaying);
    return () => vinylListeners.delete(setPlaying);
  }, []);
  return playing;
}

function VinylWall() {
  const playing = useVinylPlaying();
  const [missing, setMissing] = useState(false);
  const spinRefs = useRef([]);
  const discos = [
    { y: 1.35, z: 0.35, r: 0.26, label: "#b03424", title: "LADO A" },
    { y: 1.02, z: 1.05, r: 0.22, label: "#c9971d", title: "PF" },
    { y: 1.42, z: 1.28, r: 0.2, label: "#2e5a78", title: "33⅓" }
  ];

  useFrame((_, delta) => {
    if (!playing) return;
    for (const disc of spinRefs.current) {
      if (disc) disc.rotation.z -= delta * 1.8; // 33⅓ rpm, más o menos
    }
  });

  const handleClick = (event) => {
    event.stopPropagation();
    setMissing(false);
    toggleVinyl(() => setMissing(true));
  };

  return (
    <group name="World_VinylWall">
      {discos.map((disco, index) => (
        <group key={index} position={[5.23, disco.y, disco.z]} rotation={[0, -Math.PI / 2, index * 0.06 - 0.05]}>
          <group
            ref={(node) => { spinRefs.current[index] = node; }}
            onClick={handleClick}
            onPointerOver={() => { document.body.style.cursor = "pointer"; }}
            onPointerOut={() => { document.body.style.cursor = "auto"; }}
          >
            <mesh>
              <circleGeometry args={[disco.r, 36]} />
              <meshStandardMaterial color="#0c0c0e" roughness={0.42} metalness={0.15} />
            </mesh>
            <mesh position={[0, 0, 0.004]}>
              <ringGeometry args={[disco.r * 0.55, disco.r * 0.96, 36]} />
              <meshStandardMaterial color="#17171a" roughness={0.35} metalness={0.2} />
            </mesh>
            <mesh position={[0, 0, 0.006]}>
              <circleGeometry args={[disco.r * 0.36, 24]} />
              <meshStandardMaterial color={disco.label} roughness={0.75} />
            </mesh>
            <Text position={[0, 0, 0.012]} fontSize={disco.r * 0.22} color="#f0e6c8" anchorX="center" anchorY="middle">
              {disco.title}
            </Text>
          </group>
        </group>
      ))}
      {playing ? (
        <Text position={[5.22, 0.68, 0.85]} rotation={[0, -Math.PI / 2, 0]} fontSize={0.075} color="#c9971d" anchorX="center" anchorY="middle" letterSpacing={0.16}>
          ♪ SUENA EL LADO OSCURO ♪
        </Text>
      ) : missing ? (
        <Text position={[5.22, 0.68, 0.85]} rotation={[0, -Math.PI / 2, 0]} fontSize={0.06} color="#8f7755" anchorX="center" anchorY="middle" letterSpacing={0.08}>
          falta el disco (assets/audio/dark-side.mp3)
        </Text>
      ) : null}
    </group>
  );
}

// la Ley L'Merk en neón vino: nadie sabe qué dice exactamente, pero rige
function LMerkNeon() {
  return (
    <group name="World_LMerkNeon" position={[5.24, 1.75, -1.6]} rotation={[0, -Math.PI / 2, 0]}>
      <mesh position={[0, 0, -0.015]}>
        <planeGeometry args={[1.5, 0.4]} />
        <meshStandardMaterial color="#120806" roughness={0.9} />
      </mesh>
      <Text fontSize={0.17} color="#e86a5a" anchorX="center" anchorY="middle" letterSpacing={0.12}
        outlineWidth={0.008} outlineColor="#7a1c14" outlineBlur={0.02}>
        LEY L'MERK
      </Text>
      <Text position={[0, -0.14, 0]} fontSize={0.05} color="#c9971d" anchorX="center" anchorY="middle" letterSpacing={0.2}>
        SE ACATA · NO SE ENTIENDE
      </Text>
    </group>
  );
}

// bruma alta permanente: el antro respira humo viejo cerca del techo
function CeilingHaze() {
  return (
    <group name="World_CeilingHaze">
      {[[-2.4, 3.4, -1.8, 3.4], [1.8, 3.55, 0.6, 4.2], [-0.4, 3.25, 2.2, 3.0]].map(([x, y, z, size], index) => (
        <mesh key={index} position={[x, y, z]} rotation={[-Math.PI / 2, 0, index * 1.3]}>
          <planeGeometry args={[size, size * 0.7]} />
          <meshBasicMaterial color="#8a7a62" transparent opacity={0.045} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
}

export function BarRoom() {
  return (
    <group name="World_BarRoom">
      {/* suelo base gigante: al mirar el piso en la entrada no se ve un
          "subsuelo" negro sin sentido */}
      <mesh position={[0, -2.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[60, 60]} />
        <meshStandardMaterial color="#120a07" roughness={0.98} />
      </mesh>
      <FloorPlanks />
      <BrickBackWall />
      <CurtainWall side="left" />
      <CurtainWall side="right" />
      <BackCounter />
      <RoomSeams />
      <BoothSilhouettes />
      <EntryPortal />
      <CeilingBeams />
      <CeilingPlane />
      <FrontWall />
      <NeonSign />
      <TableRug />
      <BarLamps />
      <SmokeMachine />
      <WantedWall />
      <Dartboard />
      <PinkFloydShrine />
      <VinylWall />
      <LMerkNeon />
      <CeilingHaze />
    </group>
  );
}
