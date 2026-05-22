import { source, getPageImage } from "@/lib/source";
import { DocsBody } from "fumadocs-ui/layouts/docs/page";
import { notFound } from "next/navigation";
import { getMDXComponents } from "@/mdx-components";
import type { Metadata } from "next";

export default async function HomePage() {
  const page = source.getPage([]);
  if (!page) notFound();
  const MDX = page.data.body;

  return (
    <main className="container mx-auto max-w-6xl px-4 pb-24 pt-8 md:pt-16">
      <DocsBody>
        <MDX components={getMDXComponents()} />
      </DocsBody>
    </main>
  );
}

export async function generateMetadata(): Promise<Metadata> {
  const page = source.getPage([]);
  if (!page) notFound();

  return {
    title: page.data.title,
    description: page.data.description,
    openGraph: {
      images: getPageImage(page).url,
    },
  };
}
