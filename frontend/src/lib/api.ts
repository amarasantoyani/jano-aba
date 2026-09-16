export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "THERAPIST";
}

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export async function api<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const headers = new Headers(options.headers);

  if (options.body !== undefined && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`/api${path}`, {
    ...options,
    headers,
    credentials: "same-origin"
  });

  if (!response.ok) {
    const data = await response.json().catch(() => null);

    const message =
      typeof data?.error?.message === "string"
        ? data.error.message
        : "Não foi possível concluir a operação.";

    throw new ApiError(response.status, message);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}