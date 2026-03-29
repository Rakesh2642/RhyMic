document.addEventListener('DOMContentLoaded', async () => {
  const settings = await loadSettings();
  populateUI(settings);

  const apiKeyInput = document.getElementById('apiKey');
  const languageSelect = document.getElementById('language');
  const autoLanguageBiasSelect = document.getElementById('autoLanguageBias');
  const recordBtn = document.getElementById('recordBtn');
  const saveBtn = document.getElementById('saveBtn');
  const shortcutHint = document.getElementById('shortcutHint');
  const noiseFill = document.getElementById('noiseFill');
  const noiseValue = document.getElementById('noiseValue');
  const noiseWarning = document.getElementById('noiseWarning');

  let isRecording = false;
  let autoSaveTimer = null;
  let saveFeedbackTimer = null;
  let lastSavedSnapshot = serializeSettings(gatherSettings());

  document.querySelectorAll('.vf-toggle-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const group = btn.closest('.vf-toggle-group');
      if (!group) return;
      group.querySelectorAll('.vf-toggle-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      handleSettingsChanged();
    });
  });

  document.getElementById('toggleApiKey').addEventListener('click', () => {
    apiKeyInput.type = apiKeyInput.type === 'password' ? 'text' : 'password';
  });

  [apiKeyInput, languageSelect, autoLanguageBiasSelect].forEach((el) => {
    el.addEventListener('input', handleSettingsChanged);
    el.addEventListener('change', handleSettingsChanged);
  });

  shortcutHint.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText('Ctrl+Shift+Space');
      shortcutHint.textContent = 'Copied: Ctrl + Shift + Space';
      setTimeout(() => {
        shortcutHint.textContent = 'Ctrl + Shift + Space';
      }, 1200);
    } catch (e) {
      shortcutHint.textContent = 'Ctrl + Shift + Space';
    }
  });

  chrome.runtime.sendMessage({ type: 'GET_RECORDING_STATE' }, (response) => {
    if (response?.isRecording) {
      isRecording = true;
      setRecordBtnState(recordBtn, 'recording', 'Stop Dictation');
    }
    if (!isRecording) {
      resetNoiseMeterUI();
    }
    syncFriendlyUI(isRecording);
  });

  recordBtn.addEventListener('click', async () => {
    if (recordBtn.disabled && !isRecording) {
      setRecordBtnState(recordBtn, 'error', 'Add API Key First');
      setTimeout(() => {
        setRecordBtnState(recordBtn, 'idle', 'Start Dictation');
        syncFriendlyUI(isRecording);
      }, 1200);
      return;
    }

    let hasMicPermission = false;

    try {
      const perm = await navigator.permissions.query({ name: 'microphone' });
      if (perm.state === 'granted') {
        hasMicPermission = true;
      } else if (perm.state === 'prompt' && !window.location.search.includes('fullTab')) {
        chrome.tabs.create({ url: chrome.runtime.getURL('popup/popup.html?fullTab=true') });
        window.close();
        return;
      }
    } catch (e) {}

    if (!hasMicPermission) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach((track) => track.stop());
        hasMicPermission = true;
      } catch (e) {
        if (!window.location.search.includes('fullTab')) {
          chrome.tabs.create({ url: chrome.runtime.getURL('popup/popup.html?fullTab=true') });
          window.close();
          return;
        }
      }
    }

    if (!hasMicPermission) {
      setRecordBtnState(recordBtn, 'error', 'Error: Mic Denied');
      return;
    }

    if (!isRecording) {
      chrome.runtime.sendMessage({ type: 'POPUP_START_RECORDING' });
      isRecording = true;
      setRecordBtnState(recordBtn, 'recording', 'Stop Dictation');
    } else {
      chrome.runtime.sendMessage({ type: 'POPUP_STOP_RECORDING' });
      isRecording = false;
      setRecordBtnState(recordBtn, 'processing', 'Processing...');
      resetNoiseMeterUI();
    }

    syncFriendlyUI(isRecording);
  });

  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'POPUP_SHOW_FALLBACK_TEXT') {
      isRecording = false;
      setRecordBtnState(recordBtn, 'success', 'Copied to Clipboard');
      resetNoiseMeterUI();
      setTimeout(() => {
        setRecordBtnState(recordBtn, 'idle', 'Start Dictation');
        syncFriendlyUI(isRecording);
      }, 2200);
    } else if (message.type === 'POPUP_SHOW_ERROR') {
      isRecording = false;
      setRecordBtnState(recordBtn, 'error', `Error: ${message.error}`);
      resetNoiseMeterUI();
      setTimeout(() => {
        setRecordBtnState(recordBtn, 'idle', 'Start Dictation');
        syncFriendlyUI(isRecording);
      }, 2800);
    } else if (message.type === 'OFFSCREEN_NOISE_LEVEL') {
      updateNoiseMeter(message);
    }
  });

  saveBtn.addEventListener('click', async () => {
    await persistSettings('Saved');
  });

  function handleSettingsChanged() {
    syncFriendlyUI(isRecording);
    clearTimeout(autoSaveTimer);
    autoSaveTimer = setTimeout(async () => {
      await persistSettings('Auto-saved');
    }, 550);
  }

  async function persistSettings(label) {
    const newSettings = gatherSettings();
    const snapshot = serializeSettings(newSettings);
    if (snapshot === lastSavedSnapshot) return;

    await chrome.storage.local.set(newSettings);
    lastSavedSnapshot = snapshot;

    clearTimeout(saveFeedbackTimer);
    saveBtn.classList.add('saved');
    saveBtn.textContent = label;
    saveFeedbackTimer = setTimeout(() => {
      saveBtn.classList.remove('saved');
      saveBtn.textContent = 'Save Settings';
    }, 1200);

    syncFriendlyUI(isRecording);
  }

  function syncFriendlyUI(recordingState) {
    const currentSettings = gatherSettings();
    const hasApiKey = !!currentSettings.groqApiKey;
    const assistText = document.getElementById('assistText');

    autoLanguageBiasSelect.disabled = currentSettings.language !== 'auto';

    recordBtn.disabled = !hasApiKey && !recordingState;

    if (!hasApiKey) {
      assistText.textContent = 'Add your Groq API key to enable dictation.';
      return;
    }

    if (recordingState) {
      assistText.textContent = 'Listening now. Click again to stop and process text.';
      return;
    }

    if (currentSettings.outputMode === 'developer') {
      assistText.textContent = 'Developer mode compresses long speech into a cleaner, mature prompt.';
      return;
    }

    if (currentSettings.language === 'auto') {
      const biasMap = {
        auto: 'balanced', te: 'Telugu', ta: 'Tamil', kn: 'Kannada', ml: 'Malayalam', hi: 'Hindi', en: 'English'
      };
      const biasLabel = biasMap[currentSettings.autoLanguageBias] || 'balanced';
      assistText.textContent = `Auto-detect is on with ${biasLabel} bias.`;
      return;
    }

    assistText.textContent = 'Language is locked for higher transcription accuracy.';
  }

  function updateNoiseMeter(payload) {
    if (!payload || payload.active === false) {
      resetNoiseMeterUI();
      return;
    }

    const level = clamp(Number(payload.level) || 0, 0, 1);
    const percent = Math.round(level * 100);
    noiseFill.style.width = `${percent}%`;

    if (percent < 25) {
      noiseValue.textContent = 'Quiet';
    } else if (percent < 55) {
      noiseValue.textContent = 'Clean';
    } else if (percent < 80) {
      noiseValue.textContent = 'Moderate';
    } else {
      noiseValue.textContent = 'Loud';
    }

    if (payload.tooNoisy) {
      noiseWarning.classList.add('active');
      if (isRecording) {
        document.getElementById('assistText').textContent = 'Too noisy now. Try moving closer to your mic.';
      }
    } else {
      noiseWarning.classList.remove('active');
      if (isRecording) {
        document.getElementById('assistText').textContent = 'Listening now. Click again to stop and process text.';
      }
    }
  }

  function resetNoiseMeterUI() {
    noiseFill.style.width = '0%';
    noiseValue.textContent = 'Idle';
    noiseWarning.classList.remove('active');
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(value, max));
  }

  syncFriendlyUI(isRecording);
  resetNoiseMeterUI();
});

