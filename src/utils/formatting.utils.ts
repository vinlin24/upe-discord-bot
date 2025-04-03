export function toBulletedList(lines: unknown[]): string {
  return lines.map(line => `* ${line}`).join("\n");
}
