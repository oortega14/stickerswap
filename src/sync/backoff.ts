const SCHEDULE = [1_000, 5_000, 30_000, 300_000];

export function backoffMs(attempts: number): number {
  return SCHEDULE[Math.min(attempts, SCHEDULE.length - 1)];
}

export function isStuck(attempts: number): boolean {
  return attempts >= 10;
}
