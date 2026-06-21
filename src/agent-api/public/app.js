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

function renderPerformanceAnalysis(analysis) {
  const insightRows = (analysis.insights || [])
    .filter((i) => i.significant)
    .map((i) => `<li>${i.summary}</li>`)
    .join("");
  el("performanceCard").innerHTML = `
    <p>${analysis.recommendation}</p>
    ${insightRows ? `<ul>${insightRows}</ul>` : ""}
    <p class="muted">${analysis.topPerformers.length} top performer(s), ${analysis.underPerformers.length} underperformer(s) compared.</p>
  `;
}

el("analyzePerformanceBtn").addEventListener("click", async () => {
  showError("");
  try {
    const { output } = await callTool("analyze_content_performance");
    renderPerformanceAnalysis(output);
  } catch (err) {
    showError(err.message);
  }
});

function renderTrendingContent(posts) {
  const trending = (posts || []).filter((p) => p.trending);
  if (trending.length === 0) {
    el("trendingCard").innerHTML = `<p class="muted">Nothing trending above your recent average right now.</p>`;
    return;
  }
  const rows = trending
    .map((p) => `<li>"${p.caption.slice(0, 60)}" — score climbing at ${p.velocity.toFixed(1)}/hr (current score ${Math.round(p.currentScore)}).</li>`)
    .join("");
  el("trendingCard").innerHTML = `<ul>${rows}</ul>`;
}

el("flagTrendingBtn").addEventListener("click", async () => {
  showError("");
  try {
    const { output } = await callTool("flag_trending_content");
    renderTrendingContent(output);
  } catch (err) {
    showError(err.message);
  }
});

el("runSeoAuditBtn").addEventListener("click", async () => {
  showError("");
  try {
    const { output } = await callTool("run_seo_audit");
    const issues = (output.issues || []).map((i) => `<li>${i}</li>`).join("");
    el("seoAuditCard").innerHTML = `<div><strong>${output.score}</strong> / 100</div>${issues ? `<ul>${issues}</ul>` : ""}`;
  } catch (err) {
    showError(err.message);
  }
});

el("addCompetitorBtn").addEventListener("click", async () => {
  showError("");
  const name = el("competitorName").value.trim();
  if (!name) return;
  try {
    await callTool("add_competitor", { name, gbpPlaceId: el("competitorGbpPlaceId").value.trim() || undefined });
    el("competitorsResult").textContent = `Added competitor "${name}".`;
  } catch (err) {
    showError(err.message);
  }
});

el("captureCompetitorSnapshotsBtn").addEventListener("click", async () => {
  showError("");
  try {
    await callTool("capture_competitor_snapshots");
    el("competitorsResult").textContent = "Captured fresh competitor snapshots.";
  } catch (err) {
    showError(err.message);
  }
});

el("trackRankBtn").addEventListener("click", async () => {
  showError("");
  try {
    const keyword = el("rankKeyword").value.trim() || undefined;
    const { output } = await callTool("track_rank", { keyword });
    el("rankResult").textContent = output.rank === null ? "Not found in results." : `Rank: #${output.rank}`;
  } catch (err) {
    showError(err.message);
  }
});

el("captureSentimentTrendBtn").addEventListener("click", async () => {
  showError("");
  try {
    await callTool("capture_sentiment_trend");
    el("reputationResult").textContent = "Captured a fresh sentiment-trend snapshot.";
  } catch (err) {
    showError(err.message);
  }
});

el("checkDuplicateListingsBtn").addEventListener("click", async () => {
  showError("");
  try {
    await callTool("check_duplicate_listings");
    el("reputationResult").textContent = "Checked for duplicate listings — see recent agent actions for results.";
  } catch (err) {
    showError(err.message);
  }
});

el("syncListingInfoBtn").addEventListener("click", async () => {
  showError("");
  try {
    await callTool("sync_listing_info");
    el("syncListingResult").textContent = "Synced listing info to connected platforms.";
  } catch (err) {
    showError(err.message);
  }
});

function renderPlatformBreakdown(entries) {
  if (!entries || entries.length === 0) return el("platformBreakdownCard").textContent = "No posted content yet.";
  const rows = entries
    .map((e) => `<tr><td>${e.platform}</td><td>${e.postCount}</td><td>${e.avgScore.toFixed(1)}</td><td>${e.totalViews}</td><td>${e.totalClicks}</td><td>${e.totalEngagement}</td></tr>`)
    .join("");
  el("platformBreakdownCard").innerHTML = `<table><tr><th>Platform</th><th>Posts</th><th>Avg score</th><th>Views</th><th>Clicks</th><th>Engagement</th></tr>${rows}</table>`;
}

