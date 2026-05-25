import { requireOnboardedUser } from "@/lib/auth";
import { Step6Form } from "./Step6Form";

export const dynamic = "force-dynamic";

export default async function Step6Page() {
  const user = await requireOnboardedUser();
  return <Step6Form userId={user.id} />;
}
