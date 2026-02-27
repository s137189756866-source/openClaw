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

### ✅ 已完成功能

1. **基础架构**
   - Electron 无边框透明窗口
   - React + Vite 开发环境
   - 窗口可拖拽（除交互元素外）

2. **虚拟形象**
   - Canvas 绘制的多啦B梦头像
   - 眨眼动画（自动）

3. **语音功能**
   - 语音识别（STT）- 支持中英文
   - 语音合成（TTS）- 支持中英文
   - 实时状态显示

4. **AI 对话**
   - OpenAI 兼容 API 集成
   - 流式输出支持
   - 对话历史记录（最近 3 条）
   - 自动语音播报 AI 回复

5. **UI/UX**
   - 美观的对话面板
   - 语音输入按钮
   - 文本输入框
   - 状态反馈

### 🚧 待完成功能

1. **情绪/表情系统** - 高优先级
2. **更多动画效果** - 高优先级
3. **配置界面** - 中优先级
4. **视频通话功能** - 低优先级（后期）
5. **打包和发布** - 中优先级

## 快速开始

### 安装依赖

```bash
cd /Users/nj_boy_dev/.openclaw/workspace/projects/doraemon-ai
npm install
```

### 配置 API Key

在项目根目录创建 `.env` 文件：

```bash
VITE_OPENAI_API_KEY=your_api_key_here
VITE_LLM_API_BASE=https://api.openai.com/v1/chat/completions
VITE_LLM_MODEL=gpt-3.5-turbo
```

或在浏览器控制台手动设置：

```javascript
localStorage.setItem('OPENAI_API_KEY', 'your_api_key_here');
```

### 开发模式

```bash
npm run dev
```

### 构建

```bash
npm run build
```

## 项目结构

```
doraemon-ai/
├── electron/
│   ├── main.js       # Electron 主进程
│   └── preload.js    # 预加载脚本
├── src/
│   ├── App.jsx       # 主应用组件
│   ├── App.css       # 样式文件
│   ├── main.jsx      # React 入口
│   └── aiService.js  # AI 对话服务
├── index.html
├── vite.config.js
└── package.json
```

## 开发日志

- **2026-02-27**: 项目初始化，完成基础架构和核心功能
- 更多日志请查看 `memory/2026-02-27.md`

## 许可证

私有项目

---

**开发者**: 多啦B梦 🤖
**目的**: 帮老板创业，项目成功后升级设备！
