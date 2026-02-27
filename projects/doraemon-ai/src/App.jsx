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
import Settings, { loadSettings } from './Settings';
import './Settings.css';

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
        const speakScale = SPEAKING_CONFIG.minMouth +
          (speakPhase + 1) / 2 * (SPEAKING_CONFIG.maxMouthOpen - SPEAKING_CONFIG.minMouth);
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

export default function App() {
  const [status, setStatus] = useState('Ready');
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [inputText, setInputText] = useState('');
  const [messages, setMessages] = useState([]);
  const [pending, setPending] = useState(false);
  const [emotion, setEmotion] = useState(DEFAULT_EMOTION);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [continuousMode, setContinuousMode] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const recognitionRef = useRef(null);
  const transcriptRef = useRef('');
  const canvasRef = useRef(null);

  useEffect(() => {
    // 注入 OpenClaw sessionKey（用于调用内部 AI 对话）
    if (typeof window !== 'undefined') {
      window.__OPENCLAW_SESSION_KEY = 'agent:main:main';
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setStatus('当前浏览器不支持语音识别');
      return undefined;
    }

    const recognition = new SpeechRecognition();
    const preferredLang = navigator.language?.toLowerCase().includes('zh') ? 'zh-CN' : 'en-US';
    recognition.lang = preferredLang;
    recognition.continuous = continuousMode; // 连续模式
    recognition.interimResults = true;

    recognition.onstart = () => {
      transcriptRef.current = '';
      setTranscript('');
      setListening(true);
      setStatus(continuousMode ? '连续聆听中...' : '正在聆听...');
    };

    recognition.onresult = (event) => {
      const results = Array.from(event.results);
      const lastResult = results[results.length - 1];
      const isFinal = lastResult?.isFinal;
      const text = results
        .map((result) => result[0]?.transcript ?? '')
        .join('')
        .trim();
      
      transcriptRef.current = text;
      setTranscript(text);

      // 连续模式下，检测到句子结束时自动发送
      if (continuousMode && isFinal && text) {
        handleSend(text);
        transcriptRef.current = '';
        setTranscript('');
      }
    };

    recognition.onerror = (event) => {
      if (event.error === 'no-speech') {
        // 忽略无语音错误，保持连续监听
        if (continuousMode && listening) {
          try {
            recognition.start();
          } catch {}
        }
        return;
      }
      setListening(false);
      setStatus(`语音识别出错：${event.error}`);
      if (continuousMode) {
        // 连续模式下出错后自动重启
        setTimeout(() => {
          if (continuousMode) {
            try {
              recognition.start();
            } catch {}
          }
        }, 1000);
      }
    };

    recognition.onend = () => {
      setListening(false);
      
      // 单次模式下才触发对话
      if (!continuousMode && transcriptRef.current) {
        setStatus('语音识别完成');
        handleSend(transcriptRef.current);
      } else if (continuousMode) {
        setStatus('连续聆听暂停');
        // 自动重启
        setTimeout(() => {
          try {
            recognition.start();
          } catch {}
        }, 100);
      }
    };

    recognitionRef.current = recognition;

    return () => {
      recognition.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [continuousMode]);

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

  const speakText = (text) => {
    if (!('speechSynthesis' in window)) {
      setStatus('当前环境不支持语音播放');
      return;
    }

    const utter = new SpeechSynthesisUtterance(text);
    const containsLatin = /[A-Za-z]/.test(text);
    utter.lang = containsLatin ? 'en-US' : 'zh-CN';
    utter.rate = 1;
    utter.onstart = () => {
      setStatus('播放 AI 回复中...');
      setIsSpeaking(true);
    };
    utter.onend = () => {
      setStatus('Done');
      setIsSpeaking(false);
    };
    utter.onerror = () => {
      setIsSpeaking(false);
    };

    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utter);
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
      const date = new Intl.DateFormat('zh-CN', {
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

    try {
      const history = [...messages, { role: 'user', text: content }];
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
        speakText(fullText);
      }
      setStatus('AI 回复完成');
    } catch (err) {
      // fallback 到模拟回复
      console.log('API 调用失败，使用模拟回复:', err.message);
      const mockReply = getMockReply(content);
      updateMessage(aiMessageId, mockReply);
      speakText(mockReply);
      setStatus('使用本地回复');
      setEmotion(EMOTIONS.NORMAL);
    } finally {
      setPending(false);
    }
  };

  const startListening = () => {
    const recognition = recognitionRef.current;
    if (!recognition) {
      setStatus('当前浏览器不支持语音识别');
      return;
    }

    try {
      recognition.start();
    } catch (err) {
      // 调用过快会抛出异常
      setStatus(`无法开始录音：${err.message}`);
    }
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
          className="speakBtn"
          onClick={() => speakText('你好老板，我是多啦B梦，语音输出正常。')}
        >
          TTS 测试
        </button>
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
          className="settingsBtn"
          onClick={() => setSettingsOpen(true)}
        >
          ⚙️ 设置
        </button>
        <button
          type="button"
          className="restartBtn"
          onClick={() => {
            if (typeof window !== 'undefined' && window.electronAPI?.restart) {
              window.electronAPI.restart();
            } else {
              setStatus('重启功能仅在 Electron 模式下可用');
            }
          }}
        >
          🔄 重启
        </button>
        <button
          type="button"
          className={`micBtn ${listening ? 'listening' : ''} ${continuousMode ? 'continuous' : ''}`}
          onClick={() => {
            if (continuousMode) {
              // 停止连续模式
              setContinuousMode(false);
              if (recognitionRef.current) {
                recognitionRef.current.stop();
              }
              setStatus('已切换到单次模式');
            } else {
              // 开始连续模式
              setContinuousMode(true);
              startListening();
            }
          }}
          disabled={listening && !continuousMode}
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
                <div className="bubble">{msg.text}</div>
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

      <Settings
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onSave={(savedSettings) => {
          setStatus('设置已保存，可以使用 AI 对话功能了');
          // 可以在这里重新初始化某些功能
        }}
      />
    </main>
  );
}
