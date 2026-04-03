import { getSupabase, checkPassword, cors } from "./_helpers.js";

export default async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ error: "GET only" });
  if (!checkPassword(req)) return res.status(401).json({ error: "인증 실패" });

  const supabase = getSupabase();
  const limit = parseInt(req.query.limit || "100");

  // 검수된 item_id 전체 조회 (1000개 제한 우회)
  let reviewedIds = [];
  let from = 0;
  const pageSize = 1000;
  while (true) {
    const { data: batch } = await supabase
      .from("review_results")
      .select("item_id")
      .range(from, from + pageSize - 1);
    if (!batch || batch.length === 0) break;
    reviewedIds = reviewedIds.concat(batch.map(r => r.item_id));
    if (batch.length < pageSize) break;
    from += pageSize;
  }

  // 미검수 항목만 조회
  let query = supabase
    .from("review_items")
    .select("id, title, labels, reason")
    .order("id", { ascending: true })
    .limit(limit);

  if (reviewedIds.length > 0) {
    query = query.not("id", "in", `(${reviewedIds.join(",")})`);
  }

  const { data, error } = await query;

  if (error) return res.status(500).json({ error: error.message });

  return res.status(200).json({
    items: data || [],
    reviewed_count: reviewedIds.length,
  });
}
