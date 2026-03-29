// ============================================================
// VoiceFlow India - Background Service Worker
// Handles: hotkey commands, Groq API calls, message routing
// ============================================================

const DEFAULT_SETTINGS = {
  groqApiKey: '',
  language: 'auto',
  autoLanguageBias: 'auto',
  outputMode: 'normal', // 'normal' or 'developer'
  languageFeedback: {},
  wordsToday: 0,
  wordsTotalWeek: 0,
  lastResetDate: new Date().toDateString(),
  lastWeekResetDate: getMonday(new Date()).toDateString()
};

function getMonday(d) {
  d = new Date(d);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff));
}

const BASE_CLEANUP_PROMPT = "You are a text cleanup assistant. Clean the following voice-dictated text. Fix punctuation, remove filler words (um, uh, like, you know, basically), handle self-corrections (where the speaker went back and corrected themselves - use only the corrected version), and format properly. Return ONLY the cleaned text, nothing else. No explanations, no markdown.";

// App-context formatting hints
const APP_CONTEXT_HINTS = {
  'whatsapp': 'Format casually for WhatsApp messaging. Keep it conversational, short sentences. Emojis are acceptable if the speaker implied them.',
  'telegram': 'Format casually for Telegram messaging. Keep conversational.',
  'gmail': 'Format professionally for email. Use proper email structure with greetings and sign-offs if appropriate.',
  'outlook': 'Format professionally for email. Use proper email structure.',
  'notion': 'Format for Notion notes. Can use markdown-style formatting if the content implies structure.',
  'docs.google': 'Format as formal prose for Google Docs. Full punctuation, proper paragraphs.',
  'twitter': 'Format concisely for Twitter/X. Keep within 280 characters if possible. Punchy and concise.',
  'linkedin': 'Format professionally for LinkedIn. Professional tone, can be slightly longer.',
  'code': 'Preserve all technical terms, variable names, and code references exactly.',
  'slack': 'Format for Slack messaging. Professional but casual.',
  'default': 'Format as clean, well-punctuated text.'
};

const LANGUAGE_MAP = {
  'auto': null,
  'ta': 'Tamil',
  'te': 'Telugu',
  'hi': 'Hindi',
  'kn': 'Kannada',
  'ml': 'Malayalam',
  'mr': 'Marathi',
  'bn': 'Bengali',
  'gu': 'Gujarati',
  'pa': 'Punjabi',
  'en': 'English'
};
const SUPPORTED_LANG_CODES = Object.keys(LANGUAGE_MAP).filter((lang) => lang !== 'auto');

const LANGUAGE_CODE_BY_NAME = {
  english: 'en',
  tamil: 'ta',
  telugu: 'te',
  hindi: 'hi',
  kannada: 'kn',
  malayalam: 'ml',
  marathi: 'mr',
  bengali: 'bn',
  gujarati: 'gu',
  punjabi: 'pa'
};

const DRAVIDIAN_LANGUAGE_GROUP = ['te', 'ta', 'kn', 'ml'];

// State tracking
let offscreenDocCreated = false;
let lastTranscriptionSession = null;

async function getIsRecording() {
  const result = await chrome.storage.local.get('isRecording');
  return !!result.isRecording;
}

async function setIsRecording(val) {
  await chrome.storage.local.set({ isRecording: val });
}

// ---- Offscreen Document Management ----
async function ensureOffscreenDocument() {
  if (offscreenDocCreated) return;
  try {
    const existingContexts = await chrome.runtime.getContexts({
      contextTypes: ['OFFSCREEN_DOCUMENT']
    });
    if (existingContexts.length > 0) {
      offscreenDocCreated = true;
      return;
    }
    await chrome.offscreen.createDocument({
      url: 'offscreen/offscreen.html',
      reasons: ['USER_MEDIA'],
      justification: 'Recording audio from microphone for voice dictation'
    });
    offscreenDocCreated = true;
  } catch (e) {
    console.error('Failed to create offscreen document:', e);
  }
}

// ---- Command Listener (Global Hotkey) ----
chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'toggle-recording') {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) return;

    const recording = await getIsRecording();
    if (!recording) {
      await startRecording(tab);
    } else {
      await stopRecording(tab);
    }
  }
});

// ---- Reset State on Startup ----
chrome.runtime.onStartup.addListener(() => {
  setIsRecording(false);
});

