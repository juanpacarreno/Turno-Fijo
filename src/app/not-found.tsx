import Link from "next/link";
import { Marca } from "@/components/marca";
import { Button } from "@/components/ui/button";

export default function NoEncontrado() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-5 py-12">
      <Marca />
      <h1 className="mt-10 font-display text-4xl text-crema">No encontramos esta pagina</h1>
      <p className="mt-3 text-sm text-ceniza">
        Puede que el enlace este mal escrito o que la barberia ya no este publicada.
      </p>
      <Button asChild className="mt-8 w-full" size="lg">
        <Link href="/">Volver al inicio</Link>
      </Button>
    </main>
  );
}
