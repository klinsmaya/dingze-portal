import { Checkbox } from "@/components/ui/checkbox";
import { FieldLegend, FieldSet } from "@/components/ui/field";

/** 开通账号时“同时加进哪些项目”：只列进行中的项目，默认全选（进项目一律是项目成员）。 */
export function ProjectPicker({
  projects,
  selected,
  onChange,
}: {
  projects: { id: number; name: string }[];
  selected: number[];
  onChange: (next: number[]) => void;
}) {
  if (!projects.length) return null;
  return (
    <FieldSet>
      <FieldLegend variant="label">加入项目（项目成员）</FieldLegend>
      <ul className="max-h-40 overflow-y-auto rounded-lg border">
        {projects.map((p) => (
          <li key={p.id} className="border-b last:border-b-0">
            <label className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm hover:bg-muted/50">
              <Checkbox
                checked={selected.includes(p.id)}
                onCheckedChange={(checked) => onChange(checked === true ? [...selected, p.id] : selected.filter((x) => x !== p.id))}
              />
              <span>{p.name}</span>
            </label>
          </li>
        ))}
      </ul>
    </FieldSet>
  );
}
