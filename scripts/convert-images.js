import { readdirSync, existsSync, mkdirSync, statSync } from 'fs';
import { join, extname, basename, dirname, relative } from 'path';
import sharp from 'sharp';

const SRC_DIR = 'src/assets/img'; // ← Исходники (кидай сюда изображения)
const OUTPUT_DIR = 'public/images'; // ← Результат (Vite скопирует в корень билда)

const SUPPORTED_FORMATS = [
	'.jpg',
	'.jpeg',
	'.png',
	'.webp',
	'.tiff',
	'.gif',
	'.bmp',
];

const args = process.argv.slice(2);
const targetPath = args[0]; // Опционально: путь к файлу или папке

async function ensureDir(dirPath) {
	if (!existsSync(dirPath)) {
		mkdirSync(dirPath, { recursive: true });
	}
}

async function convertImage(inputPath, filename) {
	const baseName = basename(filename, extname(filename));
	const relativePath = relative(SRC_DIR, dirname(inputPath));
	const targetDir = join(OUTPUT_DIR, relativePath);

	await ensureDir(targetDir);

	const outputPaths = {
		avif: join(targetDir, `${baseName}.avif`),
		webp: join(targetDir, `${baseName}.webp`),
		original: join(targetDir, `${baseName}${extname(filename)}`),
	};

	try {
		const image = sharp(inputPath);

		// AVIF — лучший формат 2025 года
		await image
			.clone()
			.avif({ quality: 80, effort: 4, chromaSubsampling: '4:2:0' })
			.toFile(outputPaths.avif);

		// WebP — fallback для старых браузеров
		await image
			.clone()
			.webp({ quality: 85, effort: 4, method: 6 })
			.toFile(outputPaths.webp);

		// Оптимизация оригинала
		const ext = extname(filename).toLowerCase();
		if (ext === '.jpg' || ext === '.jpeg') {
			await image
				.clone()
				.jpeg({ quality: 90, progressive: true, mozjpeg: true })
				.toFile(outputPaths.original);
		} else if (ext === '.png') {
			await image
				.clone()
				.png({ quality: 90, compressionLevel: 9, progressive: true })
				.toFile(outputPaths.original);
		} else {
			await image.clone().toFile(outputPaths.original);
		}

		console.log(
			`✅ Обработано: ${relative(SRC_DIR, inputPath)} → avif + webp + оригинал`
		);
		return true;
	} catch (error) {
		console.error(`❌ Ошибка: ${filename} — ${error.message}`);
		return false;
	}
}

async function processDirectory(dirPath) {
	if (!existsSync(dirPath)) {
		console.log(`📁 Папка не найдена: ${dirPath}`);
		return;
	}

	const items = readdirSync(dirPath);
	let total = 0;
	let success = 0;

	for (const item of items) {
		const itemPath = join(dirPath, item);
		const stat = statSync(itemPath);

		if (stat.isDirectory()) {
			await processDirectory(itemPath); // Рекурсия в подпапки
		} else if (stat.isFile()) {
			const ext = extname(item).toLowerCase();
			if (SUPPORTED_FORMATS.includes(ext)) {
				total++;
				if (await convertImage(itemPath, item)) success++;
			}
		}
	}

	if (total > 0) {
		console.log(`\n📊 В папке ${dirPath}: ${success}/${total} обработано`);
	}
}

async function main() {
	console.log('🖼️  Запуск оптимизации изображений...\n');
	await ensureDir(OUTPUT_DIR);

	if (targetPath) {
		const fullPath = join(process.cwd(), targetPath);
		if (!existsSync(fullPath)) {
			console.error(`❌ Путь не найден: ${targetPath}`);
			return;
		}

		const stat = statSync(fullPath);
		if (stat.isFile()) {
			const ext = extname(fullPath).toLowerCase();
			if (SUPPORTED_FORMATS.includes(ext)) {
				await convertImage(fullPath, basename(fullPath));
			} else {
				console.error(`❌ Неподдерживаемый формат: ${ext}`);
			}
		} else if (stat.isDirectory()) {
			await processDirectory(fullPath);
		}
	} else {
		// Обрабатываем всю папку src/assets/img
		console.log(`📂 Обрабатываем все изображения из: ${SRC_DIR}`);
		await processDirectory(SRC_DIR);
	}

	console.log('\n✨ Оптимизация завершена!');
	console.log(`📁 Результаты в: ${OUTPUT_DIR}`);
	console.log('\n💡 Форматы:');
	console.log('   • .avif  — лучший (Chrome, Firefox, Safari 16+)');
	console.log('   • .webp  — широкий fallback');
	console.log('   • оригинал — оптимизированный');
}

main().catch(console.error);
