// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract ProofTraceRegistry {
    enum AttestationLevel {
        SelfAttested,
        ProviderTEE,
        Reproducible
    }

    struct Attestation {
        bytes32 outputHash;
        bytes32 inputHash;
        bytes32 metadataHash;
        address issuer;
        uint256 timestamp;
        AttestationLevel level;
        string storageCid;
        bool revoked;
    }

    mapping(bytes32 => Attestation) public attestations;

    event AttestationCreated(
        bytes32 indexed attestationId,
        address indexed issuer,
        bytes32 outputHash,
        AttestationLevel level,
        string storageCid
    );

    event AttestationRevoked(bytes32 indexed attestationId, address indexed issuer);

    error AttestationExists();
    error AttestationMissing();
    error NotIssuer();

    function attest(
        bytes32 outputHash,
        bytes32 inputHash,
        bytes32 metadataHash,
        AttestationLevel level,
        string calldata storageCid
    ) external returns (bytes32 attestationId) {
        attestationId = keccak256(
            abi.encodePacked(outputHash, inputHash, metadataHash, msg.sender, block.timestamp)
        );

        if (attestations[attestationId].timestamp != 0) revert AttestationExists();

        attestations[attestationId] = Attestation({
            outputHash: outputHash,
            inputHash: inputHash,
            metadataHash: metadataHash,
            issuer: msg.sender,
            timestamp: block.timestamp,
            level: level,
            storageCid: storageCid,
            revoked: false
        });

        emit AttestationCreated(attestationId, msg.sender, outputHash, level, storageCid);
    }

    function revoke(bytes32 attestationId) external {
        Attestation storage record = attestations[attestationId];
        if (record.timestamp == 0) revert AttestationMissing();
        if (record.issuer != msg.sender) revert NotIssuer();
        record.revoked = true;
        emit AttestationRevoked(attestationId, msg.sender);
    }

    function verify(bytes32 attestationId, bytes32 outputHash) external view returns (bool) {
        Attestation storage record = attestations[attestationId];
        return record.timestamp != 0 && !record.revoked && record.outputHash == outputHash;
    }
}
