// Cena 3D — corre dentro de um WebView, em HTML próprio.
//
// Porquê WebView: o Expo Go não expõe um contexto WebGL estável para three.js
// (expo-gl + expo-three está parado e quebra na New Architecture). Uma WebView
// dá three.js real, com toque, sem dev build e sem módulos nativos novos.
//
// Técnica adaptada de github.com/Moh4696/open-3d-skills:
//   threejs-scene  -> geometria paramétrica, luz de estúdio, tone mapping
//   exploded-view  -> partes com stage/explode, x-ray, rótulos ancorados
//                     com linha-guia que fogem do modelo e uns dos outros
// O código do repositório é web; aqui foi reescrito para um painel de app,
// com toque em vez de rato e sem OrbitControls (arrasto simples).

import { MODELS, type ModelId } from "./models";

export { MODELS, type ModelId };

const SCENE_JS = String.raw`
import * as THREE from "three";

const MODEL_ID = "__MODEL__";
const INLINE = __INLINE__;
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smooth = (t) => t * t * (3 - 2 * t);

let seed = 20260101;
function rnd() {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
}

function mat(color, o) {
  o = o || {};
  const transparent = !!o.transparent || (o.opacity != null && o.opacity < 1);
  return new THREE.MeshStandardMaterial({
    color: color,
    roughness: o.roughness == null ? 0.55 : o.roughness,
    metalness: o.metalness == null ? 0.04 : o.metalness,
    transparent: transparent,
    opacity: o.opacity == null ? 1 : o.opacity,
    side: o.side || THREE.FrontSide,
    depthWrite: o.depthWrite == null ? true : o.depthWrite,
    emissive: 0x000000,
    emissiveIntensity: 0,
    flatShading: !!o.flat
  });
}

// ---------------- cena ----------------
const host = document.getElementById("stage");
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, INLINE ? 1 : 1.5));
renderer.shadowMap.enabled = !INLINE;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.02;
renderer.setClearColor(0x000000, 0);
host.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(31, 1, 0.1, 80);

scene.add(new THREE.HemisphereLight(0xfffdf2, 0x8d939d, 0.9));

const key = new THREE.DirectionalLight(0xfff7ea, 2.0);
key.position.set(2.6, 3.6, 2.4);
key.castShadow = !INLINE;
key.shadow.mapSize.set(512, 512);
key.shadow.camera.left = -3.2;
key.shadow.camera.right = 3.2;
key.shadow.camera.top = 3.2;
key.shadow.camera.bottom = -3.2;
key.shadow.camera.near = 0.2;
key.shadow.camera.far = 14;
key.shadow.bias = -0.0004;
key.shadow.normalBias = 0.03;
scene.add(key);

const fill = new THREE.DirectionalLight(0xdfe9ff, 0.85);
fill.position.set(-3.2, 1.1, 1.8);
scene.add(fill);

const rim = new THREE.DirectionalLight(0xffffff, 0.7);
rim.position.set(0.4, -2.2, -3.2);
scene.add(rim);

const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(24, 24),
  new THREE.ShadowMaterial({ color: 0x4a4a44, opacity: 0.15 })
);
floor.rotation.x = -Math.PI / 2;
floor.position.y = -1.42;
floor.receiveShadow = !INLINE;
scene.add(floor);

const assembly = new THREE.Group();
scene.add(assembly);

// ---------------- partes ----------------
const parts = [];

function addPart(cfg, build) {
  const g = new THREE.Group();
  const ud = {
    name: cfg.name,
    note: cfg.note || "",
    stage: cfg.stage || 0,
    explode: new THREE.Vector3().fromArray(cfg.explode || [0, 0, 0]),
    grow: cfg.grow || 0,
    shell: !!cfg.shell,
    anchor: new THREE.Vector3().fromArray(cfg.anchor || [0, 0, 0]),
    base: new THREE.Vector3(0, 0, 0),
    meshes: [],
    noShadow: !!cfg.noShadow
  };
  g.userData = ud;
  build(g);
  g.traverse(function (o) {
    if (!o.isMesh) return;
    o.castShadow = !ud.noShadow;
    o.receiveShadow = !ud.noShadow;
    o.material.userData.baseOpacity = o.material.opacity;
    o.material.userData.baseEmissive = 0x000000;
    ud.meshes.push(o);
  });
  assembly.add(g);
  parts.push(g);
  return g;
}

function cyl(r1, r2, h, seg, open) {
  const geo = new THREE.CylinderGeometry(r1, r2, h, seg || 40, 1, !!open);
  geo.rotateX(Math.PI / 2); // eixo do cilindro passa a ser Z
  return geo;
}

function box(w, h, d) {
  return new THREE.BoxGeometry(w, h, d);
}

// ---------------- modelo: célula animal ----------------
function buildCell() {
  addPart(
    {
      name: "Membrana",
      note: "controla o que entra e sai da célula",
      shell: true,
      stage: 0,
      grow: -0.45,
      anchor: [0.55, 0.6, 0.55],
      explode: [0, 0, 0],
      noShadow: true
    },
    function (g) {
      g.add(
        new THREE.Mesh(
          new THREE.SphereGeometry(1, 52, 34),
          mat(0xc6e2d2, {
            roughness: 0.9,
            transparent: true,
            opacity: 0.1,
            side: THREE.FrontSide,
            depthWrite: false
          })
        )
      );
      g.add(
        new THREE.Mesh(
          new THREE.SphereGeometry(0.998, 48, 32),
          mat(0x9cc4ac, {
            roughness: 0.95,
            transparent: true,
            opacity: 0.11,
            side: THREE.BackSide,
            depthWrite: false
          })
        )
      );
    }
  );

  addPart(
    {
      name: "Núcleo",
      note: "guarda o ADN e comanda a célula",
      stage: 1,
      anchor: [0.1, 0.3, 0.18],
      explode: [0, 0.8, 0.1]
    },
    function (g) {
      const n = new THREE.Mesh(
        new THREE.SphereGeometry(0.36, 40, 28),
        mat(0x9c8ce0, { roughness: 0.48, transparent: true, opacity: 0.92 })
      );
      g.add(n);
      const nucleolus = new THREE.Mesh(
        new THREE.SphereGeometry(0.135, 26, 18),
        mat(0x6b5ac6, { roughness: 0.6 })
      );
      nucleolus.position.set(0.1, 0.05, 0.07);
      g.add(nucleolus);
    }
  );

  addPart(
    {
      name: "Mitocôndria",
      note: "liberta a energia que a célula usa",
      stage: 2,
      anchor: [-0.52, -0.36, 0.3],
      explode: [-0.75, -0.4, 0.2]
    },
    function (g) {
      const spots = [
        [-0.52, -0.4, 0.34, 0.7],
        [0.16, -0.62, 0.16, -0.5],
        [0.5, 0.44, 0.2, 2.1]
      ];
      spots.forEach(function (s) {
        const m = new THREE.Group();
        const outer = new THREE.Mesh(
          new THREE.CapsuleGeometry(0.105, 0.2, 6, 20),
          mat(0xd39257, { roughness: 0.45, transparent: true, opacity: 0.55 })
        );
        const inner = new THREE.Mesh(
          new THREE.CapsuleGeometry(0.07, 0.17, 6, 18),
          mat(0xb96f34, { roughness: 0.55 })
        );
        m.add(outer);
        m.add(inner);
        m.position.set(s[0], s[1], s[2]);
        m.rotation.set(s[3], s[3] * 0.8, s[3] * 0.4);
        g.add(m);
      });
    }
  );

  addPart(
    {
      name: "Complexo de Golgi",
      note: "embala e envia as proteínas",
      stage: 2,
      anchor: [0.6, -0.36, 0.14],
      explode: [1.05, -0.1, 0.08]
    },
    function (g) {
      for (let i = 0; i < 5; i++) {
        const r = 0.16 - i * 0.014;
        const disc = new THREE.Mesh(
          new THREE.TorusGeometry(r, 0.022, 8, 30, Math.PI * 1.2),
          mat(0xcf7a3a, { roughness: 0.5 })
        );
        disc.position.set(0.6, -0.46 + i * 0.046, 0.1);
        disc.rotation.set(Math.PI / 2, 0, 2.1 + i * 0.12);
        g.add(disc);
      }
    }
  );

  addPart(
    {
      name: "Retículo endoplasmático",
      note: "fabrica e transporta proteínas",
      stage: 3,
      anchor: [-0.42, 0.24, -0.24],
      explode: [-1.05, 0.1, -0.15]
    },
    function (g) {
      // canais que abraçam o núcleo, em vez de uma fita plana
      for (let k = 0; k < 4; k++) {
        const pts = [];
        for (let i = 0; i < 12; i++) {
          const a = -1.5 + i * 0.33 + k * 0.5;
          const rad = 0.52 + k * 0.055 + Math.sin(i * 1.3) * 0.03;
          pts.push(
            new THREE.Vector3(
              Math.cos(a) * rad - 0.2,
              -0.12 + (i / 11) * 0.44 - k * 0.03,
              Math.sin(a) * rad * 0.82 - 0.3
            )
          );
        }
        const curve = new THREE.CatmullRomCurve3(pts);
        const tube = new THREE.Mesh(
          new THREE.TubeGeometry(curve, 40, 0.024, 8, false),
          mat(0x7fa8c9, { roughness: 0.55 })
        );
        g.add(tube);
      }
    }
  );
}

// ---------------- modelo: motor ----------------
function buildMotor() {
  addPart(
    {
      name: "Carcaça",
      note: "protege o motor e ajuda a arrefecer",
      shell: true,
      stage: 0,
      anchor: [0.34, 0.34, 0.56],
      explode: [0, 0.95, 0],
      noShadow: true
    },
    function (g) {
      g.add(
        new THREE.Mesh(
          cyl(0.55, 0.55, 1.0, 52, true),
          mat(0xa9b2bb, {
            roughness: 0.4,
            metalness: 0.5,
            side: THREE.DoubleSide
          })
        )
      );
      // tampas fazem parte da carcaça: saem com ela na vista explodida
      [-0.53, 0.53].forEach(function (z) {
        const cap = new THREE.Mesh(
          cyl(0.55, 0.55, 0.07, 48),
          mat(0x8e9aa6, { roughness: 0.42, metalness: 0.5 })
        );
        cap.position.z = z;
        g.add(cap);
      });
      [-0.34, 0, 0.34].forEach(function (z) {
        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(0.556, 0.016, 8, 48),
          mat(0x8b95a1, { roughness: 0.4, metalness: 0.45 })
        );
        ring.position.z = z;
        ring.castShadow = false;
        g.add(ring);
      });
    }
  );

  addPart(
    {
      name: "Estator",
      note: "bobinas fixas que criam o campo magnético",
      stage: 1,
      anchor: [-0.2, 0.44, 0.0],
      explode: [-0.9, 0, 0]
    },
    function (g) {
      g.add(
        new THREE.Mesh(
          cyl(0.47, 0.47, 0.84, 44, true),
          mat(0xc98f4e, {
            roughness: 0.55,
            metalness: 0.25,
            side: THREE.DoubleSide
          })
        )
      );
      g.add(
        new THREE.Mesh(
          cyl(0.415, 0.415, 0.86, 40, true),
          mat(0x7d6a55, { roughness: 0.7, side: THREE.DoubleSide })
        )
      );
    }
  );

  addPart(
    {
      name: "Rotor",
      note: "gira quando o campo o empurra",
      stage: 2,
      anchor: [0.22, 0.18, 0.08],
      explode: [0.9, 0, 0]
    },
    function (g) {
      g.add(
        new THREE.Mesh(cyl(0.3, 0.3, 0.8, 40), mat(0xc07b45, { roughness: 0.35, metalness: 0.6 }))
      );
    }
  );

  addPart(
    {
      name: "Veio",
      note: "transmite a rotação à máquina",
      stage: 3,
      anchor: [0.04, 0.04, 0.72],
      explode: [0, 0, 0.95]
    },
    function (g) {
      const s = new THREE.Mesh(cyl(0.05, 0.05, 1.7, 20), mat(0xb9c1c9, { roughness: 0.28, metalness: 0.85 }));
      g.add(s);
    }
  );

  addPart(
    {
      name: "Ventoinha",
      note: "sopra ar pelas aletas da carcaça",
      stage: 2,
      anchor: [0.3, 0.12, -0.6],
      explode: [0, 0, -1.0]
    },
    function (g) {
      const hub = new THREE.Mesh(cyl(0.1, 0.1, 0.12, 24), mat(0x5f6b78, { roughness: 0.5, metalness: 0.4 }));
      hub.position.z = -0.6;
      g.add(hub);
      for (let i = 0; i < 7; i++) {
        const b = new THREE.Mesh(box(0.075, 0.36, 0.016), mat(0x6d7986, { roughness: 0.5, metalness: 0.35 }));
        const a = (i / 7) * Math.PI * 2;
        b.position.set(Math.cos(a) * 0.19, Math.sin(a) * 0.19, -0.6);
        b.rotation.z = a;
        b.rotation.y = 0.5;
        g.add(b);
      }
    }
  );

  addPart(
    {
      name: "Caixa de terminais",
      note: "onde chega a corrente da rede",
      stage: 1,
      anchor: [0, 0.68, 0.24],
      explode: [0, 1.35, 0.1]
    },
    function (g) {
      const b = new THREE.Mesh(box(0.34, 0.16, 0.3), mat(0x7b8794, { roughness: 0.45, metalness: 0.35 }));
      b.position.set(0, 0.62, 0.16);
      g.add(b);
      const lid = new THREE.Mesh(box(0.3, 0.03, 0.26), mat(0x9aa5b0, { roughness: 0.4, metalness: 0.4 }));
      lid.position.set(0, 0.71, 0.16);
      g.add(lid);
    }
  );
}

// ---------------- modelo: átomo ----------------
function buildAtom() {
  addPart(
    {
      name: "Núcleo",
      note: "protões e neutrões, quase toda a massa",
      stage: 0,
      anchor: [0.16, 0.12, 0.12],
      explode: [0, 0, 0]
    },
    function (g) {
      for (let i = 0; i < 9; i++) {
        const r = 0.075 + rnd() * 0.03;
        const s = new THREE.Mesh(
          new THREE.SphereGeometry(r, 18, 14),
          mat(i % 2 ? 0xc2564f : 0xd8a05a, { roughness: 0.45 })
        );
        const a = rnd() * Math.PI * 2;
        const b = Math.acos(rnd() * 2 - 1);
        const d = 0.11 + rnd() * 0.13;
        s.position.set(Math.sin(b) * Math.cos(a) * d, Math.cos(b) * d, Math.sin(b) * Math.sin(a) * d);
        g.add(s);
      }
    }
  );

  const shells = [
    { r: 0.45, n: 2, name: "Camada 1", note: "2 electrões", stage: 1, grow: 0.45 },
    { r: 0.82, n: 5, name: "Camada 2", note: "8 electrões no máximo", stage: 2, grow: 0.7 },
    { r: 1.18, n: 3, name: "Camada 3", note: "a mais afastada do núcleo", stage: 3, grow: 0.95 }
  ];

  shells.forEach(function (sh, si) {
    // âncora assente no aro, para a linha-guia acabar mesmo na camada
    const a0 = new THREE.Vector3(sh.r, 0, 0).applyEuler(new THREE.Euler(Math.PI / 2 - 0.55, 0, -0.35));
    addPart(
      {
        name: sh.name,
        note: sh.note,
        stage: sh.stage,
        grow: sh.grow,
        anchor: [a0.x, a0.y, a0.z],
        explode: [0, 0, 0]
      },
      function (g) {
        [
          [-0.55, -0.35],
          [0.55, 0.7]
        ].forEach(function (tilt) {
          const ring = new THREE.Mesh(
            new THREE.TorusGeometry(sh.r, 0.0075, 6, 96),
            mat(0x8a93a5, {
              roughness: 0.5,
              transparent: true,
              opacity: 0.42,
              depthWrite: false
            })
          );
          ring.rotation.set(Math.PI / 2 + tilt[0], 0, tilt[1]);
          g.add(ring);
        });
        for (let i = 0; i < sh.n; i++) {
          const a = (i / sh.n) * Math.PI * 2 + si;
          const e = new THREE.Mesh(
            new THREE.SphereGeometry(0.05, 16, 12),
            mat(0x3b74c9, { roughness: 0.35 })
          );
          const tilt = i % 2 ? 0.5 : -0.5;
          e.position.set(
            Math.cos(a) * sh.r,
            Math.sin(a) * sh.r * Math.cos(tilt),
            Math.sin(a) * sh.r * Math.sin(tilt)
          );
          g.add(e);
        }
      }
    );
  });
}

// ---------------- modelo: memória RAM ----------------
function buildRam() {
  addPart(
    {
      name: "Placa de circuito",
      note: "liga os chips aos contactos",
      stage: 0,
      anchor: [-0.4, 0.1, 0.12],
      explode: [0, 0, 0]
    },
    function (g) {
      const pcb = new THREE.Mesh(box(4.7, 1.35, 0.14), mat(0x2f6f4c, { roughness: 0.72 }));
      g.add(pcb);
      // borda superior mais escura, para a placa ganhar espessura
      const cap = new THREE.Mesh(box(4.7, 0.06, 0.15), mat(0x245740, { roughness: 0.8 }));
      cap.position.y = 0.675;
      g.add(cap);
      // pequenos condensadores entre os chips
      for (let i = 0; i < 6; i++) {
        const c = new THREE.Mesh(box(0.09, 0.16, 0.08), mat(0xd9c9a2, { roughness: 0.5 }));
        c.position.set(-1.7 + i * 0.7, -0.42, 0.11);
        g.add(c);
      }
    }
  );

  addPart(
    {
      name: "Chips de memória",
      note: "guardam os bits enquanto houver energia",
      stage: 1,
      anchor: [0.55, 0.28, 0.2],
      explode: [0, 0.35, 1.15]
    },
    function (g) {
      for (let i = 0; i < 8; i++) {
        const x = -1.96 + i * 0.56;
        const chip = new THREE.Mesh(box(0.44, 0.64, 0.13), mat(0x25292d, { roughness: 0.62 }));
        chip.position.set(x, 0.1, 0.13);
        g.add(chip);
        const pin = new THREE.Mesh(box(0.46, 0.045, 0.135), mat(0xaeb4b6, { roughness: 0.35, metalness: 0.4 }));
        pin.position.set(x, -0.19, 0.13);
        g.add(pin);
      }
    }
  );

  addPart(
    {
      name: "Contactos dourados",
      note: "ligam a RAM à placa-mãe",
      stage: 2,
      anchor: [-0.9, -0.72, 0.18],
      explode: [0, -0.85, 0.3]
    },
    function (g) {
      for (let i = 0; i < 34; i++) {
        const x = -2.24 + i * 0.136;
        // entalhe: falha nos contactos do meio
        if (x > 0.82 && x < 1.1) continue;
        const finger = new THREE.Mesh(box(0.072, 0.25, 0.06), mat(0xc9a35a, { roughness: 0.32, metalness: 0.72 }));
        finger.position.set(x, -0.7, 0.1);
        g.add(finger);
      }
    }
  );

  addPart(
    {
      name: "Entalhe",
      note: "obriga a RAM a entrar no sentido certo",
      stage: 3,
      anchor: [0.96, -0.6, 0.14],
      explode: [0.35, -0.5, 0.7]
    },
    function (g) {
      const n = new THREE.Mesh(box(0.19, 0.3, 0.16), mat(0xf0e6cf, { roughness: 0.65 }));
      n.position.set(0.96, -0.66, 0.09);
      g.add(n);
    }
  );
}

// ---------------- modelo: 1 bit de DRAM ----------------
function buildBit() {
  addPart(
    {
      name: "Placa",
      note: "suporta o circuito do bit",
      stage: 0,
      anchor: [-0.55, -0.5, 0.2],
      explode: [0, 0, 0]
    },
    function (g) {
      const pcb = new THREE.Mesh(box(3.1, 0.16, 1.65), mat(0x2f6f4c, { roughness: 0.74 }));
      pcb.position.y = -0.58;
      g.add(pcb);
      // pistas de cobre sobre a placa
      const t1 = new THREE.Mesh(box(1.9, 0.026, 0.055), mat(0xc98b4b, { roughness: 0.4, metalness: 0.5 }));
      t1.position.set(0.1, -0.49, 0.18);
      g.add(t1);
      const t2 = new THREE.Mesh(box(1.2, 0.026, 0.055), mat(0xc98b4b, { roughness: 0.4, metalness: 0.5 }));
      t2.position.set(-0.45, -0.49, -0.2);
      t2.rotation.y = 0.5;
      g.add(t2);
    }
  );

  addPart(
    {
      name: "Transístor",
      note: "abre ou fecha a passagem da corrente",
      stage: 1,
      anchor: [-0.58, 0.02, 0.26],
      explode: [-0.7, 0.55, 0.35]
    },
    function (g) {
      const body = new THREE.Mesh(box(0.62, 0.42, 0.42), mat(0x2a2d31, { roughness: 0.55 }));
      body.position.set(-0.78, -0.18, 0);
      g.add(body);
      const tab = new THREE.Mesh(box(0.34, 0.08, 0.16), mat(0x8f969b, { roughness: 0.35, metalness: 0.5 }));
      tab.position.set(-0.78, 0.07, 0);
      g.add(tab);
      for (let i = 0; i < 3; i++) {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.34, 10), mat(0xb9bfc1, { roughness: 0.3, metalness: 0.5 }));
        leg.position.set(-0.9 + i * 0.12, -0.5, 0);
        g.add(leg);
      }
    }
  );

  addPart(
    {
      name: "Condensador",
      note: "guarda a carga que representa 0 ou 1",
      stage: 2,
      anchor: [0.7, 0.42, 0.28],
      explode: [0.55, 0.95, 0.2]
    },
    function (g) {
      const can = new THREE.Mesh(new THREE.CylinderGeometry(0.33, 0.33, 0.86, 40), mat(0xe0a13d, { roughness: 0.42 }));
      can.position.set(0.68, 0.0, 0);
      g.add(can);
      const top = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.07, 40), mat(0xc3c8c9, { roughness: 0.3, metalness: 0.55 }));
      top.position.set(0.68, 0.44, 0);
      g.add(top);
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.08, 40), mat(0x8c9294, { roughness: 0.4, metalness: 0.4 }));
      base.position.set(0.68, -0.44, 0);
      g.add(base);
      const lead = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.5, 10), mat(0xc98b4b, { roughness: 0.35, metalness: 0.55 }));
      lead.position.set(0.68, -0.72, 0);
      g.add(lead);
    }
  );

  addPart(
    {
      name: "Ligação",
      note: "leva a corrente do transístor ao condensador",
      stage: 3,
      anchor: [0.0, -0.1, 0.2],
      explode: [0, 0.15, 0.9]
    },
    function (g) {
      const wire = new THREE.Mesh(box(1.25, 0.055, 0.055), mat(0xcf7a35, { roughness: 0.34, metalness: 0.5 }));
      wire.position.set(0.05, -0.1, 0.02);
      g.add(wire);
      const lead = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.42, 10), mat(0xc98b4b, { roughness: 0.35, metalness: 0.55 }));
      lead.position.set(-0.55, -0.4, 0.02);
      g.add(lead);
    }
  );
}

// cada modelo decide se pousa numa superfície e quanto recua a câmara
const CONF = {
  cell: { floor: false, fit: 4.6, az: 0.62, pol: 1.18 },
  motor: { floor: true, floorY: -0.74, fit: 4.9, az: 1.15, pol: 1.2 },
  atom: { floor: false, fit: 4.6, az: 0.5, pol: 1.16 },
  ram: { floor: false, fit: 5.7, az: 0.78, pol: 1.24 },
  bit: { floor: true, floorY: -0.67, fit: 4.4, az: 0.72, pol: 1.2 }
};
const CONF_THIS = CONF[MODEL_ID] || CONF.cell;

const BUILDERS = { cell: buildCell, motor: buildMotor, atom: buildAtom, ram: buildRam, bit: buildBit };
const MODEL = BUILDERS[MODEL_ID] || buildCell;
MODEL();

if (!CONF_THIS.floor) scene.remove(floor);
else floor.position.y = CONF_THIS.floorY == null ? -1.42 : CONF_THIS.floorY;

// caixa de cada parte no estado montado, usada para reenquadrar a câmara
assembly.updateMatrixWorld(true);
for (let i = 0; i < parts.length; i++) {
  parts[i].userData.box = new THREE.Box3().setFromObject(parts[i]);
}

// ---------------- explode ----------------
let explodeT = 0;
let explodeTarget = 0;
let xray = false;
let spin = !INLINE;
let selected = null;

function applyExplode(t) {
  for (let i = 0; i < parts.length; i++) {
    const g = parts[i];
    const ud = g.userData;
    const s = smooth(clamp01((t - ud.stage * 0.17) / 0.55));
    g.position.copy(ud.base).addScaledVector(ud.explode, s);
    if (ud.grow) g.scale.setScalar(1 + ud.grow * s);
  }
  for (let i = 0; i < parts.length; i++) {
    const g = parts[i];
    if (!g.userData.shell) continue;
    for (let k = 0; k < g.userData.meshes.length; k++) {
      const m = g.userData.meshes[k].material;
      const base = m.userData.baseOpacity;
      m.opacity = xray ? Math.min(base, 0.13) : base;
      m.transparent = m.opacity < 0.99;
      m.depthWrite = m.opacity > 0.9;
    }
  }
}

function select(part) {
  if (selected && selected !== part) {
    selected.userData.meshes.forEach(function (m) {
      m.material.emissive.setHex(0x000000);
      m.material.emissiveIntensity = 0;
    });
  }
  selected = part;
  if (part) {
    part.userData.meshes.forEach(function (m) {
      m.material.emissive.setHex(0x35507a);
      m.material.emissiveIntensity = 0.55;
    });
  }
  post(part ? { type: "pick", name: part.userData.name, note: part.userData.note } : { type: "pick", name: "", note: "" });
  dirty = true;
  wake();
}

// ---------------- câmara ----------------
let az = 0.62;
let pol = 1.18;
let zoom = 1;
let dist = 3.4;
let fitDist = 3.4;

function resize() {
  const w = Math.max(1, host.clientWidth);
  const h = Math.max(1, host.clientHeight);
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.fov = camera.aspect < 0.95 ? 40 : 31;
  camera.updateProjectionMatrix();
  needFit = true;
  dirty = true;
    wake();
}

const target = new THREE.Vector3(0, 0, 0);

// caixa de todas as partes no estado de explosão actual
function explodeBox() {
  const box = new THREE.Box3();
  for (let i = 0; i < parts.length; i++) {
    const g = parts[i];
    const ud = g.userData;
    const s = smooth(clamp01((explodeT - ud.stage * 0.17) / 0.55));
    const k = 1 + (ud.grow || 0) * s;
    const b = ud.box;
    if (!b) continue;
    box.expandByPoint(
      new THREE.Vector3(b.min.x * k + ud.explode.x * s, b.min.y * k + ud.explode.y * s, b.min.z * k + ud.explode.z * s)
    );
    box.expandByPoint(
      new THREE.Vector3(b.max.x * k + ud.explode.x * s, b.max.y * k + ud.explode.y * s, b.max.z * k + ud.explode.z * s)
    );
  }
  if (box.isEmpty()) box.setFromObject(assembly);
  return box;
}

// afasta a câmara até a caixa caber no ecrã, com a direcção de orbita actual
const fitV = new THREE.Vector3();
function fitCamera() {
  const box = explodeBox();
  const center = box.getCenter(new THREE.Vector3());
  const dir = new THREE.Vector3(Math.sin(pol) * Math.sin(az), Math.cos(pol), Math.sin(pol) * Math.cos(az));
  const saved = camera.position.clone();
  let d = 3;
  for (let it = 0; it < 9; it++) {
    camera.position.copy(center).addScaledVector(dir, d);
    camera.lookAt(center);
    camera.updateMatrixWorld(true);
    let m = 0;
    // cantos de cada parte, não da caixa global: a caixa global exagera
    for (let pi = 0; pi < parts.length; pi++) {
      const ud = parts[pi].userData;
      const b = ud.box;
      if (!b) continue;
      const s = smooth(clamp01((explodeT - ud.stage * 0.17) / 0.55));
      const k = 1 + (ud.grow || 0) * s;
      for (let i = 0; i < 8; i++) {
        fitV
          .set(
            (i & 1 ? b.max.x : b.min.x) * k + ud.explode.x * s,
            (i & 2 ? b.max.y : b.min.y) * k + ud.explode.y * s,
            (i & 4 ? b.max.z : b.min.z) * k + ud.explode.z * s
          )
          .project(camera);
        m = Math.max(m, Math.abs(fitV.x), Math.abs(fitV.y));
      }
    }
    if (m > 0.86 && m < 0.94) break;
    if (m < 1e-4) break;
    d = Math.max(0.6, Math.min(60, (d * m) / 0.9));
  }
  camera.position.copy(saved);
  target.copy(center);
  fitDist = d * (CONF_THIS.pad || 1);
}

// ---------------- rótulos ----------------
const labelLayer = document.getElementById("labels");
const lines = document.getElementById("lines");
const pills = [];

function buildLabels() {
  for (let i = 0; i < parts.length; i++) {
    const g = parts[i];
    // na página as etiquetas são texto solto: nomes compridos não cabem ao
    // lado do modelo sem taparem tudo, por isso ficam só no painel grande
    if (INLINE && String(g.userData.name || "").length > 14) continue;
    const el = document.createElement("div");
    el.className = "pill";
    const b = document.createElement("b");
    b.textContent = g.userData.name;
    el.appendChild(b);
    labelLayer.appendChild(el);
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("class", "leader");
    lines.appendChild(line);
    const dot = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    dot.setAttribute("class", "tip");
    dot.setAttribute("r", "1.6");
    lines.appendChild(dot);
    pills.push({ g: g, el: el, line: line, dot: dot, w: 0, h: 0, x: 0, y: 0, vis: false });
  }
}

let dirty = true;
let needFit = true;
let frameHandle = 0;
function wake() {
  if (!frameHandle) {
    frameHandle = window.setTimeout(function () {
      frameHandle = requestAnimationFrame(loop);
    }, 33);
  }
}
const v = new THREE.Vector3();

function measure() {
  for (let i = 0; i < pills.length; i++) {
    const p = pills[i];
    p.w = p.el.offsetWidth;
    p.h = p.el.offsetHeight;
  }
}

const OFFSETS = [
  [1, -0.35], [1, 0.35], [-1, -0.35], [-1, 0.35],
  [0.55, -1], [-0.55, -1], [0.55, 1], [-0.55, 1],
  [1.7, -0.8], [-1.7, -0.8], [1.7, 0.8], [-1.7, 0.8]
];

function boxesOverlap(ax, ay, aw, ah, bx, by, bw, bh) {
  const ox = Math.min(ax + aw, bx + bw) - Math.max(ax, bx);
  const oy = Math.min(ay + ah, by + bh) - Math.max(ay, by);
  return ox > 0 && oy > 0 ? ox * oy : 0;
}

function placeLabels() {
  if (!pills.length) return;
  const W = host.clientWidth;
  const H = host.clientHeight;

  const box3 = new THREE.Box3().setFromObject(assembly);
  let mMinX = 1e9, mMinY = 1e9, mMaxX = -1e9, mMaxY = -1e9;
  for (let i = 0; i < 8; i++) {
    v.set(i & 1 ? box3.max.x : box3.min.x, i & 2 ? box3.max.y : box3.min.y, i & 4 ? box3.max.z : box3.min.z);
    v.project(camera);
    const sx = (v.x * 0.5 + 0.5) * W;
    const sy = (-v.y * 0.5 + 0.5) * H;
    mMinX = Math.min(mMinX, sx); mMaxX = Math.max(mMaxX, sx);
    mMinY = Math.min(mMinY, sy); mMaxY = Math.max(mMaxY, sy);
  }
  const mw = mMaxX - mMinX;
  const mh = mMaxY - mMinY;

  const placed = [];
  for (let i = 0; i < pills.length; i++) {
    const p = pills[i];
    // âncora = centro real da parte (caixa local levada a mundo). Peças ocas
    // (membrana, camadas do átomo) ficam com a âncora à mão, na superfície.
    const ud = p.g.userData;
    const b = ud.box;
    const anchor =
      b && !ud.shell && !ud.grow
        ? b.getCenter(new THREE.Vector3()).applyMatrix4(p.g.matrixWorld)
        : ud.anchor.clone().applyMatrix4(p.g.matrixWorld);
    const proj = anchor.clone().project(camera);
    const behind = proj.z > 1;
    const ax = (proj.x * 0.5 + 0.5) * W;
    const ay = (-proj.y * 0.5 + 0.5) * H;

    if (behind || ax < -80 || ax > W + 80) {
      p.el.style.opacity = "0";
      p.line.style.opacity = "0";
      p.dot.style.opacity = "0";
      p.vis = false;
      continue;
    }

    let best = null;
    for (let c = 0; c < OFFSETS.length; c++) {
      const off = OFFSETS[c];
      const px = ax + off[0] * (26 + p.w * 0.5) - (off[0] > 0 ? 0 : p.w);
      const py = ay + off[1] * (18 + p.h * 0.5) - p.h * 0.5;
      const x = Math.max(6, Math.min(W - p.w - 6, px));
      const y = Math.max(6, Math.min(H - p.h - 6, py));
      let sc = 0;
      // rótulos nunca se sobrepõem uns aos outros: isso vale mais do que tudo
      for (let k = 0; k < placed.length; k++) sc += boxesOverlap(x, y, p.w, p.h, placed[k][0], placed[k][1], placed[k][2], placed[k][3]) * 60;
      sc += boxesOverlap(x, y, p.w, p.h, mMinX, mMinY, mw, mh) * 2.4;
      sc += (Math.abs(x - px) + Math.abs(y - py)) * 1.5;
      sc += Math.hypot(x + p.w / 2 - ax, y + p.h / 2 - ay) * 0.5;
      if (!best || sc < best.sc) best = { x: x, y: y, sc: sc };
    }

    p.x = best.x;
    p.y = best.y;
    p.el.style.transform = "translate(" + best.x + "px," + best.y + "px)";
    // a largura medida pode enganar (fonte manuscrita): corrige pela caixa real
    const r0 = p.el.getBoundingClientRect();
    if (r0.right > W - 6) p.x -= r0.right - (W - 6);
    if (r0.left < 6) p.x += 6 - r0.left;
    if (r0.bottom > H - 8) p.y -= r0.bottom - (H - 8);
    if (r0.top < 6) p.y += 6 - r0.top;
    if (p.x !== best.x || p.y !== best.y) {
      p.el.style.transform = "translate(" + p.x + "px," + p.y + "px)";
    }
    p.el.style.opacity = "1";

    placed.push([p.x, p.y, p.w, p.h]);

    // linha do centro do rótulo até à âncora, a acabar na borda do rótulo
    const ex = Math.max(p.x, Math.min(p.x + p.w, ax));
    const ey = Math.max(p.y, Math.min(p.y + p.h, ay));
    p.line.setAttribute("x1", String(ex));
    p.line.setAttribute("y1", String(ey));
    p.line.setAttribute("x2", String(ax));
    p.line.setAttribute("y2", String(ay));
    p.line.style.opacity = "1";
    p.dot.setAttribute("cx", String(ax));
    p.dot.setAttribute("cy", String(ay));
    p.dot.style.opacity = "1";
    p.vis = true;
  }
}

// ---------------- toque ----------------
const pointers = new Map();
let dragging = false;
let moved = 0;
let pinch = 0;
let lastTap = 0;

function ndc(e) {
  const r = renderer.domElement.getBoundingClientRect();
  return new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
}

function pick(e) {
  const ray = new THREE.Raycaster();
  ray.setFromCamera(ndc(e), camera);
  const hits = ray.intersectObjects(assembly.children, true);
  // as cascas (membrana, carcaça) engoliam tudo: escolhe primeiro o que está dentro
  let hit = null;
  for (let i = 0; i < hits.length && !hit; i++) {
    let o = hits[i].object;
    while (o && parts.indexOf(o) < 0) o = o.parent;
    if (o && !o.userData.shell) hit = o;
  }
  if (!hit) {
    for (let i = 0; i < hits.length && !hit; i++) {
      let o = hits[i].object;
      while (o && parts.indexOf(o) < 0) o = o.parent;
      if (o) hit = o;
    }
  }
  select(!hit || hit === selected ? null : hit);
}

host.addEventListener("pointerdown", function (e) {
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  dragging = true;
  moved = 0;
  spin = false;
  hint.style.opacity = "0";
  if (pointers.size === 2) {
    const it = Array.from(pointers.values());
    pinch = Math.hypot(it[0].x - it[1].x, it[0].y - it[1].y);
  }
  host.setPointerCapture && host.setPointerCapture(e.pointerId);
});

host.addEventListener("pointermove", function (e) {
  const p = pointers.get(e.pointerId);
  if (!p) return;
  const dx = e.clientX - p.x;
  const dy = e.clientY - p.y;
  p.x = e.clientX;
  p.y = e.clientY;
  moved += Math.abs(dx) + Math.abs(dy);
  if (pointers.size === 1) {
    az -= dx * 0.0085;
    pol = Math.max(0.32, Math.min(2.86, pol - dy * 0.0062));
    dirty = true;
    wake();
  } else if (pointers.size === 2) {
    const it = Array.from(pointers.values());
    const d = Math.hypot(it[0].x - it[1].x, it[0].y - it[1].y);
    if (pinch) zoom = Math.max(0.55, Math.min(2.6, zoom * (pinch / Math.max(1, d))));
    pinch = d;
    dirty = true;
    wake();
  }
});

function up(e) {
  const wasSingle = pointers.size === 1;
  pointers.delete(e.pointerId);
  if (pointers.size === 0) {
    dragging = false;
    if (wasSingle && moved < 8 && Date.now() - lastTap > 250) {
      lastTap = Date.now();
      pick(e);
    }
    pinch = 0;
  }
}
host.addEventListener("pointerup", up);
host.addEventListener("pointercancel", up);
host.addEventListener("wheel", function (e) {
  e.preventDefault();
  zoom = Math.max(0.55, Math.min(2.6, zoom * (1 + e.deltaY * 0.0012)));
  dirty = true;
    wake();
}, { passive: false });

// ---------------- ciclo ----------------
const hint = document.getElementById("hint");
const clock = new THREE.Clock();

function post(obj) {
  if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(obj));
}
window.addEventListener("error", function () {
  post({ type: "error", message: "não consegui abrir o modelo 3D" });
});

let frames = 0;
function loop() {
  frameHandle = 0;
  const dt = Math.min(0.05, clock.getDelta());

  if (explodeTarget !== explodeT) {
    explodeT += (explodeTarget - explodeT) * Math.min(1, dt * 5.2);
    if (Math.abs(explodeTarget - explodeT) < 0.002) explodeT = explodeTarget;
    applyExplode(explodeT);
    needFit = true;
    dirty = true;
    wake();
  }
  if (spin && !dragging) {
    az += dt * 0.16;
    dirty = true;
    wake();
  }

  // reenquadra sempre que a explosão muda, para nada sair do ecrã
  if (needFit) {
    fitCamera();
    needFit = false;
    dirty = true;
    wake();
  }
  // Quando a rotação está parada, só redesenha depois de uma alteração.
  // Evita renderizar a mesma imagem 60 vezes por segundo no painel 3D.
  if (dirty) {
    dist = fitDist * zoom;
    camera.position.set(
      target.x + dist * Math.sin(pol) * Math.sin(az),
      target.y + dist * Math.cos(pol),
      target.z + dist * Math.sin(pol) * Math.cos(az)
    );
    camera.lookAt(target);
    renderer.render(scene, camera);
    placeLabels();
    dirty = false;
  }
  frames++;
  if (frames === 1) {
    const boot = document.getElementById("boot");
    if (boot) {
      boot.style.opacity = "0";
      setTimeout(function () { if (boot) boot.style.display = "none"; }, 400);
    }
    post({ type: "ready" });
  }
  if (spin || Math.abs(explodeTarget - explodeT) > 0.002) wake();
}
wake();

// ---------------- api ----------------
window.__setExplode = function (t) {
  explodeTarget = clamp01(Number(t) || 0);
  spin = false;
  dirty = true;
    wake();
};
window.__setXray = function (on) {
  xray = !!on;
  applyExplode(explodeT);
  dirty = true;
    wake();
};
window.__setSpin = function (on) {
  spin = !!on;
  dirty = true;
    wake();
};
window.__reset = function () {
  az = CONF_THIS.az != null ? CONF_THIS.az : 0.62;
  pol = CONF_THIS.pol != null ? CONF_THIS.pol : 1.18;
  zoom = 1; dist = fitDist;
  select(null);
  dirty = true;
    wake();
};

let rt = null;
window.addEventListener("resize", function () {
  clearTimeout(rt);
  rt = setTimeout(function () {
    resize();
    measure();
  }, 80);
});

if (CONF_THIS.az != null) az = CONF_THIS.az;
if (CONF_THIS.pol != null) pol = CONF_THIS.pol;

// estados fixos por query string, para fotografar a cena fora do telemóvel
const qs = new URLSearchParams(location.search);
if (qs.get("explode")) explodeT = explodeTarget = clamp01(Number(qs.get("explode")));
if (qs.get("xray")) xray = true;
if (qs.get("spin") === "0") spin = false;
if (qs.get("plain") === "1") {
  const hidden = ["labels", "lines", "hint"];
  for (let i = 0; i < hidden.length; i++) {
    const el = document.getElementById(hidden[i]);
    if (el) el.style.display = "none";
  }
}

buildLabels();
resize();
measure();
applyExplode(explodeT);
setTimeout(measure, 300);
if (document.fonts && document.fonts.ready) {
  document.fonts.ready.then(function () {
    measure();
    dirty = true;
    wake();
  });
}
`;

