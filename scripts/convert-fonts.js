import {
	readdirSync,
	existsSync,
	mkdirSync,
	writeFileSync,
	statSync,
	readFileSync,
} from 'fs';
import { resolve, extname, basename, join, relative, dirname } from 'path';
import ttf2woff from 'ttf2woff';
import ttf2woff2 from 'ttf2woff2';

const FONTS_DIR = 'src/assets/fonts';
const OUTPUT_DIR = 'public/fonts';

// Создаем output директорию если не существует
if (!existsSync(OUTPUT_DIR)) {
	mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Рекурсивный поиск шрифтов с сохранением структуры
function findFontFiles(dir) {
	let fontFiles = [];
	if (!existsSync(dir)) return fontFiles;
	const items = readdirSync(dir);
	for (const item of items) {
		const fullPath = join(dir, item);
		const stat = statSync(fullPath);
		if (stat.isDirectory()) {
			// Рекурсивно ищем в подпапках
			fontFiles = fontFiles.concat(findFontFiles(fullPath));
		} else if (item.endsWith('.ttf') || item.endsWith('.otf')) {
			fontFiles.push(fullPath);
		}
	}
	return fontFiles;
}

function convertFont(inputPath, outputBaseDir) {
	const fileName = basename(inputPath, extname(inputPath));
	// Получаем относительный путь от src/assets/fonts
	const relativePath = relative(FONTS_DIR, dirname(inputPath));
	const outputDir = relativePath
		? join(outputBaseDir, relativePath)
		: outputBaseDir;

	// Создаем выходную директорию если не существует
	if (!existsSync(outputDir)) {
		mkdirSync(outputDir, { recursive: true });
	}

	try {
		console.log(`Обработка файла: ${inputPath}`);

		// Читаем исходный шрифт
		const fontBuffer = readFileSync(inputPath);

		// Конвертация в WOFF2
		const woff2Output = resolve(outputDir, `${fileName}.woff2`);
		const woff2 = ttf2woff2(fontBuffer);
		writeFileSync(woff2Output, Buffer.from(woff2));
		console.log(
			`✅ Converted: ${relativePath ? relativePath + '/' : ''}${fileName}.woff2`
		);

		// Конвертация в WOFF
		const woffOutput = resolve(outputDir, `${fileName}.woff`);
		const woff = ttf2woff(fontBuffer).buffer;
		writeFileSync(woffOutput, Buffer.from(woff));
		console.log(
			`✅ Converted: ${relativePath ? relativePath + '/' : ''}${fileName}.woff`
		);

		// === ОПРЕДЕЛЕНИЕ WEIGHT И STYLE ПО ИМЕНИ ФАЙЛА ===
		let fontWeight = '400';
		let fontStyle = 'normal';

		const lowerName = fileName.toLowerCase();

		if (lowerName.includes('thin')) fontWeight = '100';
		else if (lowerName.includes('extralight')) fontWeight = '200';
		else if (lowerName.includes('light')) fontWeight = '300';
		else if (lowerName.includes('medium')) fontWeight = '500';
		else if (lowerName.includes('semibold')) fontWeight = '600';
		else if (lowerName.includes('bold')) fontWeight = '700';
		else if (lowerName.includes('extrabold')) fontWeight = '800';
		else if (lowerName.includes('black')) fontWeight = '900';
		// по умолчанию 400

		if (lowerName.includes('italic') || lowerName.includes('oblique')) {
			fontStyle = 'italic';
		}

		return {
			name: fileName,
			path: relativePath ? `${relativePath}/${fileName}` : fileName,
			family: relativePath || 'Default',
			weight: fontWeight,
			style: fontStyle,
		};
	} catch (error) {
		console.error(`❌ Error converting ${fileName}:`, error.message);
		return null;
	}
}

function generateFontCSS(convertedFonts) {
	const fontFaces = convertedFonts
		.filter(Boolean)
		.map((font) => {
			return `@font-face {
  font-family: '${font.family}';
  src: url('/fonts/${font.path}.woff2') format('woff2'),
       url('/fonts/${font.path}.woff') format('woff');
  font-weight: ${font.weight};
  font-style: ${font.style};
  font-display: swap;
}`;
		})
		.join('\n\n');

	return fontFaces;
}

// Основная функция
function convertFonts() {
	if (!existsSync(FONTS_DIR)) {
		console.log('📁 Creating fonts directory...');
		mkdirSync(FONTS_DIR, { recursive: true });
		console.log('Put your .ttf or .otf files in src/assets/fonts/ directory');
		return;
	}

	const fontFiles = findFontFiles(FONTS_DIR);

	if (fontFiles.length === 0) {
		console.log(
			'No font files found in src/assets/fonts/ (including subdirectories)'
		);
		return;
	}

	console.log(`🔄 Converting ${fontFiles.length} font(s)...`);
	console.log(
		'Found fonts:',
		fontFiles.map((f) => basename(f))
	);

	const convertedFonts = fontFiles.map((file) => {
		return convertFont(file, OUTPUT_DIR);
	});

	// Автоматически генерируем и сохраняем _fonts.scss
	if (convertedFonts.some((f) => f)) {
		const cssContent = generateFontCSS(convertedFonts);
		const fontsScssPath = 'src/scss/_fonts.scss'; // ← твой путь
		mkdirSync(dirname(fontsScssPath), { recursive: true });
		writeFileSync(fontsScssPath, cssContent + '\n');
		console.log('📝 Автоматически обновлён src/scss/_fonts.scss');
	}

	console.log('🎉 Font conversion completed!');
}

convertFonts();