// ---- Context Menu ----
chrome.runtime.onInstalled.addListener(() => {
  setIsRecording(false);
  chrome.contextMenus.create({
    id: 'voiceflow-dictate',
    title: 'Dictate with VoiceFlow',
    contexts: ['editable']
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'voiceflow-dictate') {
    const recording = await getIsRecording();
    if (!recording) {
      await startRecording(tab);
    } else {
      await stopRecording(tab);
    }
  }
});

// ---- Start Recording ----
async function startRecording(tab) {
  const settings = await getSettings();
  if (!settings.groqApiKey) {
    const errorMsg = 'Please set your Groq API key in VoiceFlow settings (click the extension icon).';
    if (tab) {
      try {
        await chrome.tabs.sendMessage(tab.id, { type: 'VOICEFLOW_ERROR', error: errorMsg });
      } catch (e) {}
    }
    chrome.runtime.sendMessage({ type: 'POPUP_SHOW_ERROR', error: errorMsg }).catch(()=>{});
    return;
  }

  await setIsRecording(true);
  await ensureOffscreenDocument();

  // Tell content script to show recording UI
  if (tab) {
    try {
      // Don't await this, as it might fail on constrained pages and we don't want to block recording
      chrome.tabs.sendMessage(tab.id, { type: 'VOICEFLOW_RECORDING_START' }).catch(() => {});
    } catch (e) {}
  }

  // Tell offscreen document to start recording
  chrome.runtime.sendMessage({ type: 'OFFSCREEN_START_RECORDING' });
}

// ---- Stop Recording ----
async function stopRecording(tab) {
  await setIsRecording(false);

  // Tell content script to show processing state
  if (tab) {
    try {
      chrome.tabs.sendMessage(tab.id, { type: 'VOICEFLOW_PROCESSING' }).catch(() => {});
    } catch (e) {}
  }

  // Tell offscreen document to stop recording and get audio
  chrome.runtime.sendMessage({ type: 'OFFSCREEN_STOP_RECORDING' });
}

// ---- Message Router ----
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case 'OFFSCREEN_RECORDING_ERROR':
      console.warn('Offscreen recording error (likely mic access denied):', message.error);
      setIsRecording(false);
      chrome.runtime.sendMessage({ type: 'POPUP_SHOW_ERROR', error: 'Microphone access denied. Please click the mic icon in your URL bar and allow access.' }).catch(()=>{});
      break;

    case 'POPUP_START_RECORDING':
      (async () => {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab) await startRecording(tab);
      })();
      break;

    case 'POPUP_STOP_RECORDING':
      (async () => {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab) await stopRecording(tab);
      })();
      break;

    case 'GET_RECORDING_STATE':
      getIsRecording().then(state => sendResponse({ isRecording: state }));
      return true; // Keep channel open for async response

    case 'CONTENT_TOGGLE_RECORDING':
      (async () => {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab) {
          const recording = await getIsRecording();
          if (!recording) {
            await startRecording(tab);
          } else {
            await stopRecording(tab);
          }
        }
      })();
      break;

    case 'CONTENT_UNDO_DICTATION':
      (async () => {
        await handleUndoFeedback(sender?.tab?.id);
      })();
      break;

    case 'OFFSCREEN_AUDIO_BLOB_READY':
      (async () => {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        await processAudio(message.audioDataUrl, tab);
      })();
      break;
  }
});

