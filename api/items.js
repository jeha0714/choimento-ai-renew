import { getSupabase, checkPassword, cors } from "./_helpers.js";

export default async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ error: "GET only" });
  if (!checkPassword(req)) return res.status(401).json({ error: "인증 실패" });

  const supabase = getSupabase();
  const offset = parseInt(req.query.offset || "0");
  const limit = parseInt(req.query.limit || "100");

  // 이미 검수된 item_id 목록 가져오기
  const { data: reviewed } = await supabase
    .from("review_results")
    .select("item_id");

  const reviewedIds = new Set((reviewed || []).map(r => r.item_id));

  // 전체 건수
  const { count } = await supabase
    .from("review_items")
    .select("id", { count: "exact", head: true });

  // 검수 안 된 항목만 가져오기
  const { data, error } = await supabase
    .from("review_items")
    .select("id, title, labels, reason")
    .order("id", { ascending: true })
    .range(offset, offset + limit - 1);

  if (error) return res.status(500).json({ error: error.message });

  return res.status(200).json({
    items: data || [],
    total: count || 0,
    reviewed_count: reviewedIds.size,
    reviewed_ids: Array.from(reviewedIds),
    offset,
    limit,
  });
}
