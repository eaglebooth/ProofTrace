# ProofTrace

ProofTrace is a trust layer for AI outputs on 0G. It lets AI apps issue verifiable output certificates with input/output hashes, model metadata, issuer identity, trust level, storage pointer, and optional TEE evidence reference.

This hackathon build is a working product, not a static demo:

- Node API for creating, listing, verifying, and revoking attestations
- Browser dashboard for issuing and verifying certificates
- Local 0G Storage adapter that persists artifact JSON files under `data/artifacts`
- Registry database under `data/attestations.json`
- Solidity registry contract in `contracts/ProofTraceRegistry.sol`
- Optional EIP-712 wallet signing when MetaMask is available

## Run

```bash
npm.cmd run dev
```

Open:

```text
http://localhost:3000
```

## Product Scope

ProofTrace records commitments. It does not overclaim that a model produced an output unless provider TEE or reproducible evidence is attached.

Trust levels:

- `self`: issuer signed the output commitment
- `provider-TEE`: output is linked to provider or TEE evidence
- `reproducible`: public input/config/model references allow independent verification

## API

Create:

```http
POST /api/attestations
```

Verify:

```http
POST /api/verify
```

List:

```http
GET /api/attestations
```

Revoke:

```http
POST /api/revoke
```

## Hackathon Demo Path

1. Open the app.
2. Create a DAO recommendation attestation.
3. Copy the created attestation ID into the Verify panel.
4. Paste the same AI output and run verification.
5. Show the ledger and trust level in the registry.

## 0G Integration Plan

The local adapter keeps the product usable during judging. Replace the storage and chain write points with:

- 0G Storage upload for artifact and metadata JSON
- 0G Chain transaction calling `ProofTraceRegistry.attest`
- 0G Compute TEE quote reference in `evidenceRef`
