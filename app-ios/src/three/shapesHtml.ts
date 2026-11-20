// Página HTML (three.js) que desenha uma cena de primitivas.
//
// O runtime é fixo: interpreta a cena como dados e calcula as transformações
// como função do tempo (nada acumula estado, por isso não deriva nem parte).
// A cena é sempre re-validada aqui, mesmo que o chamador já a tenha validado.
//
//   "inline" — pequena, dentro da página, sem toque, 30 fps, só anima se
//              a cena tiver animações
//   "modal"  — painel grande: arrastar roda, pinça aproxima, toque numa forma
//              mostra a sua nota

import { EXPR_RUNTIME } from "./expr";
import { safeJson, sanitizeShapes, type ShapesSpec } from "./shapes";

export type ShapesMode = "inline" | "modal";

const RUNTIME = String.raw`
const PAL = {
  ink: 0x273247, blue: 0x4268b2, red: 0xc75e58, green: 0x4f8a83,
  orange: 0xd58b45, purple: 0x8173c4, gray: 0x8a93a2, yellow: 0xc89d3d
};
const post = function (m) {
  try { window.ReactNativeWebView.postMessage(JSON.stringify(m)); } catch (e) {}
};
const clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
const EASE = {
  linear: function (u) { return u; },
  "in": function (u) { return u * u * u; },
  out: function (u) { const v = 1 - u; return 1 - v * v * v; },
  inout: function (u) { return u * u * (3 - 2 * u); },
  elastic: function (u) { return u <= 0 ? 0 : u >= 1 ? 1 : Math.pow(2, -10 * u) * Math.sin((u * 10 - 0.75) * (2 * Math.PI / 3)) + 1; },
  back: function (u) { const c1 = 1.70158, c3 = c1 + 1, v = u - 1; return 1 + c3 * v * v * v + c1 * v * v; },
  bounce: function (u) {
    const n = 7.5625, d = 2.75;
    if (u < 1 / d) return n * u * u;
    if (u < 2 / d) { u -= 1.5 / d; return n * u * u + 0.75; }
    if (u < 2.5 / d) { u -= 2.25 / d; return n * u * u + 0.9375; }
    u -= 2.625 / d; return n * u * u + 0.984375;
  },
  spring: function (u) { return u >= 1 ? 1 : 1 - Math.exp(-6 * u) * Math.cos(u * 11); }
};
const ease = function (u, name) { return (EASE[name] || EASE.inout)(clamp(u, 0, 1)); };
const RAD = Math.PI / 180;

const stage = document.getElementById("stage");
const labelsEl = document.getElementById("labels");
const linesEl = document.getElementById("lines");
const capEl = document.getElementById("cap");

let renderer = null;
try {
  // antialias nos dois modos: sem isto as arestas da cena na página ficam
  // serrilhadas ("pixelizadas"), sobretudo nas pontas e nos contornos
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" });
} catch (e) {
  post({ type: "error", message: "este telemóvel não abriu o 3D" });
}

if (renderer) {
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, INLINE ? 2 : 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  stage.appendChild(renderer.domElement);
  renderer.domElement.addEventListener("webglcontextlost", function (e) {
    e.preventDefault();
    post({ type: "error", message: "o 3D foi interrompido" });
  });

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(36, 1, 0.05, 200);
  // luz de ambiente por reflexos (dá volume aos metais e ao vidro); se o
  // telemóvel não suportar, ficam só as luzes directas
  let envOn = false;
  try {
    scene.environment = roomEnvironment();
    scene.environmentIntensity = 0.55;
    envOn = true;
  } catch (e) {}
  scene.add(new THREE.HemisphereLight(0xfffdf2, 0x8d887a, envOn ? 0.95 : 1.35));
  const key = new THREE.DirectionalLight(0xffffff, 1.7);
  key.position.set(3.5, 6, 4.5);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xffffff, 0.5);
  fill.position.set(-5, 2, -4);
  scene.add(fill);

  // Geometrias com o tamanho real (nada de esticar cubos unitários): bordas
  // arredondadas certas, contorno uniforme e partilha por tamanho.
  const GEO = {};
  function geo(kind, sx, sy, sz, extra) {
    const key = kind + "|" + sx.toFixed(3) + "|" + sy.toFixed(3) + "|" + sz.toFixed(3) + "|" + (extra || 0);
    if (GEO[key]) return GEO[key];
    const seg = INLINE ? 18 : 30;
    let g;
    if (kind === "sphere") { g = new THREE.SphereGeometry(0.5, seg, Math.round(seg * 0.7)); g.scale(sx, sy, sz); }
    else if (kind === "cylinder") { g = new THREE.CylinderGeometry(0.5, 0.5, 1, seg); g.scale(sx, sy, sz); }
    else if (kind === "cone") { g = new THREE.ConeGeometry(0.5, 1, seg); g.scale(sx, sy, sz); }
    else if (kind === "box") g = new RoundedBoxGeometry(sx, sy, sz, 2, Math.min(sx, sy, sz) * 0.06);
    else if (kind === "rbox") g = new RoundedBoxGeometry(sx, sy, sz, INLINE ? 3 : 5, Math.min(0.4, Math.min(sx, sy, sz) * 0.24));
    else if (kind === "capsule") {
      const r = Math.max(0.03, Math.min(sx, sz) / 2);
      g = new THREE.CapsuleGeometry(r, Math.max(0.001, sy - 2 * r), 6, INLINE ? 12 : 20);
      g.scale(sx / (2 * r), 1, sz / (2 * r));
    }
    else if (kind === "torus") { { const m = (sx + sz) / 2, tr = Math.min(0.35, Math.max(0.02, (sy / Math.max(sx, 0.01)) * 0.5)); g = new THREE.TorusGeometry(0.5, tr, 12, INLINE ? 28 : 44); g.rotateX(Math.PI / 2); g.scale(sx, m, sz); } }
    else if (kind === "ring") { g = new THREE.RingGeometry(0.4, 0.5, 48); g.rotateX(-Math.PI / 2); g.scale(sx, 1, sz); }
    else if (kind === "plane") { g = new THREE.PlaneGeometry(1, 1); g.rotateX(-Math.PI / 2); g.scale(sx, 1, sz); }
    else if (kind === "gear") {
      // disco com dentes, eixo no Z: diâmetro sx (= sz) e espessura sy
      const n = extra || 12, parts = [new THREE.CylinderGeometry(0.4, 0.4, 1, seg)];
      const tw = ((2 * Math.PI * 0.43) / n) * 0.5;
      for (let i = 0; i < n; i++) {
        const t = new THREE.BoxGeometry(tw, 1, 0.15);
        t.translate(0, 0, 0.43);
        t.rotateY((i * 2 * Math.PI) / n);
        parts.push(t);
      }
      g = mergeGeometries(parts);
      g.rotateX(Math.PI / 2);
      g.scale(sx, sz, sy);
    }
    else if (kind === "tire") { g = new THREE.TorusGeometry(0.3, 0.2, 14, INLINE ? 24 : 36); g.scale(sx, sz, sy / 0.4); }
    else if (kind === "rim") { g = new THREE.CylinderGeometry(0.33, 0.33, 1, seg); g.rotateX(Math.PI / 2); g.scale(sx, sz, sy * 0.78); }
    else if (kind === "spokes") {
      const parts = [new THREE.CylinderGeometry(0.1, 0.1, 1, 14).rotateX(Math.PI / 2)];
      for (let i = 0; i < 5; i++) {
        const sp = new THREE.BoxGeometry(0.1, 0.62, 1);
        sp.rotateZ((i * 2 * Math.PI) / 5);
        parts.push(sp);
      }
      g = mergeGeometries(parts);
      g.scale(sx, sz, sy * 0.9);
    }
    else g = new THREE.SphereGeometry(0.5, 12, 8);
    GEO[key] = g;
    return g;
  }

  // contorno de tinta: casca invertida empurrada ao longo das normais, com
  // espessura constante (proporcional à cena, ajustada depois do enquadramento)
  const OUT = { value: 0.03 };
  const outlineMat = new THREE.MeshBasicMaterial({ color: 0x273247, side: THREE.BackSide });
  outlineMat.onBeforeCompile = function (sh) {
    sh.uniforms.uThick = OUT;
    sh.vertexShader = "uniform float uThick;\n" + sh.vertexShader.replace(
      "#include <begin_vertex>",
      "#include <begin_vertex>\n  transformed += normalize(normal) * uThick;"
    );
  };

  // casca do contorno com normais contínuas (sem buracos nas arestas vivas)
  const HULLS = new Map();
  function hullOf(g) {
    if (HULLS.has(g)) return HULLS.get(g);
    let h = g.clone();
    h.deleteAttribute("normal");
    h.deleteAttribute("uv");
    h = mergeVertices(h, 1e-4);
    h.computeVertexNormals();
    HULLS.set(g, h);
    return h;
  }

  function makeMat(o, flat) {
    const f = o.finish || "matte";
    const m = new THREE.MeshStandardMaterial({
      color: PAL[o.color],
      roughness: f === "metal" ? 0.3 : f === "glass" ? 0.12 : 0.62,
      metalness: f === "metal" ? 0.85 : 0.04,
      transparent: o.opacity < 1 || f === "glass",
      opacity: o.opacity,
      wireframe: o.wire,
      side: flat || f === "glass" ? THREE.DoubleSide : THREE.FrontSide
    });
    if (f === "glow") { m.emissive = new THREE.Color(PAL[o.color]); m.emissiveIntensity = 0.85; }
    return m;
  }

  const items = [];
  const byId = {};
  const meshes = [];
  const dummy = new THREE.Object3D();

  SPEC.objects.forEach(function (o) {
    const flat = o.shape === "ring" || o.shape === "plane" || o.shape === "lathe";
    const glass = o.finish === "glass";
    const noHull = (flat && o.shape !== "lathe") || o.shape === "surface" || o.wire || glass || o.finish === "glow";
    const mat = makeMat(o, flat);
    const mats = [mat];
    // g: posição/rotação (os filhos ficam aqui); sc: só as malhas desta forma
    const g = new THREE.Group();
    const sc = new THREE.Group();
    g.add(sc);
    const hulls = [];
    let stream = null;
    let surf = null;
    let customReach = 0;
    let anchorPt = null;
    let fitC = null;
    const sx = o.size[0], sy = o.size[1], sz = o.size[2];

    function add(kind, material, hull, extra) {
      const gm = geo(kind, sx, sy, sz, extra);
      const m = new THREE.Mesh(gm, material);
      m.userData.oid = o.id;
      sc.add(m);
      meshes.push(m);
      if (hull && !noHull) {
        const h = new THREE.Mesh(gm, outlineMat);
        sc.add(h);
        hulls.push(h);
      }
      return m;
    }

    if (o.shape === "group") {
      // sem malha: serve para mover/mostrar um conjunto de peças de uma vez
    } else if (o.shape === "arrow") {
      // seta ao longo de +Y: comprimento = size[1], espessura = size[0]
      const len = Math.max(0.2, sy);
      const r = Math.max(0.04, sx * 0.12);
      const head = Math.min(len * 0.4, r * 4.5);
      const shaft = new THREE.Mesh(geo("cylinder", r * 2, len - head, r * 2), mat);
      shaft.position.y = (len - head) / 2 - len / 2;
      const tip = new THREE.Mesh(geo("cone", r * 4.4, head, r * 4.4), mat);
      tip.position.y = len / 2 - head / 2;
      shaft.userData.oid = o.id;
      tip.userData.oid = o.id;
      sc.add(shaft);
      sc.add(tip);
      meshes.push(shaft, tip);
    } else if (o.shape === "wheel") {
      const metal = new THREE.MeshStandardMaterial({ color: 0xaab2c0, roughness: 0.3, metalness: 0.85, transparent: o.opacity < 1, opacity: o.opacity });
      mats.push(metal);
      add("tire", mat, true);
      add("rim", metal, false);
      add("spokes", metal, false);
    } else if (o.shape === "gear") {
      add("gear", mat, true, o.teeth || 12);
    } else if (o.shape === "lathe") {
      let pr = o.profile.slice();
      if (pr[0][1] > pr[pr.length - 1][1]) pr.reverse();
      const gm = new THREE.LatheGeometry(pr.map(function (q) { return new THREE.Vector2(Math.max(0.001, q[0] * sx), q[1] * sy); }), INLINE ? 22 : 36);
      const m = new THREE.Mesh(gm, mat);
      m.userData.oid = o.id; sc.add(m); meshes.push(m);
      if (!noHull) { const h = new THREE.Mesh(gm, outlineMat); sc.add(h); hulls.push(h); }
      gm.computeBoundingSphere(); customReach = gm.boundingSphere.radius; anchorPt = gm.boundingSphere.center.clone();
    } else if (o.shape === "extrude") {
      const sh = new THREE.Shape(o.outline.map(function (q) { return new THREE.Vector2(q[0] * sx, q[1] * sy); }));
      const bv = Math.min(sx, sy, sz) * 0.06;
      const gm = new THREE.ExtrudeGeometry(sh, { depth: sz, bevelEnabled: true, bevelThickness: bv, bevelSize: bv, bevelSegments: 2, curveSegments: 6 });
      gm.translate(0, 0, -sz / 2);
      const m = new THREE.Mesh(gm, mat);
      m.userData.oid = o.id; sc.add(m); meshes.push(m);
      if (!noHull) { const h = new THREE.Mesh(hullOf(gm), outlineMat); sc.add(h); hulls.push(h); }
      gm.computeBoundingSphere(); customReach = gm.boundingSphere.radius; anchorPt = gm.boundingSphere.center.clone();
    } else if (o.shape === "tube") {
      const tp = o.pts.map(function (q) { return new THREE.Vector3(q[0], q[1], q[2]); });
      const gm = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(tp, false, "centripetal"), Math.min(140, tp.length * 12), Math.max(0.015, sx / 2), INLINE ? 6 : 10, false);
      const m = new THREE.Mesh(gm, mat);
      m.userData.oid = o.id; sc.add(m); meshes.push(m);
      if (!noHull) { const h = new THREE.Mesh(gm, outlineMat); sc.add(h); hulls.push(h); }
      gm.computeBoundingSphere(); customReach = gm.boundingSphere.radius; fitC = gm.boundingSphere.center.clone();
      anchorPt = new THREE.CatmullRomCurve3(tp, false, "centripetal").getPoint(0.5);
    } else if (o.shape === "surface") {
      const N = INLINE ? Math.min(o.grid, 26) : o.grid, ext = o.extent;
      const gm = new THREE.PlaneGeometry(ext * 2, ext * 2, N, N);
      gm.rotateX(-Math.PI / 2);
      const n = gm.attributes.position.count;
      gm.setAttribute("color", new THREE.BufferAttribute(new Float32Array(n * 3), 3));
      mat.vertexColors = true;
      const fn = compileExpr(o.expr, ["x", "z", "t"]);
      surf = { gm: gm, fn: fn, n: n, vars: { x: 0, z: 0, t: 0 }, anim: /\bt\b/.test(o.expr), base: new THREE.Color(PAL[o.color]), last: -1 };
      const m = new THREE.Mesh(gm, mat);
      m.userData.oid = o.id; sc.add(m); meshes.push(m);
      customReach = ext * 1.2;
    } else if (o.shape === "stream") {
      const pts = o.pts.map(function (p) { return new THREE.Vector3(p[0], p[1], p[2]); });
      const lens = [0];
      for (let i = 1; i < pts.length; i++) lens.push(lens[i - 1] + pts[i].distanceTo(pts[i - 1]));
      const inst = new THREE.InstancedMesh(geo("sphere", sx, sx, sx), mat, o.count);
      inst.frustumCulled = false;
      sc.add(inst);
      stream = { inst: inst, pts: pts, lens: lens, total: Math.max(0.01, lens[lens.length - 1]), count: o.count, speed: o.speed, size: sx };
    } else {
      add(o.shape, mat, true);
    }

    const basePos = new THREE.Vector3(o.pos[0], o.pos[1], o.pos[2]);
    g.position.copy(basePos);
    g.rotation.set(o.rot[0] * RAD, o.rot[1] * RAD, o.rot[2] * RAD);
    const par = o.parent && byId[o.parent] ? byId[o.parent] : null;
    (par ? par.g : scene).add(g);

    const reach = customReach > 0 ? customReach
      : o.shape === "group" ? 0
      : o.shape === "arrow" ? Math.max(sy, sx) * 0.55
      : Math.max(sx, sy, sz) * 0.55;

    const it = {
      o: o, g: g, sc: sc, mat: mat, mats: mats, hulls: hulls, stream: stream, surf: surf, reach: reach, par: par,
      basePos: basePos, baseScale: new THREE.Vector3(1, 1, 1),
      baseRot: new THREE.Euler(o.rot[0] * RAD, o.rot[1] * RAD, o.rot[2] * RAD),
      baseColor: new THREE.Color(PAL[o.color]),
      emi: mat.emissive.clone(), glass: glass,
      // ponto a que a etiqueta se liga: o meio do percurso, nas partículas
      anchor: stream ? stream.pts[0].clone().lerp(stream.pts[stream.pts.length - 1], 0.55) : anchorPt, fitC: fitC || anchorPt,
      op: o.opacity, eff: o.opacity, mayFade: o.opacity < 1,
      pill: null, pw: 0, ph: 0, line: null, dot: null, vis: true
    };
    // a cena monta-se em frente do aluno: as peças entram uma a uma
    it.g.visible = false;
    items.push(it);
    byId[o.id] = it;
  });

  // materiais que podem ficar translúcidos (próprios, por fade, ou por herança do pai)
  SPEC.anims.forEach(function (a) { if (a.type === "fade" && byId[a.target]) byId[a.target].mayFade = true; });
  items.forEach(function (it) {
    if (it.par && it.par.mayFade) it.mayFade = true;
    for (let m = 0; m < it.mats.length; m++) it.mats[m].transparent = it.mayFade || it.glass;
  });

  // etiquetas: pílulas DOM projectadas, com uma passagem simples anti-sobreposição
  items.forEach(function (it) {
    if (!it.o.label) return;
    const d = document.createElement("div");
    d.className = "pill";
    d.textContent = it.o.label;
    labelsEl.appendChild(d);
    it.pill = d;
    const ln = document.createElementNS("http://www.w3.org/2000/svg", "line");
    ln.setAttribute("stroke", "#273247");
    ln.setAttribute("stroke-width", "1.2");
    ln.setAttribute("stroke-opacity", "0.7");
    const dt = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    dt.setAttribute("r", "2.6");
    dt.setAttribute("fill", "#fffdf6");
    dt.setAttribute("stroke", "#273247");
    linesEl.appendChild(ln);
    linesEl.appendChild(dt);
    it.line = ln;
    it.dot = dt;
  });

  // ---- enquadramento ----
  scene.updateMatrixWorld(true);
  const bb = new THREE.Box3().setFromObject(scene);
  if (bb.isEmpty()) bb.set(new THREE.Vector3(-1, -1, -1), new THREE.Vector3(1, 1, 1));
  const wp = function (it) { return it.g.getWorldPosition(new THREE.Vector3()); };
  // Pontos usados no enquadramento final (posições e trajectórias).
  const fitPts = [];
  items.forEach(function (it) { fitPts.push({ p: it.fitC ? it.g.localToWorld(it.fitC.clone()) : wp(it), r: Math.max(0.15, it.reach) }); });
  SPEC.anims.forEach(function (a) {
    const it = byId[a.target];
    if (!it) return;
    const w0 = wp(it);
    const grow = function (p, r) {
      bb.expandByPoint(new THREE.Vector3(p.x - r, p.y - r, p.z - r));
      bb.expandByPoint(new THREE.Vector3(p.x + r, p.y + r, p.z + r));
    };
    if (a.type === "move" && a.path) {
      a.path.forEach(function (p) {
        grow(new THREE.Vector3(w0.x + p[0] - it.basePos.x, w0.y + p[1] - it.basePos.y, w0.z + p[2] - it.basePos.z), it.reach);
      });
    } else if (a.type === "orbit") {
      const ar = a.around ? byId[a.around] : null;
      const c = ar ? wp(ar) : new THREE.Vector3(a.center[0], a.center[1], a.center[2]);
      grow(c, c.distanceTo(w0) + it.reach);
    } else if (a.type === "bounce") {
      grow(w0, it.reach + a.amp);
    }
  });
  const center = bb.getCenter(new THREE.Vector3());
  let lowQ = false;
  let R = Math.max(0.5, bb.getSize(new THREE.Vector3()).length() * 0.5 * 0.9);

  if (SPEC.ground) {
    // Sombra de contacto suave: lê-se como desenho, não como chão de jogo.
    const gs = bb.getSize(new THREE.Vector3());
    const shadowGeo = new THREE.CircleGeometry(Math.max(1.1, Math.max(gs.x, gs.z) * 0.62), 48);
    const cv = document.createElement("canvas");
    cv.width = cv.height = 128;
    const cx2 = cv.getContext("2d");
    if (cx2) {
      const rg = cx2.createRadialGradient(64, 64, 4, 64, 64, 62);
      rg.addColorStop(0, "rgba(58,54,44,0.28)");
      rg.addColorStop(0.55, "rgba(58,54,44,0.10)");
      rg.addColorStop(1, "rgba(58,54,44,0)");
      cx2.fillStyle = rg;
      cx2.fillRect(0, 0, 128, 128);
    }
    const shadow = new THREE.Mesh(
      shadowGeo,
      new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthWrite: false }),
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.set(center.x, bb.min.y + 0.002, center.z);
    scene.add(shadow);
  }

  const PRESET = {
    iso: [0.72, 1.12], front: [0, Math.PI / 2], side: [Math.PI / 2, Math.PI / 2], top: [0.0, 0.18]
  };
  const start = SPEC.view ? [SPEC.view[0] * RAD, (90 - SPEC.view[1]) * RAD] : (PRESET[SPEC.camera] || PRESET.iso);
  let az = start[0], pol = start[1], zoom = 1, fitDist = 6;
  let W = 1, H = 1;

  // Enquadramento por amostragem no tempo: percorre a animação e junta as
  // caixas de todas as peças visíveis. Assim o conjunto que sobe, a órbita ou
  // a seta que só aparece no fim ficam sempre dentro do quadro.
  let sampled = false;
  function sampleFit() {
    sampled = true;
    const T = isFinite(endTime) ? endTime : 10000;
    const N = isFinite(endTime) ? 12 : 16;
    const all = new THREE.Box3(), box = new THREE.Box3(), c8 = new THREE.Vector3();
    const pts = [];
    for (let k = 0; k <= N; k++) {
      applyAnims((T * k) / N);
      scene.updateMatrixWorld(true);
      items.forEach(function (it) {
        if (!it.vis || it.o.shape === "group") return;
        if (it.stream) {
          it.stream.pts.forEach(function (p) {
            c8.copy(p).applyMatrix4(it.g.matrixWorld);
            all.expandByPoint(c8);
            pts.push({ p: c8.clone(), r: it.stream.size * 0.6 });
          });
          return;
        }
        box.setFromObject(it.sc);
        if (box.isEmpty()) return;
        all.union(box);
        for (let i = 0; i < 8; i++) {
          c8.set(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z);
          pts.push({ p: c8.clone(), r: 0.05 });
        }
      });
    }
    applyAnims(0);
    scene.updateMatrixWorld(true);
    if (all.isEmpty() || !pts.length) return;
    bb.copy(all);
    bb.getCenter(center);
    R = Math.max(0.5, bb.getSize(new THREE.Vector3()).length() * 0.5 * 0.9);
    fitPts.length = 0;
    for (let i = 0; i < pts.length; i++) fitPts.push(pts[i]);
    OUT.value = clamp(R * 0.011, 0.012, 0.05);
  }

  // A legenda vive agarrada ao fundo. O palco encolhe para lhe deixar a faixa
  // dela: antes o texto ficava POR CIMA de metade do modelo (o "empuxo
  // vetorial" tapava a aeronave toda).
  function capBand() {
    return capEl && capEl.offsetHeight ? capEl.offsetHeight + 6 : 0;
  }

  function resize(tentativa) {
    if (!sampled) sampleFit();
    // logo no arranque o layout pode ainda não ter altura (innerHeight a 0):
    // espera um instante em vez de encolher a cena para 50 px
    const fullH = Math.max(
      window.innerHeight || 0,
      stage.clientHeight || 0,
      stage.parentNode ? stage.parentNode.clientHeight || 0 : 0,
    );
    if (fullH < 120) {
      if ((tentativa || 0) < 12) setTimeout(function () { resize((tentativa || 0) + 1); }, 60);
      return;
    }
    // a legenda nunca ocupa mais de um terço da cena
    const band = Math.min(capBand(), Math.floor(fullH * 0.35));
    stage.style.height = Math.max(80, fullH - band) + "px";
    W = Math.max(40, stage.clientWidth);
    H = Math.max(40, stage.clientHeight);
    renderer.setSize(W, H, false);
    camera.aspect = W / H;
    camera.updateProjectionMatrix();
    const vf = camera.fov * RAD;
    const hf = 2 * Math.atan(Math.tan(vf / 2) * camera.aspect);
    // Enquadramento por eixos (largura e altura) em vez de uma esfera única:
    // uma cena larga e baixa ficava minúscula no meio da caixa.
    const bsz = bb.getSize(new THREE.Vector3());
    const pad = INLINE ? 1.06 : 1.03;
    const distH = ((Math.max(bsz.x, bsz.z) * 0.5 + 0.05) * pad) / Math.tan(hf / 2);
    const distV = ((bsz.y * 0.5 + 0.05) * pad) / Math.tan(vf / 2);
    const distSphere = (R / Math.sin(Math.min(vf, hf) / 2)) * pad;
    fitDist = Math.min(distSphere, Math.max(distH, distV) + Math.min(bsz.x, bsz.y, bsz.z) * 0.5);
    calibrate();
    items.forEach(function (it) {
      if (it.pill) { it.pw = it.pill.offsetWidth; it.ph = it.pill.offsetHeight; }
    });
    dirty = true;
    wake();
  }

  // Ajuste final pela projecção real: se algum ponto da cena (ou da sua
  // trajectória) sai do quadro, afasta; se enche pouco, aproxima.
  function calibrate() {
    const savedT = curT;
    curT = -1;
    const vf = camera.fov * RAD;
    for (let pass = 0; pass < 2; pass++) {
      updateCamera();
      camera.updateMatrixWorld(true);
      const tanV = Math.tan(vf / 2);
      let maxNdc = 0;
      fitPts.forEach(function (fp) {
        const q = fp.p.clone().project(camera);
        const dist = Math.max(0.1, camera.position.distanceTo(fp.p));
        // meia margem em vez do raio inteiro: com o raio completo o objecto
        // ficava pequeno no meio da caixa
        const ry = (fp.r * 0.55) / (dist * tanV);
        const rx = ry / Math.max(0.2, camera.aspect);
        maxNdc = Math.max(maxNdc, Math.abs(q.x) + rx, Math.abs(q.y) + ry);
      });
      if (!(maxNdc > 0.02)) { curT = savedT; return; }
      fitDist = fitDist * (maxNdc / 0.9);
    }
    curT = savedT;
    updateCamera();
  }

  // câmara coreografada: cada passo muda azimute, elevação, zoom e ponto de interesse
  const camKeys = SPEC.anims.filter(function (a) { return a.type === "camera"; }).sort(function (a, b) { return a.at_ms - b.at_ms; });
  let curT = 0;
  const camLook = new THREE.Vector3(), lkA = new THREE.Vector3(), lkB = new THREE.Vector3();
  const camS = { az: 0, pol: 0, zoom: 1 };
  function lookPos(l, out) {
    if (typeof l === "string" && byId[l]) return byId[l].g.getWorldPosition(out);
    if (Array.isArray(l)) return out.set(l[0], l[1], l[2]);
    return out.copy(center);
  }
  function camState(t) {
    let f = { az: start[0], pol: start[1], zoom: 1, look: null };
    camS.az = f.az; camS.pol = f.pol; camS.zoom = 1; camLook.copy(center);
    for (let i = 0; i < camKeys.length; i++) {
      const k = camKeys[i];
      if (t < k.at_ms) break;
      const to = {
        az: k.az !== undefined ? k.az * RAD : f.az,
        pol: k.el !== undefined ? (90 - k.el) * RAD : f.pol,
        zoom: k.zoom !== undefined ? k.zoom : f.zoom,
        look: k.look !== undefined ? k.look : f.look
      };
      const u = ease((t - k.at_ms) / k.duration_ms, k.ease || "inout");
      camS.az = f.az + (to.az - f.az) * u;
      camS.pol = f.pol + (to.pol - f.pol) * u;
      camS.zoom = f.zoom + (to.zoom - f.zoom) * u;
      camLook.lerpVectors(lookPos(f.look, lkA), lookPos(to.look, lkB), u);
      if (t - k.at_ms < k.duration_ms) break;
      f = to;
    }
    return camS;
  }
  function updateCamera() {
    const cs = curT >= 0 && camKeys.length ? camState(curT) : null;
    const A = cs ? az + (cs.az - start[0]) : az;
    const P = cs ? clamp(pol + (cs.pol - start[1]), 0.1, Math.PI - 0.1) : pol;
    const d = fitDist / (cs ? zoom * cs.zoom : zoom);
    const C = cs ? camLook : center;
    camera.position.set(
      C.x + d * Math.sin(P) * Math.sin(A),
      C.y + d * Math.cos(P),
      C.z + d * Math.sin(P) * Math.cos(A)
    );
    camera.lookAt(C);
  }

  // ---- animações: tudo é função do tempo ----
  const CONT = { spin: 1, orbit: 1, bounce: 1, pulse: 1, swing: 1, wave: 1 };
  const REPLAY_HOLD = 3200;
  let endTime = 0;
  items.forEach(function (it) { if (it.stream || (it.surf && it.surf.anim)) endTime = Infinity; });
  SPEC.anims.forEach(function (a) {
    // spin/orbit/bounce/pulse correm enquanto a página estiver aberta:
    // a cena nunca "congela" a meio.
    if (CONT[a.type] || (a.type === "expr" && !(a.duration_ms > 0))) endTime = Infinity;
    else endTime = Math.max(endTime, a.at_ms + a.duration_ms);
    if (a.loop && !CONT[a.type]) endTime = Infinity;
  });

  SPEC.captions.forEach(function (c) { if (endTime !== Infinity) endTime = Math.max(endTime, c.at_ms + 600); });

  function rotate(v, axis, ang) {
    const c = Math.cos(ang), s = Math.sin(ang);
    let x = v.x, y = v.y, z = v.z;
    if (axis === "y") { v.x = x * c + z * s; v.z = -x * s + z * c; }
    else if (axis === "x") { v.y = y * c - z * s; v.z = y * s + z * c; }
    else { v.x = x * c - y * s; v.y = x * s + y * c; }
  }

  function progress(a, lt) {
    const dur = Math.max(1, a.duration_ms);
    if (a.loop) {
      const ph = (lt / dur) % 2;
      return ease(ph <= 1 ? ph : 2 - ph, a.ease);
    }
    return ease(clamp(lt / dur, 0, 1), a.ease);
  }

  const tmp = new THREE.Vector3(), orbOff = new THREE.Vector3(), orbC = new THREE.Vector3(), wpTmp = new THREE.Vector3();
  const tmp2 = new THREE.Color(), tmp3 = new THREE.Color();
  const tanTmp = new THREE.Vector3(), qTmp = new THREE.Quaternion(), X_AXIS = new THREE.Vector3(1, 0, 0), Y_AXIS = new THREE.Vector3(0, 1, 0), Z_AXIS = new THREE.Vector3(0, 0, 1);

  // fotogramas-chave: cada propriedade tem a sua pista, interpolada com a suavização pedida
  function track(a, prop) {
    if (!a._tr) a._tr = {};
    if (a._tr[prop]) return a._tr[prop];
    const out = [];
    a.frames.forEach(function (f) { if (f[prop] !== undefined) out.push({ t: f.t, v: f[prop] }); });
    a._tr[prop] = out;
    return out;
  }
  function sampleTrack(a, prop, lt, into) {
    const tr = track(a, prop);
    if (!tr.length) return false;
    let i = 0;
    while (i < tr.length - 1 && tr[i + 1].t <= lt) i++;
    const A = tr[i], B = tr[Math.min(i + 1, tr.length - 1)];
    const u = B.t > A.t ? ease(clamp((lt - A.t) / (B.t - A.t), 0, 1), a.ease) : 1;
    const k = lt <= tr[0].t ? 0 : 1;
    if (prop === "opacity") { into[0] = A.v + (B.v - A.v) * (k ? u : 0); return true; }
    if (prop === "color") {
      tmp2.setHex(PAL[A.v]); tmp3.setHex(PAL[B.v]);
      into[0] = tmp2.lerp(tmp3, k ? u : 0).getHex();
      return true;
    }
    for (let c = 0; c < 3; c++) into[c] = A.v[c] + (B.v[c] - A.v[c]) * (k ? u : 0);
    return true;
  }
  const kv = [0, 0, 0];
  function applyKeys(a, it, lt) {
    const dur = a.duration_ms;
    if (a.loop) { const ph = (lt / dur) % 2; lt = (ph <= 1 ? ph : 2 - ph) * dur; }
    if (sampleTrack(a, "pos", lt, kv)) it.g.position.set(kv[0], kv[1], kv[2]);
    if (sampleTrack(a, "rot", lt, kv)) it.g.rotation.set(kv[0] * RAD, kv[1] * RAD, kv[2] * RAD);
    if (sampleTrack(a, "scale", lt, kv)) it.sc.scale.set(kv[0], kv[1], kv[2]);
    if (sampleTrack(a, "opacity", lt, kv)) it.op = kv[0];
    if (sampleTrack(a, "color", lt, kv)) it.mat.color.setHex(kv[0]);
  }
  // expressões de t (segundos) e u (0 a 1 se a animação tem duração)
  const fxv = { t: 0, u: 0 };
  function applyExpr(a, it, lt) {
    if (!a._f) {
      const cp = function (arr) { return arr ? arr.map(function (e) { return e ? compileExpr(e, ["t", "u"]) : null; }) : null; };
      a._f = { pos: cp(a.fx.pos), rot: cp(a.fx.rot), scale: cp(a.fx.scale), opacity: a.fx.opacity ? compileExpr(a.fx.opacity, ["t", "u"]) : null };
    }
    const dur = a.duration_ms;
    if (dur > 0) lt = Math.min(lt, dur);
    fxv.t = lt / 1000; fxv.u = dur > 0 ? clamp(lt / dur, 0, 1) : 0;
    const f = a._f, ax = ["x", "y", "z"];
    for (let c = 0; c < 3; c++) {
      if (f.pos && f.pos[c]) it.g.position[ax[c]] += f.pos[c](fxv);
      if (f.rot && f.rot[c]) it.g.rotation[ax[c]] += f.rot[c](fxv) * RAD;
      if (f.scale && f.scale[c]) it.sc.scale[ax[c]] *= Math.max(0.01, f.scale[c](fxv));
    }
    if (f.opacity) it.op *= clamp(f.opacity(fxv), 0, 1);
  }

  function applyAnims(t) {
    items.forEach(function (it) {
      it.g.position.copy(it.basePos);
      it.sc.scale.copy(it.baseScale);
      it.g.rotation.copy(it.baseRot);
      it.op = it.o.opacity;
      it.mat.color.copy(it.baseColor);
    });
    // 1.ª passagem: tudo menos órbitas (as órbitas seguem o centro já actualizado)
    for (let pass = 0; pass < 2; pass++) {
      SPEC.anims.forEach(function (a) {
        if ((a.type === "orbit") !== (pass === 1)) return;
        const it = byId[a.target];
        if (!it || t < a.at_ms) return;
        let lt = t - a.at_ms;
        // sem clamp: um spin com "duration_ms" dava uma volta e parava
        // no ar, que é exactamente o que se via; agora continua sempre.
        const turns = a.speed * lt / 1000;
        if (a.type === "spin") {
          it.g.rotation[a.axis] += turns * Math.PI * 2;
        } else if (a.type === "orbit") {
          const ar = a.around ? byId[a.around] : null;
          const c0 = ar ? ar.basePos : tmp.set(a.center[0], a.center[1], a.center[2]);
          const off = orbOff.copy(it.basePos).sub(c0);
          rotate(off, a.axis, turns * Math.PI * 2);
          const cNow = ar ? orbC.copy(ar.g.position) : orbC.set(a.center[0], a.center[1], a.center[2]);
          it.g.position.copy(cNow.add(off));
        } else if (a.type === "bounce") {
          const ph = turns * Math.PI * 2;
          const v = a.axis === "y" ? a.amp * Math.abs(Math.sin(ph / 2)) : a.amp * Math.sin(ph);
          it.g.position[a.axis] += v;
        } else if (a.type === "pulse") {
          const k = 1 + a.amp * Math.sin(turns * Math.PI * 2);
          it.sc.scale.multiplyScalar(k);
        } else if (a.type === "move" && a.path) {
          const u = progress(a, lt);
          if (!a._pts) a._pts = a.path.map(function (p) { return new THREE.Vector3(p[0], p[1], p[2]); });
          const pts = it._mv || (it._mv = [it.basePos]); pts.length = 1; for (let q = 0; q < a._pts.length; q++) pts.push(a._pts[q]);
          const seg = u * (pts.length - 1);
          const i = Math.min(pts.length - 2, Math.floor(seg));
          it.g.position.lerpVectors(pts[i], pts[i + 1], seg - i);
        } else if (a.type === "rotate" && a.to_rot) {
          const u = progress(a, lt), b = it.baseRot, r = a.to_rot;
          it.g.rotation.set(b.x + (r[0] * RAD - b.x) * u, b.y + (r[1] * RAD - b.y) * u, b.z + (r[2] * RAD - b.z) * u);
        } else if (a.type === "scale" && a.to_scale) {
          const u = progress(a, lt), s = a.to_scale;
          it.sc.scale.set(1 + (s[0] - 1) * u, 1 + (s[1] - 1) * u, 1 + (s[2] - 1) * u);
        } else if (a.type === "swing") {
          it.g.rotation[a.axis] += a.deg * RAD * Math.sin((turns + a.phase) * Math.PI * 2);
        } else if (a.type === "wave") {
          it.g.position[a.axis] += a.amp * Math.sin((turns + a.phase) * Math.PI * 2);
        } else if (a.type === "follow" && a.path) {
          if (!a._curve) {
            const ps = [it.basePos.clone()];
            a.path.forEach(function (p) { ps.push(new THREE.Vector3(p[0], p[1], p[2])); });
            a._curve = new THREE.CatmullRomCurve3(ps, false, "centripetal");
          }
          const u = progress(a, lt);
          it.g.position.copy(a._curve.getPointAt(clamp(u, 0, 1)));
          if (a.orient) {
            a._curve.getTangentAt(clamp(u, 0.001, 0.999), tanTmp).normalize();
            it.g.quaternion.premultiply(qTmp.setFromUnitVectors(a.orient === "y" ? Y_AXIS : a.orient === "z" ? Z_AXIS : X_AXIS, tanTmp));
          }
        } else if (a.type === "keys" && a.frames) {
          applyKeys(a, it, lt);
        } else if (a.type === "expr" && a.fx) {
          applyExpr(a, it, lt);
        } else if (a.type === "fade") {
          const u = progress(a, lt);
          it.op = it.o.opacity + (a.to_opacity - it.o.opacity) * u;
        } else if (a.type === "color") {
          const u = progress(a, lt);
          it.mat.color.copy(it.baseColor).lerp(tmp2.setHex(PAL[a.to_color]), u);
        }
      });
    }
    // opacidade efectiva herda a do pai (os pais vêm sempre antes dos filhos)
    items.forEach(function (it) {
      it.eff = it.op * (it.par ? it.par.eff : 1);
      it.vis = it.eff > 0.02;
      for (let m = 0; m < it.mats.length; m++) {
        it.mats[m].opacity = it.eff;
        it.mats[m].depthWrite = it.eff >= 0.98 && !it.glass;
      }
      it.sc.visible = it.vis;
      for (let h = 0; h < it.hulls.length; h++) it.hulls[h].visible = !lowQ && it.eff >= 0.6;
      if (it.stream && it.vis) updateStream(it.stream, t);
      if (it.surf && it.vis) updateSurface(it.surf, t);
    });
  }

  // superfície y = f(x, z, t): recalcula as alturas (só se a expressão usa t)
  function updateSurface(sf, t) {
    if (!sf.anim && sf.last >= 0) return;
    sf.last = t;
    const pos = sf.gm.attributes.position, col = sf.gm.attributes.color;
    sf.vars.t = t / 1000;
    let lo = 1e9, hi = -1e9;
    for (let i = 0; i < sf.n; i++) {
      sf.vars.x = pos.getX(i); sf.vars.z = pos.getZ(i);
      const y = clamp(sf.fn(sf.vars), -6, 6);
      pos.setY(i, y);
      if (y < lo) lo = y;
      if (y > hi) hi = y;
    }
    const span = Math.max(0.001, hi - lo);
    for (let i = 0; i < sf.n; i++) {
      const k = 0.9 + 0.5 * ((pos.getY(i) - lo) / span);
      col.setXYZ(i, sf.base.r * k, sf.base.g * k, sf.base.b * k);
    }
    pos.needsUpdate = true; col.needsUpdate = true;
    sf.gm.computeVertexNormals();
  }

  // partículas em fila ao longo do percurso: aparecem, avançam e desaparecem
  function updateStream(st, t) {
    const cyc = (t / 1000) * st.speed;
    for (let i = 0; i < st.count; i++) {
      let ph = (cyc + i / st.count) % 1;
      if (ph < 0) ph += 1;
      const d = ph * st.total;
      let k = 1;
      while (k < st.lens.length - 1 && st.lens[k] < d) k++;
      const seg = Math.max(0.0001, st.lens[k] - st.lens[k - 1]);
      dummy.position.lerpVectors(st.pts[k - 1], st.pts[k], clamp((d - st.lens[k - 1]) / seg, 0, 1));
      dummy.scale.setScalar(Math.max(0.05, Math.pow(Math.sin(Math.PI * ph), 0.6)));
      dummy.updateMatrix();
      st.inst.setMatrixAt(i, dummy.matrix);
    }
    st.inst.instanceMatrix.needsUpdate = true;
  }

  // ---- etiquetas ----
  const proj = new THREE.Vector3();
  function hideLabel(it) {
    it.pill.style.opacity = "0"; it.line.style.display = "none"; it.dot.style.display = "none";
  }
  function layoutLabels() {
    const placed = [];
    let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
    items.forEach(function (it) {
      if (!it.pill) return;
      if (revealed < items.length) { hideLabel(it); return; }
      if (!it.vis) { hideLabel(it); return; }
      if (it.anchor) { proj.copy(it.anchor); it.g.localToWorld(proj); }
      else it.g.getWorldPosition(proj);
      proj.project(camera);
      if (proj.z > 1) { hideLabel(it); return; }
      const ax = (proj.x * 0.5 + 0.5) * W;
      const ay = (-proj.y * 0.5 + 0.5) * H;
      placed.push({ it: it, ax: ax, ay: ay });
    });
    // silhueta aproximada: os pontos projectados de todas as peças visíveis.
    // As pílulas vão para FORA desta caixa, nunca por cima do desenho.
    items.forEach(function (it) {
      if (!it.vis) return;
      const q = it.g.getWorldPosition(wpTmp).project(camera);
      if (q.z > 1) return;
      const x = (q.x * 0.5 + 0.5) * W, y = (-q.y * 0.5 + 0.5) * H;
      const pad = Math.max(6, (it.reach || 0.2) * 26);
      minX = Math.min(minX, x - pad); maxX = Math.max(maxX, x + pad);
      minY = Math.min(minY, y - pad); maxY = Math.max(maxY, y + pad);
    });
    if (minX > maxX) { minX = 0; maxX = W; minY = 0; maxY = H; }
    // As pílulas são separadas por coluna (esquerda/direita do desenho) e
    // distribuídas sem se sobreporem: antes, com três peças do mesmo lado, os
    // rótulos empilhavam-se uns em cima dos outros ("Peso e ar").
    // H já não inclui a faixa da legenda (ver resize), por isso não se
    // volta a descontar aqui
    const capH = 0;
    const bottom = Math.max(4, H - 4 - capH);
    const colunas = { esq: [], dir: [] };
    placed.forEach(function (p) {
      const w = p.it.pw || 40, h = p.it.ph || 20;
      const gap = 12;
      const esquerda = p.ax < (minX + maxX) / 2;
      let x = esquerda ? minX - w - gap : maxX + gap;
      // sem espaço fora do desenho do lado da peça: encosta à margem desse lado
      x = clamp(x, 4, Math.max(4, W - w - 4));
      p.px = x; p.pw = w; p.ph = h;
      (esquerda ? colunas.esq : colunas.dir).push(p);
    });
    ["esq", "dir"].forEach(function (lado) {
      const col = colunas[lado];
      col.sort(function (a, b) { return a.ay - b.ay; });
      let cursor = 4;
      col.forEach(function (p) {
        const h = p.ph;
        let y = clamp(p.ay - h / 2, 4, Math.max(4, bottom - h));
        if (y < cursor) y = cursor;
        p.py = y;
        cursor = y + h + 5;
      });
      // coluna que passou do fundo: sobe o conjunto mantendo a ordem
      const ultima = col[col.length - 1];
      if (ultima && ultima.py + ultima.ph > bottom) {
        let sobra = ultima.py + ultima.ph - bottom;
        for (let i = col.length - 1; i >= 0 && sobra > 0; i--) {
          const antes = col[i].py;
          col[i].py = Math.max(4, col[i].py - sobra);
          sobra -= antes - col[i].py;
        }
        for (let i = 0; i < col.length; i++) {
          const piso = i === 0 ? 4 : col[i - 1].py + col[i - 1].ph + 5;
          if (col[i].py < piso) col[i].py = piso;
        }
      }
    });
    colunas.esq.concat(colunas.dir).forEach(function (p) {
      const x = p.px, y = p.py, w = p.pw, h = p.ph;
      const tr = "translate(" + Math.round(x) + "px," + Math.round(y) + "px)";
      if (p.it._tr !== tr) { p.it._tr = tr; p.it.pill.style.transform = tr; }
      p.it.pill.style.opacity = "1";
      const ex = clamp(p.ax, x, x + w);
      const ey = p.ay > y + h ? y + h : y;
      p.it.line.style.display = "";
      p.it.dot.style.display = "";
      p.it.line.setAttribute("x1", ex); p.it.line.setAttribute("y1", ey);
      p.it.line.setAttribute("x2", p.ax); p.it.line.setAttribute("y2", p.ay);
      p.it.dot.setAttribute("cx", p.ax); p.it.dot.setAttribute("cy", p.ay);
    });
  }

  let capShown = -1;
  let lastBand = -1;
  // ~34 ms por peça: uma cena de 16 peças aparece montada em meio segundo
  const REVEAL_STEP = INLINE ? 34 : 24;
  let revealed = 0;
  function updateCaption(t) {
    if (!capEl) return;
    let k = -1;
    for (let i = 0; i < SPEC.captions.length; i++) if (SPEC.captions[i].at_ms <= t) k = i;
    if (k === capShown) return;
    capShown = k;
    capEl.textContent = k >= 0 ? SPEC.captions[k].text : "";
    capEl.style.opacity = k >= 0 ? "1" : "0";
    // outra legenda pode ter mais linhas: o enquadramento acompanha
    const band = capBand();
    if (band !== lastBand) {
      lastBand = band;
      resize();
    }
  }

  // ---- ciclo de desenho ----
  let raf = 0, last = 0, t0 = 0, frames = 0, dirty = true;
  let spin = !!SPEC.turntable;
  let ema = 0, slow = 0, fc = 0;
  function wake() { if (!raf) raf = requestAnimationFrame(frame); }

  function frame(now) {
    raf = 0;
    if (document.hidden) return;
    const held = isFinite(endTime) && endTime > 0 && now - t0 > endTime + 120 && t0 > 0;
    const minDt = held ? 120 : INLINE ? 33 : 16;
    if (frames > 0 && now - last < minDt - 2) { raf = requestAnimationFrame(frame); return; }
    const dt = last ? Math.min(0.1, (now - last) / 1000) : 0;
    // qualidade adaptativa: se o aparelho não aguenta, tira os contornos e baixa a resolução
    if (!held && last && !lowQ && ++fc > 3) {
      ema = ema ? ema * 0.9 + (now - last) * 0.1 : now - last;
      if (ema > (INLINE ? 55 : 38)) slow++; else slow = 0;
      if (slow > 8) { lowQ = true; renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5)); resize(); dirty = true; }
    }
    last = now;
    if (!t0) t0 = now;
    // linha do tempo finita: repete passado um instante, para a causa e o
    // efeito voltarem a ser vistos sem o aluno fazer nada
    if (isFinite(endTime) && endTime > 0 && now - t0 > endTime + REPLAY_HOLD) t0 = now;
    const t = now - t0;
    if (spin) { az += dt * 0.28; }
    curT = t;
    try {
      if (revealed < items.length) {
        const k = Math.min(items.length, 1 + Math.floor(t / REVEAL_STEP));
        if (k !== revealed) {
          for (let i = revealed; i < k; i++) items[i].g.visible = true;
          revealed = k;
        }
      }
      applyAnims(t);
      updateCamera();
      renderer.render(scene, camera);
      layoutLabels();
      updateCaption(t);
    } catch (e) {
      if (window.__shapesErr) window.__shapesErr(String((e && e.message) || e));
      post({ type: "error", message: "não consegui desenhar a cena" });
      return;
    }
    if (frames === 0) {
      frames = 1;
      window.__shapesReady = true;
      const boot = document.getElementById("boot");
      if (boot) boot.remove();
      post({ type: "ready" });
    }
    const running = t < endTime + 80 || (isFinite(endTime) && endTime > 0) || spin || dirty;
    dirty = false;
    if (running) raf = requestAnimationFrame(frame);
  }

  document.addEventListener("visibilitychange", function () {
    if (!document.hidden) { last = 0; wake(); }
  });
  window.addEventListener("resize", resize);

  // ---- interacção (painel grande e página) ----
  if (true) {
    const el = renderer.domElement;
    const ptrs = new Map();
    let moved = 0, pinch = 0;
    el.style.touchAction = "none";
    el.addEventListener("pointerdown", function (e) {
      try { el.setPointerCapture(e.pointerId); } catch (x) {}
      ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
      moved = 0;
      if (ptrs.size === 2) {
        const v = Array.from(ptrs.values());
        pinch = Math.hypot(v[0].x - v[1].x, v[0].y - v[1].y);
      }
    });
    el.addEventListener("pointermove", function (e) {
      const p = ptrs.get(e.pointerId);
      if (!p) return;
      const dx = e.clientX - p.x, dy = e.clientY - p.y;
      p.x = e.clientX; p.y = e.clientY;
      moved += Math.abs(dx) + Math.abs(dy);
      if (ptrs.size === 1) {
        az -= dx * 0.008;
        pol = clamp(pol - dy * 0.008, 0.12, Math.PI - 0.12);
      } else if (ptrs.size === 2) {
        const v = Array.from(ptrs.values());
        const d = Math.hypot(v[0].x - v[1].x, v[0].y - v[1].y);
        if (pinch > 0) zoom = clamp(zoom * (d / pinch), 0.5, 3);
        pinch = d;
      }
      dirty = true; wake();
    });
    const ray = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    let selected = null;
    function select(it) {
      if (selected) selected.mat.emissive.copy(selected.emi);
      selected = it;
      if (it) it.mat.emissive.copy(it.emi).addScalar(0.16);
      dirty = true; wake();
    }
    el.addEventListener("pointerup", function (e) {
      const wasTap = moved < 8 && ptrs.size === 1;
      ptrs.delete(e.pointerId);
      if (ptrs.size < 2) pinch = 0;
      if (!wasTap) return;
      const r = el.getBoundingClientRect();
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      const hit = ray.intersectObjects(meshes, false)[0];
      const it = hit ? byId[hit.object.userData.oid] : null;
      select(it);
      post(it
        ? { type: "pick", name: it.o.label || it.o.id, note: it.o.note || "" }
        : { type: "pick", name: "", note: "" });
    });
    el.addEventListener("pointercancel", function (e) { ptrs.delete(e.pointerId); pinch = 0; });
    window.__setSpin = function (on) { spin = !!on; dirty = true; wake(); };
    window.__reset = function () {
      az = start[0]; pol = start[1]; zoom = 1;
      t0 = 0; capShown = -1; select(null);
      dirty = true; wake();
    };
    window.__setExplode = function () {};
    window.__setXray = function () {};
  }

  resize();
  wake();
}
`;

