import { requireOnboardedUser } from "@/lib/auth";
import { Step3Form } from "./Step3Form";

export const dynamic = "force-dynamic";

export default async function Step3Page() {
  const user = await requireOnboardedUser();
  return <Step3Form userId={user.id} />;
}
