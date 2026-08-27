import * as React from "react";
import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      ref={ref}
      className={cn(
        "flex h-11 w-full rounded-sm border border-linea bg-grafito px-3 py-2 text-sm text-crema",
        "placeholder:text-ceniza/70 focus-visible:border-oro focus-visible:outline-none",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = "Input";

/** Input de datos numericos: monoespaciada y alineado a la derecha. */
const InputNumerico = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <Input
      ref={ref}
      inputMode="decimal"
      className={cn("font-mono tabular-nums text-right", className)}
      {...props}
    />
  ),
);
InputNumerico.displayName = "InputNumerico";

export { Input, InputNumerico };
