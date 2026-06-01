/**
 * main.js — Application entry point & orchestration
 * Wires together camera, voice, Gemini AI, analytics, onboarding, and UI modules.
 */

import { CameraManager } from './camera.js';
import { VoiceManager } from './voice.js';
import { initGemini, analyzeWithVoiceAndCamera, analyzeVoiceOnly, isReady, setGeminiModel, getGeminiModel } from './gemini.js';
import { speakWithSarvam, stopSarvamAudio } from './sarvam.js';
import { initAnalytics, trackQuery } from './analytics.js';
import { startOnboarding } from './onboarding.js';
import * as UI from './ui.js';

// ─── Variables & Configuration ────────────────────────────────
// API keys are baked in at build time via Vercel env vars — no user input needed
const activeGeminiKey = import.meta.env.VITE_GEMINI_API_KEY;
const activeSarvamKey = import.meta.env.VITE_SARVAM_API_KEY;
const activeGeminiModel = import.meta.env.VITE_GEMINI_MODEL || 'gemini-2.5-flash';

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
  // 1. Load theme preference
  const savedTheme = localStorage.getItem('daiy_theme') || 'dark';
  applyTheme(savedTheme);

  // 2. Load configuration
  setGeminiModel(activeGeminiModel);

  // 3. Initialize Gemini
  if (!initGemini(activeGeminiKey)) {
    UI.showServiceError();
    setupButtons();
    return;
  }

  // 4. Wire up voice callbacks
  setupVoiceCallbacks();

  // 5. Wire up button handlers
  setupButtons();

  // 6. Set initial state
  UI.setStatus('ready', 'Ready');
  UI.loadHistoryFromStorage();

  // 7. Initialize analytics (non-blocking)
  initAnalytics();

  // 8. Show onboarding tour for first-time users
  startOnboarding();

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

    // Track the query for analytics
    trackQuery(transcript, usedCamera);

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
      UI.setStatus('ready', 'Ready');
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