// ---- Process Audio through Groq Pipeline ----
async function processAudio(audioDataUrl, tab) {
  const settings = await getSettings();

  try {
    const response = await fetch(audioDataUrl);
    const audioBlob = await response.blob();

    // Check audio size - skip if too small (likely just noise)
    if (audioBlob.size < 1000) {
      const errorMsg = 'No speech detected. Please try again.';
      if (tab) {
        chrome.tabs.sendMessage(tab.id, { type: 'VOICEFLOW_ERROR', error: errorMsg }).catch(() => {});
      }
      chrome.runtime.sendMessage({ type: 'POPUP_SHOW_ERROR', error: errorMsg }).catch(()=>{});
      return;
    }

    // Step 1: STT via Groq Whisper with high-accuracy language resolution
    const sttResult = await transcribeWithHighAccuracy(audioBlob, settings);
    const rawTranscript = sttResult.text;

    if (!rawTranscript || rawTranscript.trim().length === 0) {
      const errorMsg = 'Could not transcribe audio. Please speak clearly and try again.';
      if (tab) {
        chrome.tabs.sendMessage(tab.id, { type: 'VOICEFLOW_ERROR', error: errorMsg }).catch(() => {});
      }
      chrome.runtime.sendMessage({ type: 'POPUP_SHOW_ERROR', error: errorMsg }).catch(()=>{});
      return;
    }

    if (sttResult.noiseOnly) {
      const errorMsg = 'Mostly background noise detected. Please move closer to the mic and try again.';
      if (tab) {
        chrome.tabs.sendMessage(tab.id, { type: 'VOICEFLOW_ERROR', error: errorMsg }).catch(() => {});
      }
      chrome.runtime.sendMessage({ type: 'POPUP_SHOW_ERROR', error: errorMsg }).catch(()=>{});
      return;
    }

    const llmInputText = prepareTextForMode(rawTranscript, settings.outputMode);

    // Step 3: LLM Cleanup via Groq Llama
    let cleanedText;
    try {
      cleanedText = await callGroqLlama(llmInputText, settings, tab, sttResult.finalLanguage);
    } catch (llmError) {
      console.warn('LLM cleanup failed, using raw transcript:', llmError);
      cleanedText = llmInputText;
    }

    rememberTranscriptionSession(sttResult, settings, tab);

    // Step 4: Update usage stats
    await updateUsageStats(cleanedText);

    // Step 5: Send to content script for injection
    let injected = false;
    if (tab) {
      try {
        await chrome.tabs.sendMessage(tab.id, {
          type: 'VOICEFLOW_INJECT_TEXT',
          text: cleanedText,
          rawTranscript: rawTranscript,
          language: sttResult.finalLanguage || settings.language
        });
        injected = true;
      } catch (e) {
        console.warn('Could not inject text to active tab (likely on a new tab or settings page).');
      }
    }

    if (!injected) {
      // Fallback: copy to clipboard via offscreen document
      try {
        chrome.runtime.sendMessage({
          type: 'OFFSCREEN_COPY_CLIPBOARD',
          text: cleanedText
        });
        
        // Let the popup know we finished and what the text is (to display it)
        chrome.runtime.sendMessage({
          type: 'POPUP_SHOW_FALLBACK_TEXT',
          text: cleanedText
        });
      } catch (e) {
        console.error('Fallback clipboard copy failed:', e);
      }
    }

  } catch (error) {
    console.error('VoiceFlow processing error:', error);
    if (tab) {
      chrome.tabs.sendMessage(tab.id, {
        type: 'VOICEFLOW_ERROR',
        error: `Processing failed: ${error.message}`
      }).catch(() => {});
    }
    chrome.runtime.sendMessage({ type: 'POPUP_SHOW_ERROR', error: `Processing failed: ${error.message}` }).catch(()=>{});
  }
}

// ---- Groq Whisper STT API (high-accuracy flow) ----
async function transcribeWithHighAccuracy(audioBlob, settings) {
  const primaryResult = await callGroqWhisper(audioBlob, settings, { language: settings.language });

  // If user explicitly selected a language, trust that language lock.
  if (settings.language && settings.language !== 'auto') {
    return {
      ...primaryResult,
      finalLanguage: settings.language,
      noiseOnly: isLikelyNoiseOnly(primaryResult),
      rankedCandidates: [primaryResult]
    };
  }

  // Auto mode: run a focused second pass across likely language candidates.
  const candidates = getAutoLanguageCandidates(
    primaryResult.detectedLanguage,
    settings.autoLanguageBias,
    settings.languageFeedback
  );
  if (candidates.length === 0) {
    return {
      ...primaryResult,
      finalLanguage: primaryResult.detectedLanguage || 'auto',
      noiseOnly: isLikelyNoiseOnly(primaryResult),
      rankedCandidates: [primaryResult]
    };
  }

  const retries = [];
  for (const lang of candidates) {
    // Skip duplicate run if primary pass already used this language.
    if (lang === (primaryResult.requestedLanguage || null)) continue;
    try {
      const alt = await callGroqWhisper(audioBlob, settings, { language: lang });
      retries.push(alt);
    } catch (e) {
      console.warn(`Secondary Whisper pass failed for ${lang}:`, e);
    }
  }

  const rankedCandidates = rankTranscriptions(
    [primaryResult, ...retries],
    settings.languageFeedback
  );
  const best = await maybeResolveLanguageWithVerifier(rankedCandidates, settings);
  return {
    ...best,
    finalLanguage: best.requestedLanguage || best.detectedLanguage || 'auto',
    noiseOnly: isLikelyNoiseOnly(best),
    rankedCandidates
  };
}

