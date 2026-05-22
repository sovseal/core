import { cva, type VariantProps } from "class-variance-authority";

const variants = {
  primary:
    "bg-fd-primary text-fd-primary-foreground hover:bg-fd-primary/90 shadow-gold-glow hover:shadow-gold-glow-intense disabled:bg-fd-secondary disabled:text-fd-secondary-foreground transition-all duration-300",
  outline:
    "border border-fd-border hover:bg-fd-accent hover:text-fd-accent-foreground transition-all duration-300",
  ghost:
    "hover:bg-fd-accent hover:text-fd-accent-foreground transition-all duration-300 outline-none",
  secondary:
    "border border-fd-border bg-fd-secondary text-fd-secondary-foreground hover:bg-fd-accent hover:text-fd-accent-foreground transition-all duration-300",
} as const;

export const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-lg p-2 text-sm font-medium transition-colors duration-100 disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fd-ring",
  {
    variants: {
      variant: variants,
      // fumadocs use `color` instead of `variant`
      color: variants,
      size: {
        sm: "gap-1 px-2 py-1.5 text-xs",
        icon: "p-1.5 [&_svg]:size-5",
        "icon-sm": "p-1.5 [&_svg]:size-4.5",
        "icon-xs": "p-1 [&_svg]:size-4",
      },
    },
  }
);

export type ButtonProps = VariantProps<typeof buttonVariants>;