export type ModelMode = "inline" | "modal";

export function buildModelHtml(model: ModelId, mode: ModelMode = "modal"): string {
  const inline = mode === "inline";
  const js = SCENE_JS.replace("__MODEL__", model).replace(
    "__INLINE__",
    inline ? "true" : "false",
  );
  const font = inline ? 10.5 : 13.5;
  const lineH = inline ? 14 : 17;
  const padV = inline ? 3 : 4;
  const padH = inline ? 7 : 10;
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
  #lines { position:absolute; inset:0; width:100%; height:100%; pointer-events:none; }
  .leader { stroke:#5b5f68; stroke-width:0.9; opacity:0; }
  .tip { fill:#5b5f68; opacity:0; }
  #labels { position:absolute; inset:0; pointer-events:none; }
  .pill {
    position:absolute; top:0; left:0; opacity:0;
    padding:${padV}px ${padH}px; border-radius:999px;
    background:rgba(255,253,246,0.95);
    border:1px solid rgba(45,47,54,0.32);
    box-shadow:0 1px 2px rgba(60,55,40,0.10);
    font-family:"Bradley Hand","Chalkboard SE","Marker Felt",-apple-system,cursive;
    font-size:${font}px; line-height:${lineH}px; color:#23242a; white-space:nowrap;
    letter-spacing:0.1px;
    transition:opacity .18s ease;
  }
  .pill b { font-weight:700; }
  ${
    inline
      ? `.pill {
    padding:1px 2px; border-radius:0; background:transparent;
    border-color:transparent; box-shadow:none;
    text-shadow:0 1px 0 rgba(255,253,246,0.85);
  }
  .pill b { font-weight:500; }`
      : ""
  }
  #hint {
    position:absolute; left:0; right:0; bottom:6px; text-align:center;
    font-family:-apple-system,system-ui,sans-serif; font-size:11px; letter-spacing:0.2px;
    color:#9aa0ad; pointer-events:none; transition:opacity .5s ease;
    ${inline ? "display:none;" : ""}
  }
  #boot {
    position:absolute; inset:0; display:flex; align-items:center; justify-content:center;
    font-family:-apple-system,system-ui,sans-serif; font-size:12.5px; color:#9aa0ad;
    pointer-events:none; transition:opacity .4s ease;
  }
</style>
</head>
<body>
<div id="stage"></div>
<svg id="lines"></svg>
<div id="labels"></div>
<div id="hint">arrasta para rodar · belisca para aproximar · toca numa parte</div>
<div id="boot">a preparar o modelo…</div>
<script type="importmap">
{ "imports": { "three": "https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.js" } }
</script>
<script type="module">
${js}
</script>
<script>
  setTimeout(function () {
    var b = document.getElementById("boot");
    if (b && b.style.opacity !== "0") {
      b.textContent = "sem ligação — o modelo precisa de internet na primeira vez";
      b.style.color = "#b06a5f";
    }
  }, 9000);
</script>
</body>
</html>`;
}

// Cena para um GLB remoto da Poly Pizza.
// Duas utilizações:
//   "inline" — pré-visualização estática e leve dentro da página
//   "modal"  — painel grande, com rotação, arrasto e pinça
// As etiquetas são coladas ao modelo: são projectadas a partir da caixa 3D e
// acompanham a rotação, com uma linha-guia até à peça.
export type PolyMode = "inline" | "modal";

export function buildPolyHtml(
  glb: string,
  labels: string[] = [],
  mode: PolyMode = "modal",
): string {
  const url = JSON.stringify(glb);
  const labelJson = JSON.stringify((labels || []).filter(Boolean).slice(0, 4));
  const inline = mode === "inline";
  const font = inline ? 11.5 : 13.5;
  const lineH = inline ? 14.5 : 17;
  const padV = inline ? 3 : 4;
  const padH = inline ? 7 : 10;
  const pillMax = inline ? 46 : 38;
  const spinSpeed = inline ? 0.42 : 0.33;
  const fitPad = inline ? 1.28 : 1.14;
  return `<!DOCTYPE html>
<html lang="pt">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover"/>
<style>
  html, body { margin:0; padding:0; height:100%; background:transparent; overflow:hidden; }
  body { -webkit-user-select:none; user-select:none; -webkit-tap-highlight-color:transparent; }
  #shadow {
    position:absolute; left:50%; bottom:5%; width:54%; height:10%;
    transform:translateX(-50%);
    background:radial-gradient(closest-side, rgba(70,62,45,0.25), rgba(70,62,45,0));
    filter:blur(3px); opacity:0; transition:opacity .5s ease; pointer-events:none;
  }
  #stage { position:absolute; inset:0; touch-action:none; }
  #stage canvas { display:block; width:100% !important; height:100% !important; }
  #lines { position:absolute; inset:0; width:100%; height:100%; pointer-events:none; overflow:visible; }
  #labels { position:absolute; inset:0; pointer-events:none; }
  .pill {
    position:absolute; top:0; left:0; opacity:0;
    max-width:${pillMax}%;
    padding:${padV}px ${padH}px;
    border-radius:9px;
    background:rgba(255,253,246,0.94);
    border:1px solid rgba(45,47,54,0.30);
    box-shadow:0 1px 3px rgba(60,55,40,0.13);
    font-family:"Bradley Hand","Chalkboard SE","Marker Felt",-apple-system,cursive;
    font-size:${font}px; line-height:${lineH}px; color:#23242a;
    white-space:normal; text-align:left; word-break:break-word;
    letter-spacing:0.1px;
    transition:opacity .2s ease;
  }
  #hint {
    position:absolute; left:0; right:0; bottom:6px; text-align:center;
    font-family:-apple-system,system-ui,sans-serif; font-size:11px; letter-spacing:0.2px;
    color:#9aa0ad; pointer-events:none;
  }
  #boot {
    position:absolute; inset:0; display:flex; align-items:center; justify-content:center;
    font-family:-apple-system,system-ui,sans-serif; font-size:12.5px; color:#9aa0ad;
    pointer-events:none; transition:opacity .4s ease;
  }
