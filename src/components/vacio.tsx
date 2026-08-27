import { cn } from "@/lib/utils";

/** Estado vacio sobrio: linea de 1px, sin ilustraciones ni sombras. */
export function Vacio({
  titulo,
  detalle,
  children,
  className,
}: {
  titulo: string;
  detalle?: string;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("border border-dashed border-linea px-6 py-10 text-center", className)}>
      <p className="font-display text-lg text-crema">{titulo}</p>
      {detalle ? <p className="mx-auto mt-2 max-w-md text-sm text-ceniza">{detalle}</p> : null}
      {children ? <div className="mt-5 flex justify-center">{children}</div> : null}
    </div>
  );
}
