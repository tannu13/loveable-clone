import { apiFetch } from "./api";
import { replaceSessionToken } from "./session";

export type UserIdentity = {
  username: string | null;
  isAnonymous: boolean;
};

type ClaimUserResponse = {
  user: {
    username: string | null;
    isAnonymous: boolean;
  };
};

type LoginResponse = ClaimUserResponse & {
  token: string;
};

const identityStorageKey = "loveable-clone:user-identity";

const isClaimUserResponse = (value: unknown): value is ClaimUserResponse => {
  if (typeof value !== "object" || value === null || !("user" in value)) {
    return false;
  }

  const user = (value as { user?: unknown }).user;

  return (
    typeof user === "object" &&
    user !== null &&
    "username" in user &&
    "isAnonymous" in user &&
    ((user as { username?: unknown }).username === null ||
      typeof (user as { username?: unknown }).username === "string") &&
    typeof (user as { isAnonymous?: unknown }).isAnonymous === "boolean"
  );
};

const isLoginResponse = (value: unknown): value is LoginResponse => {
  return (
    isClaimUserResponse(value) &&
    "token" in value &&
    typeof value.token === "string" &&
    value.token.length > 0
  );
};

export const getStoredIdentity = (): UserIdentity => {
  try {
    const storedValue = window.localStorage.getItem(identityStorageKey);

    if (!storedValue) {
      return {
        username: null,
        isAnonymous: true,
      };
    }

    const parsed = JSON.parse(storedValue) as unknown;

    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "username" in parsed &&
      "isAnonymous" in parsed &&
      ((parsed as { username?: unknown }).username === null ||
        typeof (parsed as { username?: unknown }).username === "string") &&
      typeof (parsed as { isAnonymous?: unknown }).isAnonymous === "boolean"
    ) {
      return parsed as UserIdentity;
    }
  } catch {
    // Identity display is best-effort; the session token remains the source of auth.
  }

  return {
    username: null,
    isAnonymous: true,
  };
};

const storeIdentity = (identity: UserIdentity) => {
  window.localStorage.setItem(identityStorageKey, JSON.stringify(identity));
};

export const claimAccount = async (username: string) => {
  const response = await apiFetch("/users/claim", {
    body: JSON.stringify({ username }),
    headers: {
      "Content-Type": "application/json",
    },
    method: "POST",
  });

  if (response.status === 409) {
    throw new Error("Username already exists");
  }

  if (!response.ok) {
    throw new Error(`Failed to claim account: ${response.status}`);
  }

  const payload = (await response.json()) as unknown;

  if (!isClaimUserResponse(payload)) {
    throw new Error("Claim response did not include user identity");
  }

  const identity: UserIdentity = {
    username: payload.user.username,
    isAnonymous: payload.user.isAnonymous,
  };

  storeIdentity(identity);

  return identity;
};

export const signInWithUsername = async (username: string) => {
  const response = await fetch("/login", {
    body: JSON.stringify({ username }),
    headers: {
      "Content-Type": "application/json",
    },
    method: "POST",
  });

  if (response.status === 404) {
    throw new Error("No account found for that username");
  }

  if (!response.ok) {
    throw new Error(`Failed to sign in: ${response.status}`);
  }

  const payload = (await response.json()) as unknown;

  if (!isLoginResponse(payload)) {
    throw new Error("Login response did not include a session");
  }

  const identity: UserIdentity = {
    username: payload.user.username,
    isAnonymous: payload.user.isAnonymous,
  };

  replaceSessionToken(payload.token);
  storeIdentity(identity);

  return identity;
};
