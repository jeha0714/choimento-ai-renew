import { useState, useEffect } from "react";

const LABELS = [
  "창업지원", "소상공인지원", "교육훈련", "R&D/연구",
  "채용/일자리", "공모전/경진대회", "행사/전시", "복지/생활지원",
  "주거지원", "공간/입주지원", "판로/마케팅/수출", "자금/금융지원",
];

const API = "";  // same origin
const BATCH_SIZE = 200;

async function api(path, opts = {}) {
  const pw = sessionStorage.getItem("review_pw") || "";
  const res = await fetch(`${API}${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      "x-review-password": pw,
      "x-admin-password": pw,
      ...(opts.headers || {}),
    },
  });
  return res.json();
}

export default function App() {
  const [phase, setPhase] = useState("login");
  const [password, setPassword] = useState("");
  const [errMsg, setErrMsg] = useState("");

  // 검수 데이터
  const [items, setItems] = useState([]);
  const [totalItems, setTotalItems] = useState(0);
  const [position, setPosition] = useState(0);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [loading, setLoading] = useState(false);

  // 검수 상태
  const [judgment, setJudgment] = useState(null);
  const [correctedLabels, setCorrectedLabels] = useState([]);
  const [startTime, setStartTime] = useState(null);
  const [saving, setSaving] = useState(false);

  // 통계
  const [agreeCount, setAgreeCount] = useState(0);
  const [disagreeCount, setDisagreeCount] = useState(0);

  // 이전으로 되돌아가기용 히스토리
  const [history, setHistory] = useState([]);

  // ── 로그인 ──
  const handleLogin = async () => {
    setErrMsg("");
    const res = await fetch(`${API}/api/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    const data = await res.json();
    if (data.success) {
      sessionStorage.setItem("review_pw", password);
      setPhase("loading");
    } else {
      setErrMsg(data.error || "로그인 실패");
    }
  };

  // ── 데이터 로드 ──
  useEffect(() => {
    if (phase !== "loading") return;
    (async () => {
      setLoading(true);
      try {
        const prog = await api("/api/progress");
        setTotalItems(prog.total_items);
        setPosition(prog.position);
        setAgreeCount(prog.agree);
        setDisagreeCount(prog.disagree);

        if (prog.position >= prog.total_items && prog.total_items > 0) {
          setPhase("complete");
        } else {
          const res = await api(`/api/items?offset=${prog.position}&limit=${BATCH_SIZE}`);
          setItems(res.items || []);
          setCurrentIdx(0);
          setPhase("review");
          setStartTime(Date.now());
        }
      } catch (e) {
        setErrMsg("데이터 로드 실패: " + e.message);
        setPhase("login");
      }
      setLoading(false);
    })();
  }, [phase]);

  // ── 추가 배치 로드 ──
  const loadMoreItems = async (offset) => {
    const res = await api(`/api/items?offset=${offset}&limit=${BATCH_SIZE}`);
    const newItems = res.items || [];
    if (newItems.length > 0) {
      setItems(newItems);
      setCurrentIdx(0);
      setStartTime(Date.now());
    } else {
      setPhase("complete");
    }
  };

  // ── 판단 제출 ──
  const handleJudge = async (type) => {
    const item = items[currentIdx];
    if (!item) return;

    setSaving(true);
    const dur = startTime ? Math.round((Date.now() - startTime) / 100) / 10 : 0;

    const res = await api("/api/result", {
      method: "POST",
      body: JSON.stringify({
        item_id: item.id,
        judgment: type,
        corrected_labels: type === "disagree" ? correctedLabels : null,
        duration: dur,
      }),
    });

    setSaving(false);

    if (!res.success) return;

    // 서버에서 커서 +1 완료, 클라이언트도 동기화
    if (type === "agree") setAgreeCount(prev => prev + 1);
    else setDisagreeCount(prev => prev + 1);
    const newPosition = position + 1;
    setPosition(newPosition);

    // 히스토리에 추가
    setHistory(prev => [...prev, { idx: currentIdx, item_id: item.id, judgment: type }]);

    // 다음 항목
    setJudgment(null);
    setCorrectedLabels([]);

    const nextIdx = currentIdx + 1;
    if (nextIdx < items.length) {
      setCurrentIdx(nextIdx);
      setStartTime(Date.now());
    } else if (newPosition < totalItems) {
      setHistory([]);
      await loadMoreItems(newPosition);
    } else {
      setPhase("complete");
    }
  };

  // ── 이전으로 되돌아가기 ──
  const handleGoBack = async () => {
    setSaving(true);

    if (history.length > 0) {
      const prev = history[history.length - 1];

      await api("/api/result", {
        method: "DELETE",
        body: JSON.stringify({ item_id: prev.item_id }),
      });

      if (prev.judgment === "agree") setAgreeCount(c => Math.max(0, c - 1));
      else setDisagreeCount(c => Math.max(0, c - 1));
      setPosition(p => Math.max(0, p - 1));

      setHistory(h => h.slice(0, -1));
      setCurrentIdx(prev.idx);
    } else {
      // 이전 세션 — 서버에서 마지막 검수 항목 조회 후 삭제
      const last = await api("/api/result");
      if (last.error) { setSaving(false); return; }

      await api("/api/result", {
        method: "DELETE",
        body: JSON.stringify({ item_id: last.item.id }),
      });

      if (last.judgment === "agree") setAgreeCount(c => Math.max(0, c - 1));
      else setDisagreeCount(c => Math.max(0, c - 1));
      setPosition(p => Math.max(0, p - 1));

      setItems(prev => [last.item, ...prev]);
      setCurrentIdx(0);
    }

    setJudgment(null);
    setCorrectedLabels([]);
    setStartTime(Date.now());
    setSaving(false);
  };

  // ── 나가기 ──
  const handleExit = () => {
    sessionStorage.removeItem("review_pw");
    setPhase("login");
    setPassword("");
    setHistory([]);
  };

  const toggleCorrectedLabel = (label) => {
    setCorrectedLabels(prev => prev.includes(label) ? prev.filter(l => l !== label) : [...prev, label]);
  };

  // ── 스타일 ──
  const styles = {
    container: { maxWidth: 720, margin: "0 auto", padding: "24px 16px", fontFamily: "'Pretendard', -apple-system, sans-serif", color: "#1a1a2e" },
    card: { background: "#fff", borderRadius: 12, padding: 24, boxShadow: "0 2px 12px rgba(0,0,0,0.08)", marginBottom: 16 },
    title: { fontSize: 22, fontWeight: 700, marginBottom: 8, color: "#1a1a2e" },
    subtitle: { fontSize: 14, color: "#666", marginBottom: 24 },
    input: { width: "100%", padding: "10px 14px", borderRadius: 8, border: "1px solid #ddd", fontSize: 14, marginBottom: 12, boxSizing: "border-box" },
    btnPrimary: { padding: "10px 24px", borderRadius: 8, border: "none", background: "#4361ee", color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer" },
    btnSuccess: { padding: "12px 32px", borderRadius: 8, border: "none", background: "#2a9d8f", color: "#fff", fontSize: 16, fontWeight: 700, cursor: "pointer" },
    btnWarning: { padding: "12px 32px", borderRadius: 8, border: "none", background: "#e76f51", color: "#fff", fontSize: 16, fontWeight: 700, cursor: "pointer" },
    btnOutline: { padding: "10px 24px", borderRadius: 8, border: "2px solid #4361ee", background: "transparent", color: "#4361ee", fontSize: 14, fontWeight: 600, cursor: "pointer" },
    btnSmall: { padding: "6px 14px", borderRadius: 6, border: "1px solid #ddd", background: "#f8f9fa", color: "#555", fontSize: 12, fontWeight: 500, cursor: "pointer" },
    progress: { width: "100%", height: 8, background: "#e9ecef", borderRadius: 4, overflow: "hidden", marginBottom: 16 },
    progressBar: (pct) => ({ width: `${pct}%`, height: "100%", background: "linear-gradient(90deg, #4361ee, #3a86ff)", transition: "width 0.3s" }),
    labelChip: (active) => ({ display: "inline-block", padding: "6px 14px", borderRadius: 20, margin: 4, fontSize: 13, fontWeight: 500, cursor: "pointer", background: active ? "#4361ee" : "#f1f3f5", color: active ? "#fff" : "#495057", border: active ? "2px solid #4361ee" : "2px solid transparent" }),
    aiLabel: { display: "inline-block", padding: "6px 14px", borderRadius: 20, margin: 4, fontSize: 13, fontWeight: 600, background: "#dbeafe", color: "#1e40af" },
    allZero: { display: "inline-block", padding: "6px 14px", borderRadius: 20, margin: 4, fontSize: 13, fontWeight: 600, background: "#f3f4f6", color: "#6b7280", fontStyle: "italic" },
    reason: { background: "#f8f9fa", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#555", marginTop: 12, lineHeight: 1.6 },
    titleText: { fontSize: 17, fontWeight: 600, lineHeight: 1.5, color: "#1a1a2e", wordBreak: "break-word" },
    stat: { textAlign: "center", padding: "8px 0" },
    statNum: { fontSize: 28, fontWeight: 700, color: "#4361ee" },
    statLabel: { fontSize: 12, color: "#888", marginTop: 2 },
    errBox: { background: "#fff5f5", border: "1px solid #e63946", borderRadius: 8, padding: "8px 12px", fontSize: 13, color: "#e63946", marginBottom: 12 },
  };

  if (phase === "login") {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <div style={styles.title}>AI 라벨링 검수 도구</div>
          <div style={styles.subtitle}>비밀번호를 입력하세요</div>
          {errMsg && <div style={styles.errBox}>{errMsg}</div>}
          <input style={styles.input} type="password" placeholder="비밀번호" value={password} onChange={(e) => { setPassword(e.target.value); setErrMsg(""); }} onKeyDown={(e) => e.key === "Enter" && handleLogin()} />
          <button style={{...styles.btnPrimary, width: "100%", padding: "13px 0", fontSize: 15}} onClick={handleLogin}>로그인</button>
        </div>
      </div>
    );
  }

  if (phase === "loading") {
    return (
      <div style={styles.container}><div style={styles.card}><div style={{ textAlign: "center", padding: 40, color: "#888" }}>데이터 로드 중...</div></div></div>
    );
  }

  if (phase === "complete") {
    const agreeRate = position > 0 ? ((agreeCount / position) * 100).toFixed(1) : "0";
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <div style={styles.title}>검수 완료</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, margin: "20px 0" }}>
            <div style={styles.stat}><div style={styles.statNum}>{position}</div><div style={styles.statLabel}>총 검수</div></div>
            <div style={styles.stat}><div style={{...styles.statNum, color: "#2a9d8f"}}>{agreeCount}</div><div style={styles.statLabel}>맞음</div></div>
            <div style={styles.stat}><div style={{...styles.statNum, color: "#e76f51"}}>{disagreeCount}</div><div style={styles.statLabel}>틀림</div></div>
          </div>
          <div style={{ textAlign: "center", marginBottom: 16 }}>
            <span style={{ fontSize: 14, color: "#666" }}>동의율: </span>
            <span style={{ fontSize: 20, fontWeight: 700, color: "#4361ee" }}>{agreeRate}%</span>
          </div>
        </div>
      </div>
    );
  }

  const item = items[currentIdx];
  if (!item) return <div style={styles.container}><div style={styles.card}><div style={{ textAlign: "center", padding: 40, color: "#888" }}>항목을 찾는 중...</div></div></div>;

  const aiLabels = item.labels || [];
  const aiReason = item.reason || "";
  const pct = totalItems > 0 ? ((position + 1) / totalItems * 100).toFixed(1) : "0";
  const isDisagreeMode = judgment === "disagree";

  return (
    <div style={styles.container}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <span style={{ fontSize: 13, color: "#888" }}>{position + 1} / {totalItems}</span>
        <span style={{ fontSize: 13, color: "#888" }}>{pct}%</span>
      </div>
      <div style={styles.progress}><div style={styles.progressBar(pct)} /></div>

      <div style={styles.card}>
        <div style={{ fontSize: 12, color: "#888", marginBottom: 8, fontWeight: 600 }}>TITLE</div>
        <div style={styles.titleText}>{item.title}</div>
      </div>

      <div style={styles.card}>
        <div style={{ fontSize: 12, color: "#888", marginBottom: 8, fontWeight: 600 }}>AI 분류 결과</div>
        <div style={{ marginBottom: 8 }}>
          {aiLabels.length > 0 ? aiLabels.map((label, idx) => <span key={idx} style={styles.aiLabel}>{label}</span>) : <span style={styles.allZero}>해당 없음 (all-zero)</span>}
        </div>
        {aiReason && <div style={styles.reason}><span style={{ fontWeight: 600 }}>AI 근거: </span>{aiReason}</div>}
      </div>

      {isDisagreeMode && (
        <div style={styles.card}>
          <div style={{ fontSize: 12, color: "#e76f51", marginBottom: 8, fontWeight: 600 }}>올바른 라벨을 선택하세요 (0~3개)</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 2 }}>
            {LABELS.map((label) => <span key={label} style={styles.labelChip(correctedLabels.includes(label))} onClick={() => toggleCorrectedLabel(label)}>{label}</span>)}
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
            <button style={styles.btnWarning} onClick={() => handleJudge("disagree")} disabled={saving}>{saving ? "저장 중..." : "수정 제출"}</button>
            <button style={styles.btnOutline} onClick={() => { setJudgment(null); setCorrectedLabels([]); }}>취소</button>
          </div>
        </div>
      )}

      {!isDisagreeMode && (
        <div style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 8 }}>
          <button style={{...styles.btnSuccess, flex: 1, padding: "16px 0", fontSize: 18}} onClick={() => handleJudge("agree")} disabled={saving}>{saving ? "저장 중..." : "✓ 맞음"}</button>
          <button style={{...styles.btnWarning, flex: 1, padding: "16px 0", fontSize: 18}} onClick={() => setJudgment("disagree")} disabled={saving}>✗ 틀림</button>
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "center", gap: 24, marginTop: 16, fontSize: 13, color: "#888" }}>
        <span>맞음: {agreeCount}</span>
        <span>틀림: {disagreeCount}</span>
        <span>남은: {totalItems - position - 1}</span>
      </div>

      <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 12 }}>
        <button
          style={{...styles.btnSmall, borderColor: position > 0 ? "#4361ee" : "#ccc", color: position > 0 ? "#4361ee" : "#ccc"}}
          onClick={handleGoBack}
          disabled={position === 0 || saving}
        >
          ← 이전으로
        </button>
        <button
          style={{...styles.btnSmall, borderColor: "#888", color: "#888"}}
          onClick={handleExit}
        >
          나가기
        </button>
      </div>
    </div>
  );
}
