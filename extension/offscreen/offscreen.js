// ============================================================
// VoiceFlow India — Offscreen Document Script
// Handles microphone recording in Manifest V3
// Chrome Extensions cannot access getUserMedia from background
// service workers, so this offscreen document handles it.
// ============================================================

let mediaRecorder = null;
let audioChunks = [];
let isStopPending = false;
let isStarting = false;
let meterAudioContext = null;
let meterAnalyser = null;
let meterSource = null;
let meterBuffer = null;
let meterInterval = null;
let meterSmoothedLevel = 0;
let highNoiseStreak = 0;

chrome.runtime.onMessage.addListener((message) => {
  switch (message.type) {
    case 'OFFSCREEN_START_RECORDING':
      startRecording();
      break;
    case 'OFFSCREEN_STOP_RECORDING':
      stopRecording();
      break;
    case 'OFFSCREEN_COPY_CLIPBOARD':
      copyToClipboard(message.text);
      break;
  }
});

async function copyToClipboard(text) {
  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
  } catch (error) {
    console.error('Offscreen clipboard copy failed:', error);
  }
}

async function startRecording() {
  if (isStarting) return;
  isStarting = true;
  isStopPending = false;

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: { ideal: 1 },
        sampleRate: { ideal: 16000 },
        sampleSize: { ideal: 16 },
        echoCancellation: { ideal: true },
        noiseSuppression: { ideal: true },
        autoGainControl: { ideal: true },
        latency: { ideal: 0.01 },
        // Browser-specific hints for stronger noise filtering where supported.
        googEchoCancellation: true,
        googAutoGainControl: true,
        googNoiseSuppression: true,
        googHighpassFilter: true
      }
    });

    audioChunks = [];
    try {
      startNoiseMonitoring(stream);
    } catch (e) {
      console.warn('Noise monitor init failed:', e);
    }

    // Use webm/opus format — well supported and Groq accepts it
    mediaRecorder = new MediaRecorder(stream, {
      mimeType: 'audio/webm;codecs=opus',
      audioBitsPerSecond: 128000
    });

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        audioChunks.push(event.data);
      }
    };

    mediaRecorder.onstop = async () => {
      stopNoiseMonitoring(true);
      // Stop all tracks
      stream.getTracks().forEach(track => track.stop());

      // Create blob from chunks
      const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });

      // Convert to data URL to send via message
      const reader = new FileReader();
      reader.onloadend = () => {
        chrome.runtime.sendMessage({
          type: 'OFFSCREEN_AUDIO_BLOB_READY',
          audioDataUrl: reader.result
        });
      };
      reader.readAsDataURL(audioBlob);
    };

    // Start recording
    mediaRecorder.start();

    // If a stop request came in while we were awaiting getUserMedia, execute it immediately
    if (isStopPending) {
      mediaRecorder.stop();
      isStopPending = false;
    }

  } catch (error) {
    console.warn('Offscreen: Failed to start recording (likely mic permission denied):', error);
    stopNoiseMonitoring(true);
    chrome.runtime.sendMessage({
      type: 'OFFSCREEN_RECORDING_ERROR',
      error: error.message
    });
  } finally {
    isStarting = false;
  }
}

function stopRecording() {
  if (isStarting) {
    // MediaRecorder isn't ready yet, defer the stop
    isStopPending = true;
  } else if (mediaRecorder && mediaRecorder.state === 'recording') {
    // MediaRecorder is already running, stop normally
    mediaRecorder.stop();
  } else {
    stopNoiseMonitoring(true);
  }
}

function startNoiseMonitoring(stream) {
  stopNoiseMonitoring(false);

  meterAudioContext = new AudioContext();
  meterSource = meterAudioContext.createMediaStreamSource(stream);
  meterAnalyser = meterAudioContext.createAnalyser();
  meterAnalyser.fftSize = 1024;
  meterAnalyser.smoothingTimeConstant = 0.85;
  meterSource.connect(meterAnalyser);
  meterBuffer = new Uint8Array(meterAnalyser.fftSize);
  meterSmoothedLevel = 0;
  highNoiseStreak = 0;

  meterInterval = setInterval(() => {
    if (!meterAnalyser || !meterBuffer) return;

    meterAnalyser.getByteTimeDomainData(meterBuffer);
    let sumSquares = 0;
    for (let i = 0; i < meterBuffer.length; i += 1) {
      const sample = (meterBuffer[i] - 128) / 128;
      sumSquares += sample * sample;
    }

    const rms = Math.sqrt(sumSquares / meterBuffer.length);
    const db = 20 * Math.log10(rms + 1e-6);
    const mappedLevel = clamp((db + 60) / 45, 0, 1);
    meterSmoothedLevel = (meterSmoothedLevel * 0.66) + (mappedLevel * 0.34);

    const highNoiseNow = db > -22 && meterSmoothedLevel > 0.62;
    highNoiseStreak = highNoiseNow ? highNoiseStreak + 1 : Math.max(0, highNoiseStreak - 1);
    const tooNoisy = highNoiseStreak >= 7;

    chrome.runtime.sendMessage({
      type: 'OFFSCREEN_NOISE_LEVEL',
      level: Number(meterSmoothedLevel.toFixed(3)),
      db: Number(db.toFixed(1)),
      tooNoisy,
      active: true
    }).catch(() => {});
  }, 120);
}

function stopNoiseMonitoring(sendReset) {
  if (meterInterval) {
    clearInterval(meterInterval);
    meterInterval = null;
  }

  if (meterSource) {
    meterSource.disconnect();
    meterSource = null;
  }

  if (meterAnalyser) {
    meterAnalyser.disconnect();
    meterAnalyser = null;
  }

  if (meterAudioContext) {
    meterAudioContext.close().catch(() => {});
    meterAudioContext = null;
  }

  meterBuffer = null;
  meterSmoothedLevel = 0;
  highNoiseStreak = 0;

  if (sendReset) {
    chrome.runtime.sendMessage({
      type: 'OFFSCREEN_NOISE_LEVEL',
      level: 0,
      db: -120,
      tooNoisy: false,
      active: false
    }).catch(() => {});
  }
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(value, max));
}
