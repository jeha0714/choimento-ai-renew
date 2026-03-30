import { createClient } from "@supabase/supabase-js";

export function getSupabase() {
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  );
}

export function checkPassword(req) {
  const pw = req.headers["x-review-password"] || "";
  return pw === process.env.REVIEW_PASSWORD;
}

export function checkAdmin(req) {
  const pw = req.headers["x-admin-password"] || "";
  return pw === process.env.ADMIN_PASSWORD;
}

export function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,x-review-password,x-admin-password");
}
