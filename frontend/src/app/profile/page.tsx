import ProfileSummary from "./profile-summary";
import { requireAuth } from "@/domains/auth/guards/require-auth";

export default async function ProfilePage() {
  await requireAuth();
  return <ProfileSummary />;
}
