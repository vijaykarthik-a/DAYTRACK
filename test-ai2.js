import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.VITE_GOOGLE_API_KEY });

async function test() {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: "Hello",
    });
    console.log("Success:", response.text);
  } catch (e) {
    console.error("Error:", e);
  }
}

test();
