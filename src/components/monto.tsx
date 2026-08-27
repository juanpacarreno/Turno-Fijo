import { pesos } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Todo importe pasa por aca: monoespaciada, tabular y alineado a la derecha.
 * `destacado` pinta de oro; se usa solo para totales, nunca para la lista
 * entera (el oro no debe superar el 10% de la pantalla).
 */
export function Monto({
  centavos,
  className,
  destacado = false,
}: {
  centavos: number;
  className?: string;
  destacado?: boolean;
}) {
  return (
    <span
      className={cn(
        "font-mono tabular-nums text-right",
        destacado ? "text-oro" : "text-crema",
        className,
      )}
    >
      {pesos(centavos)}
    </span>
  );
}
