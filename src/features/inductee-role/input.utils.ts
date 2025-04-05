/**
 * Apply some post-processing on the provided response for the Discord username
 * to catch and correct some common mistakes.
 */
export function cleanProvidedUsername(providedUsername: string): string {
  // Mistake: "username " instead of "username".
  providedUsername = providedUsername.trim();

  // Mistake: "@username" instead of "username".
  if (providedUsername.startsWith("@")) {
    providedUsername = providedUsername.slice(1);
  }

  // Mistake: "username#0" instead of "username".
  const discriminatorIndex = providedUsername.indexOf("#");
  if (discriminatorIndex !== -1) {
    providedUsername = providedUsername.slice(0, discriminatorIndex);
  }

  // Mistake: "Username" instead of "username".
  providedUsername = providedUsername.toLowerCase();

  return providedUsername;
}
