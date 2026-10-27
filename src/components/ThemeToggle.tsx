import { Moon, Sun } from "lucide-react";
import type { Theme } from "../theme";

interface ThemeToggleProps {
  theme: Theme;
  onToggle: () => void;
}

export default function ThemeToggle({ theme, onToggle }: ThemeToggleProps) {
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isDark}
      aria-label="Dark mode"
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      onClick={onToggle}
      className={`relative shrink-0 w-14 h-8 rounded-full border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 ${
        isDark ? "bg-blue-600 border-blue-500" : "bg-blue-100 border-blue-200"
      }`}
    >
      {/* Track icons: the knob covers one of them, the other stays visible */}
      <Sun className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/80" />
      <Moon className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-blue-600" />
      <span
        className={`absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-white shadow-sm flex items-center justify-center transition-transform duration-200 ${
          isDark ? "translate-x-6" : "translate-x-0"
        }`}
      >
        {isDark ? <Moon className="w-3.5 h-3.5 text-blue-600" /> : <Sun className="w-3.5 h-3.5 text-amber-500" />}
      </span>
    </button>
  );
}
