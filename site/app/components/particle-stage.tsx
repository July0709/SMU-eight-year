"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

/* ------------------------------------------------------------
   Particle stage — a fixed full-screen Three.js point cloud that
   continuously morphs between organ shapes as the page scrolls.
   Chapters are anchored to real section offsets ([data-chapter]).
   ------------------------------------------------------------ */

type ShapeName = "heart" | "scatter" | "lungs" | "stomach" | "brain" | "bulb";
type Align = "left" | "right" | "center";

// One entry per [data-chapter] section, in document order.
const CHAPTERS: { shape: ShapeName; align: Align }[] = [
  { shape: "heart", align: "right" }, // 0 hero
  { shape: "scatter", align: "center" }, // 1 fragment
  { shape: "heart", align: "right" }, // 2 循环系统（文字在左）
  { shape: "lungs", align: "left" }, // 3 呼吸系统（文字在右）
  { shape: "stomach", align: "right" }, // 4 消化系统（文字在左）
  { shape: "brain", align: "left" }, // 5 临床技能（文字在右）
  { shape: "bulb", align: "center" }, // 6 照亮
];

const PALETTE = ["#8052ff", "#ffb829", "#31d6b5", "#d65cff", "#4f8cff"];
const ALIGN_X: Record<Align, number> = { left: -0.98, right: 0.88, center: 0 };

const smooth = (v: number) => v * v * (3 - 2 * v);

// Deterministic PRNG so shapes are stable across reloads.
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Uniform random direction on the unit sphere.
function sphereDir(rand: () => number): [number, number, number] {
  const z = rand() * 2 - 1;
  const phi = rand() * Math.PI * 2;
  const r = Math.sqrt(Math.max(0, 1 - z * z));
  return [r * Math.cos(phi), r * Math.sin(phi), z];
}

function sampleHeart(n: number, rand: () => number) {
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2;
    const x = (16 * Math.sin(t) ** 3) / 17;
    const y =
      (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) / 17;
    const z = (rand() - 0.5) * 0.4 * (1 - Math.abs(y) * 0.5);
    arr[i * 3] = x * 0.88;
    arr[i * 3 + 1] = y * 0.88; // +y is up in Three.js: lobes up, apex down
    arr[i * 3 + 2] = z;
  }
  return arr;
}

function sampleLungs(n: number, rand: () => number) {
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const u = rand();
    let x = 0;
    let y = 0;
    let z = 0;
    if (u < 0.85) {
      // Two lung lobes: ellipsoid surfaces, left one slightly smaller.
      const side = i % 2 === 0 ? -1 : 1;
      const shrink = side === -1 ? 0.94 : 1;
      const [dx, dy, dz] = sphereDir(rand);
      x = side * 0.38 + dx * 0.34 * shrink;
      y = 0.02 + dy * 0.58 * shrink;
      z = dz * 0.3 * shrink;
    } else if (u < 0.93) {
      // Trachea: thin vertical cylinder.
      const phi = rand() * Math.PI * 2;
      x = Math.cos(phi) * 0.05;
      y = 0.5 + rand() * 0.45;
      z = Math.sin(phi) * 0.05;
    } else {
      // Two bronchi splitting down-left / down-right.
      const side = i % 2 === 0 ? -1 : 1;
      const t = rand();
      const phi = rand() * Math.PI * 2;
      x = side * 0.25 * t + Math.cos(phi) * 0.035;
      y = 0.5 - 0.2 * t + Math.sin(phi) * 0.02;
      z = Math.sin(phi) * 0.035;
    }
    arr[i * 3] = x;
    arr[i * 3 + 1] = y;
    arr[i * 3 + 2] = z;
  }
  return arr;
}

