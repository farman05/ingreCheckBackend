const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { scanIngredients, validateImage, labelScanData} = require('../controllers/ocr');

const storage = multer.diskStorage({
  destination: 'uploads/',
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});

const upload = multer({ storage });

router.post('/label', upload.single('image'), scanIngredients);
router.get('/label/:id', labelScanData);
router.post('/validateImage', upload.single('image'), validateImage);

module.exports = router;