</style>
</head>
<body>
<div id="shadow"></div>
<div id="stage"></div>
<svg id="lines"></svg>
<div id="labels"></div>
${inline ? "" : `<div id="hint">arrasta para rodar · belisca para aproximar · toca nas etiquetas</div>
<div id="boot">a carregar o modelo…</div>`}
<script type="importmap">
{ "imports": {
  "three": "https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.js",
  "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.169.0/examples/jsm/"
} }
</script>
<script type="module">
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const GLB_URL = ${url};
const LABELS = ${labelJson};
const INLINE = ${inline ? "true" : "false"};
const SPIN_SPEED = ${spinSpeed};
const FIT_PAD = ${fitPad};
const post = function (m) {
  try { window.ReactNativeWebView.postMessage(JSON.stringify(m)); } catch (e) {}
};
const clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };

const stage = document.getElementById("stage");
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, INLINE ? 1 : 1.5));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.02;
stage.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(36, 1, 0.05, 120);

scene.add(new THREE.HemisphereLight(0xfffdf2, 0x8d887a, 1.2));
const key = new THREE.DirectionalLight(0xffffff, 1.8);
key.position.set(3.5, 6, 4.5);
scene.add(key);
const fill = new THREE.DirectionalLight(0xffffff, 0.55);
fill.position.set(-5, 2, -4);
scene.add(fill);
const rim = new THREE.DirectionalLight(0xffffff, 0.55);
rim.position.set(0, -3, -6);
scene.add(rim);

