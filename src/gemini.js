/**
 * gemini.js — Gemini API integration module
 * Handles multimodal (voice + camera) analysis using Google's Gemini SDK.
 */

import { GoogleGenAI } from '@google/genai';

const SYSTEM_PROMPT = `You are FixIt AI, an expert product support technician and diagnostic agent. You help customers troubleshoot and fix issues with their electronic devices, appliances, and tech products.

BEHAVIOR:
- Be warm, professional, and reassuring. Customers are often frustrated — calm them down.
- Give clear, step-by-step troubleshooting instructions.
- When you receive BOTH a voice description AND a camera image, analyze the image carefully for visual clues (LEDs, damage, model numbers, error screens, cable connections, etc.)
- When you receive only a voice description, ask targeted questions to narrow down the issue.
- Always structure your response clearly.

RESPONSE FORMAT (use markdown):
Start with a brief **diagnosis** in bold, then provide numbered steps.
If you see something in the image, reference it specifically (e.g., "I can see the red blinking LED on your router...").
End with a "Still not working?" section with next steps.

IMPORTANT:
- Keep responses concise but thorough (aim for 150-250 words).
- If the image is unclear or you can't identify the device, say so honestly and ask for a better angle.
- If the problem seems hardware-related and unfixable by the user, recommend professional service.
- You can handle: routers, printers, laptops, monitors, phones, smart home devices, appliances, TVs, gaming consoles, etc.`;

let ai = null;

/**
 * Initialize the Gemini client
 */
export function initGemini(apiKey) {
  if (!apiKey || apiKey === 'PASTE_YOUR_API_KEY_HERE') {
    return false;
  }
  ai = new GoogleGenAI({ apiKey });
  return true;
}

let activeModelName = import.meta.env.VITE_GEMINI_MODEL || 'gemini-2.5-flash';

export function setGeminiModel(modelName) {
  activeModelName = modelName;
}

export function getGeminiModel() {
  return activeModelName;
}


/**
 * Analyze issue using both voice transcript + camera image (multimodal)
 * @param {string} transcript — The user's voice description
 * @param {string} imageBase64 — Base64-encoded JPEG image (no prefix)
 * @returns {Promise<string>} AI response text
 */
export async function analyzeWithVoiceAndCamera(transcript, imageBase64) {
  if (!ai) throw new Error('Gemini not initialized');

  const contents = [
    {
      inlineData: {
        mimeType: 'image/jpeg',
        data: imageBase64,
      },
    },
    {
      text: `CUSTOMER VOICE DESCRIPTION: "${transcript}"

Please analyze both what the customer said and what you see in the camera image to provide a diagnosis and troubleshooting steps.`,
    },
  ];

  const response = await ai.models.generateContent({
    model: activeModelName,
    contents: contents,
    config: {
      systemInstruction: SYSTEM_PROMPT,
      temperature: 0.7,
      maxOutputTokens: 1024,
    },
  });

  return response.text;
}

/**
 * Analyze issue using voice transcript only (no camera)
 * @param {string} transcript — The user's voice description
 * @returns {Promise<string>} AI response text
 */
export async function analyzeVoiceOnly(transcript) {
  if (!ai) throw new Error('Gemini not initialized');

  const response = await ai.models.generateContent({
    model: activeModelName,
    contents: `CUSTOMER VOICE DESCRIPTION: "${transcript}"

The customer did not provide a camera image. Based on their description, provide a diagnosis and troubleshooting steps. If seeing the device would help, ask them to show it to the camera.`,
    config: {
      systemInstruction: SYSTEM_PROMPT,
      temperature: 0.7,
      maxOutputTokens: 1024,
    },
  });

  return response.text;
}

/**
 * Check if Gemini is initialized and ready
 */
export function isReady() {
  return ai !== null;
}
