# Optional Blockchain Audit Stub

Current MVP includes an internal hash chain (`services/api/src/audit/chain.ts`) with:
- deterministic payload hashing
- previous-hash linkage (Merkle-lite chain behavior)
- verification endpoint (`/api/audit/chain`)

## Optional upgrades
1. Anchor periodic root hash to a testnet transaction (e.g., Polygon Amoy).
2. Store only root hash + timestamp on-chain.
3. Keep detailed events off-chain in local encrypted store.
4. Add signature verification for server identity.

This keeps auditability without leaking sensitive content.
