/**
 * Esqueleto del panel.
 *
 * Next lo muestra apenas se toca un enlace, mientras el servidor arma la
 * pantalla real. Sin esto la navegacion se queda en la pagina anterior y
 * parece que no paso nada; con esto la respuesta al toque es inmediata.
 */
export default function CargandoPanel() {
  return (
    <div className="px-4 py-5 sm:px-6 lg:px-8 lg:py-7" aria-busy="true" aria-live="polite">
      <span className="sr-only">Cargando</span>

      <div className="animate-pulse">
        {/* Encabezado */}
        <div className="h-3 w-24 bg-grafito" />
        <div className="mt-3 h-9 w-64 bg-grafito" />

        {/* Tira de indicadores */}
        <div className="mt-6 grid grid-cols-2 border border-linea sm:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className={[
                "px-4 py-4",
                i % 2 === 0 ? "border-r border-linea" : "",
                i < 2 ? "border-b border-linea sm:border-b-0" : "",
                "sm:border-r sm:last:border-r-0",
              ].join(" ")}
            >
              <div className="h-2.5 w-16 bg-grafito" />
              <div className="mt-3 h-5 w-20 bg-grafito" />
            </div>
          ))}
        </div>

        {/* Filas */}
        <div className="mt-6 border border-linea">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center gap-4 border-b border-linea px-4 py-5 last:border-b-0">
              <div className="h-3 w-10 shrink-0 bg-grafito" />
              <div className="min-w-0 flex-1">
                <div className="h-3 w-40 max-w-full bg-grafito" />
                <div className="mt-2 h-2.5 w-24 max-w-full bg-grafito" />
              </div>
              <div className="h-3 w-16 shrink-0 bg-grafito" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
