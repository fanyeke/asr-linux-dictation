import { cn } from "../lib/utils.js";
import { useTranslation } from "../lib/i18n.js";
import {
  Mic,
  History,
  Settings,
  LayoutDashboard,
} from "lucide-react";
import type { TabId } from "../settings/types.js";
import type { LucideIcon } from "lucide-react";

interface TabSidebarProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}

function TabButton({
  tab,
  isActive,
  onClick,
  orientation,
}: {
  tab: { id: TabId; label: string; icon: LucideIcon };
  isActive: boolean;
  onClick: () => void;
  orientation: "vertical" | "horizontal";
}): JSX.Element {
  const Icon = tab.icon;

  if (orientation === "vertical") {
    return (
      <button
        key={tab.id}
        type="button"
        data-testid={`tab-${tab.id}`}
        onClick={onClick}
        className={cn(
          "flex flex-col items-center gap-2 w-14 py-3 px-2 rounded-lg text-[11px] font-medium transition-all duration-150",
          "focus:outline-none focus:ring-2 focus:ring-brand-500/40",
          isActive
            ? "bg-brand-500/15 text-white shadow-glow-brand border-l-2 border-brand-500 rounded-l-none"
            : "text-gray-500 hover:bg-white/5 hover:text-gray-300",
        )}
      >
        <Icon
          size={20}
          className={cn(
            "transition-colors duration-150",
            isActive ? "text-white" : "text-gray-500",
          )}
        />
        <span>{tab.label}</span>
      </button>
    );
  }

  return (
    <button
      key={tab.id}
      type="button"
      data-testid={`tab-${tab.id}`}
      onClick={onClick}
      className={cn(
        "flex flex-col items-center justify-center gap-1 flex-1 h-full",
        "text-[10px] font-medium transition-all duration-150",
        "focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:ring-inset",
        isActive
          ? "text-brand-600"
          : "text-gray-400 hover:text-gray-600",
      )}
    >
      <Icon
        size={20}
        className={cn(
          "transition-colors duration-150",
          isActive ? "text-brand-600" : "text-gray-400",
        )}
      />
      <span>{tab.label}</span>
    </button>
  );
}

export function TabSidebar({
  activeTab,
  onTabChange,
}: TabSidebarProps): JSX.Element {
  const { t } = useTranslation();
  const tabs: { id: TabId; label: string; icon: LucideIcon }[] = [
    { id: "dashboard", label: t("tab_dashboard"), icon: LayoutDashboard },
    { id: "dictate", label: t("tab_dictate"), icon: Mic },
    { id: "history", label: t("tab_history"), icon: History },
    { id: "settings", label: t("tab_settings"), icon: Settings },
  ];
  return (
    <>
      {/* Desktop sidebar (≥640px) */}
      <nav
        data-testid="tab-sidebar"
        className="hidden sm:flex flex-col items-center gap-2 px-2 py-4 w-[72px] bg-dark-900 border-r border-white/5 flex-shrink-0"
      >
        {tabs.map((tab) => (
          <TabButton
            key={tab.id}
            tab={tab}
            isActive={tab.id === activeTab}
            onClick={() => onTabChange(tab.id)}
            orientation="vertical"
          />
        ))}
      </nav>

      {/* Mobile bottom nav (<640px) */}
      <nav
        data-testid="tab-sidebar-mobile"
        className="flex sm:hidden fixed bottom-0 left-0 right-0 h-16 bg-[var(--card)] border-t border-[var(--border)] z-50"
      >
        {tabs.map((tab) => (
          <TabButton
            key={tab.id}
            tab={tab}
            isActive={tab.id === activeTab}
            onClick={() => onTabChange(tab.id)}
            orientation="horizontal"
          />
        ))}
      </nav>
    </>
  );
}

export default TabSidebar;
