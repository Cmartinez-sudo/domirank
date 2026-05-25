import { requireOnboardedUser } from "@/lib/auth";
import { Step4Form } from "./Step4Form";

export const dynamic = "force-dynamic";

export default async function Step4Page() {
  const user = await requireOnboardedUser();
  return <Step4Form userId={user.id} />;
}
