# ASR Linux — React 组件设计规范 v1.0

> 本规范基于 Pencil 原型与设计系统，覆盖 Dashboard、Dictate、Settings 三个页面的全部组件。目标是让前端工程师拿到即可按规范编码，保证视觉一致性。

---

## 1. 设计原则

| 维度 | 原则 |
|------|------|
| **Typography** | 标题用 Space Grotesk（有辨识度），正文用 Inter（可读性），代码/数据用 JetBrains Mono |
| **Color** | 靛蓝紫 `#6366f1` 为主色，录音红 `#f43f5e` 为动作色，成功绿 `#10b981` 为正向反馈，深色 `#0f172a` 为 Sidebar 底色 |
| **Spacing** | 4px 网格系统，所有尺寸以 4 为倍数 |
| **Shadow** | 克制使用，仅微阴影 `0 1px 2px rgba(15,23,42,0.04)`，Card hover 时可加深 |
| **Motion** | 入场动画统一为 `fadeIn + translateY`，hover 用 `transform + opacity`，状态切换用 `0.2s ease` |
| **Depth** | 通过半透明叠加、微妙边框、z-index 分层创造空间感，避免大面积纯色块 |

---

## 2. 全局设计令牌（CSS Custom Properties）

在 `src/electron/renderer/styles/design-tokens.css` 中定义：

```css
:root {
  /* === Primary Palette === */
  --color-primary: #6366f1;
  --color-primary-50: #eef2ff;
  --color-primary-100: #e0e7ff;
  --color-primary-200: #c7d2fe;
  --color-primary-300: #a5b4fc;
  --color-primary-400: #818cf8;
  --color-primary-500: #6366f1;
  --color-primary-600: #4f46e5;
  --color-primary-700: #4338ca;

  /* === Semantic Colors === */
  --color-recording: #f43f5e;
  --color-recording-light: #ffe4e6;
  --color-success: #10b981;
  --color-success-light: #d1fae5;
  --color-warning: #f59e0b;
  --color-warning-light: #fef3c7;
  --color-error: #ef4444;
  --color-error-light: #fee2e2;
  --color-info: #3b82f6;
  --color-info-light: #dbeafe;

  /* === Neutral Scale === */
  --color-sidebar: #0f172a;
  --color-sidebar-hover: rgba(255, 255, 255, 0.06);
  --color-sidebar-active: rgba(255, 255, 255, 0.1);
  --color-bg: #ffffff;
  --color-surface: #f8fafc;
  --color-surface-elevated: #ffffff;
  --color-border: #e2e8f0;
  --color-border-subtle: #f1f5f9;
  --color-text-primary: #0f172a;
  --color-text-secondary: #64748b;
  --color-text-tertiary: #94a3b8;
  --color-text-inverse: #ffffff;
  --color-text-muted: #888888;

  /* === Typography === */
  --font-display: 'Space Grotesk', sans-serif;
  --font-body: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
  --font-mono: 'JetBrains Mono', 'Fira Code', monospace;

  /* Font Sizes (4px grid, rem-based) */
  --text-xs: 0.75rem;      /* 12px */
  --text-sm: 0.8125rem;    /* 13px */
  --text-base: 0.875rem;   /* 14px */
  --text-md: 1rem;         /* 16px */
  --text-lg: 1.125rem;     /* 18px */
  --text-xl: 1.25rem;      /* 20px */
  --text-2xl: 1.5rem;      /* 24px */
  --text-3xl: 2rem;        /* 32px */

  /* Font Weights */
  --font-normal: 400;
  --font-medium: 500;
  --font-semibold: 600;
  --font-bold: 700;

  /* Line Heights */
  --leading-tight: 1.25;
  --leading-normal: 1.5;
  --leading-relaxed: 1.75;

  /* === Spacing (4px grid) === */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-8: 32px;
  --space-10: 40px;
  --space-12: 48px;

  /* === Border Radius === */
  --radius-sm: 4px;
  --radius-md: 6px;
  --radius-lg: 8px;
  --radius-xl: 12px;
  --radius-2xl: 16px;
  --radius-full: 9999px;

  /* === Shadows === */
  --shadow-micro: 0 1px 2px rgba(15, 23, 42, 0.04);
  --shadow-sm: 0 1px 3px rgba(15, 23, 42, 0.08);
  --shadow-md: 0 4px 6px -1px rgba(15, 23, 42, 0.08), 0 2px 4px -2px rgba(15, 23, 42, 0.04);
  --shadow-lg: 0 10px 15px -3px rgba(15, 23, 42, 0.08), 0 4px 6px -4px rgba(15, 23, 42, 0.04);
  --shadow-glow-primary: 0 0 20px rgba(99, 102, 241, 0.3);
  --shadow-glow-recording: 0 0 30px rgba(244, 63, 94, 0.4);

  /* === Z-Index Scale === */
  --z-base: 0;
  --z-dropdown: 100;
  --z-sticky: 200;
  --z-modal: 300;
  --z-toast: 400;
  --z-tooltip: 500;

  /* === Transitions === */
  --transition-fast: 150ms ease;
  --transition-base: 200ms ease;
  --transition-slow: 300ms ease;
  --transition-bounce: 300ms cubic-bezier(0.34, 1.56, 0.64, 1);
}
```

