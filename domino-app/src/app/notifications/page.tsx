import { requireUser } from "@/lib/auth";
import { getNotifications, markAllRead } from "@/lib/notifications";
import { NotificationsList } from "./NotificationsList";

export const dynamic = "force-dynamic";

export const metadata = { title: "Notificaciones · DomiRank" };

export default async function NotificationsPage() {
  await requireUser();
  const items = await getNotifications(50);
  // Marcar todas como leídas al abrir la página (después del fetch para que
  // el render muestre el indicador visual de "no leída" si aplica)
  await markAllRead();

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <h1 className="text-3xl font-bold">Notificaciones</h1>
      <NotificationsList items={items} />
    </div>
  );
}
