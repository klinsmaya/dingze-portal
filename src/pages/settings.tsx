import { useTheme } from "@/components/theme/theme-provider";
import { THEME_MODES } from "@/components/dingze/display-menu";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { FONT_SIZES, type FontSize, useFontSize } from "@/lib/dingze/font-size";

/** 显示设置页：与头像菜单同一份偏好，只存在本机。 */
export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const [size, setSize] = useFontSize();
  return (
    <div className="flex max-w-xl flex-col gap-6">
      <h1 className="font-heading text-2xl font-bold text-brand">显示设置</h1>
      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold">显示模式</h2>
        <ToggleGroup variant="outline" value={[theme ?? "system"]} onValueChange={(v: string[]) => v[0] && setTheme(v[0] as "light" | "dark" | "system")}>
          {THEME_MODES.map(({ value, label, icon: Icon }) => (
            <ToggleGroupItem key={value} value={value} aria-label={label}>
              <Icon /> {label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </section>
      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold">字号</h2>
        <ToggleGroup variant="outline" value={[size]} onValueChange={(v: string[]) => v[0] && setSize(v[0] as FontSize)}>
          {FONT_SIZES.map((s) => (
            <ToggleGroupItem key={s.value} value={s.value} aria-label={`字号${s.label}`}>
              {s.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </section>
    </div>
  );
}
