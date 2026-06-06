import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Plus, Pencil, Trash2, Copy } from "lucide-react";
import type { BackendConfig } from "../../settings/types.js";
import { Card } from "../ui/Card.js";
import { Button } from "../ui/Button.js";
import { EmptyState } from "../ui/EmptyState.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface Profile {
  id: number;
  name: string;
  prompt_template: string;
  dictionary_ids: string | null;
  asr_language: string;
  is_active: boolean;
  builtin: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
interface ProfileManagerProps {
  backendConfig: BackendConfig | null;
  onToast: (msg: string, durationMs?: number) => void;
  t: (key: string) => string;
}

export function ProfileManager({
  backendConfig,
  onToast,
  t,
}: ProfileManagerProps): JSX.Element {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editPrompt, setEditPrompt] = useState("");
  const loadedRef = useRef(false);

  // Load profiles
  useEffect(() => {
    if (!backendConfig || loadedRef.current) return;
    const bc = backendConfig;
    let cancelled = false;
    async function load(): Promise<void> {
      try {
        const res = await fetch(`${bc!.url}/profiles`, {
          headers: { "x-token": bc!.token },
        });
        if (!cancelled && res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) setProfiles(data);
          loadedRef.current = true;
        }
      } catch (err) {
        console.error("Failed to load profiles:", err);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [backendConfig]);

  const refreshProfiles = useCallback(async () => {
    if (!backendConfig) return;
    try {
      const res = await fetch(`${backendConfig.url}/profiles`, {
        headers: { "x-token": backendConfig.token },
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) setProfiles(data);
      }
    } catch {
      // ignore
    }
  }, [backendConfig]);

  // Activate a profile
  const handleActivate = useCallback(
    async (profileId: number) => {
      if (!backendConfig) return;
      try {
        const res = await fetch(
          `${backendConfig.url}/profiles/${profileId}/activate`,
          { method: "POST", headers: { "x-token": backendConfig.token } },
        );
        if (res.ok) {
          await refreshProfiles();
          onToast(t("profile_activated"), 2000);
        }
      } catch {
        // ignore
      }
    },
    [backendConfig, refreshProfiles, onToast, t],
  );

  // Duplicate a profile
  const handleDuplicate = useCallback(
    async (profile: Profile) => {
      if (!backendConfig) return;
      try {
        const res = await fetch(`${backendConfig.url}/profiles`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-token": backendConfig.token,
          },
          body: JSON.stringify({
            name: `${profile.name} (copy)`,
            prompt_template: profile.prompt_template,
            dictionary_ids: profile.dictionary_ids,
            asr_language: profile.asr_language,
          }),
        });
        if (res.ok) {
          await refreshProfiles();
          onToast(t("profile_duplicated"), 2000);
        }
      } catch {
        // ignore
      }
    },
    [backendConfig, refreshProfiles, onToast, t],
  );

  // Delete a profile
  const handleDelete = useCallback(
    async (profileId: number) => {
      if (!backendConfig) return;
      if (!window.confirm(t("profile_delete_confirm"))) return;
      try {
        const res = await fetch(
          `${backendConfig.url}/profiles/${profileId}`,
          { method: "DELETE", headers: { "x-token": backendConfig.token } },
        );
        if (res.ok) {
          await refreshProfiles();
          onToast(t("profile_deleted"), 2000);
        } else {
          const body = await res.text().catch(() => "");
          onToast(`Cannot delete: ${body}`, 3000);
        }
      } catch {
        // ignore
      }
    },
    [backendConfig, refreshProfiles, onToast, t],
  );

  // Save edit
  const handleSaveEdit = useCallback(
    async (profileId: number) => {
      if (!backendConfig) return;
      try {
        const res = await fetch(
          `${backendConfig.url}/profiles/${profileId}`,
          {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              "x-token": backendConfig.token,
            },
            body: JSON.stringify({
              name: editName,
              prompt_template: editPrompt,
            }),
          },
        );
        if (res.ok) {
          setEditingId(null);
          await refreshProfiles();
          onToast(t("profile_updated"), 2000);
        }
      } catch {
        // ignore
      }
    },
    [backendConfig, editName, editPrompt, refreshProfiles, onToast, t],
  );

  return (
    <Card padding="md">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-[16px] font-semibold text-dark-900 m-0">
          {t("profiles_title")}
        </h2>
      </div>

      {profiles.length === 0 ? (
        <EmptyState
          icon={<Copy size={24} className="text-brand-500" />}
          title={t("profiles_empty")}
          description={t("profiles_empty_desc")}
          size="sm"
        />
      ) : (
        <div className="divide-y divide-gray-100">
          {profiles.map((profile) => (
            <div key={profile.id} className="py-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-dark-700">
                    {profile.name}
                  </span>
                  {profile.builtin && (
                    <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                      built-in
                    </span>
                  )}
                  {profile.is_active && (
                    <span className="text-[10px] text-green-600 bg-green-50 px-1.5 py-0.5 rounded font-medium">
                      {t("profile_active")}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {!profile.is_active && (
                    <button
                      type="button"
                      onClick={() => handleActivate(profile.id)}
                      className="p-1 text-gray-400 hover:text-green-600 transition-colors"
                      title={t("profile_activate")}
                    >
                      <Check size={14} />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setEditingId(profile.id);
                      setEditName(profile.name);
                      setEditPrompt(profile.prompt_template);
                    }}
                    className="p-1 text-gray-400 hover:text-brand-600 transition-colors"
                    title={t("profile_edit")}
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDuplicate(profile)}
                    className="p-1 text-gray-400 hover:text-brand-600 transition-colors"
                    title={t("profile_duplicate")}
                  >
                    <Copy size={14} />
                  </button>
                  {!profile.builtin && (
                    <button
                      type="button"
                      onClick={() => handleDelete(profile.id)}
                      className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                      title={t("profile_delete")}
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>

              {/* Edit form */}
              {editingId === profile.id && (
                <div className="mt-3 space-y-2 p-3 bg-gray-50 rounded-lg">
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm"
                    placeholder={t("profile_name")}
                  />
                  <textarea
                    value={editPrompt}
                    onChange={(e) => setEditPrompt(e.target.value)}
                    className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm font-mono"
                    rows={3}
                    placeholder={t("profile_prompt")}
                  />
                  <div className="flex gap-2 justify-end">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setEditingId(null)}
                    >
                      {t("cancel")}
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => handleSaveEdit(profile.id)}
                    >
                      {t("save")}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
