import { getSupabase, checkPassword, cors } from "./_helpers.js";

export default async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (!checkPassword(req)) return res.status(401).json({ error: "인증 실패" });

  const supabase = getSupabase();

  // ── GET: 마지막 검수 항목 조회 ──
  if (req.method === "GET") {
    const { data: lastReview, error: revErr } = await supabase
      .from("review_results")
      .select("item_id, judgment")
      .order("id", { ascending: false })
      .limit(1);

    if (revErr) return res.status(500).json({ error: revErr.message });
    if (!lastReview || lastReview.length === 0) {
      return res.status(404).json({ error: "검수 내역이 없습니다." });
    }

    const { data: item, error: itemErr } = await supabase
      .from("review_items")
      .select("id, title, labels, reason")
      .eq("id", lastReview[0].item_id)
      .limit(1);

    if (itemErr) return res.status(500).json({ error: itemErr.message });

    return res.status(200).json({
      item: item[0],
      judgment: lastReview[0].judgment,
    });
  }

  // ── DELETE: 검수 결과 삭제 (되돌아가기) ──
  if (req.method === "DELETE") {
    const { item_id } = req.body || {};
    if (!item_id) return res.status(400).json({ error: "item_id 필수" });

    const { data, error } = await supabase
      .from("review_results")
      .delete()
      .eq("item_id", item_id)
      .select();

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ success: true, deleted: data ? data.length : 0 });
  }

  // ── POST: 검수 결과 저장 ──
  if (req.method !== "POST") return res.status(405).json({ error: "GET, POST or DELETE only" });
  const { item_id, judgment, corrected_labels, duration } = req.body || {};

  if (!item_id || !judgment) {
    return res.status(400).json({ error: "item_id, judgment 필수" });
  }

  // insert인지 update인지 확인
  const { data: existing } = await supabase
    .from("review_results")
    .select("id")
    .eq("item_id", item_id)
    .limit(1);

  const isUpdate = existing && existing.length > 0;

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

  return res.status(200).json({ success: true, result: data[0], is_update: isUpdate });
}
