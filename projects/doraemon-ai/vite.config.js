import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { sendChatThroughGateway } from './bridge/openclawGateway.js';
import { transcribePcmRealtime } from './bridge/qwenAsrRealtime.js';
import { convertToPcm16kMono } from './bridge/audioUtils.js';
import fs from 'node:fs';
import path from 'node:path';

function openclawBridgePlugin() {
  const openclawEndpoint = '/api/openclaw/chat';
  const chatEndpoint = '/api/chat';
  const sttEndpoint = '/api/stt';

  return {
    name: 'openclaw-bridge',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.method !== 'POST' || (req.url !== openclawEndpoint && req.url !== chatEndpoint && req.url !== sttEndpoint)) {
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
      port: 5173,
      strictPort: true,
      https: {
        key: fs.readFileSync(path.resolve('certs/localhost-key.pem')),
        cert: fs.readFileSync(path.resolve('certs/localhost.pem')),
      }
    }
  };
});
