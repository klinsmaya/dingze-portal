import { Search } from "lucide-react";
import { useMemo, useState } from "react";

import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { SYSTEM_ROLE_LABELS, type DzUser } from "@/lib/dingze/ops-api";

/** A searchable checkbox list of accounts. */
export function UserChecklist({
  users,
  selected,
  onChange,
  emptyText = "没有可选的账号",
}: {
  users: DzUser[];
  selected: number[];
  onChange: (next: number[]) => void;
  emptyText?: string;
}) {
  const [q, setQ] = useState("");
  const visible = useMemo(() => {
    const keyword = q.trim().toLowerCase();
    if (!keyword) return users;
    return users.filter((u) => u.username.toLowerCase().includes(keyword) || u.nickname?.toLowerCase().includes(keyword));
  }, [q, users]);
  const toggle = (id: number, checked: boolean) =>
    onChange(checked ? [...selected, id] : selected.filter((x) => x !== id));

  return (
    <div className="flex flex-col gap-2">
      {users.length > 6 ? (
        <div className="relative">
          <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="按姓名或登录名筛选" className="pl-8" />
        </div>
      ) : null}
      <ul className="max-h-56 overflow-y-auto rounded-lg border">
        {visible.length === 0 ? (
          <li className="px-3 py-4 text-center text-sm text-muted-foreground">{emptyText}</li>
        ) : (
          visible.map((u) => (
            <li key={u.id} className="border-b last:border-b-0">
              <label className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm hover:bg-muted/50">
                <Checkbox checked={selected.includes(u.id)} onCheckedChange={(checked) => toggle(u.id, checked === true)} />
                <span className="font-medium">{u.nickname || u.username}</span>
                <span className="text-muted-foreground">{u.username}</span>
                <span className="ml-auto text-xs text-muted-foreground">
                  {u.roles.map((r) => SYSTEM_ROLE_LABELS[r]).join("、")}
                </span>
              </label>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
