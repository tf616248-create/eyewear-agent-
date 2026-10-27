import { FaceMesh, type NormalizedLandmark, type Results } from '@mediapipe/face_mesh';
import type { FaceData } from '../types/face.types';

let faceMeshInstance: FaceMesh | null = null;

export const loadFaceMesh = async (): Promise<FaceMesh> => {
  if (faceMeshInstance) return faceMeshInstance;
  const fm = new FaceMesh({
    locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`,
  });
  fm.setOptions({ maxNumFaces: 1, refineLandmarks: true, minDetectionConfidence: 0.7, minTrackingConfidence: 0.7 });
  faceMeshInstance = fm;
  return fm;
};

export const analyzeFaceFromVideo = async (videoElement: HTMLVideoElement): Promise<FaceData> => {
  const faceMesh = await loadFaceMesh();
  return new Promise((resolve, reject) => {
    faceMesh.onResults((results: Results) => {
      if (!results.multiFaceLandmarks?.length) return reject(new Error('לא זוהה פרצוף'));
      const landmarks = results.multiFaceLandmarks[0];
      const width = Math.abs((landmarks[234].x - landmarks[454].x) * videoElement.videoWidth);
      const height = Math.abs((landmarks[10].y - landmarks[152].y) * videoElement.videoHeight);
      const ratio = width > 0 ? height / width : 1;
      resolve({
        faceShape: ratio < 0.82 ? 'עגול' : ratio < 1.05 ? 'אובלי' : ratio < 1.25 ? 'מרובע' : 'משולש',
        faceWidth: Number(width.toFixed(0)),
        faceHeight: Number(height.toFixed(0)),
        ratio: Number(ratio.toFixed(2)),
        capturedImage: undefined,
      });
    });
    faceMesh.send({ image: videoElement });
  });
};

// ---------------------------------------------------------------------------
// Glasses-fitting engine
// ---------------------------------------------------------------------------
// Catalog frame photos are real product shots (front view, plain background),
// each with its own lens size/position and frame thickness. Rather than just
// stretching the whole photo to a fixed width, we analyze the photo once to
// find its lens openings and frame color, then composite it onto the face
// using the eye landmarks, with the temple arms drawn through to the ears.

interface GlassesAsset {
  canvas: HTMLCanvasElement;
  lensL: [number, number];
  lensR: [number, number];
  hingeL: [number, number];
  hingeR: [number, number];
  color: string;
}

type Point = [number, number];

function convexHull(points: Point[]): Point[] {
  const pts = points.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o: Point, a: Point, b: Point) =>
    (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const half = (list: Point[]) => {
    const h: Point[] = [];
    for (const p of list) {
      while (h.length >= 2 && cross(h[h.length - 2], h[h.length - 1], p) <= 0) h.pop();
      h.push(p);
    }
    h.pop();
    return h;
  };
  return half(pts).concat(half(pts.slice().reverse()));
}

function insidePolygon(x: number, y: number, poly: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

// Finds the lens openings in a glasses product photo, erases anything seen
// through them (e.g. temple arms showing through the lenses), trims the
// photo down to the front of the frame (dropping the arm tips that stick out
// of frame in a front-view shot) and returns the geometry needed to place it
// on a face: lens centers (to scale/rotate by) and hinge points (to draw the
// arms from).
function prepareGlasses(img: HTMLImageElement): GlassesAsset | null {
  const scale = Math.max(1, 800 / img.naturalWidth);
  const w = Math.round(img.naturalWidth * scale), h = Math.round(img.naturalHeight * scale);
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  if (!g) return null;
  g.drawImage(img, 0, 0, w, h);
  const data = g.getImageData(0, 0, w, h);
  const px = data.data;

  // background color = median of the border pixels
  const border: number[][] = [[], [], []];
  const sample = (x: number, y: number) => { const i = (y * w + x) * 4; for (let k = 0; k < 3; k++) border[k].push(px[i + k]); };
  for (let x = 0; x < w; x++) { sample(x, 0); sample(x, h - 1); }
  for (let y = 0; y < h; y++) { sample(0, y); sample(w - 1, y); }
  const bg = border.map(a => a.sort((p, q) => p - q)[a.length >> 1]);

  const alpha = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const diff = Math.hypot(px[i * 4] - bg[0], px[i * 4 + 1] - bg[1], px[i * 4 + 2] - bg[2]);
    alpha[i] = Math.min(1, Math.max(0, (diff - 8) / 30));
  }

  // thin wire frames are mostly anti-aliased pixels blended with the background:
  // estimate the true frame color from the most distinct pixels, then un-mix every pixel
  {
    const strong: number[] = [];
    for (let i = 0; i < w * h; i++) if (alpha[i] >= 1) strong.push(i);
    const diffOf = (i: number) => Math.hypot(px[i * 4] - bg[0], px[i * 4 + 1] - bg[1], px[i * 4 + 2] - bg[2]);
    strong.sort((a, b) => diffOf(b) - diffOf(a));
    const top = strong.slice(0, Math.max(1, Math.round(strong.length * 0.3)));
    if (top.length > 20) {
      const F = [0, 1, 2].map(k => { const v = top.map(i => px[i * 4 + k]).sort((a, b) => a - b); return v[v.length >> 1]; });
      const fb = F.map((v, k) => v - bg[k]), fb2 = fb.reduce((t, v) => t + v * v, 0);
      if (fb2 > 900) {
        for (let i = 0; i < w * h; i++) {
          if (alpha[i] === 0) continue;
          const pb = [0, 1, 2].map(k => px[i * 4 + k] - bg[k]);
          const a = Math.min(1, Math.max(0, pb.reduce((t, v, k) => t + v * fb[k], 0) / fb2) * 1.25);
          if (a < 0.08) { alpha[i] = 0; continue; }
          for (let k = 0; k < 3; k++) px[i * 4 + k] = Math.min(255, Math.max(0, bg[k] + pb[k] / a));
          alpha[i] = Math.max(alpha[i], a);
        }
      }
    }
  }

  // lens openings = transparent areas fully enclosed by the frame
  const label = new Int32Array(w * h); // 0 unvisited, -1 outside/opaque, >0 hole id
  const holes: Point[][] = [];
  const flood = (start: number, id: number) => {
    const stack = [start], pts: Point[] = [];
    label[start] = id;
    while (stack.length) {
      const i = stack.pop() as number, x = i % w, y = (i / w) | 0;
      pts.push([x, y]);
      for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const j = ny * w + nx;
        if (label[j] === 0 && alpha[j] < 0.3) { label[j] = id; stack.push(j); }
      }
    }
    return pts;
  };
  for (let i = 0; i < w * h; i++) {
    const x = i % w, y = (i / w) | 0;
    if (alpha[i] >= 0.3 || label[i]) continue;
    const onBorder = x === 0 || y === 0 || x === w - 1 || y === h - 1;
    if (onBorder) flood(i, -1);
  }
  let nextId = 1;
  for (let i = 0; i < w * h; i++) {
    if (alpha[i] < 0.3 && label[i] === 0) holes.push(flood(i, nextId++));
  }
  const lenses = holes.filter(p => p.length > w * h * 0.02).sort((a, b) => b.length - a.length).slice(0, 2);

  // erase anything inside a lens opening (e.g. the arms seen through the lenses), keep the rim
  const margin = w * 0.012;
  const lensInfo = lenses.map(pts => {
    const hull = convexHull(pts);
    const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length;
    const cy = pts.reduce((s, p) => s + p[1], 0) / pts.length;
    const shrunk = hull.map(([x, y]) => {
      const dx = x - cx, dy = y - cy, len = Math.hypot(dx, dy) || 1;
      return [x - (dx / len) * margin, y - (dy / len) * margin] as Point;
    });
    const xs = hull.map(p => p[0]), ys = hull.map(p => p[1]);
    for (let y = Math.floor(Math.min(...ys)); y <= Math.max(...ys); y++)
      for (let x = Math.floor(Math.min(...xs)); x <= Math.max(...xs); x++)
        if (insidePolygon(x, y, shrunk)) alpha[y * w + x] = 0;
    return { x: (Math.min(...xs) + Math.max(...xs)) / 2, y: (Math.min(...ys) + Math.max(...ys)) / 2,
             top: Math.min(...ys), bottom: Math.max(...ys), minX: Math.min(...xs), maxX: Math.max(...xs), hull };
  }).sort((a, b) => a.x - b.x);

  // keep only the front of the frame: a band of rim thickness around each lens, plus the bridge.
  // This removes arm pieces that show up on the corners of a front-view photo.
  let dist: Float32Array | null = null, rimWidth = 0;
  if (lensInfo.length === 2) {
    const [L, R] = lensInfo;
    const rimRun = (x: number, y: number, dx: number, dy: number) => {
      while (x > 0 && y > 0 && x < w - 1 && y < h - 1 && alpha[y * w + x] < 0.3) { x += dx; y += dy; }
      let n = 0;
      while (x > 0 && y > 0 && x < w - 1 && y < h - 1 && alpha[y * w + x] >= 0.3) { x += dx; y += dy; n++; }
      return n;
    };
    const runs = [
      rimRun(Math.round(L.x), Math.round(L.y), -1, 0), rimRun(Math.round(R.x), Math.round(R.y), 1, 0),
      rimRun(Math.round(L.x), Math.round(L.y), 0, 1), rimRun(Math.round(R.x), Math.round(R.y), 0, 1),
    ].sort((p, q) => p - q);
    rimWidth = (runs[1] + runs[2]) / 2;
    const keep = rimWidth * 1.4 + 2;

    // chamfer distance from the lens areas
    const INF = 1e9;
    dist = new Float32Array(w * h).fill(INF);
    for (const lens of lensInfo) {
      for (let y = Math.floor(lens.top); y <= lens.bottom; y++)
        for (let x = Math.floor(lens.minX); x <= lens.maxX; x++)
          if (insidePolygon(x, y, lens.hull)) dist[y * w + x] = 0;
    }
    const relax = (i: number, j: number, c: number) => { if ((dist as Float32Array)[j] + c < (dist as Float32Array)[i]) (dist as Float32Array)[i] = (dist as Float32Array)[j] + c; };
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (x > 0) relax(i, i - 1, 1);
      if (y > 0) { relax(i, i - w, 1); if (x > 0) relax(i, i - w - 1, 1.41); if (x < w - 1) relax(i, i - w + 1, 1.41); }
    }
    for (let y = h - 1; y >= 0; y--) for (let x = w - 1; x >= 0; x--) {
      const i = y * w + x;
      if (x < w - 1) relax(i, i + 1, 1);
      if (y < h - 1) { relax(i, i + w, 1); if (x < w - 1) relax(i, i + w + 1, 1.41); if (x > 0) relax(i, i + w - 1, 1.41); }
    }
    const top = Math.min(L.top, R.top) - keep, bottom = Math.max(L.bottom, R.bottom);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const bridge = x > L.maxX && x < R.minX && y > top && y < bottom;
      if (dist[i] > keep && !bridge) alpha[i] = 0;
    }
  }

  // arm tips are often a different material/color than the front (e.g. dark plastic on a metal frame):
  // drop pixels far from the frame's dominant color
  if (lensInfo.length === 2 && dist) {
    const ch: number[][] = [[], [], []];
    for (let i = 0; i < w * h; i += 3) if (alpha[i] > 0.95) for (let k = 0; k < 3; k++) ch[k].push(px[i * 4 + k]);
    if (ch[0].length) {
      const m = ch.map(a => a.sort((p, q) => p - q)[a.length >> 1]);
      // on a colored frame (gold, tortoise...), gray pixels are shadows or lens reflections
      const satM = Math.max(...m) - Math.min(...m);
      for (let i = 0; i < w * h; i++) {
        if (alpha[i] < 0.2) continue;
        const d = Math.hypot(px[i * 4] - m[0], px[i * 4 + 1] - m[1], px[i * 4 + 2] - m[2]);
        const sat = Math.max(px[i * 4], px[i * 4 + 1], px[i * 4 + 2]) - Math.min(px[i * 4], px[i * 4 + 1], px[i * 4 + 2]);
        if (d > 70 || (satM > 40 && sat < satM * 0.35)) {
          // on the rim line itself: repaint in frame color to close the gap; elsewhere: remove
          if (dist[i] > 0 && dist[i] <= rimWidth + 1) for (let k = 0; k < 3; k++) px[i * 4 + k] = m[k];
          else alpha[i] = 0;
        }
      }
    }
  }

  // frame color = median of solid pixels; bounding box of what is left
  const solid: number[][] = [[], [], []];
  let x0 = w, y0 = h, x1 = 0, y1 = 0;
  for (let i = 0; i < w * h; i++) {
    px[i * 4 + 3] = Math.min(px[i * 4 + 3], alpha[i] * 255);
    if (alpha[i] > 0.05) {
      const x = i % w, y = (i / w) | 0;
      x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
    }
    if (alpha[i] > 0.95 && i % 7 === 0) for (let k = 0; k < 3; k++) solid[k].push(px[i * 4 + k]);
  }
  if (x1 <= x0) return null;
  g.putImageData(data, 0, 0);
  const color = solid[0].length ? `rgb(${solid.map(a => a.sort((p, q) => p - q)[a.length >> 1]).join(',')})` : '#222';

  const out = document.createElement('canvas');
  out.width = x1 - x0 + 1; out.height = y1 - y0 + 1;
  const outCtx = out.getContext('2d');
  if (!outCtx) return null;
  outCtx.drawImage(c, x0, y0, out.width, out.height, 0, 0, out.width, out.height);
  const gw = out.width, gh = out.height;

  // no enclosed openings (e.g. dark sunglasses): assume a typical front-view layout
  const [L, R] = lensInfo.length === 2
    ? lensInfo.map(l => ({ x: l.x - x0, y: l.y - y0, top: l.top - y0, bottom: l.bottom - y0 }))
    : [{ x: gw * 0.24, y: gh * 0.55, top: gh * 0.15, bottom: gh * 0.9 }, { x: gw * 0.76, y: gh * 0.55, top: gh * 0.15, bottom: gh * 0.9 }];
  const hingeY = (L.top + R.top) / 2 + ((L.bottom - L.top) + (R.bottom - R.top)) / 2 * 0.25;
  return { canvas: out, lensL: [L.x, L.y], lensR: [R.x, R.y], hingeL: [0, hingeY], hingeR: [gw, hingeY], color };
}

// ---- Landmark geometry ----
const EYE_SIZE_FACTOR = 1.15; // glasses width relative to the eye-to-eye distance
const EAR_OUT = 0.08; // how far past the face contour the arm continues (fraction of face width)

interface FacePlacement {
  cx: number;
  cy: number;
  d: number;
  angle: number;
  ears: [{ x: number; y: number }, { x: number; y: number }];
  contour: [{ x: number; y: number }, { x: number; y: number }];
}

function placeOnFace(lm: NormalizedLandmark[], w: number, h: number): FacePlacement {
  const p = (i: number) => ({ x: lm[i].x * w, y: lm[i].y * h });
  const avg = (...ps: { x: number; y: number }[]) => ({
    x: ps.reduce((s, q) => s + q.x, 0) / ps.length,
    y: ps.reduce((s, q) => s + q.y, 0) / ps.length,
  });
  const eyeA = avg(p(33), p(133), p(159), p(145));   // one eye
  const eyeB = avg(p(362), p(263), p(386), p(374));  // other eye
  const angle = Math.atan2(eyeB.y - eyeA.y, eyeB.x - eyeA.x);
  const dist = Math.hypot(eyeB.x - eyeA.x, eyeB.y - eyeA.y);
  const d = (dist / 2) * EYE_SIZE_FACTOR;
  const mid = avg(eyeA, eyeB);
  const cx = mid.x;
  const cy = mid.y;
  // MediaPipe has no ear landmarks: take the face-contour points beside the eyes (127/356)
  // and push them outward, onto the top of the ear where the arms rest
  const cL = p(127), cR = p(356);
  const ears: [{ x: number; y: number }, { x: number; y: number }] = [
    { x: cL.x + (cL.x - cR.x) * EAR_OUT, y: cL.y + (cL.y - cR.y) * EAR_OUT },
    { x: cR.x + (cR.x - cL.x) * EAR_OUT, y: cR.y + (cR.y - cL.y) * EAR_OUT },
  ];
  return { cx, cy, d, angle, ears, contour: [cL, cR] };
}

// Ear pixels = skin-colored pixels outside the face contour, beside the eyes.
// They are captured before the glasses are drawn and painted back on top, so
// the arms look like they go behind the ears.
function captureEars(ctx: CanvasRenderingContext2D, w: number, h: number, contour: [{ x: number; y: number }, { x: number; y: number }]) {
  const fw = Math.hypot(contour[1].x - contour[0].x, contour[1].y - contour[0].y);
  const patches: { tmp: HTMLCanvasElement; x: number; y: number }[] = [];
  contour.forEach((c, side) => {
    const out = side === 0 ? -1 : 1; // logical direction away from the face
    const lx0 = out < 0 ? c.x - fw * 0.22 : c.x - fw * 0.01;
    const lx1 = out < 0 ? c.x + fw * 0.01 : c.x + fw * 0.22;
    const dx0 = Math.max(0, Math.floor(Math.min(lx0, lx1)));
    const dx1 = Math.min(w, Math.ceil(Math.max(lx0, lx1)));
    const y0 = Math.max(0, Math.floor(c.y - fw * 0.15)), y1 = Math.min(h, Math.ceil(c.y + fw * 0.35));
    if (dx1 <= dx0 || y1 <= y0) return;
    const img = ctx.getImageData(dx0, y0, dx1 - dx0, y1 - y0);
    const px = img.data, bw = dx1 - dx0;
    for (let i = 0; i < px.length; i += 4) {
      const lx = dx0 + ((i / 4) % bw);
      const beyond = out < 0 ? lx < c.x : lx > c.x;
      // skin hue: red clearly above green and blue (rules out white background, gray hair)
      const r = px[i], gg = px[i + 1], b = px[i + 2];
      const score = Math.min(r - gg - 12, r - b - 30, r - 80) / 10;
      px[i + 3] = beyond ? Math.max(0, Math.min(255, score * 255)) : 0;
    }
    const tmp = document.createElement('canvas');
    tmp.width = bw; tmp.height = y1 - y0;
    const tctx = tmp.getContext('2d');
    if (!tctx) return;
    tctx.putImageData(img, 0, 0);
    patches.push({ tmp, x: dx0, y: y0 });
  });
  return patches;
}

function drawCustomGlasses(ctx: CanvasRenderingContext2D, placement: FacePlacement, glasses: GlassesAsset) {
  const { cx, cy, d, angle, ears } = placement;
  const lensDist = glasses.lensR[0] - glasses.lensL[0];
  const k = (2 * d) / lensDist;
  const midX = (glasses.lensL[0] + glasses.lensR[0]) / 2, midY = (glasses.lensL[1] + glasses.lensR[1]) / 2;
  const cos = Math.cos(angle), sin = Math.sin(angle);
  const toImage = ([x, y]: Point): Point => {
    const u = (x - midX) * k, v = (y - midY) * k;
    return [cx + u * cos - v * sin, cy + u * sin + v * cos];
  };

  // arms: from each hinge back to the ear, drawn first so the frame covers their ends
  ctx.save();
  ctx.strokeStyle = glasses.color;
  ctx.lineCap = 'round';
  ctx.lineWidth = Math.max(2, d * 0.09);
  ([[glasses.hingeL, ears[0]], [glasses.hingeR, ears[1]]] as const).forEach(([hinge, ear]) => {
    const [hx, hy] = toImage(hinge);
    ctx.beginPath();
    ctx.moveTo(hx, hy);
    ctx.lineTo(ear.x, ear.y);
    ctx.stroke();
  });
  ctx.restore();

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angle);
  ctx.drawImage(glasses.canvas, -midX * k, -midY * k, glasses.canvas.width * k, glasses.canvas.height * k);
  ctx.restore();
}

const glassesAssetCache = new Map<string, GlassesAsset | null>();

async function getGlassesAsset(glassesImageUrl: string): Promise<GlassesAsset | null> {
  if (glassesAssetCache.has(glassesImageUrl)) return glassesAssetCache.get(glassesImageUrl) ?? null;
  let asset: GlassesAsset | null = null;
  try {
    const glassesImg = await loadImage(glassesImageUrl);
    asset = prepareGlasses(glassesImg);
  } catch (error) {
    console.warn(`[tryOn] טעינת תמונת המשקפיים נכשלה: ${glassesImageUrl}`, error);
  }
  glassesAssetCache.set(glassesImageUrl, asset);
  return asset;
}

export async function tryOnWithMediaPipe(imageElement: HTMLImageElement, glassesImageUrl: string, frameId: string): Promise<string | null> {
  if (!imageElement.complete || imageElement.naturalWidth === 0) {
    console.warn(`[tryOn] תמונת הפנים עדיין לא נטענה עבור ${frameId}`);
    return null;
  }

  const glasses = await getGlassesAsset(glassesImageUrl);
  if (!glasses) {
    console.warn(`[tryOn] לא נמצאו משקפיים תקינות בתמונה עבור ${frameId}`);
    return null;
  }

  const faceMesh = await loadFaceMesh();
  return new Promise((resolve) => {
    faceMesh.onResults((results: Results) => {
      if (!results.multiFaceLandmarks?.length) {
        console.warn(`[tryOn] לא זוהו landmarks עבור ${frameId}`);
        return resolve(null);
      }

      const landmarks = results.multiFaceLandmarks[0];
      const w = imageElement.naturalWidth;
      const h = imageElement.naturalHeight;

      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) return resolve(imageElement.src);
      ctx.drawImage(imageElement, 0, 0, w, h);

      try {
        const placement = placeOnFace(landmarks, w, h);
        const earPatches = captureEars(ctx, w, h, placement.contour);
        drawCustomGlasses(ctx, placement, glasses);
        for (const patch of earPatches) ctx.drawImage(patch.tmp, patch.x, patch.y);
      } catch (err) {
        console.error('שגיאה בציור המשקפיים:', err);
        return resolve(null);
      }

      resolve(canvas.toDataURL('image/jpeg', 0.95));
    });

    try {
      void faceMesh.send({ image: imageElement }).catch((error: unknown) => {
        console.error(`[tryOn] FaceMesh נכשל עבור ${frameId}; לא ממשיכים לעיבוד WASM:`, error);
        resolve(null);
      });
    } catch (error) {
      console.error(`[tryOn] שליחת התמונה ל-FaceMesh נכשלה עבור ${frameId}:`, error);
      resolve(null);
    }
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = async () => {
      try {
        await image.decode();
        resolve(image);
      } catch (error) {
        reject(error);
      }
    };
    image.onerror = (event) => reject(new Error(`Image load error for ${src}: ${String(event)}`));
    image.src = src;
  });
}
