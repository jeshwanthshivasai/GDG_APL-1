/**
 * ui.js — UI controller module
 * Manages panel states, renders AI responses, typing animations,
 * conversation history, and status indicators.
 */

// --- DOM references ---
const $ = (id) => document.getElementById(id);

const DOM = {
  statusPill: () => $('status-pill'),
  statusText: () => $('status-pill')?.querySelector('.status-text'),
  transcriptPlaceholder: () => $('transcript-placeholder'),
  transcriptContent: () => $('transcript-content'),
  transcriptText: () => $('transcript-text'),
  responseArea: () => $('response-area'),
  responseContent: () => $('response-content'),
  responseMeta: () => $('response-meta'),
  typingIndicator: () => $('typing-indicator'),
  micButton: () => $('btn-mic'),
  micLabel: () => $('mic-label'),
  historyList: () => $('history-list'),
  historyEmpty: () => $('history-empty'),
  serviceError: () => $('service-error'),
};

/**
 * Show a friendly service unavailable error (when env keys are missing)
 */
export function showServiceError() {
  const el = DOM.serviceError();
  if (el) el.classList.remove('hidden');
}

/**
 * Update the status pill (Ready, Listening, Thinking, Error)
 */
export function setStatus(state, text) {
  const pill = DOM.statusPill();
  const statusText = DOM.statusText();

  if (!pill) return; // Gracefully do nothing if status-pill is removed

  // Remove all state classes
  pill.classList.remove('listening', 'thinking', 'error');

  if (state !== 'ready') {
    pill.classList.add(state);
  }

  if (statusText) {
    statusText.textContent = text || state.charAt(0).toUpperCase() + state.slice(1);
  }
}

/**
 * Update the mic button state
 */
export function setMicState(isActive) {
  const btn = DOM.micButton();
  const label = DOM.micLabel();

  if (isActive) {
    btn.classList.add('active');
    label.textContent = 'Tap to stop';
  } else {
    btn.classList.remove('active');
    label.textContent = 'Tap to speak';
  }
}

/**
 * Show the transcript area with text
 */
export function showTranscript(text, isInterim = false) {
  const placeholder = DOM.transcriptPlaceholder();
  const content = DOM.transcriptContent();
  const textEl = DOM.transcriptText();

  placeholder.classList.add('hidden');
  content.classList.remove('hidden');

  textEl.textContent = text;
  textEl.classList.toggle('interim', isInterim);
}

/**
 * Reset transcript to placeholder
 */
export function resetTranscript() {
  const placeholder = DOM.transcriptPlaceholder();
  const content = DOM.transcriptContent();

  placeholder.classList.remove('hidden');
  content.classList.add('hidden');
}

/**
 * Show the AI response area with typing indicator
 */
export function showThinking() {
  const area = DOM.responseArea();
  const content = DOM.responseContent();
  const typing = DOM.typingIndicator();
  const meta = DOM.responseMeta();

  area.classList.remove('hidden');
  typing.classList.remove('hidden');
  meta.textContent = 'Analyzing...';

  // Clear previous content but keep typing indicator
  const existingResponse = content.querySelector('.response-text');
  if (existingResponse) existingResponse.remove();
}

/**
 * Render the AI response with simple markdown formatting
 */