### 全局动画 Keyframes

```css
@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}

@keyframes fadeIn {
  from { opacity: 0; }
  to   { opacity: 1; }
}

@keyframes slideInBottom {
  from { opacity: 0; transform: translate(-50%, 20px); }
  to   { opacity: 1; transform: translate(-50%, 0); }
}

@keyframes slideOutBottom {
  from { opacity: 1; transform: translate(-50%, 0); }
  to   { opacity: 0; transform: translate(-50%, 20px); }
}

@keyframes pulse-ring {
  0%   { transform: scale(1); opacity: 0.6; }
  100% { transform: scale(1.6); opacity: 0; }
}

@keyframes pulse-dot {
  0%, 100% { opacity: 1; transform: scale(1); }
  50%      { opacity: 0.5; transform: scale(1.2); }
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}

@keyframes waveform-bar {
  0%, 100% { transform: scaleY(0.3); }
  50%      { transform: scaleY(1); }
}

@keyframes shimmer {
  0%   { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}

@keyframes glow-pulse {
  0%, 100% { box-shadow: 0 0 5px rgba(99, 102, 241, 0.2); }
  50%      { box-shadow: 0 0 20px rgba(99, 102, 241, 0.5); }
}
```

---

## 3. 组件清单

| 组件名 | 类型 | 所在页面 | 当前状态 | 优先级 |
|--------|------|----------|----------|--------|
| `Button` | 原子组件 | 全局 | 内联样式，无统一封装 | **P0** |
| `Card` | 原子组件 | Dashboard, Settings | 内联样式，无统一封装 | **P0** |
| `Input` | 原子组件 | Settings | 内联样式，无统一封装 | **P0** |
| `Badge` | 原子组件 | Dashboard, History, Settings | 内联样式，分散实现 | **P0** |
| `EmptyState` | 分子组件 | History, Settings | 简单文本占位 | **P0** |
| `TabSidebar` | 分子组件 | App Shell | 已实现，需视觉升级 | **P0** |
| `PhaseIndicator` | 分子组件 | Dictate | 已实现，需动画优化 | **P0** |
| `WaveformVisualizer` | 分子组件 | Dictate | 基本实现，需重绘为 Canvas | **P0** |
| `RecordingButton` | 分子组件 | Dictate | 普通 button，需环形设计 | **P0** |
| `Toast` | 分子组件 | 全局 | 基本实现，需动画升级 | **P0** |
| `StatCard` | 分子组件 | Dashboard | 新增组件 | **P1** |
| `SessionList` | 分子组件 | Dashboard, History | 新增组件 | **P1** |
| `SectionCard` | 分子组件 | Settings | 新增组件 | **P1** |
| `ResultCard` | 分子组件 | Dictate | 当前为 ResultDisplay | **P1** |

---

## 4. 原子组件详细规范

### 4.1 Button

**文件**: `src/electron/renderer/components/ui/Button.tsx`

#### Props 接口

```typescript
import type { ButtonHTMLAttributes, ReactNode } from "react";

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "ghost"
  | "danger"
  | "icon";

export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}
```

#### 视觉规范

| 属性 | `primary` | `secondary` | `ghost` | `danger` | `icon` |
|------|-----------|-------------|---------|----------|--------|
| **背景** | `#6366f1` | `#f1f5f9` | `transparent` | `#f43f5e` | `transparent` |
| **文字色** | `#ffffff` | `#0f172a` | `#64748b` | `#ffffff` | `#64748b` |
| **边框** | `none` | `1px solid #e2e8f0` | `none` | `none` | `none` |
| **圆角** | `6px` | `6px` | `6px` | `6px` | `8px` |
| **字号** | `14px` | `14px` | `14px` | `14px` | `inherit` |
| **字重** | `500` | `500` | `500` | `500` | `400` |
| **hover 背景** | `#4f46e5` | `#e2e8f0` | `rgba(99,102,241,0.08)` | `#e11d48` | `rgba(99,102,241,0.08)` |
| **hover 文字** | `#fff` | `#0f172a` | `#6366f1` | `#fff` | `#6366f1` |
| **active 背景** | `#4338ca` | `#cbd5e1` | `rgba(99,102,241,0.12)` | `#be123c` | `rgba(99,102,241,0.12)` |
| **disabled 背景** | `#c7d2fe` | `#f1f5f9` | `transparent` | `#fecdd3` | `transparent` |
| **disabled 文字** | `#fff` opacity 0.6 | `#94a3b8` | `#cbd5e1` | `#fff` opacity 0.6 | `#cbd5e1` |
| **disabled cursor** | `not-allowed` | `not-allowed` | `not-allowed` | `not-allowed` | `not-allowed` |

#### 尺寸规范

| Size | Padding | 图标尺寸 |
|------|---------|----------|
| `sm` | `6px 12px` | 14px |
| `md` | `10px 20px` | 16px |
| `lg` | `12px 28px` | 18px |

