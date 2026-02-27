import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const DEFAULT_GATEWAY_PORT = Number(process.env.OPENCLAW_GATEWAY_PORT) || 18789;
const OPENCLAW_HOME = process.env.OPENCLAW_HOME || path.join(process.env.HOME || '', '.openclaw');
const OPENCLAW_CONFIG_PATH = process.env.OPENCLAW_CONFIG_PATH || path.join(OPENCLAW_HOME, 'openclaw.json');
const OPENCLAW_DEVICE_PATH = path.join(OPENCLAW_HOME, 'identity', 'device.json');
const DEFAULT_GATEWAY_WS_URL = process.env.OPENCLAW_GATEWAY_WS_URL || `ws://127.0.0.1:${DEFAULT_GATEWAY_PORT}/ws`;
const DEFAULT_GATEWAY_ORIGIN = process.env.OPENCLAW_GATEWAY_ORIGIN || `http://127.0.0.1:${DEFAULT_GATEWAY_PORT}`;
const GATEWAY_CONNECT_SCOPES = ['operator.admin', 'operator.approvals', 'operator.pairing'];
const CHAT_REPLY_TIMEOUT_MS = Number(process.env.OPENCLAW_CHAT_TIMEOUT_MS) || 45000;
const CHAT_POLL_INTERVAL_MS = 500;
const GATEWAY_CONNECT_TIMEOUT_MS = 10000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function toBase64Url(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function readJsonFile(jsonPath) {
  const raw = fs.readFileSync(jsonPath, 'utf8');
  return JSON.parse(raw);
}

function resolveGatewayToken() {
  if (process.env.OPENCLAW_GATEWAY_TOKEN) return process.env.OPENCLAW_GATEWAY_TOKEN;
  if (!fs.existsSync(OPENCLAW_CONFIG_PATH)) return '';
  const config = readJsonFile(OPENCLAW_CONFIG_PATH);
  return config?.gateway?.auth?.token || '';
}

function resolveDeviceIdentity() {
  if (!fs.existsSync(OPENCLAW_DEVICE_PATH)) return null;
  const device = readJsonFile(OPENCLAW_DEVICE_PATH);
  if (!device?.deviceId || !device?.publicKeyPem || !device?.privateKeyPem) return null;

  const publicKey = crypto.createPublicKey(device.publicKeyPem);
  const publicJwk = publicKey.export({ format: 'jwk' });
  if (!publicJwk?.x) {
    throw new Error('device public key 格式无效');
  }

  return {
    deviceId: device.deviceId,
    publicKeyX: publicJwk.x,
    privateKey: crypto.createPrivateKey(device.privateKeyPem),
  };
}

function buildConnectSignaturePayload({
  deviceId,
  clientId,
  clientMode,
  role,
  scopes,
  signedAtMs,
  token,
  nonce,
}) {
  const version = nonce ? 'v2' : 'v1';
  const parts = [
    version,
    deviceId,
    clientId,
    clientMode,
    role,
    scopes.join(','),
    String(signedAtMs),
    token || '',
  ];
  if (nonce) parts.push(nonce);
  return parts.join('|');
}

function extractMessageText(message) {
  if (!message || typeof message !== 'object') return '';
  if (typeof message.text === 'string') return message.text.trim();
  if (typeof message.content === 'string') return message.content.trim();
  if (!Array.isArray(message.content)) return '';

  return message.content
    .map((part) => {
      if (!part || typeof part !== 'object') return '';
      if (typeof part.text === 'string') return part.text;
      return '';
    })
    .join('')
    .trim();
}

function getLatestAssistantMessage(messages) {
  if (!Array.isArray(messages)) return null;
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message?.role === 'assistant') {
      const text = extractMessageText(message);
      if (!text) continue;
      return {
        text,
        signature: `${message.timestamp || message.createdAt || message.id || index}|${text}`,
      };
    }
  }
  return null;
}

class GatewayRpcClient {
  constructor({ url, origin, token, deviceIdentity, userAgent }) {
    this.url = url;
    this.origin = origin;
    this.token = token;
    this.deviceIdentity = deviceIdentity;
    this.userAgent = userAgent || 'doraemon-ai/dev';
    this.ws = null;
    this.pending = new Map();
    this.connectPromise = null;
    this.connectResolve = null;
    this.connectReject = null;
    this.connectTimer = null;
    this.connectSent = false;
    this.challengeNonce = null;
  }

  async connect() {
    if (this.connectPromise) return this.connectPromise;
    this.connectPromise = new Promise((resolve, reject) => {
      this.connectResolve = resolve;
      this.connectReject = reject;
    });
    this.connectTimer = setTimeout(() => {
      if (!this.connectReject) return;
      this.connectReject(new Error('gateway 连接超时'));
      this.clearConnectHandlers();
      this.close();
    }, GATEWAY_CONNECT_TIMEOUT_MS);

    this.ws = new WebSocket(this.url, { headers: { Origin: this.origin } });
    this.ws.addEventListener('message', (event) => this.handleMessage(event.data));
    this.ws.addEventListener('error', () => {
      if (this.connectReject) {
        this.connectReject(new Error('gateway 连接失败'));
        this.clearConnectHandlers();
      }
    });
    this.ws.addEventListener('close', (event) => {
      const closeError = new Error(event.reason || `gateway 连接关闭: ${event.code}`);
      if (this.connectReject) {
        this.connectReject(closeError);
        this.clearConnectHandlers();
      }
      for (const { reject } of this.pending.values()) {
        reject(closeError);
      }
      this.pending.clear();
    });

    return this.connectPromise;
  }

