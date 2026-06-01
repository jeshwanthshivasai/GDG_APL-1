/**
 * onboarding.js — Interactive first-time user onboarding tour
 * Shows a 4-step spotlight walkthrough on first visit.
 */

const ONBOARDED_KEY = 'daiy_onboarded';

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
  document.getElementById('onboarding-next').addEventListener('click', nextStep);
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

  // Update text
  if (step.titleHtml) {
    title.innerHTML = step.titleHtml;
  } else {
    title.textContent = step.title;
  }
  desc.textContent = step.description;

  // Toggle welcome logo image
  if (welcomeImage) {
    if (step.showWelcomeLogo) {
      welcomeImage.classList.remove('hidden');
    } else {
      welcomeImage.classList.add('hidden');
    }
  }

  // Update button text
  if (index === 0) {
    nextBtn.textContent = 'Take a Tour 🚀';
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
      const rect = targetEl.getBoundingClientRect();
      const padding = 12;

      spotlight.style.display = 'block';
      spotlight.style.top = `${rect.top - padding}px`;
      spotlight.style.left = `${rect.left - padding}px`;
      spotlight.style.width = `${rect.width + padding * 2}px`;
      spotlight.style.height = `${rect.height + padding * 2}px`;
      spotlight.style.borderRadius = '16px';

      // Position tooltip based on step.position
      positionTooltip(tooltip, rect, step.position);
    }
  } else {
    // Center mode (welcome splash)
    spotlight.style.display = 'none';
    tooltip.style.position = 'fixed';
    tooltip.style.top = '50%';
    tooltip.style.left = '50%';
    tooltip.style.transform = 'translate(-50%, -50%)';
    tooltip.style.maxWidth = '420px';
  }

  // Animate in
  tooltip.classList.add('visible');
}

function positionTooltip(tooltip, targetRect, position) {
  tooltip.style.position = 'fixed';
  tooltip.style.transform = 'none';
  tooltip.style.maxWidth = '340px';

  const gap = 20;
  const tooltipWidth = 340;
  const tooltipHeight = 200;

  switch (position) {
    case 'right':
      tooltip.style.top = `${targetRect.top + targetRect.height / 2 - tooltipHeight / 2}px`;
      tooltip.style.left = `${targetRect.right + gap}px`;
      // If overflows right, place it inside
      if (targetRect.right + gap + tooltipWidth > window.innerWidth) {
        tooltip.style.left = `${targetRect.left + 20}px`;
        tooltip.style.top = `${targetRect.bottom + gap}px`;
      }
      break;
    case 'left':
      tooltip.style.top = `${targetRect.top + targetRect.height / 2 - tooltipHeight / 2}px`;
      tooltip.style.left = `${targetRect.left - tooltipWidth - gap}px`;
      // If overflows left, place below
      if (targetRect.left - tooltipWidth - gap < 0) {
        tooltip.style.left = `${targetRect.left}px`;
        tooltip.style.top = `${targetRect.bottom + gap}px`;
      }
      break;
    case 'top':
      tooltip.style.top = `${targetRect.top - tooltipHeight - gap}px`;
      tooltip.style.left = `${targetRect.left + targetRect.width / 2 - tooltipWidth / 2}px`;
      // If overflows top, place below
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

  // Clamp within viewport
  const computedLeft = parseInt(tooltip.style.left);
  if (computedLeft < 16) tooltip.style.left = '16px';
  if (computedLeft + tooltipWidth > window.innerWidth - 16) {
    tooltip.style.left = `${window.innerWidth - tooltipWidth - 16}px`;
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