#### 状态与动画

- **Hover**: `transform: translateY(-1px)`, `box-shadow: var(--shadow-md)`, `transition: all var(--transition-base)`
- **Active**: `transform: translateY(0)`, `box-shadow: var(--shadow-sm)`
- **Loading**: 左侧显示 `16px` spinner（`border: 2px solid rgba(255,255,255,0.3)`, `border-top-color: #fff`, `animation: spin 0.8s linear infinite`），文字右侧偏移 `20px`，`pointer-events: none`
- **Focus**: `outline: none`, `box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.25)`（primary/ghost）或对应色值的 25% 透明度 ring
- **Icon Button**: 尺寸固定 `36px × 36px`（md），`32px × 32px`（sm），内容居中

#### 响应式

- 移动端（`< 640px`）：`size` 自动降级一级，`lg → md`, `md → sm`
- 触摸设备：hover 状态不触发，保留 active 反馈

---

### 4.2 Card

**文件**: `src/electron/renderer/components/ui/Card.tsx`

#### Props 接口

```typescript
import type { ReactNode, HTMLAttributes } from "react";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  variant?: "default" | "elevated" | "bordered" | "flat";
  padding?: "none" | "sm" | "md" | "lg";
  hoverable?: boolean;
  clickable?: boolean;
}
```

#### 视觉规范

| 属性 | `default` | `elevated` | `bordered` | `flat` |
|------|-----------|------------|------------|--------|
| **背景** | `#ffffff` | `#ffffff` | `#ffffff` | `#f8fafc` |
| **边框** | `1px solid #e2e8f0` | `none` | `1px solid #e2e8f0` | `none` |
| **圆角** | `8px` | `12px` | `8px` | `8px` |
| **阴影** | `var(--shadow-micro)` | `var(--shadow-md)` | `none` | `none` |

#### Padding 规范

| 值 | 实际 Padding |
|----|-------------|
| `none` | `0` |
| `sm` | `12px` |
| `md` | `16px` |
| `lg` | `24px` |

#### 状态与动画

- **Hoverable（非 clickable）**: `transition: box-shadow var(--transition-base), transform var(--transition-base)`，hover 时 `box-shadow: var(--shadow-lg)`, `transform: translateY(-2px)`
- **Clickable**: hover 效果同 hoverable，外加 `cursor: pointer`，active 时 `transform: translateY(0)`, `box-shadow: var(--shadow-sm)`
- **入场动画**: 可选 `animation: fadeInUp 0.4s ease backwards`，stagger 时通过 inline style 设置 `animation-delay`

#### 响应式

- 移动端：圆角保持，`elevated` 阴影减弱为 `var(--shadow-sm)`
- 小屏幕：padding 自动降级 `lg → md`, `md → sm`

---

### 4.3 Input

**文件**: `src/electron/renderer/components/ui/Input.tsx`

#### Props 接口

```typescript
import type { InputHTMLAttributes, ReactNode } from "react";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: ReactNode;
  rightElement?: ReactNode;
  fullWidth?: boolean;
}
```

#### 视觉规范

| 属性 | 默认值 | 说明 |
|------|--------|------|
| **背景** | `#ffffff` | — |
| **边框** | `1px solid #e2e8f0` | — |
| **圆角** | `6px` | — |
| **高度** | `40px` | — |
| **内边距** | `8px 12px` | 有 leftIcon 时左内边距 `40px` |
| **字号** | `14px` | — |
| **字色** | `#0f172a` | — |
| **placeholder 色** | `#94a3b8` | — |

#### 状态变体

| 状态 | 边框 | 背景 | 其他 |
|------|------|------|------|
| **Default** | `1px solid #e2e8f0` | `#ffffff` | — |
| **Hover** | `1px solid #cbd5e1` | `#ffffff` | — |
| **Focus** | `1px solid #6366f1` | `#ffffff` | `box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.15)` |
| **Error** | `1px solid #ef4444` | `#ffffff` | `box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.15)` |
| **Disabled** | `1px solid #e2e8f0` | `#f8fafc` | `color: #94a3b8`, `cursor: not-allowed` |
| **Read-only** | `1px solid #e2e8f0` | `#f8fafc` | `cursor: default` |

#### 标签与辅助文本

- **Label**: `font-size: 13px`, `font-weight: 500`, `color: #334155`, `margin-bottom: 6px`, `display: block`
- **Helper Text**: `font-size: 12px`, `color: #64748b`, `margin-top: 6px`
- **Error Text**: `font-size: 12px`, `color: #ef4444`, `margin-top: 6px`，在 input 下方显示

#### 左右元素

- **Left Icon**: 绝对定位，左 `12px`，垂直居中，`color: #94a3b8`，`width: 18px`
- **Right Element**: 绝对定位，右 `8px`，垂直居中，可为图标按钮或文本

#### 动画

- **Focus ring**: `transition: box-shadow var(--transition-fast), border-color var(--transition-fast)`
- **Error shake**（可选）: `animation: shake 0.3s ease`，keyframe:
  ```css
  @keyframes shake {
    0%, 100% { transform: translateX(0); }
    25% { transform: translateX(-4px); }
    75% { transform: translateX(4px); }
  }
  ```

