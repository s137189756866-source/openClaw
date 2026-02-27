import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { sendChatThroughGateway } from './bridge/openclawGateway.js';
import { sendChatThroughQwen } from './bridge/qwenClient.js';
import fs from 'node:fs';
import path from 'node:path';

function openclawBridgePlugin() {
  const openclawEndpoint = '/api/openclaw/chat';
  const chatEndpoint = '/api/chat';

  return {
    name: 'openclaw-bridge',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.method !== 'POST' || (req.url !== openclawEndpoint && req.url !== chatEndpoint)) {
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
          const sessionKey = typeof payload.sessionKey === 'string' && payload.sessionKey.trim()
            ? payload.sessionKey.trim()
            : 'agent:main:main';
          const messages = Array.isArray(payload.messages) ? payload.messages : [];

          if (!message && messages.length === 0) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(JSON.stringify({ success: false, error: '缺少 message' }));
            return;
          }

          let reply = '';
          const hasQwen = !!(process.env.QWEN_API_KEY);
          if (req.url === chatEndpoint && hasQwen) {
            const merged = messages.length > 0
              ? messages
              : [{ role: 'user', content: message }];
            reply = await sendChatThroughQwen({ messages: merged });
          } else {
            const content = message || messages[messages.length - 1]?.text || messages[messages.length - 1]?.content;
            reply = await sendChatThroughGateway({
              message: String(content || ''),
              sessionKey,
              userAgent: 'doraemon-ai/vite-bridge',
            });
          }

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

export default defineConfig({
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
});
