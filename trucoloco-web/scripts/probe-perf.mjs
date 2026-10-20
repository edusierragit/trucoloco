// Sonda de rendimiento: cuenta draw calls / triángulos por vista de cámara.
// Los fps de Edge headless (render por software) no significan nada; los
// draw calls y triángulos sí, porque dependen de la escena y no de la GPU.
//   npm run dev  →  node scripts/probe-perf.mjs
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const APP_URL = process.env.TRUCOLOCO_URL ?? "http://127.0.0.1:5173/?auto=0&probe";
const DEBUG_PORT = Number(process.env.TRUCOLOCO_CDP_PORT ?? 9224);
const EDGE = [
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe"
].find((path) => existsSync(path));

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitForHttp(url, timeoutMs = 8000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) return response;
    } catch { /* todavía no */ }
    await sleep(200);
  }
  throw new Error(`No response from ${url}`);
}

function connect(wsUrl) {
  const ws = new WebSocket(wsUrl);
  const pending = new Map();
  let nextId = 1;
  const ready = new Promise((resolve, reject) => {
    ws.addEventListener("open", resolve, { once: true });
    ws.addEventListener("error", reject, { once: true });
  });
  ws.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    const entry = message.id && pending.get(message.id);
    if (!entry) return;
    pending.delete(message.id);
    if (message.error) entry.reject(new Error(message.error.message));
    else entry.resolve(message.result);
  });
  return {
    async send(method, params = {}) {
      await ready;
      const id = nextId++;
      const promise = new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
      ws.send(JSON.stringify({ id, method, params }));
      return promise;
    },
    async eval(expression) {
      const result = await this.send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
      if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text);
      return result.result.value;
    },
    close: () => ws.close()
  };
}

const CLICK_TEXT = (pattern) => `(() => {
  const txt = (n) => (n?.textContent ?? "").replace(/\\s+/g, " ").trim();
  const button = [...document.querySelectorAll("button:not(:disabled)")].find((b) => ${pattern}.test(txt(b)));
  if (!button) return null;
  button.click();
  return txt(button);
})()`;

async function profile(client) {
  await client.send("Profiler.enable");
  await client.send("Profiler.setSamplingInterval", { interval: 200 });
  await client.send("Profiler.start");
  await sleep(3000);
  const { profile: prof } = await client.send("Profiler.stop");
  const byId = new Map(prof.nodes.map((node) => [node.id, node]));
  const self = new Map();
  const dt = prof.timeDeltas;
  prof.samples.forEach((id, index) => {
    const node = byId.get(id);
    const frame = node.callFrame;
    const file = frame.url.split("/").pop()?.split("?")[0] || "";
    const key = `${frame.functionName || "(anon)"} ${file}:${frame.lineNumber + 1}`;
    self.set(key, (self.get(key) ?? 0) + (dt[index] ?? 0));
  });
  const total = [...self.values()].reduce((a, b) => a + b, 0);
  const idle = [...self.entries()].filter(([k]) => /\(idle\)|\(program\)/.test(k)).reduce((a, [, v]) => a + v, 0);
  return {
    busyPct: Math.round(((total - idle) / total) * 100),
    top: [...self.entries()]
      .filter(([k]) => !/\(idle\)|\(program\)|\(garbage collector\)/.test(k))
      .sort((a, b) => b[1] - a[1]).slice(0, 12)
      .map(([k, v]) => `${(v / 1000).toFixed(0).padStart(5)}ms  ${k}`),
    gcMs: Math.round((self.get("(garbage collector) :0") ?? 0) / 1000)
  };
}

