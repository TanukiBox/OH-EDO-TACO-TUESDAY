# Oh!Edo Taco Tuesday!!（多幸寿）

江戸時代にタイムスリップしたタコス職人が、屋台「多幸寿（タコス）」を営む料理ゲーム。
昼は江戸の町でミニゲームをして食材を仕入れ、夜は屋台で客の注文を聞いてタコスを作る。
スマホ縦画面とPCで遊べる無料ブラウザゲーム（Tanuki Box）。

- 確認用URL：https://tanukibox.github.io/OH-EDO-TACO-TUESDAY/
- 物語：[story.md](story.md)　／　紹介メモ（日英）：[INTRO.md](INTRO.md)　／　実機チェック：[CHECKLIST.md](CHECKLIST.md)
- 絵の仕組み（Blender の3Dモデル → ドット絵）：[art/README.md](art/README.md)
- ライセンス：[LICENSES.md](LICENSES.md)
- **開発用メニュー**：https://tanukibox.github.io/OH-EDO-TACO-TUESDAY/?dev （下の「開発用メニュー」）

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
| ゲームを全体に早く／ゆっくり進めたい | `RANKS`（評判ランクの境目） | 今は `[0, 25, 90, 220, 430]`。試算では、クリアまで上手な人 約13日・ふつう 約20日・苦手な人 約33日 |
| 評判の上がり方を変えたい | `REP.perStar`（星1〜5の客1人ごと）・`REP.streakBonus`・`REP.perNight`（毎晩、店を開けた分） | perStar の最後の数を大きくすると星5が効く。perNight を上げると、苦手な人も早く進める |
| 夜の営業を長く／短くしたい | `DAY.nightSeconds` | 180 = 3分（前は240 = 4分） |
| 客の来る間隔を変えたい | `DAY.arrivalMin` / `arrivalMax` / `busier` | 小さくすると忙しくなる |
| 客を待たせられる時間 | `CUSTOMERS.○○.patience` | 秒。大きくするとやさしくなる |
| 星の出やすさ | `SCORE.stars`（星2・3・4・5になる点数%） | `[40, 60, 75, 90]` を下げると星が出やすい |
| タコスの値段 | `TACOS.○○.price` | 文 |
| 食材の味 | `INGREDIENTS.○○.taste` | `[辛, 酸, 旨, 香, 食感]` |
| 客の好み | `CUSTOMERS.○○.want`（好きな味の強さ）と `weight`（どれを気にするか） | |
| 注文のかたより | `LIKES_BOOST`（好物が頼まれやすい度合い）/ `ORDER_VARIETY`（同じ夜に同じ料理が続かない度合い） | `ORDER_VARIETY` を 1 にすると続きやすく、0.3 にするとばらける |
| 一本釣りの難しさ | `FISHING.gear`（釣り道具：糸の強さ・竿の巻く速さ・値段）/ `tireTime` / `fish.○○.pull` | 道具は釣りの前の画面で買える。tireTime を短くすると魚が早く疲れてやさしい |
| 長崎の抜け荷（闇商人との椀の玉当て）の値段 | `SMUGGLE.markup`（言い値 = 値打ち×何人前×この倍率）/ `steps`（1勝・2勝・3勝の値段）/ `losePrice`（負けたときの値段）/ `cheatWin`（イカサマを見破ったときの値段） | どれも言い値の何倍か。`[0.75, 0.55, 0.4]` なら3連勝で4割の値段 |
| 椀の玉当ての難しさ | `SMUGGLE.rounds`（`swaps` 入れかえる回数・`swapTime` 1回の秒）/ `cheatCrate`（その荷でイカサマをする確率）/ `cheatRound`（するなら何回目か） | swapTime を大きくすると、ゆっくりでやさしい。イカサマは1つの荷で1回まで、しない荷もある |
| 今夜の荷 | `SMUGGLE.crates`（荷の数）/ `goods.○○`（`weight` 出やすさ・`n` 何人前） | 銀次のせりふは text.js の `'ym.*'`（`|` で区切ると、その中から1つ） |
| 山の追い込みの難しさ | `HUNT.push`（1回の追いたて）/ `fleeBias`（森へ逃げる強さ）/ `wary`（罠に気づく距離）/ `panicPerPush`（続けて追うと暴れる）/ `maxAnimals` / `animals.○○.charge`・`leap`・`veer` | push を上げる・fleeBias を下げるとやさしい |
| 里山の採集 | `FORAGE.items.○○`（`life` 出ている秒・`weight` 出やすさ・`gives`）/ `maxOnField` | 出る場所は forage.js の `NESTS`（蜂の巣）・`BUSHES`（山椒）と背景の絵で同じ |
| 物語の場面の時期 | `EVENTS` の `chapter`・`chapterDay` | 例：お城の使いは第5章の5日目から |

