# File Upload Implementation Summary

## Overview
Implemented file upload functionality for user profile pictures and community photos using Multer with Cloudinary cloud storage.

## Files Created

### 1. `src/helpers/multer.ts`
- Multer configuration with `multer-storage-cloudinary` for cloud storage
- Separate storage configurations for profile pictures and community photos
- **Profile storage:** Uploads to `levelup/profiles/` folder with 500x500px transformation
- **Community storage:** Uploads to `levelup/communities/` folder with 1200x630px transformation
- File validation (image types only: JPEG, PNG, GIF, WebP)
- Size limits: 5MB for profiles, 10MB for communities
- Helper functions:
  - `deleteFile(publicId)`: Deletes files from Cloudinary by public_id
  - `extractPublicId(url)`: Extracts public_id from Cloudinary URLs for deletion

### 2. `src/helpers/cloudinary.ts`
- Cloudinary v2 configuration
- Uses environment variables: `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`

## Files Modified

### 1. `prisma/schema.prisma`
- Added `profilePicture String?` field to User model (stores Cloudinary URL)
- Added `photo String?` field to Community model (stores Cloudinary URL)

### 2. `src/controllers/authControllers.ts`
- Added `uploadProfilePicture` function to handle profile picture uploads
- Deletes old profile picture from Cloudinary when new one is uploaded
- Uses `extractPublicId()` to parse public_id from stored URL
- Returns the Cloudinary URL path

### 3. `src/controllers/communityController.ts`
- Modified `createCommunity` function to accept optional photo upload
- Photo URL from Cloudinary is saved to the database if provided
- Added `uploadCommunityPhoto` function to handle community photo uploads
- Only community owner or admin can upload/update community photos
- Deletes old community photo from Cloudinary when new one is uploaded
- Uses `extractPublicId()` to parse public_id from stored URL

### 4. `src/routes/authRoutes.ts`
- Added POST `/upload-profile-picture` route
- Uses `authMiddleware` for authentication
- Uses `uploadProfilePicture.single('profilePicture')` middleware

### 5. `src/routes/communityRoutes.ts`
- Modified POST `/create` route to include photo upload
- Added `uploadCommunityPhoto.single('photo')` middleware before validation
- Added POST `/:communityId/upload-photo` route for updating community photos
- Upload photo route checks for owner/admin permissions

### 6. `src/index.ts`
- Removed local static file serving (no longer needed with Cloudinary)
- Files are now served via Cloudinary CDN URLs

### 7. `.gitignore`
- Added `uploads/` directory (though no longer actively used)

### 8. `package.json` (via pnpm install)
- Added `multer` dependency
- Added `@types/multer` dev dependency
- Added `multer-storage-cloudinary` dependency
- Added `cloudinary` dependency

## Documentation Files

### 1. `UPLOAD_ENDPOINTS.md`
- Complete API documentation for both upload endpoints
- Updated with Cloudinary URLs and transformations
- Examples using cURL
- Error handling information
- Testing guidelines
- Environment variable setup instructions

### 2. Bruno API Files
- `LevelUp-Api/Auth/Upload Profile Picture.bru`
- `LevelUp-Api/Community/Create Community with Photo.bru`
- `LevelUp-Api/Community/Upload Community Photo.bru`
- `LevelUp-Api/Community/folder.bru`

## Database Changes

Pushed schema changes to database using `pnpm db:push`:
- Added `profilePicture` column to `User` table (stores Cloudinary URL)
- Added `photo` column to `Community` table (stores Cloudinary URL)

## Cloud Storage Structure

```
Cloudinary (levelup/):
├── profiles/          # User profile pictures (500x500px)
└── communities/       # Community photos (1200x630px)
```

## Image Transformations

- **Profile Pictures:** Automatically resized to 500x500px
- **Community Photos:** Automatically resized to 1200x630px
- Format optimization and quality handled by Cloudinary

## API Endpoints

### 1. Upload Profile Picture
- **Endpoint:** POST `/api/v1/auth/upload-profile-picture`
- **Auth:** Required
- **Body:** multipart/form-data with `profilePicture` field
- **Response:** Returns Cloudinary URL

### 2. Create Community (with photo)
- **Endpoint:** POST `/api/v1/community/create`
- **Auth:** Required (via validation)
- **Body:** multipart/form-data with optional `photo` field
- **Response:** Returns created community with Cloudinary photo URL

### 3. Upload Community Photo
- **Endpoint:** POST `/api/v1/community/:communityId/upload-photo`
- **Auth:** Required (must be owner or admin)
- **Body:** multipart/form-data with `photo` field
- **Response:** Returns Cloudinary photo URL
- **Note:** Only community owner or admin can upload photos

## Environment Variables Required

```env
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

## Testing

1. Use Bruno/Postman with multipart/form-data
2. Include authentication token
3. Select image file for upload
4. Files are uploaded to Cloudinary and URL is returned
5. Access uploaded files via Cloudinary CDN URLs

All Bruno API files are located in the `LevelUp-Api` folder.

## Features

- **Cloud Storage:** All images stored on Cloudinary with CDN delivery
- **Automatic Deletion:** Old images automatically deleted when uploading new ones
- **Image Transformations:** Automatic resizing and optimization
- **File Validation:** Type and size validation handled by multer middleware
- **Security:** Cloudinary credentials stored in environment variables
- **Scalability:** No local disk storage, all files in cloud
- **CDN Delivery:** Fast global image delivery via Cloudinary CDN

## Benefits of Cloudinary Integration

1. **No Local Storage:** Eliminates need for local disk space management
2. **Automatic Optimization:** Images optimized for web delivery
3. **Transformations:** On-the-fly image resizing and formatting
4. **CDN Distribution:** Fast loading from nearest edge location
5. **Backup & Reliability:** Cloud-based storage with redundancy
6. **Easy Management:** Cloudinary dashboard for media management
