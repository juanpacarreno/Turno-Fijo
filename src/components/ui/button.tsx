import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * Boton base. El cobre queda reservado para la accion principal de cada
 * pantalla (una sola por vista) y el oro para lo que involucra dinero.
 * En mobile la altura minima es 52px, tamano tactil comodo.
 */
const variantesBoton = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-sm text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-oro focus-visible:ring-offset-2 focus-visible:ring-offset-sillon [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primario: "bg-cobre text-crema hover:bg-cobre/90 active:bg-cobre/80",
        oro: "bg-oro text-sillon font-semibold hover:bg-oro/90 active:bg-oro/80",
        contorno: "border border-linea bg-transparent text-crema hover:bg-grafito",
        fantasma: "text-ceniza hover:bg-grafito hover:text-crema",
        peligro: "border border-ladrillo bg-transparent text-ladrillo hover:bg-ladrillo hover:text-crema",
        claro: "bg-crema text-sillon font-semibold hover:bg-crema/90",
      },
      size: {
        sm: "h-9 px-3 text-xs",
        md: "h-11 px-4",
        lg: "h-[52px] px-6 text-base",
        icono: "h-10 w-10",
      },
    },
    defaultVariants: { variant: "primario", size: "md" },
  },
);

export interface PropsBoton
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof variantesBoton> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, PropsBoton>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp className={cn(variantesBoton({ variant, size, className }))} ref={ref} {...props} />
    );
  },
);
Button.displayName = "Button";

export { Button, variantesBoton };