### 夜の厨房（注文・焼き場・盛り付け）の調整
| やりたいこと | config.js のどこ | 例・意味 |
|---|---|---|
| 同時に来る客の数 | `KITCHEN.maxGuests` | 章ごと `[1, 2, 2, 3, 3, 3]`。序盤は1人ずつ |
| 注文を聞くまで待てる時間 | `KITCHEN.orderPatience` | 秒。注文を聞いたあとは `CUSTOMERS.○○.patience` |
| 網焼きの時間 | `KITCHEN.grill.time` | 9 = 9秒で焼き上がり。`flipAt` 0.5 = 半分で裏返す、`flipWindow` は裏返せる幅 |
| 焼き加減のちょうど良い範囲 | `KITCHEN.grill.done` / `fry.done` / `sear.done` | `[0.95, 1.15]` = 焼き時間の95〜115%。`burn` を過ぎると焦げ |
| 揚げ時間 | `KITCHEN.fry.time` | 7秒 |
| 藁焼き | `KITCHEN.sear.done` | 押している合計の秒数 `[1.2, 1.9]` |
| 食材ごとの焼き時間 | `KITCHEN.timeMul` | 蒲焼 1.3 = 3割長い |
| 網・油鍋の数 | `KITCHEN.grillSlots` / `fryerSlots` / `searSlots` | 章ごと。ランクが上がると増える（七輪は1つに2切れ、2つ目の七輪は第3章から） |
| 焼き場の絵と置き場所 | `art/blender/scenes.py` の `job_kitchen` | 七輪・油鍋・藁焼きの3枚。置き場所は絵といっしょに自動で書き出される |
| 焼き上がりの置き場 | `KITCHEN.warmTray` | 6 |
| 食材の調理法 | `INGREDIENTS.○○.cook` | `'grill'` 焼く / `'fry'` 揚げる / `'sear'` 炙る / 書かない＝そのまま盛り付け |
| 盛り付け方 | `INGREDIENTS.○○.use` | `'drop'` 置く / `'sprinkle'` 撒く / `'drizzle'` 回しかける |
| のせる順番（木札の絵） | `TACOS.○○.need` の並び | 皮のあと、この順にのせると盛り付け点が満点 |
| 採点の重み | `SCORE.weights`（注文あり）/ `SCORE.omakaseWeights`（おまかせ） | 待ち時間・焼き加減・盛り付け・好み。おまかせは好みが重い |
| 盛り付けの中の重み | `SCORE.plate` | 順番・量・均等さ |
| 薬味・たれのちょうど良い量 | `SCORE.sprinkleTarget`（撒く回数）/ `drizzleTarget`（たれの長さ） | 6回 / 200（皮の幅が約90なので、左右に2往復くらい） |
| 待ち時間の点 | `SCORE.waitGrace` / `waitFloor` | 待てる時間の4割までに出せば満点 |
| 星ごとの代金・心付け | `RATING.starPay` / `RATING.tipRate` | 星1〜5。心付けは出す場面で銭をタップして受け取る |
| タコスごとの星の上限 | `MASTERY.maxStars` | 熟練度 Lv1〜5 で `[3, 4, 5, 5, 5]` |

