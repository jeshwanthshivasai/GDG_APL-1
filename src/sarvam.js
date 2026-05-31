/**
 * sarvam.js — Sarvam AI Text-to-Speech API helper
 * Converts text into natural, Indian-accented speech using Sarvam's Bulbul model.
 */

/**
 * Speak text using the Sarvam AI TTS API
 * @param {string} text — Text to convert to speech
 * @param {string} apiKey — Sarvam AI subscription key
 * @returns {Promise<boolean>} True if successful, false otherwise (triggers fallback)
 */
export async function speakWithSarvam(text, apiKey) {
  if (!apiKey || apiKey === 'PASTE_YOUR_SARVAM_KEY_HERE') {
    return false;
  }

  // Strip markdown styling to keep speech natural
  const cleanText = text
    .replace(/[#*`_~]/g, '')
    .replace(/\[.*?\]\(.*?\)/g, '')
    .split('\n')
    .filter((l) => l.trim())
    .join('. ')
    .substring(0, 500); // Keep chunk reasonably short for fast TTS response

  try {
    const response = await fetch('https://api.sarvam.ai/text-to-speech', {
      method: 'POST',
      headers: {
        'api-subscription-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: cleanText,
        target_language_code: 'en-IN', // Indian accent English
        speaker: 'shubh', // Good clear male voice
        model: 'bulbul:v3',
        output_audio_codec: 'mp3'
      }),
    });

    if (!response.ok) {
      console.warn(`Sarvam AI returned status ${response.status}`);
      return false;
    }

    const data = await response.json();
    if (data.audios && data.audios[0]) {
      const base64Audio = data.audios[0];
      const audioUrl = `data:audio/mp3;base64,${base64Audio}`;
      const audio = new Audio(audioUrl);
      
      // Attempt to play the audio
      await audio.play();
      return true;
    }
  } catch (err) {
    console.error('Sarvam TTS execution failed:', err);
  }
  return false;
}
