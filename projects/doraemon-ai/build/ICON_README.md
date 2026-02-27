# 应用图标

## 当前状态

🔴 **图标开发中** - 当前使用占位符

## 快速开始

### 选项 1: 使用 AI 生成（推荐）

使用以下提示词在 Midjourney 或 DALL-E 中生成:

```
Doraemon mascot app icon, flat design, blue and white,
minimal, tech elements, 1024x1024, transparent background,
modern, professional, cute
```

然后:
1. 下载生成的 PNG 图片
2. 转换为 .icns: https://cloudconvert.com/png-to-icns
3. 替换 `build/icon.png` 和 `build/icon.icns`

### 选项 2: 使用在线工具

- **Canva**: https://www.canva.com/ (搜索 "app icon template")
- **IconKitchen**: https://icon.kitchen/ (拖拽 SVG 自动生成)
- **AppIconGenerator**: https://appicon.co/

### 选项 3: 找设计师

如果预算允许:
- **Fiverr**: $5-50
- **站酷**: 中国设计师社区
- **99designs**: 专业设计平台

## 技术规格

- 尺寸: 1024x1024 像素
- 格式: PNG (透明背景)
- 主色: #00A0DE (多啦B梦蓝)
- 风格: 扁平化、现代、科技感

详细设计指南请查看: [ICON_DESIGN.md](../ICON_DESIGN.md)

## 文件说明

- `icon-template.svg` - SVG 模板（可用于在线工具）
- `icon.png` - 临时占位符（需要替换）
- `icon.icns` - macOS 图标（需要替换）

## 生成 .icns (macOS)

```bash
# 1. 准备 1024x1024 的 PNG 文件
# 2. 创建 iconset
mkdir icon.iconset

# 3. 生成所有尺寸
sips -z 16 16     icon.png --out icon.iconset/icon_16x16.png
sips -z 32 32     icon.png --out icon.iconset/icon_16x16@2x.png
sips -z 32 32     icon.png --out icon.iconset/icon_32x32.png
sips -z 64 64     icon.png --out icon.iconset/icon_32x32@2x.png
sips -z 128 128   icon.png --out icon.iconset/icon_128x128.png
sips -z 256 256   icon.png --out icon.iconset/icon_128x128@2x.png
sips -z 256 256   icon.png --out icon.iconset/icon_256x256.png
sips -z 512 512   icon.png --out icon.iconset/icon_256x256@2x.png
sips -z 512 512   icon.png --out icon.iconset/icon_512x512.png
sips -z 1024 1024 icon.png --out icon.iconset/icon_512x512@2x.png

# 4. 生成 .icns
iconutil -c icns icon.iconset

# 5. 清理
rm -rf icon.iconset

# 6. 移动到 build 目录
mv icon.icns build/
```

## 测试图标

```bash
# 重新打包应用
npm run dist

# 测试应用
open "dist/mac-arm64/多啦B梦 AI.app"

# 查看图标（在 Finder 中应该显示新图标）
```

---

**提示**: 图标是用户对应用的第一印象，建议投入足够时间设计高质量图标。
