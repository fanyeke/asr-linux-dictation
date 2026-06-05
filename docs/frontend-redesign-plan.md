# ASR Linux 前端视觉重构 — 实施规划

> 基于 Pencil 原型确认的设计方案，结合后端 API 兼容性分析，制定可执行的实施路径。

---

## 一、项目现状

### 1.1 已完成工作
| 阶段 | 状态 | 产出 |
|------|------|------|
| 需求分析 | ✅ | 用户反馈：麦克风指示器不灵敏、界面不够现代化 |
| 竞品研究 | ✅ | 分析了 10+ 款产品（Otter、WhisperMate、Voxa、PulseScribe、Velvet）|
| 视觉设计 | ✅ | Pencil 中完成 Dashboard + Dictate + Settings 三个页面原型 |
| 设计规范 | ✅ | `docs/design-system.md`（34KB，含 10+ 组件完整规范）|
| 后端探索 | ✅ | 完整 API 文档、发现 5 个风险项 |

### 1.2 设计系统摘要
- **色彩**：靛蓝紫 `#6366f1`、录音红 `#f43f5e`、成功绿 `#10b981`、深色 Sidebar `#0f172a`
- **字体**：Space Grotesk（标题）、Inter（正文）、JetBrains Mono（代码）
- **技术栈新增**：Tailwind CSS v3、Framer Motion、Lucide React、@fontsource/*

---

## 二、风险清单

### 🔴 P0 — 阻塞性风险（必须先修复）

| # | 风险 | 影响 | 修复方案 |
|---|------|------|---------|
| R1 | **认证头不一致** | `/prompts`、`/dictionary`、`/history` 使用 `Authorization: Bearer`，但后端 `verify_token` 检查 `x-token`。配置了 `SECRET_TOKEN` 后这些请求会 401 | 统一所有 fetch 调用使用 `x-token` 头 |
| R2 | **DictatePage 重复状态管理** | DictatePage 自己订阅 `onStatusUpdate`，同时父组件 App.tsx 也订阅，导致状态不同步 | 统一由 App.tsx 管理状态，通过 props 传递给 DictatePage |

### 🟡 P1 — 需处理（重构期间顺手修复）

| # | 风险 | 影响 | 修复方案 |
|---|------|------|---------|
| R3 | **提示词/字典只读** | 后端有完整的 CRUD 函数但只暴露了 GET | 本次重构暂不添加 CRUD UI，但预留接口结构 |
| R4 | **`inserting` 阶段不存在** | 后端从不广播 "inserting"，但前端类型和逻辑中有 | 从 PipelinePhase 类型和 switch case 中移除 |
| R5 | **诊断导出未连接** | `GET /diagnostics/export` 返回 ZIP，但前端只是打开日志文件夹 | Settings 页面添加 "Export Diagnostics" 按钮 |

### 🟢 P2 — 已知但本次不处理

| # | 风险 | 说明 |
|---|------|------|
| R6 | `failed_audio_path` 未使用 | 后端存储但前端类型不包含，无害缺口 |
| R7 | `language` 配置被忽略 | 后端支持但前端不读取/不展示 |
| R8 | 静音检测参数无 UI | 仅通过环境变量配置 |

---

## 三、实施阶段

### Wave 0: 基础设施 + 风险修复（1 天）

**目标**：建立设计系统基础，修复阻塞性风险，确保现有功能不被破坏。

**任务清单**：
- [ ] **W0-1** 安装依赖：`tailwindcss postcss autoprefixer framer-motion lucide-react @fontsource/space-grotesk @fontsource/inter @fontsource/jetbrains-mono clsx tailwind-merge`
- [ ] **W0-2** 配置 `tailwind.config.ts`（含设计 token：colors/fontFamily/shadow/animation）
- [ ] **W0-3** 创建 `src/electron/renderer/styles/globals.css`（字体引入 + CSS 变量 + Tailwind 指令）
- [ ] **W0-4** 修复认证头：将 SettingsPage.tsx 和 app.tsx 中 `Authorization: Bearer` 改为 `x-token`
- [ ] **W0-5** 修复重复状态：移除 DictatePage 自己的 `onStatusUpdate` 订阅，统一由 App.tsx 管理
- [ ] **W0-6** 移除 `inserting` PipelinePhase
- [ ] **W0-7** 验证：启动应用，确认所有现有功能正常（录音、停止、历史、设置保存）

**验收标准**：
- `npm run dev` 无报错
- 录音/停止流程完整运行
- Settings 页面可正常保存配置
- 所有 API 调用返回 200（非 401）

---

### Wave 1: 基础 UI 组件库（1 天）

**目标**：构建原子组件，为页面重构提供基础。

**任务清单**：
- [ ] **W1-1** `Button` — Primary / Secondary / Ghost / Danger / Icon 变体
- [ ] **W1-2** `Card` — 默认 / hoverable / clickable 变体，含阴影过渡
- [ ] **W1-3** `Input` — 含 label、placeholder、focus ring、error state、密码可见切换
- [ ] **W1-4** `Badge` — Pill 形态，Success / Error / Warning / Info / Neutral 变体
- [ ] **W1-5** `EmptyState` — 图标容器 + 标题 + 描述 + CTA 按钮
- [ ] **W1-6** 验证：在 Storybook 或临时测试页中验证所有组件渲染正确

**设计参考**：`docs/design-system.md` 第 2 章

**验收标准**：
- 每个组件所有变体可正确渲染
- Hover / Focus / Disabled 状态视觉正确
- 动画流畅（Framer Motion）

---

### Wave 2: 核心页面重构 — Dictate（1.5 天）

**目标**：重构录音页面，解决用户最关心的麦克风指示器问题。

**任务清单**：
- [ ] **W2-1** `WaveformVisualizer` — Canvas 双层波形（主层 `#6366f1` + 半透明层 `#818cf8`）
  - 14 根频谱条，高度由 `micLevel` 驱动
  - 添加 EMA 平滑：`smoothed = smoothed × 0.7 + micLevel × 0.3`
  - 静音阈值 0.02
  - 录音时活跃，静止时扁平化为细线
- [ ] **W2-2** `RecordingButton` — 环形按钮 + 脉冲光环
  - 默认：80px 圆形，灰色 `#94a3b8`
  - 录音中：红色 `#f43f5e` + 外圈脉冲扩散动画
  - 点击弹性动画：`cubic-bezier(0.34, 1.56, 0.64, 1)`
- [ ] **W2-3** `PhaseIndicator` — 新步骤条设计
  - Current：24px 容器 + 8px 实心圆 + 脉冲光环
  - Completed：16px 圆 + 白色 checkmark
  - 连接线：已完成段彩色，未完成段灰色
  - 状态文案动态显示
- [ ] **W2-4** `ResultCard` — 重构 ResultDisplay
  - ASR：蓝色左边框 `#6366f1` + JetBrains Mono 字体
  - LLM：紫色左边框 `#8b5cf6`
  - Error：红色背景 + 错误详情
- [ ] **W2-5** `DictatePage` 页面布局重构
  - Hero 区域：居中录音按钮 + 波形条
  - Phase Indicator 卡片
  - 结果展示卡片
- [ ] **W2-6** 验证：录音流程完整，波形响应灵敏，结果正确显示

**验收标准**：
- 波形条在录音时明显响应麦克风输入
- Phase Indicator 各阶段切换动画流畅
- 结果卡片正确显示 ASR/LLM 文本
- 页面无滚动条溢出（maxWidth 约束）

---

### Wave 3: 核心页面重构 — Settings + Dashboard（1.5 天）

**目标**：重构设置页面，添加 Dashboard 页面。

**任务清单**：
- [ ] **W3-1** `SettingsPage` 卡片化重构
  - API Configuration 卡片：输入框 + inline badge + Save 按钮
  - Prompt Management 卡片：EmptyState（Sparkles 图标 + CTA）
  - Dictionary Management 卡片：EmptyState（Book 图标）
  - Diagnostics 卡片：信息展示 + "Export Diagnostics" 按钮（新增）
- [ ] **W3-2** `TabSidebar` 重构
  - 72px 宽深色 Sidebar `#0f172a`
  - 激活态：靛蓝背景 `rgba(99,102,241,0.15)` + 左边框 + glow
  - Hover 效果
  - 添加 Dashboard tab
- [ ] **W3-3** `DashboardPage` 新建
  - 4 个 StatCard：活跃会话、成功率、平均时长、总字符数
  - 最近会话列表（复用 History 数据）
  - 连接状态指示器
- [ ] **W3-4** `Toast` 重构
  - 右下角固定位置
  - 滑入/滑出动画
  - 多 Toast 堆叠
  - 图标前缀（Success/Error/Info）
- [ ] **W3-5** 验证：Settings 保存正常，Dashboard 数据正确，Toast 动画流畅

**验收标准**：
- Settings 所有卡片视觉正确，空状态引导清晰
- Dashboard 统计数据正确显示
- Toast 从右下角滑入，多条堆叠间隔 8px

---

### Wave 4: History + 全局优化（1 天）

**目标**：优化历史记录页面，添加全局动效和响应式支持。

**任务清单**：
- [ ] **W4-1** `HistoryPage` 列表优化
  - 会话卡片化布局
  - 状态 Badge（成功/失败/处理中）
  - 展开/收起查看详情
  - 重试按钮（失败会话）
- [ ] **W4-2** `SessionListItem` 组件
  - 时间、时长、状态、字数统计
  - Hover 效果
- [ ] **W4-3** 全局动效
  - 页面切换：Framer Motion `AnimatePresence` 淡入淡出
  - Tab 切换：200ms 过渡
  - 内容加载：骨架屏或淡入
- [ ] **W4-4** 响应式适配
  - sm(<640px)：底部导航栏代替 Sidebar
  - md(640-1023px)：双列网格
  - lg(≥1024px)：标准布局
- [ ] **W4-5** 验证：所有页面在不同尺寸下正常显示

**验收标准**：
- History 列表美观，信息层级清晰
- 页面切换有平滑过渡
- 移动端布局不溢出

---

### Wave 5: 代码审查 + 测试（0.5 天）

**目标**：确保代码质量，无回归 bug。

**任务清单**：
- [ ] **W5-1** @oracle 代码审查：检查是否有样式硬编码、类型安全、性能问题
- [ ] **W5-2** 运行现有测试：`npm test`（vitest）是否通过
- [ ] **W5-3** 手动测试清单：
  - [ ] 启动应用，检查无报错
  - [ ] 录音 → 停止 → 查看结果
  - [ ] 切换 Tab（Dictate / History / Settings / Dashboard）
  - [ ] Settings 保存 API Key、测试连接、修改热键
  - [ ] History 查看、重试失败会话
  - [ ] Dashboard 查看统计数据
  - [ ] 检查 Toast 通知
  - [ ] 检查暗色 Sidebar 视觉
  - [ ] 检查空状态引导
- [ ] **W5-4** 性能检查：Canvas 波形在 Electron 中帧率是否稳定

---

## 四、Agent 分工

| 阶段 | 负责 Agent | 任务 |
|------|-----------|------|
| Wave 0 | @fixer | 安装依赖、配置 Tailwind、修复认证头、修复状态管理 |
| Wave 1 | @fixer | 构建 5 个基础 UI 组件 |
| Wave 2 | @fixer | Dictate 页面重构（波形、录音按钮、Phase Indicator、结果卡片）|
| Wave 3 | @fixer | Settings + Dashboard 页面重构 |
| Wave 4 | @fixer | History 页面优化 + 全局动效 + 响应式 |
| Wave 5 | @oracle | 代码审查、简化建议、YAGNI 检查 |
| 全阶段 | 我 | 协调、集成、验证截图、合并结果 |

---

## 五、文件变更计划

```
src/electron/renderer/
├── styles/
│   └── globals.css                  # 新增
├── components/
│   ├── ui/                          # 新增目录：基础组件库
│   │   ├── Button.tsx
│   │   ├── Card.tsx
│   │   ├── Input.tsx
│   │   ├── Badge.tsx
│   │   └── EmptyState.tsx
│   ├── WaveformVisualizer.tsx       # 新增
│   ├── RecordingButton.tsx          # 新增
│   ├── PhaseIndicator.tsx           # 重写
│   ├── ResultDisplay.tsx            # 重写 → ResultCard
│   ├── TabSidebar.tsx               # 重写
│   ├── Toast.tsx                    # 重写
│   ├── StatCard.tsx                 # 新增
│   └── SessionListItem.tsx          # 新增
├── pages/                           # 新增目录（从 components 迁移）
│   ├── DictatePage.tsx              # 重写
│   ├── SettingsPage.tsx             # 重写
│   ├── HistoryPage.tsx              # 重写
│   └── DashboardPage.tsx            # 新增
├── hooks/                           # 新增目录
│   └── useStatus.ts                 # 新增：统一状态管理
├── lib/                             # 新增目录
│   └── utils.ts                     # 新增：cn() 工具函数
├── app.tsx                          # 修改：引入全局样式、修复认证头
└── index.html                       # 修改：引入字体
```

---

## 六、时间估算

| 阶段 | 预计工时 | 累计 |
|------|---------|------|
| Wave 0: 基础设施 + 风险修复 | 1 天 | 1 天 |
| Wave 1: 基础组件库 | 1 天 | 2 天 |
| Wave 2: Dictate 页面 | 1.5 天 | 3.5 天 |
| Wave 3: Settings + Dashboard | 1.5 天 | 5 天 |
| Wave 4: History + 全局优化 | 1 天 | 6 天 |
| Wave 5: 审查 + 测试 | 0.5 天 | 6.5 天 |

**总计：约 6.5 个工作日**

---

## 七、关键决策记录

| 决策 | 选择 | 理由 |
|------|------|------|
| 使用 Tailwind 还是内联样式？ | Tailwind | 可维护性、设计 token 一致性、响应式支持 |
| 使用 shadcn/ui 还是手写？ | 手写 | 项目规模不大，避免 Radix UI 额外依赖 |
| 字体加载方式？ | `@fontsource/` npm 包 | Electron 离线场景，避免外部网络请求 |
| 波形实现方式？ | Canvas 2D | 性能最佳，可控性最强 |
| 动画库？ | Framer Motion | React 生态最佳，声明式 API |
| 是否添加 Dashboard？ | 是 | 用户需要统计视图，Pencil 原型已确认 |
| 是否修复后端 API 暴露？ | 否（本次）| 只修复前端认证头，后端 CRUD 暴露后续迭代 |

---

## 八、待确认事项

1. **Dashboard 数据来源**：当前后端没有聚合统计 API，Dashboard 数据需前端从 `/history` 计算。是否需要后端添加 `/stats` 端点？
2. **移动端优先级**：是否需要在第一波就支持响应式，还是可以后续迭代？
3. **暗色模式**：当前设计是浅色主内容 + 深色 Sidebar，是否需要完整的暗色模式切换？

---

*规划完成时间：2026-06-05*
*设计规范：`docs/design-system.md`*
*Pencil 原型：`pencil-shadcn.pen`（ASR Dictate / ASR Settings / ASR Dashboard）*
