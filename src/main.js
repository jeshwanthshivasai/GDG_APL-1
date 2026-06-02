/**
 * main.js — Application entry point & orchestration
 */

import { CameraManager } from './camera.js';
import { VoiceManager } from './voice.js';
import { initGemini, analyzeWithVoiceAndCamera, analyzeVoiceOnly, isReady, setGeminiModel } from './gemini.js';
import { speakWithSarvam, stopSarvamAudio } from './sarvam.js';
import { initAnalytics, trackQuery, updateAnalyticsProfile } from './analytics.js';
import { startOnboarding } from './onboarding.js';
import { loadProfile, saveProfile } from './profile.js';
import * as UI from './ui.js';
import {
  auth,
  onAuthChanged,
  signInWithGoogle,
  signInWithEmail,
  signUpWithEmail,
  logout,
  sendVerificationEmail,
  resetPassword
} from './auth.js';

const activeGeminiKey = import.meta.env.VITE_GEMINI_API_KEY;
const activeSarvamKey = import.meta.env.VITE_SARVAM_API_KEY;
const activeGeminiModel = import.meta.env.VITE_GEMINI_MODEL || 'gemini-2.5-flash';

const camera = new CameraManager();
const voice = new VoiceManager();

// ─── Auth Screen ──────────────────────────────────────────────

function showAuthScreen() {
  document.getElementById('auth-screen').classList.remove('hidden');
  document.getElementById('app').classList.add('hidden');
}

function hideAuthScreen() {
  document.getElementById('auth-screen').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
}

function showVerifyScreen(user) {
  document.getElementById('auth-screen').classList.add('hidden');
  document.getElementById('app').classList.add('hidden');
  document.getElementById('verify-screen').classList.remove('hidden');
  document.getElementById('verify-email-address').textContent = user.email;
}

function hideVerifyScreen() {
  document.getElementById('verify-screen').classList.add('hidden');
}

function setupVerifyScreen() {
  document.getElementById('btn-resend-verify').addEventListener('click', async () => {
    const errEl = document.getElementById('verify-error');
    try {
      await sendVerificationEmail(auth.currentUser);
      errEl.textContent = 'Verification email resent — check your inbox.';
      errEl.style.background = 'rgba(16,185,129,0.12)';
      errEl.style.borderColor = 'rgba(16,185,129,0.3)';
      errEl.style.color = '#6ee7b7';
      errEl.classList.remove('hidden');
      setTimeout(() => errEl.classList.add('hidden'), 4000);
    } catch (err) {
      errEl.style.background = '';
      errEl.style.borderColor = '';
      errEl.style.color = '';
      errEl.textContent = err.message;
      errEl.classList.remove('hidden');
    }
  });

  document.getElementById('btn-check-verified').addEventListener('click', async () => {
    await auth.currentUser?.reload();
    if (auth.currentUser?.emailVerified) {
      hideVerifyScreen();
      initApp(auth.currentUser);
    }
  });

  document.getElementById('btn-verify-signout').addEventListener('click', async () => {
    await logout();
  });
}

function setAuthError(msg) {
  const el = document.getElementById('auth-error');
  if (!el) return;
  if (msg) {
    el.textContent = msg;
    el.classList.remove('hidden');
  } else {
    el.classList.add('hidden');
    el.textContent = '';
  }
}

function friendlyAuthError(err) {
  switch (err.code) {
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Invalid email or password.';
    case 'auth/email-already-in-use':
      return 'An account with this email already exists.';
    case 'auth/account-exists-with-different-credential':
      return 'This email is already registered with a password. Use "Sign In" with your password instead.';
    case 'auth/weak-password':
      return 'Password must be at least 6 characters.';
    case 'auth/invalid-email':
      return 'Please enter a valid email address.';
    case 'auth/popup-closed-by-user':
      return 'Sign-in popup was closed. Please try again.';
    case 'auth/too-many-requests':
      return 'Too many failed attempts. Please try again later.';
    default:
      return err.message || 'Something went wrong. Please try again.';
  }
}