async function loadSettings() {
  return new Promise((resolve) => {
    chrome.storage.local.get({
      groqApiKey: '',
      language: 'auto',
      autoLanguageBias: 'auto',
      outputMode: 'normal',
      wordsToday: 0,
      wordsTotalWeek: 0
    }, (result) => resolve(result));
  });
}

function populateUI(settings) {
  document.getElementById('apiKey').value = settings.groqApiKey || '';
  document.getElementById('language').value = settings.language || 'auto';
  document.getElementById('autoLanguageBias').value = settings.autoLanguageBias || 'auto';

  document.querySelectorAll('.vf-toggle-btn[data-output-mode]').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.outputMode === (settings.outputMode || 'normal'));
  });

  document.getElementById('wordsToday').textContent = formatNumber(settings.wordsToday || 0);
  document.getElementById('wordsWeek').textContent = formatNumber(settings.wordsTotalWeek || 0);

  const minutesSaved = Math.round((settings.wordsTotalWeek || 0) / 40 * 0.67);
  document.getElementById('timeSaved').textContent = minutesSaved > 0 ? `${minutesSaved}m` : '0m';

  const statusBadge = document.getElementById('statusBadge');
  const statusText = document.getElementById('statusText');
  const statusDot = document.querySelector('.vf-status-dot');

  if (settings.groqApiKey) {
    statusText.textContent = 'Ready';
    statusDot.style.background = '#10b981';
    statusBadge.style.borderColor = 'rgba(16, 185, 129, 0.4)';
    statusBadge.style.background = 'rgba(16, 185, 129, 0.1)';
    statusBadge.style.color = '#10b981';
  } else {
    statusText.textContent = 'API Key Needed';
    statusDot.style.background = '#f59e0b';
    statusBadge.style.borderColor = 'rgba(245, 158, 11, 0.4)';
    statusBadge.style.background = 'rgba(245, 158, 11, 0.1)';
    statusBadge.style.color = '#f59e0b';
  }
}

