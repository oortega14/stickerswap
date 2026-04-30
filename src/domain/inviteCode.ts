const RE = /^[A-F0-9]{8}$/;

export function normalizeInviteCode(input: string): string {
  return input.trim().toUpperCase();
}

export function isValidInviteCode(input: string): boolean {
  return RE.test(normalizeInviteCode(input));
}
