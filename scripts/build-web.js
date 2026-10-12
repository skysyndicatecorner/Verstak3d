// Собирает автономную веб-версию в один HTML-файл: dist-web/Verstak3D.html
// Её можно открыть двойным щелчком в любом браузере — интернет не нужен.
'use strict';
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..', 'app');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
let html = read('index.html');

html = html.replace(/<meta http-equiv="Content-Security-Policy"[^>]*>\n?/, '');
const icon = 'data:image/png;base64,' + fs.readFileSync(path.join(root, 'icon.png')).toString('base64');
html = html.replace('<link rel="icon" href="icon.png">', `<link rel="icon" href="${icon}">`);
html = html.replace('<link rel="stylesheet" href="styles.css">', () => `<style>\n${read('styles.css')}\n</style>`);
html = html.replace(/<script src="([^"]+)"><\/script>/g, (_m, src) => `<script>\n${read(src).replace(/<\/script/gi, '<\\/script')}\n</script>`);

const out = path.join(__dirname, '..', 'dist-web');
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, 'Verstak3D.html'), html);
console.log('Готово: dist-web/Verstak3D.html (' + Math.round(html.length / 1024) + ' КБ)');
