# File Upload Endpoints Documentation

This document describes the file upload endpoints for profile pictures and community photos.

## Setup

The application uses `multer` with `multer-storage-cloudinary` for handling file uploads. Files are stored on Cloudinary cloud storage:
- Profile pictures: Stored in `levelup/profiles/` folder with 500x500px transformation
- Community photos: Stored in `levelup/communities/` folder with 1200x630px transformation

### Environment Variables Required:
```env
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

## Endpoints

### 1. Upload Profile Picture

**Endpoint:** `POST /api/v1/auth/upload-profile-picture`

**Authentication:** Required (Bearer token)

**Content-Type:** `multipart/form-data`

**Request Body:**
- `profilePicture` (file): The image file to upload

**Accepted File Types:**
- JPEG (.jpeg, .jpg)
- PNG (.png)
- GIF (.gif)
- WebP (.webp)

**Max File Size:** 5MB

**Image Transformation:** Automatically resized to 500x500px

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "profilePicture": "https://res.cloudinary.com/your-cloud/image/upload/v1234567890/levelup/profiles/filename.jpg"
  },
  "message": "Profile picture uploaded successfully"
}
```

**Error Responses:**
- `401 Unauthorized`: User not authenticated
- `400 Bad Request`: No file uploaded or invalid file type
- `404 Not Found`: User not found
- `500 Internal Server Error`: Failed to upload

**Example cURL:**
```bash
curl -X POST http://localhost:3000/api/v1/auth/upload-profile-picture \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "profilePicture=@/path/to/image.jpg"
```

**Notes:**
- Old profile pictures are automatically deleted from Cloudinary when uploading a new one
- Images are stored with optimized format and quality

---

### 2. Create Community (with Photo)

**Endpoint:** `POST /api/v1/community/create`

**Authentication:** Required (Bearer token)

**Content-Type:** `multipart/form-data`

**Request Body:**
- `communityName` (string, required): Name of the community
- `memberLimit` (number, optional): Maximum number of members (default: 100)
- `isPrivate` (boolean, optional): Whether the community is private (default: false)
- `photo` (file, optional): Community photo

**Accepted File Types:**
- JPEG (.jpeg, .jpg)
- PNG (.png)
- GIF (.gif)
- WebP (.webp)

**Max File Size:** 10MB

**Image Transformation:** Automatically resized to 1200x630px

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "community_id",
    "name": "Community Name",
    "description": null,
    "photo": "https://res.cloudinary.com/your-cloud/image/upload/v1234567890/levelup/communities/filename.jpg",
    "isPrivate": false,
    "memberLimit": 100,
    "ownerId": "user_id",
    "categoryId": null,
    "createdAt": "2025-11-01T00:00:00.000Z",
    "updatedAt": "2025-11-01T00:00:00.000Z"
  },
  "message": "Community created successfully"
}
```

**Error Responses:**
- `401 Unauthorized`: User not authenticated
- `400 Bad Request`: Community name already exists or invalid file type
- `500 Internal Server Error`: Failed to create community

**Example cURL:**
```bash
curl -X POST http://localhost:3000/api/v1/community/create \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "communityName=My Community" \
  -F "memberLimit=50" \
  -F "isPrivate=false" \
  -F "photo=@/path/to/community-image.jpg"
```

---

### 3. Upload Community Photo

**Endpoint:** `POST /api/v1/community/:communityId/upload-photo`

**Authentication:** Required (Bearer token - must be community owner or admin)

**Content-Type:** `multipart/form-data`

**URL Parameters:**
- `communityId` (string, required): ID of the community

**Request Body:**
- `photo` (file, required): Community photo to upload

**Accepted File Types:**
- JPEG (.jpeg, .jpg)
- PNG (.png)
- GIF (.gif)
- WebP (.webp)

**Max File Size:** 10MB

**Image Transformation:** Automatically resized to 1200x630px

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "photo": "https://res.cloudinary.com/your-cloud/image/upload/v1234567890/levelup/communities/filename.jpg"
  },
  "message": "Community photo uploaded successfully"
}
```

**Error Responses:**
- `401 Unauthorized`: User not authenticated
- `400 Bad Request`: No file uploaded or invalid file type
- `403 Forbidden`: User is not owner or admin of the community
- `404 Not Found`: Community not found
- `500 Internal Server Error`: Failed to upload

**Example cURL:**
```bash
curl -X POST http://localhost:3000/api/v1/community/COMMUNITY_ID/upload-photo \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "photo=@/path/to/community-image.jpg"
```

**Notes:**
- Old community photos are automatically deleted from Cloudinary when uploading a new one
- Only community owners and admins can upload photos

---

## File Storage

All files are stored on **Cloudinary** cloud storage:

### Folder Structure
```
levelup/
├── profiles/      (Profile pictures - 500x500px)
└── communities/   (Community photos - 1200x630px)
```

### File Naming Convention
Files are automatically named with timestamps and unique identifiers by Cloudinary.

## Accessing Uploaded Files

Uploaded files are accessible via Cloudinary CDN URLs:
```
https://res.cloudinary.com/{cloud_name}/image/upload/v{version}/levelup/profiles/{filename}
https://res.cloudinary.com/{cloud_name}/image/upload/v{version}/levelup/communities/{filename}
```

These URLs are automatically returned in API responses and stored in the database.

## Notes

1. **Old File Deletion**: When uploading a new profile picture or community photo, the old file is automatically deleted from Cloudinary using the `public_id` extracted from the image URL.

2. **File Validation**: Files are validated for:
   - File type (only images: JPEG, PNG, GIF, WebP)
   - File size (5MB for profiles, 10MB for communities)

3. **Image Transformations**: 
   - Profile pictures: Automatically resized to 500x500px
   - Community photos: Automatically resized to 1200x630px
   - Format optimization handled by Cloudinary

4. **CDN Delivery**: Images are served via Cloudinary's global CDN for fast loading worldwide.

5. **Security**: 
   - All upload endpoints require valid authentication tokens
   - Cloudinary credentials stored in environment variables
   - Old images automatically cleaned up to save storage

6. **Error Handling**: Invalid file types or sizes return appropriate error messages with translation support.

## Testing with Bruno/Postman

1. Set the request type to `POST`
2. Set `Content-Type` to `multipart/form-data`
3. Add your authentication token in the `Authorization` header
4. Add form fields as specified in the endpoint documentation
5. Attach your image file to the appropriate field name

## Database Schema Changes

### User Model
```prisma
model User {
  // ... other fields
  profilePicture String? // path to profile picture
  // ... other fields
}
```

### Community Model
```prisma
model Community {
  // ... other fields
  photo String? // path to community photo
  // ... other fields
}
```
