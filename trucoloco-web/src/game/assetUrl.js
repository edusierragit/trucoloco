// URLs de assets relativas a BASE_URL: el build corre igual en GitHub Pages
// (/trucoloco/), en local (/) o en Vercel. En Node (scripts de validacion)
// import.meta.env no existe: cae a "/".
const BASE = (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.BASE_URL) || "/";

export const assetUrl = (path) => BASE + String(path).replace(/^\/+/, "");
