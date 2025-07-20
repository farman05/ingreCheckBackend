const axios = require("axios");
const sharp = require("sharp");
const INGREDIENT_REGEX = /(ingredients|contains|composition|made from|made with)/i;

async function downloadImageWithRetry(url, retries = MAX_RETRIES) {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const res = await axios.get(url, {
          responseType: 'arraybuffer',
          timeout: 15000,
        });
        return Buffer.from(res.data, 'binary');
      } catch (err) {
        if (attempt === retries) throw err;
        console.warn(`🔁 Retry ${attempt} for image: ${url}`);
      }
    }
  }

async function preprocessImage(buffer) {
    return await sharp(buffer)
      .resize({ width: 1200 })
      .grayscale()
      .sharpen()
      .toBuffer();
  }

  function extractIngredients(text) {
    const lines = text.split('\n');
    let found = false;
    const result = [];
  
    for (const line of lines) {
      const lower = line.toLowerCase();
      if (!found && INGREDIENT_REGEX.test(lower)) {
        found = true;
      }
  
      if (found) {
        if (
          lower.includes('nutritional') ||
          lower.includes('manufactured') ||
          lower.includes('storage') ||
          lower.includes('expiry')
        )
          break;
        result.push(line.trim());
      }
    }
  
    return found ? result.join(' ') : null;
  }

  function sortImageUrlsByTimestamp(urls) {
    return urls
      .map((url) => {
        try {
          const innerUrl = decodeURIComponent(new URL(url).searchParams.get('url'));
          const match = innerUrl.match(/\/(\d+)\.png/); // Extract timestamp like 1738065538698.png
          if (match) {
            return { url, timestamp: Number(match[1]) };
          }
        } catch (e) {
          console.error("Invalid URL:", url);
        }
        return null;
      })
      .filter(Boolean)
      .sort((a, b) => a.timestamp - b.timestamp)
      .map((obj) => obj.url);
  }
  module.exports = { downloadImageWithRetry, preprocessImage,extractIngredients, sortImageUrlsByTimestamp };