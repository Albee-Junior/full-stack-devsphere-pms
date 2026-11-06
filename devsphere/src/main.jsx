import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles/tokens.css";
import "./styles/reset.css";
import "./styles/typography.css";
import "./styles/global.css";
import "./styles/prototype/tokens.css";
import "./styles/prototype/reset.css";
import "./styles/prototype/typography.css";
import "./styles/prototype/global.css";
import "./App.css";
import "./styles/platform.css";
import "./styles/student.css";
import "./styles/prototype/layout/app-shell.css";
import "./styles/prototype/layout/topbar.css";
import "./styles/prototype/layout/sidebar.css";
import "./styles/prototype/components/avatar.css";
import "./styles/prototype/components/cards.css";
import "./styles/prototype/components/dropdowns.css";
import "./styles/prototype/pages/dashboard.css";
import "./styles/prototype/pages/projects.css";
import "./styles/prototype/app-adapter.css";
import App from "./App.jsx";
import { AuthProvider } from "./context/AuthProvider.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </StrictMode>,
);
