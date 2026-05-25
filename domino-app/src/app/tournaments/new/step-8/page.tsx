import { requireOnboardedUser } from "@/lib/auth";
import { Step8Form } from "./Step8Form";

export const dynamic = "force-dynamic";

export default async function Step8Page() {
  const user = await requireOnboardedUser();
  return <Step8Form userId={user.id} />;
}
