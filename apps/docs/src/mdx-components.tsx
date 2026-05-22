import defaultMdxComponents from "fumadocs-ui/mdx";
import type { MDXComponents } from "mdx/types";
import { Tab, Tabs } from "@/components/tabs";
import { Accordion, Accordions } from "@/components/accordion";
import { Callout } from "@/components/callout";
import { Card, Cards } from "@/components/card";
import { Bot, Users } from "lucide-react";

export function getMDXComponents(components?: MDXComponents): MDXComponents {
  return {
    ...defaultMdxComponents,
    Accordion,
    Accordions,
    Tab,
    Tabs,
    Callout,
    Card,
    Cards,
    Bot,
    Users,
    header: ({ children, ...props }: any) => (
      <header {...props}>{children}</header>
    ),
    ...components,
  };
}
