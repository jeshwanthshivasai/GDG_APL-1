/**
 * main.js — Application entry point & orchestration
 * Wires together camera, voice, Gemini AI, and UI modules.
 */

import { CameraManager } from './camera.js';
import { VoiceManager } from './voice.js';
import { initGemini, analyzeWithVoiceAndCamera, analyzeVoiceOnly, isReady, setGeminiModel, getGeminiModel } from './gemini.js';
import { speakWithSarvam, stopSarvamAudio } from './sarvam.js';
import * as UI from './ui.js';

// ─── Variables & Configuration ────────────────────────────────
let activeGeminiKey = localStorage.getItem('daiy_gemini_key') || localStorage.getItem('fixit_gemini_key') || import.meta.env.VITE_GEMINI_API_KEY;
let activeSarvamKey = localStorage.getItem('daiy_sarvam_key') || localStorage.getItem('fixit_sarvam_key') || import.meta.env.VITE_SARVAM_API_KEY;
let activeGeminiModel = localStorage.getItem('daiy_gemini_model') || localStorage.getItem('fixit_gemini_model') || import.meta.env.VITE_GEMINI_MODEL || 'gemini-2.5-flash';

const camera = new CameraManager();
const voice = new VoiceManager();

/**
 * Apply the selected theme (light vs dark)
 */
function applyTheme(theme) {
  const moonIcon = document.querySelector('.theme-icon-moon');
  const sunIcon = document.querySelector('.theme-icon-sun');
  
  if (theme === 'light') {
    document.body.classList.add('light-theme');
    if (moonIcon) moonIcon.classList.remove('hidden');
    if (sunIcon) sunIcon.classList.add('hidden');
  } else {
    document.body.classList.remove('light-theme');
    if (moonIcon) moonIcon.classList.add('hidden');
    if (sunIcon) sunIcon.classList.remove('hidden');
  }
}

/**
 * Bootstrap the app
 */
function init() {
  // Load theme preference
  const savedTheme = localStorage.getItem('daiy_theme') || localStorage.getItem('fixit_theme') || 'dark';
  applyTheme(savedTheme);

  // Load configuration
  setGeminiModel(activeGeminiModel);

  // Initialize Gemini
  if (!initGemini(activeGeminiKey)) {
    UI.showSetupOverlay(true);
    // Even if setup overlay is shown, wire up buttons so settings can be opened
    setupButtons();
    return;
  }
  UI.showSetupOverlay(false);

  // 2. Wire up voice callbacks
  setupVoiceCallbacks();

  // 3. Wire up button handlers
  setupButtons();

  // 4. Set initial state
  UI.setStatus('ready', 'Ready');

  console.log('🔧 DAIY initialized with model:', activeGeminiModel);
}

/**
 * Voice module callbacks
 */
function setupVoiceCallbacks() {
  voice.onInterimResult = (text, isInterim) => {
    UI.showTranscript(text, isInterim);
  };

  voice.onFinalResult = async (transcript) => {
    UI.setMicState(false);
    UI.showTranscript(transcript, false);
    await processQuery(transcript);
  };

  voice.onStateChange = (state) => {
    switch (state) {
      case 'listening':
        UI.setStatus('listening', 'Listening...');
        UI.setMicState(true);
        // Auto-start camera when speaking
        if (!camera.isActive && CameraManager.isSupported()) {
          camera.start();
        }
        break;
      case 'idle':
        // Handled by onFinalResult
        break;
      case 'error':
        UI.setMicState(false);
        break;
    }
  };

  voice.onError = (message) => {
    UI.showError(message);
  };
}

/**
 * Process a voice query — capture camera frame + send to Gemini
 */
