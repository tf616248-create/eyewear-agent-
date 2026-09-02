import * as THREE from 'three';
import { FaceMesh, type Results } from '@mediapipe/face_mesh';
import type { FaceData } from '../types/face.types';

let faceMeshInstance: FaceMesh | null = null;
const glassesModel: THREE.Object3D | null = null;

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

export async function tryOnWithMediaPipe(imageElement: HTMLImageElement, glassesImageUrl: string, frameId: string): Promise<string | null> {
  if (!imageElement.complete || imageElement.naturalWidth === 0) {
    console.warn(`[tryOn] תמונת הפנים עדיין לא נטענה עבור ${frameId}`);
    return null;
  }

  let glassesImg: HTMLImageElement;
  try {
    glassesImg = await loadImage(glassesImageUrl);
  } catch (error) {
    console.warn(`[tryOn] טעינת תמונת המשקפיים נכשלה עבור ${frameId}: ${glassesImageUrl}`, error);
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

      // תיקון קריטי: naturalWidth/naturalHeight במקום width/height
      const w = imageElement.naturalWidth;
      const h = imageElement.naturalHeight;

      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) return resolve(imageElement.src);
      ctx.drawImage(imageElement, 0, 0, w, h);

      try {
        // הערכים הקבועים שמצאת בכלי הבדיקה - את הכיוונון עשית פעם אחת, כאן זה קבוע
        const SCALE = 1.24;      // <-- הערך שמצאת ב-Scale slider
        const OFFSET_X = 0;      // <-- הערך שמצאת ב-Offset X slider
        const OFFSET_Y = 20;      // <-- הערך שמצאת ב-Offset Y slider

        const leftTemple = { x: landmarks[127].x * w, y: landmarks[127].y * h };
        const rightTemple = { x: landmarks[356].x * w, y: landmarks[356].y * h };
        const leftEye = { x: landmarks[33].x * w, y: landmarks[33].y * h };
        const rightEye = { x: landmarks[263].x * w, y: landmarks[263].y * h };
        const nose = { x: landmarks[168].x * w, y: landmarks[168].y * h };

        const gW = Math.abs(rightTemple.x - leftTemple.x) * SCALE;
        const aspect = glassesImg.naturalHeight / glassesImg.naturalWidth; // aspect ratio אמיתי, לא קבוע
        const gH = gW * aspect;

        // זווית לפי קו העיניים (33/263) - מדויק יותר מ-127/356
        const angle = Math.atan2(rightEye.y - leftEye.y, rightEye.x - leftEye.x);
        const centerX = (leftEye.x + rightEye.x) / 2 + OFFSET_X;
        const centerY = nose.y + OFFSET_Y;

        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.rotate(angle);
        ctx.drawImage(glassesImg, -gW / 2, -gH / 2, gW, gH);
        ctx.restore();

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

// --- פונקציית ה-Three.js ---
export async function updateGlassesPosition(results: Results) {
  if (!results.multiFaceLandmarks?.length || !glassesModel) return;
  const landmarks = results.multiFaceLandmarks[0];
  const nose = landmarks[168];
  glassesModel.position.set(nose.x - 0.5, -nose.y + 0.5, nose.z);
  const angle = Math.atan2(landmarks[356].y - landmarks[127].y, landmarks[356].x - landmarks[127].x);
  glassesModel.rotation.z = -angle;
}