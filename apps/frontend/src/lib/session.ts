const sessionTokenStorageKey = "loveable-clone:session-token";

type SessionResponse = {
  token: string;
};

let pendingTokenRequest: Promise<string> | null = null;

const isSessionResponse = (value: unknown): value is SessionResponse => {
  return (
    typeof value === "object" &&
    value !== null &&
    "token" in value &&
    typeof value.token === "string" &&
    value.token.length > 0
  );
};

const readStoredToken = () => {
  return window.localStorage.getItem(sessionTokenStorageKey);
};

const storeToken = (token: string) => {
  window.localStorage.setItem(sessionTokenStorageKey, token);
};

const requestSessionToken = async () => {
  const response = await fetch("/api/session", {
    method: "POST",
  });

  if (!response.ok) {
    throw new Error(`Failed to create session: ${response.status}`);
  }

  const payload = (await response.json()) as unknown;

  if (!isSessionResponse(payload)) {
    throw new Error("Session response did not include a token");
  }

  storeToken(payload.token);

  return payload.token;
};

export const getSessionToken = async () => {
  const storedToken = readStoredToken();

  if (storedToken) {
    return storedToken;
  }

  pendingTokenRequest ??= requestSessionToken().finally(() => {
    pendingTokenRequest = null;
  });

  return pendingTokenRequest;
};

export const bootstrapSession = async () => {
  await getSessionToken();
};

export const hasStoredSessionToken = () => {
  return readStoredToken() !== null;
};

export const replaceSessionToken = (token: string) => {
  storeToken(token);
};
