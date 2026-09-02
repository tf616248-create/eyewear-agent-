import * as faceapi from 'face-api.js';
import { type TryOnResult } from './tryOnService';

let modelsLoaded = false;

export async function loadModels() {
  if (modelsLoaded) return;
  await faceapi.nets.faceLandmark68Net.loadFromUri('/models');
  await faceapi.nets.ssdMobilenetv1.loadFromUri('/models');
  modelsLoaded = true;
}

export async function faceApiTryOn(
  faceImageDataUrl: string,
  glassesImageUrl: string
): Promise<TryOnResult> {
  await loadModels();

  const faceImg = await loadImage(faceImageDataUrl);

  const detection = await faceapi
    .detectSingleFace(faceImg)
    .withFaceLandmarks();

  if (!detection) {
    return { imageDataUrl: faceImageDataUrl };
  }

  const landmarks = detection.landmarks;
  const leftEye = landmarks.getLeftEye();
  const rightEye = landmarks.getRightEye();

  const leftX = Math.min(...leftEye.map(p => p.x));
  const rightX = Math.max(...rightEye.map(p => p.x));
  const eyeY =
    [...leftEye, ...rightEye].reduce((s, p) => s + p.y, 0) /
    (leftEye.length + rightEye.length);

  const glassesWidth = (rightX - leftX) * 1.4;
  const glassesHeight = glassesWidth * 0.4;
  const glassesX = leftX - (glassesWidth - (rightX - leftX)) / 2;
  const glassesY = eyeY - glassesHeight * 0.5;

  const canvas = document.createElement('canvas');
  canvas.width = faceImg.width;
  canvas.height = faceImg.height;
  const ctx = canvas.getContext('2d')!;

  ctx.drawImage(faceImg, 0, 0);

  const glassesImg = await loadImage(glassesImageUrl);
  const preparedGlasses = await prepareGlassesImage(glassesImg);

  ctx.globalCompositeOperation = 'source-over';
  ctx.drawImage(preparedGlasses, glassesX, glassesY, glassesWidth, glassesHeight);

  return { imageDataUrl: canvas.toDataURL('image/jpeg', 0.9) };
}

async function prepareGlassesImage(img: HTMLImageElement): Promise<HTMLCanvasElement> {
  // אם התמונה כבר כוללת ערוץ אלפא תקין, אין צורך בעיבוד נוסף.
  if (img.src.endsWith('.png')) {
    return imageToCanvas(img);
  }

  // אם יש רקע לבן ב-JPEG או PNG ללא שקיפות,
  // המרה לשקיפות על בסיס סף לבן שניתן להתאים.
  const maskCanvas = imageToCanvas(img);
  const ctx = maskCanvas.getContext('2d');
  if (!ctx) return maskCanvas;

  const imageData = ctx.getImageData(0, 0, maskCanvas.width, maskCanvas.height);
  const data = imageData.data;
  const threshold = 250; // לבן כמעט מלא

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    if (r >= threshold && g >= threshold && b >= threshold) {
      data[i + 3] = 0;
    }
  }

  ctx.putImageData(imageData, 0, 0);
  return maskCanvas;
}

function imageToCanvas(img: HTMLImageElement): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = img.width;
  c.height = img.height;
  const ctx = c.getContext('2d')!;
  ctx.drawImage(img, 0, 0);
  return c;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}