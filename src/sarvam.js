let currentAudio = null;

/**
 * Stop any active Sarvam audio playback
 */
export function stopSarvamAudio() {
  if (currentAudio) {
    try {
      currentAudio.pause();
    } catch (e) {
      console.warn('Error pausing audio:', e);
    }
    currentAudio = null;
  }
}

/**
 * Speak text using the Sarvam AI TTS API
 * @param {string} text — Text to convert to speech
 * @param {string} apiKey — Sarvam AI subscription key
 * @param {Function} [onEndedCallback] — Callback when audio ends
 * @returns {Promise<boolean>} True if successful, false otherwise (triggers fallback)
 */
export async function speakWithSarvam(text, apiKey, onEndedCallback) {
  if (!apiKey || apiKey === 'PASTE_YOUR_SARVAM_KEY_HERE') {
    return false;
  }

  // Stop any active audio before starting a new one
  stopSarvamAudio();

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
      
      currentAudio = new Audio(audioUrl);
      
      if (onEndedCallback) {
        currentAudio.onended = () => {
          onEndedCallback();
          currentAudio = null;
        };
      }
      
      // Attempt to play the audio
      await currentAudio.play();
      return true;
    }
  } catch (err) {
    console.error('Sarvam TTS execution failed:', err);
  }
  return false;
}