### 魚河岸の競り（一山いくら）の調整
| やりたいこと | config.js のどこ | 例・意味 |
|---|---|---|
| 箱の数・覗ける回数 | `AUCTION.boxes` / `peeks` | 5箱 / 3回 |
| 1段の量（一山の量） | `AUCTION.layerPortions` | `[3, 6]` 人前 × 3段 ＝ 一晩分くらい |
| 漁場ごとの中身の傾向 | `AUCTION.grounds.○○.fish` | 数字が大きい魚ほど入りやすい（`weight` はその札の箱の出やすさ） |
| 1箱の中の魚のばらけ方 | `AUCTION.sameLayer` / `mixKinds` / `mixFill` | `sameLayer` を小さくすると段ごとに別の魚に。漁場の魚がその章で少ないときは `mixFill` の重みでほかの魚も混ざる |
| 魚の相場 | `AUCTION.fish.○○.perPortion` | 1人前の値段（文）。`big: true` の魚が入ると箱が暴れやすい |
| 大当たり | `AUCTION.jackpotChance`（ヌシ）/ `whaleChance`（鯨） / `fish.nushi.gives` | ヌシや鯨は中か下の段にまるごと入る |
| 手がかりの当たりやすさ | `AUCTION.clues` | `weightTrue`（重さの演出が正しい確率）、`shakeBig` / `shakeFalse`（ガタッ）、`catGood` / `catFalse`（猫が居座る）、`goodRatio`（良い箱の基準） |
| 値段の下がり方 | `AUCTION.tickSeconds` / `stepRate` / `startMul` / `floorMul` | 0.45秒ごとに、はじめの値段の4.5%ずつ下がる |
| 声比べ | `AUCTION.clashWindow` / `clashSeconds` | 0.35秒以内に手が重なったら、2.6秒の連打勝負 |
| ライバルの性格 | `AUCTION.rivals.○○` | `skill` 目利き、`greed` 出す上限、`likes` 好きな魚、`react` 手の速さ、`tell` 良い箱で反応する、`bluff` 興味のあるふり、`feint` 手のぴくっ、`voice` 声比べの強さ |
| ライバルの人数 | `AUCTION.rivalsPerChapter` | 章ごと。寿司の親方の辰五郎はいつもいる |
| 1日目のやさしさ | `AUCTION.firstDayEasy` | ライバルの出す上限を 0.8 倍に |
| 棒手振りに売る値段 | `AUCTION.sellRate` | 相場の 45% |
| 自分の山の判定・答え合わせの札 | `AUCTION.verdict` | 値打ち÷値段が `great`（1.3）以上で「当たり」、`good`（1.0）以上「まずまず」、`fair`（0.85）以上「ちょっと高くついた」、それ未満「はずれ」。`regretMin`・`regretRate` でほかの箱の「あっちのほうが得だった…」、`reliefRate` で「見送って正解！」の出やすさ |
| 漁師の耳打ち | `AUCTION.whisper` と `FISHER` | 夜に漁師の浜蔵さんを星4以上で満足させると信頼+1。翌朝、信頼×30%で耳打ち（`accuracy` は当たる確率） |

### 絵の塗り方の切りかえ
| やりたいこと | config.js のどこ | 例・意味 |
|---|---|---|
| 絵の塗り方 | `ART_STYLE.kitchen`（厨房の焼き場）/ `stall`（夜の屋台と改装の絵）/ `map`（町の地図）/ `minigames`（一本釣り・里山・山・長崎の蔵の背景） | `'classic'` = 前の塗り方（灯りや光で照らした陰影と色むら）/ `'toon'` = セル調（人物と同じ3段の色と線）。どちらの絵も入っているので、いつでも戻せる。開発用メニュー（?dev）の「絵の塗り方」のボタンで、その場で見くらべられる |

