/**
 * voice.js — Voice input module
 * Uses Web Speech API (SpeechRecognition) for real-time voice capture.
 */

export class VoiceManager {
  constructor() {
    // Check for vendor-prefixed API
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      this.supported = false;
      console.warn('Web Speech API not supported in this browser');
      return;
    }

    this.supported = true;
    this.recognition = new SpeechRecognition();
    this.isListening = false;
    this.finalTranscript = '';
    this.interimTranscript = '';

    // Configuration
    this.recognition.lang = 'en-US';
    this.recognition.interimResults = true;
    this.recognition.continuous = true;
    this.recognition.maxAlternatives = 1;

    // Callbacks (set by main.js)
    this.onInterimResult = null;   // (interimText) => {}
    this.onFinalResult = null;     // (finalText) => {}
    this.onStateChange = null;     // (state) => {}  — 'listening', 'idle', 'error'
    this.onError = null;           // (errorMsg) => {}

    this._setupEventListeners();
  }

  _setupEventListeners() {
    this.recognition.onstart = () => {
      this.isListening = true;
      this.onStateChange?.('listening');
    };

    this.recognition.onend = () => {
      this.isListening = false;

      // If we have a final transcript, emit it
      if (this.finalTranscript.trim()) {
        this.onFinalResult?.(this.finalTranscript.trim());
      }

      this.onStateChange?.('idle');
    };

    this.recognition.onresult = (event) => {
      let interim = '';
      let final = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          final += transcript;
        } else {
          interim += transcript;
        }
      }

      if (final) {
        this.finalTranscript += final;
      }
      this.interimTranscript = interim;

      // Emit interim updates for live display
      const displayText = this.finalTranscript + (interim ? interim : '');
      this.onInterimResult?.(displayText, !!interim);
    };

    this.recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      this.isListening = false;

      const errorMessages = {
        'not-allowed': 'Microphone access denied. Please allow microphone permissions.',
        'no-speech': 'No speech detected. Try speaking louder or closer to the mic.',
        'audio-capture': 'No microphone found. Please connect a microphone.',
        'network': 'Network error. Speech recognition requires internet.',
        'aborted': 'Speech recognition was cancelled.',
      };

      const message = errorMessages[event.error] || `Speech error: ${event.error}`;
      this.onError?.(message);
      this.onStateChange?.('error');
    };
  }

  /**
   * Start listening
   */
  start() {
    if (!this.supported) {
      this.onError?.('Speech recognition not supported in this browser. Please use Chrome.');
      return false;
    }

    this.finalTranscript = '';
    this.interimTranscript = '';

    try {
      this.recognition.start();
      return true;
    } catch (err) {
      // Already started
      console.warn('Recognition already active:', err.message);
      return false;
    }
  }

  /**
   * Stop listening
   */
  stop() {
    if (!this.supported) return;

    try {
      this.recognition.stop();
    } catch (err) {
      console.warn('Recognition stop error:', err.message);
    }
  }

  /**
   * Toggle listening state
   * @returns {boolean} New listening state
   */
  toggle() {
    if (this.isListening) {
      this.stop();
      return false;
    } else {
      this.start();
      return true;
    }
  }

  /**
   * Get the current transcript text
   */
  getTranscript() {
    return this.finalTranscript.trim();
  }

  /**
   * Check if Web Speech API is supported
   */
  static isSupported() {
    return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  }
}
