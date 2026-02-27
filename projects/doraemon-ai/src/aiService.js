// OpenClaw session connector: send the latest user message to the current OpenClaw session
// and return the assistant reply. Uses Electron IPC to avoid CORS issues.

const SESSION_KEY_CANDIDATES = [
  'OPENCLAW_SESSION_KEY',
  'openclaw_session_key',
  'sessionKey',
  '__OPENCLAW_SESSION_KEY',
  '__openclawSessionKey',
];

function readSessionKeyFromWindow() {
  if (typeof window === 'undefined') return undefined;

  try {
    const fromUrl = new URLSearchParams(window.location.search).get('sessionKey');
    if (fromUrl) return fromUrl.trim();
  } catch {
    // ignore
  }

  for (const key of SESSION_KEY_CANDIDATES) {
    const value = window[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }

  try {
    if (typeof localStorage !== 'undefined') {
      for (const key of SESSION_KEY_CANDIDATES) {
        const value = localStorage.getItem(key);
        if (value && value.trim()) return value.trim();
      }
    }
  } catch {
    // ignore storage errors
  }

  return undefined;
}

function resolveSessionKey() {
  const fromWindow = readSessionKeyFromWindow();
  if (fromWindow) return fromWindow;

  const envKey = (typeof import.meta !== 'undefined' && import.meta.env?.OPENCLAW_SESSION_KEY)
    || (typeof process !== 'undefined' && process?.env?.OPENCLAW_SESSION_KEY);

  if (typeof envKey === 'string') {
    return envKey.trim();
  }

  return undefined;
}

export async function sendChat({ messages, stream = false, onToken, sessionKey: explicitSessionKey } = {}) {
  if (!Array.isArray(messages) || messages.length === 0) {
    throw new Error('messages 不能为空');
  }

  const userMessages = messages.filter((m) => m.role === 'user' || m.role === 'system');
  const lastUser = userMessages[userMessages.length - 1];
  const content = lastUser?.text || lastUser?.content || '';
  if (!content) {
    throw new Error('缺少用户消息内容');
  }

  const sessionKey = explicitSessionKey || resolveSessionKey();

  // Only use Electron API (no CORS issues)
  if (typeof window === 'undefined' || !window.electronAPI?.sendChat) {
    throw new Error('缺少 Electron API，无法发送消息');
  }

  const result = await window.electronAPI.sendChat({ message: content, sessionKey });
  if (!result?.success) {
    throw new Error(result?.error || 'API 调用失败');
  }

  const reply = result.data?.reply || result.data?.message || result.data?.text || '';
  if (onToken && reply) onToken(reply);
  return { text: reply };
}