#### 响应式

- 移动端：高度保持 `40px`，字号保持 `14px`（防止 iOS 缩放）

---

### 4.4 Badge

**文件**: `src/electron/renderer/components/ui/Badge.tsx`

#### Props 接口

```typescript
export type BadgeVariant =
  | "default"
  | "success"
  | "error"
  | "warning"
  | "info"
  | "recording"
  | "neutral";

export type BadgeSize = "sm" | "md";

export interface BadgeProps {
  children: string;
  variant?: BadgeVariant;
  size?: BadgeSize;
  dot?: boolean;      // 左侧脉冲圆点
  pulse?: boolean;    // 圆点是否脉冲动画
}
```

#### 视觉规范

| Variant | 背景 | 文字色 | 圆点色 |
|---------|------|--------|--------|
| `default` | `#e0e7ff` | `#4338ca` | `#6366f1` |
| `success` | `#d1fae5` | `#047857` | `#10b981` |
| `error` | `#fee2e2` | `#b91c1c` | `#ef4444` |
| `warning` | `#fef3c7` | `#b45309` | `#f59e0b` |
| `info` | `#dbeafe` | `#1d4ed8` | `#3b82f6` |
| `recording` | `#ffe4e6` | `#be123c` | `#f43f5e` |
| `neutral` | `#f1f5f9` | `#475569` | `#94a3b8` |

#### 尺寸规范

| Size | Padding | 字号 | 圆角 |
|------|---------|------|------|
| `sm` | `1px 8px` | `11px` | `10px` |
| `md` | `2px 10px` | `12px` | `10px` |

#### 脉冲圆点

- 当 `dot={true}` 时，左侧显示 `8px` 圆点，`margin-right: 6px`
- 当 `pulse={true}` 时，圆点动画: `animation: pulse-dot 1.5s ease-in-out infinite`
- 非脉冲时圆点为纯色填充

#### 响应式

- 移动端：字号不减，但在紧凑空间可隐藏文字只保留圆点

---

## 5. 分子组件详细规范

### 5.1 EmptyState

**文件**: `src/electron/renderer/components/ui/EmptyState.tsx`

#### Props 接口

```typescript
import type { ReactNode } from "react";

export interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  size?: "sm" | "md" | "lg";
}
```

#### 视觉规范

| 属性 | `sm` | `md` | `lg` |
|------|------|------|------|
| **图标尺寸** | `32px` | `48px` | `64px` |
| **图标颜色** | `#cbd5e1` | `#cbd5e1` | `#cbd5e1` |
| **标题字号** | `14px` | `16px` | `20px` |
| **标题颜色** | `#64748b` | `#64748b` | `#334155` |
| **标题字重** | `500` | `500` | `600` |
| **描述字号** | `12px` | `13px` | `14px` |
| **描述颜色** | `#94a3b8` | `#94a3b8` | `#64748b` |
| **内边距** | `24px` | `40px` | `60px` |
| **间距** | `gap: 8px` | `gap: 12px` | `gap: 16px` |

#### 布局

```
flex-direction: column
align-items: center
justify-content: center
text-align: center
```

#### 动画

- **入场**: `animation: fadeInUp 0.5s ease`
- **图标**: 可选轻微 `opacity: 0.7 → 1` 的呼吸效果

#### 默认图标

当未提供 icon 时，使用通用的 "inbox" 或 "document" SVG 图标。

---

### 5.2 TabSidebar

**文件**: `src/electron/renderer/components/TabSidebar.tsx`

#### Props 接口（保持不变，视觉升级）

```typescript
export type TabId = "dictate" | "history" | "settings";

export interface TabSidebarProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}
```

#### 视觉规范

| 属性 | 值 |
|------|-----|
| **宽度** | `80px` |
| **高度** | `100vh` |
| **背景** | `#0f172a`（纯色，无渐变） |
| **内边距** | `12px 8px` |
| **子项间距** | `4px` |

#### Tab Item 规范

| 状态 | 背景 | 文字色 | 字重 | 其他 |
|------|------|--------|------|------|
| **Default** | `transparent` | `#64748b` | `400` | — |
| **Hover** | `rgba(255,255,255,0.06)` | `#94a3b8` | `400` | — |
| **Active** | `rgba(255,255,255,0.1)` | `#ffffff` | `600` | 左侧 `3px` 宽 `#6366f1` 竖条指示器 |

- **Tab Item 尺寸**: `padding: 12px 8px`, `border-radius: 8px`, `margin: 0 4px`
- **图标**: `20px × 20px`, `stroke-width: 2`, 无 fill
- **标签**: `font-size: 11px`, `margin-top: 4px`
- **布局**: `flex-direction: column`, `align-items: center`

#### Active Glow 效果

激活态的 Tab Item 可叠加微妙 glow：
```css
box-shadow: inset 0 0 12px rgba(99, 102, 241, 0.08);
```

#### 动画

