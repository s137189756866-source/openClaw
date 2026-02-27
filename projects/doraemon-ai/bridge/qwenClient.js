const DEFAULT_QWEN_API_BASE = 'https://dashscope.aliyuncs.com/compatible-mode/v1';
const DEFAULT_QWEN_MODEL = 'qwen3.5-plus';

function normalizeBaseUrl(baseUrl) {
  if (!baseUrl) return DEFAULT_QWEN_API_BASE;
  return baseUrl.replace(/\/+$/, '');
}

function buildChatUrl(baseUrl) {
  const normalized = normalizeBaseUrl(baseUrl);
  if (normalized.endsWith('/chat/completions')) return normalized;
  if (normalized.endsWith('/v1')) return `${normalized}/chat/completions`;
  return `${normalized}/v1/chat/completions`;
}

function extractText(message) {
  if (!message || typeof message !== 'object') return '';
  if (typeof message.text === 'string') return message.text;
  if (typeof message.content === 'string') return message.content;
  if (Array.isArray(message.content)) {
    return message.content
      .map((part) => (typeof part?.text === 'string' ? part.text : ''))
      .join('');
  }
  return '';
}

function toChatMessages(messages) {
  if (!Array.isArray(messages)) return [];
  return messages
    .map((msg) => {
      const role = msg.role || 'user';
      const content = extractText(msg);
      return content ? { role, content } : null;
    })
    .filter(Boolean);
}

export async function sendChatThroughQwen({
  messages,
  apiKey,
  apiBase,
  model,
  temperature = 0.7,
}) {
  const key = apiKey || process.env.QWEN_API_KEY;
  if (!key) throw new Error('缺少 QWEN_API_KEY');

  const base = apiBase || process.env.QWEN_API_BASE || DEFAULT_QWEN_API_BASE;
  const url = buildChatUrl(base);
  const chatMessages = toChatMessages(messages);
  if (chatMessages.length === 0) {
    throw new Error('缺少对话消息');
  }

  const payload = {
    model: model || process.env.QWEN_MODEL || DEFAULT_QWEN_MODEL,
    messages: chatMessages,
    temperature,
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Qwen API ${res.status}: ${errText || '未知错误'}`);
  }

  const data = await res.json();
  const reply =
    data?.choices?.[0]?.message?.content ||
    data?.choices?.[0]?.text ||
    '';

  return String(reply).trim();
}
