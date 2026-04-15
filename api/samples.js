import { getSupabase, checkPassword, cors } from "./_helpers.js";

export default async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ error: "GET only" });
  if (!checkPassword(req)) return res.status(401).json({ error: "인증 실패" });

  const supabase = getSupabase();
  const limit = parseInt(req.query.limit || "200");

  const { data: done } = await supabase
    .from("gold_annotations")
    .select("sample_id");
  const doneIds = (done || []).map((d) => d.sample_id);

  let query = supabase
    .from("gold_samples")
    .select("id, title")
    .order("id", { ascending: true })
    .limit(limit);

  if (doneIds.length > 0) {
    query = query.not("id", "in", `(${doneIds.join(",")})`);
  }

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });

  return res.status(200).json({ items: data || [] });
}
