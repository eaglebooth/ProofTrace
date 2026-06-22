const state = {
  records: [],
  account: "",
};

const $ = (selector) => document.querySelector(selector);
const fmtDate = (iso) => new Intl.DateTimeFormat("en", {
  month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit"
}).format(new Date(iso));

function levelLabel(level) {
  if (level === "provider-TEE") return "TEE-backed";
  if (level === "reproducible") return "Reproducible";
  return "Self-attested";
}

function levelClass(level) {
  return String(level || "self").toLowerCase();
}

function iconFor(record) {
  const source = `${record.sourceType} ${record.modelName}`.toLowerCase();
  if (source.includes("0g")) return "0G";
  if (source.includes("openai") || source.includes("gpt")) return "OA";
  if (source.includes("mistral")) return "M";
  return "AI";
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: { "content-type": "application/json" },
    ...options
  });
  const json = await response.json();
  if (!response.ok) throw new Error(json.error || "Request failed");
  return json;
}

async function loadRecords() {
  const { records } = await api("/api/attestations");
  state.records = records;
  renderRecent();
  renderLedger();
  renderMetrics();
}

function renderRecent() {
  const rows = state.records.slice(0, 5).map((record) => `
    <div class="table-row">
      <div class="model-cell">
        <span class="model-icon">${iconFor(record)}</span>
        <div class="truncate">
          <strong>${escapeHtml(record.appName)}</strong>
          <div class="subtle">${escapeHtml(record.modelName)} / ${escapeHtml(record.modelVersion)}</div>
        </div>
      </div>
      <div><span>${fmtDate(record.createdAt)}</span></div>
      <div><span class="tag ${levelClass(record.trustLevel)}">${levelLabel(record.trustLevel)}</span></div>
      <div class="status-ok">${record.revoked ? "!" : "OK"}</div>
    </div>
  `).join("");

  $("#recentTable").innerHTML = `
    <div class="table-row header"><div>Model / Application</div><div>Created</div><div>Trust level</div><div>Status</div></div>
    ${rows}
  `;
}

function renderLedger() {
  const rows = state.records.map((record) => `
    <div class="ledger-row">
      <div class="truncate"><a href="#verify" data-fill-id="${record.attestationId}">${record.chain.txHash}</a></div>
      <div class="truncate"><a href="#verify" data-fill-id="${record.attestationId}">${record.displayId}</a></div>
      <div><span class="tag ${record.revoked ? "self" : "reproducible"}">${record.status}</span></div>
      <div>${record.chain.block.toLocaleString()}</div>
      <div>${fmtDate(record.createdAt)}</div>
    </div>
  `).join("");

  $("#ledgerTable").innerHTML = `
    <div class="ledger-row header"><div>Txn hash</div><div>Attestation ID</div><div>Event</div><div>Block</div><div>Time</div></div>
    ${rows}
  `;

  document.querySelectorAll("[data-fill-id]").forEach((link) => {
    link.addEventListener("click", () => {
      $("#verifyId").value = link.dataset.fillId;
      $("#verifyOutput").focus();
    });
  });
}

function renderMetrics() {
  const records = state.records;
  $("#metricTotal").textContent = records.length;
  $("#metricTee").textContent = records.filter((r) => r.trustLevel === "provider-TEE").length;
  $("#metricIssuers").textContent = new Set(records.map((r) => r.issuer)).size;
  $("#metricRevoked").textContent = records.filter((r) => r.revoked).length;
}

function escapeHtml(value) {
  return String(value || "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#039;"
  }[char]));
}

async function connectWallet() {
  const button = $("#connectWallet");
  if (!window.ethereum) {
    button.textContent = "No wallet";
    return;
  }
  const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
  state.account = accounts[0] || "";
  button.textContent = `${state.account.slice(0, 6)}...${state.account.slice(-4)}`;
}

async function signAttestation(payload) {
  if (!window.ethereum || !state.account) return { issuer: "dev-local-issuer", signature: "" };
  const typedData = {
    types: {
      EIP712Domain: [
        { name: "name", type: "string" },
        { name: "version", type: "string" }
      ],
      Attestation: [
        { name: "appName", type: "string" },
        { name: "modelName", type: "string" },
        { name: "attestationLevel", type: "string" },
        { name: "output", type: "string" }
      ]
    },
    primaryType: "Attestation",
    domain: { name: "ProofTrace", version: "1" },
    message: {
      appName: payload.appName,
      modelName: payload.modelName,
      attestationLevel: payload.attestationLevel,
      output: payload.output
    }
  };
  const signature = await window.ethereum.request({
    method: "eth_signTypedData_v4",
    params: [state.account, JSON.stringify(typedData)]
  });
  return { issuer: state.account, signature };
}

$("#connectWallet").addEventListener("click", connectWallet);
$("#refreshLedger").addEventListener("click", loadRecords);
document.querySelectorAll("[data-scroll]").forEach((button) => {
  button.addEventListener("click", () => document.querySelector(button.dataset.scroll).scrollIntoView());
});

$("#attestForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const payload = Object.fromEntries(form.entries());
  const result = $("#createResult");
  result.className = "result muted";
  result.textContent = "Creating commitment, storing artifact, and writing registry record...";
  try {
    const wallet = await signAttestation(payload);
    const { record } = await api("/api/attestations", {
      method: "POST",
      body: JSON.stringify({ ...payload, ...wallet })
    });
    result.className = "result good";
    result.innerHTML = `Created <strong>${record.displayId}</strong><br>Output hash: <span class="truncate">${record.outputHash}</span>`;
    $("#verifyId").value = record.attestationId;
    await loadRecords();
  } catch (error) {
    result.className = "result bad";
    result.textContent = error.message;
  }
});

$("#runVerify").addEventListener("click", async () => {
  const attestationId = $("#verifyId").value.trim();
  const output = $("#verifyOutput").value;
  const result = $("#verifyResult");
  if (!attestationId) {
    result.className = "result bad";
    result.textContent = "Enter an attestation ID first.";
    return;
  }
  result.className = "result muted";
  result.textContent = "Checking registry record...";
  try {
    const body = output.startsWith("0x") && output.length > 40
      ? { attestationId, outputHash: output }
      : { attestationId, output };
    const verification = await api("/api/verify", { method: "POST", body: JSON.stringify(body) });
    result.className = verification.ok ? "result good" : "result bad";
    result.innerHTML = verification.ok
      ? `Verified. Hash matches <strong>${verification.record.displayId}</strong><br>Trust level: ${levelLabel(verification.record.trustLevel)}`
      : `Verification failed. Expected ${verification.expectedOutputHash}`;
  } catch (error) {
    result.className = "result bad";
    result.textContent = error.message;
  }
});

loadRecords();
