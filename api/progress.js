import { getSupabase, checkAdmin, checkPassword, cors } from "./_helpers.js";

export default async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ error: "GET only" });

  // 관리자 또는 검수자 모두 접근 가능
  if (!checkAdmin(req) && !checkPassword(req)) {
    return res.status(401).json({ error: "인증 실패" });
  }

  const supabase = getSupabase();

  const { count: totalItems } = await supabase
    .from("review_items")
    .select("id", { count: "exact", head: true });

  const { count: totalReviewed } = await supabase
    .from("review_results")
    .select("id", { count: "exact", head: true });

  const { count: agreeCount } = await supabase
    .from("review_results")
    .select("id", { count: "exact", head: true })
    .eq("judgment", "agree");

  const { count: disagreeCount } = await supabase
    .from("review_results")
    .select("id", { count: "exact", head: true })
    .eq("judgment", "disagree");

  const total = totalItems || 0;
  const reviewed = totalReviewed || 0;
  const agree = agreeCount || 0;
  const disagree = disagreeCount || 0;

  return res.status(200).json({
    total_items: total,
    reviewed,
    agree,
    disagree,
    remaining: total - reviewed,
    progress_pct: total > 0 ? Math.round((reviewed / total) * 1000) / 10 : 0,
    agree_rate: reviewed > 0 ? Math.round((agree / reviewed) * 1000) / 10 : 0,
  });
}
