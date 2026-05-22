import Link from "fumadocs-core/link";
import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "../lib/cn";

export function Cards(props: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...props}
      className={cn("@container grid grid-cols-2 gap-3", props.className)}
    >
      {props.children}
    </div>
  );
}

export type CardProps = Omit<HTMLAttributes<HTMLElement>, "title"> & {
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;

  href?: string;
  external?: boolean;
};

export function Card({ icon, title, description, ...props }: CardProps) {
  const E = props.href ? Link : "div";

  return (
    <E
      {...props}
      data-card
      className={cn(
        "bg-fd-card text-fd-card-foreground @max-lg:col-span-full block rounded-xl border p-4 transition-colors",
        props.href && "hover:bg-fd-accent/80",
        props.className
      )}
    >
      {icon ? (
        <div className="not-prose bg-fd-muted text-fd-muted-foreground mb-2 w-fit rounded-lg border p-1.5 shadow-md [&_svg]:size-4">
          {icon}
        </div>
      ) : null}
      <h3 className="not-prose mb-1 text-sm font-medium">{title}</h3>
      {description ? (
        <p className="my-0! text-fd-muted-foreground text-sm">{description}</p>
      ) : null}
      <div className="text-fd-muted-foreground prose-no-margin text-sm empty:hidden">
        {props.children}
      </div>
    </E>
  );
}
