const state = {
  apiKey: localStorage.getItem("connect_api_key") || "",
  businessId: localStorage.getItem("connect_business_id") || "",
};

const el = (id) => document.getElementById(id);

el("apiKey").value = state.apiKey;
el("businessId").value = state.businessId;

function showError(message) {
  const box = el("error");
  box.textContent = message;
  box.hidden = !message;
}

async function callTool(name, { dryRun = false, ...input } = {}) {
  const res = await fetch(`/tools/${name}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${state.apiKey}`,
    },
    body: JSON.stringify({ businessId: state.businessId, dryRun, ...input }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = body?.diagnosis?.reason || body?.error || `Request failed (${res.status})`;
    throw new Error(message);
  }
  return body;
}

async function getCredentialFields(platform) {
  const res = await fetch(`/platforms/${platform}/credential-fields`, {
    headers: { Authorization: `Bearer ${state.apiKey}` },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.error || `Request failed (${res.status})`);
  return body.fields;
}

function renderScore(score) {
  if (!score) return el("scoreCard").textContent = "No score computed yet.";
  const drivers = (score.drivers || [])
    .map((d) => `<li>${d.label ?? d.driver ?? JSON.stringify(d)} — ${d.impact ?? ""}</li>`)
    .join("");
  el("scoreCard").innerHTML = `
    <div><strong>${score.score ?? "—"}</strong> / 100${score.trend ? ` (${score.trend})` : ""}</div>
    ${drivers ? `<ul>${drivers}</ul>` : ""}
    ${score.nextBestFix ? `<p><em>Next best fix:</em> ${score.nextBestFix}</p>` : ""}
  `;
}

function statusTag(status, actionRequired) {
  const cls = actionRequired ? "bad" : status === "verified" ? "ok" : "warn";
  return `<span class="tag ${cls}">${status}</span>`;
}

function renderConnections(connections) {
  if (!connections || connections.length === 0) return el("connectionsCard").textContent = "No connections yet.";
  const rows = connections
    .map((c) => `<tr><td>${c.platform}</td><td>${statusTag(c.status, c.actionRequired)}</td></tr>`)
    .join("");
  el("connectionsCard").innerHTML = `<table>${rows}</table>`;
}

function renderApprovals(approvals) {
  if (!approvals || approvals.length === 0) return el("approvalsCard").textContent = "Nothing pending.";
  const rows = approvals
    .map((a) => `<tr><td>${a.channel}</td><td>${a.sentAt}</td></tr>`)
    .join("");
  el("approvalsCard").innerHTML = `<table>${rows}</table>`;
}

function renderBoosts(boosts) {
  if (!boosts || boosts.length === 0) return el("boostsCard").textContent = "No pending boosts.";
  el("boostsCard").innerHTML = `<ul>${boosts.map((b) => `<li>${JSON.stringify(b)}</li>`).join("")}</ul>`;
}

function renderReviews(reviews) {
  if (!reviews || reviews.length === 0) return el("reviewsCard").textContent = "None unresolved.";
  const rows = reviews
    .map((r) => `<tr><td>${r.rating ?? "—"}</td><td>${r.customerName ?? "anonymous"}</td><td>${r.text ?? ""}</td></tr>`)
    .join("");
  el("reviewsCard").innerHTML = `<table>${rows}</table>`;
}

function renderActions(actions) {
  if (!actions || actions.length === 0) return el("actionsCard").textContent = "No recent activity.";
  const rows = actions
    .map((a) => `<tr><td>${a.intent ?? a.tool}</td><td>${a.status}</td><td>${a.created_at ?? ""}</td></tr>`)
    .join("");
  el("actionsCard").innerHTML = `<table>${rows}</table>`;
}

async function loadSnapshot() {
  showError("");
  try {
    const { output } = await callTool("get_operator_snapshot");
    renderScore(output.visibilityScore);
    renderConnections(output.connections);
    renderApprovals(output.pendingApprovals);
    renderBoosts(output.pendingBoosts);
    renderReviews(output.unresolvedReviews);
    renderActions(output.recentActions);
    el("app").hidden = false;
  } catch (err) {
    showError(err.message);
  }
}

el("loadBtn").addEventListener("click", () => {
  state.apiKey = el("apiKey").value.trim();
  state.businessId = el("businessId").value.trim();
  localStorage.setItem("connect_api_key", state.apiKey);
  localStorage.setItem("connect_business_id", state.businessId);
  if (!state.apiKey || !state.businessId) {
    showError("Enter both an API key and a business ID.");
    return;
  }
  loadSnapshot();
});

el("runAuditBtn").addEventListener("click", async () => {
  showError("");
  try {
    const { output } = await callTool("run_visibility_audit");
    renderScore(output);
  } catch (err) {
    showError(err.message);
  }
});

el("proposeBoostBtn").addEventListener("click", async () => {
  showError("");
  try {
    await callTool("propose_boost");
    await loadSnapshot();
  } catch (err) {
    showError(err.message);
  }
});

el("queueContentBtn").addEventListener("click", async () => {
  showError("");
  try {
    const result = await callTool("queue_content");
    el("queueResult").textContent = JSON.stringify(result);
  } catch (err) {
    showError(err.message);
  }
});

el("lookupFieldsBtn").addEventListener("click", async () => {
  showError("");
  const platform = el("platformInput").value.trim();
  if (!platform) return;
  try {
    const fields = await getCredentialFields(platform);
    el("credentialFields").innerHTML = fields
      .map((f) => `<div class="row"><label for="field-${f}">${f}</label><input id="field-${f}" type="password" data-field="${f}" /></div>`)
      .join("");
    el("saveCredentialsBtn").hidden = false;
  } catch (err) {
    showError(err.message);
  }
});

el("saveCredentialsBtn").addEventListener("click", async () => {
  showError("");
  const platform = el("platformInput").value.trim();
  const values = {};
  document.querySelectorAll("#credentialFields [data-field]").forEach((input) => {
    if (input.value) values[input.dataset.field] = input.value;
  });
  try {
    const result = await callTool("set_platform_credentials", { platform, values });
    el("credentialsResult").textContent = JSON.stringify(result.output ?? result);
  } catch (err) {
    showError(err.message);
  }
});

if (state.apiKey && state.businessId) {
  loadSnapshot();
}
