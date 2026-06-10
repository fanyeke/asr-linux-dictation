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

function TabItem({
  tab,
  isActive,
  onClick,
}: {
  tab: { id: TabId; label: string; icon: LucideIcon };
  isActive: boolean;
  onClick: () => void;
}): JSX.Element {
  const Icon = tab.icon;

  return (
    <button
      key={tab.id}
      type="button"
      data-testid={`tab-${tab.id}`}
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150",
        "focus:outline-none focus:ring-2 focus:ring-[var(--ring)]/40",
        isActive
          ? "text-[var(--sidebar-text-active)]"
          : "text-[var(--sidebar-text)] hover:text-[var(--foreground)]",
      )}
      style={{
        background: isActive ? "var(--sidebar-bg-active)" : "transparent",
      }}
    >
      {/* Active indicator bar */}
      <div
        className={cn(
          "w-[3px] h-5 rounded-full transition-all duration-150",
          isActive ? "opacity-100" : "opacity-0",
        )}
        style={{ background: "var(--primary)" }}
      />
      <Icon
        size={20}
        className={cn(
          "transition-colors duration-150 flex-shrink-0",
          isActive ? "text-[var(--primary)]" : "text-[var(--sidebar-text)]",
        )}
        strokeWidth={isActive ? 2 : 1.5}
      />
      <span className="truncate">{tab.label}</span>
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
        className="hidden sm:flex flex-col w-[220px] flex-shrink-0 border-r"
        style={{
          background: "var(--sidebar-bg)",
          borderColor: "var(--sidebar-border)",
        }}
      >
        {/* App logo area */}
        <div className="flex items-center gap-2 px-4 py-4 border-b" style={{ borderColor: "var(--sidebar-border)" }}>
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: "var(--primary)" }}
          >
            <Mic size={18} className="text-white" />
          </div>
          <span className="font-semibold text-base" style={{ color: "var(--foreground)" }}>
            {t("app_name")}
          </span>
        </div>

        {/* Navigation */}
        <div className="flex flex-col gap-1 p-3 flex-1">
          {tabs.map((tab) => (
            <TabItem
              key={tab.id}
              tab={tab}
              isActive={tab.id === activeTab}
              onClick={() => onTabChange(tab.id)}
            />
          ))}
        </div>
      </nav>

      {/* Mobile bottom nav (<640px) */}
      <nav
        data-testid="tab-sidebar-mobile"
        className="flex sm:hidden fixed bottom-0 left-0 right-0 h-16 border-t z-50"
        style={{
          background: "var(--sidebar-bg)",
          borderColor: "var(--sidebar-border)",
        }}
      >
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              type="button"
              data-testid={`tab-${tab.id}`}
              onClick={() => onTabChange(tab.id)}
              className={cn(
                "flex flex-col items-center justify-center gap-1 flex-1 h-full",
                "text-[10px] font-medium transition-all duration-150",
                "focus:outline-none focus:ring-2 focus:ring-[var(--ring)]/40 focus:ring-inset",
                isActive
                  ? "text-[var(--primary)]"
                  : "text-[var(--muted-foreground)]",
              )}
            >
              <Icon
                size={20}
                className={cn(
                  "transition-colors duration-150",
                  isActive ? "text-[var(--primary)]" : "text-[var(--muted-foreground)]",
                )}
                strokeWidth={isActive ? 2 : 1.5}
              />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </nav>
    </>
  );
}

export default TabSidebar;
