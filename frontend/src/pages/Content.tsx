import { useState } from "react";
import { callTool } from "../api";
import { Card } from "../components/Card";
import { Tabs } from "../components/Tabs";
import { DataTable } from "../components/DataTable";
import { EmptyState } from "../components/EmptyState";
import { FormField } from "../components/FormField";
import { Tag } from "../components/Tag";
import { useTab } from "../useTab";

const TABS = [
  { key: "calendar", label: "Calendar" },
  { key: "library", label: "Library" },
  { key: "approvals", label: "Approvals" },
  { key: "published", label: "Published" },
  { key: "performance", label: "Performance" },
  { key: "trending", label: "Trending" },
  { key: "predictor", label: "Predictor" },
];

function CalendarTab({ onError }: { onError: (msg: string) => void }) {
  const [queueResult, setQueueResult] = useState("");
  const [caption, setCaption] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");
  const [mediaType, setMediaType] = useState("image");
  const [platforms, setPlatforms] = useState("");
  const [postNowResult, setPostNowResult] = useState("");
  const [calendar, setCalendar] = useState<any[] | null>(null);

  async function queueContent() {
    onError("");
    try {
      const result = await callTool<any>("queue_content");
      const count = result?.output?.queued ?? result?.output?.length ?? "—";
      setQueueResult(`Queued ${count} item${count === 1 ? "" : "s"} for this week.`);
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    }
  }

  async function postNow() {
    onError("");
    try {
      const result = await callTool<any>("post_content_now", {
        caption,
        mediaUrl: mediaUrl || undefined,
        mediaType,
        platforms: platforms.split(",").map((p) => p.trim().toLowerCase()).filter(Boolean),
      });
      const out = result.output ?? result;
      const posted = Array.isArray(out) ? out : out?.results ?? [];
      const succeeded = posted.filter((r: any) => !r.error).length;
      const failed = posted.filter((r: any) => r.error).length;
      setPostNowResult(
        posted.length > 0
          ? `Posted to ${succeeded} platform${succeeded !== 1 ? "s" : ""}${failed > 0 ? `, ${failed} failed` : ""}.`
          : "Posted."
      );
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    }
  }

  async function loadCalendar() {
    onError("");
    try {
      const { output } = await callTool<any[]>("get_content_calendar");
      setCalendar(output);
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <div className="grid">
      <Card title="Content">
        <button onClick={queueContent}>Queue this week's content</button>
        <div>{queueResult}</div>
      </Card>

      <Card title="Post now" hint="Posts immediately to the listed platforms for real — skips queue_content and owner approval entirely.">
        <div className="row">
          <textarea placeholder="Caption" rows={3} value={caption} onChange={(e) => setCaption(e.target.value)} />
        </div>
        <div className="row">
          <input type="text" placeholder="Media URL (optional)" value={mediaUrl} onChange={(e) => setMediaUrl(e.target.value)} />
          <select value={mediaType} onChange={(e) => setMediaType(e.target.value)}>
            <option value="image">Image</option>
            <option value="video">Video</option>
          </select>
        </div>
        <div className="row">
          <input
            type="text"
            placeholder="Platforms, comma-separated, e.g. instagram, facebook"
            value={platforms}
            onChange={(e) => setPlatforms(e.target.value)}
          />
        </div>
        <button onClick={postNow}>Post now</button>
        <div>{postNowResult}</div>
      </Card>

      <Card title="Content calendar" hint="Everything queued, approved, or edited but not yet posted.">
        <button onClick={loadCalendar}>Load calendar</button>
        {calendar && (
          <DataTable
            emptyMessage="Nothing queued."
            rows={calendar}
            columns={[
              { key: "status", label: "Status" },
              { key: "platforms", label: "Platforms", render: (e: any) => e.platforms.join(", ") },
              { key: "caption", label: "Caption", render: (e: any) => e.caption.slice(0, 60) },
              { key: "createdAt", label: "Created at" },
            ]}
          />
        )}
      </Card>
    </div>
  );
}

function LibraryTab({ onError }: { onError: (msg: string) => void }) {
  const [items, setItems] = useState<any[] | null>(null);
  const [caption, setCaption] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");
  const [mediaType, setMediaType] = useState("image");
  const [platforms, setPlatforms] = useState("");
  const [addResult, setAddResult] = useState("");
  const [uploading, setUploading] = useState(false);

  async function load() {
    onError("");
    try {
      const { output } = await callTool<any[]>("get_content_library");
      setItems(output ?? []);
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleFileUpload(file: File) {
    onError("");
    setUploading(true);
    try {
      const res = await fetch("/upload", {
        method: "POST",
        headers: {
          "Content-Type": file.type,
          Authorization: `Bearer ${(await import("../api")).state.apiKey}`,
        },
        body: file,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error ?? "Upload failed");
      }
      const { url } = await res.json();
      setMediaUrl(url);
      setMediaType(file.type.startsWith("video/") ? "video" : "image");
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    } finally {
      setUploading(false);
    }
  }

  async function add() {
    onError("");
    setAddResult("");
    if (!caption.trim()) { onError("Caption is required."); return; }
    const platformList = platforms.split(",").map((p) => p.trim().toLowerCase()).filter(Boolean);
    if (platformList.length === 0) { onError("Enter at least one platform."); return; }
    try {
      await callTool("add_to_library", {
        caption: caption.trim(),
        platforms: platformList,
        mediaUrl: mediaUrl.trim() || undefined,
        mediaType,
      });
      setAddResult("Added to library.");
      setCaption(""); setMediaUrl(""); setPlatforms("");
      await load();
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    }
  }

  async function remove(itemId: string) {
    onError("");
    try {
      await callTool("remove_from_library", { itemId });
      setItems((prev) => (prev ?? []).filter((i) => i.id !== itemId));
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <div className="grid">
      <Card title="Content library" hint="Reusable captions and media shared across all locations in your org.">
        <button onClick={load}>Load library</button>
        {items !== null && (
          <DataTable
            emptyMessage="Library is empty — add your first item below."
            rows={items}
            columns={[
              { key: "caption", label: "Caption", render: (i: any) => i.caption.slice(0, 80) },
              { key: "platforms", label: "Platforms", render: (i: any) => (i.platforms ?? []).join(", ") },
              {
                key: "mediaType",
                label: "Media",
                render: (i: any) => i.mediaUrl
                  ? i.mediaType === "video"
                    ? <a href={i.mediaUrl} target="_blank" rel="noreferrer" className="muted">video</a>
                    : <img src={i.mediaUrl} alt="" style={{ height: 36, borderRadius: 4, objectFit: "cover" }} />
                  : <span className="muted">—</span>,
              },
              { key: "createdAt", label: "Added", render: (i: any) => new Date(i.createdAt).toLocaleDateString() },
              {
                key: "actions",
                label: "",
                render: (i: any) => (
                  <button className="danger" onClick={() => remove(i.id)}>Remove</button>
                ),
              },
            ]}
          />
        )}
      </Card>

      <Card title="Add to library">
        <FormField label="Caption">
          <textarea rows={3} value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Caption text…" />
        </FormField>
        <FormField label="Platforms">
          <input type="text" placeholder="instagram, facebook, tiktok" value={platforms} onChange={(e) => setPlatforms(e.target.value)} />
        </FormField>
        <FormField label="Upload image / video">
          <input
            type="file"
            accept="image/*,video/*"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFileUpload(file);
            }}
          />
          {uploading && <span className="muted"><span className="spinner" />Uploading…</span>}
          {mediaUrl && !uploading && (
            <span className="muted" style={{ fontSize: "0.75rem", wordBreak: "break-all" }}>
              {mediaUrl.length > 60 ? mediaUrl.slice(0, 60) + "…" : mediaUrl}
            </span>
          )}
        </FormField>
        <div className="row">
          <FormField label="Or paste a URL">
            <input type="text" value={mediaUrl} onChange={(e) => setMediaUrl(e.target.value)} placeholder="https://…" />
          </FormField>
          <FormField label="Type">
            <select value={mediaType} onChange={(e) => setMediaType(e.target.value)}>
              <option value="image">Image</option>
              <option value="video">Video</option>
            </select>
          </FormField>
        </div>
        <button onClick={add}>Add to library</button>
        {addResult && <p className="muted">{addResult}</p>}
      </Card>
    </div>
  );
}

function ApprovalsTab({ onError }: { onError: (msg: string) => void }) {
  const [approvals, setApprovals] = useState<any[] | null>(null);
  const [actionState, setActionState] = useState<Record<string, "working" | "done_approve" | "done_reject">>({});

  async function load() {
    onError("");
    try {
      const { output } = await callTool<any[]>("get_pending_approvals");
      setApprovals(output);
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    }
  }

  async function act(contentItemId: string, tool: "approve_content" | "reject_content") {
    onError("");
    setActionState((p) => ({ ...p, [contentItemId]: "working" }));
    try {
      await callTool(tool, { contentItemId });
      setActionState((p) => ({ ...p, [contentItemId]: tool === "approve_content" ? "done_approve" : "done_reject" }));
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
      setActionState((p) => { const n = { ...p }; delete n[contentItemId]; return n; });
    }
  }

  return (
    <div className="grid">
      <Card title="Pending approvals" hint="Approve or reject content directly here — no SMS required.">
        <button onClick={load}>Load pending approvals</button>
        {approvals && (
          <DataTable
            emptyMessage="Nothing pending."
            rows={approvals}
            columns={[
              { key: "caption", label: "Content", render: (a: any) => a.caption ? a.caption.slice(0, 60) + (a.caption.length > 60 ? "…" : "") : <em className="muted">no caption</em> },
              { key: "channel", label: "Channel" },
              { key: "sentAt", label: "Sent at" },
              {
                key: "actions",
                label: "",
                render: (a: any) => {
                  const id = a.content_item_id ?? a.id;
                  const s = actionState[id];
                  if (s === "done_approve") return <Tag variant="ok">approved</Tag>;
                  if (s === "done_reject") return <Tag variant="bad">rejected</Tag>;
                  return (
                    <div className="row" style={{ margin: 0, gap: "0.4rem" }}>
                      <button disabled={s === "working"} onClick={() => act(id, "approve_content")}>
                        {s === "working" ? "…" : "Approve"}
                      </button>
                      <button className="danger" disabled={s === "working"} onClick={() => act(id, "reject_content")}>
                        {s === "working" ? "…" : "Reject"}
                      </button>
                    </div>
                  );
                },
              },
            ]}
          />
        )}
      </Card>
    </div>
  );
}

function PublishedTab({ onError }: { onError: (msg: string) => void }) {
  const [postStatus, setPostStatus] = useState<any[] | null>(null);

  async function loadPostStatus() {
    onError("");
    try {
      const { output } = await callTool<any[]>("get_post_status");
      setPostStatus(output);
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <div className="grid">
      <Card title="Published posts" hint="What actually went out to each platform — real post id/link on success, the real error on failure.">
        <button onClick={loadPostStatus}>Load post status</button>
        {postStatus && (
          <DataTable
            emptyMessage="Nothing posted yet."
            rows={postStatus}
            columns={[
              { key: "platform", label: "Platform" },
              {
                key: "status",
                label: "Status",
                render: (e: any) =>
                  e.status === "posted" ? (
                    e.link ? (
                      <a href={e.link} target="_blank" rel="noopener noreferrer">
                        posted
                      </a>
                    ) : (
                      `posted (${e.platformPostId ?? ""})`
                    )
                  ) : (
                    <Tag variant="bad">failed: {e.error ?? ""}</Tag>
                  ),
              },
              { key: "caption", label: "Caption", render: (e: any) => e.caption.slice(0, 60) },
              { key: "postedAt", label: "Posted at", render: (e: any) => e.postedAt ?? "" },
            ]}
          />
        )}
      </Card>
    </div>
  );
}

function PerformanceTab({ onError }: { onError: (msg: string) => void }) {
  const [performance, setPerformance] = useState<any>(null);

  async function analyzePerformance() {
    onError("");
    try {
      const { output } = await callTool<any>("analyze_content_performance");
      setPerformance(output);
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <div className="grid">
      <Card title="Content performance">
        <button onClick={analyzePerformance}>Analyze what's working</button>
        {performance && (
          <div>
            <p>{performance.recommendation}</p>
            {performance.insights?.filter((i: any) => i.significant).length > 0 && (
              <ul>
                {performance.insights.filter((i: any) => i.significant).map((i: any, idx: number) => (
                  <li key={idx}>{i.summary}</li>
                ))}
              </ul>
            )}
            <p className="muted">
              {performance.topPerformers.length} top performer(s), {performance.underPerformers.length} underperformer(s) compared.
            </p>
          </div>
        )}
      </Card>
    </div>
  );
}

function TrendingTab({ onError }: { onError: (msg: string) => void }) {
  const [trending, setTrending] = useState<any[] | null>(null);

  async function flagTrending() {
    onError("");
    try {
      const { output } = await callTool<any[]>("flag_trending_content");
      setTrending((output || []).filter((p: any) => p.trending));
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <div className="grid">
      <Card title="Trending content">
        <button onClick={flagTrending}>Check what's trending</button>
        {trending &&
          (trending.length === 0 ? (
            <EmptyState message="Nothing trending above your recent average right now." />
          ) : (
            <ul>
              {trending.map((p: any, i: number) => (
                <li key={i}>
                  "{p.caption.slice(0, 60)}" — score climbing at {p.velocity.toFixed(1)}/hr (current score {Math.round(p.currentScore)}).
                </li>
              ))}
            </ul>
          ))}
      </Card>
    </div>
  );
}

function PredictorTab({ onError }: { onError: (msg: string) => void }) {
  const [draftId, setDraftId] = useState("");
  const [draftScore, setDraftScore] = useState<any>(null);

  async function predictDraftScore() {
    onError("");
    if (!draftId.trim()) {
      onError("Enter a content item ID first.");
      return;
    }
    try {
      const { output } = await callTool<any>("predict_draft_score", { contentItemId: draftId.trim() });
      setDraftScore(output);
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <div className="grid">
      <Card title="Predict draft score">
        <FormField label="Content item ID">
          <input type="text" value={draftId} onChange={(e) => setDraftId(e.target.value)} />
        </FormField>
        <button onClick={predictDraftScore}>Predict score</button>
        {draftScore && (
          <div>
            <strong>{draftScore.score}</strong> / 100 — {draftScore.reason}
          </div>
        )}
      </Card>
    </div>
  );
}

export function Content({ onError }: { onError: (msg: string) => void }) {
  const [tab, setTab] = useTab("calendar");

  return (
    <div>
      <Tabs tabs={TABS} active={tab} onChange={setTab} />
      {tab === "calendar" && <CalendarTab onError={onError} />}
      {tab === "library" && <LibraryTab onError={onError} />}
      {tab === "approvals" && <ApprovalsTab onError={onError} />}
      {tab === "published" && <PublishedTab onError={onError} />}
      {tab === "performance" && <PerformanceTab onError={onError} />}
      {tab === "trending" && <TrendingTab onError={onError} />}
      {tab === "predictor" && <PredictorTab onError={onError} />}
    </div>
  );
}
