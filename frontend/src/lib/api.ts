import { apiErrorMessage } from "./api-error-messages";

export const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000").replace(/\/$/, "");

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export async function responseJson<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = body?.detail;
    const message = typeof detail === "string" ? apiErrorMessage(detail) : Array.isArray(detail)
      ? detail.map((item: { msg?: string }) => apiErrorMessage(item.msg || "Invalid input")).join("; ")
      : "The request failed. Please try again.";
    throw new ApiError(response.status, message);
  }
  return body as T;
}
