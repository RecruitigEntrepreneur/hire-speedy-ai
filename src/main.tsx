import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "./i18n";

// Initialize theme from localStorage before render to prevent flash
const savedTheme = localStorage.getItem('matchunt-theme');
if (savedTheme === 'light') {
  document.documentElement.classList.add('light');
}

createRoot(document.getElementById("root")!).render(<App />);
