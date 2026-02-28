import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { sendChatThroughGateway } from './bridge/openclawGateway.js';
import { transcribePcmRealtime } from './bridge/qwenAsrRealtime.js';
import { synthesizeTtsRealtime } from './bridge/qwenTtsRealtime.js';
import { convertToPcm16kMono } from './bridge/audioUtils.js';
import { WebSocketServer } from 'ws';
import { attachAsrProxy } from './bridge/realtimeAsrProxy.js';
import { attachTtsProxy } from './bridge/realtimeTtsProxy.js';

function openclawBridgePlugin() {
  const openclawEndpoint = '/api/openclaw/chat';
  const chatEndpoint = '/api/chat';
  const sttEndpoint = '/api/stt';
  const ttsEndpoint = '/api/tts';
  const wsAsrEndpoint = '/ws/asr';
  const wsTtsEndpoint = '/ws/tts';

  return {
    name: 'openclaw-bridge',
    configureServer(server) {
      const wss = new WebSocketServer({ noServer: true });
      const httpServer = server.httpServer;
      if (httpServer) {
        httpServer.on('upgrade', (req, socket, head) => {
          const url = req.url ? req.url.split('?')[0] : '';
          if (url !== wsAsrEndpoint && url !== wsTtsEndpoint) return;
          wss.handleUpgrade(req, socket, head, (ws) => {
            wss.emit('connection', ws, req);
          });
        });
      }

      wss.on('connection', (ws, req) => {
        const url = req?.url ? req.url.split('?')[0] : '';
        if (url === wsAsrEndpoint) {
          attachAsrProxy(ws);
          return;
        }
        if (url === wsTtsEndpoint) {
          attachTtsProxy(ws);
          return;
        }
        try {
          ws.close();
        } catch {}
      });

      server.middlewares.use(async (req, res, next) => {
        if (
          req.method !== 'POST'
          || (req.url !== openclawEndpoint && req.url !== chatEndpoint && req.url !== sttEndpoint && req.url !== ttsEndpoint)
        ) {
          next();
          return;
        }

        try {
          const chunks = [];
          for await (const chunk of req) {
            chunks.push(chunk);
          }
          const raw = Buffer.concat(chunks).toString('utf8');
          const payload = raw ? JSON.parse(raw) : {};
          const message = typeof payload.message === 'string' ? payload.message.trim() : '';
          const text = typeof payload.text === 'string' ? payload.text.trim() : '';
          const sessionKey = typeof payload.sessionKey === 'string' && payload.sessionKey.trim()
            ? payload.sessionKey.trim()
            : 'agent:main:main';
          const messages = Array.isArray(payload.messages) ? payload.messages : [];

          if (req.url === ttsEndpoint) {
            const ttsText = text || message;
            if (!ttsText) {
              res.statusCode = 400;
              res.setHeader('Content-Type', 'application/json; charset=utf-8');
              res.end(JSON.stringify({ success: false, error: '缺少 text' }));
              return;
            }
            const model = typeof payload.model === 'string' ? payload.model.trim() : (process.env.QWEN_TTS_MODEL || undefined);
            const voice = typeof payload.voice === 'string' ? payload.voice.trim() : (process.env.QWEN_TTS_VOICE || undefined);
            const instructions = typeof payload.instructions === 'string'
              ? payload.instructions.trim()
              : (process.env.QWEN_TTS_INSTRUCTIONS || undefined);
            const url = typeof payload.url === 'string' ? payload.url.trim() : (process.env.QWEN_TTS_REALTIME_URL || undefined);

            const { audioBuffer } = await synthesizeTtsRealtime({
              text: ttsText,
              model,
              voice,
              instructions,
              url,
            });

            res.statusCode = 200;
            res.setHeader('Content-Type', 'audio/wav');
            res.setHeader('Cache-Control', 'no-store');
            res.end(audioBuffer);
            return;
          }

          if (req.url === sttEndpoint) {
            const audioBase64 = typeof payload.audioBase64 === 'string' ? payload.audioBase64 : '';
            if (!audioBase64) {
              res.statusCode = 400;
              res.setHeader('Content-Type', 'application/json; charset=utf-8');
              res.end(JSON.stringify({ success: false, error: '缺少 audioBase64' }));
              return;
            }
            const audioBuffer = Buffer.from(audioBase64, 'base64');
            const pcmBuffer = await convertToPcm16kMono(audioBuffer);
            const language = typeof payload.language === 'string' ? payload.language.trim() : (process.env.QWEN_ASR_LANGUAGE || 'zh');
            const model = typeof payload.model === 'string' ? payload.model.trim() : (process.env.QWEN_ASR_MODEL || undefined);
            const url = typeof payload.url === 'string' ? payload.url.trim() : (process.env.QWEN_ASR_REALTIME_URL || undefined);
            const transcript = await transcribePcmRealtime({
              pcmBuffer,
              language,
              model,
              url,
            });
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(JSON.stringify({ success: true, data: { text: transcript } }));
            return;
          }

          if (!message && messages.length === 0) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(JSON.stringify({ success: false, error: '缺少 message' }));
            return;
          }

          const content = message || messages[messages.length - 1]?.text || messages[messages.length - 1]?.content;
          const reply = await sendChatThroughGateway({
            message: String(content || ''),
            sessionKey,
            userAgent: 'doraemon-ai/vite-bridge',
          });

          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ success: true, data: { reply } }));
        } catch (error) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ success: false, error: error?.message || '网关调用失败' }));
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  Object.assign(process.env, env);

  return {
    plugins: [react(), openclawBridgePlugin()],
    server: {
      host: '0.0.0.0',
      port: 5174,
      strictPort: true,
      // LAN 上用 HTTP，避免移动端/内置浏览器无法跳过自签名证书导致“无法访问”。
      // 注意：HTTP 下麦克风权限/录音可能不可用（不属于安全上下文）。
      https: false,
    },
  };
});

