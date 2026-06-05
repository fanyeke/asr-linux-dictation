import "./styles/globals.css";
import { createRoot } from "react-dom/client";
import { OverlayWindow } from "./overlay/overlay-window.js";
import { I18nProvider, createI18nState } from "./lib/i18n.js";

function OverlayApp(): JSX.Element {
  return <OverlayWindow />;
}

const container = document.getElementById("root");
if (container) {
  const root = createRoot(container);
  const i18n = createI18nState("zh");
  root.render(
    <I18nProvider value={i18n}>
      <OverlayApp />
    </I18nProvider>
  );
}
