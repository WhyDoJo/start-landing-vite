import { createWriteStream, existsSync, rmSync } from "fs";
import { basename, join, resolve } from "path";
import archiver from "archiver";

const projectRoot = process.cwd();
const rootFolder = basename(projectRoot);
const distDir = resolve(projectRoot, "dist");
const zipPath = join(distDir, `${rootFolder}.zip`);

if (!existsSync(distDir)) {
  console.error("❌ dist не найден. Сначала запусти bun run build");
  process.exit(1);
}

if (existsSync(zipPath)) {
  rmSync(zipPath);
}

const output = createWriteStream(zipPath);
const archive = archiver("zip", { zlib: { level: 9 } });

output.on("close", () => {
  const kb = (archive.pointer() / 1024).toFixed(1);
  console.log(`✅ ZIP создан: ${zipPath} (${kb} KB)`);
});

archive.on("warning", (error) => {
  if (error.code === "ENOENT") {
    console.warn("⚠️ ZIP warning:", error.message);
    return;
  }

  throw error;
});

archive.on("error", (error) => {
  console.error("❌ ZIP error:", error.message);
  process.exit(1);
});

archive.pipe(output);
archive.glob("**/*", { cwd: distDir, ignore: ["*.zip"] });
archive.finalize();
