import { useState, useEffect, useRef } from "react";

const LABELS = [
  "창업지원", "소상공인지원", "교육훈련", "R&D/연구",
  "채용/일자리", "공모전/경진대회", "행사/전시", "복지/생활지원",
  "주거지원", "공간/입주지원", "판로/마케팅/수출", "자금/금융지원",
];

const DB_NAME = "review-tool-db";
const STORE_NAME = "data";
const KEY_CFG = "cfg";
const KEY_RES = "res";

// ── IndexedDB wrapper ──
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = (e) => { e.target.result.createObjectStore(STORE_NAME); };
    request.onsuccess = (e) => resolve(e.target.result);
    request.onerror = (e) => reject(e.target.error);
  });
}

async function dbGet(key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const request = tx.objectStore(STORE_NAME).get(key);
    request.onsuccess = () => resolve(request.result ?? null);
    request.onerror = () => reject(request.error);
  });
}

async function dbSet(key, value) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const request = tx.objectStore(STORE_NAME).put(value, key);
    request.onsuccess = () => resolve(true);
    request.onerror = () => reject(request.error);
  });
}

async function dbRemove(key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const request = tx.objectStore(STORE_NAME).delete(key);
    request.onsuccess = () => resolve(true);
    request.onerror = () => reject(request.error);
  });
}

