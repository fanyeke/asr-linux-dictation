import "./styles/globals.css";
import { createRoot } from "react-dom/client";
import { OverlayWindow } from "./overlay/overlay-window.js";
import { I18nProvider, createI18nState } from "./lib/i18n.js";
import { ThemeProvider } from "./components/ThemeProvider.js";

function AppWithI18n(): JSX.Element {
  const i18n = createI18nState("zh");
  return (
    <ThemeProvider>
      <I18nProvider value={i18n}>
        <OverlayWindow />
      </I18nProvider>
    </ThemeProvider>
  );
}

const container = document.getElementById("root");
if (container) {
  const root = createRoot(container);
  root.render(<AppWithI18n />);
}
