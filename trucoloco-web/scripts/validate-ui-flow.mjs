import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const APP_URL = process.env.TRUCOLOCO_URL ?? "http://127.0.0.1:5173/?auto=0";
const DEBUG_PORT = Number(process.env.TRUCOLOCO_CDP_PORT ?? 9223);
const EDGE_PATHS = [
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe"
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitForHttp(url, timeoutMs = 6000) {
  const start = Date.now();
  let lastError = null;

  while (Date.now() - start < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) return response;
    } catch (error) {
      lastError = error;
    }

    await sleep(180);
  }

  throw new Error(`No response from ${url}: ${lastError?.message ?? "timeout"}`);
}

function getEdgePath() {
  return EDGE_PATHS.find((path) => existsSync(path));
}

class CdpClient {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl);
    this.nextId = 1;
    this.pending = new Map();
    this.ready = new Promise((resolve, reject) => {
      this.ws.addEventListener("open", resolve, { once: true });
      this.ws.addEventListener("error", reject, { once: true });
    });
    this.ws.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (!message.id) return;
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      if (message.error) pending.reject(new Error(message.error.message));
      else pending.resolve(message.result);
    });
  }

  async send(method, params = {}) {
    await this.ready;
    const id = this.nextId++;
    const promise = new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
    });
    this.ws.send(JSON.stringify({ id, method, params }));
    return promise;
  }

  close() {
    this.ws.close();
  }
}

async function evaluate(client, expression) {
  const result = await client.send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true
  });

  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.text ?? "Runtime evaluation failed");
  }

  return result.result.value;
}

