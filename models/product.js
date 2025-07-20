// models/Product.js
const mongoose = require('mongoose');

const ProductSchema = new mongoose.Schema({
  name: { type: String, required: true },
  brand: String,
  barcode: { type: String, unique: true, sparse: true },
  ingredients: [String],
  harmfulIngredients: [
    {
      name: String,
      riskLevel: String,
      reason: String,
    }
  ],
  healthScore: Number,
  imageUrl: String,
  recommendation: String,
  rawOCR: String,
  addedBy: { type: String, default: 'admin' },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Product', ProductSchema);
