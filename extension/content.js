// ============================================================
// VoiceFlow India - Content Script
// Injected into every page. Handles:
// - Tracking focused text fields
// - Showing recording/processing overlay UI
// - Injecting cleaned text into active fields
// - Undo functionality
// ============================================================

(function () {
  'use strict';

  // Prevent double-injection
  if (window.__voiceflowInjected) return;
  window.__voiceflowInjected = true;

  // ---- State ----
  let lastFocusedElement = null;
  let undoStack = [];
  let overlayEl = null;
  let floatingBubble = null;
  let undoTimeout = null;

  // ---- Track Focused Elements ----
  document.addEventListener('focusin', (e) => {
    if (isEditableElement(e.target)) {
      lastFocusedElement = e.target;
    }
  }, true);

  document.addEventListener('mousedown', (e) => {
    if (isEditableElement(e.target)) {
      lastFocusedElement = e.target;
    }
  }, true);

  function isEditableElement(el) {
    if (!el) return false;
    const tag = el.tagName?.toLowerCase();
    if (tag === 'input' && isTextInput(el)) return true;
    if (tag === 'textarea') return true;
    if (el.isContentEditable) return true;
    if (el.getAttribute('role') === 'textbox') return true;
    return false;
  }

  function isTextInput(el) {
    const nonTextTypes = ['checkbox', 'radio', 'submit', 'button', 'file', 'image', 'reset', 'hidden', 'range', 'color'];
    return !nonTextTypes.includes(el.type?.toLowerCase());
  }

  // ---- Create Overlay UI ----
  function createOverlay() {
    if (overlayEl) return;

    overlayEl = document.createElement('div');
    overlayEl.id = 'voiceflow-overlay';
    overlayEl.innerHTML = `
      <div class="vf-overlay-inner">
        <div class="vf-overlay-icon">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
            <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
            <line x1="12" y1="19" x2="12" y2="23"/>
            <line x1="8" y1="23" x2="16" y2="23"/>
          </svg>
        </div>
        <div class="vf-overlay-status">
          <span class="vf-status-text">Listening...</span>
          <div class="vf-waveform">
            <span class="vf-wave-bar"></span>
            <span class="vf-wave-bar"></span>
            <span class="vf-wave-bar"></span>
            <span class="vf-wave-bar"></span>
            <span class="vf-wave-bar"></span>
            <span class="vf-wave-bar"></span>
            <span class="vf-wave-bar"></span>
          </div>
        </div>
        <div class="vf-overlay-lang"></div>
      </div>
    `;
    document.body.appendChild(overlayEl);
    positionOverlay();
  }

  function positionOverlay() {
    if (!overlayEl || !lastFocusedElement) return;

    const rect = lastFocusedElement.getBoundingClientRect();
    const overlayHeight = 48;
    const gap = 8;

    let top = rect.top - overlayHeight - gap;
    let left = rect.left;

    // If no space above, show below
    if (top < 10) {
      top = rect.bottom + gap;
    }

    // Keep within viewport
    left = Math.max(10, Math.min(left, window.innerWidth - 280));
    top = Math.max(10, Math.min(top, window.innerHeight - overlayHeight - 10));

    overlayEl.style.top = `${top}px`;
    overlayEl.style.left = `${left}px`;
  }

  function showRecording() {
    createOverlay();
    overlayEl.classList.add('vf-active');
    overlayEl.classList.remove('vf-processing', 'vf-success', 'vf-error');
    overlayEl.querySelector('.vf-status-text').textContent = 'Listening...';
    overlayEl.querySelector('.vf-waveform').style.display = 'flex';
  }

  function showProcessing() {
    if (!overlayEl) createOverlay();
    overlayEl.classList.add('vf-processing');
    overlayEl.classList.remove('vf-active');
    overlayEl.querySelector('.vf-status-text').textContent = 'Processing...';
    overlayEl.querySelector('.vf-waveform').style.display = 'none';
  }

  function showSuccess(wordCount, language) {
    if (!overlayEl) return;
    overlayEl.classList.remove('vf-active', 'vf-processing');
    overlayEl.classList.add('vf-success');

    const langLabel = language && language !== 'auto' ? ` - ${language.toUpperCase()}` : '';
    overlayEl.querySelector('.vf-status-text').textContent = `Done: ${wordCount} words${langLabel}`;
    overlayEl.querySelector('.vf-waveform').style.display = 'none';

    // Show undo button
    const undoBtn = document.createElement('button');
    undoBtn.className = 'vf-undo-btn';
    undoBtn.textContent = 'Undo';
    undoBtn.onclick = () => undoLastDictation();
    overlayEl.querySelector('.vf-overlay-inner').appendChild(undoBtn);

    // Auto-dismiss after 4 seconds
    clearTimeout(undoTimeout);
    undoTimeout = setTimeout(() => {
      removeOverlay();
    }, 4000);
  }

  function showError(errorMsg) {
    createOverlay();
    overlayEl.classList.remove('vf-active', 'vf-processing');
    overlayEl.classList.add('vf-error');
    overlayEl.querySelector('.vf-status-text').textContent = errorMsg;
    overlayEl.querySelector('.vf-waveform').style.display = 'none';

    setTimeout(() => removeOverlay(), 4000);
  }

  function removeOverlay() {
    if (overlayEl) {
      overlayEl.classList.add('vf-fade-out');
      setTimeout(() => {
        overlayEl?.remove();
        overlayEl = null;
      }, 300);
    }
  }

  // ---- Create Floating Mic Bubble ----
  function createFloatingBubble() {
    if (floatingBubble) return;

    floatingBubble = document.createElement('div');
    floatingBubble.id = 'voiceflow-bubble';
    floatingBubble.innerHTML = `
      <div class="vf-orb-container">
        <div class="vf-orb-dynamic"></div>
        <div class="vf-orb-texture"></div>
      </div>
      <div class="vf-bubble-inner" title="Click to start/stop dictation (Ctrl+Shift+Space)">
        <svg class="vf-bubble-mic" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
          <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
          <line x1="12" y1="19" x2="12" y2="23"/>
          <line x1="8" y1="23" x2="16" y2="23"/>
        </svg>
      </div>
    `;

    floatingBubble.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      floatingBubble.classList.remove('vf-bubble-click-spin');
      // Force reflow so repeated clicks retrigger the animation.
      void floatingBubble.offsetWidth;
      floatingBubble.classList.add('vf-bubble-click-spin');
      chrome.runtime.sendMessage({ type: 'CONTENT_TOGGLE_RECORDING' });
    });

    floatingBubble.addEventListener('animationend', (e) => {
      if (e.animationName === 'vf-click-spin') {
        floatingBubble.classList.remove('vf-bubble-click-spin');
      }
    });

    floatingBubble.style.setProperty('--vf-siri-gif', `url(${chrome.runtime.getURL('icons/Siri.gif')})`);
    document.body.appendChild(floatingBubble);
    
    // Make draggable
    makeDraggable(floatingBubble);
  }

  function makeDraggable(el) {
    let isDragging = false;
    let startX, startY, initialX, initialY;
    let hasMoved = false;

    el.addEventListener('mousedown', (e) => {
      if (e.target.closest('.vf-bubble-inner')) {
        isDragging = true;
        hasMoved = false;
        startX = e.clientX;
        startY = e.clientY;
        const rect = el.getBoundingClientRect();
        initialX = rect.left;
        initialY = rect.top;
        e.preventDefault();
      }
    });

    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) hasMoved = true;
      el.style.left = `${initialX + dx}px`;
      el.style.top = `${initialY + dy}px`;
      el.style.right = 'auto';
      el.style.bottom = 'auto';
    });

    document.addEventListener('mouseup', () => {
      if (isDragging && hasMoved) {
        // Snap to nearest edge
        const rect = el.getBoundingClientRect();
        const midX = rect.left + rect.width / 2;
        if (midX < window.innerWidth / 2) {
          el.style.left = '12px';
          el.style.right = 'auto';
        } else {
          el.style.right = '12px';
          el.style.left = 'auto';
        }
        el.style.top = `${Math.max(12, Math.min(rect.top, window.innerHeight - rect.height - 12))}px`;
        el.style.bottom = 'auto';
      }
      isDragging = false;
    });
  }

  // ---- Text Injection ----
  function injectText(text) {
    const el = lastFocusedElement;
    if (!el) {
      showError('No text field focused');
      return;
    }

    // Save undo state
    const prevValue = getElementValue(el);
    undoStack.push({ element: el, value: prevValue });

    // Focus element
    el.focus();

    // Try execCommand first (works best with React/Vue eds)
    const success = document.execCommand('insertText', false, text);

    if (!success) {
      // Fallback: direct value manipulation
      if (el.tagName.toLowerCase() === 'input' || el.tagName.toLowerCase() === 'textarea') {
        const start = el.selectionStart || el.value.length;
        const end = el.selectionEnd || el.value.length;
        const before = el.value.substring(0, start);
        const after = el.value.substring(end);
        el.value = before + text + after;
        el.selectionStart = el.selectionEnd = start + text.length;

        // Dispatch events for React/Vue
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      } else if (el.isContentEditable) {
        // ContentEditable fallback
        const selection = window.getSelection();
        if (selection.rangeCount > 0) {
          const range = selection.getRangeAt(0);
          range.deleteContents();
          range.insertNode(document.createTextNode(text));
          range.collapse(false);
        } else {
          el.textContent += text;
        }
        el.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }

    // Count words
    const wordCount = text.split(/\s+/).filter(w => w.length > 0).length;
    return wordCount;
  }

  function getElementValue(el) {
    if (el.tagName?.toLowerCase() === 'input' || el.tagName?.toLowerCase() === 'textarea') {
      return el.value;
    }
    if (el.isContentEditable) {
      return el.innerHTML;
    }
    return el.textContent;
  }

  function undoLastDictation() {
    if (undoStack.length === 0) return;
    const { element, value } = undoStack.pop();

    if (element.tagName?.toLowerCase() === 'input' || element.tagName?.toLowerCase() === 'textarea') {
      element.value = value;
      element.dispatchEvent(new Event('input', { bubbles: true }));
    } else if (element.isContentEditable) {
      element.innerHTML = value;
      element.dispatchEvent(new Event('input', { bubbles: true }));
    }

    // Signal the background script so it can learn and optionally retry with
    // a better language candidate in auto mode.
    chrome.runtime.sendMessage({ type: 'CONTENT_UNDO_DICTATION' }).catch(() => {});
    removeOverlay();
  }

  // ---- Keyboard Shortcut (Ctrl+Z for undo within 5 seconds) ----
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === 'z' && undoStack.length > 0 && overlayEl?.classList.contains('vf-success')) {
      e.preventDefault();
      undoLastDictation();
    }
  });


  // ---- Message Listener ----
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    switch (message.type) {
      case 'VOICEFLOW_RECORDING_START':
        showRecording();
        if (floatingBubble) {
          floatingBubble.classList.add('vf-bubble-recording');
        }
        break;

      case 'VOICEFLOW_PROCESSING':
        showProcessing();
        if (floatingBubble) {
          floatingBubble.classList.remove('vf-bubble-recording');
          floatingBubble.classList.add('vf-bubble-processing');
        }
        break;

      case 'VOICEFLOW_INJECT_TEXT':
        if (floatingBubble) {
          floatingBubble.classList.remove('vf-bubble-recording', 'vf-bubble-processing');
        }
        const wordCount = injectText(message.text);
        showSuccess(wordCount, message.language);
        break;

      case 'VOICEFLOW_ERROR':
        if (floatingBubble) {
          floatingBubble.classList.remove('vf-bubble-recording', 'vf-bubble-processing');
        }
        showError(message.error);
        break;
    }
  });

  // ---- Init Floating Bubble ----
  createFloatingBubble();

})();