async function sample(client, label) {
  await sleep(2500);
  await client.eval("window.__TL_RENDERS__ = { App: 0 }");
  await sleep(2000);
  const renders = await client.eval("JSON.stringify(window.__TL_RENDERS__)");
  console.log(`renders/2s en ${label}: ${renders}`);
  const shots = [];
  for (let i = 0; i < 4; i += 1) {
    shots.push(await client.eval("window.__TL_PERF__ ?? null"));
    await sleep(250);
  }
  const valid = shots.filter(Boolean);
  if (!valid.length) return { label, error: "sin __TL_PERF__" };
  const avg = (key) => Math.round(valid.reduce((sum, s) => sum + s[key], 0) / valid.length);
  return { label, calls: avg("calls"), triangles: avg("triangles"), geometries: avg("geometries"), textures: avg("textures"), programs: avg("programs") };
}

async function dirtyMaterials(client) {
  console.log(await client.eval(`(() => {
    const { scene } = window.__TL_THREE__;
    const byMat = new Map();
    scene.traverse((o) => {
      if (!o.material || !o.visible) return;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of mats) {
        if (!byMat.has(m)) byMat.set(m, []);
        byMat.get(m).push(o);
      }
    });
    const rows = [];
    for (const [m, objs] of byMat) {
      const sig = (o) => [o.receiveShadow ? "rs" : "-", o.isInstancedMesh ? "inst" : "-", o.isSkinnedMesh ? "skin" : "-", o.geometry?.morphAttributes?.position?.length ?? 0, o.geometry?.attributes?.color ? "vc" : "-"].join("/");
      const sigs = new Set(objs.map(sig));
      if (sigs.size > 1) {
        const names = [...new Set(objs.map((o) => { let p = o; while (p && !p.name) p = p.parent; return p?.name ?? "?"; }))].slice(0, 4);
        rows.push(m.type + " '" + (m.name || "") + "' x" + objs.length + " sigs=" + [...sigs].join(" , ") + " en " + names.join(" ; "));
      }
    }
    window.__TL_MATV__ = new Map([...byMat.keys()].map((m) => [m, m.version]));
    return "materiales con firmas mezcladas: " + rows.length + " || " + rows.slice(0, 25).join(" || ");
  })()`));
  await sleep(1000);
  console.log(await client.eval(`(() => {
    const changed = [];
    const { scene } = window.__TL_THREE__;
    const owner = new Map();
    scene.traverse((o) => { if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => owner.set(m, o)); });
    for (const [m, v] of window.__TL_MATV__) {
      if (m.version - v > 5) {
        let p = owner.get(m); while (p && !p.name) p = p.parent;
        changed.push(m.type + " +" + (m.version - v) + " en " + (p?.name ?? "?"));
      }
    }
    // materiales que no existían hace 1s: alguien los crea en cada render
    const fresh = [];
    scene.traverse((o) => {
      if (!o.material || !o.visible) return;
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
        if (window.__TL_MATV__.has(m)) continue;
        let p = o; while (p && !p.name) p = p.parent;
        fresh.push(m.type + " en " + (p?.name ?? o.type));
      }
    });
    return "materiales sucios por frame: " + changed.length + " || " + changed.slice(0, 20).join(" || ")
      + " || nuevos en 1s: " + fresh.length + " → " + [...new Set(fresh)].slice(0, 8).join(" ; ");
  })()`));
}

