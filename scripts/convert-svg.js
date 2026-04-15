import {
  readdirSync,
  existsSync,
  mkdirSync,
  statSync,
  copyFileSync,
  readFileSync,
  writeFileSync,
} from "fs";
import { join, extname, dirname, relative } from "path";
import { optimize } from "svgo";

const SRC_DIR = "src/assets/icons"; // ← Исходные SVG (кидай сюда)
const OUTPUT_DIR = "public/icons"; // ← Оптимизированные SVG (доступны как /icons/...)

const svgoConfig = {
  multipass: true, // Делает несколько проходов для лучшего результата
  plugins: [
    "preset-default", // Все стандартные безопасные оптимизации
    {
      name: "removeViewBox",
      active: false, // НЕ удаляем viewBox — важно для <use> и масштабирования
    },
    {
      name: "cleanupIDs",
      active: false, // НЕ трогаем ID — важно, если потом будешь делать спрайт
    },
    "convertColors", // currentColor для изменения цвета через CSS
    "convertPathData",
    "mergePaths",
    "removeUselessStrokeAndFill",
    "sortAttrs",
  ],
};

async function ensureDir(dirPath) {
  if (!existsSync(dirPath)) {
    mkdirSync(dirPath, { recursive: true });
  }
}

async function optimizeSVG(inputPath, outputPath) {
  try {
    const svgContent = readFileSync(inputPath, "utf8");
    const result = optimize(svgContent, { ...svgoConfig, path: inputPath });

    if (result.error) throw new Error(result.error);

    writeFileSync(outputPath, result.data);
    console.log(`✅ Оптимизировано: ${relative(process.cwd(), inputPath)}`);
    return true;
  } catch (error) {
    console.warn(
      `⚠️ Ошибка SVGO: ${relative(
        process.cwd(),
        inputPath
      )} — копируем оригинал`
    );
    copyFileSync(inputPath, outputPath);
    return false;
  }
}

async function processDirectory(dirPath) {
  if (!existsSync(dirPath)) {
    console.log(
      `📁 Папка не найдена: ${dirPath}. Создай её и кинь SVG-иконки.`
    );
    return;
  }

  const items = readdirSync(dirPath);
  let total = 0;
  let optimized = 0;

  for (const item of items) {
    const itemPath = join(dirPath, item);
    const stat = statSync(itemPath);

    if (stat.isDirectory()) {
      await processDirectory(itemPath); // Рекурсия по подпапкам
    } else if (extname(item).toLowerCase() === ".svg") {
      total++;

      const relativePath = relative(SRC_DIR, dirname(itemPath));
      const targetDir = join(OUTPUT_DIR, relativePath);
      const outputPath = join(targetDir, item);

      await ensureDir(targetDir);

      if (await optimizeSVG(itemPath, outputPath)) {
        optimized++;
      }
    }
  }

  if (total > 0) {
    console.log(`\n📊 Обработано: ${optimized}/${total} SVG (оптимизировано)`);
  }
}

async function main() {
  console.log("🎨 Запуск оптимизации SVG-иконок...\n");

  await ensureDir(OUTPUT_DIR);
  await processDirectory(SRC_DIR);

  console.log("\n✨ Оптимизация SVG завершена!");
  console.log(`📁 Результат: ${OUTPUT_DIR} (доступно как /icons/...)`);
}

main().catch(console.error);
