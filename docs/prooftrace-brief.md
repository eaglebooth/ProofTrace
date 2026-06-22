# ProofTrace Brief

## One-line Positioning

ProofTrace is a trust layer for AI outputs on 0G: a neutral provenance and attestation registry where developers can register, discover, and verify AI output certificates.

## What ProofTrace Does

ProofTrace records commitments for AI outputs:

- Who attested to the output
- What input, output, and metadata hashes were committed
- When the attestation was created
- Where the artifact or metadata is stored on 0G Storage
- Which model/provider metadata was declared
- What trust level the evidence supports
- Whether optional 0G Compute TEE evidence is attached

ProofTrace should not claim that it independently proves a model produced an output unless TEE-backed or reproducible evidence is present. For self-attested records, it proves that an issuer signed and anchored a commitment at a specific time.

## Why It Is Different

0G Compute already provides infrastructure-level TEE attestation. Several ecosystem apps use attestation for specific verticals:

- Enclav: code security scanning and finding-level certificates
- SILO: private agent memory and execution audit trails
- MEKAR: AI genealogy, lineage, and royalty tracking
- Foundry: co-training attribution and ownership proofs

ProofTrace is not another vertical app. It is a public registry and developer API that those vertical products could integrate with to publish attestations.

## Trust Levels

| Level | Evidence | What it means | Use case |
| --- | --- | --- | --- |
| Self-attested | Wallet signature + content hashes | The issuer declared and signed metadata for an output | Internal tracking, low-risk provenance |
| Provider-TEE | 0G Compute/provider TEE evidence | The output is linked to provider-backed compute evidence | Auditable AI decisions, compliance |
| Reproducible | Public input, config, model reference, and artifacts | Others can inspect or rerun the generation path | Research and open science |

## Recommended MVP

Keep:

- Upload artifact/output to 0G Storage
- Calculate `inputHash`, `outputHash`, and `metadataHash`
- EIP-712 wallet signature from developer or issuer
- Smart contract record with issuer, hashes, timestamp, trust level, and storage pointer
- Verify page for file/JSON hash checking against on-chain records
- Public registry with filters by issuer, model, date, and trust tier
- REST API and webhook support

Add:

- `sourceType`: OpenAI, 0G Compute, custom model, local
- `attestationLevel`: self, provider-TEE, reproducible
- `modelCommitment`: model name, version, and optional weight hash
- `promptDisclosure`: public, redacted, encrypted
- Revocation by issuer
- Content-hash-only mode for sensitive data

Avoid for MVP:

- NFT minting for every attestation
- PostgreSQL as source of truth
- Fine-tuning, custom compute, or ZK circuits

The canonical source should be 0G Chain plus 0G Storage. PostgreSQL, if used, should only be an index/cache for search.

## DAO Demo Flow

The strongest demo vertical is DAO AI recommendation audit:

1. A DAO proposal is submitted.
2. An AI agent analyzes the proposal, ideally through 0G Compute.
3. The output and metadata are uploaded to 0G Storage.
4. ProofTrace creates an attestation with proposal hash, prompt hash, output hash, model metadata, issuer, timestamp, and trust level.
5. Before voting, DAO members click Verify and inspect the certificate.

Value proposition: DAO members can verify whether AI recommendations come from auditable sources before using them in governance decisions.

## Pitch

ProofTrace is a provenance registry for AI outputs. Developers store artifacts on 0G Storage, sign input-output-model commitments, and anchor attestations on 0G Chain. Verifiers can check integrity, issuer identity, timestamp, declared model metadata, revocation status, and optional 0G Compute TEE evidence.

## Strategic Recommendation

Build ProofTrace as infrastructure, not a proof generator. The defensible position is:

> Trust layer for AI outputs on 0G, with transparent trust tiers and optional TEE-backed evidence.

This makes ProofTrace complementary to 0G Compute and vertical apps such as Enclav, SILO, MEKAR, and Foundry.
