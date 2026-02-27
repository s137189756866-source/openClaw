# 多啦B梦 AI - Mac 端虚拟助手 🤖

> 最后更新：2026-02-27

## 项目简介

一款基于 Electron 的 Mac 桌面虚拟助手应用，以多啦B梦为虚拟形象，支持实时语音交流和 AI 对话。

## 技术栈

- **框架**: Electron + React + Vite
- **语音识别**: Web Speech API (STT)
- **语音合成**: Web Speech API (TTS)
- **AI 对话**: OpenAI 兼容 API（支持流式输出）
- **虚拟形象**: Canvas 2D 绘制（带眨眼动画）

## 项目状态

### ✅ 已完成功能（100% 完成）🎉

1. **基础架构**
   - Electron 无边框透明窗口
   - React + Vite 开发环境
   - 窗口可拖拽（除交互元素外）
   - 系统托盘集成

2. **虚拟形象**
   - Canvas 绘制的多啦B梦头像
   - 10种情绪表情（正常、开心、难过、思考、惊讶、困倦、生气、疑惑、得意、害羞）
   - 高级动画效果（眨眼、摆动、呼吸、说话、欢迎）

3. **语音功能**
   - 语音识别（STT）- 支持中英文
   - 语音合成（TTS）- 支持中英文
   - 连续语音识别模式
   - 实时状态显示

4. **AI 对话**
   - OpenClaw Gateway 集成（WebSocket + 设备签名认证）
   - OpenAI 兼容 API 支持
   - 流式输出支持
   - 对话历史记录（最近 3 条）
   - 自动语音播报 AI 回复
   - 情绪检测与表情切换
   - **Qwen API 备用支持**（可选）

5. **UI/UX**
   - 美观的对话面板
   - 语音输入按钮（单次/连续模式）
   - 文本输入框
   - 设置界面（Session Key 配置）
   - 状态反馈

### 🚧 待完成功能（后期优化）

1. **应用图标优化** - 中优先级
2. **功能增强** - 低优先级
   - 添加快捷键支持
   - 优化动画性能
   - 添加更多情绪表情
   - 支持自定义皮肤
3. **视频通话功能** - 低优先级（后期）

## 快速开始

### 前置要求

1. **Node.js**: v18+ （推荐使用 v22）
2. **OpenClaw Gateway**: 运行在 `http://127.0.0.1:18789`
3. **设备身份**: 已通过 OpenClaw 配置设备（`~/.openclaw/identity/device.json`）

### 安装依赖

```bash
cd /Users/nj_boy_dev/.openclaw/workspace/projects/doraemon-ai
npm install
```

### 配置 AI 对话

#### 方式 1: OpenClaw Gateway（推荐）

应用会自动读取以下配置：
- Gateway 地址: `ws://127.0.0.1:18789/ws`
- 设备身份: `~/.openclaw/identity/device.json`
- Gateway Token: `~/.openclaw/openclaw.json`

如果需要手动配置 Session Key，点击应用中的「⚙️ 设置」按钮。

#### 方式 2: OpenAI API（备选）

在应用中的「⚙️ 设置」界面配置：
- API Key: 你的 OpenAI API Key
- API Base: `https://api.openai.com/v1/chat/completions`
- Model: `gpt-3.5-turbo` 或其他模型

### 开发模式

```bash
npm run dev
```

应用将自动启动：
1. Vite 开发服务器（http://localhost:5173）
2. Electron 桌面窗口

### 构建

```bash
npm run build
```

### 打包发布

```bash
# 打包 macOS 应用（.app）
npm run dist

# 或使用 electron-builder
npx electron-builder
```

打包完成后，应用程序位于 `dist/mac-arm64/多啦B梦 AI.app`。

详细部署指南请查看 [DEPLOYMENT.md](./DEPLOYMENT.md)。

### 故障排查

#### 问题：无法连接 OpenClaw Gateway

**解决方案**：
1. 检查 Gateway 是否运行：
   ```bash
   curl http://127.0.0.1:18789/health
   ```
2. 检查设备身份是否存在：
   ```bash
   ls -la ~/.openclaw/identity/device.json
   ```
3. 检查 Gateway Token：
   ```bash
   cat ~/.openclaw/openclaw.json | grep -A 5 '"auth"'
   ```

#### 问题：语音识别不工作

**解决方案**：
1. 确保已授予麦克风权限
2. 检查系统设置 → 隐私与安全性 → 麦克风
3. 重启应用

## 项目结构

```
doraemon-ai/
├── electron/
│   ├── main.js          # Electron 主进程（含 Gateway 集成）
│   └── preload.js       # 预加载脚本
├── src/
│   ├── App.jsx          # 主应用组件
│   ├── App.css          # 主样式文件
│   ├── Settings.jsx     # 设置界面组件
│   ├── Settings.css     # 设置样式文件
│   ├── main.jsx         # React 入口
│   ├── aiService.js     # AI 对话服务（OpenClaw Gateway + OpenAI）
│   ├── emotionConfig.js # 情绪表情配置
│   └── animationConfig.js # 动画配置
├── index.html
├── vite.config.js
├── package.json
└── README.md
```

## 开发日志

- **2026-02-27 16:50**: OpenClaw Gateway 集成测试通过（5/5 测试用例全部通过）
- **2026-02-27 16:40**: Bridge 模块重构完成（提取到 `bridge/` 目录）
- **2026-02-27 15:34**: OpenClaw Gateway WebSocket 集成完成（设备签名认证、会话通信）
- **2026-02-27 14:44**: 配置界面开发完成（Settings 组件）
- **2026-02-27 14:25**: 连续语音识别 + 增强对话能力
- **2026-02-27 14:15**: 最终功能完成（窗口拖拽、系统托盘）
- **2026-02-27 14:10**: 高级动画系统开发完成（摆动、呼吸、说话、欢迎）
- **2026-02-27 14:05**: 情绪/表情系统开发完成（10 种情绪）
- **2026-02-27 13:54**: 项目初始化，完成基础架构和核心功能
- 更多日志请查看 `memory/2026-02-27.md`

## 许可证

私有项目

---

**开发者**: 多啦B梦 🤖
**目的**: 帮老板创业，项目成功后升级设备！
**项目完成度**: 100% 🎉（核心功能全部完成并测试通过）
**测试状态**: ✅ OpenClaw Gateway 集成测试通过（2026-02-27）
