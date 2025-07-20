require('dotenv').config();

const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const productRoutes = require('./routes/product');
const ocrRoutes = require('./routes/ocr');
const connectDB = require('./config/db');
require('./config/mysql');
connectDB();

dotenv.config();
const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.use('/api/products', productRoutes);
app.use('/api/ocr', ocrRoutes);

app.get('/', (req, res) => {
  res.send('Indian Yuka backend is running 🚀');
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
