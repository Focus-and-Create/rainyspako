#!/usr/bin/env node
/**
 * build.js
 * JS/CSS 미니파이 + dist 폴더 생성
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const DIST = path.join(__dirname, 'dist');

// 1) dist 폴더 초기화
if (fs.existsSync(DIST)) fs.rmSync(DIST, { recursive: true });
fs.mkdirSync(DIST, { recursive: true });

// 2) JS 파일 목록 (로드 순서 유지)
const jsFiles = [
    'supabase-config.js',
    'config.js',
    'auth-client.js',
    'storage.js',
    'word-manager.js',
    'game.js',
    'stage-map.js',
    'stage-grid.js',
    'match-game.js',
    'main.js'
];

// 3) 각 JS 파일 개별 미니파이 (esbuild)
for (const file of jsFiles) {
    const src = path.join(__dirname, file);
    const out = path.join(DIST, file);
    if (!fs.existsSync(src)) { console.warn(`skip: ${file}`); continue; }
    execSync(`npx esbuild "${src}" --minify --outfile="${out}"`, { stdio: 'inherit' });
}

// 4) CSS 미니파이 (clean-css)
const CleanCSS = require('clean-css');
const cssIn = fs.readFileSync(path.join(__dirname, 'style.css'), 'utf8');
const cssOut = new CleanCSS({ level: 2 }).minify(cssIn);
fs.writeFileSync(path.join(DIST, 'style.css'), cssOut.styles);
console.log(`style.css: ${(cssIn.length / 1024).toFixed(1)}KB → ${(cssOut.styles.length / 1024).toFixed(1)}KB`);

// 5) HTML 복사 (캐시 버스트 갱신)
let html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const stamp = Date.now().toString(36);
html = html.replace(/\?v=\d+/g, `?v=${stamp}`);
fs.writeFileSync(path.join(DIST, 'index.html'), html);

// 6) 정적 파일 복사
const staticFiles = [
    'favicon.svg',
    'manifest.json',
    ...Array.from({ length: 10 }, (_, i) => `world${i + 1}.json`),
    'skills-lock.json'
];
for (const file of staticFiles) {
    const src = path.join(__dirname, file);
    if (fs.existsSync(src)) fs.copyFileSync(src, path.join(DIST, file));
}

console.log(`\n✓ Build complete → dist/`);