function sampleStomach(n: number, rand: () => number) {
  const arr = new Float32Array(n * 3);
  const TH0 = -0.55 * Math.PI;
  const TH1 = 0.75 * Math.PI;
  const R = 0.5;
  for (let i = 0; i < n; i++) {
    let x = 0;
    let y = 0;
    let z = 0;
    if (rand() < 0.88) {
      // J-shaped curved tube; radius tapers from fundus (top) to pylorus (bottom).
      const u = rand();
      const th = TH0 + u * (TH1 - TH0);
      const r = 0.13 + 0.07 * u;
      const phi = rand() * Math.PI * 2;
      const nx = Math.cos(th);
      const ny = Math.sin(th);
      x = R * nx + r * Math.cos(phi) * nx;
      y = R * ny + r * Math.cos(phi) * ny;
      z = r * Math.sin(phi);
    } else {
      // Cardia: short upward extension at the top end.
      const cx = R * Math.cos(TH1);
      const cy = R * Math.sin(TH1);
      const t = rand();
      const r = 0.09 - 0.02 * t;
      const phi = rand() * Math.PI * 2;
      x = cx + 0.1 * t + Math.cos(phi) * r;
      y = cy + 0.3 * t;
      z = Math.sin(phi) * r;
    }
    arr[i * 3] = x;
    arr[i * 3 + 1] = y;
    arr[i * 3 + 2] = z;
  }
  // Re-center around the origin.
  let mx = 0;
  let my = 0;
  let mz = 0;
  for (let i = 0; i < n; i++) {
    mx += arr[i * 3];
    my += arr[i * 3 + 1];
    mz += arr[i * 3 + 2];
  }
  mx /= n;
  my /= n;
  mz /= n;
  for (let i = 0; i < n; i++) {
    arr[i * 3] -= mx;
    arr[i * 3 + 1] -= my;
    arr[i * 3 + 2] -= mz;
  }
  return arr;
}

function sampleBrain(n: number, rand: () => number) {
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const u = rand();
    let x = 0;
    let y = 0;
    let z = 0;
    if (u < 0.85) {
      // Cerebrum ellipsoid with a longitudinal fissure.
      const [dx, dy, dz] = sphereDir(rand);
      x = dx * 0.58;
      y = dy * 0.44;
      z = dz * 0.46;
      if (Math.abs(x) < 0.06) x = (x < 0 ? -1 : 1) * (0.06 + rand() * 0.05);
    } else {
      // Cerebellum tucked under the back.
      const [dx, dy, dz] = sphereDir(rand);
      x = dx * 0.22;
      y = -0.38 + dy * 0.14;
      z = -0.22 + dz * 0.18;
    }
    // Slight gyri wrinkle noise.
    arr[i * 3] = x + (rand() - 0.5) * 0.04;
    arr[i * 3 + 1] = y + (rand() - 0.5) * 0.04;
    arr[i * 3 + 2] = z + (rand() - 0.5) * 0.04;
  }
  return arr;
}

function sampleBulb(n: number, rand: () => number) {
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const u = rand();
    let x = 0;
    let y = 0;
    let z = 0;
    if (u < 0.72) {
      // Glass globe: sphere with the bottom cap cut off.
      let dy = 0;
      let dx = 0;
      let dz = 0;
      do {
        [dx, dy, dz] = sphereDir(rand);
      } while (dy < -0.55);
      x = dx * 0.46;
      y = 0.18 + dy * 0.46;
      z = dz * 0.46;
    } else if (u < 0.8) {
      // Neck: cone from globe rim down to the screw base.
      const t = rand();
      const phi = rand() * Math.PI * 2;
      const r = 0.384 + (0.17 - 0.384) * t;
      x = Math.cos(phi) * r;
      y = -0.07 + (-0.3 - -0.07) * t;
      z = Math.sin(phi) * r;
    } else {
      // Screw base: cylinder with faint ridges.
      const phi = rand() * Math.PI * 2;
      y = -0.3 - rand() * 0.34;
      const r = 0.17 + 0.012 * Math.sin(y * 60);
      x = Math.cos(phi) * r;
      z = Math.sin(phi) * r;
    }
    arr[i * 3] = x;
    arr[i * 3 + 1] = y;
    arr[i * 3 + 2] = z;
  }
  return arr;
}