async function main() {
  await waitForHttp(APP_URL);

  const edgePath = getEdgePath();
  if (!edgePath) {
    throw new Error("Microsoft Edge not found.");
  }

  const userDataDir = mkdtempSync(join(tmpdir(), "trucoloco-ui-"));
  const browser = spawn(edgePath, [
    "--headless=new",
    `--remote-debugging-port=${DEBUG_PORT}`,
    `--user-data-dir=${userDataDir}`,
    "--window-size=1366,768",
    "--disable-background-networking",
    APP_URL
  ], {
    stdio: "ignore"
  });

  try {
    await waitForHttp(`http://127.0.0.1:${DEBUG_PORT}/json/version`);
    const targets = await (await waitForHttp(`http://127.0.0.1:${DEBUG_PORT}/json/list`)).json();
    const page = targets.find((target) => target.type === "page" && target.webSocketDebuggerUrl);
    if (!page) throw new Error("No page target from Edge.");

    const client = new CdpClient(page.webSocketDebuggerUrl);
    await client.send("Runtime.enable");
    await client.send("Page.enable");
    await client.send("Page.navigate", { url: APP_URL });
    await sleep(1200);

    const actions = [];
    const observed = {
      maxHandImages: 0,
      maxHandImagesLoaded: 0,
      maxTableImages: 0,
      maxTableImagesLoaded: 0,
      actingSeats: new Set(),
      cameraSeats: new Set(),
      trickResolved: false,
      cameraTargets: new Set()
    };

    for (let step = 0; step < 24; step += 1) {
      const state = await evaluate(client, `(() => {
        const txt = (node) => (node?.textContent ?? "").replace(/\\s+/g, " ").trim();
        const handImages = [...document.querySelectorAll(".card-art")];
        const tableImages = [...document.querySelectorAll(".table-card-art")];
        const vueltaStrip = Boolean(document.querySelector(".vuelta-strip"));
        const actingSeat = document.querySelector(".table-flow-seat-acting strong")?.textContent?.trim() ?? "";
        const cameraDebug = window.__TRUCOLOCO_CAMERA_DEBUG__ ?? {};
        const enabledCards = [...document.querySelectorAll(".card-button:not(:disabled)")];
        const enabledButtons = [...document.querySelectorAll("button:not(:disabled)")];
        return {
          handImages: handImages.length,
          handImagesLoaded: handImages.filter((img) => img.complete && img.naturalWidth > 0).length,
          tableImages: tableImages.length,
          vueltaStrip,
          tableImagesLoaded: tableImages.filter((img) => img.complete && img.naturalWidth > 0).length,
          actingSeat,
          cameraSeatId: cameraDebug.activeSeatId ?? "",
          cameraTarget: Array.isArray(cameraDebug.target) ? cameraDebug.target.map((value) => Number(value).toFixed(2)).join(",") : "",
          canPlayCards: enabledCards.length,
          enabledButtons: enabledButtons.map(txt).filter(Boolean).slice(0, 8),
          bodyText: txt(document.body)
        };
      })()`);

      observed.maxHandImages = Math.max(observed.maxHandImages, state.handImages);
      observed.maxHandImagesLoaded = Math.max(observed.maxHandImagesLoaded, state.handImagesLoaded);
      observed.maxTableImages = Math.max(observed.maxTableImages, state.tableImages);
      observed.maxTableImagesLoaded = Math.max(observed.maxTableImagesLoaded, state.tableImagesLoaded);
      if (state.vueltaStrip) observed.trickResolved = true;
      if (state.actingSeat) observed.actingSeats.add(state.actingSeat);
      if (state.cameraSeatId) observed.cameraSeats.add(state.cameraSeatId);
      if (state.cameraTarget) observed.cameraTargets.add(state.cameraTarget);

      const clicked = await evaluate(client, `(() => {
        const txt = (node) => (node?.textContent ?? "").replace(/\\s+/g, " ").trim();
        const enabledCards = [...document.querySelectorAll(".card-button:not(:disabled)")];
        if (enabledCards[0]) {
          enabledCards[0].click();
          return "card";
        }

        const buttons = [...document.querySelectorAll("button:not(:disabled)")];
        const preferred = buttons.find((button) => /Sentarse|repartir|Probar solo|Practicar|JUGAR/i.test(txt(button)))
          ?? buttons.find((button) => /Dejar|juega|jugar|Avanz|Limpiar|Siguiente|Anotar/i.test(txt(button)))
          ?? buttons.find((button) => /Mirar cartas/i.test(txt(button)));

        if (!preferred) return null;
        const label = txt(preferred);
        preferred.click();
        return label;
      })()`);

      actions.push(clicked);

      if (observed.maxHandImages >= 1 && observed.trickResolved) break;
      if (!clicked) break;
      await sleep(420);
    }

    const finalState = await evaluate(client, `(() => {
      const txt = (node) => (node?.textContent ?? "").replace(/\\s+/g, " ").trim();
      const visibleText = [...document.querySelectorAll(".hud p, .hud strong, .panel-kicker, button, .table-showdown, .trick-ledger-row")]
        .map(txt)
        .filter(Boolean);
      const handImages = [...document.querySelectorAll(".card-art")];
      const tableImages = [...document.querySelectorAll(".table-card-art")];
      const actingSeat = document.querySelector(".table-flow-seat-acting strong")?.textContent?.trim() ?? "";
      const cameraDebug = window.__TRUCOLOCO_CAMERA_DEBUG__ ?? {};
      return {
        handImages: handImages.length,
        handImagesLoaded: handImages.filter((img) => img.complete && img.naturalWidth > 0).length,
        tableImages: tableImages.length,
        tableImagesLoaded: tableImages.filter((img) => img.complete && img.naturalWidth > 0).length,
        actingSeat,
        cameraSeatId: cameraDebug.activeSeatId ?? "",
        cameraTarget: Array.isArray(cameraDebug.target) ? cameraDebug.target.map((value) => Number(value).toFixed(2)).join(",") : "",
        hasSlotText: /Slot|Pendiente|Próximo/.test(document.body.textContent),
        longestText: visibleText.reduce((max, item) => item.length > max.length ? item : max, ""),
        longestTextLength: visibleText.reduce((max, item) => Math.max(max, item.length), 0)
      };
    })()`);

    const failures = [];
    observed.maxHandImages = Math.max(observed.maxHandImages, finalState.handImages);
    observed.maxHandImagesLoaded = Math.max(observed.maxHandImagesLoaded, finalState.handImagesLoaded);
    observed.maxTableImages = Math.max(observed.maxTableImages, finalState.tableImages);
    observed.maxTableImagesLoaded = Math.max(observed.maxTableImagesLoaded, finalState.tableImagesLoaded);
    if (finalState.actingSeat) observed.actingSeats.add(finalState.actingSeat);
    if (finalState.cameraSeatId) observed.cameraSeats.add(finalState.cameraSeatId);
    if (finalState.cameraTarget) observed.cameraTargets.add(finalState.cameraTarget);

    if (observed.maxHandImages < 1) failures.push("no hand card images rendered");
    if (observed.maxHandImagesLoaded < observed.maxHandImages) failures.push("some hand card images did not load");
    // las cartas de la mesa ahora viven en 3D (canvas): la señal DOM de que
    // una vuelta se jugó completa es la cinta ".vuelta-strip"
    if (!observed.trickResolved) failures.push("no trick was resolved (vuelta-strip never appeared)");
    if (observed.maxTableImagesLoaded < observed.maxTableImages) failures.push("some table card images did not load");
    if (observed.actingSeats.size < 3) failures.push(`active turn focus did not rotate enough: ${[...observed.actingSeats].join(", ")}`);
    if (observed.cameraSeats.size < 3) failures.push(`camera active seat did not rotate enough: ${[...observed.cameraSeats].join(", ")}`);
    if (observed.cameraTargets.size < 3) failures.push(`camera target did not change enough: ${[...observed.cameraTargets].join(" | ")}`);
    if (finalState.hasSlotText) failures.push("slot placeholder text is visible");
    if (finalState.longestTextLength > 120) failures.push(`visible copy too long: ${finalState.longestText}`);

    if (failures.length) {
      throw new Error(`UI flow failed: ${failures.join("; ")}. Actions: ${actions.filter(Boolean).join(" -> ")}`);
    }

    console.log(`UI flow OK. Actions: ${actions.filter(Boolean).join(" -> ")}. Max hand images: ${observed.maxHandImages}. Max table images: ${observed.maxTableImages}. Acting seats: ${[...observed.actingSeats].join(", ")}. Camera seats: ${[...observed.cameraSeats].join(", ")}.`);
    client.close();
  } finally {
    browser.kill();
    try {
      rmSync(userDataDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 120 });
    } catch {
      // Edge can keep Crashpad metrics locked for a moment after headless shutdown.
    }
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