### 瓦版と番付の調整
| やりたいこと | config.js のどこ | 例・意味 |
|---|---|---|
| ほかの店の評判 | `BANZUKE.shops.○○` | `rep` はじめの評判、`grow` 1日に増える評判、`chapter` 何章から番付に載るか。店の名前は text.js の `'bz.s.○○'` |
| 番付の動きの大きさ | `BANZUKE.jitter` / `eventChance` / `eventSize` | 毎日のゆれ / ほかの店のできごとが瓦版に載る確率 / そのときに上がる・下がる評判 |
| 三役の数 | `BANZUKE.sanyaku` | 上から6軒が大関・関脇・小結（東西）。あとは前頭 |
| 番付に載る評判 | `BANZUKE.entryRep` | 30。それまでは「番付外」。載った日の瓦版に記事が出る |
| はやりのタコス | `KAWARABAN.trendChance` / `trendBoost` | 瓦版に「いま江戸では○○がはやり」が載る確率 / その日にそのタコスが頼まれやすくなる倍率 |

瓦版は2日目から毎朝いちど自動で開きます（朝の画面の「📰 瓦版」「🏯 番付」でいつでも見られます）。
記事のことばは text.js の `'news.*'`、番付は `'bz.*'` です。

### 屋台の改装と高級な材料（お金の使いみち）
| やりたいこと | config.js のどこ | 例・意味 |
|---|---|---|
| 改装の値段と効き目 | `UPGRADES.○○.levels`（`price` 値段・`chapter` 何章から） | 提灯 `arrival`（客の来る間隔の倍率）・のれん `patience`（待てる時間の倍率）・台 `pay`（代金と心付けの倍率）・焼き場 `window`（焼き加減のちょうど良い幅の倍率） |
| 改装ができる章 | `UPGRADES.chapter` | 第2章から。朝の画面の「🔨 屋台の改装」 |
| 高級な材料の値段 | `SHOPS.kokyu`（日本橋の大店・伊勢屋） | 伊勢海老・鮑・金箔は第3章、からすみは第4章から |
| 高級なタコス | `TACOS` の `premium: true`（伊勢海老・鮑・からすみ）/ `PREMIUM.orderBoost` | 材料を持っている夜だけ注文される。orderBoost を上げると頼まれやすい |
| 金箔 | `PREMIUM.kinpakuPay` | 金箔をのせたタコスの代金と心付けの倍率（よけいな具に数えない） |

試算（1日目からクリアまで）では、ふつうの人で改装に約5700文（12段のうち約8段）を使い、クリア時の残りは約2400文（改装なしだと約5200文）。

### 他店の主人の来店・実績・料理対決の再挑戦
| やりたいこと | config.js のどこ | 例・意味 |
|---|---|---|
| 来る主人と頼むタコス | `VISITORS.○○` | `type` 味の好み、`order` 頼むタコス（作れないときはほかのタコス）、`gift` 星4以上のときのお礼、`repGood` / `repBad` 評判 |
| 来る時期 | `EVENTS` の `visit_○○` | `fromChapter` 何章から、`chapterDay` その章の何日目から。料理対決や献上の夜はさけて、1晩にひとりだけ。会話は text.js の STORY の `visit_○○`（`_good` / `_bad` は食べたあと） |
| 料理対決の再挑戦 | `VIP_RETRY_DAYS` | 4。負けた相手は4日おいてから再挑戦。まだ対決していない相手が先に来る |
| 実績 | `ACHIEVEMENTS` | `kind` 何を数えるか、`n` 何回で達成。名前と説明は text.js の `'ach.○○'` / `'ach.○○.desc'`。図鑑の「実績」タブで見られ、クリア後は朝の画面に「これからの目標」が出る |
| 第5章のトウモロコシ | `SMUGGLE.keyCorn` | トウモロコシが `minStock` 本より少ないあいだ、長崎の蔵に「大事な品」の荷（値段 `priceMul` 倍）が必ず出る。ポン吉も朝に教える |

