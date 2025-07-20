const cloudinary = require('cloudinary').v2;
require('dotenv').config();
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * Uploads an external image URL to Cloudinary
 * @param {string} imageUrl - The external image URL (e.g., from BigBasket)
 * @param {string} folder - The Cloudinary folder (e.g., 'products')
 * @returns {Promise<string|null>} - Cloudinary secure_url or null on failure
 */
async function uploadImageFromUrl(imageUrl, folder = 'products') {
  console.log('Uploading image from URL:', imageUrl);
  try {
    const result = await cloudinary.uploader.upload(imageUrl, {
      folder,
      use_filename: true,
      unique_filename: true,
      overwrite: false
    });
    return result.secure_url;
  } catch (err) {
    console.error('❌ Cloudinary URL upload failed:', err.message);
    return null;
  }
}

module.exports = { uploadImageFromUrl };