async function callGroqWhisper(audioBlob, settings, options = {}) {
  const formData = new FormData();
  formData.append('file', audioBlob, 'recording.webm');
  formData.append('model', 'whisper-large-v3-turbo');
  formData.append('response_format', 'verbose_json');

  const requestedLanguage = options.language && options.language !== 'auto' ? options.language : null;
  if (requestedLanguage) {
    formData.append('language', requestedLanguage);
  }

  const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${settings.groqApiKey}`
    },
    body: formData
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Whisper API error (${response.status}): ${errText}`);
  }

  const data = await response.json();
  const text = (data.text || '').trim();
  const segments = Array.isArray(data.segments) ? data.segments : [];
  const avgNoSpeech = getAverageNoSpeech(segments);
  const avgLogProb = getAverageLogProb(segments);
  const detectedLanguage = normalizeLanguageCode(data.language);

  return {
    text,
    requestedLanguage,
    detectedLanguage,
    avgNoSpeech,
    avgLogProb
  };
}

function normalizeLanguageCode(language) {
  if (!language) return null;
  const normalized = String(language).trim().toLowerCase();
  if (LANGUAGE_MAP[normalized] !== undefined) return normalized;
  return LANGUAGE_CODE_BY_NAME[normalized] || null;
}

function getAverageNoSpeech(segments) {
  const values = segments
    .map((s) => Number(s?.no_speech_prob))
    .filter((v) => Number.isFinite(v));
  if (values.length === 0) return null;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function getAverageLogProb(segments) {
  const values = segments
    .map((s) => Number(s?.avg_logprob))
    .filter((v) => Number.isFinite(v));
  if (values.length === 0) return null;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function getAutoLanguageCandidates(detectedLanguage, autoLanguageBias, languageFeedback) {
  const detected = normalizeLanguageCode(detectedLanguage);
  const candidates = new Set();
  const bias = normalizeLanguageCode(autoLanguageBias);

  if (bias && bias !== 'auto') {
    candidates.add(bias);
  }

  if (detected) {
    candidates.add(detected);
  }

  // Dravidian languages are commonly confused acoustically (ta/te/kn/ml).
  if (detected && DRAVIDIAN_LANGUAGE_GROUP.includes(detected)) {
    DRAVIDIAN_LANGUAGE_GROUP.forEach((lang) => candidates.add(lang));
  }

  // If auto-detection says English (or is unsure), still test major regional options.
  if (!detected || detected === 'en') {
    ['te', 'ta', 'kn', 'ml', 'hi'].forEach((lang) => candidates.add(lang));
  }

  // Include top user-learned languages in auto mode.
  const learnedTop = getTopFeedbackLanguages(languageFeedback, 3);
  learnedTop.forEach((lang) => candidates.add(lang));

  // Always include English in auto mode for mixed usage.
  candidates.add('en');
  candidates.add('hi');

  return Array.from(candidates).filter((lang) => SUPPORTED_LANG_CODES.includes(lang));
}

function getTopFeedbackLanguages(languageFeedback, limit = 3) {
  if (!languageFeedback || typeof languageFeedback !== 'object') return [];
  return Object.entries(languageFeedback)
    .filter(([lang, score]) => SUPPORTED_LANG_CODES.includes(lang) && Number(score) > 0)
    .sort((a, b) => Number(b[1]) - Number(a[1]))
    .slice(0, limit)
    .map(([lang]) => lang);
}

function isLikelyNoiseOnly(result) {
  const textLength = (result?.text || '').trim().length;
  const noSpeech = result?.avgNoSpeech;
  if (textLength === 0 && noSpeech !== null && noSpeech > 0.55) return true;
  if (textLength > 0 && textLength < 3 && noSpeech !== null && noSpeech > 0.65) return true;
  return false;
}

function rankTranscriptions(results, languageFeedback) {
  if (!Array.isArray(results) || results.length === 0) {
    return [];
  }

  return results
    .map((result) => ({
      ...result,
      score: scoreTranscription(result, languageFeedback)
    }))
    .sort((a, b) => b.score - a.score);
}

function scoreTranscription(result, languageFeedback) {
  const text = (result?.text || '').trim();
  const lengthScore = Math.min(text.length / 80, 1.5);
  const words = text.split(/\s+/).filter(Boolean).length;
  const wordScore = Math.min(words / 16, 1.5);
  const logProbScore = Number.isFinite(result?.avgLogProb) ? (result.avgLogProb + 1.2) : 0;
  const noSpeechPenalty = Number.isFinite(result?.avgNoSpeech) ? result.avgNoSpeech * 1.5 : 0;
  const scriptScore = getScriptMatchScore(text, result?.requestedLanguage);
  const feedbackScore = getLanguageFeedbackScore(result, languageFeedback);

  return lengthScore + wordScore + logProbScore + scriptScore + feedbackScore - noSpeechPenalty;
}

function getLanguageFeedbackScore(result, languageFeedback) {
  if (!languageFeedback || typeof languageFeedback !== 'object') return 0;
  const lang = normalizeLanguageCode(result?.requestedLanguage || result?.detectedLanguage);
  if (!lang) return 0;
  const value = Number(languageFeedback[lang]);
  if (!Number.isFinite(value)) return 0;
  return Math.max(-1.2, Math.min(1.2, value * 0.2));
}

async function maybeResolveLanguageWithVerifier(rankedCandidates, settings) {
  if (!Array.isArray(rankedCandidates) || rankedCandidates.length === 0) {
    return null;
  }
  if (rankedCandidates.length === 1) {
    return rankedCandidates[0];
  }

  const top = rankedCandidates[0];
  const second = rankedCandidates[1];
  const topLang = normalizeLanguageCode(top.requestedLanguage || top.detectedLanguage);
  const secondLang = normalizeLanguageCode(second.requestedLanguage || second.detectedLanguage);
  const closeScores = Math.abs(Number(top.score || 0) - Number(second.score || 0)) < 0.45;
  const dravidianAmbiguity = DRAVIDIAN_LANGUAGE_GROUP.includes(topLang) && DRAVIDIAN_LANGUAGE_GROUP.includes(secondLang);

  if (!closeScores && !dravidianAmbiguity) {
    return top;
  }

  const picked = await verifyCandidateWithLlm(rankedCandidates.slice(0, 4), settings);
  return picked || top;
}

async function verifyCandidateWithLlm(candidates, settings) {
  try {
    const payload = candidates.map((candidate, idx) => {
      const lang = normalizeLanguageCode(candidate.requestedLanguage || candidate.detectedLanguage) || 'unknown';
      const text = (candidate.text || '').slice(0, 320);
      return `${idx}: [${lang}] ${text}`;
    }).join('\n');

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${settings.groqApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        temperature: 0,
        max_tokens: 20,
        messages: [
          {
            role: 'system',
            content: 'You are a strict language verifier. Pick the candidate index that best matches the likely spoken language naturally. Return only the index number.'
          },
          {
            role: 'user',
            content: payload
          }
        ]
      })
    });

    if (!response.ok) return null;
    const data = await response.json();
    const content = (data?.choices?.[0]?.message?.content || '').trim();
    const match = content.match(/\d+/);
    if (!match) return null;
    const idx = Number(match[0]);
    if (!Number.isInteger(idx) || idx < 0 || idx >= candidates.length) return null;
    return candidates[idx];
  } catch (e) {
    console.warn('Language verifier failed:', e);
    return null;
  }
}

