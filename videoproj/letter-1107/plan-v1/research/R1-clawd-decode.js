// 按 Claude Code 2.1.319 的渲染规则，把象限块字符还原成子像素矩阵
// 0=透明 1=身体橙 2=黑(clawd_background 透出, 即眼睛) 3=眼睑(子像素下半黑)
const Q = {
  ' ': [0,0,0,0], '\u2598':[1,0,0,0], '\u259D':[0,1,0,0], '\u2596':[0,0,1,0], '\u2597':[0,0,0,1],
  '\u258C':[1,0,1,0], '\u2590':[0,1,0,1], '\u2580':[1,1,0,0], '\u2584':[0,0,1,1], '\u2588':[1,1,1,1],
  '\u259B':[1,1,1,0], '\u259C':[1,1,0,1], '\u2599':[1,0,1,1], '\u259F':[0,1,1,1], '\u259A':[1,0,0,1], '\u259E':[0,1,1,0],
};
const W = 9;
function grid(rows) { return Array.from({length: rows*2}, () => Array(W*2).fill(0)); }
function put(g, row, col, ch, blackBg, lid) {
  if (lid) { // ▂ 以黑色前景画在橙色背景上
    g[row*2][col*2]=1; g[row*2][col*2+1]=1; g[row*2+1][col*2]=3; g[row*2+1][col*2+1]=3; return;
  }
  const q = Q[ch]; if (!q) throw new Error('unknown '+ch.codePointAt(0).toString(16));
  const cells = [[0,0],[0,1],[1,0],[1,1]];
  cells.forEach(([dy,dx],i) => { g[row*2+dy][col*2+dx] = q[i] ? 1 : (blackBg ? 2 : 0); });
}
const ARMS = {down:{r1L:" \u2590",r1R:"",r2L:"\u259D\u259C",r2R:"\u2588\u2580"},up:{r1L:"\u2597\u259F",r1R:"\u2584",r2L:" \u259C",r2R:"\u2588\u2598"},"one-up":{r1L:" \u2590",r1R:"\u2584",r2L:"\u259D\u259C",r2R:"\u2588\u2598"}};
const EYES = {open:[{glyphs:"\u259B\u2588\u2588\u2588\u259B\u2588"}],left:[{glyphs:"\u259F\u2588\u2588\u2588\u259F\u2588"}],right:[{glyphs:"\u2588\u259F\u2588\u2588\u2588\u259F"}],closed:[{glyphs:"\u2582",lid:true},{glyphs:"\u2588\u2588\u2588"},{glyphs:"\u2582",lid:true},{glyphs:"\u2588"}],wink:[{glyphs:"\u259B\u2588\u2588\u2588"},{glyphs:"\u2582",lid:true},{glyphs:"\u2588"}]};
const FEET = {both:" \u259D\u259D   \u259D\u259D ",left:" \u259D\u259D      ",right:"      \u259D\u259D "};
const FACING = {"right-12":[{glyphs:" \u2590\u2588\u259C\u2588\u2588\u259B\u2588 ",from:2,to:8},{glyphs:"\u259D\u259C\u2588\u2588\u2588\u2588\u2588\u2588\u2580",from:2,to:7},{glyphs:" \u259D\u259D   \u259D\u259D ",from:0,to:0}],"right-30":[{glyphs:"  \u2588\u259B\u2588\u2588\u259B\u258C ",from:2,to:7},{glyphs:" \u259D\u2588\u2588\u2588\u2588\u2588\u259B ",from:2,to:7},{glyphs:"  \u2598\u2598  \u2598\u2598 ",from:0,to:0}],"right-55":[{glyphs:"  \u2590\u2588\u259B\u2588\u259C  ",from:3,to:7},{glyphs:"  \u2590\u2588\u2588\u2588\u2588  ",from:3,to:7},{glyphs:"  \u259D\u259D \u259D\u259D  ",from:0,to:0}],"right-75":[{glyphs:"   \u2588\u2588\u259B\u258C  ",from:3,to:6},{glyphs:"   \u2588\u2588\u2588\u258C  ",from:3,to:6},{glyphs:"   \u2598  \u2598  ",from:0,to:0}],edge:[{glyphs:"   \u2590\u2588\u2588   ",from:4,to:6},{glyphs:"   \u2590\u2588\u2588   ",from:4,to:6},{glyphs:"   \u259D \u259D   ",from:0,to:0}],"back-105":[{glyphs:"   \u2588\u2588\u2588\u258C  ",from:3,to:6},{glyphs:"   \u2588\u2588\u2588\u258C  ",from:3,to:6},{glyphs:"   \u2598  \u2598  ",from:0,to:0}],"back-125":[{glyphs:"  \u2590\u2588\u2588\u2588\u2588  ",from:3,to:7},{glyphs:"  \u2590\u2588\u2588\u2588\u2588  ",from:3,to:7},{glyphs:"  \u259D\u259D \u259D\u259D  ",from:0,to:0}],"back-150":[{glyphs:"  \u2588\u2588\u2588\u2588\u2588\u258C ",from:2,to:7},{glyphs:" \u259D\u2588\u2588\u2588\u2588\u2588\u259B ",from:2,to:7},{glyphs:"  \u2598\u2598  \u2598\u2598 ",from:0,to:0}],back:[{glyphs:" \u2590\u2588\u2588\u2588\u2588\u2588\u2588 ",from:2,to:8},{glyphs:"\u259D\u259C\u2588\u2588\u2588\u2588\u2588\u2588\u2580",from:2,to:7},{glyphs:" \u259D\u259D   \u259D\u259D ",from:0,to:0}],"left-75":[{glyphs:"   \u259B\u2588\u2588\u258C  ",from:3,to:6},{glyphs:"   \u2588\u2588\u2588\u258C  ",from:3,to:6},{glyphs:"   \u2598  \u2598  ",from:0,to:0}],"left-55":[{glyphs:"  \u2590\u259C\u259B\u2588\u2588  ",from:3,to:7},{glyphs:"  \u2590\u2588\u2588\u2588\u2588  ",from:3,to:7},{glyphs:"  \u259D\u259D \u259D\u259D  ",from:0,to:0}],"left-30":[{glyphs:"  \u259B\u2588\u2588\u259B\u2588\u258C ",from:2,to:7},{glyphs:" \u259D\u2588\u2588\u2588\u2588\u2588\u259B ",from:2,to:7},{glyphs:"  \u2598\u2598  \u2598\u2598 ",from:0,to:0}],"left-12":[{glyphs:" \u2590\u259B\u2588\u2588\u2588\u259C\u2588 ",from:2,to:8},{glyphs:"\u259D\u259C\u2588\u2588\u2588\u2588\u2588\u2588\u2580",from:2,to:7},{glyphs:" \u259D\u259D   \u259D\u259D ",from:0,to:0}]};

