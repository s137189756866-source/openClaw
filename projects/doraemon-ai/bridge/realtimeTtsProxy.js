import WebSocket from 'ws';

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
  const base = process.env.QWEN_TTS_REALTIME_URL
    || process.env.DASHSCOPE_REALTIME_URL
    || 'wss://dashscope.aliyuncs.com/api-ws/v1/realtime';
  const normalized = base.replace(/\?model=.*$/i, '');
  const safeModel = model || process.env.QWEN_TTS_MODEL || 'qwen3-tts-instruct-flash-realtime';
  return `${normalized}?model=${encodeURIComponent(safeModel)}`;
}

export function attachTtsProxy(clientWs) {
  const apiKey = resolveApiKey();
  let dashscopeWs = null;
  let speaking = false;

  const sendClient = (payload) => {
    if (clientWs.readyState !== clientWs.OPEN) return;
    clientWs.send(JSON.stringify(payload));
  };

  const closeDashscope = () => {
    try {
      dashscopeWs?.close();
    } catch {}
    dashscopeWs = null;
    speaking = false;
  };

  const startDashScope = (opts) => {
    if (!apiKey) {
      sendClient({ type: 'error', message: '缺少 DASHSCOPE_API_KEY/QWEN_API_KEY' });
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
      const voice = opts?.voice || process.env.QWEN_TTS_VOICE || 'Cherry';
      const instructions = opts?.instructions || process.env.QWEN_TTS_INSTRUCTIONS || '';
      const sampleRate = opts?.sampleRate || 24000;
      const languageType = opts?.languageType || 'Chinese';

      dashscopeWs.send(JSON.stringify({
        type: 'session.update',
        session: {
          mode: 'server_commit',
          voice,
          response_format: 'pcm',
          sample_rate: sampleRate,
          language_type: languageType,
          ...(instructions ? { instructions, optimize_instructions: true } : {}),
        },
        event_id: `event_${Date.now()}`,
      }));

      sendClient({ type: 'ready', sampleRate });
    });

    dashscopeWs.on('message', (message) => {
      const raw = typeof message === 'string' ? message : message.toString('utf8');
      const event = safeJsonParse(raw);
      if (!event) return;

      if (event?.type === 'error') {
        sendClient({ type: 'error', message: event?.error?.message || 'TTS 服务错误' });
        closeDashscope();
        return;
      }

      if (event?.type === 'response.audio.delta' && event?.delta) {
        speaking = true;
        sendClient({ type: 'audio', audio: event.delta });
        return;
      }

      if (event?.type === 'response.done' || event?.type === 'session.finished') {
        sendClient({ type: 'done' });
        closeDashscope();
      }
    });

    dashscopeWs.on('error', (err) => {
      sendClient({ type: 'error', message: `TTS 连接错误: ${err?.message || 'unknown'}` });
      closeDashscope();
    });
  };

  clientWs.on('message', (message) => {
    const raw = typeof message === 'string' ? message : message.toString('utf8');
    const evt = safeJsonParse(raw);
    if (!evt || typeof evt.type !== 'string') return;

    if (evt.type === 'speak' && typeof evt.text === 'string') {
      closeDashscope();
      startDashScope(evt);
      speaking = true;
      const text = evt.text.trim();
      if (!text) return;
      // Wait until dashscope WS is open before sending (small async polling).
      const sendWhenReady = () => {
        if (!dashscopeWs) return;
        if (dashscopeWs.readyState === dashscopeWs.OPEN) {
          dashscopeWs.send(JSON.stringify({ type: 'input_text_buffer.append', text, event_id: `event_${Date.now()}` }));
          dashscopeWs.send(JSON.stringify({ type: 'session.finish', event_id: `event_${Date.now()}` }));
          return;
        }
        if (dashscopeWs.readyState === dashscopeWs.CLOSED || dashscopeWs.readyState === dashscopeWs.CLOSING) return;
        setTimeout(sendWhenReady, 10);
      };
      sendWhenReady();
      return;
    }

    if (evt.type === 'cancel') {
      if (speaking) sendClient({ type: 'done' });
      closeDashscope();
    }
  });

  clientWs.on('close', () => closeDashscope());
  clientWs.on('error', () => closeDashscope());

  sendClient({ type: 'hello', message: 'tts-proxy' });
}