export default function App() {
  const [phase, setPhase] = useState("loading");
  const [data, setData] = useState([]);
  const [current, setCurrent] = useState(0);
  const [results, setResults] = useState([]);
  const [password, setPassword] = useState("");
  const [savedPassword, setSavedPassword] = useState("");
  const [judgment, setJudgment] = useState(null);
  const [correctedLabels, setCorrectedLabels] = useState([]);
  const [startTime, setStartTime] = useState(null);
  const [showComplete, setShowComplete] = useState(false);
  const [showJsonModal, setShowJsonModal] = useState(false);
  const [jsonModalText, setJsonModalText] = useState("");
  const [dataSaved, setDataSaved] = useState(false);
  const [saveStatus, setSaveStatus] = useState("");
  const [showReset, setShowReset] = useState(false);
  const [resetPw, setResetPw] = useState("");
  const [errMsg, setErrMsg] = useState("");
  const [showMidSave, setShowMidSave] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedResults, setSavedResults] = useState([]);
  const fileRef = useRef(null);

  useEffect(() => {
    (async () => {
      try {
        const cfg = await dbGet(KEY_CFG);
        const res = (await dbGet(KEY_RES)) || [];
        if (cfg && cfg.password && cfg.data && cfg.data.length > 0) {
          setSavedPassword(cfg.password);
          setData(cfg.data);
          setResults(res);
          setSavedResults(res);
          if (res.length >= cfg.data.length) { setCurrent(cfg.data.length); setShowComplete(true); }
          else { setCurrent(res.length); }
          setDataSaved(true);
        }
      } catch (e) { console.error("DB 로드 실패:", e); }
      setPhase("setup");
    })();
  }, []);

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!password) { setErrMsg("비밀번호를 먼저 설정해주세요."); e.target.value = ""; return; }
    setErrMsg(""); setSaveStatus("saving");
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const parsed = JSON.parse(ev.target.result);
        if (!Array.isArray(parsed)) { setSaveStatus(""); setErrMsg("JSON 배열이 아닙니다."); return; }
        await dbSet(KEY_CFG, { password, data: parsed });
        await dbSet(KEY_RES, []);
        setData(parsed); setResults([]); setSavedResults([]); setCurrent(0);
        setSavedPassword(password); setDataSaved(true); setSaveStatus("saved");
      } catch (err) { setSaveStatus("error"); setErrMsg("저장 실패: " + err.message); }
    };
    reader.readAsText(file);
  };

  const handleStart = () => { if (!dataSaved) { setErrMsg("데이터를 먼저 업로드해주세요."); return; } setErrMsg(""); setPhase("review"); setStartTime(Date.now()); };

  const handleLogin = () => {
    if (password === savedPassword) { setErrMsg(""); setPhase("review"); setStartTime(Date.now()); }
    else { setErrMsg("비밀번호가 틀립니다."); }
  };

  const handleJudge = (type) => {
    const item = data[current];
    const dur = startTime ? (Date.now() - startTime) / 1000 : 0;
    const result = { i: current, title: item.title, ai_labels: item.labels || [], ai_reason: item.reason || "", judgment: type, corrected_labels: type === "disagree" ? correctedLabels : null, dur: Math.round(dur * 10) / 10, at: new Date().toISOString() };
    const newResults = [...results, result];
    setResults(newResults); setJudgment(null); setCorrectedLabels([]);
    if (current + 1 < data.length) { setCurrent(current + 1); setStartTime(Date.now()); }
    else { setShowComplete(true); }
  };

  const toggleCorrectedLabel = (label) => { setCorrectedLabels(prev => prev.includes(label) ? prev.filter(l => l !== label) : [...prev, label]); };

  const getSummary = (r) => { const rs = r || results; const total = rs.length; const agreed = rs.filter(x => x.judgment === "agree").length; const disagreed = rs.filter(x => x.judgment === "disagree").length; const avgTime = total > 0 ? (rs.reduce((s, x) => s + x.dur, 0) / total).toFixed(1) : 0; return { total, agreed, disagreed, avgTime, disagreedItems: rs.filter(x => x.judgment === "disagree") }; };

  const buildExport = (r) => { const s = getSummary(r); return JSON.stringify({ summary: { total: s.total, agree: s.agreed, disagree: s.disagreed, agree_rate: s.total > 0 ? ((s.agreed / s.total) * 100).toFixed(1) : "0", avg_time: s.avgTime }, disagreed_items: s.disagreedItems, all_reviews: r || results }, null, 2); };

  const openJsonModal = (r) => { setJsonModalText(buildExport(r)); setShowJsonModal(true); };

  const handleClipboardCopy = () => { try { navigator.clipboard.writeText(jsonModalText).then(() => setShowJsonModal(false)).catch(() => {}); } catch {} };

  const handleSaveAndExit = async () => {
    setSaving(true);
    try {
      await dbSet(KEY_CFG, { password: savedPassword, data });
      await dbSet(KEY_RES, results);
      setSavedResults(results); setSaving(false); setPhase("setup");
    } catch (e) { setSaving(false); setErrMsg("저장에 실패했습니다. 중간 결과 저장 버튼으로 클립보드에 복사해주세요."); }
  };

  const handleReset = async () => {
    if (resetPw !== savedPassword) { setErrMsg("비밀번호가 틀립니다."); return; }
    try { await dbRemove(KEY_CFG); await dbRemove(KEY_RES); } catch {}
    setData([]); setResults([]); setSavedResults([]); setCurrent(0); setPassword(""); setSavedPassword("");
    setShowComplete(false); setDataSaved(false); setSaveStatus("");
    setShowReset(false); setResetPw(""); setErrMsg(""); setPhase("setup");
  };

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
    modal: { position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 },
    modalContent: { background: "#fff", borderRadius: 12, padding: 24, width: "90%", maxWidth: 600, maxHeight: "80vh", overflow: "auto" },
    errBox: { background: "#fff5f5", border: "1px solid #e63946", borderRadius: 8, padding: "8px 12px", fontSize: 13, color: "#e63946", marginBottom: 12 },
  };

  const JsonModal = () => showJsonModal ? (
    <div style={styles.modal} onClick={() => setShowJsonModal(false)}>
      <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>결과 JSON</div>
        <textarea style={{ width: "100%", height: 400, fontFamily: "monospace", fontSize: 11, padding: 8, boxSizing: "border-box", borderRadius: 8, border: "1px solid #ddd" }} value={jsonModalText} readOnly onFocus={(e) => e.target.select()} />
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <button style={{...styles.btnPrimary, flex: 1}} onClick={handleClipboardCopy}>클립보드에 복사</button>
          <button style={{...styles.btnOutline, flex: 1}} onClick={() => setShowJsonModal(false)}>닫기</button>
        </div>
      </div>
    </div>
  ) : null;

  const ResetModal = () => showReset ? (
    <div style={styles.modal} onClick={() => { setShowReset(false); setResetPw(""); setErrMsg(""); }}>
      <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8, color: "#e63946" }}>초기화</div>
        <p style={{ fontSize: 14, color: "#555", marginBottom: 12 }}>모든 데이터가 삭제됩니다. 비밀번호를 입력하세요.</p>
        {errMsg && <div style={styles.errBox}>{errMsg}</div>}
        <input style={styles.input} type="password" placeholder="비밀번호" value={resetPw} onChange={(e) => { setResetPw(e.target.value); setErrMsg(""); }} onKeyDown={(e) => e.key === "Enter" && handleReset()} />
        <div style={{ display: "flex", gap: 8 }}>
          <button style={{...styles.btnPrimary, background: "#e63946", flex: 1}} onClick={handleReset}>초기화 실행</button>
          <button style={{...styles.btnOutline, flex: 1}} onClick={() => { setShowReset(false); setResetPw(""); setErrMsg(""); }}>취소</button>
        </div>
      </div>
    </div>
  ) : null;

  if (phase === "loading") return (<div style={styles.container}><div style={styles.card}><div style={{ textAlign: "center", padding: 40, color: "#888" }}>로딩 중...</div></div></div>);

  if (phase === "setup") {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <div style={styles.title}>AI 라벨링 검수 도구</div>
          <div style={styles.subtitle}>AI가 부여한 라벨을 확인하고 맞는지 판단합니다</div>
          {errMsg && <div style={styles.errBox}>{errMsg}</div>}
          {data.length > 0 && savedPassword ? (
            <div>
              <p style={{ fontSize: 14, color: "#555", marginBottom: 4 }}>기존 데이터 <b>{data.length}건</b> 중 <b>{results.length}건</b> 검수 완료</p>
              <p style={{ fontSize: 13, color: "#888", marginBottom: 12 }}>비밀번호를 입력하여 이어서 검수하세요.</p>
              <input style={styles.input} type="password" placeholder="비밀번호 입력" value={password} onChange={(e) => { setPassword(e.target.value); setErrMsg(""); }} onKeyDown={(e) => e.key === "Enter" && handleLogin()} />
              <button style={{...styles.btnPrimary, width: "100%", padding: "13px 0", fontSize: 15}} onClick={handleLogin}>이어서 검수</button>
              <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                <button style={{...styles.btnSmall, borderColor: "#4361ee", color: "#4361ee"}} onClick={() => openJsonModal(savedResults)}>현재까지 결과 저장</button>
                <button style={{...styles.btnSmall, borderColor: "#e63946", color: "#e63946"}} onClick={() => { setShowReset(true); setErrMsg(""); }}>초기화</button>
              </div>
            </div>
          ) : (
            <div>
              <p style={{ fontSize: 14, color: "#333", fontWeight: 600, marginBottom: 6 }}>1. 비밀번호 설정</p>
              <input style={styles.input} type="password" placeholder="검수 비밀번호 설정" value={password} onChange={(e) => { setPassword(e.target.value); setErrMsg(""); }} />
              {password && <p style={{ fontSize: 12, color: "#2a9d8f", marginTop: -8, marginBottom: 8 }}>✓ 비밀번호 입력됨</p>}
              <p style={{ fontSize: 14, color: "#333", fontWeight: 600, marginBottom: 6, marginTop: 16 }}>2. 검수 데이터 업로드 (JSON)</p>
              <input ref={fileRef} type="file" accept=".json" onChange={handleFileUpload} style={{ marginBottom: 8 }} />
              {saveStatus === "saving" && <p style={{ fontSize: 13, color: "#888" }}>저장 중...</p>}
              {saveStatus === "saved" && <p style={{ fontSize: 13, color: "#2a9d8f" }}>✓ {data.length}건 저장 완료</p>}
              {saveStatus === "error" && <p style={{ fontSize: 13, color: "#e63946" }}>✗ 저장 실패</p>}
              <button style={{...styles.btnPrimary, width: "100%", padding: "13px 0", fontSize: 15, marginTop: 16, background: dataSaved ? "#4361ee" : "#adb5bd"}} onClick={handleStart}>검수 시작</button>
            </div>
          )}
        </div>
        <ResetModal /><JsonModal />
      </div>
    );
  }

  if (showComplete) {
    const summary = getSummary();
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <div style={styles.title}>검수 완료</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, margin: "20px 0" }}>
            <div style={styles.stat}><div style={styles.statNum}>{summary.total}</div><div style={styles.statLabel}>총 검수</div></div>
            <div style={styles.stat}><div style={{...styles.statNum, color: "#2a9d8f"}}>{summary.agreed}</div><div style={styles.statLabel}>맞음</div></div>
            <div style={styles.stat}><div style={{...styles.statNum, color: "#e76f51"}}>{summary.disagreed}</div><div style={styles.statLabel}>틀림</div></div>
          </div>
          <div style={{ textAlign: "center", marginBottom: 16 }}>
            <span style={{ fontSize: 14, color: "#666" }}>동의율: </span>
            <span style={{ fontSize: 20, fontWeight: 700, color: "#4361ee" }}>{summary.total > 0 ? ((summary.agreed / summary.total) * 100).toFixed(1) : 0}%</span>
            <span style={{ fontSize: 14, color: "#666", marginLeft: 16 }}>평균: </span>
            <span style={{ fontSize: 20, fontWeight: 700, color: "#4361ee" }}>{summary.avgTime}초</span>
          </div>
          {summary.disagreed > 0 && (
            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>AI가 틀렸다고 판단한 건 ({summary.disagreed}건)</div>
              <div style={{ maxHeight: 300, overflow: "auto", background: "#f8f9fa", borderRadius: 8, padding: 12 }}>
                {summary.disagreedItems.map((item, idx) => (
                  <div key={idx} style={{ padding: "8px 0", borderBottom: idx < summary.disagreedItems.length - 1 ? "1px solid #e9ecef" : "none" }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#1a1a2e" }}>{item.title}</div>
                    <div style={{ fontSize: 12, color: "#e76f51", marginTop: 4 }}>AI: [{(item.ai_labels || []).join(", ")}]{item.corrected_labels && <span style={{ color: "#2a9d8f" }}> → [{item.corrected_labels.join(", ")}]</span>}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
          <button style={{...styles.btnPrimary, width: "100%", padding: "13px 0", marginTop: 20}} onClick={() => openJsonModal()}>결과 저장 (JSON)</button>
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button style={{...styles.btnSmall, borderColor: "#2a9d8f", color: "#2a9d8f"}} onClick={handleSaveAndExit}>저장하고 나가기</button>
            <button style={{...styles.btnSmall, borderColor: "#e63946", color: "#e63946"}} onClick={() => setShowReset(true)}>초기화</button>
          </div>
        </div>
        <ResetModal /><JsonModal />
      </div>
    );
  }

  const item = data[current];
  if (!item) return null;
  const aiLabels = item.labels || [];
  const aiReason = item.reason || "";
  const pct = ((current + 1) / data.length * 100).toFixed(1);
  const isDisagreeMode = judgment === "disagree";

  return (
    <div style={styles.container}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <span style={{ fontSize: 13, color: "#888" }}>{current + 1} / {data.length}</span>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button style={{...styles.btnSmall, borderColor: "#4361ee", color: "#4361ee"}} onClick={() => setShowMidSave(true)}>중간 결과 저장</button>
          <span style={{ fontSize: 13, color: "#888" }}>{pct}%</span>
        </div>
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
            <button style={styles.btnWarning} onClick={() => handleJudge("disagree")}>수정 제출</button>
            <button style={styles.btnOutline} onClick={() => { setJudgment(null); setCorrectedLabels([]); }}>취소</button>
          </div>
        </div>
      )}

      {!isDisagreeMode && (
        <div style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 8 }}>
          <button style={{...styles.btnSuccess, flex: 1, padding: "16px 0", fontSize: 18}} onClick={() => handleJudge("agree")}>✓ 맞음</button>
          <button style={{...styles.btnWarning, flex: 1, padding: "16px 0", fontSize: 18}} onClick={() => setJudgment("disagree")}>✗ 틀림</button>
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "center", gap: 24, marginTop: 16, fontSize: 13, color: "#888" }}>
        <span>맞음: {results.filter(r => r.judgment === "agree").length}</span>
        <span>틀림: {results.filter(r => r.judgment === "disagree").length}</span>
        <span>남은: {data.length - current - 1}</span>
      </div>

      {errMsg && <div style={{...styles.errBox, marginTop: 12}}>{errMsg}</div>}

      <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 12 }}>
        <button style={{...styles.btnSmall, borderColor: "#2a9d8f", color: "#2a9d8f"}} onClick={handleSaveAndExit}>{saving ? "저장 중..." : "저장하고 나가기"}</button>
        <button style={{...styles.btnSmall, borderColor: "#e63946", color: "#e63946"}} onClick={() => setShowReset(true)}>처음부터 다시 시작</button>
      </div>

      {showMidSave && (
        <div style={styles.modal} onClick={() => setShowMidSave(false)}>
          <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>저장된 결과 ({savedResults.length}건)</div>
            {savedResults.length === 0 ? (
              <div style={{ fontSize: 13, color: "#888", marginBottom: 12 }}>아직 저장된 결과가 없습니다. "저장하고 나가기"를 먼저 실행해주세요.</div>
            ) : (
              <>
                <div style={{ fontSize: 13, color: "#888", marginBottom: 12 }}>맞음: {savedResults.filter(r => r.judgment === "agree").length} / 틀림: {savedResults.filter(r => r.judgment === "disagree").length}</div>
                <textarea style={{ width: "100%", height: 300, fontFamily: "monospace", fontSize: 11, padding: 8, boxSizing: "border-box", borderRadius: 8, border: "1px solid #ddd" }} value={buildExport(savedResults)} readOnly onFocus={(e) => e.target.select()} />
              </>
            )}
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              {savedResults.length > 0 && (<button style={{...styles.btnPrimary, flex: 1}} onClick={() => { try { navigator.clipboard.writeText(buildExport(savedResults)).catch(() => {}); } catch {} setShowMidSave(false); }}>클립보드에 모두 복사</button>)}
              <button style={{...styles.btnOutline, flex: 1}} onClick={() => setShowMidSave(false)}>닫기</button>
            </div>
          </div>
        </div>
      )}
      <ResetModal /><JsonModal />
    </div>
  );
}
