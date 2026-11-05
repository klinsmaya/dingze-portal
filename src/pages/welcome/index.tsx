import { Link } from "react-router";

import { BrandWordmark } from "@/components/app-shell/brand";
import { Button } from "@/components/ui/button";

export function WelcomePage() {
  return (
    <div className="min-h-svh bg-background">
      <header className="mx-auto flex max-w-lg items-center gap-3 px-4 py-4">
        <BrandWordmark />
        <Button className="ml-auto" variant="ghost" nativeButton={false} render={<Link to="/login" />}>
          登录
        </Button>
      </header>
      <main className="mx-auto flex max-w-lg flex-col items-start gap-6 px-4 py-16">
        <h1 className="font-heading text-3xl font-bold text-brand">把战略落到每个部门、每个人</h1>
        <Button nativeButton={false} render={<Link to="/trial" />}>
          免费试用
        </Button>
      </main>
    </div>
  );
}
