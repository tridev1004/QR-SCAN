import { NameStrikeBlock, NameStrikeBlockRepository } from "../domain/repositories/NameStrikeBlockRepository";

export class InMemoryNameStrikeBlockRepository implements NameStrikeBlockRepository {
  private readonly blocks = new Map<string, NameStrikeBlock>();

  async upsert(block: NameStrikeBlock): Promise<NameStrikeBlock> {
    this.blocks.set(block.normalizedName, block);
    return block;
  }

  async findActive(normalizedName: string, now: Date): Promise<NameStrikeBlock | null> {
    const block = this.blocks.get(normalizedName);
    if (!block || block.blockedUntil.getTime() <= now.getTime()) {
      return null;
    }
    return block;
  }
}
