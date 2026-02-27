import WebSocket from 'ws';

function toBase64(buffer) {
  return Buffer.from(buffer).toString('base64');
}

function safeJsonParse(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function resolveApiKey() {
  return process.env.DASHSCOPE_API_KEY || process.env.QWEN_API_KEY;
}

function resolveWsUrl(model) {
  const base = process.env.QWEN_ASR_REALTIME_URL
    || process.env.DASHSCOPE_REALTIME_URL
    || 'wss://dashscope.aliyuncs.com/api-ws/v1/realtime';
  const normalized = base.replace(/\?model=.*$/i, '');
  const safeModel = model || process.env.QWEN_ASR_MODEL || 'qwen3-asr-flash-realtime';
  return `${normalized}?model=${encodeURIComponent(safeModel)}`;
}

export function attachAsrProxy(clientWs) {
  const apiKey = resolveApiKey();
  let dashscopeWs = null;
  let started = false;
  let lastPartial = '';

  const sendClient = (payload) => {
    if (clientWs.readyState !== clientWs.OPEN) return;
    clientWs.send(JSON.stringify(payload));
  };

  const closeAll = () => {
    try {
      dashscopeWs?.close();
    } catch {}
    try {
      clientWs?.close();
    } catch {}
  };

  const startDashScope = (opts) => {
    if (started) return;
    started = true;

    if (!apiKey) {
      sendClient({ type: 'error', message: '缺少 DASHSCOPE_API_KEY/QWEN_API_KEY' });
      closeAll();
      return;
    }

    const wsUrl = resolveWsUrl(opts?.model);
    dashscopeWs = new WebSocket(wsUrl, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'OpenAI-Beta': 'realtime=v1',
      },
    });

    dashscopeWs.on('open', () => {
      const language = opts?.language || process.env.QWEN_ASR_LANGUAGE || 'zh';
      const sampleRate = opts?.sampleRate || 16000;
      const model = opts?.model || process.env.QWEN_ASR_MODEL || 'qwen3-asr-flash-realtime';

      dashscopeWs.send(JSON.stringify({
        type: 'session.update',
        session: {
          modalities: ['text'],
          input_audio_format: 'pcm',
          sample_rate: sampleRate,
          input_audio_transcription: {
            language,
            model,
          },
          // We will commit manually on client stop/silence.
          turn_detection: null,
        },
        event_id: `event_${Date.now()}`,
      }));

      sendClient({ type: 'ready' });
    });

    dashscopeWs.on('message', (message) => {
      const raw = typeof message === 'string' ? message : message.toString('utf8');
      const event = safeJsonParse(raw);
      if (!event) return;

      if (event?.type === 'error') {
        sendClient({ type: 'error', message: event?.error?.message || 'ASR 服务错误' });
        closeAll();
        return;
      }

      const t = event?.type;
      if (t === 'conversation.item.input_audio_transcription.text') {
        const text = (event?.transcript || event?.text || '').trim();
        if (text) {
          lastPartial = text;
          sendClient({ type: 'partial', text });
        }
      }

      if (t === 'conversation.item.input_audio_transcription.completed') {
        const text = (event?.transcript || event?.text || lastPartial || '').trim();
        sendClient({ type: 'final', text });
      }
    });

    dashscopeWs.on('error', (err) => {
      sendClient({ type: 'error', message: `ASR 连接错误: ${err?.message || 'unknown'}` });
      closeAll();
    });

    dashscopeWs.on('close', () => {
      // Let client decide next step.
    });
  };

  clientWs.on('message', (message) => {
    const raw = typeof message === 'string' ? message : message.toString('utf8');
    const evt = safeJsonParse(raw);
    if (!evt || typeof evt.type !== 'string') return;

    if (evt.type === 'start') {
      startDashScope(evt);
      return;
    }

    if (!dashscopeWs || dashscopeWs.readyState !== dashscopeWs.OPEN) return;

    if (evt.type === 'audio' && typeof evt.audio === 'string') {
      dashscopeWs.send(JSON.stringify({
        type: 'input_audio_buffer.append',
        audio: evt.audio,
        event_id: `event_${Date.now()}`,
      }));
      return;
    }

    if (evt.type === 'commit') {
      dashscopeWs.send(JSON.stringify({ type: 'input_audio_buffer.commit', event_id: `event_${Date.now()}` }));
      return;
    }

    if (evt.type === 'finish') {
      dashscopeWs.send(JSON.stringify({ type: 'session.finish', event_id: `event_${Date.now()}` }));
      return;
    }

    if (evt.type === 'stop') {
      closeAll();
    }
  });

  clientWs.on('close', () => {
    try {
      dashscopeWs?.close();
    } catch {}
  });

  clientWs.on('error', () => {
    try {
      dashscopeWs?.close();
    } catch {}
  });

  // If client never sends start, start lazily when first audio arrives would be ambiguous; keep explicit.
  sendClient({ type: 'hello', message: 'asr-proxy' });

  return {
    toBase64,
  };
}

