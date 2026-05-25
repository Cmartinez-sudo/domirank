import { requireOnboardedUser } from "@/lib/auth";
import { Step9Form } from "./Step9Form";

export const dynamic = "force-dynamic";

export default async function Step9Page() {
  const user = await requireOnboardedUser();
  return <Step9Form userId={user.id} />;
}
