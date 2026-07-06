"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ConfirmDangerDialog } from "@/components/ConfirmDangerDialog";
import { useToast } from "@/components/Toast";
import { updateGroupSettings, deactivateGroup, transferAdmin } from "@/lib/groups";

type OtherMember = {
  user_id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  role: "admin" | "co_admin" | "member";
};

export function SettingsPanel({
  groupId,
  initialName,
  initialDescription,
  initialAllowFriendlies,
  isActive,
  otherMembers,
}: {
  groupId: string;
  initialName: string;
  initialDescription: string;
  initialAllowFriendlies: boolean;
  isActive: boolean;
  otherMembers: OtherMember[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription);
  const [allowFriendlies, setAllowFriendlies] = useState(initialAllowFriendlies);

  const [confirmDeactivate, setConfirmDeactivate] = useState(false);
  const [transferTarget, setTransferTarget] = useState<OtherMember | null>(null);

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const r = await updateGroupSettings({
        groupId,
        name: name.trim(),
        description: description.trim() || undefined,
        allowFriendlies,
      });
      if (!r.ok) toast.error(r.error);
      else {
        toast.success("Cambios guardados");
        router.refresh();
      }
    });
  }

  function handleDeactivate() {
    startTransition(async () => {
      const r = await deactivateGroup({ groupId });
      setConfirmDeactivate(false);
      if (!r.ok) toast.error(r.error);
      else {
        toast.info("Grupo desactivado");
        router.push("/groups");
      }
    });
  }

  function handleTransfer() {
    if (!transferTarget) return;
    const target = transferTarget;
    startTransition(async () => {
      const r = await transferAdmin({ groupId, newAdminUserId: target.user_id });
      setTransferTarget(null);
      if (!r.ok) toast.error(r.error);
      else {
        toast.success(`${target.display_name || target.username} es ahora el admin`);
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-5">
      {/* Form principal */}
      <form onSubmit={handleSave} className="space-y-5">
        <section className="card space-y-4">
          <h2 className="font-semibold text-sm">Información del grupo</h2>

          <div>
            <label htmlFor="g-name" className="label block mb-1.5">
              Nombre
            </label>
            <input
              id="g-name"
              type="text"
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={60}
              required
            />
          </div>

          <div>
            <label htmlFor="g-desc" className="label block mb-1.5">
              Descripción
            </label>
            <textarea
              id="g-desc"
              className="input min-h-[80px] resize-y"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={500}
            />
          </div>

          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={allowFriendlies}
              onChange={(e) => setAllowFriendlies(e.target.checked)}
              className="accent-primary mt-1"
            />
            <div>
              <div className="font-semibold text-sm">Contar partidas amistosas</div>
              <div className="text-text-mute text-xs mt-0.5">
                Si está activo, las partidas amistosas (no rated) suman en el leaderboard.
              </div>
            </div>
          </label>
        </section>

        <button type="submit" className="btn-primary" disabled={pending || !isActive}>
          {pending ? "Guardando…" : "Guardar cambios"}
        </button>
      </form>

      {/* Zona de peligro */}
      <section className="card border-danger/30 space-y-4">
        <h2 className="font-semibold text-sm text-danger">Zona de peligro</h2>

        <div>
          <div className="font-semibold text-sm">Transferir admin</div>
          <p className="text-text-mute text-xs mt-1">
            Pasa el rol de admin a otro miembro activo. Vos quedás como
            miembro regular. Útil si vas a salirte del grupo.
          </p>
          {otherMembers.length === 0 ? (
            <p className="text-text-mute text-xs mt-2">
              No hay otros miembros activos a quien transferir el rol.
            </p>
          ) : (
            <select
              className="input mt-2"
              defaultValue=""
              onChange={(e) => {
                const target = otherMembers.find((m) => m.user_id === e.target.value);
                if (target) setTransferTarget(target);
                e.target.value = "";
              }}
              disabled={pending}
            >
              <option value="" disabled>
                Elegir nuevo admin…
              </option>
              {otherMembers.map((m) => (
                <option key={m.user_id} value={m.user_id}>
                  {m.display_name || m.username} (@{m.username})
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="border-t border-border pt-4">
          <div className="font-semibold text-sm">Desactivar grupo</div>
          <p className="text-text-mute text-xs mt-1">
            El grupo deja de aparecer en la lista, no se atribuyen partidas
            nuevas, pero el historial se conserva.
          </p>
          <button
            type="button"
            onClick={() => setConfirmDeactivate(true)}
            disabled={pending || !isActive}
            className="mt-2 px-4 py-2 rounded-lg text-sm font-semibold text-danger hover:bg-danger/10 transition-colors disabled:opacity-50"
          >
            {isActive ? "Desactivar grupo" : "Grupo ya desactivado"}
          </button>
        </div>
      </section>

      {/* Confirms */}
      <ConfirmDangerDialog
        open={confirmDeactivate}
        onClose={() => setConfirmDeactivate(false)}
        onConfirm={handleDeactivate}
        title="¿Desactivar el grupo?"
        description="El grupo deja de aparecer en la lista de miembros. No se atribuyen partidas nuevas. El historial se conserva."
        confirmLabel="Sí, desactivar"
        pending={pending}
      />
      <ConfirmDangerDialog
        open={transferTarget !== null}
        onClose={() => setTransferTarget(null)}
        onConfirm={handleTransfer}
        title="¿Transferir el rol de admin?"
        description={`${transferTarget?.display_name || transferTarget?.username} se vuelve admin del grupo. Vos pasás a ser miembro regular y ya no podrás editar settings ni promover/quitar miembros.`}
        confirmLabel="Sí, transferir"
        pending={pending}
      />
    </div>
  );
}
