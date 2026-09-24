export async function api<T = any>(path: string, opts?: RequestInit): Promise<T> {
  // Only send a JSON Content-Type when there's actually a body — a bodyless
  // request (DELETE, or POST with no payload) plus this header makes Fastify
  // reject with 400 "Body cannot be empty".
  const hasBody = opts?.body != null;
  const res = await fetch(`/api${path}`, {
    ...opts,
    headers: {
      ...(hasBody ? { "Content-Type": "application/json" } : {}),
      ...(opts?.headers ?? {}),
    },
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

export const get = <T = any>(p: string) => api<T>(p);
export const post = <T = any>(p: string, body?: any) =>
  api<T>(p, { method: "POST", body: JSON.stringify(body ?? {}) });
export const patch = <T = any>(p: string, body?: any) =>
  api<T>(p, { method: "PATCH", body: JSON.stringify(body ?? {}) });
export const del = <T = any>(p: string) => api<T>(p, { method: "DELETE" });
