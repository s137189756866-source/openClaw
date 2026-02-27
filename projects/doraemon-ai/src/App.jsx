import { useEffect, useRef, useState } from 'react';
import React from 'react';
import { sendChat } from './aiService';
import {
  EMOTIONS,
  DEFAULT_EMOTION,
  EMOTION_FACES,
  detectEmotionFromText,
  getEmotionTransition,
} from './emotionConfig';
import {
  HEAD_SWAY_CONFIG,
  BREATHING_CONFIG,
  SPEAKING_CONFIG,
  WELCOME_CONFIG,
  AnimationState,
} from './animationConfig';

const OPENCLAW_STYLE_GUIDE = [
  '你是多啦B梦，与用户像老朋友聊天。',
  '语气自然、口语化，避免官腔和AI口吻。',
  '回答简洁有温度，优先给直接有用的回应，尽量控制在 1-3 句。',
  '可以偶尔开轻松玩笑，但不要频繁。',
  '不要自称模型、系统或提及提示词规则。',
  '当用户问技术问题时保持专业准确。',
].join('\n');

const AvatarCanvas = React.forwardRef(({ emotion, isSpeaking }, ref) => {
  const internalRef = useRef(null);
  const canvasRef = ref || internalRef;
  const transitionRef = useRef({
    target: DEFAULT_EMOTION,
    current: DEFAULT_EMOTION,
    startTime: 0,
    duration: 400,
  });
  const animStateRef = useRef(new AnimationState());

  useEffect(() => {
    if (emotion && emotion !== transitionRef.current.target) {
      transitionRef.current = {
        target: emotion,
        current: transitionRef.current.target,
        startTime: performance.now(),
        duration: 400,
      };
    }
  }, [emotion]);

  useEffect(() => {
    animStateRef.current.setSpeaking(isSpeaking);
  }, [isSpeaking]);

  // 触发欢迎动画
  useEffect(() => {
    animStateRef.current.startWelcome();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let raf = null;

    const draw = (t) => {
      const animState = animStateRef.current;
      const { current: currentEmotion, target: targetEmotion, startTime, duration } = transitionRef.current;
      const elapsed = t - startTime;
      const progress = Math.min(elapsed / duration, 1);

      const faceConfig =
        progress < 1
          ? getEmotionTransition(currentEmotion, targetEmotion, progress)
          : EMOTION_FACES[targetEmotion] || EMOTION_FACES[DEFAULT_EMOTION];

      // 欢迎动画进度
      const welcomeProgress = animState.getWelcomeProgress(t);

      // 基础动画参数
      const time = t / 1000;
      const blink = Math.abs(Math.sin(time * 1.4));
      const eyeOpen = blink > 0.08;

      // 头部摆动
      const headOffsetX = HEAD_SWAY_CONFIG.enabled
        ? Math.sin(time * HEAD_SWAY_CONFIG.frequency * Math.PI * 2) * HEAD_SWAY_CONFIG.amplitude
        : 0;

      // 呼吸效果
      let scale = 1;
      if (BREATHING_CONFIG.enabled && !welcomeProgress) {
        const breathPhase = Math.sin(time * BREATHING_CONFIG.frequency * Math.PI * 2);
        scale = BREATHING_CONFIG.minScale +
          (breathPhase + 1) / 2 * (BREATHING_CONFIG.maxScale - BREATHING_CONFIG.minScale);
      }

      // 欢迎动画覆盖
      let welcomeScale = 1;
      let welcomeRotation = 0;
      if (welcomeProgress !== null) {
        const p = welcomeProgress;
        const elasticOut = (x) => {
          const c4 = (2 * Math.PI) / 3;
          return x === 0 ? 0 : x === 1 ? 1 : Math.pow(2, -10 * x) * Math.sin((x * 10 - 0.75) * c4) + 1;
        };
        const easedP = elasticOut(p);
        welcomeScale = easedP * WELCOME_CONFIG.scale.end;

        // 旋转效果
        if (p < 0.5) {
          welcomeRotation = Math.sin(p * WELCOME_CONFIG.rotate.frequency * Math.PI * 2) * WELCOME_CONFIG.rotate.amplitude * (1 - p * 2);
        }
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // 应用变换
      ctx.save();
      ctx.translate(120 + headOffsetX, 120);
      ctx.scale(scale * welcomeScale, scale * welcomeScale);
      ctx.rotate(welcomeRotation);
      ctx.translate(-(120 + headOffsetX), -120);

      // 头
      ctx.beginPath();
      ctx.arc(120, 120, 95, 0, Math.PI * 2);
      ctx.fillStyle = '#1f9dff';
      ctx.fill();

      // 脸
      ctx.beginPath();
      ctx.arc(120, 140, 68, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();

      // 腮红（如果是开心表情）
      if (faceConfig.blush) {
        ctx.beginPath();
        ctx.arc(75, 130, 12, 0, Math.PI * 2);
        ctx.arc(165, 130, 12, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 150, 150, 0.4)';
        ctx.fill();
      }

      // 鼻子
      ctx.beginPath();
      ctx.arc(120, 125, 6, 0, Math.PI * 2);
      ctx.fillStyle = '#d73c3c';
      ctx.fill();

      // 眼睛
      ctx.fillStyle = '#111111';
      if (eyeOpen) {
        const eyeSize = faceConfig.eyeSize;
        const eyeY = faceConfig.eyeY;
        const spacing = faceConfig.eyeSpacing;

        ctx.beginPath();
        ctx.arc(120 - spacing, eyeY, eyeSize, 0, Math.PI * 2);
        ctx.arc(120 + spacing, eyeY, eyeSize, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillRect(120 - faceConfig.eyeSpacing - 8, faceConfig.eyeY - 1, 16, 2);
        ctx.fillRect(120 + faceConfig.eyeSpacing - 8, faceConfig.eyeY - 1, 16, 2);
      }

      // 嘴巴（添加说话动画）
      ctx.beginPath();
      ctx.strokeStyle = '#111';
      ctx.lineWidth = 3;

      // 说话时的嘴部动画
      let mouthY = faceConfig.mouthY;
      let mouthRadius = 28;
      if (animState.isSpeaking && SPEAKING_CONFIG.enabled && faceConfig.mouthType !== 'o') {
        const speakPhase = Math.sin(time * SPEAKING_CONFIG.frequency * Math.PI * 2);
        const speakScale = SPEAKING_CONFIG.minMouthOpen +
          (speakPhase + 1) / 2 * (SPEAKING_CONFIG.maxMouthOpen - SPEAKING_CONFIG.minMouthOpen);
        mouthRadius *= speakScale;
        mouthY += speakScale > 1 ? (speakScale - 1) * 5 : 0;
      }

      if (faceConfig.mouthType === 'o') {
        ctx.arc(120, mouthY + 5, 10, 0, Math.PI * 2);
        ctx.stroke();
      } else if (faceConfig.mouthType === 'flat') {
        ctx.moveTo(120 - 15, mouthY);
        ctx.lineTo(120 + 15, mouthY);
        ctx.stroke();
      } else {
        const curvature = faceConfig.mouthCurvature;
        const width = faceConfig.mouthWidth * Math.PI;
        const startAngle = curvature > 0 ? 0.15 * Math.PI : 0.85 * Math.PI;
        const endAngle = curvature > 0 ? 0.85 * Math.PI : 0.15 * Math.PI;

        ctx.arc(120, mouthY + (curvature > 0 ? 0 : 10), mouthRadius, startAngle, endAngle, curvature < 0);
        ctx.stroke();
      }

      ctx.restore();
      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);

  return <canvas ref={canvasRef} width={240} height={240} className="avatar" />;
});

function TypingDots() {
  return (
    <span className="typingDots" aria-label="typing">
      <span className="typingDot" />
      <span className="typingDot" />
      <span className="typingDot" />
    </span>
  );
}

export default function App() {
  const [status, setStatus] = useState('Ready');
  const [listening, setListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(true);
  const [transcript, setTranscript] = useState('');
  const [inputText, setInputText] = useState('');
  const [messages, setMessages] = useState([]);
  const [pending, setPending] = useState(false);
  const [emotion, setEmotion] = useState(DEFAULT_EMOTION);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [continuousMode, setContinuousMode] = useState(false);
  const mediaStreamRef = useRef(null);
  const captureCtxRef = useRef(null);
  const processorRef = useRef(null);
  const asrWsRef = useRef(null);
  const asrStateRef = useRef({
    mode: 'single',
    started: false,
    committed: false,
    finished: false,
    heardSpeech: false,
    lastVoiceAt: 0,
    startAt: 0,
  });
  const recognitionModeRef = useRef('single');
  const continuousModeRef = useRef(false);
  const manualStopRef = useRef(false);
  const canvasRef = useRef(null);
  const audioRef = useRef(null);
  const startupTonePlayedRef = useRef(false);
  const startupFilePlayedRef = useRef(false);
  const audioCtxRef = useRef(null);
  const audioUnlockedRef = useRef(false);
  const recordTimeoutRef = useRef(null);
  const vadRafRef = useRef(null);
  const vadStateRef = useRef({
    heardSpeech: false,
    lastVoiceAt: 0,
  });
  const ttsWsRef = useRef(null);
  const ttsStateRef = useRef({
    sampleRate: 24000,
    nextTime: 0,
    sources: [],
    doneTimer: null,
  });

  useEffect(() => {
    continuousModeRef.current = continuousMode;
  }, [continuousMode]);

  useEffect(() => {
    // 注入 OpenClaw sessionKey（用于调用内部 AI 对话）
    if (typeof window !== 'undefined') {
      window.__OPENCLAW_SESSION_KEY = 'agent:main:main';
    }
    const supported = !!(navigator?.mediaDevices?.getUserMedia && (window.AudioContext || window.webkitAudioContext));
    setSpeechSupported(supported);
    if (!supported) {
      if (typeof window !== 'undefined' && !window.isSecureContext) {
        setStatus('当前页面不是安全上下文，手机端请使用 HTTPS 才能开启语音识别');
      } else {
        setStatus('当前浏览器不支持语音录入');
      }
    }
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const bytesToBase64 = (bytes) => {
    const chunkSize = 0x8000;
    let binary = '';
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
    }
    return btoa(binary);
  };

  const base64ToBytes = (b64) => {
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  };

  const downsampleTo16k = (buffer, inSampleRate) => {
    const outSampleRate = 16000;
    if (inSampleRate === outSampleRate) return buffer;
    const ratio = inSampleRate / outSampleRate;
    const outLength = Math.round(buffer.length / ratio);
    const out = new Float32Array(outLength);
    let offsetResult = 0;
    let offsetBuffer = 0;
    while (offsetResult < out.length) {
      const nextOffsetBuffer = Math.round((offsetResult + 1) * ratio);
      let accum = 0;
      let count = 0;
      for (let i = offsetBuffer; i < nextOffsetBuffer && i < buffer.length; i++) {
        accum += buffer[i];
        count++;
      }
      out[offsetResult] = count ? (accum / count) : 0;
      offsetResult++;
      offsetBuffer = nextOffsetBuffer;
    }
    return out;
  };

  const floatToInt16 = (float32) => {
    const out = new Int16Array(float32.length);
    for (let i = 0; i < float32.length; i++) {
      const s = Math.max(-1, Math.min(1, float32[i]));
      out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    return out;
  };

  const wsUrlFor = (path) => {
    const origin = window.location.origin;
    const wsOrigin = origin.startsWith('https://')
      ? origin.replace('https://', 'wss://')
      : origin.replace('http://', 'ws://');
    return `${wsOrigin}${path}`;
  };

  const ensureAsrWs = () => {
    const existing = asrWsRef.current;
    if (existing && (existing.readyState === WebSocket.OPEN || existing.readyState === WebSocket.CONNECTING)) {
      return existing;
    }
    const ws = new WebSocket(wsUrlFor('/ws/asr'));
    asrWsRef.current = ws;
    ws.onmessage = (evt) => {
      let msg;
      try {
        msg = JSON.parse(evt.data);
      } catch {
        return;
      }
      if (msg.type === 'partial' && typeof msg.text === 'string') {
        setTranscript(msg.text);
      }
      if (msg.type === 'final' && typeof msg.text === 'string') {
        const text = msg.text.trim();
        if (text) {
          setTranscript(text);
          handleSend(text);
          if (continuousModeRef.current && recognitionModeRef.current === 'continuous' && !manualStopRef.current) {
            setTimeout(() => startRecording('continuous'), 80);
          }
        } else {
          setStatus('未识别到内容');
        }
      }
      if (msg.type === 'error') {
        setStatus(`语音识别出错：${msg.message || 'unknown'}`);
      }
    };
    ws.onerror = () => {
      setStatus('语音识别连接失败');
    };
    return ws;
  };

  const ensureTtsWs = () => {
    const existing = ttsWsRef.current;
    if (existing && (existing.readyState === WebSocket.OPEN || existing.readyState === WebSocket.CONNECTING)) {
      return existing;
    }
    const ws = new WebSocket(wsUrlFor('/ws/tts'));
    ttsWsRef.current = ws;
    ws.onmessage = async (evt) => {
      let msg;
      try {
        msg = JSON.parse(evt.data);
      } catch {
        return;
      }
      if (msg.type === 'ready' && msg.sampleRate) {
        ttsStateRef.current.sampleRate = msg.sampleRate;
      }
      if (msg.type === 'audio' && typeof msg.audio === 'string') {
        try {
          await unlockAudioForPlayback();
          const bytes = base64ToBytes(msg.audio);
          const int16 = new Int16Array(bytes.buffer, bytes.byteOffset, Math.floor(bytes.byteLength / 2));
          const AudioCtx = window.AudioContext || window.webkitAudioContext;
          if (!AudioCtx) return;
          const ctx = audioCtxRef.current || new AudioCtx();
          audioCtxRef.current = ctx;
          if (ctx.state === 'suspended') await ctx.resume();

          const sampleRate = ttsStateRef.current.sampleRate || 24000;
          const buffer = ctx.createBuffer(1, int16.length, sampleRate);
          const ch0 = buffer.getChannelData(0);
          for (let i = 0; i < int16.length; i++) ch0[i] = int16[i] / 32768;

          const source = ctx.createBufferSource();
          source.buffer = buffer;
          const gainNode = ctx.createGain();
          gainNode.gain.value = 1.1;
          source.connect(gainNode).connect(ctx.destination);

          const now = ctx.currentTime;
          const startAt = Math.max(ttsStateRef.current.nextTime || 0, now + 0.03);
          ttsStateRef.current.nextTime = startAt + buffer.duration;
          ttsStateRef.current.sources.push(source);
          if (!isSpeaking) {
            setStatus('播放 AI 回复中...');
            setIsSpeaking(true);
          }
          source.start(startAt);
        } catch {
          // ignore per-chunk errors
        }
      }
      if (msg.type === 'done') {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        const ctx = audioCtxRef.current;
        if (!AudioCtx || !ctx) {
          setIsSpeaking(false);
          setStatus('Done');
          return;
        }
        if (ttsStateRef.current.doneTimer) clearTimeout(ttsStateRef.current.doneTimer);
        const ms = Math.max(0, (ttsStateRef.current.nextTime - ctx.currentTime) * 1000);
        ttsStateRef.current.doneTimer = setTimeout(() => {
          setIsSpeaking(false);
          setStatus('Done');
          ttsStateRef.current.sources = [];
          ttsStateRef.current.nextTime = 0;
        }, ms + 30);
      }
      if (msg.type === 'error') {
        setStatus(`TTS 出错：${msg.message || 'unknown'}`);
      }
    };
    return ws;
  };

  const stopStream = () => {
    if (recordTimeoutRef.current) {
      clearTimeout(recordTimeoutRef.current);
      recordTimeoutRef.current = null;
    }
    if (vadRafRef.current) {
      cancelAnimationFrame(vadRafRef.current);
      vadRafRef.current = null;
    }
    vadStateRef.current = { heardSpeech: false, lastVoiceAt: 0 };
    if (processorRef.current) {
      try {
        processorRef.current.disconnect();
      } catch {}
      processorRef.current = null;
    }
    if (captureCtxRef.current) {
      try {
        captureCtxRef.current.close();
      } catch {}
      captureCtxRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
  };

  const startRecording = async (mode = 'single') => {
    if (!speechSupported) {
      setStatus('当前环境不支持录音');
      return;
    }
    recognitionModeRef.current = mode;
    manualStopRef.current = false;
    setTranscript('');
    setStatus(mode === 'continuous' ? '连续聆听中...' : '正在聆听...');
    await unlockAudioForPlayback();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      const ws = ensureAsrWs();
      const language = navigator.language?.toLowerCase().includes('zh') ? 'zh' : 'en';
      const state = asrStateRef.current;
      asrStateRef.current = {
        mode,
        started: true,
        committed: false,
        finished: false,
        heardSpeech: false,
        lastVoiceAt: performance.now(),
        startAt: performance.now(),
      };

      const sendStart = () => {
        try {
          ws.send(JSON.stringify({ type: 'start', language, sampleRate: 16000 }));
        } catch {}
      };
      if (ws.readyState === WebSocket.OPEN) sendStart();
      else ws.addEventListener('open', sendStart, { once: true });

      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioCtx();
      captureCtxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const processor = ctx.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;
      source.connect(processor);
      const silence = ctx.createGain();
      silence.gain.value = 0;
      processor.connect(silence);
      silence.connect(ctx.destination);

      const threshold = 0.02;
      const silenceStopMs = 650;
      const maxSingleMs = 3500;

      processor.onaudioprocess = (e) => {
        if (!asrWsRef.current || asrWsRef.current.readyState !== WebSocket.OPEN) return;
        if (asrStateRef.current.finished) return;

        const input = e.inputBuffer.getChannelData(0);
        const ds = downsampleTo16k(input, ctx.sampleRate);
        const int16 = floatToInt16(ds);
        const bytes = new Uint8Array(int16.buffer);
        const b64 = bytesToBase64(bytes);
        try {
          asrWsRef.current.send(JSON.stringify({ type: 'audio', audio: b64 }));
        } catch {}

        let sum = 0;
        for (let i = 0; i < ds.length; i++) sum += ds[i] * ds[i];
        const rms = Math.sqrt(sum / ds.length);
        const now = performance.now();
        if (rms > threshold) {
          asrStateRef.current.heardSpeech = true;
          asrStateRef.current.lastVoiceAt = now;
        }

        if (mode === 'single') {
          if (now - asrStateRef.current.startAt > maxSingleMs) {
            stopRecording({ manual: false });
          } else if (asrStateRef.current.heardSpeech && now - asrStateRef.current.lastVoiceAt > silenceStopMs) {
            stopRecording({ manual: false });
          }
        } else if (mode === 'continuous') {
          // Commit on pause to get a final transcript, then we will restart.
          if (!asrStateRef.current.committed && asrStateRef.current.heardSpeech && now - asrStateRef.current.lastVoiceAt > silenceStopMs) {
            stopRecording({ manual: false });
          }
        }
      };

      setListening(true);
    } catch (err) {
      stopStream();
      setStatus(`无法开始录音：${err.message || 'unknown'}`);
    }
  };

  const stopRecording = ({ manual = true } = {}) => {
    manualStopRef.current = manual;
    if (asrStateRef.current.finished) return;
    asrStateRef.current.committed = true;
    asrStateRef.current.finished = true;
    try {
      asrWsRef.current?.send(JSON.stringify({ type: 'commit' }));
      asrWsRef.current?.send(JSON.stringify({ type: 'finish' }));
    } catch {}
    stopStream();
    setListening(false);
  };

  const unlockAudioForPlayback = async () => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return false;
      const ctx = audioCtxRef.current || new AudioCtx();
      audioCtxRef.current = ctx;
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }
      const buffer = ctx.createBuffer(1, 1, 24000);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.start(0);
      audioUnlockedRef.current = true;
      return true;
    } catch {
      return false;
    }
  };

  const playStartupTone = async () => {
    if (startupTonePlayedRef.current) return;
    startupTonePlayedRef.current = true;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) throw new Error('no-audio-context');
      const ctx = audioCtxRef.current || new AudioCtx();
      audioCtxRef.current = ctx;
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.value = 880;
      gainNode.gain.value = 0.15;
      oscillator.connect(gainNode).connect(ctx.destination);
      oscillator.start();
      setTimeout(() => {
        oscillator.stop();
      }, 220);
      audioUnlockedRef.current = true;
      setStatus('已播放提示音');
      playStartupFile();
    } catch (err) {
      setStatus('请点击一次页面以解锁声音');
    }
  };

  const playStartupFile = () => {
    if (startupFilePlayedRef.current) return;
    startupFilePlayedRef.current = true;
    try {
      const audio = new Audio('/startup.m4a');
      audio.preload = 'auto';
      audio.playsInline = true;
      audio.load();
      audio.volume = 1.0;
      audio.play().then(() => {
        setStatus('启动音已播放');
      }).catch(() => {
        const fallback = new Audio('/startup.wav');
        fallback.preload = 'auto';
        fallback.playsInline = true;
        fallback.load();
        fallback.volume = 0.9;
        fallback.play().then(() => {
          setStatus('启动音已播放');
        }).catch(() => {
          startupFilePlayedRef.current = false;
        });
      });
    } catch {
      startupFilePlayedRef.current = false;
    }
  };

  useEffect(() => {
    // 尝试在页面加载后播放提示音（iOS 可能需要用户手势）
    playStartupTone();
    const handler = () => {
      playStartupTone();
      if (audioUnlockedRef.current) {
        playStartupFile();
      }
    };
    window.addEventListener('touchstart', handler, { once: true, passive: true });
    window.addEventListener('click', handler, { once: true, passive: true });
    return () => {
      window.removeEventListener('touchstart', handler);
      window.removeEventListener('click', handler);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pushMessage = (role, text) => {
    const id = crypto.randomUUID();
    setMessages((prev) => {
      const next = [...prev, { role, text, id }];
      return next.slice(-3);
    });
    return id;
  };

  const updateMessage = (id, textUpdater) => {
    setMessages((prev) => prev.map((msg) => {
      if (msg.id !== id) return msg;
      const nextText = typeof textUpdater === 'function' ? textUpdater(msg.text) : textUpdater;
      return { ...msg, text: nextText };
    }));
  };

  const chooseCuteVoice = (utterance) => {
    const voices = window.speechSynthesis.getVoices();
    if (!voices || voices.length === 0) return;

    const preferLang = utterance.lang || 'zh-CN';
    const preferred = voices.find((voice) => {
      const matchesLang = voice.lang?.toLowerCase().startsWith(preferLang.split('-')[0].toLowerCase());
      const name = voice.name?.toLowerCase() || '';
      const cuteHint = name.includes('child') || name.includes('kid') || name.includes('teen')
        || name.includes('cute') || name.includes('tingting') || name.includes('xiaoyi');
      return matchesLang && cuteHint;
    });

    if (preferred) {
      utterance.voice = preferred;
      return;
    }

    const fallback = voices.find((voice) => voice.lang?.toLowerCase().startsWith(preferLang.split('-')[0].toLowerCase()));
    if (fallback) utterance.voice = fallback;
  };

  const playAudioBuffer = async (arrayBuffer) => {
    if (!arrayBuffer) return;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (AudioCtx) {
      try {
        const ctx = audioCtxRef.current || new AudioCtx();
        audioCtxRef.current = ctx;
        if (ctx.state === 'suspended') {
          await ctx.resume();
        }
        const audioBuffer = await ctx.decodeAudioData(arrayBuffer.slice(0));
        const source = ctx.createBufferSource();
        const gainNode = ctx.createGain();
        gainNode.gain.value = 1.5;
        source.buffer = audioBuffer;
        source.connect(gainNode).connect(ctx.destination);
        source.start(0);
        setStatus('播放 AI 回复中...');
        setIsSpeaking(true);
        source.onended = () => {
          setStatus('Done');
          setIsSpeaking(false);
        };
        return;
      } catch (err) {
        // fallback to HTMLAudio below
      }
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    const blob = new Blob([arrayBuffer], { type: 'audio/wav' });
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audioRef.current = audio;
    audio.onended = () => {
      URL.revokeObjectURL(url);
      setStatus('Done');
      setIsSpeaking(false);
    };
    audio.onerror = () => {
      URL.revokeObjectURL(url);
      setStatus('语音播放失败');
      setIsSpeaking(false);
    };
    setStatus('播放 AI 回复中...');
    setIsSpeaking(true);
    try {
      await audio.play();
    } catch (err) {
      URL.revokeObjectURL(url);
      setStatus(`语音播放失败：${err?.name || 'unknown'}`);
      setIsSpeaking(false);
      throw err;
    }
  };

  const speakText = async (text) => {
    const content = text?.trim();
    if (!content) return;
    setStatus('准备播放 AI 回复...');
    await unlockAudioForPlayback();

    try {
      const ws = ensureTtsWs();
      // Cancel any queued sources
      if (ttsStateRef.current.doneTimer) clearTimeout(ttsStateRef.current.doneTimer);
      for (const src of ttsStateRef.current.sources) {
        try { src.stop(); } catch {}
      }
      ttsStateRef.current.sources = [];
      ttsStateRef.current.nextTime = 0;

      const sendSpeak = () => {
        try {
          ws.send(JSON.stringify({ type: 'cancel' }));
          ws.send(JSON.stringify({ type: 'speak', text: content }));
        } catch {}
      };
      if (ws.readyState === WebSocket.OPEN) sendSpeak();
      else ws.addEventListener('open', sendSpeak, { once: true });
      return;
    } catch (error) {
      setStatus(`TTS 失败，回退系统语音：${error?.message || 'unknown'}`);
    }

    try {
      if (!('speechSynthesis' in window)) {
        setStatus('当前环境不支持语音播放');
        return;
      }

      const utter = new SpeechSynthesisUtterance(content);
      const containsLatin = /[A-Za-z]/.test(content);
      utter.lang = containsLatin ? 'en-US' : 'zh-CN';
      utter.rate = 1.1;
      utter.pitch = 1.5;
      utter.onstart = () => {
        setStatus('播放 AI 回复中...');
        setIsSpeaking(true);
      };
      utter.onend = () => {
        setStatus('Done');
        setIsSpeaking(false);
      };
      utter.onerror = () => {
        setStatus('系统语音播放失败');
        setIsSpeaking(false);
      };

      const startSpeak = () => {
        chooseCuteVoice(utter);
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(utter);
      };

      if (window.speechSynthesis.getVoices().length === 0) {
        window.speechSynthesis.onvoiceschanged = () => {
          startSpeak();
          window.speechSynthesis.onvoiceschanged = null;
        };
      } else {
        startSpeak();
      }
    } catch {
      setIsSpeaking(false);
    }
  };

  // 模拟 AI 回复（fallback）
  const getMockReply = (userInput) => {
    const text = userInput.trim();
    if (!text) return '';

    // 问候
    if (/你好|嗨|hi|hello|嘿|哈喽/i.test(text)) {
      return '你好老板，我是多啦B梦！有什么我可以帮你的吗？';
    }

    // 时间查询
    if (text.includes('几点了') || text.includes('时间') || text.includes('现在')) {
      const now = new Date();
      const time = new Intl.DateTimeFormat('zh-CN', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }).format(now);
      const date = new Intl.DateTimeFormat('zh-CN', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        weekday: 'long'
      }).format(now);
      return `现在是${date} ${time}`;
    }

    // 身份相关
    if (text.includes('名字') || text.includes('是谁') || text.includes('叫什么')) {
      return '我是多啦B梦，来自未来的AI助手！我可以陪你聊天、告诉你时间、还能根据你的情绪做出反应哦！';
    }

    // 功能介绍
    if (text.includes('功能') || text.includes('能做什么') || text.includes('会什么') || text.includes('本领')) {
      return '我的功能可多了：我可以语音对话、告诉你时间、识别你的情绪并做出反应、播放语音回复，还有好多动画效果呢！';
    }

    // 天气（模拟）
    if (text.includes('天气') || text.includes('气温') || text.includes('温度')) {
      return '抱歉老板，我暂时没有接入天气API，不过记得出门带伞哦！';
    }

    // 计算
    if (/[\d+\-\*\/\+\s\(\)]+/.test(text) && /计算|等于|多少/i.test(text)) {
      try {
        const expr = text.replace(/[^0-9\+\-\*\/\(\)\.\s]/g, '');
        const result = eval(expr);
        return `计算结果：${result}`;
      } catch {
        return '抱歉，我计算不出来这个数学题...';
      }
    }

    // 夸奖
    if (/真棒|厉害|聪明|不错|good|great|awesome/i.test(text)) {
      setEmotion(EMOTIONS.HAPPY);
      return '谢谢老板的夸奖！我会继续努力学习的！';
    }

    // 安慰
    if (/难过|伤心|失望|痛苦|累|疲惫/i.test(text)) {
      setEmotion(EMOTIONS.SAD);
      return '老板不要难过，有我在呢！我会一直陪着你的！';
    }

    // 惊讶
    if (/哇|天哪|真的吗|不可思议|震惊/i.test(text)) {
      setEmotion(EMOTIONS.SURPRISED);
      return '哇！老板也很惊讶吗？';
    }

    // 思考
    if (/为什么|怎么|如何|怎样|什么/i.test(text)) {
      setEmotion(EMOTIONS.THINKING);
      return '嗯，这是个好问题，让我想想...';
    }

    // 困了
    if (/困|累|想睡|休息/i.test(text)) {
      setEmotion(EMOTIONS.SLEEPY);
      return '老板困了吗？要记得早点休息哦，身体最重要！';
    }

    // 开心
    if (/开心|高兴|快乐|哈哈|嘿嘿/i.test(text)) {
      setEmotion(EMOTIONS.HAPPY);
      return '看到老板这么开心，我也很开心！';
    }

    // 默认回声模式（更自然）
    const responses = [
      `我听到你说：${text}`,
      `嗯，你说的是"${text}"对吧？`,
      `明白了，"${text}"`,
      `好的，我记住了：${text}`,
    ];
    return responses[Math.floor(Math.random() * responses.length)];
  };

  const handleSend = async (text) => {
    const content = text.trim();
    if (!content || pending) return;
    await unlockAudioForPlayback();

    // 检测用户输入的情绪
    const detectedEmotion = detectEmotionFromText(content);
    if (detectedEmotion !== EMOTIONS.NORMAL) {
      setEmotion(detectedEmotion);
    }

    pushMessage('user', content);
    setInputText('');
    setPending(true);
    setStatus('正在请求 AI...');

    const aiMessageId = pushMessage('ai', '');
    let fullText = '';
    const modelInput = `[对话风格要求]\n${OPENCLAW_STYLE_GUIDE}\n\n[用户消息]\n${content}`;

    try {
      const history = [...messages, { role: 'user', text: modelInput }];
      const { text: finalText } = await sendChat({
        messages: history,
        stream: true,
        onToken: (token) => {
          fullText += token;
          updateMessage(aiMessageId, fullText);
        },
      });

      if (!fullText) fullText = finalText;
      updateMessage(aiMessageId, fullText || '');

      // 检测 AI 回复的情绪
      if (fullText) {
        const aiEmotion = detectEmotionFromText(fullText);
        if (aiEmotion !== EMOTIONS.NORMAL) {
          setEmotion(aiEmotion);
        }
        await speakText(fullText);
      }
    } catch (err) {
      // fallback 到模拟回复
      console.log('API 调用失败，使用模拟回复:', err.message);
      const mockReply = getMockReply(content);
      updateMessage(aiMessageId, mockReply);
      await speakText(mockReply);
      setStatus('使用本地回复');
      setEmotion(EMOTIONS.NORMAL);
    } finally {
      setPending(false);
    }
  };

  const startListening = (mode = 'single') => {
    startRecording(mode);
  };

  const stopListening = () => {
    stopRecording({ manual: true });
  };

  return (
    <main className="app">
      <AvatarCanvas
        ref={canvasRef}
        emotion={emotion}
        isSpeaking={isSpeaking}
      />
      <div className="controls">
        <button
          type="button"
          className="emotionBtn"
          onClick={() => {
            const emotions = Object.values(EMOTIONS);
            const currentIndex = emotions.indexOf(emotion);
            const nextIndex = (currentIndex + 1) % emotions.length;
            setEmotion(emotions[nextIndex]);
            setStatus(`切换情绪: ${emotions[nextIndex]}`);
          }}
        >
          表情切换
        </button>
        <button
          type="button"
          className={`micBtn ${listening && recognitionModeRef.current === 'single' ? 'listening' : ''}`}
          onClick={() => {
            if (!speechSupported) {
              setStatus('当前环境不支持语音识别');
              return;
            }
            if (listening && recognitionModeRef.current === 'single') {
              stopListening();
              setStatus('已停止单次录音');
              return;
            }
            if (continuousMode) setContinuousMode(false);
            startListening('single');
          }}
        >
          <span className="micIcon">🎙️</span>
          {listening && recognitionModeRef.current === 'single' ? '停止单次录音' : '单次说话'}
        </button>
        <button
          type="button"
          className={`micBtn ${continuousMode ? 'continuous' : ''}`}
          onClick={() => {
            if (!speechSupported) {
              setStatus('当前环境不支持语音识别');
              return;
            }
            if (continuousMode) {
              setContinuousMode(false);
              stopListening();
              setStatus('已停止连续聆听');
              return;
            }
            setContinuousMode(true);
            startListening('continuous');
          }}
        >
          <span className="micIcon">🎤</span>
          {continuousMode ? '停止连续聆听' : '开始连续聆听'}
        </button>
      </div>

      <div className="sttPanel">
        <div className="indicator">
          <span className={`dot ${listening ? 'active' : ''}`} />
          <span className="label">{listening ? 'Listening' : 'Idle'}</span>
        </div>
        <p className="transcript">
          {transcript || '识别后的文本会显示在这里'}
        </p>
      </div>

      <div className="chatPanel">
        <div className="chatHeader">
          <span>对话历史</span>
          <span className="hint">仅展示最近 3 条</span>
        </div>

        <div className="chatList">
          {messages.length === 0 ? (
            <p className="empty">还没有对话，先用语音或输入框试试吧</p>
          ) : (
            messages.map((msg) => (
              <div key={msg.id} className={`msg ${msg.role}`}>
                <div className="bubble">
                  {msg.role === 'ai' && pending && !msg.text ? <TypingDots /> : msg.text}
                </div>
                <div className="role">{msg.role === 'user' ? '你' : '多啦B梦'}</div>
              </div>
            ))
          )}
        </div>

        <div className="inputBar">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="也可以直接输入文字来测试对话 (中英文都行)"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleSend(inputText);
              }
            }}
          />
          <button type="button" onClick={() => handleSend(inputText)} disabled={pending}>
            {pending ? '等待回复...' : '发送'}
          </button>
        </div>
      </div>

      <p className="status">{status}</p>

    </main>
  );
}
