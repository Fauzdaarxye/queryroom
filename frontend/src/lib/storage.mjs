export function localRead(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value === null ? fallback : JSON.parse(value);
  } catch {
    return fallback;
  }
}

export function localWrite(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}