function setupAuthUI() {
  const tabLogin = document.getElementById('auth-tab-login');
  const tabSignup = document.getElementById('auth-tab-signup');
  const formLogin = document.getElementById('auth-form-login');
  const formSignup = document.getElementById('auth-form-signup');

  tabLogin.addEventListener('click', () => {
    tabLogin.classList.add('active');
    tabSignup.classList.remove('active');
    formLogin.classList.remove('hidden');
    formSignup.classList.add('hidden');
    setAuthError('');
  });

  tabSignup.addEventListener('click', () => {
    tabSignup.classList.add('active');
    tabLogin.classList.remove('active');
    formSignup.classList.remove('hidden');
    formLogin.classList.add('hidden');
    setAuthError('');
  });

  formLogin.addEventListener('submit', async (e) => {
    e.preventDefault();
    setAuthError('');

    const emailInput = document.getElementById('auth-email');
    const passwordInput = document.getElementById('auth-password');
    const email = emailInput.value.trim();
    const password = passwordInput.value;

    if (!email) { setAuthError('Please enter your email address.'); return; }
    if (!emailInput.checkValidity()) { setAuthError('Please enter a valid email address.'); return; }
    if (!password) { setAuthError('Please enter your password.'); return; }

    const btn = document.getElementById('btn-login');
    btn.disabled = true;
    btn.textContent = 'Signing in…';
    try {
      await signInWithEmail(email, password);
    } catch (err) {
      setAuthError(friendlyAuthError(err));
    } finally {
      btn.disabled = false;
      btn.textContent = 'Sign In';
    }
  });

  formSignup.addEventListener('submit', async (e) => {
    e.preventDefault();
    setAuthError('');

    const emailInput = document.getElementById('auth-signup-email');
    const passwordInput = document.getElementById('auth-signup-password');
    const name = document.getElementById('auth-signup-name').value.trim();
    const email = emailInput.value.trim();
    const password = passwordInput.value;

    if (!email) { setAuthError('Please enter your email address.'); return; }
    if (!emailInput.checkValidity()) { setAuthError('Please enter a valid email address.'); return; }
    if (!password) { setAuthError('Please enter a password.'); return; }
    if (password.length < 6) { setAuthError('Password must be at least 6 characters.'); return; }

    const btn = document.getElementById('btn-signup');
    btn.disabled = true;
    btn.textContent = 'Creating account…';
    try {
      const cred = await signUpWithEmail(email, password, name);
      await sendVerificationEmail(cred.user);
      // onAuthChanged will detect emailVerified=false and show verify screen
    } catch (err) {
      setAuthError(friendlyAuthError(err));
    } finally {
      btn.disabled = false;
      btn.textContent = 'Create Account';
    }
  });

  document.getElementById('btn-google-signin').addEventListener('click', async () => {
    setAuthError('');
    try {
      await signInWithGoogle();
    } catch (err) {
      if (err.code === 'auth/account-exists-with-different-credential') {
        // Switch to Sign In tab and pre-fill their email
        tabLogin.classList.add('active');
        tabSignup.classList.remove('active');
        formLogin.classList.remove('hidden');
        formSignup.classList.add('hidden');
        const conflictEmail = err.customData?.email || '';
        if (conflictEmail) {
          document.getElementById('auth-email').value = conflictEmail;
        }
      }
      setAuthError(friendlyAuthError(err));
    }
  });

  // Forgot password
  document.getElementById('btn-forgot-password').addEventListener('click', async () => {
    const emailInput = document.getElementById('auth-email');
    const email = emailInput.value.trim();
    if (!email || !emailInput.checkValidity()) {
      setAuthError('Enter your email address above first, then click "Forgot password?"');
      emailInput.focus();
      return;
    }
    setAuthError('');
    try {
      await resetPassword(email);
      // Show success in place of error (reuse the box with green styling)
      const errEl = document.getElementById('auth-error');
      errEl.textContent = `Password reset link sent to ${email} — check your inbox.`;
      errEl.style.background = 'rgba(16,185,129,0.12)';
      errEl.style.borderColor = 'rgba(16,185,129,0.3)';
      errEl.style.color = '#6ee7b7';
      errEl.classList.remove('hidden');
    } catch (err) {
      const errEl = document.getElementById('auth-error');
      errEl.style.background = '';
      errEl.style.borderColor = '';
      errEl.style.color = '';
      setAuthError(friendlyAuthError(err));
    }
  });
}

// ─── User Dropdown ────────────────────────────────────────────

function setupUserDropdown() {
  const btnProfile = document.getElementById('btn-profile');
  const dropdown = document.getElementById('user-dropdown');

  btnProfile.addEventListener('click', (e) => {
    e.stopPropagation();
    dropdown.classList.toggle('hidden');
  });

  document.addEventListener('click', () => {
    dropdown.classList.add('hidden');
  });

  document.getElementById('btn-signout').addEventListener('click', async () => {
    dropdown.classList.add('hidden');
    await logout();
  });

  document.getElementById('btn-open-profile').addEventListener('click', () => {
    dropdown.classList.add('hidden');
    openProfileDialog();
  });
}