- **切换**: `transition: background var(--transition-fast), color var(--transition-fast), box-shadow var(--transition-fast)`
- **激活指示器**: 左侧竖条通过 `::before` 伪元素实现，`height: 24px`, `width: 3px`, `border-radius: 0 2px 2px 0`, `background: #6366f1`，`transition: opacity var(--transition-fast)`，非激活态 `opacity: 0`

#### 响应式

- **平板横屏（768px - 1024px）**: 宽度保持 `80px`
- **移动端（< 768px）**: 变为底部 Tab Bar，高度 `64px`，宽度 `100vw`，`flex-direction: row`，图标 `20px`，标签隐藏或 `10px`

---

### 5.3 PhaseIndicator

**文件**: `src/electron/renderer/components/PhaseIndicator.tsx`

#### Props 接口

```typescript
export type PipelinePhase =
  | "idle"
  | "recording"
  | "transcribing"
  | "polishing"
  | "completed"
  | "failed";

export interface PhaseIndicatorProps {
  phase: PipelinePhase;
}
```

#### 步骤定义

```typescript
const PHASE_META: Record<
  PipelinePhase,
  { color: string; label: string; stepLabel: string; glowColor?: string }
> = {
  idle:        { color: "#64748b", label: "Ready to record", stepLabel: "Ready" },
  recording:   { color: "#f43f5e", label: "Recording",       stepLabel: "Recording", glowColor: "rgba(244,63,94,0.3)" },
  transcribing:{ color: "#3b82f6", label: "Transcribing",    stepLabel: "ASR" },
  polishing:   { color: "#6366f1", label: "Polishing",       stepLabel: "LLM" },
  completed:   { color: "#10b981", label: "Done",            stepLabel: "Done" },
  failed:      { color: "#ef4444", label: "Failed",          stepLabel: "Failed" },
};

const PIPELINE_STEPS: PipelinePhase[] = ["recording", "transcribing", "polishing", "completed"];
```

#### 视觉规范

**整体容器**
- `padding: 16px`
- `background: #f8fafc`
- `border-radius: 12px`
- `border: 1px solid #e2e8f0`

**步骤条**
- `display: flex`, `align-items: center`, `gap: 4px`
- 每个步骤: `display: flex`, `align-items: center`, `gap: 6px`
- 步骤标签: `font-size: 12px`, `white-space: nowrap`
- 连接线: `flex: 1`, `height: 2px`, `min-width: 20px`, `border-radius: 1px`

**Dot / Spinner 规范**

| 状态 | 视觉 |
|------|------|
| **已完成（Past）** | `10px` 实心圆，对应 phase 颜色 |
| **当前非 recording** | `12px` 空心圆环，`border: 2px solid {color}`, `border-top-color: transparent`, `animation: spin 0.8s linear infinite` |
| **当前 recording** | `10px` 实心圆，录音红，带 `animation: pulse-dot 1.5s ease-in-out infinite` |
| **当前 completed** | `10px` 实心圆，成功绿，无动画 |
| **当前 failed** | `10px` 实心圆，错误红 |
| **未进行（Future）** | `10px` 实心圆，`#334155` |

**连接线颜色**
- 已完成步骤之间: 对应 phase 颜色
- 当前步骤前一根: 当前 phase 颜色
- 其余: `#334155`

**状态文本**
- `text-align: center`
- `font-size: 13px`
- `font-weight: 500`
- 颜色: 对应 phase 颜色
- `margin-top: 12px`
- Recording 时附加: `" — press hotkey to stop"`，`opacity: 0.7`

#### 动画

- **Dot pulse**: `animation: pulse-dot 1.5s ease-in-out infinite`
- **Spinner**: `animation: spin 0.8s linear infinite`
- **整体入场**: `animation: fadeInUp 0.3s ease`
- **状态切换**: 所有颜色变化 `transition: color var(--transition-base), background var(--transition-base)`

#### Idle 状态

当 `phase === "idle"` 时，步骤条隐藏，只显示：
- 居中 `8px` 灰色圆点 + "Ready to record" 文本
- `color: #64748b`, `font-size: 14px`

---

### 5.4 WaveformVisualizer

**文件**: `src/electron/renderer/components/WaveformVisualizer.tsx`

#### Props 接口

```typescript
export interface WaveformVisualizerProps {
  isRecording: boolean;
  micLevel: number;      // 0.0 - 1.0
  phase: PipelinePhase;
  barCount?: number;     // 默认 32
}
```

#### 视觉规范

**容器**
- `width: 100%`
- `height`: idle 时 `12px`，recording 时 `48px`
- `background: #0f172a`
- `border-radius: 12px`
- `overflow: hidden`
- `padding: 0 12px`
- `display: flex`, `align-items: center`, `gap: 3px`

**非录音状态（Idle / Processing）**
- 显示单条水平进度条
- `height: 6px`
- `border-radius: 3px`
- `width: {micLevel * 100}%`
- 颜色映射:
  - `completed` → `#10b981`
  - `failed` → `#ef4444`
  - 其他 → `#22c55e`