function getScriptMatchScore(text, language) {
  if (!text || !language) return 0;
  const normalized = normalizeLanguageCode(language);
  if (!normalized) return 0;

  const scriptRanges = {
    ta: [[0x0B80, 0x0BFF]],
    te: [[0x0C00, 0x0C7F]],
    kn: [[0x0C80, 0x0CFF]],
    ml: [[0x0D00, 0x0D7F]],
    hi: [[0x0900, 0x097F]],
    mr: [[0x0900, 0x097F]],
    bn: [[0x0980, 0x09FF]],
    gu: [[0x0A80, 0x0AFF]],
    pa: [[0x0A00, 0x0A7F]],
    en: [[0x0041, 0x005A], [0x0061, 0x007A]]
  };

  const ranges = scriptRanges[normalized];
  if (!ranges) return 0;

  let alphaCount = 0;
  let scriptCount = 0;
  for (const ch of text) {
    const code = ch.codePointAt(0);
    if (!code) continue;
    // Ignore spaces and punctuation.
    if (/\s/.test(ch) || /[.,!?;:'"(){}\[\]<>/_\-]/.test(ch)) continue;
    alphaCount++;
    if (ranges.some(([start, end]) => code >= start && code <= end)) {
      scriptCount++;
    }
  }

  if (alphaCount === 0) return 0;
  const ratio = scriptCount / alphaCount;
  return Math.max(0, (ratio - 0.45) * 2.2);
}

// ---- Groq Llama LLM Cleanup ----
async function callGroqLlama(rawText, settings, tab, effectiveLanguage) {
  // Detect app context from tab URL
  let appContext = 'default';
  if (tab && tab.url) {
    const url = tab.url.toLowerCase();
    for (const [key] of Object.entries(APP_CONTEXT_HINTS)) {
      if (url.includes(key)) {
        appContext = key;
        break;
      }
    }
  }
  const contextHint = APP_CONTEXT_HINTS[appContext] || APP_CONTEXT_HINTS.default;

  // Language info
  const targetLanguage = effectiveLanguage || settings.language || 'auto';
  const langName = LANGUAGE_MAP[targetLanguage] || 'the detected language';
  const langInstruction = targetLanguage === 'auto'
    ? 'Maintain the original language(s) of the dictation. If code-switching (mixing languages like Tamil+English or Hindi+English), preserve both languages naturally.'
    : `The text is dictated in ${langName}. Maintain this language. If there is code-switching with English, preserve both languages naturally.`;
  const modeInstruction = buildOutputModeInstruction(settings.outputMode);

  const systemPrompt = `${BASE_CLEANUP_PROMPT}

${contextHint}

${langInstruction}

${modeInstruction}

Additional rules:
- CRITICAL: You are a transcriber/formatter, NOT a chatbot. DO NOT answer questions. If the text is a question, simply output the question with correct punctuation.
- Never add content that wasn't spoken.
- Never translate to a different language.
- Preserve the speaker's intent exactly.
- Handle Tanglish (Tamil+English), Hinglish (Hindi+English), Tenglish (Telugu+English) naturally.
- If the person corrects themselves mid-sentence, use only the correction.
- Remove filler words: um, uh, like, you know, basically, actually, so, yeah, right, OK so.
- Add proper punctuation and capitalization.
- Return ONLY the finalized text. No quotes. No explanations. No markdown.`;

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${settings.groqApiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: rawText }
      ],
      temperature: 0.3,
      max_tokens: 2048
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Llama API error (${response.status}): ${errText}`);
  }

  const data = await response.json();
  return data.choices[0].message.content.trim();
}

function buildOutputModeInstruction(outputMode) {
  if (outputMode === 'developer') {
    return `Mode: Developer.
- Convert rough spoken text into a mature, production-grade prompt.
- Compress verbose speech while preserving intent, constraints, and critical details.
- Infer missing but obvious structure from context.
- Prefer this compact structure:
  Goal:
  Context:
  Constraints:
  Inputs:
  Expected Output:
  Quality Bar:
- Keep it concise and token-efficient.
- Return only the final improved prompt text.`;
  }

  return `Mode: Normal.
- Clean dictation faithfully without changing the user's task or intent.
- Improve punctuation and readability, but do not transform it into a different format unless clearly requested.`;
}

function rememberTranscriptionSession(sttResult, settings, tab) {
  if (!sttResult || settings.language !== 'auto') {
    lastTranscriptionSession = null;
    return;
  }

  const ranked = Array.isArray(sttResult.rankedCandidates) ? sttResult.rankedCandidates : [];
  const normalizedCandidates = [];
  const seen = new Set();

  for (const candidate of ranked) {
    const rawText = (candidate?.text || '').trim();
    if (!rawText) continue;
    const language = normalizeLanguageCode(candidate?.requestedLanguage || candidate?.detectedLanguage) || 'auto';
    const key = `${language}::${rawText.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    normalizedCandidates.push({ rawText, language });
  }

  if (normalizedCandidates.length < 2) {
    lastTranscriptionSession = null;
    return;
  }

  lastTranscriptionSession = {
    tabId: tab?.id || null,
    createdAt: Date.now(),
    currentIndex: 0,
    settingsSnapshot: { ...settings },
    candidates: normalizedCandidates
  };
}

async function handleUndoFeedback(senderTabId) {
  const session = lastTranscriptionSession;
  if (!session) return;

  // Keep only very recent sessions to avoid stale retries.
  if (Date.now() - session.createdAt > 180000) {
    lastTranscriptionSession = null;
    return;
  }

  const current = session.candidates[session.currentIndex];
  const nextIndex = pickNextCandidateIndex(session);
  const nextCandidate = session.candidates[nextIndex];
  if (!nextCandidate) return;

  let tab = null;
  const targetTabId = senderTabId || session.tabId;
  if (targetTabId) {
    try {
      tab = await chrome.tabs.get(targetTabId);
    } catch (e) {}
  }
  if (!tab) {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    tab = tabs[0];
  }
  if (!tab) return;

  try {
    await chrome.tabs.sendMessage(tab.id, { type: 'VOICEFLOW_PROCESSING' }).catch(() => {});
    const retryInput = nextCandidate.rawText;
    let cleanedRetry;
    try {
      cleanedRetry = await callGroqLlama(retryInput, session.settingsSnapshot, tab, nextCandidate.language);
    } catch (e) {
      cleanedRetry = retryInput;
    }

    await chrome.tabs.sendMessage(tab.id, {
      type: 'VOICEFLOW_INJECT_TEXT',
      text: cleanedRetry,
      rawTranscript: nextCandidate.rawText,
      language: nextCandidate.language
    }).catch(() => {});

    session.currentIndex = nextIndex;
    await updateLanguageFeedback(current?.language, nextCandidate.language);
  } catch (e) {
    console.warn('Retry after undo failed:', e);
  }
}

async function updateLanguageFeedback(previousLanguage, nextLanguage) {
  const settings = await getSettings();
  const feedback = { ...(settings.languageFeedback || {}) };

  const prev = normalizeLanguageCode(previousLanguage);
  const next = normalizeLanguageCode(nextLanguage);

  if (prev && prev !== 'auto') {
    feedback[prev] = Math.max(-8, (Number(feedback[prev]) || 0) - 1);
  }
  if (next && next !== 'auto') {
    feedback[next] = Math.min(8, (Number(feedback[next]) || 0) + 1);
  }

  await chrome.storage.local.set({ languageFeedback: feedback });
}

function pickNextCandidateIndex(session) {
  if (!session || !Array.isArray(session.candidates)) return -1;
  const currentIndex = Number(session.currentIndex) || 0;
  const currentLanguage = normalizeLanguageCode(session.candidates[currentIndex]?.language);

  const remaining = session.candidates
    .map((candidate, idx) => ({ idx, candidate }))
    .filter((entry) => entry.idx > currentIndex);

  if (remaining.length === 0) return -1;

  const preferredOrder = getRetryLanguagePreference(currentLanguage);
  for (const preferredLanguage of preferredOrder) {
    const found = remaining.find((entry) => normalizeLanguageCode(entry.candidate.language) === preferredLanguage);
    if (found) return found.idx;
  }

  return remaining[0].idx;
}

function getRetryLanguagePreference(currentLanguage) {
  if (DRAVIDIAN_LANGUAGE_GROUP.includes(currentLanguage)) {
    return ['te', 'ta', 'kn', 'ml', 'hi', 'en'];
  }
  return ['te', 'hi', 'ta', 'kn', 'ml', 'en'];
}

function prepareTextForMode(text, outputMode) {
  if (!text) return '';
  if (outputMode !== 'developer') return text;

  // Lightweight pre-compression before prompt-optimization to reduce token load.
  let compact = text
    .replace(/\b(um+|uh+|you know|like|actually|basically|okay so|ok so)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Collapse immediately repeated words: "the the issue" -> "the issue"
  compact = compact.replace(/\b(\w+)\s+\1\b/gi, '$1');
  return compact;
}

// ---- Usage Stats ----
async function updateUsageStats(text) {
  const settings = await getSettings();
  const wordCount = text.split(/\s+/).filter(w => w.length > 0).length;
  const today = new Date().toDateString();
  const monday = getMonday(new Date()).toDateString();

  if (settings.lastResetDate !== today) {
    settings.wordsToday = 0;
    settings.lastResetDate = today;
  }
  if (settings.lastWeekResetDate !== monday) {
    settings.wordsTotalWeek = 0;
    settings.lastWeekResetDate = monday;
  }

  settings.wordsToday += wordCount;
  settings.wordsTotalWeek += wordCount;

  await chrome.storage.local.set(settings);
}

// ---- Settings Management ----
async function getSettings() {
  return new Promise((resolve) => {
    chrome.storage.local.get(DEFAULT_SETTINGS, (result) => {
      resolve(result);
    });
  });
}


