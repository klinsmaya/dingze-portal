import { ChangePasswordForm } from "@/components/auth/change-password-form";
import { useTheme } from "@/components/theme/theme-provider";
import { THEME_MODES } from "@/components/dingze/display-menu";
import { FilterGroup, FilterItem } from "@/components/dingze/filter-group";
import { FONT_SIZES, useFontSize } from "@/lib/dingze/font-size";

/** 设置页：显示偏好与头像菜单是同一份，只存在本机；登录密码本人在这里改。 */
export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const [size, setSize] = useFontSize();
  return (
    <div className="flex max-w-xl flex-col gap-6">
      <h1 className="font-heading text-2xl font-bold text-brand">设置</h1>
      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold">显示模式</h2>
        <FilterGroup value={(theme ?? "system") as "light" | "dark" | "system"} onChange={setTheme} aria-label="主题">
          {THEME_MODES.map(({ value, label, icon: Icon }) => (
            <FilterItem key={value} value={value} aria-label={label}>
              <Icon /> {label}
            </FilterItem>
          ))}
        </FilterGroup>
      </section>
      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold">字号</h2>
        <FilterGroup value={size} onChange={setSize} aria-label="字号">
          {FONT_SIZES.map((s) => (
            <FilterItem key={s.value} value={s.value} aria-label={`字号${s.label}`}>
              {s.label}
            </FilterItem>
          ))}
        </FilterGroup>
      </section>
      <section id="password" className="flex scroll-mt-20 flex-col gap-3 border-t pt-6">
        <h2 className="text-sm font-semibold">登录密码</h2>
        <ChangePasswordForm />
      </section>
    </div>
  );
}
