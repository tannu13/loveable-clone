import { getSessionToken } from "./session";

export const apiFetch = async (
  input: RequestInfo | URL,
  init: RequestInit = {},
) => {
  const token = await getSessionToken();
  const headers = new Headers(init.headers);

  headers.set("Authorization", `Bearer ${token}`);

  return fetch(input, {
    ...init,
    headers,
  });
};
