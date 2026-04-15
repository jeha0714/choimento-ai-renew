import { getSupabase, checkPassword, cors } from "./_helpers.js";

export default async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (!checkPassword(req)) return res.status(401).json({ error: "인증 실패" });

  const supabase = getSupabase();

  if (req.method === "POST") {
    const { sample_id, labels, memo } = req.body || {};
    if (!sample_id || !Array.isArray(labels)) {
      return res.status(400).json({ error: "sample_id, labels 필요" });
    }
    const { error } = await supabase.from("gold_annotations").upsert({
      sample_id,
      labels,
      memo: memo || "",
      status: "labeled",
      updated_at: new Date().toISOString(),
    });
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ success: true });
  }

  if (req.method === "DELETE") {
    const { sample_id } = req.body || {};
    if (!sample_id) return res.status(400).json({ error: "sample_id 필요" });
    const { error } = await supabase
      .from("gold_annotations")
      .delete()
      .eq("sample_id", sample_id);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ success: true });
  }

  if (req.method === "GET") {
    const { data, error } = await supabase
      .from("gold_annotations")
      .select("sample_id, labels, memo, labeled_at, gold_samples(id, title)")
      .order("labeled_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) return res.status(500).json({ error: error.message });
    if (!data) return res.status(200).json({ item: null });
    return res.status(200).json({
      item: { id: data.gold_samples.id, title: data.gold_samples.title },
      labels: data.labels || [],
      memo: data.memo || "",
    });
  }

  return res.status(405).json({ error: "method not allowed" });
}
