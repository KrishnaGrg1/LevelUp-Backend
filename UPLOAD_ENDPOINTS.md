# File Upload Endpoints Documentation

This document describes the file upload endpoints for profile pictures and community photos.

## Setup

The application uses `multer` for handling file uploads. Uploaded files are stored in the `uploads/` directory:
- Profile pictures: `uploads/profiles/`
- Community photos: `uploads/communities/`

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

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "profilePicture": "uploads/profiles/profile-1234567890-123456789.jpg"
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

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "community_id",
    "name": "Community Name",
    "description": null,
    "photo": "uploads/communities/community-1234567890-123456789.jpg",
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

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "photo": "uploads/communities/community-1234567890-123456789.jpg"
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

---

## File Storage Structure

```
uploads/
├── profiles/
│   └── profile-{timestamp}-{random}.{ext}
└── communities/
    └── community-{timestamp}-{random}.{ext}
```

## Accessing Uploaded Files

Uploaded files can be accessed via:
```
http://localhost:3000/uploads/profiles/profile-1234567890-123456789.jpg
http://localhost:3000/uploads/communities/community-1234567890-123456789.jpg
```

## Notes

1. **Old File Deletion**: When uploading a new profile picture, the old file is automatically deleted from the server.

2. **File Validation**: Files are validated for:
   - File type (only images allowed)
   - File size (5MB for profiles, 10MB for communities)

3. **Security**: The uploads directory is added to `.gitignore` to prevent committing uploaded files to version control.

4. **Error Handling**: If an invalid file type is uploaded, the server will return an error message.

5. **Authentication**: All upload endpoints require a valid authentication token.

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