async function processQuery(transcript) {
  if (!transcript || !isReady()) return;

  UI.setStatus('thinking', 'Analyzing...');
  UI.showThinking();
  camera.startScanning();

  try {
    let responseText;
    let usedCamera = false;

    // Try to capture a camera frame
    const imageBase64 = camera.captureFrameBase64();

    if (imageBase64) {
      // Multimodal: voice + camera
      usedCamera = true;
      responseText = await analyzeWithVoiceAndCamera(transcript, imageBase64);
    } else {
      // Voice only
      responseText = await analyzeVoiceOnly(transcript);
    }

    // Display response
    UI.showResponse(responseText, usedCamera);
    UI.addHistoryItem(transcript, responseText, usedCamera);
    UI.setStatus('ready', 'Ready');

    // Speak the response (optional — use Web Speech Synthesis)
    speakResponse(responseText);
  } catch (err) {
    console.error('Gemini API error:', err);
    UI.showResponse('⚠️ Something went wrong while analyzing. Please try again.\n\nError: ' + err.message, false);
    UI.setStatus('error', 'Error');
    setTimeout(() => UI.setStatus('ready', 'Ready'), 3000);
  } finally {
    camera.stopScanning();
  }
}

/**
 * Speak the AI response using Sarvam AI (primary) or Web Speech Synthesis (fallback)
 */
