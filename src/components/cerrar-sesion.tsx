"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Cierra la sesion del lado del servidor (borra las cookies httpOnly). */
export function CerrarSesion({ className }: { className?: string }) {
  const router = useRouter();
  const [saliendo, setSaliendo] = useState(false);

  async function salir() {
    setSaliendo(true);
    await fetch("/auth/salir", { method: "POST" });
    router.replace("/");
    router.refresh();
  }

  return (
    <Button
      type="button"
      variant="fantasma"
      size="sm"
      className={className}
      onClick={salir}
      disabled={saliendo}
    >
      <LogOut aria-hidden="true" />
      {saliendo ? "Saliendo..." : "Salir"}
    </Button>
  );
}
