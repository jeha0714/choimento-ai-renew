import { getSupabase, checkPassword, cors } from "./_helpers.js";

export default async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ error: "GET only" });
  if (!checkPassword(req)) return res.status(401).json({ error: "인증 실패" });

  const supabase = getSupabase();

  const { count: total } = await supabase
    .from("gold_samples")
    .select("id", { count: "exact", head: true });
  const { count: done } = await supabase
    .from("gold_annotations")
    .select("sample_id", { count: "exact", head: true });

  return res.status(200).json({ total: total || 0, done: done || 0 });
}
