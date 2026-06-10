import { useCallback, useEffect, useRef, useState } from "react";
import { Sparkles, Plus, Pencil, Trash2, X, Check } from "lucide-react";
import type { BackendConfig, Prompt } from "../../settings/types.js";
import { Card } from "../ui/Card.js";
import { Input } from "../ui/Input.js";
import { Button } from "../ui/Button.js";
import { Badge } from "../ui/Badge.js";
import { EmptyState } from "../ui/EmptyState.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function readErrorDetail(response: Response): Promise<string> {
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    try {
      const body = (await response.json()) as { detail?: unknown };
      if (typeof body.detail === "string" && body.detail) return body.detail;
    } catch (err) {
      console.error("Failed to read error detail:", err);
      // fall through
    }
  }
  return response.text().catch(() => "");
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface PromptManagerProps {
  backendConfig: BackendConfig | null;
  onToast: (msg: string, durationMs?: number) => void;
  t: (key: string) => string;
}

export function PromptManager({
  backendConfig,
  onToast,
  t,
}: PromptManagerProps): JSX.Element {
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({ name: "", template: "" });
  const loadedRef = useRef(false);

  // Load prompts
  useEffect(() => {
    if (!backendConfig || loadedRef.current) return;
    const bc = backendConfig;
    let cancelled = false;
    async function load(): Promise<void> {
      try {
        const res = await fetch(`${bc!.url}/prompts`, {
          headers: { "x-token": bc!.token, "Content-Type": "application/json" },
        });
        if (!cancelled && res.ok) {
          setPrompts(await res.json());
          loadedRef.current = true;
        }
      } catch (err) {
        console.error("Failed to load prompts:", err);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [backendConfig]);

  const resetForm = useCallback(() => {
    setForm({ name: "", template: "" });
    setEditingId(null);
    setFormOpen(false);
  }, []);

  const openEditForm = useCallback((p: Prompt) => {
    setForm({ name: p.name, template: p.template });
    setEditingId(p.id);
    setFormOpen(true);
  }, []);

  const openCreateForm = useCallback(() => {
    resetForm();
    setFormOpen(true);
  }, [resetForm]);

  const handleSubmit = useCallback(async () => {
    if (!backendConfig) return;
    const payload = {
      name: form.name.trim(),
      template: form.template.trim(),
    };
    if (!payload.name) {
      onToast(`${t("prompt_name")} is required`, 3000);
      return;
    }
    if (!payload.template) {
      onToast(`${t("prompt_template")} is required`, 3000);
      return;
    }
    try {
      const url = editingId
        ? `${backendConfig.url}/prompts/${editingId}`
        : `${backendConfig.url}/prompts`;
      const method = editingId ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          "x-token": backendConfig.token,
        },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        onToast(editingId ? t("prompt_updated") : t("prompt_created"), 3000);
        resetForm();
        // Refresh list
        const listRes = await fetch(`${backendConfig.url}/prompts`, {
          headers: { "x-token": backendConfig.token },
        });
        if (listRes.ok) setPrompts(await listRes.json());
      } else {
        const body = await readErrorDetail(res);
        onToast(`Failed: ${res.status} ${body}`, 5000);
      }
    } catch (err) {
      console.error("Failed to save prompt:", err);
      onToast(
        `Failed: ${err instanceof Error ? err.message : "network error"}`,
        5000,
      );
    }
  }, [backendConfig, form, editingId, onToast, resetForm, t]);

  const handleDelete = useCallback(
    async (promptId: number) => {
      if (!backendConfig) return;
      if (!window.confirm(t("confirm_delete_prompt"))) return;
      try {
        const res = await fetch(
          `${backendConfig.url}/prompts/${promptId}`,
          {
            method: "DELETE",
            headers: { "x-token": backendConfig.token },
          },
        );
        if (res.ok) {
          onToast(t("prompt_deleted"), 3000);
          setPrompts((prev) => prev.filter((p) => p.id !== promptId));
        } else {
          const body = await readErrorDetail(res);
          onToast(`Delete failed: ${res.status} ${body}`, 5000);
        }
      } catch (err) {
        console.error("Failed to delete prompt:", err);
        onToast(
          `Delete failed: ${err instanceof Error ? err.message : "network error"}`,
          5000,
        );
      }
    },
    [backendConfig, onToast, t],
  );

  const handleActivate = useCallback(
    async (promptId: number) => {
      if (!backendConfig) return;
      try {
        const res = await fetch(
          `${backendConfig.url}/prompts/${promptId}/activate`,
          {
            method: "POST",
            headers: { "x-token": backendConfig.token },
          },
        );
        if (res.ok) {
          onToast(t("prompt_updated"), 3000);
          // Refresh list
          const listRes = await fetch(`${backendConfig.url}/prompts`, {
            headers: { "x-token": backendConfig.token },
          });
          if (listRes.ok) setPrompts(await listRes.json());
        } else {
          const body = await readErrorDetail(res);
          onToast(`Activate failed: ${res.status} ${body}`, 5000);
        }
      } catch (err) {
        console.error("Failed to activate prompt:", err);
        onToast(
          `Activate failed: ${err instanceof Error ? err.message : "network error"}`,
          5000,
        );
      }
    },
    [backendConfig, onToast, t],
  );

  return (
    <Card padding="md">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-[16px] font-semibold text-[var(--foreground)] m-0">
          {t("prompt_management")}
        </h2>
        <Button
          variant="secondary"
          size="sm"
          onClick={openCreateForm}
        >
          <Plus size={14} />
          {t("add")}
        </Button>
      </div>

      {formOpen && (
        <div className="flex flex-col gap-3 mb-4 p-4 bg-[var(--muted)] rounded-lg">
          <Input
            id="prompt-name"
            label={t("prompt_name") + " *"}
            type="text"
            value={form.name}
            onChange={(e) =>
              setForm((f) => ({ ...f, name: e.target.value }))
            }
            placeholder="e.g. Technical Writer"
          />
          <div>
            <label
              htmlFor="prompt-template"
              className="block text-sm font-medium text-[var(--muted-foreground)] mb-1.5"
            >
              {t("prompt_template") + " *"}
            </label>
            <textarea
              id="prompt-template"
              className="w-full min-h-[80px] px-3 py-2 text-sm bg-[var(--card)] border border-[var(--border)] rounded-md text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] transition-all duration-150 focus:outline-none focus:border-[var(--brand-500)] focus:ring-2 focus:ring-[var(--brand-500)]/10"
              value={form.template}
              onChange={(e) =>
                setForm((f) => ({ ...f, template: e.target.value }))
              }
              placeholder={t("template_placeholder")}
              rows={3}
            />
          </div>
          <div className="flex items-center gap-2 justify-end">
            <Button variant="secondary" size="sm" onClick={resetForm}>
              <X size={14} />
              {t("cancel")}
            </Button>
            <Button variant="primary" size="sm" onClick={handleSubmit}>
              {editingId ? t("update") : t("create")}
            </Button>
          </div>
        </div>
      )}

      {prompts.length === 0 ? (
        <EmptyState
          icon={<Sparkles size={24} className="text-brand-500" />}
          title={t("no_prompts")}
          description={t("no_prompts_desc")}
          size="sm"
        />
      ) : (
        <div className="divide-y divide-[var(--border)]">
          {prompts.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between py-2"
            >
              <div className="flex flex-col min-w-0 flex-1 mr-3">
                <span className="text-sm text-[var(--muted-foreground)] truncate">
                  {p.name}
                </span>
                {p.template && (
                  <span className="text-xs text-[var(--text-tertiary)] truncate">
                    {p.template}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {p.is_active ? (
                  <Badge variant="success" size="sm">
                    {t("active")}
                  </Badge>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleActivate(p.id)}
                    className="text-[var(--text-tertiary)] hover:text-[var(--brand-600)] transition-colors p-1"
                    aria-label={t("activate")}
                    title={t("activate")}
                  >
                    <Check size={14} />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => openEditForm(p)}
                  className="text-[var(--text-tertiary)] hover:text-[var(--brand-600)] transition-colors p-1"
                  aria-label={t("edit")}
                >
                  <Pencil size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(p.id)}
                  className="text-[var(--text-tertiary)] hover:text-[var(--red-600)] transition-colors p-1"
                  aria-label={t("delete")}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
