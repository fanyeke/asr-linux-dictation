# Plugin System Design

ASR Linux 的插件系统用于扩展核心能力，允许社区贡献新的 ASR 引擎、
文本润色器、文本注入方式等。

## Status

📋 **Planned** — P3 (远期 v2.5+)。当前阶段不实现。

## Architecture

```
~/.asr-linux/plugins/
├── my-engine/
│   ├── __init__.py       # register() 函数
│   ├── engine.py         # 实现 BaseASREngine
│   └── manifest.json     # 元数据
└── another-plugin/
    └── ...
```

## Plugin Types

| 类型 | 接口 | 示例 |
|------|------|------|
| ASR 引擎 | `BaseASREngine` | 本地 Whisper, 云端 API, 自定义引擎 |
| 文本润色器 | `BasePolishEngine` | 不同 LLM 供应商, 本地模型 |
| 文本注入器 | `BaseInjector` | Wayland 新协议, macOS, Windows |
| 命令动作 | `BaseCommandAction` | Voice Shortcuts 的 Action 扩展 |

## Existing Foundation

`src/backend/platform_interfaces.py` 已定义抽象接口：
- `BaseAudioRecorder`
- `BaseTextInjector`
- `BaseSecretStore`

`src/backend/platform.py` 已提供工厂函数和平台检测。

## Required Work For Implementation

1. 插件发现和加载（`importlib` 扫描 `~/.asr-linux/plugins/`）
2. 插件注册表（维护已加载插件列表）
3. 插件管理 API（`GET /plugins`, `POST /plugins/{name}/enable` 等）
4. 插件沙箱和安全模型
5. Settings UI 插件管理 tab
6. 插件模板脚手架（cookiecutter）
7. 社区插件索引（GitHub Wiki）
