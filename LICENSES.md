# ライセンス一覧

このリポジトリで使っている外部の素材・ツールと、そのライセンスです。
画像生成AIは使っていません。絵はすべて Blender の3Dモデルとプログラムで作っています。

## フォント

| フォント | 用途 | ライセンス | 商用利用 | 入手元 |
|---|---|---|---|---|
| Yuji Syuku（ユジ・シュク）Regular | 暖簾「多幸寿」の筆文字、タイトルの「多幸寿」 | SIL Open Font License 1.1 | 可 | Google Fonts（[google/fonts リポジトリ](https://github.com/google/fonts/tree/main/ofl/yujisyuku)） |
| M PLUS Rounded 1c | ゲーム画面の文字 | SIL Open Font License 1.1 | 可 | Google Fonts（ブラウザが読み込む。ファイルは同梱していない） |
| Mochiy Pop One | ゲームのロゴ・大きな数字 | SIL Open Font License 1.1 | 可 | Google Fonts（ブラウザが読み込む。ファイルは同梱していない） |

- 著作権表示：Copyright 2021 The Yuji Project Authors (https://github.com/Kinutafontfactory/Yuji)
- ライセンス全文：[art/assets/fonts/OFL.txt](art/assets/fonts/OFL.txt)（フォントファイルと同じフォルダに同梱）
- 取得日：2026-10-01
- SIL OFL 1.1 の要点
  - ゲームの画像にフォントの文字を使うこと（画像として焼き込むこと）は、商用でも自由にできます。
  - フォントファイル自体を配る場合は、ライセンス文を一緒に付ける必要があります（このリポジトリでは同梱済み）。
  - フォントファイルを単体で販売することはできません。
  - フォントを改変して配る場合は「Yuji」の名前を使えません（改変はしていません）。

## 音
効果音・BGM は音声ファイルを使わず、ブラウザの中で合成しています（Tanuki Box 共通土台の `js/common/tb-sound.js`）。外部の音素材は使っていません。

## ツール・ライブラリ（完成画像には含まれません）

| 名前 | 用途 | ライセンス |
|---|---|---|
| Blender 5.2 | 3Dモデルの生成とレンダリング | GNU GPL v3（Blender で作った画像・モデルは作者のものになり、GPL の対象外） |
| Pillow | 画像の縮小・減色・PNG/GIF 書き出し | MIT-CMU License |
| numpy | 画像の計算 | BSD 3-Clause License |

## このリポジトリで作ったもの

`js/` のゲームのプログラム、`art/` の絵の仕組み（`art/blender/`・`art/pipeline/`・`art/build.py`）と `art/output/` の画像は
このプロジェクト（TanukiBox）のオリジナルです。
