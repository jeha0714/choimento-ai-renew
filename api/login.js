import { cors } from "./_helpers.js";

export default function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const { password } = req.body || {};
  if (password === process.env.REVIEW_PASSWORD) {
    return res.status(200).json({ success: true, role: "reviewer" });
  }
  if (password === process.env.ADMIN_PASSWORD) {
    return res.status(200).json({ success: true, role: "admin" });
  }
  return res.status(401).json({ success: false, error: "비밀번호가 틀립니다." });
}
