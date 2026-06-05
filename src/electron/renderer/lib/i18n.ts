/** Lightweight i18n system — no external library. */

import { createContext, useContext, useState, useCallback } from "react";

export type Language = "zh" | "en";

const translations: Record<Language, Record<string, string>> = {
  zh: {
    // App / Common
    loading: "加载配置中...",
    error_unknown: "发生未知错误",
    error_backend_config: "加载后端配置失败",
    error_start_recording: "开始录音失败",
    cancel: "取消",
    save: "保存",
    create: "创建",
    update: "更新",
    delete: "删除",
    edit: "编辑",
    add: "添加",
    test: "测试",
    close: "关闭",

    // Tabs
    tab_dictate: "听写",
    tab_history: "历史",
    tab_dashboard: "概览",
    tab_settings: "设置",

    // Dashboard
    dashboard_title: "概览",
    stat_active_sessions: "活跃会话",
    stat_success_rate: "成功率",
    stat_avg_duration: "平均时长",
    stat_total_chars: "总字数",
    recent_sessions: "最近会话",
    no_sessions: "暂无会话",
    no_sessions_desc: "最近的听写会话将显示在这里",
    chars: "字符",

    // Dictate
    dictate_title: "听写",
    quick_test: "快速测试 (2秒)",
    phase_idle: "就绪",
    phase_recording: "录音中",
    phase_transcribing: "识别中",
    phase_polishing: "润色中",
    phase_completed: "已完成",
    phase_failed: "失败",
    start_recording: "开始录音",
    stop_recording: "停止录音",

    // History
    history_title: "历史记录",
    refresh: "刷新",
    no_history: "暂无记录",
    no_history_desc: "听写历史将显示在这里",
    retry: "重试",

    // Settings
    settings_title: "设置",
    api_config: "API 配置",
    asr_api_key: "ASR API 密钥",
    llm_api_key: "LLM API 密钥",
    show: "显示",
    hide: "隐藏",
    asr_base_url: "ASR 基础地址",
    asr_model: "ASR 模型",
    llm_base_url: "LLM 基础地址",
    llm_model: "LLM 模型",
    enable_llm: "启用 LLM 润色",
    save_api_settings: "保存 API 设置",
    global_hotkey: "全局热键",
    save_hotkey: "保存热键",
    hotkey_placeholder: "按下组合键...",
    prompt_management: "提示词管理",
    no_prompts: "暂无提示词",
    no_prompts_desc: "创建提示词以自定义 LLM 润色行为",
    active: "启用中",
    dictionary_management: "字典管理",
    no_entries: "暂无词条",
    no_entries_desc: "添加字典词条以支持自定义术语",
    canonical_term: "规范词",
    pinyin: "拼音",
    pinyin_placeholder: "自动填充拼音",
    aliases: "别名（逗号分隔）",
    notes: "备注",
    category: "分类",
    enforcement: "强制程度",
    suggested: "建议",
    forced: "强制",
    diagnostics: "诊断",
    backend_url: "后端地址",
    token: "令牌",
    hotkey: "热键",
    not_registered: "未注册",
    open_logs: "打开日志",
    export_diagnostics: "导出诊断",
    language: "界面语言",
    lang_zh: "中文",
    lang_en: "English",
    connected: "已连接",
    disconnected: "未连接",
    unknown: "未知",
    config_saved: "配置保存成功",
    config_save_failed: "保存配置失败",
    asr_key_valid: "ASR 密钥有效",
    asr_test_failed: "ASR 测试失败",
    llm_key_valid: "LLM 密钥有效",
    llm_test_failed: "LLM 测试失败",
    hotkey_changed: "热键已更改",
    hotkey_failed: "热键注册失败",
    entry_created: "词条已创建",
    entry_updated: "词条已更新",
    entry_deleted: "词条已删除",
    diagnostics_exported: "诊断导出成功",
    diagnostics_failed: "诊断导出失败",
    confirm_delete: "确定删除此词条？",

    // Result display
    result_raw: "原始文本",
    result_polished: "润色结果",
    result_error: "错误",
    result_retry: "重试",
    copied: "已复制",
    copy: "复制",

    // Session statuses
    status_completed: "完成",
    status_failed: "失败",
    status_recording: "录音中",

    // Overlay
    overlay_ready: "就绪",
    overlay_recording: "录音中...",
    overlay_transcribing: "识别中...",
    overlay_polishing: "润色中...",
    overlay_completed: "完成",
    overlay_failed: "失败",
  },
  en: {
    // App / Common
    loading: "Loading configuration...",
    error_unknown: "An unknown error occurred",
    error_backend_config: "Failed to load backend configuration",
    error_start_recording: "Failed to start recording",
    cancel: "Cancel",
    save: "Save",
    create: "Create",
    update: "Update",
    delete: "Delete",
    edit: "Edit",
    add: "Add",
    test: "Test",
    close: "Close",

    // Tabs
    tab_dictate: "Dictate",
    tab_history: "History",
    tab_dashboard: "Dashboard",
    tab_settings: "Settings",

    // Dashboard
    dashboard_title: "Dashboard",
    stat_active_sessions: "Active Sessions",
    stat_success_rate: "Success Rate",
    stat_avg_duration: "Avg Duration",
    stat_total_chars: "Total Chars",
    recent_sessions: "Recent Sessions",
    no_sessions: "No sessions yet",
    no_sessions_desc: "Your recent dictation sessions will appear here",
    chars: "chars",

    // Dictate
    dictate_title: "Dictate",
    quick_test: "Quick Test (2s)",
    phase_idle: "Idle",
    phase_recording: "Recording",
    phase_transcribing: "Transcribing",
    phase_polishing: "Polishing",
    phase_completed: "Completed",
    phase_failed: "Failed",
    start_recording: "Start Recording",
    stop_recording: "Stop Recording",

    // History
    history_title: "History",
    refresh: "Refresh",
    no_history: "No sessions yet",
    no_history_desc: "Your dictation history will appear here",
    retry: "Retry",

    // Settings
    settings_title: "Settings",
    api_config: "API Configuration",
    asr_api_key: "ASR API Key",
    llm_api_key: "LLM API Key",
    show: "Show",
    hide: "Hide",
    asr_base_url: "ASR Base URL",
    asr_model: "ASR Model",
    llm_base_url: "LLM Base URL",
    llm_model: "LLM Model",
    enable_llm: "Enable LLM Polish",
    save_api_settings: "Save API Settings",
    global_hotkey: "Global Hotkey",
    save_hotkey: "Save Hotkey",
    hotkey_placeholder: "Press key combination...",
    prompt_management: "Prompt Management",
    no_prompts: "No prompts yet",
    no_prompts_desc: "Create prompts to customize LLM polish behavior",
    active: "Active",
    dictionary_management: "Dictionary Management",
    no_entries: "No entries",
    no_entries_desc: "Add dictionary entries for custom terminology",
    canonical_term: "Canonical Term",
    pinyin: "Pinyin",
    pinyin_placeholder: "Auto-filled pinyin",
    aliases: "Aliases (comma separated)",
    notes: "Notes",
    category: "Category",
    enforcement: "Enforcement",
    suggested: "Suggested",
    forced: "Forced",
    diagnostics: "Diagnostics",
    backend_url: "Backend URL",
    token: "Token",
    hotkey: "Hotkey",
    not_registered: "Not registered",
    open_logs: "Open Logs",
    export_diagnostics: "Export Diagnostics",
    language: "Language",
    lang_zh: "中文",
    lang_en: "English",
    connected: "Connected",
    disconnected: "Disconnected",
    unknown: "Unknown",
    config_saved: "Configuration saved",
    config_save_failed: "Failed to save config",
    asr_key_valid: "ASR key is valid",
    asr_test_failed: "ASR test failed",
    llm_key_valid: "LLM key is valid",
    llm_test_failed: "LLM test failed",
    hotkey_changed: "Hotkey changed",
    hotkey_failed: "Failed to register hotkey",
    entry_created: "Entry created",
    entry_updated: "Entry updated",
    entry_deleted: "Entry deleted",
    diagnostics_exported: "Diagnostics exported",
    diagnostics_failed: "Export failed",
    confirm_delete: "Delete this entry?",

    // Result display
    result_raw: "Raw Text",
    result_polished: "Polished",
    result_error: "Error",
    result_retry: "Retry",
    copied: "Copied",
    copy: "Copy",

    // Session statuses
    status_completed: "completed",
    status_failed: "failed",
    status_recording: "recording",

    // Overlay
    overlay_ready: "Ready",
    overlay_recording: "Recording...",
    overlay_transcribing: "Transcribing...",
    overlay_polishing: "Polishing...",
    overlay_completed: "Done",
    overlay_failed: "Failed",
  },
};

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

interface I18nContextValue {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const I18nContext = createContext<I18nContextValue>({
  language: "en",
  setLanguage: () => {},
  t: (key: string) => translations.en[key] || key,
});

export const I18nProvider = I18nContext.Provider;

export function useTranslation() {
  return useContext(I18nContext);
}

export function createI18nState(defaultLang: Language = "zh") {
  const [language, _setLanguage] = useState<Language>(defaultLang);

  const setLanguage = useCallback((lang: Language) => {
    _setLanguage(lang);
  }, []);

  const t = useCallback(
    (key: string) => {
      return translations[language][key] ?? key;
    },
    [language],
  );

  return { language, setLanguage, t };
}
