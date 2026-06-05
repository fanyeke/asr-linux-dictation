import { useEffect, useRef, useState } from "react";
import { Sparkles } from "lucide-react";
import type { BackendConfig, Prompt } from "../../settings/types.js";
import { Card } from "../ui/Card.js";
import { Badge } from "../ui/Badge.js";
import { EmptyState } from "../ui/EmptyState.js";

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
  const loadedRef = useRef(false);

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
      } catch {
        // ignore
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [backendConfig]);

  return (
    <Card padding="md">
      <h2 className="text-[16px] font-semibold text-dark-900 mb-4">
        {t("prompt_management")}
      </h2>
      {prompts.length === 0 ? (
        <EmptyState
          icon={<Sparkles size={24} className="text-brand-500" />}
          title={t("no_prompts")}
          description={t("no_prompts_desc")}
          size="sm"
        />
      ) : (
        <div className="divide-y divide-gray-100">
          {prompts.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between py-2"
            >
              <span className="text-sm text-dark-700">{p.name}</span>
              {p.is_active && (
                <Badge variant="success" size="sm">
                  {t("active")}
                </Badge>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
