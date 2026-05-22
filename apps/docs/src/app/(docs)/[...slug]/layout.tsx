import { source } from "@/lib/source";
import { DocsLayout } from "fumadocs-ui/layouts/notebook";
import { baseOptions } from "@/lib/layout.shared";
import type { ReactNode } from "react";

interface LayoutProps {
  children: ReactNode;
  params: Promise<{ slug: string[] }>;
}

export default async function Layout({ children, params }: LayoutProps) {
  const resolvedParams = await params;
  const slug = resolvedParams?.slug || [];
  const activeSegment = slug[0];

  const fullTree = source.getPageTree();

  // Find the active folder corresponding to the active segment
  const activeFolder = activeSegment
    ? fullTree.children.find((child) => {
        if (child.type === "folder") {
          // 1. Check if folder has an index or child that matches the activeSegment URL prefix
          const hasMatchingChild = child.children.some(
            (c) => c.type === "page" && c.url.startsWith(`/${activeSegment}`)
          );
          const indexMatches = child.index && child.index.url.startsWith(`/${activeSegment}`);

          if (hasMatchingChild || indexMatches) {
            return true;
          }

          // 2. Check if the folder name matches activeSegment (case insensitive fallback)
          const folderName = typeof child.name === "string" ? child.name.toLowerCase() : "";
          if (folderName === activeSegment.toLowerCase()) {
            return true;
          }
        }
        return false;
      })
    : undefined;

  // Construct a filtered page tree for DocsLayout
  const filteredTree =
    activeFolder && activeFolder.type === "folder"
      ? {
          name: activeFolder.name,
          children: activeFolder.children,
        }
      : fullTree;

  return (
    <DocsLayout
      tree={filteredTree}
      {...baseOptions()}
      nav={{
        ...baseOptions().nav,
        mode: "top",
      }}
    >
      {children}
    </DocsLayout>
  );
}