- `transition: width 0.1s ease`

**录音状态**
- 显示 `barCount`（默认 32）根垂直条形
- 每根: `flex: 1`, `border-radius: 2px`
- **背景色**: 双层效果
  - 底层（背景条）: `background: rgba(255, 255, 255, 0.06)`, `height: 100%`
  - 顶层（活动条）: `background: linear-gradient(to top, #f43f5e, #fb7185)`, 高度动态
- **高度计算**:
  ```
  baseHeight = micLevel * (0.5 + Math.random() * 0.5)
  barHeight = Math.max(0.15, Math.min(1, baseHeight)) * 100%
  ```
- **平滑过渡**: `transition: height 0.08s ease`
- **对称效果**: 中心 bar 最高，两侧递减（可选 `mirror` 模式）

#### Canvas 实现建议（性能优化）

对于高频率更新（60fps），建议使用 Canvas 而非 DOM bars：

```typescript
// 在 Canvas 上绘制双层波形
// 1. 绘制底层浅色背景条（高度 100%，低透明度）
// 2. 绘制顶层活动条（根据 micLevel 计算高度，应用 gradient）
// 3. 使用 requestAnimationFrame 驱动更新
```

Canvas 规格:
- `width: container.clientWidth`
- `height: container.clientHeight`
- `devicePixelRatio` 适配: `canvas.width = width * dpr`, `ctx.scale(dpr, dpr)`
- 条形宽度: `(width - gap * (barCount - 1)) / barCount`
- 间隙: `3px`

#### 动画

- **容器高度切换**: `transition: height 0.3s cubic-bezier(0.4, 0, 0.2, 1)`
- **条形高度**: `transition: height 0.08s ease`（DOM 模式）或 Canvas 直接重绘
- **颜色过渡**: `transition: background 0.3s ease`

#### 响应式

- 移动端：高度 recording 时 `40px`，barCount 减少为 `24`
- 条形间隙缩小为 `2px`

---

### 5.5 RecordingButton

**文件**: `src/electron/renderer/components/RecordingButton.tsx`

#### Props 接口

```typescript
export interface RecordingButtonProps {
  isRecording: boolean;
  isProcessing: boolean;
  onStart: () => void;
  onStop: () => void;
  size?: "md" | "lg";
}
```

#### 视觉规范

**外环（脉冲光环）**
- 仅在 `isRecording === true` 时显示
- 绝对定位，包裹按钮
- `border-radius: 50%`
- `border: 2px solid rgba(244, 63, 94, 0.3)`
- `animation: pulse-ring 1.5s ease-out infinite`
- 尺寸: 按钮尺寸 `+ 24px`

**按钮主体**

| 状态 | 尺寸 | 背景 | 圆角 | 阴影 |
|------|------|------|------|------|
| **Idle** | `64px × 64px`（md）/ `80px × 80px`（lg） | `#f43f5e` | `50%` | `var(--shadow-lg)` |
| **Recording** | 同上 | `#f43f5e` | `50%` | `var(--shadow-glow-recording)` |
| **Processing** | 同上 | `#64748b` | `50%` | `none` |
| **Disabled** | 同上 | `#cbd5e1` | `50%` | `none` |

**图标**
- Idle: `24px` 麦克风图标（白色，`stroke-width: 2`）
- Recording: `24px` 方形停止图标（白色）
- Processing: `24px` spinner（白色，旋转动画）

**标签文字**（按钮下方）
- `font-size: 13px`
- `color: #64748b`
- `margin-top: 12px`
- Idle: "Tap to record" / Recording: "Recording..." / Processing: "Processing..."

#### 状态与动画

- **Hover（Idle）**: `transform: scale(1.05)`, `box-shadow: var(--shadow-glow-recording)`, `transition: all var(--transition-bounce)`
- **Active**: `transform: scale(0.95)`, `transition: transform 0.1s ease`
- **Recording 脉冲**: 外环 `animation: pulse-ring 1.5s ease-out infinite`，按钮本身无缩放
- **Processing**: 图标 `animation: spin 1s linear infinite`
- **状态切换**: 按钮背景色 `transition: background var(--transition-base), box-shadow var(--transition-base)`

#### 布局

```
flex-direction: column
align-items: center
justify-content: center
```

#### 响应式

- 移动端：固定 `md` 尺寸（`64px`）
- 触摸反馈：active 时 `scale(0.95)`，无需 hover 效果

---

### 5.6 Toast

**文件**: `src/electron/renderer/components/Toast.tsx`

#### Props 接口

```typescript
export type ToastVariant = "default" | "success" | "error" | "warning" | "info";

export interface ToastProps {
  message: string | null;
  variant?: ToastVariant;
  duration?: number;    // 默认 3000ms
  onClose?: () => void;
}
```

#### 视觉规范

| 属性 | `default` | `success` | `error` | `warning` | `info` |
|------|-----------|-----------|---------|-----------|--------|
| **背景** | `#1e293b` | `#047857` | `#b91c1c` | `#b45309` | `#1d4ed8` |
| **文字色** | `#ffffff` | `#ffffff` | `#ffffff` | `#ffffff` | `#ffffff` |
| **左侧装饰条** | `#475569` | `#34d399` | `#f87171` | `#fbbf24` | `#60a5fa` |