export function showResponse(text, usedCamera = false) {
  const content = DOM.responseContent();
  const typing = DOM.typingIndicator();
  const meta = DOM.responseMeta();

  // Hide typing
  typing.classList.add('hidden');

  // Update meta
  const mode = usedCamera ? '📷 Voice + Camera analysis' : '🎤 Voice-only analysis';
  meta.textContent = mode;

  // Parse markdown-ish response into HTML
  const html = parseResponseMarkdown(text);

  // Remove old response if any
  const existingResponse = content.querySelector('.response-text');
  if (existingResponse) existingResponse.remove();

  const responseDiv = document.createElement('div');
  responseDiv.className = 'response-text';
  responseDiv.innerHTML = html;
  content.appendChild(responseDiv);

  // Scroll into view
  responseDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

/**
 * Hide the response area
 */
export function hideResponse() {
  DOM.responseArea().classList.add('hidden');
}

/**
 * Basic markdown to HTML for AI responses
 */
function parseResponseMarkdown(text) {
  if (!text) return '<p>No response received.</p>';

  return text
    // Headers
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h3>$1</h3>')
    .replace(/^# (.+)$/gm, '<h3>$1</h3>')
    // Bold
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    // Italic
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Inline code
    .replace(/`(.+?)`/g, '<code>$1</code>')
    // Numbered lists
    .replace(/^\d+\.\s+(.+)$/gm, '<li>$1</li>')
    // Bullet lists
    .replace(/^[-•]\s+(.+)$/gm, '<li>$1</li>')
    // Wrap consecutive <li> in <ol> or <ul>
    .replace(/((?:<li>.*<\/li>\n?)+)/g, '<ul>$1</ul>')
    // Paragraphs (double newlines)
    .replace(/\n\n/g, '</p><p>')
    // Single newlines within paragraphs
    .replace(/\n/g, '<br/>')
    // Wrap in paragraph
    .replace(/^(.+)/, '<p>$1')
    .replace(/(.+)$/, '$1</p>');
}

/**
 * Add entry to conversation history
 */
export function addHistoryItem(userText, aiText, usedCamera = false, saveToStorage = true, storedTime = null) {
  const list = DOM.historyList();
  const empty = DOM.historyEmpty();

  // Hide empty state
  if (empty) empty.classList.add('hidden');

  const time = storedTime || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const badgeClass = usedCamera ? 'with-camera' : 'voice-only';
  const badgeText = usedCamera ? '📷 Camera + Voice' : '🎤 Voice only';

  // Extract first line of AI response as summary
  const aiSummary = aiText
    ? aiText.replace(/[#*`]/g, '').split('\n').filter(l => l.trim())[0]?.substring(0, 100) || 'Response received'
    : 'Processing...';

  const item = document.createElement('div');
  item.className = 'history-item';
  item.innerHTML = `
    <div class="history-item-user">
      <span class="h-icon">🎤</span>
      <span class="h-text">${escapeHtml(userText)}</span>
    </div>
    <div class="history-item-ai">
      <span class="h-icon">🤖</span>
      <span class="h-text">${escapeHtml(aiSummary)}</span>
    </div>
    <span class="history-item-badge ${badgeClass}">${badgeText}</span>
    <div class="history-item-time">${time}</div>
  `;

  // Prepend (newest first)
  list.prepend(item);

  if (saveToStorage) {
    try {
      const history = JSON.parse(localStorage.getItem('daiy_history') || '[]');
      history.push({ userText, aiText, usedCamera, time });
      localStorage.setItem('daiy_history', JSON.stringify(history));
    } catch (err) {
      console.warn('Failed to save history to localStorage:', err);
    }
  }
}

/**
 * Clear conversation history
 */
export function clearHistory(clearStorage = true) {
  const list = DOM.historyList();
  const empty = DOM.historyEmpty();

  list.innerHTML = '';
  if (empty) {
    list.appendChild(empty);
    empty.classList.remove('hidden');
  } else {
    const newEmpty = document.createElement('div');
    newEmpty.className = 'history-empty';
    newEmpty.id = 'history-empty';
    newEmpty.innerHTML = '<p>Your conversation history will appear here</p>';
    list.appendChild(newEmpty);
  }

  if (clearStorage) {
    localStorage.removeItem('daiy_history');
  }
}

/**
 * Load history from localStorage and populate the UI
 */
export function loadHistoryFromStorage() {
  try {
    const history = JSON.parse(localStorage.getItem('daiy_history') || '[]');
    clearHistory(false); // clear DOM, not storage
    history.forEach(item => {
      addHistoryItem(item.userText, item.aiText, item.usedCamera, false, item.time);
    });
  } catch (err) {
    console.warn('Failed to load history from localStorage:', err);
  }
}

/**
 * Show an error toast/notification
 */
export function showError(message) {
  setStatus('error', message);

  // Auto-reset after 4 seconds
  setTimeout(() => {
    setStatus('ready', 'Ready');
  }, 4000);
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
