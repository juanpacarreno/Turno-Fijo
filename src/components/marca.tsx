import { cn } from "@/lib/utils";

/** Logotipo tipografico: Bodoni Moda en dos lineas, con la regla de oro debajo. */
export function Marca({
  className,
  compacto = false,
}: {
  className?: string;
  compacto?: boolean;
}) {
  return (
    <div className={cn("select-none", className)}>
      <p
        className={cn(
          "font-display leading-[0.95] text-crema",
          compacto ? "text-xl" : "text-2xl",
        )}
      >
        Turno<span className="block">Fijo</span>
      </p>
      <span className="mt-2 block h-px w-10 bg-oro" aria-hidden="true" />
    </div>
  );
}
