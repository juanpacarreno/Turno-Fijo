/** Esqueleto de la pagina publica de reservas, mientras carga el salon. */
export default function CargandoReserva() {
  return (
    <main
      className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8 lg:py-10"
      aria-busy="true"
      aria-live="polite"
    >
      <span className="sr-only">Cargando</span>

      <div className="animate-pulse">
        <div className="border-b border-linea pb-5">
          <div className="h-2.5 w-48 bg-grafito" />
          <div className="mt-3 h-7 w-56 bg-grafito" />
        </div>

        <div className="mt-8 h-2.5 w-20 bg-grafito" />
        <div className="mt-3 flex gap-1">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-0.5 flex-1 bg-linea" />
          ))}
        </div>

        <div className="mt-8 h-9 w-72 max-w-full bg-grafito" />

        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex min-h-[88px] items-center gap-4 border border-linea px-4 py-4">
              <div className="size-12 shrink-0 border border-linea" />
              <div className="min-w-0 flex-1">
                <div className="h-4 w-24 bg-grafito" />
                <div className="mt-2 h-2.5 w-32 max-w-full bg-grafito" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