async function speakResponse(text) {
  const btnStop = document.getElementById('btn-stop-audio');
  
  const hideStopButton = () => {
    if (btnStop) btnStop.style.display = 'none';
  };

  const showStopButton = () => {
    if (btnStop) btnStop.style.display = 'inline-flex';
  };

  // 1. Try Sarvam AI TTS if key is present
  if (activeSarvamKey) {
    showStopButton();
    const success = await speakWithSarvam(text, activeSarvamKey, hideStopButton);
    if (success) return; // Speak succeeded
    hideStopButton(); // Fallback failed
  }

  // 2. Fallback to native Web Speech Synthesis
  if (!('speechSynthesis' in window)) return;

  // Cancel any ongoing speech
  window.speechSynthesis.cancel();

  // Strip markdown for speech
  const cleanText = text
    .replace(/[#*`_~]/g, '')
    .replace(/\[.*?\]\(.*?\)/g, '')
    .split('\n')
    .filter((l) => l.trim())
    .join('. ')
    .substring(0, 500); // Limit speech length

  const utterance = new SpeechSynthesisUtterance(cleanText);
  utterance.rate = 1.0;
  utterance.pitch = 1.0;
  utterance.volume = 0.8;

  utterance.onstart = showStopButton;
  utterance.onend = hideStopButton;
  utterance.onerror = hideStopButton;

  window.speechSynthesis.speak(utterance);
}

/**
 * Wire up UI button handlers
 */
function setupButtons() {
  // Mic button
  const btnMic = document.getElementById('btn-mic');
  btnMic.addEventListener('click', () => {
    if (voice.isListening) {
      voice.stop();
    } else {
      UI.hideResponse();
      UI.resetTranscript();
      voice.start();
    }
  });

  // Camera toggle
  const btnToggleCamera = document.getElementById('btn-toggle-camera');
  btnToggleCamera.addEventListener('click', () => {
    camera.toggle();
  });

  // Camera flip
  const btnFlipCamera = document.getElementById('btn-flip-camera');
  btnFlipCamera.addEventListener('click', () => {
    camera.flip();
  });

  // Clear history
  const btnClearHistory = document.getElementById('btn-clear-history');
  btnClearHistory.addEventListener('click', () => {
    UI.clearHistory();
  });

  // Theme toggle button
  const btnThemeToggle = document.getElementById('btn-theme-toggle');
  if (btnThemeToggle) {
    btnThemeToggle.addEventListener('click', () => {
      const currentTheme = document.body.classList.contains('light-theme') ? 'light' : 'dark';
      const newTheme = currentTheme === 'light' ? 'dark' : 'light';
      localStorage.setItem('daiy_theme', newTheme);
      applyTheme(newTheme);
    });
  }

  // Settings elements
  const dialogSettings = document.getElementById('settings-dialog');
  const btnSettings = document.getElementById('btn-settings');
  const btnCloseSettings = document.getElementById('btn-close-settings');
  const btnCancelSettings = document.getElementById('btn-cancel-settings');
  const btnSaveSettings = document.getElementById('btn-save-settings');

  const inputGeminiKey = document.getElementById('input-gemini-key');
  const selectGeminiModel = document.getElementById('select-gemini-model');
  const inputSarvamKey = document.getElementById('input-sarvam-key');

  // Open settings
  btnSettings.addEventListener('click', () => {
    inputGeminiKey.value = localStorage.getItem('daiy_gemini_key') || localStorage.getItem('fixit_gemini_key') || '';
    selectGeminiModel.value = getGeminiModel();
    inputSarvamKey.value = localStorage.getItem('daiy_sarvam_key') || localStorage.getItem('fixit_sarvam_key') || '';
    dialogSettings.showModal();
  });

  // Close / Cancel settings
  const closeSettings = () => dialogSettings.close();
  btnCloseSettings.addEventListener('click', closeSettings);
  btnCancelSettings.addEventListener('click', closeSettings);

  // Save settings
  btnSaveSettings.addEventListener('click', () => {
    const newGeminiKey = inputGeminiKey.value.trim();
    const newModel = selectGeminiModel.value;
    const newSarvamKey = inputSarvamKey.value.trim();

    // Store keys in LocalStorage
    if (newGeminiKey) {
      localStorage.setItem('daiy_gemini_key', newGeminiKey);
      activeGeminiKey = newGeminiKey;
    } else {
      localStorage.removeItem('daiy_gemini_key');
      localStorage.removeItem('fixit_gemini_key');
      activeGeminiKey = import.meta.env.VITE_GEMINI_API_KEY;
    }

    localStorage.setItem('daiy_gemini_model', newModel);
    activeGeminiModel = newModel;
    setGeminiModel(newModel);

    if (newSarvamKey) {
      localStorage.setItem('daiy_sarvam_key', newSarvamKey);
      activeSarvamKey = newSarvamKey;
    } else {
      localStorage.removeItem('daiy_sarvam_key');
      localStorage.removeItem('fixit_sarvam_key');
      activeSarvamKey = import.meta.env.VITE_SARVAM_API_KEY;
    }

    // Re-initialize Gemini
    if (initGemini(activeGeminiKey)) {
      UI.showSetupOverlay(false);
      // Re-setup callbacks
      setupVoiceCallbacks();
      UI.setStatus('ready', `Ready (${newModel})`);
    } else {
      UI.showSetupOverlay(true);
    }

    closeSettings();
  });

  // Setup overlay save button
  const btnSaveSetup = document.getElementById('btn-save-setup');
  if (btnSaveSetup) {
    btnSaveSetup.addEventListener('click', () => {
      const inputSetupGemini = document.getElementById('setup-gemini-key');
      const inputSetupSarvam = document.getElementById('setup-sarvam-key');
      
      const geminiVal = inputSetupGemini.value.trim();
      const sarvamVal = inputSetupSarvam.value.trim();
      
      if (!geminiVal) {
        UI.showError('Gemini API key is required!');
        return;
      }
      
      localStorage.setItem('daiy_gemini_key', geminiVal);
      activeGeminiKey = geminiVal;
      
      if (sarvamVal) {
        localStorage.setItem('daiy_sarvam_key', sarvamVal);
        activeSarvamKey = sarvamVal;
      }
      
      // Attempt restart
      if (initGemini(activeGeminiKey)) {
        UI.showSetupOverlay(false);
        setupVoiceCallbacks();
        UI.setStatus('ready', `Ready (${activeGeminiModel})`);
      } else {
        UI.showError('Invalid Gemini API Key');
      }
    });
  }

  // Mute/Stop speech button
  const btnStopAudio = document.getElementById('btn-stop-audio');
  if (btnStopAudio) {
    btnStopAudio.addEventListener('click', () => {
      stopSarvamAudio();
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      btnStopAudio.style.display = 'none';
    });
  }

  // New Chat button
  const btnNewChat = document.getElementById('btn-new-chat');
  if (btnNewChat) {
    btnNewChat.addEventListener('click', () => {
      // 1. Stop any speaking
      if (btnStopAudio) btnStopAudio.click();
      
      // 2. Reset UI panels
      UI.resetTranscript();
      UI.hideResponse();
      
      // 3. Reset state
      UI.setStatus('ready', `Ready (${activeGeminiModel})`);
    });
  }

  // Keyboard shortcut: Space to toggle mic
  document.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && e.target === document.body) {
      e.preventDefault();
      btnMic.click();
    }
  });
}

// ─── Launch ──────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', init);
