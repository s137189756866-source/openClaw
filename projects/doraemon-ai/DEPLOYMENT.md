# 多啦B梦 AI - 部署文档

## 打包发布指南

### 前置要求

1. **Node.js**: v18+ （推荐使用 v22）
2. **npm**: 最新版本
3. **macOS**: 用于 macOS 应用打包

### 打包步骤

#### 1. 安装依赖

```bash
cd /Users/nj_boy_dev/.openclaw/workspace/projects/doraemon-ai
npm install
```

#### 2. 构建前端资源

```bash
npm run build
```

这将在 `dist/` 目录生成优化后的前端资源。

#### 3. 打包 macOS 应用

**方式 1: 使用 npm 脚本（推荐）**

```bash
npm run dist
```

**方式 2: 直接使用 electron-builder**

```bash
npx electron-builder
```

打包完成后，应用程序将位于：

- **ARM64 (Apple Silicon)**: `dist/mac-arm64/多啦B梦 AI.app`
- **x64 (Intel)**: `dist/mac-x64/多啦B梦 AI.app`（如果配置了）
- **通用二进制**: `dist/mac/多啦B梦 AI.app`（如果配置了）

#### 4. 测试应用程序

```bash
open "dist/mac-arm64/多啦B梦 AI.app"
```

#### 5. 创建 DMG 安装文件（可选）

electron-builder 默认只生成 `.app` 文件。如需创建 `.dmg` 安装文件：

**方式 1: 使用命令行参数**

```bash
npx electron-builder --mac dmg
```

**方式 2: 手动创建 DMG**

```bash
# 创建一个临时目录
mkdir -p /tmp/doraemon-dmg

# 复制 .app 文件
cp -R "dist/mac-arm64/多啦B梦 AI.app" /tmp/doraemon-dmg/

# 创建 DMG
hdiutil create -volname "多啦B梦 AI" -srcfolder /tmp/doraemon-dmg -ov -format UDBZ "dist/多啦B梦 AI-0.0.1-arm64.dmg"

# 清理临时文件
rm -rf /tmp/doraemon-dmg
```

### 分发应用

#### 直接分发 .app 文件

1. 压缩 `.app` 文件：
   ```bash
   zip -r "多啦B梦 AI-0.0.1-arm64.zip" "dist/mac-arm64/多啦B梦 AI.app"
   ```

2. 分发 `.zip` 文件给用户

3. 用户解压后可以将 `.app` 文件移动到 `/Applications` 目录

#### 分发 .dmg 文件（推荐）

1. 使用上述步骤创建 `.dmg` 文件
2. 分发 `.dmg` 文件给用户
3. 用户打开 `.dmg` 文件并将应用拖到 `/Applications` 目录

### 应用签名（可选）

发布到公网前，建议对应用进行签名以避免 macOS 安全警告：

```bash
# 签名应用
codesign --force --deep --sign "Developer ID Application: Your Name" "dist/mac-arm64/多啦B梦 AI.app"

# 验证签名
codesign --verify --deep --strict --verbose=2 "dist/mac-arm64/多啦B梦 AI.app"
```

注意：需要 Apple Developer 账号和证书。

### 公证（Notarization，可选）

对于 macOS 10.15+，应用需要公证才能在所有 Mac 上运行：

```bash
xcrun notarytool submit "dist/多啦B梦 AI-0.0.1-arm64.dmg" --apple-id "your@email.com" --password "app-specific-password" --team-id "TEAM_ID" --wait
```

### 发布检查清单

- [ ] 应用程序打包成功
- [ ] 应用程序可以正常启动
- [ ] 测试所有核心功能
  - [ ] 虚拟形象显示正常
  - [ ] 语音识别工作正常
  - [ ] 语音合成工作正常
  - [ ] AI 对话功能正常
  - [ ] 设置界面正常
- [ ] 应用签名（可选）
- [ ] 应用公证（可选）
- [ ] 创建发布说明
- [ ] 上传到分发平台

### 常见问题

#### Q: 为什么没有生成 .dmg 文件？

A: electron-builder 默认只生成 `.app` 文件。如需 `.dmg`，请使用 `npx electron-builder --mac dmg` 或手动创建。

#### Q: 应用无法启动，提示"已损坏"？

A: 这是因为应用未签名。可以临时允许：
```bash
xattr -cr "dist/mac-arm64/多啦B梦 AI.app"
```

#### Q: 打包后应用体积太大？

A: 可以：
1. 检查 `dist/` 目录是否包含了不必要的文件
2. 使用 `electron-builder` 的压缩选项
3. 考虑使用 `electron-forge` 或 `electron-packager`

#### Q: 如何创建通用二进制（Universal Binary）？

A: 修改 `package.json` 中的 `build.mac.target`：
```json
"mac": {
  "target": [
    {
      "target": "dmg",
      "arch": ["universal"]
    }
  ]
}
```

### 更新日志

- **2026-02-27**: 初始部署文档，支持 ARM64 架构打包
