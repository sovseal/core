import { getPageImage, source } from "@/lib/source";
import {
  DocsBody,
  DocsDescription,
  DocsPage,
  DocsTitle,
} from "fumadocs-ui/layouts/notebook/page";
import { notFound } from "next/navigation";
import { getMDXComponents } from "@/mdx-components";
import type { Metadata } from "next";
import { createRelativeLink } from "fumadocs-ui/mdx";
import { LLMCopyButton, ViewOptions } from "@/components/ai/page-actions";
import { VerifiedBadge } from "@/components/verified-badge";
import { AISearchTrigger } from "@/components/search";
import { SearchIcon } from "lucide-react";

export default async function Page(props: PageProps<"/[...slug]">) {
  const params = await props.params;
  const page = source.getPage(params.slug);
  if (!page) notFound();

  const MDX = page.data.body;
  const gitConfig = {
    user: "sovseal",
    repo: "sovseal",
    branch: "main",
  };

  return (
    <DocsPage
      toc={page.data.toc}
      full={page.data.full}
      footer={{ enabled: true }}
      tableOfContent={{
        header: (
          <div className="border-fd-border/50 mb-4 flex flex-col gap-3 border-b pb-4">
            <AISearchTrigger className="text-fd-muted-foreground bg-fd-secondary/40 border-fd-border/50 hover:bg-fd-secondary/60 group flex h-9 w-full shrink-0 items-center gap-2 rounded-xl border px-3 py-2 text-sm shadow-sm transition-all">
              <SearchIcon className="group-hover:text-fd-foreground size-4 shrink-0 transition-colors" />
              <span className="line-clamp-1 flex-1 text-left">
                Ask or search...
              </span>
              <kbd className="border-fd-border bg-fd-muted/50 text-fd-muted-foreground group-hover:bg-fd-accent group-hover:text-fd-accent-foreground inline-flex h-5 select-none items-center gap-1 rounded border px-1.5 font-mono text-[10px] font-medium opacity-100 transition-colors">
                <span className="text-xs">⌘</span>K
              </kbd>
            </AISearchTrigger>
          </div>
        ),
      }}
      tableOfContentPopover={{
        header: (
          <div className="border-fd-border/50 mb-4 flex flex-col gap-3 border-b pb-4">
            <AISearchTrigger className="text-fd-muted-foreground bg-fd-secondary/40 border-fd-border/50 hover:bg-fd-secondary/60 group flex h-9 w-full shrink-0 items-center gap-2 rounded-xl border px-3 py-2 text-sm shadow-sm transition-all">
              <SearchIcon className="group-hover:text-fd-foreground size-4 shrink-0 transition-colors" />
              <span className="line-clamp-1 flex-1 text-left">
                Ask or search...
              </span>
            </AISearchTrigger>
          </div>
        ),
      }}
    >
      <div className="relative">
        <div className="absolute right-0 top-0 z-10 flex flex-row items-center gap-2 max-md:static max-md:mb-4">
          <LLMCopyButton markdownUrl={`${page.url}.mdx`} />
          <ViewOptions
            markdownUrl={`${page.url}.mdx`}
            githubUrl={`https://github.com/${gitConfig.user}/${gitConfig.repo}/blob/${gitConfig.branch}/docs/${page.path}`}
          />
        </div>

        <div className="mb-8 flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <VerifiedBadge />
            <div className="bg-border h-px flex-1" />
          </div>
          <DocsTitle>{page.data.title}</DocsTitle>
          <DocsDescription className="mb-0">
            {page.data.description}
          </DocsDescription>
        </div>
      </div>

      <DocsBody>
        <MDX
          components={getMDXComponents({
            // this allows you to link to other pages with relative file paths
            a: createRelativeLink(source, page),
          })}
        />
      </DocsBody>
    </DocsPage>
  );
}

export async function generateStaticParams() {
  // Exclude the root path — that's handled by (home)/page.tsx with HomeLayout.
  return source
    .generateParams()
    .filter((p) => Array.isArray(p.slug) && p.slug.length > 0);
}

export async function generateMetadata(
  props: PageProps<"/[...slug]">
): Promise<Metadata> {
  const params = await props.params;
  const page = source.getPage(params.slug);
  if (!page) notFound();

  return {
    title: page.data.title,
    description: page.data.description,
    openGraph: {
      images: getPageImage(page).url,
    },
  };
}
