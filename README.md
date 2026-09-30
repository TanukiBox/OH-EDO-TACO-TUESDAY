# Oh!Edo Taco Tuesday!!（多幸寿）

江戸時代にタイムスリップしたタコス職人が、屋台「多幸寿（タコス）」を営む料理ゲーム。
昼は江戸の町でミニゲームをして食材を仕入れ、夜は屋台で客の注文を聞いてタコスを作る。
スマホ縦画面とPCで遊べる無料ブラウザゲーム（Tanuki Box）。

- 確認用URL：https://tanukibox.github.io/OH-EDO-TACO-TUESDAY/
- 物語：[story.md](story.md)　／　紹介メモ（日英）：[INTRO.md](INTRO.md)　／　実機チェック：[CHECKLIST.md](CHECKLIST.md)
- 絵の仕組み（Blender の3Dモデル → ドット絵）：[art/README.md](art/README.md)
- ライセンス：[LICENSES.md](LICENSES.md)

---

## 数字やことばを直すとき（いちばんよく使う2つのファイル）

| 直したいもの | ファイル |
|---|---|
| 値段・味・客の好み・時間・競りの相場・ランクの境目・物語の場面を出す日など、**数値すべて** | [js/game/config.js](js/game/config.js) |
| 食材やタコスの名前・画面の文字・客のセリフ・**物語の会話**（**日本語と英語**） | [js/game/text.js](js/game/text.js) |

書きかえたら、ブラウザで再読み込みすると反映されます（公開ページは、GitHub に上げてから1〜2分後）。
数字だけを変え、`,` や `'` や `{ }` `[ ]` は消さないように気をつけてください。

### 調整のしかた（例）
| やりたいこと | config.js のどこ | 例 |
|---|---|---|
| ゲームを全体に早く／ゆっくり進めたい | `RANKS`（評判ランクの境目） | `[0, 25, 85, 210, 420]` を `[0, 20, 70, 170, 340]` にすると早く進む |
| 評判の上がり方を変えたい | `REP.perStar`（星1〜3の客1人ごと） | `[0, 0, 2, 4]` の最後を 5 にすると星3が効く |
| 夜の営業を長く／短くしたい | `DAY.nightSeconds` | 180 = 約3分 |
| 客の来る間隔を変えたい | `DAY.arrivalMin` / `arrivalMax` / `busier` | 小さくすると忙しくなる |
| 客を待たせられる時間 | `CUSTOMERS.○○.patience` | 秒。大きくするとやさしくなる |
| 星3の出やすさ | `RATING.star3` / `star2` | 下げると星が出やすい |
| タコスの値段 | `TACOS.○○.price` | 文 |
| 食材の味 | `INGREDIENTS.○○.taste` | `[辛, 酸, 旨, 香, 食感]` |
| 客の好み | `CUSTOMERS.○○.want`（好きな味の強さ）と `weight`（どれを気にするか） | |
| 競りの値段の上下 | `AUCTION.priceLow` / `priceHigh` / `fish.○○.base` | |
| 一本釣りの難しさ | `FISHING.reelSpeed` / `tensionUp` / `fish.○○.pull` | reelSpeed を上げるとやさしい |
| 抜け荷の見つかりやすさ | `SMUGGLE.spotTime` / `walkSpeed` | spotTime を上げるとやさしい |
| 物語の場面の時期 | `EVENTS` の `chapter`・`chapterDay` | 例：お城の使いは第5章の5日目から |

### 新しいタコスを足すとき
1. `config.js` の `TACOS` に1行足す（`skin` 皮・`need` 必要な食材・`price` 値段・`chapter` 何章から）。
2. `text.js` の日本語と英語の両方に `'taco.名前': '表示する名前'` を足す。
3. 新しい食材が要るときは、`INGREDIENTS`・`text.js` の `'ing.名前'`・（買えるようにするなら）`SHOPS` に足し、
   絵は [art/README.md](art/README.md) の手順で `art/blender/foods.py` に1行足して `python art/build.py` を実行。

---

## ファイルの役割
| 場所 | 中身 |
|---|---|
| `index.html` / `style.css` | ゲームの入れ物と見た目 |
| `js/common/` | Tanuki Box の共通土台（日英自動切替・片手操作・セーブ・効果音）。他のゲームと同じもの |
| `js/game/config.js` | **数値の設定ファイル** |
| `js/game/text.js` | **ことばファイル**（画面の文字・セリフ・物語の会話。日英） |
| `js/game/main.js` | 起動と1日の流れ（朝 → ミニゲーム → 夜 → 結果 → 次の日、物語の場面の呼び出し） |
| `js/game/state.js` | 所持金・在庫・評判・日数・章とセーブ |
| `js/game/taste.js` | 味と評価（星と代金の計算） |
| `js/game/screens.js` | タイトル・朝（町の地図と仕入れ先）・結果の画面 |
| `js/game/night.js` | 夜の営業（客・常連・旅の客・VIP・料理・包む・評価） |
| `js/game/auction.js` / `fishing.js` / `forage.js` / `hunt.js` / `smuggle.js` | ミニゲーム（競り・一本釣り・採集・山の追い込み・抜け荷） |
| `js/game/shop.js` | 町の店 |
| `js/game/dex.js` | タコス図鑑 |
| `js/game/story.js` / `opening.js` / `ending.js` | 物語の場面・オープニングの紙芝居・エンディング |
| `js/game/sprites.js` | Blender で作ったドット絵を使う部分（人物・食材・皮・屋台・地図・背景） |
| `js/game/art.js` | 絵の読み込みと、絵がないときの仮の図形 |
| `js/game/fx.js` | 演出（開店カットイン・星3の大写し・ランクアップ・ヌシ・勝利・紙吹雪） |
| `js/game/bgm.js` / `sfx.js` | BGM（楽譜）と効果音 |
| `js/game/tutorial.js` | はじめての1日の案内 |
| `js/game/ui.js` / `share.js` | 画面の部品 / X シェア |
| `art/` | 絵の仕組み。`python art/build.py` で `art/output/` のドット絵を作り直す |
| `art/output/game/art.js` | 絵の一覧（`art/build.py` が自動で書き出す。手で書きかえない） |

## 自分のパソコンで動かす
このフォルダで PowerShell を開き、次を実行してから、ブラウザで http://localhost:8000 を開きます。
```
python -m http.server 8000
```

## 更新がスマホに出ないとき
ブラウザが前のファイルを覚えていることがあります。`index.html` の `?v=` の数字をぜんぶ1つ上げると、新しいファイルが読み込まれます。

## Tanuki Box のサイトに載せるとき（確認が済んでから）
TanukiBox/tanukibox.github.io の `games.js` に、このゲームの `{ ... }` を1つ足します（書き方は games.js の先頭）。
棚の絵は `art/output/game/ogp.png`（1200×630）、プレイ動画は `art/output/game/play.mp4` を使えます。
