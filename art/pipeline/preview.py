"""7. 確認ページ preview.html を書き出す（ダブルクリックでブラウザに表示）。"""

import json

TEMPLATE = r"""<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>多幸寿 ドット絵確認</title>
<style>
  :root {
    --bg: #17131c; --panel: #221c29; --line: #3a3144; --text: #f3ead8;
    --muted: #b6a990; --accent: #f5b860;
  }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--bg); color: var(--text);
         font-family: "Yu Gothic UI", "Hiragino Sans", "Meiryo", sans-serif; line-height: 1.6; }
  header { padding: 28px 16px 8px; max-width: 1100px; margin: 0 auto; }
  h1 { margin: 0; font-size: 26px; letter-spacing: .04em; }
  h1 small { color: var(--accent); font-size: 15px; margin-left: 8px; }
  header p { color: var(--muted); margin: 6px 0 0; font-size: 14px; }
  main { max-width: 1100px; margin: 0 auto; padding: 0 16px 48px; }
  section { background: var(--panel); border: 1px solid var(--line); border-radius: 10px;
            padding: 16px; margin-top: 20px; }
  h2 { margin: 0 0 4px; font-size: 18px; }
  .note { color: var(--muted); font-size: 13px; margin: 0 0 12px; }
  .row { display: flex; flex-wrap: wrap; gap: 20px; align-items: flex-end; }
  figure { margin: 0; display: flex; flex-direction: column; gap: 6px; }
  figcaption { font-size: 12px; color: var(--muted); }
  .pair { display: flex; gap: 14px; align-items: flex-end; flex-wrap: wrap; }
  .stage { padding: 6px; border-radius: 6px; line-height: 0; max-width: 100%; overflow: auto; }
  .stage.check { background-color: #d8d2c4;
    background-image: linear-gradient(45deg, #bfb8a8 25%, transparent 25%, transparent 75%, #bfb8a8 75%),
                      linear-gradient(45deg, #bfb8a8 25%, transparent 25%, transparent 75%, #bfb8a8 75%);
    background-size: 16px 16px; background-position: 0 0, 8px 8px; }
  .stage.night { background: #2a2838; }
  img { image-rendering: crisp-edges; image-rendering: pixelated; display: block; }
  .controls { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; margin-bottom: 10px; }
  button { background: #3a3144; color: var(--text); border: 1px solid #564a63; border-radius: 6px;
           padding: 6px 12px; font-size: 14px; cursor: pointer; }
  button:hover { border-color: var(--accent); }
  .frame { font-variant-numeric: tabular-nums; color: var(--muted); font-size: 13px; }
  .strip { display: flex; gap: 4px; flex-wrap: wrap; margin-top: 12px; }
  .strip figure { gap: 2px; }
  .swatches { display: grid; grid-template-columns: repeat(auto-fill, minmax(84px, 1fr)); gap: 6px; }
  .sw { border: 1px solid var(--line); border-radius: 6px; overflow: hidden; font-size: 11px; }
  .sw div { height: 28px; }
  .sw span { display: block; padding: 2px 6px; color: var(--muted); font-family: Consolas, monospace; }
  .bgtoggle { margin-left: auto; }
  @media (max-width: 600px) { h1 { font-size: 21px; } }
</style>
</head>
<body>
<header>
  <h1>多幸寿 <small>Oh!Edo Taco Tuesday!! ドット絵試作</small></h1>
  <p>Blender の3Dモデルを自動でドット絵に変換した全画像です。左が等倍、右が4倍。
     <button class="bgtoggle" id="bgBtn">背景：夜 ⇄ 市松</button></p>
</header>
<main id="main"></main>
<script>
const DATA = __DATA__;
const main = document.getElementById("main");
let bg = "night";

function el(tag, attrs, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) e.setAttribute(k, v);
  for (const k of kids) e.append(k);
  return e;
}
function pixImg(src, w, h, scale) {
  return el("img", { src, width: w * scale, height: h * scale, alt: src });
}
function stage(child) { return el("div", { class: "stage " + bg }, child); }
function pair(src, w, h, label) {
  return el("figure", {},
    el("div", { class: "pair" },
      el("div", {}, stage(pixImg(src, w, h, 1)), el("figcaption", {}, "等倍")),
      el("div", {}, stage(pixImg(src, w, h, 4)), el("figcaption", {}, "4倍"))),
    el("figcaption", {}, label + "（" + w + "×" + h + "） " + src));
}
function section(title, note) {
  const s = el("section", {}, el("h2", {}, title), el("p", { class: "note" }, note));
  main.append(s);
  return s;
}
function anim(sec, frames, w, h, durations, gif) {
  const imgs = [1, 4].map(s => pixImg(frames[0], w, h, s));
  // 全コマを先に読み込んでおく
  frames.forEach(f => { const i = new Image(); i.src = f; });
  let idx = 0, playing = true, timer = null;
  const label = el("span", { class: "frame" }, "");
  const show = () => { imgs.forEach(im => im.src = frames[idx]); label.textContent = "コマ " + (idx + 1) + " / " + frames.length; };
  const tick = () => { show(); timer = setTimeout(() => { idx = (idx + 1) % frames.length; if (playing) tick(); }, durations[idx]); };
  const playBtn = el("button", {}, "一時停止");
  playBtn.onclick = () => { playing = !playing; playBtn.textContent = playing ? "一時停止" : "再生"; clearTimeout(timer); if (playing) tick(); };
  const step = d => { playing = false; playBtn.textContent = "再生"; clearTimeout(timer); idx = (idx + d + frames.length) % frames.length; show(); };
  const prev = el("button", {}, "◀ 前のコマ"); prev.onclick = () => step(-1);
  const next = el("button", {}, "次のコマ ▶"); next.onclick = () => step(1);
  sec.append(el("div", { class: "controls" }, playBtn, prev, next, label));
  sec.append(el("div", { class: "pair" },
    el("div", {}, stage(imgs[0]), el("figcaption", {}, "等倍")),
    el("div", {}, stage(imgs[1]), el("figcaption", {}, "4倍"))));
  const strip = el("div", { class: "strip" });
  frames.forEach((f, i) => strip.append(el("figure", {}, stage(pixImg(f, w, h, 1)), el("figcaption", {}, String(i + 1)))));
  sec.append(el("p", { class: "note", style: "margin-top:12px" }, "連番PNG（全コマ・等倍）"), strip);
  sec.append(el("p", { class: "note", style: "margin-top:12px" }, "確認用GIF（4倍）: " + gif),
             stage(el("img", { src: gif, alt: gif, style: "max-width:100%;height:auto" })));
  tick();
}

function render() {
  main.innerHTML = "";
  let s = section("タコス", "5.1 真上 / 5.2 斜め上（約45度）。具材をのせた開いたタコス。");
  const row = el("div", { class: "row" });
  row.append(pair("output/taco/taco_top.png", 128, 128, "真上"));
  row.append(pair("output/taco/taco_oblique.png", 128, 128, "斜め上"));
  s.append(row);

  s = section("トルティーヤを折りたたむアニメ", "5.3 真上・" + DATA.fold.length + "コマ。");
  anim(s, DATA.fold, 128, 128, DATA.foldDur, "output/taco_fold/taco_fold_x4.gif");

  s = section("具材アイコン", "5.4 32×32px。");
  const irow = el("div", { class: "row" });
  DATA.icons.forEach(ic => irow.append(pair(ic.src, 32, 32, ic.label)));
  s.append(irow);

  s = section("暖簾「多幸寿」", "6.3 開店カットイン用・" + DATA.noren.length + "コマでループ・240×160px（スマホ縦画面の横幅いっぱい想定）。");
  anim(s, DATA.noren, 240, 160, DATA.norenDur, "output/noren/noren_x4.gif");

  s = section("固定パレット", DATA.palette.length + "色（最初の1色は輪郭線専用）。すべての画像がこの色だけでできています。");
  const sw = el("div", { class: "swatches" });
  DATA.palette.forEach(c => sw.append(el("div", { class: "sw" }, el("div", { style: "background:" + c }), el("span", {}, c))));
  s.append(sw);
}
document.getElementById("bgBtn").onclick = () => { bg = bg === "night" ? "check" : "night"; render(); };
render();
</script>
</body>
</html>
"""


def write(path, names, labels, fold_frames, noren_frames, palette):
    data = {
        "fold": [f"output/taco_fold/taco_fold_{i:02d}.png" for i in range(fold_frames)],
        "foldDur": [700] + [110] * (fold_frames - 2) + [900],
        "noren": [f"output/noren/noren_{i:02d}.png" for i in range(noren_frames)],
        "norenDur": [120] * noren_frames,
        "icons": [{"src": f"output/icons/icon_{n}.png", "label": labels[n]} for n in names],
        "palette": palette,
    }
    with open(path, "w", encoding="utf-8", newline="\n") as f:
        f.write(TEMPLATE.replace("__DATA__", json.dumps(data, ensure_ascii=False)))