let az = 0.72, pol = 1.18, zoom = 1, fitDist = 5, radius = 0;
let spin = !INLINE, dirty = true, dragging = false, needLayout = true;
let holder = null, boxLocal = null;
let frameHandle = 0;
function wake() {
  if (!frameHandle) frameHandle = requestAnimationFrame(frame);
}
const look = new THREE.Vector3(0, 0, 0);

// ---- etiquetas coladas ao modelo ----
const labelsEl = document.getElementById("labels");
const linesEl = document.getElementById("lines");
const pills = [];
const lineEls = [];
LABELS.forEach(function (text) {
  const p = document.createElement("div");
  p.className = "pill";
  p.textContent = text;
  labelsEl.appendChild(p);
  pills.push(p);
  const ln = document.createElementNS("http://www.w3.org/2000/svg", "line");
  ln.setAttribute("stroke", "#6d716a");
  ln.setAttribute("stroke-width", INLINE ? "0.9" : "1");
  ln.setAttribute("stroke-linecap", "round");
  ln.setAttribute("opacity", "0");
  linesEl.appendChild(ln);
  lineEls.push(ln);
});

const _corner = new THREE.Vector3();
// amostras da superfície do modelo, para as linhas-guia tocarem mesmo na peça
let samplePts = [];
const placed = [];
const anchors = [];

