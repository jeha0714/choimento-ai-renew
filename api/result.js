import { getSupabase, checkPassword, cors } from "./_helpers.js";

export default async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  if (!checkPassword(req)) return res.status(401).json({ error: "인증 실패" });

  const supabase = getSupabase();
  const { item_id, judgment, corrected_labels, duration } = req.body || {};

  if (!item_id || !judgment) {
    return res.status(400).json({ error: "item_id, judgment 필수" });
  }

  // 중복 검수 방지
  const { data: existing } = await supabase
    .from("review_results")
    .select("id")
    .eq("item_id", item_id)
    .limit(1);

  if (existing && existing.length > 0) {
    return res.status(409).json({ error: "이미 검수된 항목입니다." });
  }

  const { data, error } = await supabase
    .from("review_results")
    .insert({
      item_id,
      judgment,
      corrected_labels: corrected_labels || null,
      duration: duration || 0,
    })
    .select();

  if (error) return res.status(500).json({ error: error.message });

  return res.status(200).json({ success: true, result: data[0] });
}
