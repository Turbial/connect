import { useState } from "react";
import { callTool } from "../api";
import { Card } from "../components/Card";

export function Content({ onError }: { onError: (msg: string) => void }) {
  const [queueResult, setQueueResult] = useState("");
  const [caption, setCaption] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");
  const [mediaType, setMediaType] = useState("image");
  const [platforms, setPlatforms] = useState("");
  const [postNowResult, setPostNowResult] = useState("");
  const [performance, setPerformance] = useState<any>(null);
  const [trending, setTrending] = useState<any[] | null>(null);
  const [calendar, setCalendar] = useState<any[] | null>(null);
  const [postStatus, setPostStatus] = useState<any[] | null>(null);
  const [draftId, setDraftId] = useState("");
  const [draftScore, setDraftScore] = useState<any>(null);

  async function queueContent() {
    onError("");
    try {
      const result = await callTool("queue_content");
      setQueueResult(JSON.stringify(result));
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
      setPostNowResult(JSON.stringify(result.output ?? result));
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    }
  }

  async function analyzePerformance() {
    onError("");
    try {
      const { output } = await callTool<any>("analyze_content_performance");
      setPerformance(output);
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    }
  }

  async function flagTrending() {
    onError("");
    try {
      const { output } = await callTool<any[]>("flag_trending_content");
      setTrending((output || []).filter((p: any) => p.trending));
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

  async function loadPostStatus() {
    onError("");
    try {
      const { output } = await callTool<any[]>("get_post_status");
      setPostStatus(output);
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    }
  }

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

      <Card title="Trending content">
        <button onClick={flagTrending}>Check what's trending</button>
        {trending && (trending.length === 0 ? (
          <p className="muted">Nothing trending above your recent average right now.</p>
        ) : (
          <ul>
            {trending.map((p: any, i: number) => (
              <li key={i}>"{p.caption.slice(0, 60)}" — score climbing at {p.velocity.toFixed(1)}/hr (current score {Math.round(p.currentScore)}).</li>
            ))}
          </ul>
        ))}
      </Card>

      <Card title="Content calendar" hint="Everything queued, approved, or edited but not yet posted.">
        <button onClick={loadCalendar}>Load calendar</button>
        {calendar && (!calendar.length ? "Nothing queued." : (
          <table>
            {calendar.map((e: any, i: number) => (
              <tr key={i}>
                <td>{e.status}</td>
                <td>{e.platforms.join(", ")}</td>
                <td>{e.caption.slice(0, 60)}</td>
                <td>{e.createdAt}</td>
              </tr>
            ))}
          </table>
        ))}
      </Card>

      <Card title="Published posts" hint="What actually went out to each platform — real post id/link on success, the real error on failure.">
        <button onClick={loadPostStatus}>Load post status</button>
        {postStatus && (!postStatus.length ? "Nothing posted yet." : (
          <table>
            <tr><th>Platform</th><th>Status</th><th>Caption</th><th>Posted at</th></tr>
            {postStatus.map((e: any, i: number) => (
              <tr key={i}>
                <td>{e.platform}</td>
                <td>
                  {e.status === "posted" ? (
                    e.link ? <a href={e.link} target="_blank" rel="noopener noreferrer">posted</a> : `posted (${e.platformPostId ?? ""})`
                  ) : (
                    <span className="error-text">failed: {e.error ?? ""}</span>
                  )}
                </td>
                <td>{e.caption.slice(0, 60)}</td>
                <td>{e.postedAt ?? ""}</td>
              </tr>
            ))}
          </table>
        ))}
      </Card>

      <Card title="Predict draft score">
        <div className="row">
          <input type="text" placeholder="Content item ID" value={draftId} onChange={(e) => setDraftId(e.target.value)} />
        </div>
        <button onClick={predictDraftScore}>Predict score</button>
        {draftScore && <div><strong>{draftScore.score}</strong> / 100 — {draftScore.reason}</div>}
      </Card>
    </div>
  );
}
