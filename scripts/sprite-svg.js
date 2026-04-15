import {
  readFileSync,
  readdirSync,
  writeFileSync,
  mkdirSync,
  existsSync,
} from "fs";
import { resolve, join } from "path";
import svgSprite from "svg-sprite";
import { load } from "cheerio";

const srcIconsDir = resolve(process.cwd(), "src/assets/icons");
const outputDir = resolve(process.cwd(), "public/icons"); // ← public!
const spritePath = join(outputDir, "sprite.svg");

export default function viteSvgSpritePlugin() {
  return {
    name: "vite-svg-sprite",

    configureServer(server) {
      server.watcher.add(srcIconsDir);

      const regenerate = async (file) => {
        if (file.endsWith(".svg") && file.includes("icons")) {
          await generateSprite();
          server.ws.send({ type: "full-reload" });
        }
      };

      server.watcher
        .on("add", regenerate)
        .on("change", regenerate)
        .on("unlink", regenerate); // если удалишь иконку — тоже обновит
    },

    buildStart() {
      generateSprite();
    },
  };
}

async function generateSprite() {
  if (!existsSync(srcIconsDir)) return;

  const files = readdirSync(srcIconsDir).filter((f) => f.endsWith(".svg"));
  if (files.length === 0) return;

  const spriter = svgSprite({
    mode: {
      stack: {
        sprite: "sprite.svg",
        example: false,
      },
    },
    shape: {
      // id = имя файла без .svg (burger.svg → id="burger")
      id: {
        generator: (name) => name.replace(/\.svg$/i, ""),
      },
      transform: [
        {
          svgo: {
            plugins: [
              { name: "removeXMLNS" },
              { name: "removeDimensions" },
              { name: "removeViewBox", active: false },
              { name: "cleanupAttrs" },
              { name: "removeEmptyAttrs" },
              { name: "removeHiddenElems" },
              { name: "convertStyleToAttrs" },
            ],
          },
        },
      ],
    },
  });

  for (const file of files) {
    const content = readFileSync(join(srcIconsDir, file), "utf-8");

    // Точная очистка как в твоём старом Gulp
    const $ = load(content, { xmlMode: true }, false);
    $("[fill]").removeAttr("fill");
    $("[style]").removeAttr("style");

    let cleaned = $("svg").first().toString();
    cleaned = cleaned.replace(/&gt;/g, ">");

    // Добавляем в спрайт (больше никакой лишней оптимизации!)
    spriter.add(join(srcIconsDir, file), file, cleaned);
  }

  const { result } = await spriter.compileAsync();
  const spriteContent = result.stack.sprite.contents.toString();

  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  writeFileSync(spritePath, spriteContent);

  console.log(
    `✅ SVG Sprite generated → ${spritePath} (${files.length} иконок)`
  );
}
