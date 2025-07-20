const products = require('../data/products.json');
const {read, create, update, execute} = require('mysql-helper-kit');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const { createWorker } = require('tesseract.js');
const {extractIngredients,sortImageUrlsByTimestamp} = require('../utils/helper');
const failedPath = path.join(__dirname, "..", "failed.json");
const {uploadImageFromUrl} = require('../utils/cloudinary');
const {getHealthScore} = require('../utils/openai');
const getProductByBarcode = async(req, res) => {
  const { barcode } = req.params;
  try {
    const [result] = await read('products','*',{barcode});
    if(!result){
      return res.status(404).json({ message: 'Product not found' });
    }
    let isUpdated = false
    const {healthScore,imageUrl,ocrText} = result;
    if(!imageUrl.includes('cloudinary.com')){
      const secureUrl = await uploadImageFromUrl(imageUrl);
      if(secureUrl){
        isUpdated = true;
        result.imageUrl = secureUrl;
      }
    }

    if(!healthScore){
      const healthScoreData = await getHealthScore(ocrText);
      if(healthScoreData){
        isUpdated = true;
        result.healthScore = healthScoreData.healthScore;
        result.harmfulIngredients = JSON.stringify(healthScoreData.harmfulIngredients);
        result.ingredients = JSON.stringify(healthScoreData.ingredients);
        result.recommendation = healthScoreData.recommendation;
        result.summaryNote = healthScoreData.summaryNote
      }
    }

    if(isUpdated){
      await update('products',result,{barcode});
    }

    const returnObject = {
      id: result.id,
      name: result.name,
      barcode: result.barcode,
      imageUrl: result.imageUrl,
      healthScore: result.healthScore,
      harmfulIngredients: JSON.parse(result.harmfulIngredients),
      ingredients: JSON.parse(result.ingredients),
      recommendation: result.recommendation
    }
    return res.json(returnObject);


  } catch (error) {
    console.error('❌ API Error:', error);
    return res.status(500).json({ message: 'Failed to fetch label data' });
  }
  // const product = products.find((item) => item.barcode === barcode);

  // if (!product) {
  //   return res.status(404).json({ message: 'Product not found' });
  // }

  // res.json(product);
};

const productList = async(req, res) => {
  try {
      const result = await read('products','*');
      return res.json(result);
  } catch (error) {
      return res.status(500).json({ message: 'Something went wrong' });
  }
};

const failed = async(req,res)=>{
  try {
    const data = fs.readFileSync(failedPath, "utf-8");
    const result = JSON.parse(data);
    return res.json(result);
  } catch (error) {
    console.error('❌ API Error:', error);
    return res.status(500).json({ message: 'Failed to fetch label data' });
  }
}

const uploadFailedImage = async (req, res) => {
  const { url, name, barcode, imagePath } = req.body;

  if (!url || !name || !barcode) {
    return res.status(400).json({ error: 'Missing required fields: url, name, barcode' });
  }

  const tempFilename = path.join('/tmp', `img-${Date.now()}.jpg`);
  const worker = await createWorker();

  try {
    // Step 1: Download image
    const response = await axios.get(url, { responseType: 'arraybuffer' });
    fs.writeFileSync(tempFilename, response.data);

    // Step 2: OCR using Tesseract
    // await worker.loadLanguage('eng');
    // await worker.initialize('eng');
    const { data } = await worker.recognize(tempFilename);
    const extractedText = data.text.toLowerCase();
    const ingredients = extractIngredients(extractedText);
    
    if (!ingredients || !ingredients.trim()) {
      return res.status(200).json({ message: 'No ingredients found from OCR', ingredients: null });
    }

    const image = sortImageUrlsByTimestamp(imagePath);

    // Step 3: DB operations
    const existing = await read('products', '*', { barcode });
    const dbPayload = {
      name,
      barcode,
      ocrText: ingredients.trim(),
      imageUrl: image[0],
      addedBy: 'admin',
    };

    if (!existing?.length) {
      dbPayload.ingredients = JSON.stringify([]); // only during insert
      await create('products', dbPayload);
    } else {
      await update('products', dbPayload, { id: existing[0].id });
    }

    // Step 4: Remove from failed list
    try {
      const failedRaw = fs.readFileSync(failedPath, 'utf-8');
      const failedProducts = JSON.parse(failedRaw);
      const updatedList = failedProducts.filter((product) => product.barcode !== barcode);
      fs.writeFileSync(failedPath, JSON.stringify(updatedList, null, 2), 'utf-8');
    } catch (jsonErr) {
      console.warn('Failed to clean up from failed list:', jsonErr.message);
    }

    return res.status(200).json({
      success: true,
      message: 'OCR and DB update successful',
      ingredients: ingredients.trim(),
    });

  } catch (error) {
    console.error('Upload processing failed:', error);
    return res.status(500).json({ error: 'Failed to process image or save data', details: error.message });
  } finally {
    await worker.terminate();
    if (fs.existsSync(tempFilename)) {
      fs.unlinkSync(tempFilename);
    }
  }
};

const searchProductsByName = async (req, res) => {
  const { name } = req.body;
  
  if (!name) {
    return res.status(400).json({ message: 'Name parameter is required' });
  }
  
  try {
    const query = 'SELECT * FROM products WHERE name LIKE ?';
    const searchTerm = `%${name}%`;
    const results = await execute(query, [searchTerm]);
    
    if (results.length === 0) {
      return res.status(404).json({ message: 'No products found matching the search criteria' });
    }
    
    // Format the results to match the structure used in other functions
    const formattedResults = results.map(product => ({
      id: product.id,
      name: product.name,
      barcode: product.barcode,
      imageUrl: product.imageUrl,
      healthScore: product.healthScore,
      harmfulIngredients: product.harmfulIngredients ? JSON.parse(product.harmfulIngredients) : [],
      ingredients: product.ingredients ? JSON.parse(product.ingredients) : [],
      recommendation: product.recommendation,
      summaryNote: product.summaryNote
    }));
    
    return res.json({
      message: `Found ${results.length} product(s)`,
      products: formattedResults
    });
    
  } catch (error) {
    console.error('❌ Search Error:', error);
    return res.status(500).json({ message: 'Failed to search products' });
  }
};

module.exports = {
  getProductByBarcode,
  productList,
  failed,
  uploadFailedImage,
  searchProductsByName
};
