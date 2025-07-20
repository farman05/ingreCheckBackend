const mongoose = require('mongoose');

const labelScanSchema = new mongoose.Schema({
  ocrHash: { type: String, required: true, unique: true },
  rawText: String,
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
  approved: { type: Boolean, default: false },
  source: { type: String, default: 'user-scan' },
  recommendation: String,
  barcode: String, // optional
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('LabelScan', labelScanSchema);
