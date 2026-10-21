// 서버 없이 도는 정적 버전 만들기: node tools/static.js ../rocket
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const out = path.resolve(process.argv[2] || path.join(ROOT, '..', 'rocket'));
const THREE = path.dirname(path.dirname(require.resolve('three')));
const JSM = ['postprocessing/EffectComposer', 'postprocessing/RenderPass', 'postprocessing/UnrealBloomPass', 'postprocessing/OutputPass', 'postprocessing/ShaderPass', 'postprocessing/MaskPass', 'postprocessing/Pass', 'environments/RoomEnvironment', 'shaders/CopyShader', 'shaders/LuminosityHighPassShader', 'shaders/OutputShader'];
const cp = (from, to) => { fs.mkdirSync(path.dirname(to), { recursive: true }); fs.copyFileSync(from, to); };
fs.rmSync(out, { recursive: true, force: true });
cp(path.join(ROOT, 'public', 'index.html'), path.join(out, 'index.html'));
cp(path.join(ROOT, 'public', 'game.js'), path.join(out, 'game.js'));
cp(path.join(ROOT, 'shared', 'rk.js'), path.join(out, 'shared', 'rk.js'));
cp(path.join(ROOT, 'server', 'game.js'), path.join(out, 'room.js'));
cp(path.join(THREE, 'build', 'three.module.js'), path.join(out, 'vendor', 'three', 'build', 'three.module.js'));
cp(path.join(THREE, 'LICENSE'), path.join(out, 'vendor', 'three', 'LICENSE'));
for (const f of JSM) cp(path.join(THREE, 'examples', 'jsm', f + '.js'), path.join(out, 'vendor', 'three', 'examples', 'jsm', f + '.js'));
console.log('정적 버전 만듦: ' + out);
