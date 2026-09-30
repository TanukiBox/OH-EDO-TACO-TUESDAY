# ライセンス一覧

このリポジトリで使っている外部の素材・ツールと、そのライセンスです。
画像生成AIは使っていません。絵はすべて Blender の3Dモデルとプログラムで作っています。

## フォント

| フォント | 用途 | ライセンス | 商用利用 | 入手元 |
|---|---|---|---|---|
| Yuji Syuku（ユジ・シュク）Regular | 暖簾「多幸寿」の筆文字、タイトルの「多幸寿」 | SIL Open Font License 1.1 | 可 | Google Fonts（[google/fonts リポジトリ](https://github.com/google/fonts/tree/main/ofl/yujisyuku)） |
| M PLUS Rounded 1c | ゲーム画面の文字 | SIL Open Font License 1.1 | 可 | Google Fonts（ブラウザが読み込む。ファイルは同梱していない） |
| Mochiy Pop One | タイトルロゴ（英字）・ゲームの大きな数字 | SIL Open Font License 1.1 | 可 | Google Fonts（ロゴ作成用に [art/assets/fonts/MochiyPopOne-Regular.ttf](art/assets/fonts/MochiyPopOne-Regular.ttf) を同梱。ゲーム画面ではブラウザが読み込む） |

- Yuji Syuku の著作権表示：Copyright 2021 The Yuji Project Authors (https://github.com/Kinutafontfactory/Yuji)
  ライセンス全文：[art/assets/fonts/OFL.txt](art/assets/fonts/OFL.txt)
- Mochiy Pop One の著作権表示：Copyright 2020 The Mochiypop Project Authors (https://github.com/fontdasu/Mochiypop)
  ライセンス全文：[art/assets/fonts/OFL-MochiyPopOne.txt](art/assets/fonts/OFL-MochiyPopOne.txt)
- M PLUS Rounded 1c：Copyright 2016 The M+ Project Authors。ブラウザが Google Fonts から読み込む（SIL OFL 1.1）
- 取得日：2026-10-01
- SIL OFL 1.1 の要点
  - ゲームの画像にフォントの文字を使うこと（画像として焼き込むこと）は、商用でも自由にできます。
  - フォントファイル自体を配る場合は、ライセンス文を一緒に付ける必要があります（このリポジトリでは同梱済み）。
  - フォントファイルを単体で販売することはできません。
  - フォントを改変して配る場合は「Yuji」の名前を使えません（改変はしていません）。

## 音
効果音・BGM は音声ファイルを使わず、ブラウザの中で合成しています（Tanuki Box 共通土台の `js/common/tb-sound.js`、BGM の楽譜は `js/game/bgm.js`、効果音は `js/game/sfx.js`）。
外部の音素材・楽曲は使っていません（すべてこのプロジェクトのオリジナル）。

## ツール・ライブラリ（完成画像には含まれません）

| 名前 | 用途 | ライセンス |
|---|---|---|
| Blender 5.2 | 3Dモデルの生成とレンダリング | GNU GPL v3（Blender で作った画像・モデルは作者のものになり、GPL の対象外） |
| Pillow | 画像の縮小・減色・PNG/GIF 書き出し | MIT-CMU License |
| numpy | 画像の計算 | BSD 3-Clause License |
| FFmpeg（imageio-ffmpeg 経由） | プレイ動画（`art/output/game/play.mp4`）の変換 | LGPL/GPL（道具として使っただけで、ゲームには含まれない） |
| Playwright | 自動テストとプレイ動画の録画 | Apache License 2.0（道具として使っただけで、ゲームには含まれない） |

## このリポジトリで作ったもの

`js/` のゲームのプログラム、`art/` の絵の仕組み（`art/blender/`・`art/pipeline/`・`art/build.py`）と `art/output/` の画像は
このプロジェクト（TanukiBox）のオリジナルです。
