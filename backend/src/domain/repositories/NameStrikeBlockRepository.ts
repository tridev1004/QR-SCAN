export interface NameStrikeBlock {
  normalizedName: string;
  blockedUntil: Date;
  sourceEmployeeId: string;
  sourceEmployeeName: string;
  createdAt: Date;
}

export interface NameStrikeBlockRepository {
  upsert(block: NameStrikeBlock): Promise<NameStrikeBlock>;
  findActive(normalizedName: string, now: Date): Promise<NameStrikeBlock | null>;
}

export function normalizeEmployeeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}
