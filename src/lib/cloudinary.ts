import { v2 as cloudinary } from "cloudinary";

/**
 * The client uploads product images directly to Cloudinary (Section
 * 5/30) — this module only ever issues a short-lived signed upload
 * signature; the API secret never reaches the browser, and the server
 * never proxies image bytes through a Netlify function (which has no
 * persistent filesystem to stage them in anyway).
 */

const ALLOWED_FOLDERS = new Set(["products"]);

export function buildUploadSignature(folder: string): {
  timestamp: number;
  signature: string;
  apiKey: string;
  cloudName: string;
  folder: string;
} {
  if (!ALLOWED_FOLDERS.has(folder)) {
    throw new Error(`Upload folder "${folder}" is not allowed.`);
  }

  const apiKey = process.env.CLOUDINARY_API_KEY!;
  const apiSecret = process.env.CLOUDINARY_API_SECRET!;
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME!;
  if (!apiKey || !apiSecret || !cloudName) {
    throw new Error("Cloudinary environment variables are not fully configured.");
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const signature = cloudinary.utils.api_sign_request({ timestamp, folder }, apiSecret);

  return { timestamp, signature, apiKey, cloudName, folder };
}
