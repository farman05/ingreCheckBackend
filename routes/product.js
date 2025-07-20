const express = require('express');
const router = express.Router();
const multer = require('multer');
const { getProductByBarcode, productList, failed,uploadFailedImage, searchProductsByName } = require('../controllers/product');

const storage = multer.diskStorage({
    destination: 'uploads/',
    filename: (req, file, cb) => {
      cb(null, Date.now() + path.extname(file.originalname));
    },
});
  
const upload = multer({ storage });

router.get('/failed',failed)
router.get('/:barcode', getProductByBarcode);
router.get('/', productList);
router.post('/uploadFailedImage', uploadFailedImage);
router.post('/search', searchProductsByName);


module.exports = router;
