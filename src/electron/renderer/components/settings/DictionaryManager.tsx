import { useCallback, useEffect, useRef, useState } from "react";
import { BookOpen, Plus, Pencil, Trash2, X } from "lucide-react";
import type { BackendConfig, DictionaryEntry } from "../../settings/types.js";
import { Card } from "../ui/Card.js";
import { Input } from "../ui/Input.js";
import { Button } from "../ui/Button.js";
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

interface DictionaryManagerProps {
  backendConfig: BackendConfig | null;
  onToast: (msg: string, durationMs?: number) => void;
  t: (key: string) => string;
}

export function DictionaryManager({
  backendConfig,
  onToast,
  t,
}: DictionaryManagerProps): JSX.Element {
  const [dictionary, setDictionary] = useState<DictionaryEntry[]>([]);
  const [dictFormOpen, setDictFormOpen] = useState(false);
  const [editingEntryId, setEditingEntryId] = useState<number | null>(null);
  const [dictForm, setDictForm] = useState({
    canonical_term: "",
    pronunciation: "",
    aliases: "",
    notes: "",
    category: "",
    enforcement_level: "suggested",
  });
  const loadedRef = useRef(false);

  // Load dictionary entries
  useEffect(() => {
    if (!backendConfig || loadedRef.current) return;
    const bc = backendConfig;
    let cancelled = false;
    async function load(): Promise<void> {
      try {
        const res = await fetch(`${bc!.url}/dictionary`, {
          headers: { "x-token": bc!.token, "Content-Type": "application/json" },
        });
        if (!cancelled && res.ok) {
          setDictionary(await res.json());
          loadedRef.current = true;
        }
      } catch (err) {
        console.error("Failed to load dictionary:", err);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [backendConfig]);

  const resetDictForm = useCallback(() => {
    setDictForm({
      canonical_term: "",
      pronunciation: "",
      aliases: "",
      notes: "",
      category: "",
      enforcement_level: "suggested",
    });
    setEditingEntryId(null);
    setDictFormOpen(false);
  }, []);

  const openEditForm = useCallback((entry: DictionaryEntry) => {
    setDictForm({
      canonical_term: entry.canonical_term,
      pronunciation: entry.pronunciation || "",
      aliases: entry.aliases || "",
      notes: entry.notes || "",
      category: entry.category || "",
      enforcement_level: entry.enforcement_level,
    });
    setEditingEntryId(entry.id);
    setDictFormOpen(true);
  }, []);

  const handleDictSubmit = useCallback(async () => {
    if (!backendConfig) return;
    const payload = {
      canonical_term: dictForm.canonical_term.trim(),
      pronunciation: dictForm.pronunciation.trim() || undefined,
      aliases: dictForm.aliases.trim() || undefined,
      notes: dictForm.notes.trim() || undefined,
      category: dictForm.category.trim() || undefined,
      enforcement_level: dictForm.enforcement_level,
    };
    if (!payload.canonical_term) {
      onToast(`${t("canonical_term")} is required`, 3000);
      return;
    }
    try {
      const url = editingEntryId
        ? `${backendConfig.url}/dictionary/${editingEntryId}`
        : `${backendConfig.url}/dictionary`;
      const method = editingEntryId ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          "x-token": backendConfig.token,
        },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        onToast(
          editingEntryId ? t("entry_updated") : t("entry_created"),
          3000,
        );
        resetDictForm();
        // Refresh list
        const dictRes = await fetch(`${backendConfig.url}/dictionary`, {
          headers: { "x-token": backendConfig.token },
        });
        if (dictRes.ok) setDictionary(await dictRes.json());
      } else {
        const body = await readErrorDetail(res);
        onToast(`Failed: ${res.status} ${body}`, 5000);
      }
    } catch (err) {
      console.error("Failed to save dictionary entry:", err);
      onToast(
        `Failed: ${err instanceof Error ? err.message : "network error"}`,
        5000,
      );
    }
  }, [backendConfig, dictForm, editingEntryId, onToast, resetDictForm, t]);

  const handleDeleteEntry = useCallback(
    async (entryId: number) => {
      if (!backendConfig) return;
      if (!window.confirm(t("confirm_delete"))) return;
      try {
        const res = await fetch(
          `${backendConfig.url}/dictionary/${entryId}`,
          {
            method: "DELETE",
            headers: { "x-token": backendConfig.token },
          },
        );
        if (res.ok) {
          onToast(t("entry_deleted"), 3000);
          setDictionary((prev) => prev.filter((e) => e.id !== entryId));
        } else {
          const body = await readErrorDetail(res);
          onToast(`Delete failed: ${res.status} ${body}`, 5000);
        }
      } catch (err) {
        console.error("Failed to delete dictionary entry:", err);
        onToast(
          `Delete failed: ${err instanceof Error ? err.message : "network error"}`,
          5000,
        );
      }
    },
    [backendConfig, onToast, t],
  );

  return (
    <Card padding="md">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-[16px] font-semibold text-dark-900 m-0">
          {t("dictionary_management")}
        </h2>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            resetDictForm();
            setDictFormOpen(true);
          }}
        >
          <Plus size={14} />
          {t("add")}
        </Button>
      </div>

      {dictFormOpen && (
        <div className="flex flex-col gap-3 mb-4 p-4 bg-gray-50 rounded-lg">
          <Input
            id="dict-term"
            label={t("canonical_term") + " *"}
            type="text"
            value={dictForm.canonical_term}
            onChange={(e) =>
              setDictForm((f) => ({ ...f, canonical_term: e.target.value }))
            }
            placeholder="e.g. ASR Linux"
          />
          <Input
            id="dict-pronunciation"
            label={t("pinyin")}
            type="text"
            value={dictForm.pronunciation}
            onChange={(e) =>
              setDictForm((f) => ({ ...f, pronunciation: e.target.value }))
            }
            placeholder="e.g. gui ze"
          />
          <Input
            id="dict-aliases"
            label={t("aliases")}
            type="text"
            value={dictForm.aliases}
            onChange={(e) =>
              setDictForm((f) => ({ ...f, aliases: e.target.value }))
            }
            placeholder="e.g. asr, speech recognition"
          />
          <Input
            id="dict-notes"
            label={t("notes")}
            type="text"
            value={dictForm.notes}
            onChange={(e) =>
              setDictForm((f) => ({ ...f, notes: e.target.value }))
            }
            placeholder="Description or replacement hint"
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              id="dict-category"
              label={t("category")}
              type="text"
              value={dictForm.category}
              onChange={(e) =>
                setDictForm((f) => ({ ...f, category: e.target.value }))
              }
              placeholder="tech, business..."
            />
            <div>
              <label className="block text-sm font-medium text-dark-700 mb-1">
                {t("enforcement")}
              </label>
              <select
                value={dictForm.enforcement_level}
                onChange={(e) =>
                  setDictForm((f) => ({
                    ...f,
                    enforcement_level: e.target.value,
                  }))
                }
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                <option value="suggested">{t("suggested")}</option>
                <option value="forced">{t("forced")}</option>
              </select>
            </div>
          </div>
          <div className="flex items-center gap-2 justify-end">
            <Button variant="secondary" size="sm" onClick={resetDictForm}>
              <X size={14} />
              {t("cancel")}
            </Button>
            <Button variant="primary" size="sm" onClick={handleDictSubmit}>
              {editingEntryId ? t("update") : t("create")}
            </Button>
          </div>
        </div>
      )}

      {dictionary.length === 0 ? (
        <EmptyState
          icon={<BookOpen size={24} className="text-brand-500" />}
          title={t("no_entries")}
          description={t("no_entries_desc")}
          size="sm"
        />
      ) : (
        <div className="divide-y divide-gray-100">
          {dictionary.map((e) => (
            <div
              key={e.id}
              className="flex items-center justify-between py-2"
            >
              <div className="flex flex-col">
                <span className="text-sm text-dark-700">
                  {e.canonical_term}
                </span>
                {e.pronunciation && (
                  <span className="text-xs text-gray-400">
                    {e.pronunciation}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {e.category && (
                  <span className="text-xs text-gray-400">{e.category}</span>
                )}
                <button
                  type="button"
                  onClick={() => openEditForm(e)}
                  className="text-gray-400 hover:text-brand-600 transition-colors p-1"
                  aria-label="Edit entry"
                >
                  <Pencil size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteEntry(e.id)}
                  className="text-gray-400 hover:text-red-600 transition-colors p-1"
                  aria-label="Delete entry"
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
