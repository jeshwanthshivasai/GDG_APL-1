/**
 * onboarding.js — Interactive first-time user onboarding tour
 * Shows a 4-step spotlight walkthrough on first visit.
 */

const ONBOARDED_KEY = 'daiy_onboarded';

import { saveProfile } from './profile.js';

const STEPS = [
  {
    target: null, // Welcome splash — no target element
    title: 'Welcome to DAIY 👋',
    showWelcomeLogo: true,
    description: 'Your AI-powered repair assistant. Describe a problem, show it on camera, and get instant diagnosis. Let\'s show you how it works!',
    position: 'center'
  },
  {
    target: '#camera-panel',
    title: '📷 Camera Feed',
    description: 'Point your camera at the broken device or appliance. DAIY sees what you see and uses vision AI to identify the issue.',
    position: 'right'
  },
  {
    target: '#btn-mic',
    title: '🎤 Talk to DAIY',
    description: 'Tap the microphone and describe your problem out loud. DAIY listens, captures a camera frame, and analyzes everything together.',
    position: 'top'
  },
  {
    target: '#history-panel',
    title: '💬 Conversation Log',
    description: 'Your past diagnoses are saved here for reference. You can review previous issues anytime.',
    position: 'left'
  }
];

let currentStep = 0;
let overlayEl = null;
let onCompleteCallback = null;

/**
 * Start the onboarding tour.
 * @param {Function} [onComplete] — Callback when tour finishes or is skipped
 */
export function startOnboarding(onComplete) {
  if (localStorage.getItem(ONBOARDED_KEY)) return;

  onCompleteCallback = onComplete || null;
  currentStep = 0;
  createOverlay();
  showStep(0);
}

/**
 * Check if onboarding has been completed
 */
export function isOnboarded() {
  return !!localStorage.getItem(ONBOARDED_KEY);
}

