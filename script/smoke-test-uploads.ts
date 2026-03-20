/**
 * Smoke test for uploads persistence path.
 *
 * This does NOT guarantee Railway persistence by itself, but it verifies that
 * the server/app-configured uploads root (UPLOADS_DIR) is writable and that
 * we can create/read files under the expected path.
 *
 * Usage:
 *   npx tsx script/smoke-test-uploads.ts
 */
import "dotenv/config";
import fs from "fs";
import path from "path";

const uploadsRoot =
  process.env.UPLOADS_DIR ? path.resolve(process.env.UPLOADS_DIR) : path.join(process.cwd(), "uploads");

async function main() {
  if (!fs.existsSync(uploadsRoot)) {
    fs.mkdirSync(uploadsRoot, { recursive: true });
  }

  const dir = path.join(uploadsRoot, ".smoke-test");
  fs.mkdirSync(dir, { recursive: true });

  const filename = `smoke_${Date.now()}_${Math.random().toString(16).slice(2)}.txt`;
  const abs = path.join(dir, filename);
  const url = `/uploads/.smoke-test/${filename}`;

  fs.writeFileSync(abs, `Smoke test at ${new Date().toISOString()}\n`, "utf8");

  const exists = fs.existsSync(abs);
  if (!exists) {
    throw new Error(`Smoke test file not found after write: ${abs}`);
  }

  console.log("[SMOKE UPLOADS] OK");
  console.log("uploadsRoot:", uploadsRoot);
  console.log("file:", abs);
  console.log("url:", url);
  console.log("Note: To fully test persistence, redeploy/restart and confirm this URL still renders.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

