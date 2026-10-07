import {
  require_jsx_runtime
} from "./chunk-NKDCSL63.js";
import {
  require_react
} from "./chunk-RW64IELW.js";
import {
  __toESM
} from "./chunk-UN725CXD.js";

// node_modules/dot-anime-react/dist/index.js
var import_react = __toESM(require_react());
var import_jsx_runtime = __toESM(require_jsx_runtime());
var import_react2 = __toESM(require_react());
var import_jsx_runtime2 = __toESM(require_jsx_runtime());
var import_react3 = __toESM(require_react());
var import_jsx_runtime3 = __toESM(require_jsx_runtime());
var V = { backgroundColor: "rgba(255, 255, 255, 0.15)" };
var B = { backgroundColor: "#ffffff" };
var G = { circle: "50%", square: "0", rounded: "2px" };
function A({ sequence: e, cols: o = 7, rows: i = 7, dotSize: l = 6, gap: g = 2, shape: p = "rounded", radius: u, interval: b = 100, active: d = true, loop: c = -1, color: r, inactiveColor: m, bgColor: t, dotStyle: T, activeDotStyle: n, onFinish: D, onFrameChange: h, style: f, ...S }) {
  let s = o * i, [a, w] = (0, import_react.useState)(/* @__PURE__ */ new Set()), y = (0, import_react.useRef)(0), C = (0, import_react.useRef)(0), M = (0, import_react.useRef)(null), z = u !== void 0 ? typeof u == "number" ? `${u}px` : u : G[p], E = { ...V, borderRadius: z, ...m && { backgroundColor: m }, ...T, width: l, height: l }, $ = { ...E, ...B, ...r && { backgroundColor: r }, ...n }, W = { display: "grid", gridTemplateColumns: `repeat(${o}, ${l}px)`, gap: `${g}px`, width: "fit-content", ...t && { backgroundColor: t }, ...f }, I = (0, import_react.useCallback)((x) => {
    let v = e[x];
    v && (w(new Set(v)), h == null ? void 0 : h(x));
  }, [e, h]), P = (0, import_react.useCallback)(() => {
    M.current && (clearInterval(M.current), M.current = null);
  }, []);
  return (0, import_react.useEffect)(() => {
    y.current = 0, C.current = 0, e.length > 0 && I(0);
  }, [e, I]), (0, import_react.useEffect)(() => {
    if (!d || e.length === 0) {
      P();
      return;
    }
    return M.current = setInterval(() => {
      let x = (y.current + 1) % e.length;
      if (x === 0 && (C.current++, c !== -1 && C.current >= c)) {
        P(), D == null ? void 0 : D();
        return;
      }
      y.current = x, I(x);
    }, b), P;
  }, [d, e, b, c, I, P, D]), (0, import_jsx_runtime.jsx)("div", { ...S, style: W, children: Array.from({ length: s }, (x, v) => (0, import_jsx_runtime.jsx)("div", { style: a.has(v) ? $ : E }, v)) });
}
var K = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
function R({ text: e, chars: o = K, duration: i = 800, interval: l = 30, animate: g = true, onComplete: p, style: u, ...b }) {
  let [d, c] = (0, import_react2.useState)(e), r = (0, import_react2.useRef)(e), m = (0, import_react2.useRef)(0), t = (0, import_react2.useRef)(null);
  (0, import_react2.useEffect)(() => {
    if (e === r.current || !g) {
      c(e), r.current = e;
      return;
    }
    let n = e, D = Date.now(), h = Math.ceil(i / l);
    return t.current && clearInterval(t.current), m.current = 0, t.current = setInterval(() => {
      m.current++;
      let f = Math.min((Date.now() - D) / i, 1), S = Math.floor(f * n.length), s = "";
      for (let a = 0; a < n.length; a++) a < S ? s += n[a] : n[a] === " " ? s += " " : s += o[Math.floor(Math.random() * o.length)];
      c(s), f >= 1 && (t.current && (clearInterval(t.current), t.current = null), c(n), r.current = n, p == null ? void 0 : p());
    }, l), () => {
      t.current && (clearInterval(t.current), t.current = null);
    };
  }, [e, o, i, l, g, p]), (0, import_react2.useEffect)(() => {
    r.current = e;
  }, []);
  let T = { fontFamily: "monospace", whiteSpace: "pre", ...u };
  return (0, import_jsx_runtime2.jsx)("span", { ...b, style: T, children: d });
}
function Z({ items: e, activeIndex: o, autoPlay: i, direction: l = "horizontal", spacing: g = 16, matrix: p, scramble: u, textSize: b, textColor: d, textWeight: c, letterSpacing: r, textStyle: m, onChange: t, style: T, ...n }) {
  let [D, h] = (0, import_react3.useState)(0), f = o !== void 0, S = f ? o : D, s = e[S] || { title: "", frames: [[]] };
  (0, import_react3.useEffect)(() => {
    if (!i || e.length <= 1) return;
    let y = setInterval(() => {
      let C = (S + 1) % e.length;
      f || h(C), t == null ? void 0 : t(C);
    }, i);
    return () => clearInterval(y);
  }, [i, e.length, S, f, t]);
  let a = { display: "flex", flexDirection: l === "horizontal" ? "row" : "column", alignItems: "center", gap: g, ...T }, w = { fontSize: b ?? 16, fontWeight: c ?? 500, color: d ?? (p == null ? void 0 : p.color) ?? "#ffffff", ...r !== void 0 && { letterSpacing: r }, ...m };
  return (0, import_jsx_runtime3.jsxs)("div", { ...n, style: a, children: [(0, import_jsx_runtime3.jsx)(A, { sequence: s.frames, ...p }), (0, import_jsx_runtime3.jsx)(R, { text: s.title, ...u, style: w })] });
}
export {
  Z as DotFlow,
  A as DotMatrix,
  R as ScrambleText
};
//# sourceMappingURL=dot-anime-react.js.map
