import "./styles/globals.css";
import { createRoot } from "react-dom/client";
import { OverlayWindow } from "./overlay/overlay-window.js";

function OverlayApp(): JSX.Element {
  return <OverlayWindow />;
}

const container = document.getElementById("root");
if (container) {
  const root = createRoot(container);
  root.render(<OverlayApp />);
}
