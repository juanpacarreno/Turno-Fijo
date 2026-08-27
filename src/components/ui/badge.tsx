import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const variantesBadge = cva(
  "inline-flex items-center rounded-sm border px-2 py-[3px] font-mono text-[10px] uppercase tracking-etiqueta",
  {
    variants: {
      variant: {
        neutro: "border-linea text-ceniza",
        reservado: "border-linea text-crema",
        pagado: "border-navaja bg-navaja/15 text-navaja",
        cancelado: "border-ladrillo text-ladrillo",
        ausente: "border-linea text-ceniza line-through",
        activo: "border-oro bg-oro/15 text-oro",
      },
    },
    defaultVariants: { variant: "neutro" },
  },
);

export interface PropsBadge
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof variantesBadge> {}

function Badge({ className, variant, ...props }: PropsBadge) {
  return <span className={cn(variantesBadge({ variant }), className)} {...props} />;
}

export { Badge, variantesBadge };
