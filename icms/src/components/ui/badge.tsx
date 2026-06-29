import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors",
  {
    variants: {
      variant: {
        default: "border-transparent bg-elms-teal-light text-elms-navy",
        outline: "text-foreground",
        navy: "border-transparent bg-elms-navy text-white",
        green: "border-transparent bg-elms-success/15 text-elms-success",
        amber: "border-transparent bg-elms-warning/15 text-[#B45309]",
        red: "border-transparent bg-elms-alert/15 text-elms-alert",
        critical: "border-transparent bg-elms-alert text-white",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { badgeVariants };
