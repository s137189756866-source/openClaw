const DEFAULT_TTS_MODEL = 'qwen3-tts-instruct-flash-realtime';
const DEFAULT_TTS_VOICE = 'Cherry';
const DEFAULT_SAMPLE_RATE = 24000;

function resolveApiKey(explicit) {
  return explicit || process.env.DASHSCOPE_API_KEY || process.env.QWEN_API_KEY;
}

function resolveWsUrl(explicit, model) {
  if (explicit) return explicit;
  const base = process.env.DASHSCOPE_REALTIME_URL
    || process.env.QWEN_TTS_REALTIME_URL
    || 'wss://dashscope.aliyuncs.com/api-ws/v1/realtime';
  const normalized = base.replace(/\?model=.*$/i, '');
  const safeModel = model || DEFAULT_TTS_MODEL;
  return `${normalized}?model=${encodeURIComponent(safeModel)}`;
}

function pcmToWav(pcmBuffer, {
  sampleRate = DEFAULT_SAMPLE_RATE,
  numChannels = 1,
  bitsPerSample = 16,
} = {}) {
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);
  const wavHeader = Buffer.alloc(44);

  wavHeader.write('RIFF', 0);
  wavHeader.writeUInt32LE(36 + pcmBuffer.length, 4);
  wavHeader.write('WAVE', 8);
  wavHeader.write('fmt ', 12);
  wavHeader.writeUInt32LE(16, 16);
  wavHeader.writeUInt16LE(1, 20);
  wavHeader.writeUInt16LE(numChannels, 22);
  wavHeader.writeUInt32LE(sampleRate, 24);
  wavHeader.writeUInt32LE(byteRate, 28);
  wavHeader.writeUInt16LE(blockAlign, 32);
  wavHeader.writeUInt16LE(bitsPerSample, 34);
  wavHeader.write('data', 36);
  wavHeader.writeUInt32LE(pcmBuffer.length, 40);

  return Buffer.concat([wavHeader, pcmBuffer]);
}

export async function synthesizeTtsRealtime({
  text,
  apiKey,
  url,
  model = DEFAULT_TTS_MODEL,
  voice = DEFAULT_TTS_VOICE,
  instructions,
  languageType = 'Chinese',
  sampleRate = DEFAULT_SAMPLE_RATE,
  timeoutMs = 20000,
  mode = 'server_commit',
} = {}) {
  const content = typeof text === 'string' ? text.trim() : '';
  if (!content) throw new Error('缺少 TTS 文本');

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

  const audioChunks = [];
  let finished = false;
  let timeout = null;

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
    rejectFn(new Error('TTS 请求超时'));
  }, timeoutMs);

  ws.onopen = () => {
    const session = {
      mode,
      voice,
      response_format: 'pcm',
      sample_rate: sampleRate,
      language_type: languageType,
    };
    if (instructions) {
      session.instructions = instructions;
      session.optimize_instructions = true;
    }
    sendEvent({ type: 'session.update', session });
    sendEvent({ type: 'input_text_buffer.append', text: content });
    sendEvent({ type: 'session.finish' });
  };

  ws.onerror = (err) => {
    safeFinish();
    rejectFn(new Error(`TTS 连接错误: ${err?.message || 'unknown'}`));
  };

  ws.onmessage = (message) => {
    try {
      const event = JSON.parse(message.data);
      const eventType = event?.type;
      if (eventType === 'error') {
        const errMsg = event?.error?.message || 'TTS 服务错误';
        safeFinish();
        rejectFn(new Error(errMsg));
        return;
      }
      if (eventType === 'response.audio.delta' && event?.delta) {
        audioChunks.push(Buffer.from(event.delta, 'base64'));
      }
      if (eventType === 'response.done' || eventType === 'session.finished') {
        const pcm = Buffer.concat(audioChunks);
        const wav = pcmToWav(pcm, { sampleRate });
        safeFinish();
        resolveFn({ audioBuffer: wav, format: 'wav', sampleRate });
      }
    } catch (error) {
      safeFinish();
      rejectFn(error);
    }
  };

  return donePromise;
}