function collectSamples() {
  samplePts = [];
  if (!holder) return;
  holder.updateMatrixWorld(true);
  const meshes = [];
  let total = 0;
  holder.traverse(function (o) {
    if (!o.isMesh || !o.geometry || !o.geometry.attributes) return;
    const pos = o.geometry.attributes.position;
    if (!pos) return;
    meshes.push(o);
    total += pos.count;
  });
  const stride = Math.max(1, Math.ceil(total / 1500));
  const v = new THREE.Vector3();
  for (let m = 0; m < meshes.length; m++) {
    const o = meshes[m];
    const pos = o.geometry.attributes.position;
    for (let i = 0; i < pos.count; i += stride) {
      v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
      samplePts.push(v.clone());
    }
    if (samplePts.length > 2400) break;
  }
}

// caixa do modelo projectada no ecrã; é ela que segura as etiquetas
function projectBox() {
  if (!holder || !boxLocal) return null;
  holder.updateMatrixWorld(true);
  const W = stage.clientWidth || 1;
  const H = stage.clientHeight || 1;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (let i = 0; i < 8; i++) {
    _corner.set(
      (i & 1) ? boxLocal.max.x : boxLocal.min.x,
      (i & 2) ? boxLocal.max.y : boxLocal.min.y,
      (i & 4) ? boxLocal.max.z : boxLocal.min.z,
    );
    holder.localToWorld(_corner);
    _corner.project(camera);
    const px = (_corner.x * 0.5 + 0.5) * W;
    const py = (-_corner.y * 0.5 + 0.5) * H;
    if (px < x0) x0 = px;
    if (px > x1) x1 = px;
    if (py < y0) y0 = py;
    if (py > y1) y1 = py;
  }
  return {
    x0: Math.max(0, x0), y0: Math.max(0, y0),
    x1: Math.min(W, x1), y1: Math.min(H, y1),
    w: W, h: H,
  };
}

