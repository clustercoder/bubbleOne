import { sha256 } from "../utils/hash";

export interface AuditBlock {
  index: number;
  timestamp: string;
  eventType: string;
  payloadHash: string;
  previousHash: string;
  hash: string;
}

export class AuditChain {
  private readonly enabled: boolean;
  private readonly chain: AuditBlock[] = [];

  constructor(enabled: boolean) {
    this.enabled = enabled;
  }

  append(eventType: string, payload: unknown): AuditBlock | null {
    if (!this.enabled) {
      return null;
    }

    const index = this.chain.length;
    const timestamp = new Date().toISOString();
    const payloadHash = sha256(JSON.stringify(payload));
    const previousHash = this.chain[index - 1]?.hash ?? "GENESIS";
    const hash = sha256(`${index}|${timestamp}|${eventType}|${payloadHash}|${previousHash}`);

    const block: AuditBlock = {
      index,
      timestamp,
      eventType,
      payloadHash,
      previousHash,
      hash,
    };

    this.chain.push(block);
    return block;
  }

  verify(): boolean {
    if (!this.enabled) {
      return true;
    }

    for (let i = 0; i < this.chain.length; i += 1) {
      const curr = this.chain[i];
      const expectedPrev = i === 0 ? "GENESIS" : this.chain[i - 1].hash;
      if (curr.previousHash !== expectedPrev) {
        return false;
      }

      const expectedHash = sha256(
        `${curr.index}|${curr.timestamp}|${curr.eventType}|${curr.payloadHash}|${curr.previousHash}`,
      );
      if (expectedHash !== curr.hash) {
        return false;
      }
    }

    return true;
  }

  getChain(): AuditBlock[] {
    return [...this.chain];
  }
}
