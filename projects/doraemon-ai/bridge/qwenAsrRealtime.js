const DEFAULT_ASR_MODEL = 'qwen3-asr-flash-realtime';
const DEFAULT_SAMPLE_RATE = 16000;

function resolveApiKey(explicit) {
  return explicit || process.env.DASHSCOPE_API_KEY || process.env.QWEN_API_KEY;
}

function resolveWsUrl(explicit, model) {
  if (explicit) return explicit;
  const base = process.env.DASHSCOPE_REALTIME_URL
    || process.env.QWEN_ASR_REALTIME_URL
    || 'wss://dashscope.aliyuncs.com/api-ws/v1/realtime';
  const normalized = base.replace(/\?model=.*$/i, '');
  const safeModel = model || DEFAULT_ASR_MODEL;
  return `${normalized}?model=${encodeURIComponent(safeModel)}`;
}

function toBase64(buffer) {
  return Buffer.from(buffer).toString('base64');
}

export async function transcribePcmRealtime({
  pcmBuffer,
  apiKey,
  url,
  model = DEFAULT_ASR_MODEL,
  language = 'zh',
  sampleRate = DEFAULT_SAMPLE_RATE,
  enableServerVad = true,
  timeoutMs = 20000,
} = {}) {
  if (!pcmBuffer || pcmBuffer.length === 0) {
    throw new Error('缺少 PCM 音频数据');
  }

  const key = resolveApiKey(apiKey);
  if (!key) throw new Error('缺少 DASHSCOPE_API_KEY/QWEN_API_KEY');

  const wsUrl = resolveWsUrl(url, model);
  const ws = new WebSocket(wsUrl, {
    headers: { Authorization: `Bearer ${key}` },
  });

  let resolveFn;
  let rejectFn;
  const donePromise = new Promise((resolve, reject) => {
    resolveFn = resolve;
    rejectFn = reject;
  });

  let finished = false;
  let timeout = null;
  let finalText = '';
  let lastText = '';

  const safeFinish = () => {
    if (finished) return;
    finished = true;
    if (timeout) clearTimeout(timeout);
    try {
      ws.close();
    } catch {}
  };

  const sendEvent = (event) => {
    const payload = {
      ...event,
      event_id: `event_${Date.now()}`,
    };
    ws.send(JSON.stringify(payload));
  };

  timeout = setTimeout(() => {
    safeFinish();
    rejectFn(new Error('语音识别超时'));
  }, timeoutMs);

  ws.onopen = () => {
    const session = {
      modalities: ['text'],
      input_audio_format: 'pcm',
      sample_rate: sampleRate,
      input_audio_transcription: {
        language,
      },
    };
    if (enableServerVad) {
      session.turn_detection = { type: 'server_vad' };
    }
    sendEvent({ type: 'session.update', session });

    const chunkSize = 3200;
    for (let offset = 0; offset < pcmBuffer.length; offset += chunkSize) {
      const chunk = pcmBuffer.subarray(offset, offset + chunkSize);
      sendEvent({ type: 'input_audio_buffer.append', audio: toBase64(chunk) });
    }

    if (!enableServerVad) {
      sendEvent({ type: 'input_audio_buffer.commit' });
    }
    sendEvent({ type: 'session.finish' });
  };

  ws.onerror = (err) => {
    safeFinish();
    rejectFn(new Error(`ASR 连接错误: ${err?.message || 'unknown'}`));
  };

  ws.onmessage = (message) => {
    try {
      const event = JSON.parse(message.data);
      const eventType = event?.type;
      if (eventType === 'error') {
        const errMsg = event?.error?.message || 'ASR 服务错误';
        safeFinish();
        rejectFn(new Error(errMsg));
        return;
      }
      if (eventType === 'conversation.item.input_audio_transcription.text') {
        lastText = event?.text || lastText;
      }
      if (eventType === 'conversation.item.input_audio_transcription.completed') {
        finalText = event?.text || finalText;
        safeFinish();
        resolveFn((finalText || lastText || '').trim());
        return;
      }
      if (eventType === 'session.finished') {
        const transcript = event?.transcript || '';
        safeFinish();
        resolveFn((finalText || transcript || lastText || '').trim());
      }
    } catch (error) {
      safeFinish();
      rejectFn(error);
    }
  };

  return donePromise;
}
