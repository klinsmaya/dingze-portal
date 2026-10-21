import { cn } from "@/lib/utils";

type BrandLogoProps = {
  className?: string;
};

/** The 定三责 seal: a gold “责” on the brand colour. */
export function BrandLogo({ className }: BrandLogoProps) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex size-10 shrink-0 items-center justify-center rounded-lg bg-gold font-heading text-lg font-bold text-brand dark:text-brand-foreground",
        className,
      )}
    >
      责
    </span>
  );
}

export function BrandWordmark({ className }: BrandLogoProps) {
  return (
    <span className={cn("inline-flex min-w-0 items-center gap-2.5", className)}>
      <BrandLogo className="size-9" />
      <span className="flex min-w-0 flex-col leading-tight">
        <span className="truncate font-heading text-base font-bold tracking-wide text-brand dark:text-foreground">
          自驱战略 · 定三责
        </span>
        <span className="truncate text-[11px] text-muted-foreground">
          企业战略咨询平台
        </span>
      </span>
    </span>
  );
}

type BrandProps = {
  className?: string;
  logoClassName?: string;
  showText?: boolean;
};

export function Brand({
  className,
  logoClassName,
  showText = true,
}: BrandProps) {
  return (
    <div className={cn("flex min-w-0 items-center", className)}>
      {showText ? (
        <BrandWordmark className={logoClassName} />
      ) : (
        <BrandLogo className={logoClassName} />
      )}
    </div>
  );
}