function placeSide(list, b, dir, gap) {
  if (!list.length) return;
  const H = b.h;
  const top = Math.max(4, b.y0 + 2);
  const bottom = Math.min(H - 4, b.y1 - 2);
  const span = Math.max(24, bottom - top);
  // a ordem das etiquetas segue o modelo de cima para baixo, não a coluna
  const ys = list.map(function (p) {
    const order = pills.indexOf(p);
    const center = top + span * ((order + 1) / (pills.length + 1));
    return center - p.offsetHeight / 2;
  });
  for (let i = 1; i < list.length; i++) {
    ys[i] = Math.max(ys[i], ys[i - 1] + list[i - 1].offsetHeight + 3);
  }
  const last = list[list.length - 1];
  const over = ys[ys.length - 1] + last.offsetHeight - (H - 4);
  if (over > 0) {
    for (let i = 0; i < ys.length; i++) ys[i] = Math.max(4, ys[i] - over);
  }
  for (let i = 0; i < list.length; i++) {
    const p = list[i];
    const w = p.offsetWidth;
    let x = dir < 0 ? b.x0 - gap - w : b.x1 + gap;
    x = Math.max(4, Math.min(b.w - w - 4, x));
    p.style.transform = "translate(" + x.toFixed(1) + "px," + ys[i].toFixed(1) + "px)";
    p.style.opacity = "1";
    placed[pills.indexOf(p)] = {
      x: x,
      y: ys[i],
      w: w,
      h: p.offsetHeight,
      cy: ys[i] + p.offsetHeight / 2,
      side: dir,
    };
  }
}

