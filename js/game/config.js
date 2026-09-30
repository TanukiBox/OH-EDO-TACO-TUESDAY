/*
 * ============================================================
 *  多幸寿 設定ファイル（数値はすべてここ）
 * ============================================================
 *  値段・味・客の好み・時間などの数字を変えたいときは、このファイルだけを書きかえます。
 *  名前やセリフ（日本語・英語）は js/game/text.js にあります。
 *
 *  書きかえるときの注意
 *   ・数字だけを変えてください。 , （カンマ）や ' （引用符）や { } [ ] は消さないように。
 *   ・書きかえたら、ブラウザで再読み込みすると反映されます。
 *   ・お金の単位は「文（もん）」です。
 *
 *  味の5要素（taste）は、この順番で並んだ5つの数字です：
 *     [ 辛, 酸, 旨, 香, 食感 ]   それぞれ 0〜5 くらい
 * ============================================================
 */
(function (global) {
  'use strict';
  var OT = global.OT = global.OT || {};

  OT.CFG = {
    // セーブデータの名前（変えると、今までのセーブが読めなくなります）
    SAVE_KEY: 'oh-edo-taco',
    SAVE_VERSION: 1,
    // Xシェアの文に入れるゲームのURL
    SHARE_URL: 'https://tanukibox.github.io/OH-EDO-TACO-TUESDAY/',

    // ---------------------------------------------------------
    // はじめの状態
    // ---------------------------------------------------------
    START: {
      money: 300,        // 所持金（文）
      rep: 0,            // 評判
      day: 1,
      // 最初から持っている食材の数（下ごしらえ済み）
      stock: {
        tortilla: 45,    // トウモロコシのトルティーヤ（残りわずか）
        daikon: 20, negi: 20, myoga: 16, yuzu: 16, bainiku: 16,
        shichimi: 30, irizake: 20, shiraae: 16,
        // 「蛸のタコス」に必要なので、はじめから少し持っている
        sumiso: 12, kyuri: 12
      }
    },

    // ---------------------------------------------------------
    // 1日の流れ
    // ---------------------------------------------------------
    DAY: {
      nightSeconds: 180,     // 夜の営業の長さ（秒）。約3分
      firstGuestAfter: 3,    // 開店から最初の客が来るまで（秒）
      arrivalMin: 11,        // 次の客が来るまでの間隔（秒）の最小
      arrivalMax: 17,        // 　　　　〃　　　　　　　　　の最大
      seats: 3,              // 同時に座れる客の数
      lastOrderBefore: 20    // 閉店の何秒前から、新しい客が来なくなるか
    },

    // ---------------------------------------------------------
    // 食材（下ごしらえ済みの形で在庫に入る）
    //   cat   : 'skin' 皮 / 'main' 具 / 'salsa' サルサ / 'herb' 薬味
    //   taste : [辛, 酸, 旨, 香, 食感]
    //   value : 「おまかせ」の値段を決めるときの食材の値打ち（文）
    //   tags  : 'fish' 魚介 / 'meat' 肉 / 'red' 赤い / 'white' 白い / 'rare' 珍品
    // ---------------------------------------------------------
    INGREDIENTS: {
      // 皮
      tortilla: { cat: 'skin', taste: [0, 0, 1, 2, 2], value: 4, tags: [] },
      // 具
      tai:      { cat: 'main', taste: [0, 0, 4, 1, 1], value: 14, tags: ['fish', 'red', 'white'] },
      kisu_ten: { cat: 'main', taste: [0, 0, 3, 1, 4], value: 10, tags: ['fish', 'white'] },
      tako:     { cat: 'main', taste: [0, 0, 3, 0, 3], value: 11, tags: ['fish', 'red'] },
      katsuo:   { cat: 'main', taste: [0, 0, 5, 2, 1], value: 12, tags: ['fish', 'red'] },
      // サルサ
      shiraae:  { cat: 'salsa', taste: [0, 0, 2, 1, 0], value: 3, tags: ['white'] },
      sumiso:   { cat: 'salsa', taste: [0, 3, 2, 1, 0], value: 3, tags: [] },
      bainiku:  { cat: 'salsa', taste: [0, 5, 1, 2, 0], value: 3, tags: ['red'] },
      irizake:  { cat: 'salsa', taste: [0, 2, 3, 1, 0], value: 2, tags: [] },
      // 薬味
      daikon:   { cat: 'herb', taste: [1, 0, 0, 1, 3], value: 1, tags: ['white'] },
      kyuri:    { cat: 'herb', taste: [0, 0, 0, 1, 3], value: 1, tags: [] },
      myoga:    { cat: 'herb', taste: [0, 0, 0, 4, 2], value: 2, tags: [] },
      negi:     { cat: 'herb', taste: [1, 0, 1, 3, 1], value: 1, tags: [] },
      yuzu:     { cat: 'herb', taste: [0, 3, 0, 4, 0], value: 2, tags: [] },
      shichimi: { cat: 'herb', taste: [5, 0, 0, 3, 0], value: 1, tags: ['red'] }
    },

    // ---------------------------------------------------------
    // タコス（メニュー）
    //   skin   : 使う皮
    //   need   : 必ずのせる食材（これがそろえば「注文どおり」）
    //   price  : 値段（文）。星の数と客によって上下する
    //   chapter: 何章から出てくるか
    //   light  : さっぱりしたタコスなら true（絵ですだちを添えない）
    // ---------------------------------------------------------
    TACOS: {
      tempura: { skin: 'tortilla', need: ['kisu_ten', 'daikon', 'shiraae', 'yuzu'], price: 32, chapter: 1, light: false },
      takotaco: { skin: 'tortilla', need: ['tako', 'sumiso', 'kyuri', 'myoga'], price: 30, chapter: 1, light: true },
      kohaku: { skin: 'tortilla', need: ['tai', 'daikon', 'bainiku'], price: 40, chapter: 1, light: true }
    },

    // ---------------------------------------------------------
    // 客
    //   want    : 好きな味の強さ [辛, 酸, 旨, 香, 食感]（皮とのせた食材の味の「合計」と比べる。
    //             食材4〜5個で合計6〜10くらいになるので、そのくらいの数字にする）
    //   weight  : 5要素のうち、どれをどれだけ気にするか（合計1くらい）
    //   patience: 待てる時間（秒）。過ぎると怒って帰る
    //   pay     : 払いの良さ（1 = ふつう）
    //   omakase : 「おまかせ」で注文する確率（0〜1）
    //   likes   : 好きな注文（この順に選ばれやすい）
    //   fastBonus / looksBonus : 早く出すと喜ぶ / 見た目（紅白）を喜ぶ ときの上乗せ
    // ---------------------------------------------------------
    CUSTOMERS: {
      chonin: {
        chapter: 1, want: [1, 3, 6, 7, 9], weight: [0.1, 0.15, 0.3, 0.15, 0.3],
        patience: 38, pay: 0.9, omakase: 0.15, likes: ['takotaco', 'tempura', 'kohaku'],
        fastBonus: 0.12, fastSeconds: 18, looksBonus: 0
      },
      shokunin: {
        chapter: 1, want: [6, 2, 6, 7, 7], weight: [0.45, 0.05, 0.25, 0.1, 0.15],
        patience: 50, pay: 1.0, omakase: 0.3, likes: ['tempura', 'takotaco', 'kohaku'],
        fastBonus: 0, fastSeconds: 0, looksBonus: 0
      },
      samurai: {
        chapter: 1, want: [0, 4, 6, 6, 6], weight: [0.1, 0.2, 0.3, 0.25, 0.15],
        patience: 60, pay: 1.2, omakase: 0.15, likes: ['kohaku', 'tempura', 'takotaco'],
        fastBonus: 0, fastSeconds: 0, looksBonus: 0.15
      }
    },
    // 客の好みの個人差（want を ±この数だけ、客ごとにランダムにずらす）
    CUSTOMER_JITTER: 1,
    // 客の種類が来る割合（章ごとに解禁された種類から選ぶ）
    CUSTOMER_MIX: { chonin: 5, shokunin: 3, samurai: 2 },

    // ---------------------------------------------------------
    // 評価と代金
    // ---------------------------------------------------------
    RATING: {
      orderWeight: 0.55,     // 注文どおりかどうかの重み（残りは好みとの近さ）
      missingPenalty: 0.34,  // 必要な食材が1つ足りないごとに引く
      extraPenalty: 0.04,    // 注文にない食材を1つ足すごとに引く（好みに合えば取り返せる）
      wrongOrderMaxStars: 1, // 必要な食材が2つ以上足りないと、星はこれ以下
      star3: 0.85,           // 点数がこれ以上なら星3
      star2: 0.6,            // 点数がこれ以上なら星2（それ未満は星1）
      tolerance: 4,          // 好みの味との差がこれだけあると、その要素は0点（want が大きい客はそれに合わせて広がる）
      starPay: [0, 0.6, 1.0, 1.35],  // 星1〜3のときの値段の倍率
      omakaseBase: 16,       // 「おまかせ」の値段 = omakaseBase + 食材の値打ちの合計
      maxToppings: 6         // 皮の上にのせられる食材の数
    },

    // 評判の増減
    REP: {
      perStar: [0, -1, 1, 3],   // 星1〜3の客1人ごと
      angry: -3                 // 怒って帰った客1人ごと
    },

    // 評判ランク（第2段階で使う）。rep がこの値以上でそのランク
    RANKS: [0, 60, 180, 400, 750],

    // ---------------------------------------------------------
    // 仕入れ先
    //   kind: 'game' ミニゲームあり（1日に回れる数に数える） / 'shop' 町の店
    //   soon: true のあいだは「近日公開」
    // ---------------------------------------------------------
    SUPPLIERS: [
      { id: 'uogashi', kind: 'game', game: 'auction', chapter: 1 },
      { id: 'ipponzuri', kind: 'game', chapter: 2, soon: true },
      { id: 'satoyama', kind: 'game', chapter: 3, soon: true },
      { id: 'yama', kind: 'game', chapter: 3, soon: true },
      { id: 'aomono', kind: 'shop', chapter: 1, soon: true },
      { id: 'tofuya', kind: 'shop', chapter: 2, soon: true },
      { id: 'toriya', kind: 'shop', chapter: 2, soon: true },
      { id: 'momonjiya', kind: 'shop', chapter: 3, soon: true },
      { id: 'yagenbori', kind: 'shop', chapter: 2, soon: true },
      { id: 'komeya', kind: 'shop', chapter: 1, soon: true },
      { id: 'nagasaki', kind: 'game', chapter: 5, soon: true }
    ],
    MAX_GAMES_PER_DAY: 3,

    // ---------------------------------------------------------
    // ミニゲーム「魚河岸の競り」
    // ---------------------------------------------------------
    AUCTION: {
      seconds: 30,           // 1回の長さ（秒）
      lotSeconds: 5.5,       // 1匹（1山）が競りにかかっている時間（秒）
      priceLow: 0.55,        // 値札が下がる一番下（相場の何倍か）
      priceHigh: 1.55,       // 値札が上がる一番上
      // 競りに出る魚。base = 相場（文）、portions = 何人分の具になるか、gives = 在庫に入る食材
      fish: {
        tai:    { base: 90, portions: 5, gives: 'tai', weight: 3 },
        kisu:   { base: 55, portions: 4, gives: 'kisu_ten', weight: 4 },
        tako:   { base: 70, portions: 5, gives: 'tako', weight: 3 },
        katsuo: { base: 80, portions: 6, gives: 'katsuo', weight: 2 }
      }
    }
  };
})(window);
