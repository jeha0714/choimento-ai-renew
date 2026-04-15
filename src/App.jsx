import { useState, useEffect } from "react";

const LABELS = [
  "아동/청소년",
  "청년/대학생",
  "중장년",
  "취약계층",
  "기업/스타트업",
  "소상공인/자영업자",
  "공공/연구/교육기관",
];

const API = "";
const BATCH_SIZE = 200;

async function api(path, opts = {}) {
  const pw = sessionStorage.getItem("review_pw") || "";
  const res = await fetch(`${API}${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      "x-review-password": pw,
      ...(opts.headers || {}),
    },
  });
  return res.json();
}

export default function App() {
  const [phase, setPhase] = useState("login");
  const [password, setPassword] = useState("");
  const [errMsg, setErrMsg] = useState("");

  const [items, setItems] = useState([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [total, setTotal] = useState(0);
  const [done, setDone] = useState(0);

  const [selectedLabels, setSelectedLabels] = useState([]);
  const [memo, setMemo] = useState("");
  const [saving, setSaving] = useState(false);

  const [history, setHistory] = useState([]);

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

  useEffect(() => {
    if (phase !== "loading") return;
    (async () => {
      try {
        const prog = await api("/api/progress");
        setTotal(prog.total);
        setDone(prog.done);
        if (prog.done >= prog.total && prog.total > 0) {
          setPhase("complete");
          return;
        }
        const res = await api(`/api/samples?limit=${BATCH_SIZE}`);
        setItems(res.items || []);
        setCurrentIdx(0);
        setSelectedLabels([]);
        setMemo("");
        setPhase("label");
      } catch (e) {
        setErrMsg("데이터 로드 실패: " + e.message);
        setPhase("login");
      }
    })();
  }, [phase]);

  const loadMore = async () => {
    const res = await api(`/api/samples?limit=${BATCH_SIZE}`);
    const newItems = res.items || [];
    if (newItems.length > 0) {
      setItems(newItems);
      setCurrentIdx(0);
    } else {
      setPhase("complete");
    }
  };

  const toggleLabel = (label) => {
    setSelectedLabels((prev) =>
      prev.includes(label) ? prev.filter((l) => l !== label) : [...prev, label]
    );
  };

  const handleSave = async () => {
    const item = items[currentIdx];
    if (!item) return;
    setSaving(true);
    const res = await api("/api/annotate", {
      method: "POST",
      body: JSON.stringify({
        sample_id: item.id,
        labels: selectedLabels,
        memo,
      }),
    });
    setSaving(false);
    if (!res.success) {
      setErrMsg(res.error || "저장 실패");
      return;
    }

    setHistory((prev) => [
      ...prev,
      { idx: currentIdx, item, labels: selectedLabels, memo },
    ]);
    setDone((d) => d + 1);
    setSelectedLabels([]);
    setMemo("");

    const nextIdx = currentIdx + 1;
    if (nextIdx < items.length) {
      setCurrentIdx(nextIdx);
    } else if (done + 1 < total) {
      setHistory([]);
      await loadMore();
    } else {
      setPhase("complete");
    }
  };

  const handleGoBack = async () => {
    setSaving(true);
    try {
      if (history.length > 0) {
        const prev = history[history.length - 1];
        await api("/api/annotate", {
          method: "DELETE",
          body: JSON.stringify({ sample_id: prev.item.id }),
        });
        setHistory((h) => h.slice(0, -1));
        setDone((d) => Math.max(0, d - 1));
        setCurrentIdx(prev.idx);
        setItems((its) => {
          const copy = [...its];
          if (!copy.find((x) => x.id === prev.item.id)) {
            copy.splice(prev.idx, 0, prev.item);
          }
          return copy;
        });
        setSelectedLabels(prev.labels);
        setMemo(prev.memo);
      } else {
        const last = await api("/api/annotate");
        if (!last.item) return;
        await api("/api/annotate", {
          method: "DELETE",
          body: JSON.stringify({ sample_id: last.item.id }),
        });
        setDone((d) => Math.max(0, d - 1));
        setItems((its) => [last.item, ...its]);
        setCurrentIdx(0);
        setSelectedLabels(last.labels || []);
        setMemo(last.memo || "");
      }
    } catch (e) {
      setErrMsg("되돌리기 실패: " + e.message);
    }
    setSaving(false);
  };

  const handleExit = () => {
    sessionStorage.removeItem("review_pw");
    setPhase("login");
    setPassword("");
    setHistory([]);
    setItems([]);
  };

  const styles = {
    container: { maxWidth: 720, margin: "0 auto", padding: "24px 16px", fontFamily: "'Pretendard', -apple-system, sans-serif", color: "#1a1a2e" },
    card: { background: "#fff", borderRadius: 12, padding: 24, boxShadow: "0 2px 12px rgba(0,0,0,0.08)", marginBottom: 16 },
    title: { fontSize: 22, fontWeight: 700, marginBottom: 8 },
    subtitle: { fontSize: 14, color: "#666", marginBottom: 24 },
    input: { width: "100%", padding: "10px 14px", borderRadius: 8, border: "1px solid #ddd", fontSize: 14, marginBottom: 12, boxSizing: "border-box" },
    textarea: { width: "100%", padding: "10px 14px", borderRadius: 8, border: "1px solid #ddd", fontSize: 14, boxSizing: "border-box", resize: "vertical", minHeight: 60, fontFamily: "inherit" },
    btnPrimary: { padding: "10px 24px", borderRadius: 8, border: "none", background: "#4361ee", color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer" },
    btnSuccess: { padding: "12px 32px", borderRadius: 8, border: "none", background: "#2a9d8f", color: "#fff", fontSize: 16, fontWeight: 700, cursor: "pointer" },
    btnSmall: { padding: "6px 14px", borderRadius: 6, border: "1px solid #ddd", background: "#f8f9fa", color: "#555", fontSize: 12, fontWeight: 500, cursor: "pointer" },
    progress: { width: "100%", height: 8, background: "#e9ecef", borderRadius: 4, overflow: "hidden", marginBottom: 16 },
    progressBar: (pct) => ({ width: `${pct}%`, height: "100%", background: "linear-gradient(90deg, #4361ee, #3a86ff)", transition: "width 0.3s" }),
    labelChip: (active) => ({ display: "inline-block", padding: "8px 16px", borderRadius: 20, margin: 4, fontSize: 14, fontWeight: 500, cursor: "pointer", background: active ? "#4361ee" : "#f1f3f5", color: active ? "#fff" : "#495057", border: active ? "2px solid #4361ee" : "2px solid transparent", userSelect: "none" }),
    titleText: { fontSize: 18, fontWeight: 600, lineHeight: 1.5, wordBreak: "break-word" },
    errBox: { background: "#fff5f5", border: "1px solid #e63946", borderRadius: 8, padding: "8px 12px", fontSize: 13, color: "#e63946", marginBottom: 12 },
    stat: { textAlign: "center", padding: "8px 0" },
    statNum: { fontSize: 28, fontWeight: 700, color: "#4361ee" },
    statLabel: { fontSize: 12, color: "#888", marginTop: 2 },
  };

  if (phase === "login") {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <div style={styles.title}>라벨링 도구</div>
          <div style={styles.subtitle}>비밀번호를 입력하세요</div>
          {errMsg && <div style={styles.errBox}>{errMsg}</div>}
          <input style={styles.input} type="password" placeholder="비밀번호" value={password} onChange={(e) => { setPassword(e.target.value); setErrMsg(""); }} onKeyDown={(e) => e.key === "Enter" && handleLogin()} />
          <button style={{ ...styles.btnPrimary, width: "100%", padding: "13px 0", fontSize: 15 }} onClick={handleLogin}>로그인</button>
        </div>
      </div>
    );
  }

  if (phase === "loading") {
    return <div style={styles.container}><div style={styles.card}><div style={{ textAlign: "center", padding: 40, color: "#888" }}>데이터 로드 중...</div></div></div>;
  }

  if (phase === "complete") {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <div style={styles.title}>라벨링 완료</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, margin: "20px 0" }}>
            <div style={styles.stat}><div style={styles.statNum}>{done}</div><div style={styles.statLabel}>완료</div></div>
            <div style={styles.stat}><div style={styles.statNum}>{total}</div><div style={styles.statLabel}>전체</div></div>
          </div>
          <button style={{ ...styles.btnPrimary, width: "100%" }} onClick={handleExit}>나가기</button>
        </div>
      </div>
    );
  }

  const item = items[currentIdx];
  if (!item) return <div style={styles.container}><div style={styles.card}><div style={{ textAlign: "center", padding: 40, color: "#888" }}>항목 없음</div></div></div>;

  const pct = total > 0 ? ((done / total) * 100).toFixed(1) : "0";

  return (
    <div style={styles.container}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
        <span style={{ fontSize: 13, color: "#888" }}>{done + 1} / {total}</span>
        <span style={{ fontSize: 13, color: "#888" }}>{pct}%</span>
      </div>
      <div style={styles.progress}><div style={styles.progressBar(pct)} /></div>

      {errMsg && <div style={styles.errBox}>{errMsg}</div>}

      <div style={styles.card}>
        <div style={{ fontSize: 12, color: "#888", marginBottom: 8, fontWeight: 600 }}>TITLE</div>
        <div style={styles.titleText}>{item.title}</div>
      </div>

      <div style={styles.card}>
        <div style={{ fontSize: 12, color: "#888", marginBottom: 8, fontWeight: 600 }}>라벨 선택 (0개 이상)</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 2, marginBottom: 12 }}>
          {LABELS.map((label) => (
            <span key={label} style={styles.labelChip(selectedLabels.includes(label))} onClick={() => toggleLabel(label)}>{label}</span>
          ))}
        </div>
        <div style={{ fontSize: 12, color: "#888", marginBottom: 6, fontWeight: 600 }}>메모 (선택)</div>
        <textarea style={styles.textarea} value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="메모를 남기려면 여기에..." />
      </div>

      <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
        <button style={{ ...styles.btnSuccess, flex: 1, padding: "16px 0", fontSize: 18 }} onClick={handleSave} disabled={saving}>
          {saving ? "저장 중..." : "저장"}
        </button>
      </div>

      <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 12 }}>
        <button style={{ ...styles.btnSmall, borderColor: done > 0 ? "#4361ee" : "#ccc", color: done > 0 ? "#4361ee" : "#ccc" }} onClick={handleGoBack} disabled={done === 0 || saving}>← 이전으로</button>
        <button style={{ ...styles.btnSmall, borderColor: "#888", color: "#888" }} onClick={handleExit}>나가기</button>
      </div>
    </div>
  );
}
