/** Keep the private collision discriminator out of public labels. */
export function playerName(alias: string): string {
  return alias.replace(/-[0-9A-F]{8}$/, "");
}