function openProfileDialog() {
  const profileDialog = document.getElementById('profile-dialog');
  const inputProfileName = document.getElementById('input-profile-name');
  const profileEmailDisplay = document.getElementById('profile-email-display');
  const colorPicker = document.getElementById('profile-color-picker');

  const profile = loadProfile();
  inputProfileName.value = profile.name === 'Guest User' ? '' : profile.name;
  if (profileEmailDisplay) {
    profileEmailDisplay.textContent = auth.currentUser?.email || '';
  }

  if (colorPicker) {
    const selectedColor = profile.avatarColor || '#6366f1';
    colorPicker.querySelectorAll('.color-swatch').forEach(s => {
      s.classList.toggle('active', s.dataset.color === selectedColor);
    });
  }

  profileDialog.showModal();
}

// ─── Theme ────────────────────────────────────────────────────

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

// ─── Header Avatar ────────────────────────────────────────────

function updateHeaderAvatar() {
  const user = auth.currentUser;
  const profile = loadProfile();

  const initialsSpan = document.getElementById('header-avatar-initials');
  const avatarCircle = document.getElementById('header-avatar-circle');
  const avatarPhoto = document.getElementById('header-avatar-photo');
  const dropdownName = document.getElementById('dropdown-name');
  const dropdownEmail = document.getElementById('dropdown-email');

  // Use display name from auth → profile → fallback
  const displayName = user?.displayName || profile.name || 'User';
  const email = user?.email || profile.email || '';
  const photoURL = user?.photoURL || null;

  if (dropdownName) dropdownName.textContent = displayName;
  if (dropdownEmail) dropdownEmail.textContent = email;

  if (avatarPhoto && photoURL) {
    avatarPhoto.src = photoURL;
    avatarPhoto.classList.remove('hidden');
    if (initialsSpan) initialsSpan.classList.add('hidden');
  } else {
    if (avatarPhoto) avatarPhoto.classList.add('hidden');
    if (initialsSpan) initialsSpan.classList.remove('hidden');

    const words = displayName.trim().split(/\s+/);
    let initials = words[0]?.[0] ?? '?';
    if (words.length > 1) initials += words[words.length - 1][0];
    if (initialsSpan) initialsSpan.textContent = initials.substring(0, 2).toUpperCase();
  }

  if (avatarCircle) {
    avatarCircle.style.backgroundColor = photoURL ? 'transparent' : (profile.avatarColor || '#6366f1');
  }
}

// ─── App Init ─────────────────────────────────────────────────

let appInitialized = false;

function initApp(user) {
  // Sync auth user info into local profile (email is authoritative from auth)
  const existingProfile = loadProfile();
  saveProfile({
    ...existingProfile,
    name: existingProfile.name !== 'Guest User' ? existingProfile.name : (user.displayName || 'User'),
    email: user.email || existingProfile.email
  });

  applyTheme(localStorage.getItem('daiy_theme') || 'dark');
  updateHeaderAvatar();
  setGeminiModel(activeGeminiModel);

  if (!initGemini(activeGeminiKey)) {
    UI.showServiceError();
    setupAppButtons();
    return;
  }

  setupVoiceCallbacks();
  setupAppButtons();
  UI.setStatus('ready', 'Ready');
  UI.loadHistoryFromStorage();
  initAnalytics();

  // First-time users get the onboarding tour
  if (!appInitialized) {
    startOnboarding();
    appInitialized = true;
  }

  window.addEventListener('profile-updated', (e) => {
    updateHeaderAvatar();
    updateAnalyticsProfile(e.detail);
  });
}

// ─── Voice ────────────────────────────────────────────────────