### BGM と絵の読み込み
- ミニゲームごとに曲がちがいます（魚河岸・一本釣り・里山・山・長崎）。楽譜は `js/game/bgm.js` の `SONGS`。
- 起動を速くするため、はじめはタイトル・地図・顔・アイコンだけを読み、ほかの絵は後ろで読みます。まだの絵が要る画面（夜の屋台・ミニゲーム・図鑑）は、そろうまで少し待ってから開きます。`ART_STYLE` で使っていない塗り方の絵は読みません。

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
| `js/game/news.js` | 瓦版と番付（ほかの店の評判が毎朝動く・多幸寿の番付・はやりのタコス） |
| `js/game/upgrades.js` | 屋台の改装（提灯・のれん・台・焼き場の段と効き目、改装の画面） |
| `js/game/achieve.js` | 実績（達成の確かめ・お知らせ・図鑑の「実績」タブ・クリア後の目標） |
| `js/game/dev.js` | 開発用メニュー（`?dev` のときだけ動く。別のセーブ） |
| `js/game/night.js` | 夜の営業（客の出入り・常連・旅の客・VIP・評価・閉店） |
| `js/game/serve.js` | タコスを出す場面（できあがり → お客さんが食べる → 評価と心付け）。このあいだ夜の時間は止まる |
| `js/game/kitchen.js` | 夜の厨房（木札・焼き場・盛り付け・包む・持ち場のボタン・はじめての夜の案内） |
| `js/game/auction.js` | 魚河岸の競り（一山いくら：箱・手がかり・覗き見・下げ競り・声比べ・開ける・答え合わせ・棒手振り・今朝の戦果） |
| `js/game/fishing.js` / `forage.js` / `hunt.js` / `smuggle.js` | ミニゲーム（一本釣り・採集・山の追い込み・抜け荷） |
| `js/game/shop.js` | 町の店 |
| `js/game/dex.js` | タコス図鑑 |
| `js/game/story.js` / `opening.js` / `ending.js` | 物語の場面・オープニングの紙芝居・エンディング |
| `js/game/sprites.js` | Blender で作ったドット絵を使う部分（人物・食材・皮・屋台・地図・背景） |
| `js/game/art.js` | 絵の読み込みと、絵がないときの仮の図形 |
| `js/game/fx.js` | 演出（開店カットイン・星3の大写し・ランクアップ・ヌシ・勝利・紙吹雪・番付が上がった・改装の完成・高級な一品） |
| `js/game/bgm.js` / `sfx.js` | BGM（楽譜）と効果音 |
| `js/game/tutorial.js` | はじめての1日の案内（吹き出し。夜の手順は kitchen.js） |
| `js/game/ui.js` / `share.js` | 画面の部品 / X シェア |
| `art/` | 絵の仕組み。`python art/build.py` で `art/output/` のドット絵を作り直す |
| `art/output/game/art.js` | 絵の一覧（`art/build.py` が自動で書き出す。手で書きかえない） |

## 開発用メニュー（ミニゲームだけを試す）
アドレスの最後に `?dev` をつけて開くと、タイトルの代わりに「開発用メニュー」が出ます。
- 章（1〜6）をえらんで、魚河岸・一本釣り・里山・山・長崎のミニゲーム、夜の営業、朝の画面、瓦版、番付をすぐに遊べます
- その章のはじめの状態（評判・食材・物語の進み具合）で始まります。物語の場面と案内は出ません
- ここで遊んだことは**別のセーブ**に入るので、ふつうの「つづきから」には何も残りません
- ミニゲームが終わるとメニューに戻ります。右下の小さな「DEV」でいつでもメニューへ
- 中身は `js/game/dev.js`、ことばは text.js の `'dev.*'`

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
