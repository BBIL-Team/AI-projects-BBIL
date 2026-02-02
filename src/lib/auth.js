const KEY = "ai_heads_user";

export function setUser(name) {
  if (!name?.trim()) return false;
  localStorage.setItem(KEY, JSON.stringify({ name }));
  return true;
}

export function getUser() {
  try {
    return JSON.parse(localStorage.getItem(KEY));
  } catch {
    return null;
  }
}

export function clearUser() {
  localStorage.removeItem(KEY);
}
