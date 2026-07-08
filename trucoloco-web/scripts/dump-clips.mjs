// Lista los clips de animación de cada GLB (lee el chunk JSON del binario)
import { readFileSync, readdirSync } from "node:fs";

const DIR = "public/assets/characters";
for (const file of readdirSync(DIR).filter((f) => f.endsWith(".glb"))) {
  const buf = readFileSync(`${DIR}/${file}`);
  // GLB: header 12 bytes, luego chunks [length(4), type(4), data]
  const jsonLen = buf.readUInt32LE(12);
  const json = JSON.parse(buf.subarray(20, 20 + jsonLen).toString("utf8"));
  const names = (json.animations ?? []).map((a) => a.name);
  console.log(`${file}: [${names.join(", ")}]`);
}
