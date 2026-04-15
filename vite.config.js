import autoprefixer from "autoprefixer";
import { execSync } from "child_process";
import chokidar from "chokidar";
import { existsSync } from "fs";
import { resolve } from "path";
import { defineConfig } from "vite";
import handlebars from "vite-plugin-handlebars";
import spriteSvg from "./scripts/sprite-svg";

// === Статические входные точки для multi-page (flat output, без задержек от readdir) ===
const input = {
  index: resolve(__dirname, "src/html/index.html"),
  about: resolve(__dirname, "src/html/about.html"),
};

// === Вотчер для изображений на лету ===
function imageWatcher() {
  let timer = null;
  const debounceRun = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      runImageConversion();
      timer = null;
    }, 500);
  };
  return {
    name: "image-watcher",
    configureServer() {
      const watcher = chokidar.watch("src/assets/img", {
        persistent: true,
        ignoreInitial: true,
        followSymlinks: true,
        cwd: process.cwd(),
        awaitWriteFinish: { stabilityThreshold: 300, pollInterval: 100 },
      });
      watcher.on("add", debounceRun).on("change", debounceRun);
      console.log(
        "Вотчер на изображения запущен (только новые/изменённые файлы)"
      );
    },
  };
}

function runImageConversion() {
  const imagesDir = "src/assets/img";
  if (!existsSync(imagesDir)) return;
  try {
    console.log("Конвертация изображений (только изменённые)...");
    execSync("node scripts/convert-images.js", { stdio: "inherit" });
  } catch (e) {
    console.error("Ошибка конвертации изображений:", e.message);
  }
}

// === Вотчер для SVG на лету ===
function svgWatcher() {
  let timer = null;
  const debounceRun = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      runSvgConversion();
      timer = null;
    }, 500);
  };
  return {
    name: "svg-watcher",
    configureServer() {
      const watcher = chokidar.watch("src/assets/icons", {
        persistent: true,
        ignoreInitial: true,
        followSymlinks: true,
        cwd: process.cwd(),
        awaitWriteFinish: { stabilityThreshold: 300, pollInterval: 100 },
      });
      watcher.on("add", debounceRun).on("change", debounceRun);
      console.log("Вотчер на SVG запущен (только новые/изменённые файлы)");
    },
  };
}

function runSvgConversion() {
  const svgDir = "src/assets/icons";
  if (!existsSync(svgDir)) return;
  try {
    console.log("Оптимизация SVG (только изменённые)...");
    execSync("node scripts/convert-svg.js", { stdio: "inherit" });
  } catch (e) {
    console.error("Ошибка оптимизации SVG:", e.message);
  }
}

// === НОВЫЙ ВОТЧЕР ДЛЯ ШРИФТОВ (на лету) ===
function fontWatcher() {
  let timer = null;
  const debounceRun = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      runFontConversion();
      timer = null;
    }, 500);
  };
  return {
    name: "font-watcher",
    configureServer() {
      const watcher = chokidar.watch("src/assets/fonts", {
        persistent: true,
        ignoreInitial: true,
        followSymlinks: true,
        cwd: process.cwd(),
        awaitWriteFinish: { stabilityThreshold: 300, pollInterval: 100 },
      });
      watcher.on("add", debounceRun).on("change", debounceRun);
      console.log("Вотчер на шрифты запущен (только новые/изменённые TTF)");
    },
  };
}

function runFontConversion() {
  try {
    console.log("Конвертация шрифтов (только изменённые)...");
    execSync("node scripts/convert-fonts.js", { stdio: "inherit" });
  } catch (e) {
    console.error("Ошибка конвертации шрифтов:", e.message);
  }
}

// assetConverter — ТОЛЬКО для билда (упростил, без readdirSync для скорости)
function assetConverter() {
  return {
    name: "asset-converter",
    buildStart(options) {
      if (options.command !== "build") return; // Ничего в dev
      const fontsDir = "src/assets/fonts";
      const imagesDir = "src/assets/img";
      if (existsSync(fontsDir)) {
        try {
          console.log("Конвертация шрифтов во время билда...");
          execSync("node scripts/convert-fonts.js", { stdio: "inherit" });
        } catch (error) {
          console.error("Font conversion failed:", error.message);
        }
      }
      if (existsSync(imagesDir)) {
        try {
          console.log("Конвертация изображений во время билда...");
          execSync("node scripts/convert-images.js", { stdio: "inherit" });
        } catch (error) {
          console.error("Image conversion failed:", error.message);
        }
      }
    },
  };
}

export default defineConfig({
  root: ".",
  server: {
    port: 3000,
    open: "/src/html/index.html", // Авто-открытие в dev
  },
  build: {
    outDir: "dist",
    target: "es2015",
    minify: "terser",
    terserOptions: {
      compress: { drop_console: true },
    },
    rollupOptions: {
      input,
    },
  },
  css: {
    preprocessorOptions: {
      scss: { api: "modern-compiler" },
    },
    postcss: {
      plugins: [autoprefixer()],
    },
  },
  plugins: [
    spriteSvg(),
    handlebars({
      partialDirectory: resolve(__dirname, "src/blocks"),
      reloadOnPartialChange: true,
    }),
    imageWatcher(),
    svgWatcher(),
    fontWatcher(),
    assetConverter(),
  ],
});
