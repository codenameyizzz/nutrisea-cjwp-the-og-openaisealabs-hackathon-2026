import ProfileForm from "../profile-form";
import { requireAuth } from "@/domains/auth/guards/require-auth";

export default async function EditProfilePage() {
  await requireAuth();
  return <ProfileForm />;
}
