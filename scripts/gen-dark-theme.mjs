// Generates client/src/dark-theme.css.
//
// The UI is written with fixed light colours (bg-white, text-[#18366f], border-[#dbe4f1] ...). Instead of rewriting hundreds of
// class names, this script finds every one of those colour classes in the source and emits a matching dark-mode override under
// `.dark`. It runs automatically before `dev` and `build`, so new colours are picked up without anyone editing the CSS by hand.
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const SRC = new URL("../client/src/", import.meta.url).pathname;
const OUT = join(SRC, "dark-theme.css");

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) yield* walk(full);
    else if (/\.(tsx|ts)$/.test(name)) yield full;
  }
}

// ---- colour maths
const parse = hex => {
  let h = hex.replace("#", "");
  if (h.length === 3) h = [...h].map(c => c + c).join("");
  return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16) / 255);
};
function toHsl([r, g, b]) {
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min, s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: h * 60, s, l };
}
const hsl = (h, s, l) => `hsl(${Math.round(h)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%)`;
const BLUE = h => h >= 195 && h <= 265;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// Explicit choices for the structural colours (page, cards, sidebar).
const SPECIAL_BG = {
  white: "#0f2358",
  "#f7f9fd": "#071a4d",
  "#061b56": "#030d2f",
  "#071e5c": "#040f36",
  "#f9fbfe": "#0b1d4d",
};

function mapColor(kind, token, alpha) {
  const isWhite = token === "white";
  const hex = isWhite ? "#ffffff" : token.slice(1, -1);
  const { h, s, l } = toHsl(parse(hex));
  const hue = BLUE(h) || s < 0.15 ? 224 : h;

  if (kind === "bg") {
    // A translucent light colour is almost always a decorative overlay on an already-dark surface: keep it.
    if (alpha && l < 0.95) return null;
    if (SPECIAL_BG[isWhite ? "white" : hex.toLowerCase()]) return SPECIAL_BG[isWhite ? "white" : hex.toLowerCase()];
    if (l < 0.8) return null; // saturated brand colours and already-dark surfaces keep their colour
    return hsl(hue, clamp(s, 0, 0.55) * 0.75, clamp(0.2 - (1 - l) * 0.9, 0.08, 0.2));
  }
  if (isWhite) return null; // white text / borders sit on coloured buttons and stay white
  if (kind === "text") {
    if (l >= 0.6) return null; // already light enough for a dark background
    if (s > 0.4 && !BLUE(h)) return hsl(h, Math.min(s, 0.75), 0.7); // status colours: green, orange, red ...
    if (BLUE(h) && s >= 0.55 && l >= 0.33) return hsl(hue, 0.95, 0.74); // brand accent blues
    if (l < 0.33) return hsl(hue, 0.5, 0.93); // primary navy text
    return hsl(hue, 0.35, clamp(0.95 - l * 0.5, 0.62, 0.8)); // secondary text
  }
  if (kind === "border" || kind === "divide") {
    if (l < 0.75) return null;
    return hsl(hue, clamp(s, 0, 0.5) * 0.7, 0.19 + (1 - l) * 0.6);
  }
  return null;
}

// ---- collect classes
const TOKEN = /(?<![\w-])((?:[a-z0-9-]+(?:\[[^\]]+\])?:)*)(bg|text|border|divide)-(\[#[0-9a-fA-F]{3,8}\]|white)(\/\d+|\/\[[.\d]+\])?(?![\w-])/g;
const BREAKPOINTS = { sm: 640, md: 768, lg: 1024, xl: 1280 };
const STATES = { hover: ":hover", focus: ":focus", "focus-visible": ":focus-visible", active: ":active", disabled: ":disabled", placeholder: "::placeholder" };
const PROPERTY = { bg: "background-color", text: "color", border: "border-color", divide: "border-color" };

const found = new Set();
for (const file of walk(SRC)) {
  if (file.endsWith("dark-theme.css")) continue;
  for (const m of readFileSync(file, "utf8").matchAll(TOKEN)) found.add(m[0]);
}

const escapeClass = cls => cls.replace(/[^a-zA-Z0-9_-]/g, c => `\\${c}`);
const withAlpha = (color, alpha) => {
  if (!alpha) return color;
  const a = alpha.startsWith("/[") ? parseFloat(alpha.slice(2, -1)) : parseInt(alpha.slice(1), 10) / 100;
  if (color.startsWith("hsl(")) return color.replace(")", ` / ${a})`);
  const [r, g, b] = parse(color).map(v => Math.round(v * 255));
  return `rgb(${r} ${g} ${b} / ${a})`;
};

const rules = { base: [], media: Object.fromEntries(Object.keys(BREAKPOINTS).map(k => [k, []])) };
for (const cls of [...found].sort()) {
  const [, prefix, kind, token, alpha] = cls.match(new RegExp(TOKEN.source)) ?? [];
  if (!kind) continue;
  // bg-white with an opacity is used for translucent overlays on the (already dark) sidebar: leave those alone.
  if (token === "white" && alpha) continue;
  const color = mapColor(kind, token, alpha);
  if (!color) continue;

  const variants = prefix.split(":").filter(Boolean);
  let breakpoint = null, pseudo = "", skip = false;
  for (const v of variants) {
    if (BREAKPOINTS[v]) breakpoint = v;
    else if (STATES[v]) pseudo += STATES[v];
    else skip = true; // group-hover, data-[...], dark:, file: ... are not handled
  }
  if (skip) continue;

  const selector = `.dark .${escapeClass(cls)}${kind === "divide" ? " > :not(:last-child)" : ""}${pseudo}`;
  const rule = `${selector}{${PROPERTY[kind]}:${withAlpha(color, alpha)}}`;
  (breakpoint ? rules.media[breakpoint] : rules.base).push(rule);
}

const css = `/* GENERATED by scripts/gen-dark-theme.mjs, do not edit by hand. Run \`npm run gen:dark\` after adding colour classes. */
.dark body{background-color:#030d2f}
.dark .blueprint-app{color:#e6eeff}
.dark{color-scheme:dark}
.dark ::selection{background:#2f5bb7;color:#fff}
${rules.base.join("\n")}
${Object.entries(rules.media).filter(([, list]) => list.length).map(([bp, list]) => `@media (min-width:${BREAKPOINTS[bp]}px){\n${list.join("\n")}\n}`).join("\n")}
`;
writeFileSync(OUT, css);
console.log(`dark-theme.css: ${rules.base.length + Object.values(rules.media).flat().length} rules from ${found.size} colour classes`);