export function buildShapesHtml(
  spec: ShapesSpec,
  mode: ShapesMode = "modal",
  threeSources?: string[],
): string {
  const clean = sanitizeShapes(spec);
  const inline = mode === "inline";
  const font = inline ? 11.5 : 13.5;
  const lineH = inline ? 14.5 : 17;
  const sources =
    threeSources && threeSources.length
      ? threeSources
      : [
          "https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.js",
          "https://unpkg.com/three@0.169.0/build/three.module.js",
        ];
  const body = clean
    ? `const SPEC = ${safeJson(clean)};\nconst INLINE = ${inline ? "true" : "false"};\n${EXPR_RUNTIME}\n${RUNTIME}`
    : `window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({ type: "error", message: "cena 3D inválida" }));`;

  return `<!DOCTYPE html>
<html lang="pt">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover"/>
<style>
  html, body { margin:0; padding:0; height:100%; background:transparent; overflow:hidden; }
  body { -webkit-user-select:none; user-select:none; -webkit-tap-highlight-color:transparent; }
  #stage { position:absolute; inset:0; touch-action:none; }
  #stage canvas { display:block; width:100% !important; height:100% !important; }
  #lines { position:absolute; inset:0; width:100%; height:100%; pointer-events:none; overflow:visible; }
  #cap {
    position:absolute; left:50%; bottom:3px; transform:translateX(-50%); max-width:97%;
    padding:2px 9px; border-radius:10px; text-align:center; opacity:0; transition:opacity .25s ease;
    background:rgba(255,253,246,0.94); border:1px solid rgba(45,47,54,0.22);
    font-family:"Bradley Hand","Chalkboard SE","Marker Felt",-apple-system,cursive;
    font-size:${font}px; line-height:${lineH}px; color:#23242a; pointer-events:none;
  }
  #labels { position:absolute; inset:0; pointer-events:none; overflow:hidden; }
  .pill {
    position:absolute; top:0; left:0; opacity:0; max-width:46%;
    padding:3px 7px; border-radius:9px;
    background:rgba(255,253,246,0.94);
    border:1px solid rgba(45,47,54,0.30);
    box-shadow:0 1px 3px rgba(60,55,40,0.13);
    font-family:"Bradley Hand","Chalkboard SE","Marker Felt",-apple-system,cursive;
    font-size:${font}px; line-height:${lineH}px; color:#23242a;
    white-space:normal; word-break:break-word; will-change:transform;
  }
  #boot {
    position:absolute; inset:0; display:flex; align-items:center; justify-content:center;
    font-family:-apple-system,system-ui,sans-serif; font-size:12.5px; color:#9aa0ad; pointer-events:none;
  }
</style>
</head>
<body>
<div id="stage"></div>
<svg id="lines"></svg>
<div id="labels"></div>
<div id="cap"></div>
${inline ? "" : `<div id="boot">a preparar a cena…</div>`}

<script>
  // qualquer falha na cena aparece escrita em vez de deixar a área em branco
  window.__shapesErr = function (msg) {
    try {
      var boot = document.getElementById("boot");
      if (boot) { boot.textContent = "3D indisponível: " + msg; return; }
      var d = document.createElement("div");
      d.id = "err";
      d.textContent = "3D indisponível: " + msg;
      d.style.cssText = "position:absolute;left:8px;right:8px;top:8px;font:12px system-ui;color:#8d3b31;background:rgba(255,253,246,.9);border:1px solid #e0d9c8;border-radius:8px;padding:6px 8px;z-index:9";
      document.body.appendChild(d);
    } catch (e) {}
  };
  window.addEventListener("error", function (e) { window.__shapesErr(String((e && e.message) || e)); });
  window.addEventListener("unhandledrejection", function (e) { window.__shapesErr(String((e && e.reason && e.reason.message) || e.reason)); });
</script>
<script type="module">
// A app descarrega o three uma única vez e passa aqui o endereço local; os
// CDN ficam só como recurso de emergência. Antes eram quatro pedidos ao CDN
// por cada iframe, e quando o host abortava a cena ficava em branco ("Nada").
const THREE_SOURCES = ${JSON.stringify(sources)};
let THREE = null;
for (let i = 0; i < THREE_SOURCES.length; i++) {
  try {
    THREE = await import(THREE_SOURCES[i]);
    break;
  } catch (err) {}
}
if (!THREE) {
  if (window.__shapesErr) window.__shapesErr("a biblioteca 3D não carregou");
  throw new Error("three indisponível");
}

// caixa de cantos arredondados: a geometria é a mesma do addon da three,
// feita aqui para a cena não depender de mais nenhum ficheiro do CDN
function roundedBoxGeometry(sx, sy, sz, segments, radius) {
  const r = Math.max(0.0001, Math.min(radius, Math.min(sx, sy, sz) / 2));
  const seg = Math.max(2, Math.round(segments));
  const g = new THREE.BoxGeometry(sx, sy, sz, seg * 2, seg * 2, seg * 2);
  const pos = g.attributes.position;
  const hx = sx / 2 - r;
  const hy = sy / 2 - r;
  const hz = sz / 2 - r;
  const v = new THREE.Vector3();
  const c = new THREE.Vector3();
  const d = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    c.set(
      Math.min(hx, Math.max(-hx, v.x)),
      Math.min(hy, Math.max(-hy, v.y)),
      Math.min(hz, Math.max(-hz, v.z)),
    );
    d.subVectors(v, c);
    if (d.lengthSq() > 1e-12) {
      d.setLength(r);
      pos.setXYZ(i, c.x + d.x, c.y + d.y, c.z + d.z);
    }
  }
  g.computeVertexNormals();
  return g;
}
function RoundedBoxGeometry(sx, sy, sz, segments, radius) {
  return roundedBoxGeometry(sx, sy, sz, segments, radius);
}

// junta várias geometrias numa só (o addon mergeGeometries só fazia isto)
function mergeGeometries(parts) {
  const list = (parts || []).filter(function (g) { return g && g.attributes && g.attributes.position; });
  if (!list.length) return new THREE.BufferGeometry();
  if (list.length === 1) return list[0];
  const out = new THREE.BufferGeometry();
  const names = ["position", "normal", "uv"].filter(function (n) {
    return list.every(function (g) { return !!g.attributes[n]; });
  });
  for (let n = 0; n < names.length; n++) {
    const name = names[n];
    const size = list[0].attributes[name].itemSize;
    let total = 0;
    for (let i = 0; i < list.length; i++) total += list[i].attributes[name].count;
    const arr = new Float32Array(total * size);
    let off = 0;
    for (let i = 0; i < list.length; i++) {
      const src = list[i].attributes[name].array;
      arr.set(src, off);
      off += src.length;
    }
    out.setAttribute(name, new THREE.BufferAttribute(arr, size));
  }
  const anyIndex = list.some(function (g) { return !!g.index; });
  if (anyIndex) {
    let total = 0;
    for (let i = 0; i < list.length; i++) {
      const g = list[i];
      total += g.index ? g.index.count : g.attributes.position.count;
    }
    const idx = total > 65535 ? new Uint32Array(total) : new Uint16Array(total);
    let off = 0;
    let base = 0;
    for (let i = 0; i < list.length; i++) {
      const g = list[i];
      const count = g.index ? g.index.count : g.attributes.position.count;
      for (let k = 0; k < count; k++) idx[off + k] = (g.index ? g.index.getX(k) : k) + base;
      off += count;
      base += g.attributes.position.count;
    }
    out.setIndex(new THREE.BufferAttribute(idx, 1));
  }
  return out;
}

// mapa de ambiente simples (substitui o RoomEnvironment do addon): dá brilho
// aos metais e ao vidro sem descarregar mais nada
function roomEnvironment() {
  const cv = document.createElement("canvas");
  cv.width = 64;
  cv.height = 32;
  const ctx = cv.getContext("2d");
  const grad = ctx.createLinearGradient(0, 0, 0, 32);
  grad.addColorStop(0, "#ffffff");
  grad.addColorStop(0.5, "#f1eee5");
  grad.addColorStop(1, "#8b8679");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 64, 32);
  const tex = new THREE.CanvasTexture(cv);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// solda vértices coincidentes (usado só para o contorno de formas com arestas vivas)
function mergeVertices(g, tol) {
  const pos = g.attributes.position;
  const q = 1 / (tol || 1e-4);
  const map = new Map();
  const verts = [];
  const idx = [];
  const src = g.index;
  const n = src ? src.count : pos.count;
  for (let i = 0; i < n; i++) {
    const v = src ? src.getX(i) : i;
    const key = Math.round(pos.getX(v) * q) + "," + Math.round(pos.getY(v) * q) + "," + Math.round(pos.getZ(v) * q);
    let k = map.get(key);
    if (k === undefined) {
      k = verts.length / 3;
      map.set(key, k);
      verts.push(pos.getX(v), pos.getY(v), pos.getZ(v));
    }
    idx.push(k);
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute("position", new THREE.BufferAttribute(new Float32Array(verts), 3));
  out.setIndex(idx);
  return out;
}
${body}
</script>
<script>
  // se o CDN não responder, avisa a app em vez de ficar a carregar para sempre
  setTimeout(function () {
    if (window.__shapesReady) {
      var ok = document.getElementById("boot");
      if (ok) ok.remove();
      return;
    }
    var b = document.getElementById("boot");
    if (b) { b.textContent = "sem ligação — o 3D precisa de internet"; b.style.color = "#b06a5f"; }
    try { window.ReactNativeWebView.postMessage(JSON.stringify({ type: "error", message: "não consegui carregar o 3D" })); } catch (e) {}
  }, 12000);
</script>
</body>
</html>`;
}
