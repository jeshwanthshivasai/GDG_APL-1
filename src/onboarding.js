/**
 * onboarding.js — Interactive first-time user onboarding tour
 * Shows a 4-step spotlight walkthrough on first visit.
 */

const ONBOARDED_KEY = 'daiy_onboarded';

const STEPS = [
  {
    target: null, // Welcome splash — no target element
    titleHtml: `Welcome to <div class="onboarding-welcome-logo"><svg class="logo-svg" width="98" height="36" viewBox="0 0 186 69" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M0 0.000106812H41.1429V6.85725H48V61.7144H41.1429V68.5715H0V0.000106812ZM27.4286 48.0001H34.2857V20.5715H27.4286V13.7144H13.7143V54.8572H27.4286V48.0001ZM150.946 48.0001H144.089V41.143H137.232V34.2858H130.375V0.000106812H144.089V27.4287H150.946V34.2858H164.661V27.4287H171.518V0.000106812H185.232V34.2858H178.375V41.143H171.518V48.0001H164.661V68.5715H150.946V48.0001Z" fill="currentColor"/>
      <path d="M54.875 20.5715H61.7321V13.7144H68.5893V6.85725H75.4464V0.000106812H82.3036V6.85725H89.1607V13.7144H96.0179V20.5715H102.875V68.5715H89.1607V54.8572H68.5893V68.5715H54.875V20.5715ZM68.5893 41.143H89.1607V27.4287H82.3036V20.5715H75.4464V27.4287H68.5893V41.143ZM109.75 0.000106812H123.464V68.5715H109.75V0.000106812Z" fill="url(#paint0_linear_452_5_onboarding)"/>
      <defs>
        <linearGradient id="paint0_linear_452_5_onboarding" x1="96.0625" y1="-0.428467" x2="96.0625" y2="68.5715" gradientUnits="userSpaceOnUse">
          <stop stop-color="#00FFBB"/>
          <stop offset="1" stop-color="#7300FF"/>
        </linearGradient>
      </defs>
    </svg></div> 👋`,
    title: 'Welcome to DAIY 👋',
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

  // Update text
  if (step.titleHtml) {
    title.innerHTML = step.titleHtml;
  } else {
    title.textContent = step.title;
  }
  desc.textContent = step.description;

  // Update button text
  if (index === STEPS.length - 1) {
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
