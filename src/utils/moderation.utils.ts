import { Role } from "discord.js";

/**
 * Remove the specified role from all of its members.
 */
export async function clearRole(role: Role, reason?: string): Promise<void> {
  for (const member of role.members.values()) {
    await member.roles.remove(role, reason);
  }
}
