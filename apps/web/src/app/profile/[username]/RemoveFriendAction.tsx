"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { unfriend } from "@/lib/friends";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useToast } from "@/components/Toast";

interface Props {
  targetUserId: string;
  displayName: string;
}

/**
 * Botón secundario "Quitar amigo" para la página de perfil ajeno.
 * Solo se renderiza cuando el viewer ya es amigo del perfil.
 * Muestra un ConfirmDialog antes de ejecutar la acción.
 */
export function RemoveFriendAction({ targetUserId, displayName }: Props) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const router = useRouter();
  const toast = useToast();

  async function handleConfirm() {
    setPending(true);
    const res = await unfriend(targetUserId);
    setPending(false);
    setOpen(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Eliminado de tus amigos");
    router.push("/friends");
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn-ghost text-danger hover:bg-danger/10 w-full md:w-auto"
      >
        Quitar amigo
      </button>

      <ConfirmDialog
        open={open}
        title={`¿Quitar a ${displayName} de tus amigos?`}
        description="Vas a perder el acceso a sus partidas privadas si las tiene."
        confirmLabel="Quitar amigo"
        cancelLabel="Cancelar"
        destructive
        pending={pending}
        onConfirm={handleConfirm}
        onCancel={() => setOpen(false)}
      />
    </>
  );
}
