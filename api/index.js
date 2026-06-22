const crypto = require("crypto");

function sha256(value) {
  return "0x" + crypto.createHash("sha256").update(value || "", "utf8").digest("hex");
}

function stableStringify(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
}

function shortId(hash, prefix = "att") {
  return `${prefix}_${hash.slice(2, 10)}...${hash.slice(-6)}`;
}

function nowIso() {
  return new Date().toISOString();
}

function createAttestation(payload) {
  const metadata = {
    appName: payload.appName || "ProofTrace App",
    modelName: payload.modelName || "unknown-model",
    modelVersion: payload.modelVersion || "unspecified",
    sourceType: payload.sourceType || "custom",
    promptDisclosure: payload.promptDisclosure || "redacted",
    modelCommitment: payload.modelCommitment || "",
    evidenceRef: payload.evidenceRef || "",
    daoProposal: payload.daoProposal || ""
  };

  const input = payload.input || "";
  const output = payload.output || "";
  const outputHash = payload.outputHash || sha256(output);
  const inputHash = payload.inputHash || sha256(input);
  const metadataHash = sha256(stableStringify(metadata));
  const issuer = payload.issuer || "dev-vercel-issuer";
  const level = payload.attestationLevel || "self";
  const createdAt = nowIso();
  const attestationId = sha256([outputHash, inputHash, metadataHash, issuer, createdAt].join(":"));

  return {
    attestationId,
    displayId: shortId(attestationId),
    outputHash,
    inputHash,
    metadataHash,
    issuer,
    signature: payload.signature || "",
    trustLevel: level,
    sourceType: metadata.sourceType,
    modelName: metadata.modelName,
    modelVersion: metadata.modelVersion,
    appName: metadata.appName,
    promptDisclosure: metadata.promptDisclosure,
    storageCid: `zg://prooftrace/vercel/${attestationId.slice(2, 18)}`,
    evidenceRef: metadata.evidenceRef,
    daoProposal: metadata.daoProposal,
    createdAt,
    revoked: false,
    status: "AttestationCreated",
    chain: {
      network: "0G Galileo testnet-ready",
      txHash: shortId(sha256(`tx:${attestationId}`), "0x"),
      block: 9845312 + Math.floor(Math.random() * 10000)
    }
  };
}

function seedAttestations() {
  return [
    createAttestation({
      appName: "DAO Risk Council",
      modelName: "0G Compute / Llama-3.1",
      modelVersion: "8B-Instruct",
      sourceType: "0G Compute",
      attestationLevel: "provider-TEE",
      promptDisclosure: "redacted",
      issuer: "0x6f3c...A91d",
      input: "Should the DAO fund Proposal #42?",
      output: "Recommendation: approve with milestones and treasury cap.",
      evidenceRef: "tee://provider/demo-quote-001",
      daoProposal: "Proposal #42"
    }),
    createAttestation({
      appName: "Grant Summary Bot",
      modelName: "GPT-4o Summary",
      modelVersion: "2026-05",
      sourceType: "OpenAI",
      attestationLevel: "self",
      promptDisclosure: "hash-only",
      issuer: "0x2B41...fE20",
      input: "Summarize grant application A-17.",
      output: "The application is technically credible but needs budget clarification."
    }),
    createAttestation({
      appName: "Research Repro Runner",
      modelName: "Mistral-7B",
      modelVersion: "v0.3",
      sourceType: "custom model",
      attestationLevel: "reproducible",
      promptDisclosure: "public",
      issuer: "0x9b12...e7fa",
      input: "Classify benchmark sample 391.",
      output: "Class: compliant. Confidence: 0.87.",
      evidenceRef: "ipfs://config-and-weights-demo"
    })
  ];
}

function records() {
  if (!globalThis.__proofTraceRecords) {
    globalThis.__proofTraceRecords = seedAttestations();
  }
  return globalThis.__proofTraceRecords;
}

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body, null, 2));
}

module.exports = async function handler(req, res) {
  const url = new URL(req.url, `https://${req.headers.host || "prooftrace.app"}`);
  const pathname = url.pathname.replace(/^\/api/, "") || "/";

  if (req.method === "GET" && pathname === "/attestations") {
    return send(res, 200, { records: records().slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt)) });
  }

  if (req.method === "GET" && pathname.startsWith("/attestations/")) {
    const id = decodeURIComponent(pathname.replace("/attestations/", ""));
    const record = records().find((item) => item.attestationId === id || item.displayId === id);
    return record ? send(res, 200, { record }) : send(res, 404, { error: "Attestation not found" });
  }

  if (req.method === "POST" && pathname === "/attestations") {
    const record = createAttestation(req.body || {});
    records().push(record);
    return send(res, 201, { record });
  }

  if (req.method === "POST" && pathname === "/verify") {
    const payload = req.body || {};
    const record = records().find((item) => item.attestationId === payload.attestationId || item.displayId === payload.attestationId);
    if (!record) return send(res, 404, { ok: false, error: "Attestation not found" });

    const computedOutputHash = payload.output ? sha256(payload.output) : payload.outputHash;
    const hashMatches = computedOutputHash ? computedOutputHash === record.outputHash : true;
    return send(res, 200, {
      ok: hashMatches && !record.revoked,
      hashMatches,
      revoked: record.revoked,
      computedOutputHash,
      expectedOutputHash: record.outputHash,
      record
    });
  }

  if (req.method === "POST" && pathname === "/revoke") {
    const payload = req.body || {};
    const index = records().findIndex((item) => item.attestationId === payload.attestationId);
    if (index === -1) return send(res, 404, { error: "Attestation not found" });
    records()[index].revoked = true;
    records()[index].revokedAt = nowIso();
    records()[index].status = "Revoked";
    return send(res, 200, { record: records()[index] });
  }

  return send(res, 404, { error: "Unknown API route" });
};
