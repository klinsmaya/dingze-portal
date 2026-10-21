import { ALargeSmall, Contrast, Moon, SunMedium } from "lucide-react";

import { useTheme } from "@/components/theme/theme-provider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FONT_SIZES, type FontSize, useFontSize } from "@/lib/dingze/font-size";
import { cn } from "@/lib/utils";

export const THEME_MODES = [
  { value: "light", label: "白天", icon: SunMedium },
  { value: "dark", label: "黑夜", icon: Moon },
  { value: "system", label: "自动（跟随系统）", icon: Contrast },
] as const;

/** 显示设置的两组单选：主题、字号。顶栏“显示”菜单、头像菜单和设置页共用。 */
export function DisplayRadioGroups() {
  const { theme, setTheme } = useTheme();
  const [size, setSize] = useFontSize();
  return (
    <>
      <DropdownMenuGroup>
        <DropdownMenuLabel>显示模式</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={theme ?? "system"} onValueChange={(v) => setTheme(v as "light" | "dark" | "system")}>
          {THEME_MODES.map(({ value, label, icon: Icon }) => (
            <DropdownMenuRadioItem key={value} value={value} closeOnClick={false}>
              <Icon /> {label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuGroup>
      <DropdownMenuSeparator />
      <DropdownMenuGroup>
        <DropdownMenuLabel>字号</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={size} onValueChange={(v) => setSize(v as FontSize)}>
          {FONT_SIZES.map((s) => (
            <DropdownMenuRadioItem key={s.value} value={s.value} closeOnClick={false}>
              <span className={cn("w-4 text-center font-semibold", s.value === "sm" ? "text-xs" : s.value === "lg" ? "text-base" : "text-sm")}>字</span> {s.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuGroup>
    </>
  );
}

/** 顶栏“显示”：白天 / 黑夜 / 自动 + 小 / 中 / 大（开营前 UX 改版 T1、T2）。 */
export function DisplayMenu({ tone = "band", className }: { tone?: "band" | "surface"; className?: string }) {
  const { theme } = useTheme();
  const [size] = useFontSize();
  const mode = THEME_MODES.find((m) => m.value === (theme ?? "system")) ?? THEME_MODES[2];
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="显示：主题与字号"
        title="显示：白天 / 黑夜 / 自动，字号小 / 中 / 大"
        className={cn(
          "flex h-8 items-center gap-1.5 rounded-full border px-2.5 text-xs",
          tone === "band" ? "border-white/20 bg-white/10 text-band-foreground hover:bg-white/20" : "border-border bg-muted text-foreground hover:bg-accent",
          className,
        )}
      >
        <mode.icon className="size-3.5" />
        <ALargeSmall className="size-4" />
        <span className="hidden xl:inline">显示 · {FONT_SIZES.find((s) => s.value === size)?.label}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DisplayRadioGroups />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