**尺寸与布局**
- `position: fixed`, `bottom: 24px`, `left: 50%`, `transform: translateX(-50%)`
- `min-width: 280px`, `max-width: 480px`
- `padding: 12px 20px`
- `border-radius: 10px`
- `z-index: var(--z-toast)`
- `box-shadow: var(--shadow-lg)`
- `display: flex`, `align-items: center`, `gap: 10px`

**左侧图标**
- 根据 variant 显示不同图标（Check, X, AlertTriangle, Info）
- `width: 20px`, `height: 20px`

**关闭按钮**（可选）
- 右侧 `×` 图标
- `opacity: 0.7`, hover 时 `opacity: 1`

#### 动画

- **入场**: `animation: slideInBottom 0.35s cubic-bezier(0.16, 1, 0.3, 1)`
- **退场**: `animation: slideOutBottom 0.25s ease forwards`
- **持续时间**: `duration` 后自动触发退场
- **多 Toast 堆叠**: 第二个 Toast 出现时，第一个向上偏移 `56px`，`transition: transform 0.3s ease`

#### 响应式

- 移动端：`width: calc(100vw - 32px)`, `max-width: none`, `bottom: 16px`
- 圆角保持 `10px`

---

## 6. 复合组件规范

### 6.1 StatCard

**文件**: `src/electron/renderer/components/StatCard.tsx`

#### Props 接口

```typescript
export interface StatCardProps {
  title: string;
  value: string | number;
  change?: string;        // e.g. "+12%"
  changeType?: "positive" | "negative" | "neutral";
  icon: ReactNode;
  color?: "primary" | "success" | "recording" | "info";
}
```

#### 视觉规范

- 基于 `Card` 组件，`variant="elevated"`, `padding="lg"`
- `width: 100%`, 在 Dashboard 中以 `grid-template-columns: repeat(4, 1fr)` 排列
- **图标容器**: `40px × 40px`, `border-radius: 10px`, 背景色为对应颜色的 10% 透明度
- **标题**: `font-size: 13px`, `color: #64748b`, `font-weight: 500`, `margin-top: 12px`
- **数值**: `font-size: 28px`, `font-weight: 700`, `color: #0f172a`, `font-family: var(--font-display)`, `margin-top: 4px`
- **变化值**: `font-size: 12px`, `font-weight: 500`, `margin-top: 4px`
  - positive: `#10b981`
  - negative: `#ef4444`
  - neutral: `#94a3b8`

#### 动画

- **入场**: `animation: fadeInUp 0.5s ease backwards`
- **stagger**: 每个卡片延迟 `0.08s`
- **数值变化**: 可选数字滚动动画

#### 响应式

- `< 1024px`: `grid-template-columns: repeat(2, 1fr)`
- `< 640px`: `grid-template-columns: 1fr`

---

### 6.2 ResultCard

**文件**: `src/electron/renderer/components/ResultCard.tsx`（重构 ResultDisplay）

#### Props 接口

```typescript
export interface ResultCardProps {
  type: "asr" | "llm" | "error";
  label: string;
  sublabel?: string;
  content: string;
  timingMs?: number | null;
}
```

#### 视觉规范

**ASR Card**
- 顶部标签行: `display: flex`, `align-items: center`, `gap: 6px`, `margin-bottom: 8px`
- Badge: 背景 `#dbeafe`, 文字 `#1d4ed8`
- 内容区: `background: #ffffff`, `padding: 12px`, `border-radius: 6px`, `border: 1px solid #e2e8f0`, `font-family: var(--font-mono)`, `font-size: 13px`, `line-height: 1.6`, `color: #334155`

**LLM Card**
- Badge: 背景 `#e0e7ff`, 文字 `#4338ca`
- 内容区: `background: #ffffff`, `padding: 12px`, `border-radius: 6px`, `border: 1px solid #c7d2fe`, `font-size: 14px`, `line-height: 1.6`, `color: #1e293b`

**Error Card**
- 背景: `#fef2f2`
- 边框: `1px solid #fecaca`
- 圆角: `8px`
- 内边距: `12px 16px`
- 标题: `color: #b91c1c`, `font-weight: 600`, `font-size: 13px`
- 内容: `color: #991b1b`, `font-size: 13px`, `margin-top: 4px`

#### 动画

- **入场**: `animation: fadeInUp 0.3s ease`
- **内容更新**: `transition: opacity 0.2s ease`

---

### 6.3 SessionListItem

**文件**: `src/electron/renderer/components/SessionListItem.tsx`

#### Props 接口

```typescript
export interface SessionListItemProps {
  session: HistorySession;
  isExpanded: boolean;
  onToggle: () => void;
  onRetry?: () => void;
  isRetrying?: boolean;
}
```

#### 视觉规范