function sampleScatter(n: number, rand: () => number) {
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    // Uniform volume distribution inside a sphere.
    const r = 1.15 * Math.cbrt(rand());
    const [dx, dy, dz] = sphereDir(rand);
    arr[i * 3] = dx * r;
    arr[i * 3 + 1] = dy * r;
    arr[i * 3 + 2] = dz * r;
  }
  return arr;
}

// White hollow-triangle sprite, tinted per-particle via vertex colors.
function makeTriangleTexture() {
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.clearRect(0, 0, size, size);
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 5;
  ctx.lineJoin = "round";
  ctx.shadowColor = "rgba(255, 255, 255, 0.9)";
  ctx.shadowBlur = 6;
  ctx.beginPath();
  ctx.moveTo(32, 10);
  ctx.lineTo(54, 50);
  ctx.lineTo(10, 50);
  ctx.closePath();
  ctx.stroke();
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

export default function ParticleStage() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const isMobile = window.innerWidth < 768;
    const count = isMobile ? 2600 : 6000;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x000000, 0);
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      42,
      window.innerWidth / window.innerHeight,
      0.1,
      20
    );
    camera.position.z = isMobile ? 3.05 : 2.4;

    const group = new THREE.Group();
    scene.add(group);

    // Precompute one target array per shape (seeded → stable).
    const rand = mulberry32(20260214);
    const shapes: Record<ShapeName, Float32Array> = {
      heart: sampleHeart(count, rand),
      scatter: sampleScatter(count, rand),
      lungs: sampleLungs(count, rand),
      stomach: sampleStomach(count, rand),
      brain: sampleBrain(count, rand),
      bulb: sampleBulb(count, rand),
    };

    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(shapes.heart); // start on hero heart
    const positionAttr = new THREE.BufferAttribute(positions, 3);
    positionAttr.setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute("position", positionAttr);

    // Per-shape color targets. Organ shapes start with the palette and are
    // replaced by image-sampled colors once the baked binaries arrive.
    const paletteColors = (n: number) => {
      const arr = new Float32Array(n * 3);
      const tint = new THREE.Color();
      for (let i = 0; i < n; i++) {
        tint.set(PALETTE[i % PALETTE.length]);
        const jitter = 0.82 + rand() * 0.28;
        arr[i * 3] = Math.min(1, tint.r * jitter);
        arr[i * 3 + 1] = Math.min(1, tint.g * jitter);
        arr[i * 3 + 2] = Math.min(1, tint.b * jitter);
      }
      return arr;
    };
    const bulbColors = (n: number) => {
      // Gold dome, ivory equator, violet screw base.
      const arr = new Float32Array(n * 3);
      const gold = new THREE.Color("#ffb829");
      const ivory = new THREE.Color("#f4f4f6");
      const violet = new THREE.Color("#8052ff");
      const tint = new THREE.Color();
      const pos = shapes.bulb;
      for (let i = 0; i < n; i++) {
        const y = pos[i * 3 + 1];
        if (y > 0.1) tint.copy(ivory).lerp(gold, smooth(Math.min(1, (y - 0.1) / 0.4)));
        else if (y > -0.25) tint.copy(ivory);
        else tint.copy(ivory).lerp(violet, smooth(Math.min(1, (-0.25 - y) / 0.25)));
        const jitter = 0.85 + rand() * 0.25;
        arr[i * 3] = Math.min(1, tint.r * jitter);
        arr[i * 3 + 1] = Math.min(1, tint.g * jitter);
        arr[i * 3 + 2] = Math.min(1, tint.b * jitter);
      }
      return arr;
    };
    const shapeColors: Record<ShapeName, Float32Array> = {
      heart: paletteColors(count),
      scatter: paletteColors(count),
      lungs: paletteColors(count),
      stomach: paletteColors(count),
      brain: paletteColors(count),
      bulb: bulbColors(count),
    };

    const colors = new Float32Array(shapeColors.heart);
    const colorAttr = new THREE.BufferAttribute(colors, 3);
    colorAttr.setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute("color", colorAttr);

    const texture = makeTriangleTexture();
    const material = new THREE.PointsMaterial({
      size: isMobile ? 0.042 : 0.034,
      map: texture ?? undefined,
      transparent: true,
      opacity: 0, // hidden until the baked heart shape arrives (see below)
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexColors: true,
      sizeAttenuation: true,
    });
    const points = new THREE.Points(geometry, material);
    group.add(points);

    const phases = new Float32Array(count);
    for (let i = 0; i < count; i++) phases[i] = rand() * Math.PI * 2;

    // Chapter anchors measured from real sections (recomputed on resize).
    // Anchor = scrollY at which the chapter's content is vertically centered,
    // so each shape is fully formed exactly while its chapter is on screen.
    let anchors: number[] = [];
    const measure = () => {
      const half = window.innerHeight / 2;
      let prevAnchor = -Infinity;
      anchors = Array.from(document.querySelectorAll("[data-chapter]")).map((el) => {
        const section = el as HTMLElement;
        const anchor = Math.max(prevAnchor + 1, section.offsetTop + section.offsetHeight / 2 - half);
        prevAnchor = anchor;
        return anchor;
      });
    };
    measure();

    let tTarget = 0;
    const onScroll = () => {
      const last = anchors.length - 1;
      if (last <= 0) {
        tTarget = 0;
        return;
      }
      const probe = window.scrollY;
      if (probe <= anchors[0]) {
        tTarget = 0;
        return;
      }
      for (let k = 0; k < last; k++) {
        if (probe < anchors[k + 1]) {
          tTarget = k + smooth((probe - anchors[k]) / Math.max(1, anchors[k + 1] - anchors[k]));
          return;
        }
      }
      tTarget = last; // library and beyond: locked on the final shape
    };
    onScroll();

    const pointer = { x: 0, y: 0 };
    const onPointer = (event: PointerEvent) => {
      pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
      pointer.y = (event.clientY / window.innerHeight) * 2 - 1;
    };

    const onResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
      measure();
      onScroll();
    };

    // Dim the whole stage once the library takes over.
    const libraryEl = document.querySelector("#library");
    const observer = libraryEl
      ? new IntersectionObserver(
          (entries) => {
            entries.forEach((entry) =>
              container.classList.toggle("dimmed", entry.isIntersecting)
            );
          },
          { threshold: 0.04 }
        )
      : null;
    if (libraryEl && observer) observer.observe(libraryEl);

    // Load baked organ point clouds (image-sampled positions + colors).
    let disposed = false;
    // The hero must show the baked anatomical heart from the very first
    // visible frame — never the procedural "cartoon heart" fallback. Keep
    // the stage invisible until the heart bin lands (or fails / times out).
    let heartReady = false;
    const reveal = () => {
      heartReady = true;
    };
    const revealTimer = window.setTimeout(reveal, 2500);
    const ORGAN_BINS: [ShapeName, string][] = [
      ["heart", "heart"],
      ["lungs", "lung"],
      ["stomach", "stomach"],
      ["brain", "brain"],
    ];
    ORGAN_BINS.forEach(([shape, file]) => {
      fetch(`shapes/${file}.bin`)
        .then((res) => {
          if (!res.ok) throw new Error(`shape ${file}: ${res.status}`);
          return res.arrayBuffer();
        })
        .then((buf) => {
          if (disposed) return;
          const view = new DataView(buf);
          const n = view.getUint32(0, true);
          if (!n || buf.byteLength < 4 + n * 15) return;
          const src = new Float32Array(buf, 4, n * 3);
          const rgb = new Uint8Array(buf, 4 + n * 12, n * 3);
          const P = new Float32Array(count * 3);
          const C = new Float32Array(count * 3);
          const tint = new THREE.Color();
          const stride = n / count;
          for (let i = 0; i < count; i++) {
            const s = Math.min(n - 1, Math.floor(i * stride));
            P[i * 3] = src[s * 3];
            P[i * 3 + 1] = src[s * 3 + 1];
            P[i * 3 + 2] = src[s * 3 + 2];
            tint.setRGB(
              rgb[s * 3] / 255,
              rgb[s * 3 + 1] / 255,
              rgb[s * 3 + 2] / 255,
              THREE.SRGBColorSpace
            );
            C[i * 3] = tint.r;
            C[i * 3 + 1] = tint.g;
            C[i * 3 + 2] = tint.b;
          }
          shapes[shape] = P;
          shapeColors[shape] = C;
          if (shape === "heart") reveal();
        })
        .catch(() => {
          // Keep the procedural fallback shape; still reveal so the page
          // never stays blank if the baked asset is missing.
          if (shape === "heart") reveal();
        });
    });

    let tSmooth = tTarget;
    let baseRotY = 0;
    let parX = 0;
    let parY = 0;
    let prev = performance.now();
    let raf = 0;
    const lastIndex = CHAPTERS.length - 1;

    const animate = (now: number) => {
      const dt = Math.min(0.05, (now - prev) / 1000);
      prev = now;
      const time = now / 1000;

      tSmooth += (tTarget - tSmooth) * (reduced ? 1 : 0.085);
      const k = Math.min(lastIndex, Math.max(0, Math.floor(tSmooth)));
      const k2 = Math.min(lastIndex, k + 1);
      const mix = smooth(Math.min(1, Math.max(0, tSmooth - k)));
      const A = shapes[CHAPTERS[k].shape];
      const B = shapes[CHAPTERS[k2].shape];
      const driftAmp = reduced ? 0 : 0.02;

      for (let i = 0; i < count; i++) {
        const j = i * 3;
        const ph = phases[i];
        positions[j] = A[j] + (B[j] - A[j]) * mix + Math.sin(time * 0.7 + ph) * driftAmp;
        positions[j + 1] =
          A[j + 1] + (B[j + 1] - A[j + 1]) * mix + Math.sin(time * 0.55 + ph * 1.7) * driftAmp;
        positions[j + 2] =
          A[j + 2] + (B[j + 2] - A[j + 2]) * mix + Math.cos(time * 0.62 + ph) * driftAmp;
      }
      positionAttr.needsUpdate = true;

      // Colors morph alongside positions (palette <-> image-sampled organ colors).
      const cA = shapeColors[CHAPTERS[k].shape];
      const cB = shapeColors[CHAPTERS[k2].shape];
      for (let i = 0; i < count * 3; i++) {
        colors[i] = cA[i] + (cB[i] - cA[i]) * mix;
      }
      colorAttr.needsUpdate = true;

      // Horizontal alignment follows the current chapter pair.
      const ax = isMobile
        ? 0
        : ALIGN_X[CHAPTERS[k].align] +
          (ALIGN_X[CHAPTERS[k2].align] - ALIGN_X[CHAPTERS[k].align]) * mix;
      group.position.x += (ax - group.position.x) * 0.06;
      group.position.y = isMobile ? -0.38 : 0;

      if (!reduced) baseRotY += dt * 0.05;
      parY += (pointer.x * 0.15 - parY) * 0.05;
      parX += (pointer.y * 0.1 - parX) * 0.05;
      group.rotation.y = baseRotY + parY;
      group.rotation.x = parX;

      // Heartbeat pulse, weighted by how "heart" the current blend is.
      const heartness =
        (CHAPTERS[k].shape === "heart" ? 1 - mix : 0) +
        (CHAPTERS[k2].shape === "heart" ? mix : 0);
      const scale = reduced ? 1 : 1 + 0.045 * heartness * Math.sin(time * 2.4);
      group.scale.setScalar(scale);

      // Fade the stage in once the baked heart shape (or its fallback) is
      // ready, so the procedural cartoon heart never flashes on load.
      material.opacity += ((heartReady ? 1 : 0) - material.opacity) * 0.08;

      renderer.render(scene, camera);
      raf = requestAnimationFrame(animate);
    };
    raf = requestAnimationFrame(animate);

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);
    window.addEventListener("pointermove", onPointer, { passive: true });

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      window.clearTimeout(revealTimer);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("pointermove", onPointer);
      observer?.disconnect();
      geometry.dispose();
      material.dispose();
      texture?.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  return <div className="stage" ref={containerRef} aria-hidden="true" />;
}
