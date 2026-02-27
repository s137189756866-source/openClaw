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

### 🎨 图标状态

🔴 **图标开发中** - 临时使用占位符

快速生成图标:
- 使用 AI 生成: Midjourney/DALL-E (提示词见 [ICON_DESIGN.md](./ICON_DESIGN.md))
- 在线工具: [Canva](https://www.canva.com/) 或 [IconKitchen](https://icon.kitchen/)
- 详细指南: [ICON_DESIGN.md](./ICON_DESIGN.md) | [build/ICON_README.md](./build/ICON_README.md)

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

**症状**：应用启动后显示"无法连接 Gateway"或 AI 对话无响应

**解决方案**：
1. **检查 Gateway 是否运行**：
   ```bash
   curl http://127.0.0.1:18789/health
   ```
   如果返回 "ok"，说明 Gateway 正在运行。

2. **检查设备身份是否存在**：
   ```bash
   ls -la ~/.openclaw/identity/device.json
   ```
   如果不存在，需要先配置设备身份。

3. **检查 Gateway Token**：
   ```bash
   cat ~/.openclaw/openclaw.json | grep -A 5 '"auth"'
   ```
   确保设备有有效的 Gateway Token。

4. **重启 Gateway**：
   ```bash
   openclaw gateway restart
   ```

5. **检查网络端口**：
   ```bash
   lsof -i :18789
   ```
   确保端口 18789 没有被其他程序占用。

#### 问题：语音识别不工作

**症状**：点击语音按钮后没有反应，或识别结果不准确

**解决方案**：
1. **检查麦克风权限**：
   - 系统设置 → 隐私与安全性 → 麦克风
   - 确保"多啦B梦 AI"已被勾选

2. **测试麦克风硬件**：
   - 打开"系统设置 → 声音"
   - 在"输入"选项卡中测试麦克风是否正常

3. **重启应用**：
   - 完全退出应用后重新启动

4. **检查浏览器控制台**：
   - 按 `Cmd+Option+I` 打开开发者工具
   - 查看 Console 是否有错误信息

5. **尝试使用文本输入**：
   - 如果语音识别持续失败，可以使用文本输入框作为备用方案

#### 问题：语音合成无声音

**症状**：AI 回复显示但听不到声音

**解决方案**：
1. **检查系统音量**：
   - 确保系统音量不是静音状态

2. **检查音频输出设备**：
   - 系统设置 → 声音 → 输出
   - 确保选择了正确的音频输出设备

3. **手动触发 TTS**：
   - 在设置中重新配置 TTS 参数

4. **检查 WebSocket 连接**：
   - 打开开发者工具（`Cmd+Option+I`）
   - 查看 Network 标签页的 WebSocket 连接状态

#### 问题：应用无法启动

**症状**：双击 .app 文件后无反应

**解决方案**：
1. **检查 macOS 安全限制**：
   ```bash
   xattr -cr "dist/mac-arm64/多啦B梦 AI.app"
   ```

2. **从终端启动**（查看错误信息）：
   ```bash
   open "dist/mac-arm64/多啦B梦 AI.app"
   ```

3. **检查系统兼容性**：
   - 确保 macOS 版本 ≥ 11.0（Big Sur）

4. **重新安装依赖**：
   ```bash
   cd /Users/nj_boy_dev/.openclaw/workspace/projects/doraemon-ai
   rm -rf node_modules
   npm install
   npm run dist
   ```

#### 问题：AI 回复速度慢

**症状**：从说话到听到 AI 回复延迟很高

**解决方案**：
1. **检查网络连接**：
   - 确保网络稳定，延迟低

2. **检查 Gateway 状态**：
   ```bash
   openclaw gateway status
   ```

3. **优化模型配置**：
   - 在设置中切换到更快的模型（如 `gpt-3.5-turbo`）

4. **检查 TTS 服务**：
   - 如果使用远程 TTS 服务，可能是网络延迟导致

#### 问题：虚拟形象不显示

**症状**：窗口空白或看不到多啦B梦

**解决方案**：
1. **检查浏览器控制台**：
   - 按 `Cmd+Option+I` 打开开发者工具
   - 查看 Console 是否有 Canvas 相关错误

2. **重启应用**：
   - 完全退出后重新启动

3. **检查透明窗口支持**：
   - 确保系统支持透明窗口（macOS 原生支持）

### 调试技巧

#### 启用详细日志

打开开发者工具（`Cmd+Option+I`），查看 Console 中的详细日志：

- `STT:` - 语音识别相关
- `TTS:` - 语音合成相关
- `AI:` - AI 对话相关
- `Gateway:` - Gateway 通信相关

#### 清除配置

如果配置导致问题，可以在设置中点击"清空配置"，然后重新配置。

#### 重置应用状态

```bash
# 删除本地存储
rm -rf ~/Library/Application\ Support/多啦B梦\ AI/

# 重新启动应用
open "dist/mac-arm64/多啦B梦 AI.app"
```

### 错误代码说明

| 错误代码 | 说明 | 解决方案 |
|---------|------|---------|
| `GATEWAY_CONNECTION_FAILED` | 无法连接到 Gateway | 检查 Gateway 是否运行 |
| `DEVICE_NOT_FOUND` | 设备身份不存在 | 配置设备身份 |
| `AUTH_FAILED` | 认证失败 | 检查 Gateway Token |
| `STT_NOT_SUPPORTED` | 浏览器不支持语音识别 | 使用 Chrome/Edge |
| `TTS_ERROR` | 语音合成失败 | 检查网络或切换 TTS 服务 |
| `AI_RATE_LIMIT` | API 调用频率限制 | 稍后重试 |

### 获取帮助

如果以上方法都无法解决问题，请：
1. 记录错误信息（截图或复制日志）
2. 记录复现步骤
3. 联系开发者或提交 Issue

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
