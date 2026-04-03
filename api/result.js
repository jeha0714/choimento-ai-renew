import { getSupabase, checkPassword, cors } from "./_helpers.js";

export default async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (!checkPassword(req)) return res.status(401).json({ error: "인증 실패" });

  const supabase = getSupabase();

  // ── GET: 마지막 검수 항목 조회 ──
  if (req.method === "GET") {
    const { data: state } = await supabase
      .from("review_state")
      .select("current_position")
      .eq("id", 1)
      .limit(1);

    const position = state && state.length > 0 ? state[0].current_position : 0;
    if (position === 0) {
      return res.status(404).json({ error: "검수 내역이 없습니다." });
    }

    // position번째 항목 = offset position-1
    const { data: item, error: itemErr } = await supabase
      .from("review_items")
      .select("id, title, labels, reason")
      .order("id", { ascending: true })
      .range(position - 1, position - 1);

    if (itemErr) return res.status(500).json({ error: itemErr.message });
    if (!item || item.length === 0) {
      return res.status(404).json({ error: "항목을 찾을 수 없습니다." });
    }

    // 해당 항목의 검수 결과 조회
    const { data: review } = await supabase
      .from("review_results")
      .select("judgment")
      .eq("item_id", item[0].id)
      .limit(1);

    return res.status(200).json({
      item: item[0],
      judgment: review && review.length > 0 ? review[0].judgment : null,
    });
  }

  // ── DELETE: 검수 결과 삭제 + 커서 -1 ──
  if (req.method === "DELETE") {
    const { item_id } = req.body || {};
    if (!item_id) return res.status(400).json({ error: "item_id 필수" });

    const { data, error } = await supabase
      .from("review_results")
      .delete()
      .eq("item_id", item_id)
      .select();

    if (error) return res.status(500).json({ error: error.message });

    // 커서 -1
    await supabase.rpc("decrement_position");

    return res.status(200).json({ success: true, deleted: data ? data.length : 0 });
  }

  // ── POST: 검수 결과 저장 + 커서 +1 ──
  if (req.method !== "POST") return res.status(405).json({ error: "GET, POST or DELETE only" });
  const { item_id, judgment, corrected_labels, duration } = req.body || {};

  if (!item_id || !judgment) {
    return res.status(400).json({ error: "item_id, judgment 필수" });
  }

  const { data, error } = await supabase
    .from("review_results")
    .upsert({
      item_id,
      judgment,
      corrected_labels: corrected_labels || null,
      duration: duration || 0,
    }, { onConflict: "item_id" })
    .select();

  if (error) return res.status(500).json({ error: error.message });

  // 커서 +1
  await supabase.rpc("increment_position");

  return res.status(200).json({ success: true, result: data[0] });
}
