const { OpenAI } = require("openai");
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const getHealthScore = async (rawText) => {
  try {
    const prompt = `You're a nutrition-aware assistant specializing in Indian packaged foods. Given the OCR text containing ingredients and nutrition values, your goals are to:

      1. Clean the ingredient list — Correct common OCR errors using best guesses and context (e.g., “Tell’ le” might be “Vegetable Oil”), and discard illegible or non-ingredient text.
      2. Extract a list of clear ingredients from the cleaned data.
      3. Check each ingredient against a reference list of potentially harmful, controversial, or allergenic items (e.g., artificial sweeteners, emulsifiers, preservatives, soy, gluten, etc.)
      4. Assign a health score from 1 (worst) to 5 (best), based on the combination of:
        - Natural/whole food content (+1)
        - Vitamins or fiber (+1)
        - Presence of 2+ additives (-1)
        - High sugar/sodium or allergen-prone ingredients (-1)
      5. Write a recommendation for the general public. Mention when something is safe in moderation or should be avoided by specific people.
      6. End with a concise summary note.
      7. If ingredients suggest age-related suitability (e.g., caffeine, high protein, vitamin-fortified), mention who may benefit or should avoid it.

      OCR Text:
          """
          ${rawText}
          """

      If there are no major health risks, say so in reassuring, simple terms.

      Clarify if the food is:

      Suitable for frequent, occasional, or rare consumption

      More suitable or less suitable for certain age groups or health conditions

      Use neutral, supportive language that is easy to understand.


      Response Format
      Use well-structured JSON, as below:

      json
      {
        "ingredients": ["ingredient1", "ingredient2", ...],
        "harmfulIngredients": [
          {
            "name": "ingredient name",
            "riskLevel": "low | moderate | high",
            "reason": "Explain the risk in 1–2 simple sentences."
          }
        ],
        "healthScore": 3,
        "recommendation": "Provide a clear, friendly, and neutral recommendation suitable for general users. Mention if it's okay for regular or occasional use, and highlight any key considerations.",
        "summaryNote": "A quick summary of the overall health assessment, suitable for non-experts."
      }
      If there are no harmful ingredients, keep the harmfulIngredients array empty and clearly state this in the recommendation and summary.

      Always make your explanations neutral and avoid alarming language—even for less healthy products.`;

    // console.log(prompt);
    const completion = await openai.chat.completions.create({
      response_format: { type: "json_object" },
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.4,
    });

    const gptText = completion.choices[0].message.content;
    const parsed = JSON.parse(gptText);

    return parsed;
  } catch (e) {
    console.log({ e });
    return "";
  }
};

module.exports = { getHealthScore };
