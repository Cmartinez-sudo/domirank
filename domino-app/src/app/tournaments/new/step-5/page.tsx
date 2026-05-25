import { requireOnboardedUser } from "@/lib/auth";
import { Step5Form } from "./Step5Form";

export const dynamic = "force-dynamic";

export default async function Step5Page() {
  const user = await requireOnboardedUser();
  return <Step5Form userId={user.id} />;
}