function createOverlay() {
  // Remove existing overlay if any
  const existing = document.getElementById('onboarding-overlay');
  if (existing) existing.remove();

  overlayEl = document.createElement('div');
  overlayEl.id = 'onboarding-overlay';
  overlayEl.className = 'onboarding-overlay';
  overlayEl.innerHTML = `
    <div class="onboarding-backdrop" id="onboarding-backdrop"></div>
    <div class="onboarding-spotlight" id="onboarding-spotlight"></div>
    <div class="onboarding-tooltip" id="onboarding-tooltip">
      <div class="onboarding-tooltip-content">
        <div class="onboarding-welcome-image hidden" id="onboarding-welcome-image">
          <img src="/DAIY.png" alt="DAIY Logo" />
        </div>
        <h3 class="onboarding-title" id="onboarding-title"></h3>
        <p class="onboarding-desc" id="onboarding-desc"></p>
        
        <!-- Onboarding Profile Form -->
        <div class="onboarding-form hidden" id="onboarding-form">
          <div class="form-group">
            <label for="onboarding-name">What should we call you?</label>
            <input type="text" id="onboarding-name" placeholder="E.g., John Doe" autocomplete="off" />
          </div>
        </div>
      </div>
      <div class="onboarding-footer">
        <div class="onboarding-dots" id="onboarding-dots"></div>
        <div class="onboarding-actions">
          <button class="onboarding-btn-skip" id="onboarding-skip">Skip</button>
          <button class="onboarding-btn-next" id="onboarding-next">Next →</button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(overlayEl);

  // Wire up buttons
  document.getElementById('onboarding-skip').addEventListener('click', completeOnboarding);
  
  // Custom click handler to save profile data on step 0
  document.getElementById('onboarding-next').addEventListener('click', () => {
    if (currentStep === 0) {
      const nameInput = document.getElementById('onboarding-name');
      const nameVal = nameInput ? nameInput.value.trim() : '';
      if (nameVal) {
        saveProfile({ name: nameVal, avatarColor: '#6366f1' });
      }
    }
    nextStep();
  });

  document.getElementById('onboarding-backdrop').addEventListener('click', (e) => {
    e.stopPropagation();
  });
}

function showStep(index) {
  const step = STEPS[index];
  if (!step) return;

  const title = document.getElementById('onboarding-title');
  const desc = document.getElementById('onboarding-desc');
  const nextBtn = document.getElementById('onboarding-next');
  const spotlight = document.getElementById('onboarding-spotlight');
  const tooltip = document.getElementById('onboarding-tooltip');
  const dotsContainer = document.getElementById('onboarding-dots');
  const welcomeImage = document.getElementById('onboarding-welcome-image');
  const onboardingForm = document.getElementById('onboarding-form');

  // Update text
  if (step.titleHtml) {
    title.innerHTML = step.titleHtml;
  } else {
    title.textContent = step.title;
  }
  desc.textContent = step.description;

  // Toggle welcome logo image & profile inputs form
  if (welcomeImage) {
    if (step.showWelcomeLogo) {
      welcomeImage.classList.remove('hidden');
      if (onboardingForm) onboardingForm.classList.remove('hidden');
    } else {
      welcomeImage.classList.add('hidden');
      if (onboardingForm) onboardingForm.classList.add('hidden');
    }
  }

  // Update button text
  if (index === 0) {
    nextBtn.textContent = 'Save & Start Tour 🚀';
  } else if (index === STEPS.length - 1) {
    nextBtn.textContent = 'Got it! ✨';
  } else {
    nextBtn.textContent = 'Next →';
  }

  // Update dots
  dotsContainer.innerHTML = STEPS.map((_, i) =>
    `<span class="onboarding-dot ${i === index ? 'active' : ''} ${i < index ? 'done' : ''}"></span>`
  ).join('');

  // Position spotlight and tooltip
  if (step.target) {
    const targetEl = document.querySelector(step.target);
    if (targetEl) {
      const isMobile = window.matchMedia('(max-width: 680px)').matches;
      if (isMobile) {
        targetEl.scrollIntoView({ block: 'center' });
      }

      const rect = targetEl.getBoundingClientRect();
      const padding = 12;
      const isOffscreen = rect.top > window.innerHeight || rect.bottom < 0;

      if (!isOffscreen) {
        spotlight.style.display = 'block';
        spotlight.style.top = `${rect.top - padding}px`;
        spotlight.style.left = `${rect.left - padding}px`;
        spotlight.style.width = `${rect.width + padding * 2}px`;
        spotlight.style.height = `${rect.height + padding * 2}px`;
        spotlight.style.borderRadius = '16px';
      } else {
        spotlight.style.display = 'none';
      }

      positionTooltip(tooltip, rect, step.position);
    }
  } else {
    // Center mode (welcome splash)
    spotlight.style.display = 'none';
    tooltip.style.position = 'fixed';
    tooltip.style.left = '50%';

    if (window.matchMedia('(max-width: 680px)').matches) {
      tooltip.style.top = '1rem';
      tooltip.style.transform = 'translateX(-50%)';
      tooltip.style.maxWidth = 'calc(100% - 2rem)';
      tooltip.style.maxHeight = 'calc(100dvh - 2rem)';
      tooltip.style.overflowY = 'auto';
    } else {
      tooltip.style.top = '50%';
      tooltip.style.transform = 'translate(-50%, -50%)';
      tooltip.style.maxWidth = '420px';
      tooltip.style.maxHeight = '';
      tooltip.style.overflowY = '';
    }
  }

  // Animate in
  tooltip.classList.add('visible');
}

function positionTooltip(tooltip, targetRect, position) {
  tooltip.style.position = 'fixed';
  tooltip.style.transform = 'none';
  tooltip.style.maxHeight = '';
  tooltip.style.overflowY = '';

  // On mobile always pin to top-center or bottom-center — avoids off-screen issues
  const isMobile = window.matchMedia('(max-width: 680px)').matches;
  if (isMobile) {
    const targetCenterY = targetRect ? (targetRect.top + targetRect.bottom) / 2 : window.innerHeight / 2;
    if (targetCenterY > window.innerHeight / 2) {
      // Target is in bottom half, pin tooltip to top
      tooltip.style.top = '1rem';
      tooltip.style.bottom = 'auto';
    } else {
      // Target is in top half, pin tooltip to bottom
      tooltip.style.bottom = '1rem';
      tooltip.style.top = 'auto';
    }
    tooltip.style.left = '1rem';
    tooltip.style.right = '1rem';
    tooltip.style.maxWidth = 'calc(100% - 2rem)';
    tooltip.style.maxHeight = 'calc(100vh - 2rem)';
    tooltip.style.overflowY = 'auto';
    return;
  }

  tooltip.style.bottom = '';
  tooltip.style.right = '';
  tooltip.style.maxWidth = '340px';

  const gap = 20;
  const tooltipWidth = 340;
  const tooltipHeight = 220;

  switch (position) {
    case 'right':
      tooltip.style.top = `${targetRect.top + targetRect.height / 2 - tooltipHeight / 2}px`;
      tooltip.style.left = `${targetRect.right + gap}px`;
      if (targetRect.right + gap + tooltipWidth > window.innerWidth) {
        tooltip.style.left = `${targetRect.left + 20}px`;
        tooltip.style.top = `${targetRect.bottom + gap}px`;
      }
      break;
    case 'left':
      tooltip.style.top = `${targetRect.top + targetRect.height / 2 - tooltipHeight / 2}px`;
      tooltip.style.left = `${targetRect.left - tooltipWidth - gap}px`;
      if (targetRect.left - tooltipWidth - gap < 0) {
        tooltip.style.left = `${targetRect.left}px`;
        tooltip.style.top = `${targetRect.bottom + gap}px`;
      }
      break;
    case 'top':
      tooltip.style.top = `${targetRect.top - tooltipHeight - gap}px`;
      tooltip.style.left = `${targetRect.left + targetRect.width / 2 - tooltipWidth / 2}px`;
      if (targetRect.top - tooltipHeight - gap < 0) {
        tooltip.style.top = `${targetRect.bottom + gap}px`;
      }
      break;
    case 'bottom':
    default:
      tooltip.style.top = `${targetRect.bottom + gap}px`;
      tooltip.style.left = `${targetRect.left + targetRect.width / 2 - tooltipWidth / 2}px`;
      break;
  }

  // Clamp horizontally
  const computedLeft = parseInt(tooltip.style.left);
  if (computedLeft < 16) tooltip.style.left = '16px';
  if (computedLeft + tooltipWidth > window.innerWidth - 16) {
    tooltip.style.left = `${window.innerWidth - tooltipWidth - 16}px`;
  }

  // Clamp vertically
  const computedTop = parseInt(tooltip.style.top);
  if (computedTop < 16) tooltip.style.top = '16px';
  if (computedTop + tooltipHeight > window.innerHeight - 16) {
    tooltip.style.top = `${window.innerHeight - tooltipHeight - 16}px`;
  }
}

function nextStep() {
  currentStep++;
  if (currentStep >= STEPS.length) {
    completeOnboarding();
  } else {
    showStep(currentStep);
  }
}

function completeOnboarding() {
  localStorage.setItem(ONBOARDED_KEY, 'true');

  if (overlayEl) {
    overlayEl.classList.add('fade-out');
    setTimeout(() => {
      overlayEl.remove();
      overlayEl = null;
    }, 300);
  }

  if (onCompleteCallback) onCompleteCallback();
}
