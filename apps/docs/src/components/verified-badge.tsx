import { ShieldCheckIcon } from "lucide-react";

export function VerifiedBadge() {
  return (
    <div className="bg-fd-muted border-fd-border text-fd-muted-foreground inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium">
      <ShieldCheckIcon className="size-3.5" />
      <span>Verified by the sovseal team</span>
    </div>
  );
}