// escolhe, para cada etiqueta, o ponto mais exterior da silhueta à altura dela;
// a linha-guia fica assim encostada ao modelo e acompanha a rotação
function setLines(b) {
  const H = b.h;
  const band = Math.max(7, H * 0.05);
  const targets = placed.map(function (p) {
    return p ? { x: p.side < 0 ? Infinity : -Infinity, y: p.cy, hit: false } : null;
  });

  if (samplePts.length && holder) {
    holder.updateMatrixWorld(true);
    for (let k = 0; k < samplePts.length; k++) {
      _corner.copy(samplePts[k]).applyMatrix4(holder.matrixWorld).project(camera);
      if (!isFinite(_corner.x) || !isFinite(_corner.y)) continue;
      const px = (_corner.x * 0.5 + 0.5) * b.w;
      const py = (-_corner.y * 0.5 + 0.5) * H;
      for (let i = 0; i < placed.length; i++) {
        const p = placed[i];
        const t = targets[i];
        if (!p || !t) continue;
        if (py < b.y0 - 2 || py > b.y1 + 2) continue;
        if (Math.abs(py - p.cy) > band) continue;
        if (p.side < 0) {
          if (px < t.x) { t.x = px; t.y = py; t.hit = true; }
        } else {
          if (px > t.x) { t.x = px; t.y = py; t.hit = true; }
        }
      }
    }
  }

  for (let i = 0; i < placed.length; i++) {
    const p = placed[i];
    const line = lineEls[i];
    if (!p || !line) continue;
    const t = targets[i];
    const fallbackX = p.side < 0 ? b.x0 : b.x1;
    const targetX = t && t.hit ? t.x : fallbackX;
    const prev = anchors[i];
    const ax = prev == null ? targetX : prev + (targetX - prev) * 0.42;
    anchors[i] = ax;
    const fromX = p.side < 0 ? p.x + p.w : p.x;
    const fromY = p.cy;
    const toY = clamp(t && t.hit ? t.y : fromY, b.y0 + 1, b.y1 - 1);
    line.setAttribute("x1", fromX.toFixed(1));
    line.setAttribute("y1", fromY.toFixed(1));
    line.setAttribute("x2", clamp(ax, 2, b.w - 2).toFixed(1));
    line.setAttribute("y2", toY.toFixed(1));
    line.setAttribute("opacity", "0.72");
  }
}

