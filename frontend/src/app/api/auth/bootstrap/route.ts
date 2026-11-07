import { auth, clerkClient } from "@clerk/nextjs/server";
import { accountBootstrapResponse } from "@/services/account-bootstrap-handler";

export async function POST(request: Request) {
  return accountBootstrapResponse(request, {
    authenticatedUserId: async () => (await auth()).userId,
    users: async () => (await clerkClient()).users,
  });
}
