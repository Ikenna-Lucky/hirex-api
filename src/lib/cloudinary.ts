import { v2 as cloudinary } from "cloudinary";
import { config } from "./config";

cloudinary.config({
  cloud_name: config.cloudinary.cloudName,
  api_key: config.cloudinary.apiKey,
  api_secret: config.cloudinary.apiSecret,
});

export interface UploadResult {
  url: string;
  publicId: string;
}

/**
 * Uploads a CV file (PDF) to Cloudinary under the hirex/cvs/ folder.
 * Accepts a Bun File object from multipart form data.
 */
export async function uploadCV(file: File): Promise<UploadResult> {
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const base64 = buffer.toString("base64");
  const dataUri = `data:${file.type};base64,${base64}`;

  const result = await cloudinary.uploader.upload(dataUri, {
    folder: "hirex/cvs",
    resource_type: "raw", // PDFs are raw resources in Cloudinary
    allowed_formats: ["pdf"],
    use_filename: false,
    unique_filename: true,
  });

  return {
    url: result.secure_url,
    publicId: result.public_id,
  };
}

/**
 * Deletes a CV from Cloudinary by its public_id.
 * Called when an application is withdrawn or deleted.
 */
export async function deleteCV(publicId: string): Promise<void> {
  await cloudinary.uploader.destroy(publicId, { resource_type: "raw" });
}

/**
 * Uploads a company logo (JPEG / PNG / WebP) to Cloudinary under hirex/logos/.
 * Auto-crops to a 256×256 square centred on the subject.
 */
export async function uploadLogo(file: File): Promise<UploadResult> {
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const base64 = buffer.toString("base64");
  const dataUri = `data:${file.type};base64,${base64}`;

  const result = await cloudinary.uploader.upload(dataUri, {
    folder: "hirex/logos",
    resource_type: "image",
    allowed_formats: ["jpg", "jpeg", "png", "webp"],
    transformation: [
      { width: 256, height: 256, crop: "fill", gravity: "auto" },
    ],
    use_filename: false,
    unique_filename: true,
  });

  return {
    url: result.secure_url,
    publicId: result.public_id,
  };
}

/**
 * Deletes a company logo from Cloudinary by its public_id.
 * Called before replacing an existing logo.
 */
export async function deleteLogo(publicId: string): Promise<void> {
  await cloudinary.uploader.destroy(publicId, { resource_type: "image" });
}
