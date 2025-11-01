# File Upload Implementation Summary

## Overview
Implemented file upload functionality for user profile pictures and community photos using Multer middleware.

## Files Created

### 1. `src/helpers/multer.ts`
- Multer configuration for handling file uploads
- Separate storage configurations for profile pictures and community photos
- File validation (image types only: JPEG, PNG, GIF, WebP)
- Size limits: 5MB for profiles, 10MB for communities
- Automatic directory creation for uploads

## Files Modified

### 1. `prisma/schema.prisma`
- Added `profilePicture String?` field to User model
- Added `photo String?` field to Community model

### 2. `src/controllers/authControllers.ts`
- Added `uploadProfilePicture` function to handle profile picture uploads
- Deletes old profile picture when new one is uploaded
- Returns the uploaded file path

### 3. `src/controllers/communityController.ts`
- Modified `createCommunity` function to accept optional photo upload
- Photo path is saved to the database if provided
- Added `uploadCommunityPhoto` function to handle community photo uploads
- Only community owner or admin can upload/update community photos
- Deletes old community photo when new one is uploaded

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
- Added static file serving for `/uploads` directory
- Files can be accessed via `http://localhost:PORT/uploads/...`

### 7. `.gitignore`
- Added `uploads/` directory to prevent committing uploaded files

### 8. `package.json` (via pnpm install)
- Added `multer` dependency
- Added `@types/multer` dev dependency

## Documentation Files

### 1. `UPLOAD_ENDPOINTS.md`
- Complete API documentation for both upload endpoints
- Examples using cURL
- Error handling information
- Testing guidelines

### 2. Bruno API Files
- `LevelUp-Api/Auth/Upload Profile Picture.bru`
- `LevelUp-Api/Community/Create Community with Photo.bru`
- `LevelUp-Api/Community/Upload Community Photo.bru`
- `LevelUp-Api/Community/folder.bru`

## Database Changes

Pushed schema changes to database using `pnpm db:push`:
- Added `profilePicture` column to `User` table
- Added `photo` column to `Community` table

## Directory Structure

```
uploads/
├── profiles/          # User profile pictures
└── communities/       # Community photos
```

## API Endpoints

### 1. Upload Profile Picture
- **Endpoint:** POST `/api/v1/auth/upload-profile-picture`
- **Auth:** Required
- **Body:** multipart/form-data with `profilePicture` field
- **Response:** Returns uploaded file path

### 2. Create Community (with photo)
- **Endpoint:** POST `/api/v1/community/create`
- **Auth:** Required (via validation)
- **Body:** multipart/form-data with optional `photo` field
- **Response:** Returns created community with photo path

### 3. Upload Community Photo
- **Endpoint:** POST `/api/v1/community/:communityId/upload-photo`
- **Auth:** Required (must be owner or admin)
- **Body:** multipart/form-data with `photo` field
- **Response:** Returns uploaded photo path
- **Note:** Only community owner or admin can upload photos

## Testing

1. Use Bruno/Postman with multipart/form-data
2. Include authentication token
3. Select image file for upload
4. Access uploaded files at `/uploads/profiles/...` or `/uploads/communities/...`

All Bruno API files are located in the `LevelUp-Api` folder.

## Notes

- Old profile pictures are automatically deleted when uploading a new one
- All file validations are handled by multer middleware
- Files are stored with unique timestamps to prevent conflicts
- The uploads directory is created automatically if it doesn't exist
- Static file serving allows direct access to uploaded files
