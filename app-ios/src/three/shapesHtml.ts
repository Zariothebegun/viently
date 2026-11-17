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
const ease = function (u) { return u * u * (3 - 2 * u); };
const RAD = Math.PI / 180;

const stage = document.getElementById("stage");
const labelsEl = document.getElementById("labels");
const linesEl = document.getElementById("lines");
const capEl = document.getElementById("cap");

let renderer = null;
try {
  renderer = new THREE.WebGLRenderer({ antialias: !INLINE, alpha: true, powerPreference: "low-power" });
} catch (e) {
  post({ type: "error", message: "este telemóvel não abriu o 3D" });
}

if (renderer) {
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, INLINE ? 1.25 : 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  stage.appendChild(renderer.domElement);
  renderer.domElement.addEventListener("webglcontextlost", function (e) {
    e.preventDefault();
    post({ type: "error", message: "o 3D foi interrompido" });
  });

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(36, 1, 0.05, 200);
  scene.add(new THREE.HemisphereLight(0xfffdf2, 0x8d887a, 1.35));
  const key = new THREE.DirectionalLight(0xffffff, 1.7);
  key.position.set(3.5, 6, 4.5);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xffffff, 0.5);
  fill.position.set(-5, 2, -4);
  scene.add(fill);

  // geometrias unitárias partilhadas: uma por tipo, mesmo com 16 objectos
  const GEO = {};
  function geo(kind) {
    if (GEO[kind]) return GEO[kind];
    let g;
    if (kind === "sphere") g = new THREE.SphereGeometry(0.5, INLINE ? 18 : 28, INLINE ? 12 : 20);
    else if (kind === "box") g = new THREE.BoxGeometry(1, 1, 1);
    else if (kind === "cylinder") g = new THREE.CylinderGeometry(0.5, 0.5, 1, INLINE ? 18 : 28);
    else if (kind === "cone") g = new THREE.ConeGeometry(0.5, 1, INLINE ? 18 : 28);
    else if (kind === "capsule") g = new THREE.CapsuleGeometry(0.35, 0.3, 6, INLINE ? 12 : 20);
    else if (kind === "rbox") g = new RoundedBoxGeometry(1, 1, 1, INLINE ? 2 : 4, 0.14);
    else if (kind === "torus") { g = new THREE.TorusGeometry(0.5, 0.14, 12, INLINE ? 28 : 44); g.rotateX(Math.PI / 2); }
    else if (kind === "ring") { g = new THREE.RingGeometry(0.4, 0.5, 48); g.rotateX(-Math.PI / 2); }
    else { g = new THREE.PlaneGeometry(1, 1); g.rotateX(-Math.PI / 2); }
    GEO[kind] = g;
    return g;
  }

  const items = [];
  const byId = {};
  const meshes = [];
  let minY = 0;

  const root = scene;
  SPEC.objects.forEach(function (o) {
    const flat = o.shape === "ring" || o.shape === "plane";
    const mat = new THREE.MeshStandardMaterial({
      color: PAL[o.color],
      roughness: 0.55,
      metalness: 0.12,
      transparent: o.opacity < 1,
      opacity: o.opacity,
      wireframe: o.wire,
      side: flat ? THREE.DoubleSide : THREE.FrontSide
    });
    // g: posição/rotação (os filhos ficam aqui); sc: escala só desta forma
    const g = new THREE.Group();
    const sc = new THREE.Group();
    g.add(sc);
    const baseScale = new THREE.Vector3(1, 1, 1);
    let hull = null;

    if (o.shape === "group") {
      // sem malha: serve para mover/mostrar um conjunto de peças de uma vez
    } else if (o.shape === "arrow") {
      // seta ao longo de +Y: comprimento = size[1], espessura = size[0]
      const len = Math.max(0.2, o.size[1]);
      const r = Math.max(0.04, o.size[0] * 0.12);
      const head = Math.min(len * 0.4, r * 4.5);
      const shaft = new THREE.Mesh(geo("cylinder"), mat);
      shaft.scale.set(r * 2, len - head, r * 2);
      shaft.position.y = (len - head) / 2 - len / 2;
      const tip = new THREE.Mesh(geo("cone"), mat);
      tip.scale.set(r * 4.4, head, r * 4.4);
      tip.position.y = len / 2 - head / 2;
      shaft.userData.oid = o.id;
      tip.userData.oid = o.id;
      sc.add(shaft);
      sc.add(tip);
      meshes.push(shaft, tip);
    } else {
      const m = new THREE.Mesh(geo(o.shape), mat);
      m.userData.oid = o.id;
      sc.add(m);
      meshes.push(m);
      if (o.shape === "plane") baseScale.set(o.size[0], 1, o.size[2]);
      else if (o.shape === "capsule") baseScale.set(o.size[0] / 0.7, o.size[1], o.size[2] / 0.7);
      else baseScale.set(o.size[0], o.size[1], o.size[2]);
      if (!flat && !o.wire) {
        // contorno de tinta: casca invertida ligeiramente maior
        hull = new THREE.Mesh(geo(o.shape), new THREE.MeshBasicMaterial({ color: 0x273247, side: THREE.BackSide }));
        hull.scale.setScalar(1.045);
        sc.add(hull);
      }
    }

    const basePos = new THREE.Vector3(o.pos[0], o.pos[1], o.pos[2]);
    g.position.copy(basePos);
    g.rotation.set(o.rot[0] * RAD, o.rot[1] * RAD, o.rot[2] * RAD);
    sc.scale.copy(baseScale);
    const par = o.parent && byId[o.parent] ? byId[o.parent] : null;
    (par ? par.g : scene).add(g);

    const reach = o.shape === "group" ? 0
      : o.shape === "arrow" ? Math.max(o.size[1], o.size[0]) * 0.55
      : Math.max(o.size[0], o.size[1], o.size[2]) * 0.55;

    const it = {
      o: o, g: g, sc: sc, mat: mat, hull: hull, reach: reach, par: par,
      basePos: basePos, baseScale: baseScale,
      baseRot: new THREE.Euler(o.rot[0] * RAD, o.rot[1] * RAD, o.rot[2] * RAD),
      baseColor: new THREE.Color(PAL[o.color]),
      op: o.opacity, eff: o.opacity, mayFade: o.opacity < 1,
      pill: null, pw: 0, ph: 0, line: null, dot: null, vis: true
    };
    items.push(it);
    byId[o.id] = it;
  });

  // materiais que podem ficar translúcidos (próprios, por fade, ou por herança do pai)
  SPEC.anims.forEach(function (a) { if (a.type === "fade" && byId[a.target]) byId[a.target].mayFade = true; });
  items.forEach(function (it) {
    if (it.par && it.par.mayFade) it.mayFade = true;
    it.mat.transparent = it.mayFade;
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
  items.forEach(function (it) { fitPts.push({ p: wp(it), r: Math.max(0.15, it.reach) }); });
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
  const R = Math.max(0.5, bb.getSize(new THREE.Vector3()).length() * 0.5 * 0.9);

  if (SPEC.ground) {
    const grid = new THREE.GridHelper(14, 14, 0xcfcbbd, 0xe2dfd2);
    grid.position.y = bb.min.y - 0.01;
    scene.add(grid);
  }

  const PRESET = {
    iso: [0.72, 1.12], front: [0, Math.PI / 2], side: [Math.PI / 2, Math.PI / 2], top: [0.0, 0.18]
  };
  const start = PRESET[SPEC.camera] || PRESET.iso;
  let az = start[0], pol = start[1], zoom = 1, fitDist = 6;
  let W = 1, H = 1;

  function resize() {
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
    const pad = INLINE ? 1.16 : 1.08;
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
    const vf = camera.fov * RAD;
    for (let pass = 0; pass < 2; pass++) {
      updateCamera();
      camera.updateMatrixWorld(true);
      const tanV = Math.tan(vf / 2);
      let maxNdc = 0;
      fitPts.forEach(function (fp) {
        const q = fp.p.clone().project(camera);
        const dist = Math.max(0.1, camera.position.distanceTo(fp.p));
        const ry = fp.r / (dist * tanV);
        const rx = ry / Math.max(0.2, camera.aspect);
        maxNdc = Math.max(maxNdc, Math.abs(q.x) + rx, Math.abs(q.y) + ry);
      });
      if (!(maxNdc > 0.02)) return;
      fitDist = fitDist * (maxNdc / 0.86);
    }
    updateCamera();
  }

  function updateCamera() {
    const d = fitDist / zoom;
    camera.position.set(
      center.x + d * Math.sin(pol) * Math.sin(az),
      center.y + d * Math.cos(pol),
      center.z + d * Math.sin(pol) * Math.cos(az)
    );
    camera.lookAt(center);
  }

  // ---- animações: tudo é função do tempo ----
  const CONT = { spin: 1, orbit: 1, bounce: 1, pulse: 1 };
  let endTime = 0;
  SPEC.anims.forEach(function (a) {
    if (CONT[a.type] && a.duration_ms === 0) endTime = Infinity;
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
      return ease(ph <= 1 ? ph : 2 - ph);
    }
    return ease(clamp(lt / dur, 0, 1));
  }

  const tmp = new THREE.Vector3();
  const tmp2 = new THREE.Color();

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
        if (CONT[a.type] && a.duration_ms > 0) lt = Math.min(lt, a.duration_ms);
        const turns = a.speed * lt / 1000;
        if (a.type === "spin") {
          it.g.rotation[a.axis] += turns * Math.PI * 2;
        } else if (a.type === "orbit") {
          const ar = a.around ? byId[a.around] : null;
          const c0 = ar ? ar.basePos : tmp.set(a.center[0], a.center[1], a.center[2]);
          const off = it.basePos.clone().sub(c0);
          rotate(off, a.axis, turns * Math.PI * 2);
          const cNow = ar
            ? ar.g.position.clone()
            : new THREE.Vector3(a.center[0], a.center[1], a.center[2]);
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
          const pts = [it.basePos].concat(a.path.map(function (p) { return new THREE.Vector3(p[0], p[1], p[2]); }));
          const seg = u * (pts.length - 1);
          const i = Math.min(pts.length - 2, Math.floor(seg));
          it.g.position.lerpVectors(pts[i], pts[i + 1], seg - i);
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
      it.mat.opacity = it.eff;
      it.mat.depthWrite = it.eff >= 0.98;
      it.sc.visible = it.vis;
      if (it.hull) it.hull.visible = it.eff >= 0.6;
    });
  }

  // ---- etiquetas ----
  const proj = new THREE.Vector3();
  function hideLabel(it) {
    it.pill.style.opacity = "0"; it.line.style.display = "none"; it.dot.style.display = "none";
  }
  function layoutLabels() {
    const placed = [];
    items.forEach(function (it) {
      if (!it.pill) return;
      if (!it.vis) { hideLabel(it); return; }
      it.g.getWorldPosition(proj);
      proj.project(camera);
      if (proj.z > 1) { hideLabel(it); return; }
      placed.push({ it: it, ax: (proj.x * 0.5 + 0.5) * W, ay: (-proj.y * 0.5 + 0.5) * H });
    });
    placed.sort(function (a, b) { return a.ay - b.ay; });
    placed.forEach(function (p, i) {
      const w = p.it.pw || 40, h = p.it.ph || 20;
      // a pílula fica acima do ponto e afastada para o lado mais livre
      let x = clamp(p.ax + (p.ax < W / 2 ? -w - 14 : 14), 3, Math.max(3, W - w - 3));
      let y = clamp(p.ay - h - 16, 3, Math.max(3, H - h - 22));
      for (let j = 0; j < i; j++) {
        const q = placed[j];
        const qw = q.it.pw || 40, qh = q.it.ph || 20;
        if (x < q.px + qw + 3 && x + w + 3 > q.px && y < q.py + qh + 2 && y + h + 2 > q.py) {
          y = q.py + qh + 3;
        }
      }
      p.px = x; p.py = y;
      p.it.pill.style.transform = "translate(" + Math.round(x) + "px," + Math.round(y) + "px)";
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
  function updateCaption(t) {
    if (!capEl) return;
    let k = -1;
    for (let i = 0; i < SPEC.captions.length; i++) if (SPEC.captions[i].at_ms <= t) k = i;
    if (k === capShown) return;
    capShown = k;
    capEl.textContent = k >= 0 ? SPEC.captions[k].text : "";
    capEl.style.opacity = k >= 0 ? "1" : "0";
  }

  // ---- ciclo de desenho ----
  let raf = 0, last = 0, t0 = 0, frames = 0, dirty = true;
  let spin = false;
  function wake() { if (!raf) raf = requestAnimationFrame(frame); }

  function frame(now) {
    raf = 0;
    if (document.hidden) return;
    const minDt = INLINE ? 33 : 16;
    if (frames > 0 && now - last < minDt - 2) { raf = requestAnimationFrame(frame); return; }
    const dt = last ? Math.min(0.1, (now - last) / 1000) : 0;
    last = now;
    if (!t0) t0 = now;
    const t = now - t0;
    if (spin && !INLINE) { az += dt * 0.28; }
    try {
      applyAnims(t);
      updateCamera();
      renderer.render(scene, camera);
      layoutLabels();
      updateCaption(t);
    } catch (e) {
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
    const running = t < endTime + 80 || (spin && !INLINE) || dirty;
    dirty = false;
    if (running) raf = requestAnimationFrame(frame);
  }

  document.addEventListener("visibilitychange", function () {
    if (!document.hidden) { last = 0; wake(); }
  });
  window.addEventListener("resize", resize);

  // ---- interacção (só no painel grande) ----
  if (!INLINE) {
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
      if (selected) selected.mat.emissive.setHex(0x000000);
      selected = it;
      if (it) it.mat.emissive.setHex(0x2a2a2a);
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

export function buildShapesHtml(spec: ShapesSpec, mode: ShapesMode = "modal"): string {
  const clean = sanitizeShapes(spec);
  const inline = mode === "inline";
  const font = inline ? 11.5 : 13.5;
  const lineH = inline ? 14.5 : 17;
  const body = clean
    ? `const SPEC = ${safeJson(clean)};\nconst INLINE = ${inline ? "true" : "false"};\n${RUNTIME}`
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
    position:absolute; left:50%; bottom:4px; transform:translateX(-50%); max-width:92%;
    padding:3px 10px; border-radius:10px; text-align:center; opacity:0; transition:opacity .25s ease;
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
<script type="importmap">
{ "imports": {
  "three": "https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.js",
  "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.169.0/examples/jsm/"
} }
</script>
<script type="module">
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
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
