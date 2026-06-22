const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const PORT = Number(process.env.PORT || 3000);
const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, "public");
const DATA_DIR = path.join(ROOT, "data");
const ARTIFACT_DIR = path.join(DATA_DIR, "artifacts");
const DB_PATH = path.join(DATA_DIR, "attestations.json");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon"
};

function ensureData() {
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
  if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, JSON.stringify(seedAttestations(), null, 2));
  }
}

function readDb() {
  ensureData();
  return JSON.parse(fs.readFileSync(DB_PATH, "utf8"));
}

function writeDb(records) {
  ensureData();
  fs.writeFileSync(DB_PATH, JSON.stringify(records, null, 2));
}

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
  const issuer = payload.issuer || "dev-local-issuer";
  const level = payload.attestationLevel || "self";
  const createdAt = nowIso();
  const idMaterial = [outputHash, inputHash, metadataHash, issuer, createdAt].join(":");
  const attestationId = sha256(idMaterial);
  const displayId = shortId(attestationId);
  const storageCid = `zg://prooftrace/local/${attestationId.slice(2, 18)}`;

  const artifact = {
    attestationId,
    input,
    output,
    metadata,
    createdAt
  };
  fs.writeFileSync(path.join(ARTIFACT_DIR, `${attestationId}.json`), JSON.stringify(artifact, null, 2));

  return {
    attestationId,
    displayId,
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
    storageCid,
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

function sendJson(res, status, body) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body, null, 2));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 2_000_000) {
        reject(new Error("Request body too large"));
        req.destroy();
      }
    });
    req.on("end", () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(error);
      }
    });
  });
}

async function handleApi(req, res, url) {
  if (req.method === "GET" && url.pathname === "/api/attestations") {
    const records = readDb().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return sendJson(res, 200, { records });
  }

  if (req.method === "GET" && url.pathname.startsWith("/api/attestations/")) {
    const id = decodeURIComponent(url.pathname.replace("/api/attestations/", ""));
    const record = readDb().find((item) => item.attestationId === id || item.displayId === id);
    return record ? sendJson(res, 200, { record }) : sendJson(res, 404, { error: "Attestation not found" });
  }

  if (req.method === "POST" && url.pathname === "/api/attestations") {
    const payload = await readBody(req);
    const record = createAttestation(payload);
    const records = readDb();
    records.push(record);
    writeDb(records);
    return sendJson(res, 201, { record });
  }

  if (req.method === "POST" && url.pathname === "/api/verify") {
    const payload = await readBody(req);
    const records = readDb();
    const record = records.find((item) => item.attestationId === payload.attestationId || item.displayId === payload.attestationId);
    if (!record) return sendJson(res, 404, { ok: false, error: "Attestation not found" });

    const computedOutputHash = payload.output ? sha256(payload.output) : payload.outputHash;
    const hashMatches = computedOutputHash ? computedOutputHash === record.outputHash : true;
    const ok = hashMatches && !record.revoked;
    return sendJson(res, 200, {
      ok,
      hashMatches,
      revoked: record.revoked,
      computedOutputHash,
      expectedOutputHash: record.outputHash,
      record
    });
  }

  if (req.method === "POST" && url.pathname === "/api/revoke") {
    const payload = await readBody(req);
    const records = readDb();
    const index = records.findIndex((item) => item.attestationId === payload.attestationId);
    if (index === -1) return sendJson(res, 404, { error: "Attestation not found" });
    records[index].revoked = true;
    records[index].revokedAt = nowIso();
    records[index].status = "Revoked";
    writeDb(records);
    return sendJson(res, 200, { record: records[index] });
  }

  return sendJson(res, 404, { error: "Unknown API route" });
}

function serveStatic(req, res, url) {
  const requested = url.pathname === "/" ? "/index.html" : decodeURIComponent(url.pathname);
  const resolved = path.normalize(path.join(PUBLIC_DIR, requested));
  if (!resolved.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    return res.end("Forbidden");
  }

  fs.readFile(resolved, (error, content) => {
    if (error) {
      res.writeHead(404);
      return res.end("Not found");
    }
    res.writeHead(200, { "content-type": MIME[path.extname(resolved)] || "application/octet-stream" });
    res.end(content);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  try {
    if (url.pathname.startsWith("/api/")) {
      await handleApi(req, res, url);
    } else {
      serveStatic(req, res, url);
    }
  } catch (error) {
    sendJson(res, 500, { error: error.message });
  }
});

ensureData();
server.listen(PORT, () => {
  console.log(`ProofTrace running at http://localhost:${PORT}`);
});