function layoutLabels() {
  if (!pills.length) return;
  const b = projectBox();
  if (!b) return;
  const gap = INLINE ? 6 : 10;
  const left = [], right = [];
  pills.forEach(function (p, i) { (i % 2 === 0 ? left : right).push(p); });
  placed.length = 0;
  placeSide(left, b, -1, gap);
  placeSide(right, b, 1, gap);
  setLines(b);
}

function place() {
  const d = Math.max(0.6, fitDist * zoom);
  const sp = Math.sin(pol), cp = Math.cos(pol);
  camera.position.set(d * sp * Math.sin(az), d * cp, d * sp * Math.cos(az));
  camera.lookAt(look);
  dirty = true;
  wake();
}

function fit() {
  const v = camera.fov * Math.PI / 180;
  const h = 2 * Math.atan(Math.tan(v / 2) * camera.aspect);
  const half = Math.min(v, h) / 2;
  if (radius > 0 && half > 0.01) fitDist = (radius / Math.sin(half)) * FIT_PAD;
}

function resize() {
  const w = stage.clientWidth || 1;
  const h = stage.clientHeight || 1;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  fit();
  place();
}

window.__setSpin = function (on) { spin = !!on; wake(); };
window.__setExplode = function () { /* modelo remoto não tem partes */ };
window.__setXray = function () { /* nem raios X */ };
window.__reset = function () {
  az = 0.72; pol = 1.18; zoom = 1;
  if (holder) holder.rotation.y = 0;
  place();
};

new GLTFLoader().load(
  GLB_URL,
  function (gltf) {
    const root = gltf.scene;
    root.traverse(function (o) {
      if (o.isMesh) {
        o.frustumCulled = false;
        if (o.material && "envMapIntensity" in o.material) o.material.envMapIntensity = 0.85;
      }
    });

    // normaliza: centro na origem, maior dimensão = 2.4
    const norm = new THREE.Group();
    norm.add(root);
    holder = new THREE.Group();
    holder.add(norm);
    scene.add(holder);

    const box = new THREE.Box3().setFromObject(root);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    const k = 2.4 / maxDim;
    norm.scale.setScalar(k);
    norm.position.copy(center).multiplyScalar(-k);
    norm.updateMatrixWorld(true);

    const box2 = new THREE.Box3().setFromObject(norm);
    boxLocal = { min: box2.min.clone(), max: box2.max.clone() };
    collectSamples();
    const sph = box2.getBoundingSphere(new THREE.Sphere());
    radius = Math.max(0.4, sph.radius);
    look.copy(box2.getCenter(new THREE.Vector3()));
    fit();
    place();

    const shadow = document.getElementById("shadow");
    if (shadow) shadow.style.opacity = "1";
    const boot = document.getElementById("boot");
    if (boot) {
      boot.style.opacity = "0";
      setTimeout(function () { boot.style.display = "none"; }, 400);
    }
    window.__polyReady = true;
    needLayout = true;
    dirty = true;
    post({ type: "ready" });
  },
  undefined,
  function () {
    window.__polyReady = true;
    post({ type: "error", message: "não consegui descarregar o modelo" });
  },
);

// ---- toque (só o painel grande usa; na página o toque está desligado) ----
const el = renderer.domElement;
let lx = 0, ly = 0, pinch0 = 0, zoom0 = 1;

el.addEventListener("touchstart", function (e) {
  dragging = true;
  if (e.touches.length === 2) {
    drag = false;
    pinch0 = Math.hypot(
      e.touches[0].clientX - e.touches[1].clientX,
      e.touches[0].clientY - e.touches[1].clientY,
    );
    zoom0 = zoom;
  } else if (e.touches.length === 1) {
    drag = true;
    pinch0 = 0;
    lx = e.touches[0].clientX;
    ly = e.touches[0].clientY;
  }
  e.preventDefault();
}, { passive: false });

el.addEventListener("touchmove", function (e) {
  if (e.touches.length >= 2 && pinch0 > 0) {
    const d = Math.hypot(
      e.touches[0].clientX - e.touches[1].clientX,
      e.touches[0].clientY - e.touches[1].clientY,
    );
    zoom = clamp((zoom0 * pinch0) / Math.max(1, d), 0.4, 3.2);
    place();
  } else if (drag && e.touches.length === 1) {
    const t = e.touches[0];
    az -= (t.clientX - lx) * 0.009;
    pol = clamp(pol - (t.clientY - ly) * 0.007, 0.32, 2.78);
    lx = t.clientX;
    ly = t.clientY;
    place();
  }
  e.preventDefault();
}, { passive: false });

el.addEventListener("touchend", function (e) {
  if (e.touches.length === 0) {
    drag = false;
    dragging = false;
    pinch0 = 0;
  } else if (e.touches.length === 1) {
    drag = true;
    pinch0 = 0;
    lx = e.touches[0].clientX;
    ly = e.touches[0].clientY;
  }
}, { passive: false });

// rato, para a pré-visualização no browser
el.addEventListener("mousedown", function (e) {
  dragging = true;
  lx = e.clientX;
  ly = e.clientY;
});
window.addEventListener("mousemove", function (e) {
  if (!dragging) return;
  az -= (e.clientX - lx) * 0.009;
  pol = clamp(pol - (e.clientY - ly) * 0.007, 0.32, 2.78);
  lx = e.clientX;
  ly = e.clientY;
  place();
});
window.addEventListener("mouseup", function () { dragging = false; });
el.addEventListener("wheel", function (e) {
  zoom = clamp(zoom * (1 + e.deltaY * 0.0012), 0.4, 3.2);
  place();
  e.preventDefault();
}, { passive: false });

let rt = null;
window.addEventListener("resize", function () {
  clearTimeout(rt);
  rt = setTimeout(resize, 80);
});

let last = 0;
function frame(t) {
  frameHandle = 0;
  const now = Number.isFinite(t) ? t : 0;
  const dt = last ? Math.min(0.1, Math.max(0, (now - last) / 1000)) : 0;
  last = now;
  if (holder && spin && !dragging) {
    holder.rotation.y += SPIN_SPEED * dt;
    dirty = true;
  }
  if (dirty) {
    renderer.render(scene, camera);
    dirty = false;
    needLayout = true;
  }
  if (needLayout) {
    layoutLabels();
    needLayout = false;
  }
  // Inline previews stay still. The full-screen model rotates at ~30 fps.
  if (spin && !INLINE) {
    frameHandle = window.setTimeout(function () {
      frameHandle = 0;
      wake();
    }, 33);
  }
}

resize();
place();
wake();
</script>
<script>
  // se o CDN ou o GLB não responderem, o painel mostra o erro em vez de ficar
  // eternamente a carregar
  setTimeout(function () {
    if (window.__polyReady) return;
    var b = document.getElementById("boot");
    if (b) {
      b.textContent = "sem ligação — o modelo precisa de internet";
      b.style.color = "#b06a5f";
    }
    try {
      window.ReactNativeWebView.postMessage(
        JSON.stringify({ type: "error", message: "não consegui carregar o modelo" }),
      );
    } catch (e) {}
  }, 12000);
</script>
</body>
</html>`;
}