function gatherSettings() {
  const activeOutputMode = document.querySelector('.vf-toggle-btn[data-output-mode].active');

  return {
    groqApiKey: document.getElementById('apiKey').value.trim(),
    language: document.getElementById('language').value,
    autoLanguageBias: document.getElementById('autoLanguageBias').value,
    outputMode: activeOutputMode ? activeOutputMode.dataset.outputMode : 'normal'
  };
}

function serializeSettings(settings) {
  return JSON.stringify({
    groqApiKey: settings.groqApiKey,
    language: settings.language,
    autoLanguageBias: settings.autoLanguageBias,
    outputMode: settings.outputMode
  });
}

function setRecordBtnState(btn, state, text) {
  btn.classList.remove('recording');
  btn.style.background = '';
  btn.style.color = '';
  btn.querySelector('span').textContent = text;

  if (state === 'recording') {
    btn.classList.add('recording');
  } else if (state === 'processing') {
    btn.style.background = 'linear-gradient(96deg, #6366f1 0%, #4f46e5 100%)';
    btn.style.color = '#fff';
  } else if (state === 'success') {
    btn.style.background = 'linear-gradient(96deg, #059669 0%, #10b981 100%)';
    btn.style.color = '#fff';
  } else if (state === 'error') {
    btn.style.background = 'linear-gradient(96deg, #dc2626 0%, #ef4444 100%)';
    btn.style.color = '#fff';
  }
}

function formatNumber(n) {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return n.toString();
}
