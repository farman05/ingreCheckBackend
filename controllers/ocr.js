const Tesseract = require("tesseract.js");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const { OpenAI } = require("openai");
const LabelScan = require("../models/labelScan");
const {read, create} = require('mysql-helper-kit');
const {getHealthScore} = require('../utils/openai');
const {uploadImageFromUrl} = require('../utils/cloudinary');
require("dotenv").config();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const hashText = (text) =>
  crypto.createHash("sha256").update(text.trim().toLowerCase()).digest("hex");

const scanIngredients = async (req, res) => {
  // Step 1: Check if file is uploaded
  if (!req.file) {
    return res.status(400).json({ success: false, message: "No image uploaded" });
  }

  // Step 2: Validate required fields
  const { productName, ocrText, barcode } = req.body;
  if (!productName || !ocrText || !barcode) {
    // Clean up uploaded file if present
    try { fs.unlinkSync(req.file.path); } catch {}
    return res.status(400).json({ success: false, message: "Missing productName or ocrText or barcode" });
  }

  // Step 3: Check cache
  const ocrHash = hashText(ocrText);
  try {
    const [cached] = await read('label_scans', '*', { ocrHash });
    const [cachedBarcode] = await read('label_scans', '*', { barcode });
    if (cached || cachedBarcode) {
      // Clean up uploaded file if present
      try { fs.unlinkSync(req.file.path); } catch {}
      return res.status(200).json({ success: true, ...cachedBarcode, fromCache: true });
    }
  } catch (dbReadErr) {
    // Log but do not fail request
    console.warn("Cache read failed:", dbReadErr.message);
  }

  // Step 4: Upload to Cloudinary
  const imagePath = path.join(__dirname, "..", req.file.path);
  let imageUrl;
  try {
    imageUrl = await uploadImageFromUrl(imagePath);
  } catch (uploadError) {
    try { fs.unlinkSync(imagePath); } catch {}
    return res.status(500).json({ success: false, message: "Image upload failed" });
  } finally {
    // Clean up local file regardless of upload success/failure
    try { fs.unlinkSync(imagePath); } catch {}
  }

  // Step 5: Get health score
  let healthData;
  try {
    healthData = await getHealthScore(ocrText);
  } catch (healthErr) {
    return res.status(500).json({ success: false, message: "Health score fetch failed" });
  }
  if (!healthData) {
    return res.status(500).json({ success: false, message: "Health data not returned" });
  }

  // Step 6: Prepare new record
  const newObject = {
    name: productName,
    barcode,
    ocrText,
    healthScore: healthData.healthScore,
    ingredients: JSON.stringify(healthData.ingredients),
    imageUrl,
    recommendation: healthData.recommendation,
    harmfulIngredients: JSON.stringify(healthData.harmfulIngredients),
    summaryNote: healthData.summaryNote,
    ocrHash,
  };

  // Step 7: Save to DB
  try {
    const insertResult = await create('label_scans', newObject);
    newObject.id = insertResult.insertId;
  } catch (dbWriteErr) {
    return res.status(500).json({ success: false, message: "Failed to save scan result" });
  }

  // Step 8: Respond with success (only necessary fields)
  return res.status(200).json({
    success: true,
    id: newObject.id,
    name: newObject.name,
    barcode: newObject.barcode,
    ocrText: newObject.ocrText,
    healthScore: newObject.healthScore,
    ingredients: newObject.ingredients,
    imageUrl: newObject.imageUrl,
    recommendation: newObject.recommendation,
    harmfulIngredients: newObject.harmfulIngredients,
    summaryNote: newObject.summaryNote,
    fromCache: false,
  });
};


