import autoprefixer from "autoprefixer";
import { execSync } from "child_process";
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

const assetTasks = [
  {
    key: "fonts",
    sourceDir: "src/assets/fonts",
    command: "node scripts/convert-fonts.js",
    title: "Конвертация шрифтов",
  },
  {
    key: "images",
    sourceDir: "src/assets/img",
    command: "node scripts/convert-images.js",
    title: "Конвертация изображений",
    supportsTargetPath: true,
  },
  {
    key: "svg",
    sourceDir: "src/assets/icons",
    command: "node scripts/convert-svg.js",
    title: "Оптимизация SVG",
  },
];

function runTask(task, filePath = "") {
  const absoluteSourceDir = resolve(process.cwd(), task.sourceDir);
  if (!existsSync(absoluteSourceDir)) return;

  try {
    console.log(`${task.title}...`);
    const command =
      task.supportsTargetPath && filePath
        ? `${task.command} ${JSON.stringify(filePath)}`
        : task.command;

    execSync(command, { stdio: "inherit" });
  } catch (error) {
    console.error(`${task.title}: ошибка`, error.message);
  }
}

function runAllAssetTasks() {
  for (const task of assetTasks) {
    runTask(task);
  }
}

function assetPipeline() {
  let command = "serve";
  const timers = new Map();

  const getTaskByPath = (filePath) => {
    const normalized = filePath.replace(/\\/g, "/");

    if (normalized.includes("/src/assets/fonts/")) {
      return assetTasks[0];
    }
    if (normalized.includes("/src/assets/img/")) {
      return assetTasks[1];
    }
    if (normalized.includes("/src/assets/icons/")) {
      return assetTasks[2];
    }

    return null;
  };

  const scheduleTask = (task, filePath = "") => {
    const activeTimer = timers.get(task.key);
    if (activeTimer) clearTimeout(activeTimer);

    const timer = setTimeout(() => {
      runTask(task, filePath);
      timers.delete(task.key);
    }, 400);

    timers.set(task.key, timer);
  };

  return {
    name: "asset-pipeline",
    configResolved(config) {
      command = config.command;
    },
    buildStart() {
      if (command === "build") {
        runAllAssetTasks();
      }
    },
    configureServer(server) {
      server.watcher.add([
        "src/assets/fonts/**/*",
        "src/assets/img/**/*",
        "src/assets/icons/**/*",
      ]);

      const onAssetChange = (filePath) => {
        const task = getTaskByPath(filePath);
        if (!task) return;

        scheduleTask(task, filePath);
        server.ws.send({ type: "full-reload" });
      };

      const onAssetRemove = (filePath) => {
        const task = getTaskByPath(filePath);
        if (!task) return;

        server.ws.send({ type: "full-reload" });
      };

      server.watcher
        .on("add", onAssetChange)
        .on("change", onAssetChange)
        .on("unlink", onAssetRemove);

      console.log("Asset watch запущен (без тяжелого прогона на старте)");
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
      partialDirectory: resolve(__dirname, "src/html/blocks"),
      reloadOnPartialChange: true,
    }),
    assetPipeline(),
  ],
});
