import { Contrast, Moon, SunMedium } from "lucide-react";

import { useTheme } from "@/components/theme/theme-provider";
import { cn } from "@/lib/utils";

const MODES = [
  { value: "light", label: "白天", icon: SunMedium },
  { value: "dark", label: "黑夜", icon: Moon },
  { value: "system", label: "自动", icon: Contrast },
] as const;

/** 白天 / 黑夜 / 自动 (design 09 shell): a three-way switch on the dark top band. */
export function ThemeModeSwitch({ className, compact = false, tone = "band" }: { className?: string; compact?: boolean; tone?: "band" | "surface" }) {
  const { theme, setTheme } = useTheme();
  const current = theme ?? "system";
  return (
    <div role="radiogroup" aria-label="显示模式" className={cn("flex items-center rounded-full border p-0.5", tone === "band" ? "border-white/20 bg-white/10" : "border-border bg-muted", className)}>
      {MODES.map(({ value, label, icon: Icon }) => {
        const on = current === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={on}
            title={value === "system" ? "跟随系统的浅色 / 深色" : label}
            onClick={() => setTheme(value)}
            className={cn(
              "flex h-7 items-center gap-1 rounded-full px-2.5 text-xs transition-colors",
              on ? "bg-gold font-semibold text-[#0c3d52]" : tone === "band" ? "text-band-muted hover:text-band-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="size-3.5" />
            {compact ? <span className="sr-only">{label}</span> : label}
          </button>
        );
      })}
    </div>
  );
}