const scanIngredients1 = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "No image uploaded" });
  }

  const imagePath = path.join(__dirname, "..", req.file.path);

  try {
    // Step 1: OCR using Tesseract
    const result = await Tesseract.recognize(imagePath, "eng");
    const rawText = result.data.text;
    const ocrHash = hashText(rawText);

    // Clean up image file
    fs.unlink(imagePath, (err) => {
      if (err) console.error("Error deleting file:", err);
    });

    // Step 2: Check Mongo cache
    const cached = await LabelScan.findOne({ ocrHash },{ingredients:1,harmfulIngredients:1,healthScore:1,recommendation:1,_id:1});
    if (cached) {
      return res.json({ ...cached.toObject(), fromCache: true });
    }

    // Step 3: Prompt GPT
    const prompt = `
         You're a nutrition expert helping users understand food labels and make safe choices.

          1. Given the raw OCR text of a food label, extract a clean list of **ingredients**.
          2. Identify and explain **any harmful or controversial ingredients**. Be specific about why.
          3. Assign a **health score** from 1 to 5 (5 = very healthy, 1 = avoid).
          4. Based on the ingredients, give an **honest recommendation**: Should the user eat it or not? Be clear and empathetic.
          5. Be neutral — if it's okay occasionally, say so. If it should be avoided, explain why.

          OCR Text:
          """
          ${rawText}
          """

          Respond in strict JSON like:
          {
            "ingredients": [...],
            "harmfulIngredients": [
              {
                "name": "X",
                "riskLevel": "high",
                "reason": "..."
              }
            ],
            "healthScore": 2,
            "recommendation": "Avoid this snack due to high sugar and chemical additives. Not suitable for daily consumption."
          }
                        `;

    const completion = await openai.chat.completions.create({
      response_format: { type: "json_object" },
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.4,
    });

    const gptText = completion.choices[0].message.content;
    const parsed = JSON.parse(gptText);

    const newScan = await LabelScan.create({
      ocrHash,
      rawText,
      ingredients: parsed.ingredients,
      harmfulIngredients: parsed.harmfulIngredients,
      healthScore: parsed.healthScore,
      approved: false,
      recommendation: parsed.recommendation,
      source: "user-scan",
    });

    res.json({
      _id: newScan._id,
      ingredients: parsed.ingredients,
      harmfulIngredients: parsed.harmfulIngredients,
      healthScore: parsed.healthScore,
      recommendation: parsed.recommendation,
      fromCache: false
    });
  } catch (error) {
    console.error("❌ ScanLabel error:", error.message);
    res.status(500).json({
      message: "Failed to scan and analyze label",
      error: error.message,
    });
  }
};

const validateImage = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "No image uploaded" });
  }

  const imagePath = path.join(__dirname, "..", req.file.path);

  try {
    // Step 1: OCR using Tesseract
    const result = await Tesseract.recognize(imagePath, "eng");
    const rawText = result.data.text;
    const cleanText = rawText.replace(/[^a-zA-Z\s]/g, ' ');
    const isValid = /(ingredients?|contains?|sugar|salt|milk)/i.test(cleanText);
    if(isValid){
      fs.unlink(imagePath, (err) => {
        if (err) console.error("Error deleting file:", err);
      });
    }
    // const isValid = /(ingredients|contains|sugar|salt|milk)/.test(rawText);
    res.json({ isValid, text:cleanText });

    }catch (error) {
      console.error("❌ ScanLabel error:", error.message);
      res.status(500).json({
        message: "Failed to validate image",
        error: error.message,
      });
    }
}

const labelScanData = async (req, res) => {
  try {
    const id = req.params.id;
    const [result] = await read('label_scans','*',{id});
    if(!result){
      return res.status(404).json({ message: 'Label data not found' });
    }
    const returnObject = {
      ...result,
      harmfulIngredients: JSON.parse(result.harmfulIngredients),
      ingredients: JSON.parse(result.ingredients),
    }
    console.log(result);
    // const result = await LabelScan.findOne({ _id: id },{ingredients:1,harmfulIngredients:1,healthScore:1,recommendation:1,_id:1});
    return res.json(returnObject);
  } catch (error) {
    console.error('❌ API Error:', error);
    return res.status(500).json({ message: 'Failed to fetch label data' });
  }
};


   

module.exports = {
  scanIngredients,
  validateImage,
  labelScanData,
};
