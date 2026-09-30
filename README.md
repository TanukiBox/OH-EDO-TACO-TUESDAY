# Oh!Edo Taco Tuesday!!（多幸寿）

江戸時代にタイムスリップしたタコス職人が、屋台「多幸寿（タコス）」を営む料理ゲーム。
昼は江戸の町で食材を仕入れ、夜は屋台で客の注文を聞いてタコスを作る。スマホ縦画面とPCで遊べる無料ブラウザゲーム（Tanuki Box）。

- 確認用URL：https://tanukibox.github.io/OH-EDO-TACO-TUESDAY/
- 物語：[story.md](story.md)
- 絵の仕組み（Blender の3Dモデル → ドット絵）：[art/README.md](art/README.md)

## 数字やことばを直すとき
| 直したいもの | ファイル |
|---|---|
| 値段・味（辛・酸・旨・香・食感）・客の好み・時間・競りの相場など、**数値すべて** | [js/game/config.js](js/game/config.js) |
| 食材やタコスの名前・セリフ・画面の文字・**物語の会話**（**日本語と英語**） | [js/game/text.js](js/game/text.js) |
| 物語の場面をいつ出すか（章・日数・ごほうび） | [js/game/config.js](js/game/config.js) の `EVENTS` |

どちらも、ファイルの先頭に書きかえ方の説明があります。書きかえたらブラウザで再読み込みすると反映されます。

## ファイルの役割
| 場所 | 中身 |
|---|---|
| `index.html` / `style.css` | ゲームの入れ物と見た目 |
| `js/common/` | Tanuki Box の共通土台（日英自動切替・片手操作・セーブ・効果音）。他のゲームと同じもの |
| `js/game/config.js` | 数値の設定ファイル |
| `js/game/text.js` | ことばファイル（日英） |
| `js/game/state.js` | 所持金・在庫・評判・日数とセーブ |
| `js/game/taste.js` | 味と評価（星と代金の計算） |
| `js/game/main.js` | 起動と1日の流れ（朝→夜→結果→次の日） |
| `js/game/screens.js` | タイトル・朝の仕入れ先・結果の画面 |
| `js/game/auction.js` | ミニゲーム「魚河岸の競り」 |
| `js/game/fishing.js` | ミニゲーム「江戸湾の一本釣り」 |
| `js/game/forage.js` | ミニゲーム「田んぼと里山の採集」 |
| `js/game/shop.js` | 町の店（青物市場・米屋・豆腐屋・鳥屋・薬研堀・ももんじや） |
| `js/game/dex.js` | タコス図鑑（タコス・素タコス・食材） |
| `js/game/hunt.js` | ミニゲーム「山の追い込み」 |
| `js/game/smuggle.js` | ミニゲーム「長崎の抜け荷」 |
| `js/game/story.js` | 物語の場面を出すしくみ（会話の表示・条件・ごほうび） |
| `js/game/ending.js` | エンディング |
| `js/game/night.js` | 夜の営業（客・料理・包む・評価） |
| `js/game/art.js` | ドット絵の読み込みと、まだ絵のないものの仮の図形 |
| `js/game/sfx.js` / `share.js` / `ui.js` | 効果音 / Xシェア / 画面の部品 |
| `art/` | 絵の仕組み。`python art/build.py` で `art/output/` のドット絵を作り直す |
| `story.md` | 物語（登場人物・あらすじ・章・エンディング） |
| `LICENSES.md` | フォントなどのライセンス |

## 更新がスマホに出ないとき
ブラウザが前のファイルを覚えていることがあります。`index.html` の `?v=3` の数字をぜんぶ1つ上げる（`?v=4` など）と、新しいファイルが読み込まれます。

## 自分のパソコンで動かす
このフォルダで PowerShell を開き、次を実行してから、ブラウザで http://localhost:8000 を開きます。
```
python -m http.server 8000
```
