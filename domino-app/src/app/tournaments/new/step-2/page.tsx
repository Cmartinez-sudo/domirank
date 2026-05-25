import { requireOnboardedUser } from "@/lib/auth";
import { Step2Form } from "./Step2Form";

export const dynamic = "force-dynamic";

export default async function Step2Page() {
  const user = await requireOnboardedUser();
  return <Step2Form userId={user.id} />;
}