- 基于 `Card`，`variant="flat"`, `hoverable`
- **头部**: `padding: 12px 16px`, `display: flex`, `justify-content: space-between`, `align-items: center`
- **文本预览**: `font-size: 13px`, `color: #334155`, `font-weight: 500`, `max-width` 截断，`text-overflow: ellipsis`
- **时间戳**: `font-size: 11px`, `color: #94a3b8`, `margin-top: 2px`
- **右侧**: 时长 + Badge（`completed/success`, `failed/error`, `processing/warning`）+ 展开箭头
- **展开箭头**: `12px`, `color: #94a3b8`, `transition: transform var(--transition-base)`，展开时 `rotate(180deg)`
- **展开内容区**: `padding: 0 16px 16px`, `border-top: 1px solid #f1f5f9`, `margin-top: 12px`
- **展开动画**: `max-height` 过渡或 `animation: fadeIn 0.2s ease`

---

## 7. 页面级布局规范

### 7.1 全局布局

```
App
├── TabSidebar (80px fixed)
└── Main Content (flex: 1, overflow: auto)
    ├── Page Header
    └── Page Content (max-width: 720px, centered)
```

- **全局背景**: `#ffffff`
- **文字色**: `#0f172a`
- **字体栈**: `var(--font-body)`
- **行高**: `1.5`

### 7.2 页面内容容器

```css
.page-content {
  padding: 20px;
  max-width: 720px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
```

### 7.3 Page Header

- **标题**: `font-family: var(--font-display)`, `font-size: 22px`, `font-weight: 600`, `color: #0f172a`
- **副标题/操作区**: `display: flex`, `justify-content: space-between`, `align-items: center`

---

## 8. 响应式断点

| 断点名 | 宽度 | 关键变化 |
|--------|------|----------|
| `sm` | < 640px | 单列布局，TabSidebar → 底部导航，卡片全宽，Toast 全宽 |
| `md` | 640px - 1023px | 双列网格，Sidebar 保持左侧 |
| `lg` | 1024px - 1279px | 四列统计卡片，标准布局 |
| `xl` | ≥ 1280px | 内容区 `max-width: 800px`，更大气间距 |

---

## 9. 实现建议

### 9.1 文件结构

```
src/electron/renderer/
├── components/
│   ├── ui/                    # 原子组件（可复用）
│   │   ├── Button.tsx
│   │   ├── Card.tsx
│   │   ├── Input.tsx
│   │   ├── Badge.tsx
│   │   └── EmptyState.tsx
│   ├── TabSidebar.tsx
│   ├── PhaseIndicator.tsx
│   ├── WaveformVisualizer.tsx
│   ├── RecordingButton.tsx
│   ├── Toast.tsx
│   ├── StatCard.tsx
│   ├── ResultCard.tsx
│   ├── SessionListItem.tsx
│   ├── DictatePage.tsx
│   ├── HistoryPage.tsx
│   └── SettingsPage.tsx
├── styles/
│   ├── design-tokens.css      # CSS 变量 + Keyframes
│   ├── global.css             # 全局样式、字体导入
│   └── components.css         # 组件通用工具类（可选）
└── app.tsx
```

### 9.2 字体加载

在 `index.html` 中添加 Google Fonts：

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&family=Space+Grotesk:wght@500;600;700&display=swap" rel="stylesheet">
```

### 9.3 样式策略

- **首选**: 继续使用 inline style，但所有值引用 CSS 变量（`style={{ background: 'var(--color-primary)' }}`）
- **动画**: 全局 CSS 文件定义 `@keyframes`，组件通过 className 引用
- **避免**: 引入 Tailwind、styled-components 或 CSS Modules（保持当前零依赖策略）

### 9.4 可访问性

- 所有 Button 必须有 `type="button"`
- Icon Button 必须有 `aria-label`
- Input 必须有关联的 `label` 或 `aria-label`
- Toast 区域使用 `role="status"` 或 `role="alert"`
- 颜色对比度满足 WCAG AA 标准
- Focus ring 在所有可交互元素上可见

---

## 10. 现有组件迁移清单

| 组件 | 迁移动作 | 说明 |
|------|----------|------|
| `TabSidebar.tsx` | 视觉升级 | 应用新颜色、动画、激活态 glow |
| `PhaseIndicator.tsx` | 视觉升级 + 结构优化 | 应用新颜色值、连接器线动画、Dot pulse |
| `ResultDisplay.tsx` | 重构为 `ResultCard` | 拆分 ASR/LLM/Error 三种卡片形态 |
| `Toast.tsx` | 视觉升级 + 动画升级 | 滑入滑出、多 variant 支持 |
| `DictatePage.tsx` | 使用新组件 | 接入 RecordingButton、WaveformVisualizer |
| `HistoryPage.tsx` | 使用新组件 | 接入 Badge、Card、SessionListItem |
| `SettingsPage.tsx` | 使用新组件 | 接入 Input、Button、Badge、Card、EmptyState |
| `app.tsx` | 引入全局样式 | 引入 `design-tokens.css` 和 `global.css` |

---

*文档版本: v1.0*  
*最后更新: 2026-06-05*  
*配套原型: Pencil MCP — Dashboard / Dictate / Settings*
