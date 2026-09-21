import { v2 as cloudinary } from "cloudinary";

/**
 * The client uploads product images directly to Cloudinary (Section
 * 5/30) — this module only ever issues a short-lived signed upload
 * signature; the API secret never reaches the browser, and the server
 * never proxies image bytes through a Netlify function (which has no
 * persistent filesystem to stage them in anyway).
 */

const ALLOWED_FOLDERS = new Set(["products"]);

// An "incoming transformation" — Cloudinary applies this to the file
// *before* storing it, so what actually lands in Cloudinary (and counts
// against storage/bandwidth) is already capped and compressed, not
// whatever multi-megabyte original a phone camera produced. `c_limit`
// only ever downscales (never enlarges a smaller source); `q_auto:good`
// is Cloudinary's own perceptual compression. This is Cloudinary's own
// infrastructure doing the work at upload time — it adds no load to our
// side at all (the Netlify function only ever signs a small JSON
// payload; the browser uploads straight to Cloudinary, per the module
// comment below).
const UPLOAD_TRANSFORMATION = "w_1600,h_1600,c_limit,q_auto:good";

function credentials() {
  const apiKey = process.env.CLOUDINARY_API_KEY!;
  const apiSecret = process.env.CLOUDINARY_API_SECRET!;
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME!;
  if (!apiKey || !apiSecret || !cloudName) {
    throw new Error("Cloudinary environment variables are not fully configured.");
  }
  return { apiKey, apiSecret, cloudName };
}

/**
 * `publicId` is fixed to the product's own id (never taken from the
 * client) and signed along with `overwrite`/`invalidate` — every re-upload
 * for a product lands at the exact same Cloudinary asset instead of
 * Cloudinary auto-generating a fresh random id each time, which was
 * silently orphaning the old file on every photo change (still cost
 * storage, and cluttered the media library with dead duplicates). Scoping
 * `publicId` server-side from the product id also closes off a client from
 * ever overwriting some *other* product's image.
 */
export function buildUploadSignature(
  folder: string,
  publicId: string,
): {
  timestamp: number;
  signature: string;
  apiKey: string;
  cloudName: string;
  folder: string;
  publicId: string;
  transformation: string;
} {
  if (!ALLOWED_FOLDERS.has(folder)) {
    throw new Error(`Upload folder "${folder}" is not allowed.`);
  }

  const { apiKey, apiSecret, cloudName } = credentials();

  const timestamp = Math.floor(Date.now() / 1000);
  // Every param that affects the resource must be signed, and the client
  // must send back this exact same value — Cloudinary recomputes the
  // signature from what actually arrives and rejects a mismatch.
  const signature = cloudinary.utils.api_sign_request(
    {
      timestamp,
      folder,
      public_id: publicId,
      overwrite: true,
      invalidate: true,
      transformation: UPLOAD_TRANSFORMATION,
    },
    apiSecret,
  );

  return {
    timestamp,
    signature,
    apiKey,
    cloudName,
    folder,
    publicId,
    transformation: UPLOAD_TRANSFORMATION,
  };
}

/**
 * Best-effort cleanup of a replaced product photo. Called after a product
 * update swaps in a new `imagePublicId` — never blocks or fails the save
 * itself (a stray orphaned asset is a far smaller problem than losing a
 * successful edit), just logged if it doesn't work out.
 */
export async function deleteAsset(publicId: string): Promise<void> {
  const { apiKey, apiSecret, cloudName } = credentials();
  cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret, secure: true });
  await cloudinary.uploader.destroy(publicId, { invalidate: true });
}
