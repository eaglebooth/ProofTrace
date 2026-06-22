# ProofTrace Build Plan

## Goal

Ship a usable hackathon product for registering and verifying AI output provenance on 0G.

ProofTrace is not a static website. It includes a working registry API, storage adapter, verification flow, dashboard, and Solidity contract surface.

## Target Users

- AI app developers building on 0G
- DAO and governance teams using AI recommendations before votes
- Agent frameworks that need output provenance
- Audit and compliance teams reviewing AI-generated reports
- Vertical 0G apps such as security scanners, memory-audit tools, model-lineage protocols, and co-training systems

## Product Modules

1. Registry UI
   - Recent attestations
   - Trust level explanation
   - Public ledger view
   - Registry metrics

2. Create Attestation
   - Input/proposal text
   - AI output text
   - Model and source metadata
   - Trust level selection
   - Optional evidence reference
   - Optional wallet signature through EIP-712 when a browser wallet exists

3. Verify Output
   - Verify by attestation ID plus pasted output
   - Verify by attestation ID plus output hash
   - Show hash match, revocation state, issuer, and trust level

4. API
   - `GET /api/attestations`
   - `GET /api/attestations/:id`
   - `POST /api/attestations`
   - `POST /api/verify`
   - `POST /api/revoke`

5. Storage Adapter
   - Local filesystem adapter for hackathon reliability
   - Same boundary can be replaced with 0G Storage upload

6. Smart Contract
   - `ProofTraceRegistry.attest`
   - `ProofTraceRegistry.verify`
   - `ProofTraceRegistry.revoke`

## Demo Scenario

DAO AI recommendation audit:

1. DAO proposal is entered as input.
2. AI recommendation is entered as output.
3. ProofTrace creates hashes and a certificate.
4. The artifact is stored through the storage adapter.
5. The attestation appears in the public registry.
6. A voter pastes the output into Verify and sees whether it matches the registry record.

## What Is Real Today

- Hashing is real.
- Artifact persistence is real.
- Registry persistence is real.
- Verification logic is real.
- Revocation API is real.
- Browser wallet signing path is implemented when MetaMask is available.
- Solidity contract is included for on-chain deployment.

## What To Replace For Full 0G Deployment

- Replace local storage adapter with 0G Storage SDK.
- Replace local registry persistence with 0G Chain calls to `ProofTraceRegistry`.
- Attach actual 0G Compute TEE quote data in `evidenceRef`.
- Add an indexer for search and filtering if registry volume grows.
