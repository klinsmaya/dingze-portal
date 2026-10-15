import { useTheme } from "@/components/theme/theme-provider";
import { THEME_MODES } from "@/components/dingze/display-menu";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { FONT_SIZES, type FontSize, useFontSize } from "@/lib/dingze/font-size";

/** 显示设置页：与顶栏“显示”菜单、头像菜单同一份偏好（开营前 UX 改版 T2）。 */
export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const [size, setSize] = useFontSize();
  return (
    <div className="flex max-w-xl flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-bold text-brand">显示设置</h1>
        <p className="mt-1 text-sm text-muted-foreground">只影响这台电脑上的显示，换项目、下次登录都保留。顶栏的“显示”按钮和头像菜单里也能改。</p>
      </div>
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
