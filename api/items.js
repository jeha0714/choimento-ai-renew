import { getSupabase, checkPassword, cors } from "./_helpers.js";

export default async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ error: "GET only" });
  if (!checkPassword(req)) return res.status(401).json({ error: "인증 실패" });

  const supabase = getSupabase();
  const offset = parseInt(req.query.offset || "0");
  const limit = parseInt(req.query.limit || "100");

  const { data, error } = await supabase
    .from("review_items")
    .select("id, title, labels, reason")
    .order("id", { ascending: true })
    .range(offset, offset + limit - 1);

  if (error) return res.status(500).json({ error: error.message });

  return res.status(200).json({
    items: data || [],
    offset,
    limit,
  });
}