el("loadPlatformBreakdownBtn").addEventListener("click", async () => {
  showError("");
  try {
    const { output } = await callTool("get_platform_breakdown");
    renderPlatformBreakdown(output);
  } catch (err) {
    showError(err.message);
  }
});

function renderCalendar(entries) {
  if (!entries || entries.length === 0) return el("calendarCard").textContent = "Nothing queued.";
  const rows = entries
    .map((e) => `<tr><td>${e.status}</td><td>${e.platforms.join(", ")}</td><td>${e.caption.slice(0, 60)}</td><td>${e.createdAt}</td></tr>`)
    .join("");
  el("calendarCard").innerHTML = `<table>${rows}</table>`;
}

el("loadCalendarBtn").addEventListener("click", async () => {
  showError("");
  try {
    const { output } = await callTool("get_content_calendar");
    renderCalendar(output);
  } catch (err) {
    showError(err.message);
  }
});

el("predictDraftScoreBtn").addEventListener("click", async () => {
  showError("");
  const contentItemId = el("draftContentItemId").value.trim();
  if (!contentItemId) {
    showError("Enter a content item ID first.");
    return;
  }
  try {
    const { output } = await callTool("predict_draft_score", { contentItemId });
    el("draftScoreResult").innerHTML = `<strong>${output.score}</strong> / 100 — ${output.reason}`;
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

function showOnboardingError(message) {
  const box = el("onboardingError");
  box.textContent = message;
  box.hidden = !message;
}

async function apiFetch(path, { method = "GET", apiKey, body } = {}) {
  const headers = { Authorization: `Bearer ${apiKey}` };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const res = await fetch(path, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
  const responseBody = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(responseBody?.error || `Request failed (${res.status})`);
  return responseBody;
}

el("createBusinessBtn").addEventListener("click", async () => {
  showOnboardingError("");
  const name = el("newBusinessName").value.trim();
  if (!name) {
    showOnboardingError("Business name is required.");
    return;
  }
  const apiKey = el("apiKey").value.trim();
  if (!apiKey) {
    showOnboardingError("Enter an Agent API key above first.");
    return;
  }
  try {
    const body = await apiFetch("/businesses", {
      method: "POST",
      apiKey,
      body: {
        name,
        location: el("newBusinessLocation").value.trim() || undefined,
        phone: el("newBusinessPhone").value.trim() || undefined,
        ownerPhone: el("newBusinessOwnerPhone").value.trim() || undefined,
        ownerEmail: el("newBusinessOwnerEmail").value.trim() || undefined,
        ownerMobile: el("newBusinessOwnerMobile").value.trim() || undefined,
      },
    });

    state.apiKey = apiKey;
    state.businessId = body.business.id;
    localStorage.setItem("connect_api_key", apiKey);
    localStorage.setItem("connect_business_id", state.businessId);
    el("businessId").value = state.businessId;
    el("createBusinessResult").textContent = `Created "${body.business.name}" — id ${body.business.id}. Loaded below; add platform credentials next.`;
    await loadSnapshot();
  } catch (err) {
    showOnboardingError(err.message);
  }
});

el("sendVerificationBtn").addEventListener("click", async () => {
  showOnboardingError("");
  const apiKey = el("apiKey").value.trim();
  const businessId = el("businessId").value.trim();
  if (!apiKey || !businessId) {
    showOnboardingError("Enter both an API key and a business ID above first.");
    return;
  }
  try {
    await apiFetch(`/businesses/${businessId}/owner-verification/send`, { method: "POST", apiKey });
    el("verificationResult").textContent = "Code sent — check the owner's phone.";
  } catch (err) {
    showOnboardingError(err.message);
  }
});

el("confirmVerificationBtn").addEventListener("click", async () => {
  showOnboardingError("");
  const apiKey = el("apiKey").value.trim();
  const businessId = el("businessId").value.trim();
  const code = el("verificationCode").value.trim();
  if (!apiKey || !businessId || !code) {
    showOnboardingError("Enter an API key, business ID, and code first.");
    return;
  }
  try {
    const body = await apiFetch(`/businesses/${businessId}/owner-verification/confirm`, {
      method: "POST",
      apiKey,
      body: { code },
    });
    el("verificationResult").textContent = body.verified ? "Verified." : "Incorrect or expired code.";
  } catch (err) {
    showOnboardingError(err.message);
  }
});

if (state.apiKey && state.businessId) {
  loadSnapshot();
}
