/** Browser-only helpers for preparing prescription photos before upload. */

export const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const ACCEPTED_IMAGE_LABEL = "JPG, PNG or WEBP";
export const MAX_UPLOAD_BYTES = 12 * 1024 * 1024;
const MAX_DIMENSION = 1600;
const JPEG_QUALITY = 0.85;

export interface PreparedImage {
  /** Downsized JPEG as a data URL — used for both the preview and the API call. */
  dataUrl: string;
  mimeType: "image/jpeg";
  name: string;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("That file could not be read as an image."));
    img.src = src;
  });
}

/** Downsizes (phone photos are often 12 MP+) and re-encodes as JPEG on a white background. */
async function rasterize(src: string, name: string): Promise<PreparedImage> {
  const img = await loadImage(src);
  const longest = Math.max(img.naturalWidth, img.naturalHeight) || 1;
  const scale = Math.min(1, MAX_DIMENSION / longest);
  const width = Math.max(1, Math.round(img.naturalWidth * scale));
  const height = Math.max(1, Math.round(img.naturalHeight * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Your browser could not process this image.");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(img, 0, 0, width, height);

  return {
    dataUrl: canvas.toDataURL("image/jpeg", JPEG_QUALITY),
    mimeType: "image/jpeg",
    name,
  };
}

export async function prepareImageFromFile(file: File): Promise<PreparedImage> {
  const url = URL.createObjectURL(file);
  try {
    return await rasterize(url, file.name);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Loads a bundled sample (e.g. an SVG in `/public/samples`) and rasterises it like an upload. */
export async function prepareImageFromUrl(
  url: string,
  name: string
): Promise<PreparedImage> {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Could not load the sample prescription.");
  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  try {
    return await rasterize(objectUrl, name);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