function pose(eyes, arms, feet) {
  const g = grid(3), A = ARMS[arms];
  [...A.r1L].forEach((c,i)=>put(g,0,i,c,false));
  let col = 2;
  for (const s of EYES[eyes]) { [...s.glyphs].forEach((c,i)=>put(g,0,col+i,c,true,s.lid)); col += [...s.glyphs].length; }
  [...A.r1R].forEach((c,i)=>put(g,0,8+i,c,false));
  [...A.r2L].forEach((c,i)=>put(g,1,i,c,false));
  [..."\u2588\u2588\u2588\u2588\u2588"].forEach((c,i)=>put(g,1,2+i,c,true));
  [...A.r2R].forEach((c,i)=>put(g,1,7+i,c,false));
  [...FEET[feet]].forEach((c,i)=>put(g,2,i,c,false));
  return g.slice(0,5); // 第 6 子行恒为空(脚只用上半格)
}
function facing(name) {
  const g = grid(3);
  FACING[name].forEach((r,row)=>[...r.glyphs].forEach((c,i)=>put(g,row,i,c, i>=r.from && i<r.to)));
  return g.slice(0,5);
}
const sym = ['.', '#', 'o', '_'];
const show = (n,g) => `### ${n}\n\`\`\`\n${g.map(r=>r.map(v=>sym[v]).join('')).join('\n')}\n\`\`\`\n`;
let out = '';
const P = {default:['open','down','both'],'arms-up':['open','up','both'],'look-left':['left','down','both'],'look-right':['right','down','both'],'one-up':['open','one-up','both'],closed:['closed','down','both'],wink:['wink','down','both'],'feet-left(走路帧A)':['open','down','left'],'feet-right(走路帧B)':['open','down','right']};
for (const [k,v] of Object.entries(P)) out += show(k, pose(...v));
for (const k of Object.keys(FACING)) out += show('facing '+k, facing(k));
const json = {}; for (const [k,v] of Object.entries(P)) json[k]=pose(...v).map(r=>r.join('')); for (const k of Object.keys(FACING)) json['facing:'+k]=facing(k).map(r=>r.join(''));
require('fs').writeFileSync(__dirname+'/poses.md', out); require('fs').writeFileSync(__dirname+'/poses.json', JSON.stringify(json,null,1));
console.log(out);

// ===== 正方形网格版: 每个子像素 -> 1宽x2高 的正方形块, 并裁掉恒空的第0列 => 17x10
function toSquare(g) {
  const out = [];
  for (const r of g) {
    const top = r.slice(1).map(v => v === 3 ? 1 : v);
    const bot = r.slice(1).map(v => v === 3 ? 2 : v);
    out.push(top, bot);
  }
  return out;
}
const sq = {};
for (const [k,v] of Object.entries(P)) sq[k] = toSquare(pose(...v));
for (const k of Object.keys(FACING)) sq['facing:'+k] = toSquare(facing(k));
let md = '';
for (const [k,g] of Object.entries(sq)) md += `#### ${k}\n\`\`\`\n${g.map(r=>r.map(v=>['.','#','o'][v]).join('')).join('\n')}\n\`\`\`\n`;
const sqJson = {}; for (const [k,g] of Object.entries(sq)) sqJson[k] = g.map(r=>r.join(''));
require('fs').writeFileSync(__dirname+'/square.md', md);
require('fs').writeFileSync(__dirname+'/square.json', JSON.stringify(sqJson,null,1));
// SVG rect 列表(default, u=10, 橙=#D77757 黑=#000)
const g0 = sq['default']; let rects = [];
g0.forEach((r,y)=>r.forEach((v,x)=>{ if(v) rects.push(`<rect x="${x*10}" y="${y*10}" width="10" height="10" fill="${v===1?'#D77757':'#000000'}"/>`); }));
require('fs').writeFileSync(__dirname+'/default.svg', `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 170 100" width="340" height="200" shape-rendering="crispEdges">\n${rects.join('\n')}\n</svg>\n`);