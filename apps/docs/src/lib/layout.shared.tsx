import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";
import { Title } from "@/components/ui/title";
import { AISearchTrigger } from "@/components/search";
import { SearchIcon } from "lucide-react";

const TABS: Array<{ label: string; href: string }> = [
  { label: "Welcome", href: "/" },
  { label: "Platform", href: "/platform/overview" },
  { label: "Self-Hosted", href: "/self-hosted/overview" },
  { label: "Cookbooks", href: "/cookbooks/overview" },
  { label: "Integrations", href: "/integrations/overview" },
  { label: "SDK Reference", href: "/sdk-reference/overview" },
  { label: "API Reference", href: "/api-reference/overview" },
  { label: "Components", href: "/components/overview" },
  { label: "Changelog", href: "/changelog/highlights" },
];

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: <Title />,
    },
    searchToggle: {
      enabled: false,
      components: {
        lg: (
          <AISearchTrigger className="text-fd-muted-foreground bg-fd-secondary/30 border-fd-border/50 hover:bg-fd-secondary/50 group flex w-full items-center gap-2 rounded-lg border px-3 py-1.5 text-sm transition-all">
            <SearchIcon className="group-hover:text-fd-foreground size-4 shrink-0 transition-colors" />
            <span className="flex-1 text-left">Search or ask AI...</span>
            <kbd className="border-fd-border bg-fd-muted text-fd-muted-foreground group-hover:bg-fd-accent group-hover:text-fd-accent-foreground inline-flex h-5 select-none items-center gap-1 rounded border px-1.5 font-mono text-[10px] font-medium opacity-100 transition-colors">
              <span className="text-xs">⌘</span>K
            </kbd>
          </AISearchTrigger>
        ),
        sm: (
          <AISearchTrigger className="text-fd-muted-foreground hover:bg-fd-accent hover:text-fd-accent-foreground inline-flex items-center justify-center rounded-md p-2 transition-colors">
            <SearchIcon className="size-4" />
          </AISearchTrigger>
        ),
      },
    },
    links: TABS.map((tab) => ({
      type: "main" as const,
      text: tab.label,
      url: tab.href,
      active: tab.href === "/" ? "url" : "nested-url",
      on: "nav" as const,
    })),
  };
}
