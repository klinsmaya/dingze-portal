import { Contrast, Moon, SunMedium } from "lucide-react";

import { useTheme } from "@/components/theme/theme-provider";
import {
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { FONT_SIZES, type FontSize, useFontSize } from "@/lib/dingze/font-size";
import { cn } from "@/lib/utils";

export const THEME_MODES = [
  { value: "light", label: "白天", icon: SunMedium },
  { value: "dark", label: "黑夜", icon: Moon },
  { value: "system", label: "自动（跟随系统）", icon: Contrast },
] as const;

/** 显示设置的两组单选：主题、字号。头像菜单和设置页共用。 */
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