async function main() {
  if (!EDGE) throw new Error("Microsoft Edge not found.");
  await waitForHttp(APP_URL);
  const userDataDir = mkdtempSync(join(tmpdir(), "trucoloco-probe-"));
  const browser = spawn(EDGE, [
    "--headless=new",
    `--remote-debugging-port=${DEBUG_PORT}`,
    `--user-data-dir=${userDataDir}`,
    "--window-size=1600,900",
    "about:blank"
  ], { stdio: "ignore" });

  try {
    await waitForHttp(`http://127.0.0.1:${DEBUG_PORT}/json/version`);
    const targets = await (await waitForHttp(`http://127.0.0.1:${DEBUG_PORT}/json/list`)).json();
    const page = targets.find((target) => target.type === "page" && target.webSocketDebuggerUrl);
    const client = connect(page.webSocketDebuggerUrl);
    await client.send("Runtime.enable");
    await client.send("Page.navigate", { url: APP_URL });
    await sleep(2500);

    // portal → Jugar → Trucoloco → bot → confirmar personaje → solo con bots
    await client.eval(`[...document.querySelectorAll(".portal-nav-item")].find((b) => b.textContent.trim() === "Jugar")?.click()`);
    await sleep(800);
    await client.eval(`document.querySelector(".portal-choice-card-hot")?.click()`);
    await sleep(1200);
    for (let step = 0; step < 30; step += 1) {
      if (await client.eval("Boolean(window.__TL_PROBE_VIEW__ && window.__TL_PERF__)")) {
        const started = await client.eval(CLICK_TEXT(/Confirmar|Jugar solo con bots|Jugar con un bot/i));
        if (!started && step > 8) break;
      } else {
        await client.eval(CLICK_TEXT(/Jugar con un bot|Confirmar/i));
      }
      await sleep(600);
    }

    const results = [];
    for (const view of ["table", "walk", "ring"]) {
      await client.eval(`window.__TL_PROBE_VIEW__?.(${JSON.stringify(view)})`);
      results.push(await sample(client, view));
      if (process.env.MATS) { console.log(`[${view}]`); await dirtyMaterials(client); }
      if (process.env.PROFILE) {
        const prof = await profile(client);
        console.log(`\n== ${view}: main thread ${prof.busyPct}% ocupado, GC ${prof.gcMs}ms/3s`);
        console.log(prof.top.join("\n"));
      }
    }
    console.table(results);

    // SHOTS=dir: capturas del duelo en el ring (sigue en la vista ring).
    if (process.env.SHOTS) {
      const { writeFileSync, mkdirSync } = await import("node:fs");
      mkdirSync(process.env.SHOTS, { recursive: true });
      const shot = async (name) => {
        const { data } = await client.send("Page.captureScreenshot", { format: "png" });
        writeFileSync(join(process.env.SHOTS, `${name}.png`), Buffer.from(data, "base64"));
      };
      const press = (key) => client.eval(`window.dispatchEvent(new KeyboardEvent("keydown", { key: ${JSON.stringify(key)} }))`);
      await shot("1-inicio");
      // ¿qué hay en cada punto de pantalla? (debug de encuadre)
      console.log(await client.eval(`(() => {
        const { scene, camera, Raycaster, Vector2 } = window.__TL_THREE__;
        const ray = new Raycaster();
        const cam = camera.position.toArray().map((v) => v.toFixed(2)).join(",");
        const rows = ["cam " + cam];
        for (const [x, y] of [[-0.5, 0], [0, 0], [0.3, 0], [0.6, 0], [0.3, -0.5], [0, -0.3]]) {
          ray.setFromCamera(new Vector2(x, y), camera);
          const hit = ray.intersectObjects(scene.children, true).find((h) => h.object.visible && h.object.type !== "Points");
          if (!hit) { rows.push(x + "," + y + " → nada"); continue; }
          const chain = [];
          for (let o = hit.object; o && chain.length < 6; o = o.parent) if (o.name) chain.push(o.name);
          rows.push(x + "," + y + " → " + hit.distance.toFixed(2) + "m " + hit.object.type + " [" + chain.join(" < ") + "] @" + hit.point.toArray().map((v) => v.toFixed(2)).join(","));
        }
        return rows.join(" || ");
      })()`));
      for (let i = 0; i < 40; i += 1) {
        const phase = await client.eval("document.querySelector('.duel')?.className ?? ''");
        if (phase.includes("duel-phase-over")) break;
        await press("1");
        await press(" ");
        await sleep(900);
        if (i === 1) await shot("2-intercambio");
        if (i === 4) await shot("3-ronda");
      }
      await sleep(1500);
      await shot("4-final");
    }
    client.close();
  } finally {
    browser.kill();
    await sleep(400);
    try { rmSync(userDataDir, { recursive: true, force: true }); } catch { /* Edge suelta el lock tarde */ }
  }
}

main().catch((error) => {
  console.error(`Probe failed: ${error.message}`);
  process.exitCode = 1;
});
