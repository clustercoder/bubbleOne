import crypto from "crypto";

export function hashAlias(alias: string): string {
  return crypto.createHash("sha256").update(alias).digest("hex").slice(0, 16);
}

export function sha256(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}
