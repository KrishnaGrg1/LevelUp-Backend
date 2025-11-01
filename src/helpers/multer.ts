import multer from "multer";
import { Request } from "express";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import cloudinary from "./cloudinary";

// Cloudinary storage for profile pictures
const profileStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "levelup/profiles",
    allowed_formats: ["jpg", "jpeg", "png", "gif", "webp"],
    transformation: [{ width: 500, height: 500, crop: "limit" }],
  } as any,
});

// Cloudinary storage for community photos
const communityStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "levelup/communities",
    allowed_formats: ["jpg", "jpeg", "png", "gif", "webp"],
    transformation: [{ width: 1200, height: 630, crop: "limit" }],
  } as any,
});

// File filter for images only
const imageFileFilter = (
  _req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  const allowedMimes = ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp"];
  
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Invalid file type. Only JPEG, PNG, GIF, and WebP images are allowed."));
  }
};

// Multer configurations
export const uploadProfilePicture = multer({
  storage: profileStorage,
  fileFilter: imageFileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
});

export const uploadCommunityPhoto = multer({
  storage: communityStorage,
  fileFilter: imageFileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
});

// Helper function to delete files from Cloudinary
export const deleteFile = async (publicId: string) => {
  try {
    if (publicId) {
      await cloudinary.uploader.destroy(publicId);
    }
  } catch (error) {
    console.error("Error deleting file from Cloudinary:", error);
  }
};

// Helper function to extract public_id from Cloudinary URL
export const extractPublicId = (url: string): string | null => {
  try {
    // Cloudinary URL format: https://res.cloudinary.com/{cloud_name}/image/upload/{version}/{public_id}.{format}
    const parts = url.split("/");
    const uploadIndex = parts.findIndex((part) => part === "upload");
    if (uploadIndex !== -1 && parts.length > uploadIndex + 1) {
      // Get everything after 'upload/' and before the extension
      const pathAfterUpload = parts.slice(uploadIndex + 1).join("/");
      // Remove version number if present (starts with 'v' followed by digits)
      const pathWithoutVersion = pathAfterUpload.replace(/^v\d+\//, "");
      // Remove file extension
      return pathWithoutVersion.replace(/\.[^/.]+$/, "");
    }
    return null;
  } catch (error) {
    console.error("Error extracting public_id from URL:", error);
    return null;
  }
};
