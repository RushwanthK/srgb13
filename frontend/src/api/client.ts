const API_BASE = "/api/v1";

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

type Params = Record<string, string | undefined>;

export async function apiGet<T>(path: string, params: Params = {}): Promise<T> {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") query.set(key, value);
  }
  const qs = query.toString();
  const url = `${API_BASE}${path}${qs ? `?${qs}` : ""}`;

  let response: Response;
  try {
    response = await fetch(url);
  } catch {
    throw new ApiError(0, "Cannot reach the GridBrick API. Is the backend running?");
  }
  if (!response.ok) {
    let detail = `Request failed (HTTP ${response.status})`;
    try {
      const body = await response.json();
      if (typeof body?.detail === "string") detail = body.detail;
      else if (Array.isArray(body?.detail)) detail = body.detail.map((d: { msg?: string }) => d.msg).join("; ");
    } catch {
      /* non-JSON error body */
    }
    throw new ApiError(response.status, detail);
  }
  return (await response.json()) as T;
}