function setupVoiceCallbacks() {
  voice.onInterimResult = (text) => {
    UI.showTranscript(text, true);
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
        if (!camera.isActive && CameraManager.isSupported()) camera.start();
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

async function processQuery(transcript) {
  if (!transcript || !isReady()) return;

  UI.setStatus('thinking', 'Analyzing...');
  UI.showThinking();
  camera.startScanning();

  try {
    let responseText;
    let usedCamera = false;
    const imageBase64 = camera.captureFrameBase64();
    let thumbnailBase64 = null;

    if (imageBase64) {
      usedCamera = true;
      thumbnailBase64 = camera.captureThumbnailBase64(320, 240);
      responseText = await analyzeWithVoiceAndCamera(transcript, imageBase64);
    } else {
      responseText = await analyzeVoiceOnly(transcript);
    }

    UI.showResponse(responseText, usedCamera);
    UI.addHistoryItem(transcript, responseText, usedCamera);
    UI.setStatus('ready', 'Ready');
    trackQuery(transcript, usedCamera, thumbnailBase64);
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

async function speakResponse(text) {
  const btnStop = document.getElementById('btn-stop-audio');

  const hideStopButton = () => { if (btnStop) btnStop.style.display = 'none'; };
  const showStopButton = () => { if (btnStop) btnStop.style.display = 'inline-flex'; };

  if (activeSarvamKey) {
    showStopButton();
    const success = await speakWithSarvam(text, activeSarvamKey, hideStopButton);
    if (success) return;
    hideStopButton();
  }

  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();

  const cleanText = text
    .replace(/[#*`_~]/g, '')
    .replace(/\[.*?\]\(.*?\)/g, '')
    .split('\n').filter(l => l.trim()).join('. ')
    .substring(0, 500);

  const utterance = new SpeechSynthesisUtterance(cleanText);
  utterance.rate = 1.0;
  utterance.pitch = 1.0;
  utterance.volume = 0.8;
  utterance.onstart = showStopButton;
  utterance.onend = hideStopButton;
  utterance.onerror = hideStopButton;
  window.speechSynthesis.speak(utterance);
}

// ─── App Buttons ──────────────────────────────────────────────

function setupAppButtons() {
  document.getElementById('btn-mic').addEventListener('click', () => {
    if (voice.isListening) {
      voice.stop();
    } else {
      UI.hideResponse();
      UI.resetTranscript();
      voice.start();
    }
  });

  document.getElementById('btn-toggle-camera').addEventListener('click', () => camera.toggle());
  document.getElementById('btn-flip-camera').addEventListener('click', () => camera.flip());
  document.getElementById('btn-clear-history').addEventListener('click', () => UI.clearHistory());

  const btnThemeToggle = document.getElementById('btn-theme-toggle');
  if (btnThemeToggle) {
    btnThemeToggle.addEventListener('click', () => {
      const currentTheme = document.body.classList.contains('light-theme') ? 'light' : 'dark';
      const newTheme = currentTheme === 'light' ? 'dark' : 'light';
      localStorage.setItem('daiy_theme', newTheme);
      applyTheme(newTheme);
    });
  }

  const btnStopAudio = document.getElementById('btn-stop-audio');
  if (btnStopAudio) {
    btnStopAudio.addEventListener('click', () => {
      stopSarvamAudio();
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
      btnStopAudio.style.display = 'none';
    });
  }

  const btnNewChat = document.getElementById('btn-new-chat');
  if (btnNewChat) {
    btnNewChat.addEventListener('click', () => {
      if (btnStopAudio) btnStopAudio.click();
      UI.resetTranscript();
      UI.hideResponse();
      UI.setStatus('ready', 'Ready');
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && e.target === document.body) {
      e.preventDefault();
      document.getElementById('btn-mic').click();
    }
  });

  // Profile dialog save/cancel
  const profileDialog = document.getElementById('profile-dialog');
  const colorPicker = document.getElementById('profile-color-picker');
  let selectedColor = '#6366f1';

  if (colorPicker) {
    colorPicker.addEventListener('click', (e) => {
      const swatch = e.target.closest('.color-swatch');
      if (!swatch) return;
      colorPicker.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('active'));
      swatch.classList.add('active');
      selectedColor = swatch.dataset.color || '#6366f1';
    });
  }

  const btnCloseProfile = document.getElementById('btn-close-profile');
  const btnCancelProfile = document.getElementById('btn-cancel-profile');
  const btnSaveProfile = document.getElementById('btn-save-profile');

  const closeDialog = () => profileDialog?.close();
  if (btnCloseProfile) btnCloseProfile.addEventListener('click', closeDialog);
  if (btnCancelProfile) btnCancelProfile.addEventListener('click', closeDialog);

  if (btnSaveProfile) {
    btnSaveProfile.addEventListener('click', () => {
      const nameVal = document.getElementById('input-profile-name').value.trim() || 'User';
      saveProfile({
        name: nameVal,
        email: auth.currentUser?.email || '',
        avatarColor: selectedColor
      });
      closeDialog();
    });
  }
}

// ─── Bootstrap ────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  applyTheme(localStorage.getItem('daiy_theme') || 'dark');
  setupAuthUI();
  setupUserDropdown();
  setupVerifyScreen();

  onAuthChanged((user) => {
    if (!user) {
      hideVerifyScreen();
      showAuthScreen();
      return;
    }

    // Google sign-in is always verified; email/password requires verification
    if (!user.emailVerified) {
      showVerifyScreen(user);
      return;
    }

    hideVerifyScreen();
    hideAuthScreen();
    initApp(user);
  });
});