  clearConnectHandlers() {
    if (this.connectTimer) {
      clearTimeout(this.connectTimer);
      this.connectTimer = null;
    }
    this.connectResolve = null;
    this.connectReject = null;
  }

  handleMessage(raw) {
    let data;
    try {
      data = JSON.parse(String(raw));
    } catch {
      return;
    }

    if (data.type === 'event' && data.event === 'connect.challenge') {
      this.challengeNonce = data?.payload?.nonce || null;
      this.sendConnectRequest();
      return;
    }

    if (data.type === 'res') {
      const job = this.pending.get(data.id);
      if (!job) return;
      this.pending.delete(data.id);
      if (!data.ok) {
        const errorMessage = data?.error?.message || 'request failed';
        job.reject(new Error(errorMessage));
        return;
      }
      job.resolve(data.payload);
    }
  }

  sendConnectRequest() {
    if (this.connectSent) return;
    this.connectSent = true;

    const clientId = 'gateway-client';
    const clientMode = 'backend';
    const role = 'operator';
    const scopes = GATEWAY_CONNECT_SCOPES;
    const signedAt = Date.now();
    const signaturePayload = buildConnectSignaturePayload({
      deviceId: this.deviceIdentity.deviceId,
      clientId,
      clientMode,
      role,
      scopes,
      signedAtMs: signedAt,
      token: this.token,
      nonce: this.challengeNonce,
    });
    const signature = crypto.sign(
      null,
      Buffer.from(signaturePayload, 'utf8'),
      this.deviceIdentity.privateKey
    );

    const params = {
      minProtocol: 3,
      maxProtocol: 3,
      client: {
        id: clientId,
        version: 'doraemon-ai-bridge',
        platform: process.platform,
        mode: clientMode,
        instanceId: `doraemon-ai-${process.pid}`,
      },
      role,
      scopes,
      device: {
        id: this.deviceIdentity.deviceId,
        publicKey: this.deviceIdentity.publicKeyX,
        signature: toBase64Url(signature),
        signedAt,
        nonce: this.challengeNonce || undefined,
      },
      caps: [],
      auth: { token: this.token },
      userAgent: this.userAgent,
      locale: 'zh-CN',
    };

    this.request('connect', params)
      .then(() => {
        if (this.connectResolve) this.connectResolve();
        this.clearConnectHandlers();
      })
      .catch((error) => {
        if (this.connectReject) this.connectReject(error);
        this.clearConnectHandlers();
      });
  }

  request(method, params) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return Promise.reject(new Error('gateway 未连接'));
    }

    const id = crypto.randomUUID();
    const packet = { type: 'req', id, method, params };
    const promise = new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
    });
    this.ws.send(JSON.stringify(packet));
    return promise;
  }

  close() {
    if (this.ws && this.ws.readyState < WebSocket.CLOSING) {
      this.ws.close();
    }
  }
}

async function fetchChatHistory(client, sessionKey) {
  const payload = await client.request('chat.history', { sessionKey, limit: 30 });
  return Array.isArray(payload?.messages) ? payload.messages : [];
}

async function waitForAssistantReply(client, sessionKey, previousSignature) {
  const deadline = Date.now() + CHAT_REPLY_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const messages = await fetchChatHistory(client, sessionKey);
    const latest = getLatestAssistantMessage(messages);
    if (latest?.text && latest.signature !== previousSignature) {
      return latest.text;
    }
    await sleep(CHAT_POLL_INTERVAL_MS);
  }
  throw new Error('等待 OpenClaw 回复超时');
}

export async function sendChatThroughGateway({ message, sessionKey, userAgent }) {
  const token = resolveGatewayToken();
  if (!token) {
    throw new Error(`缺少 gateway token，请检查 ${OPENCLAW_CONFIG_PATH}`);
  }
  const deviceIdentity = resolveDeviceIdentity();
  if (!deviceIdentity) {
    throw new Error(`缺少 device identity，请检查 ${OPENCLAW_DEVICE_PATH}`);
  }

  const client = new GatewayRpcClient({
    url: DEFAULT_GATEWAY_WS_URL,
    origin: DEFAULT_GATEWAY_ORIGIN,
    token,
    deviceIdentity,
    userAgent,
  });

  try {
    await client.connect();
    const historyBefore = await fetchChatHistory(client, sessionKey);
    const baselineSignature = getLatestAssistantMessage(historyBefore)?.signature || '';

    await client.request('chat.send', {
      sessionKey,
      message,
      deliver: false,
      idempotencyKey: crypto.randomUUID(),
    });

    return await waitForAssistantReply(client, sessionKey, baselineSignature);
  } finally {
    client.close();
  }
}
