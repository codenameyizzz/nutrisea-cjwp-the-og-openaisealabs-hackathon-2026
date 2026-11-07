import IngredientManagement from "@/components/ingredients/IngredientManagement";
import { requireAuth } from "@/domains/auth/guards/require-auth";

export default async function IngredientsPage() {
  await requireAuth();
  return <IngredientManagement />;
}
