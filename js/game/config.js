/*
 * ============================================================
 *  多幸寿 設定ファイル（数値はすべてここ）
 * ============================================================
 *  値段・味・客の好み・時間などの数字を変えたいときは、このファイルだけを書きかえます。
 *  名前やセリフ・物語の会話（日本語・英語）は js/game/text.js にあります。
 *
 *  書きかえるときの注意
 *   ・数字だけを変えてください。 , （カンマ）や ' （引用符）や { } [ ] は消さないように。
 *   ・書きかえたら、ブラウザで再読み込みすると反映されます。
 *   ・お金の単位は「文（もん）」です。
 *   ・chapter は「何章から出てくるか」。章 = 評判ランク（1 名もなき屋台 … 5 将軍の耳に届く、6 献上）
 *
 *  味の5要素（taste）は、この順番で並んだ5つの数字です：
 *     [ 辛, 酸, 旨, 香, 食感 ]   それぞれ 0〜6 くらい
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
        tortilla: 45,    // 持ってきたトウモロコシ粉のトルティーヤ（残りわずか。お店では買えない）
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
      arrivalMin: 11,        // 次の客が来るまでの間隔（秒）の最小（第1章）
      arrivalMax: 17,        // 　　　　〃　　　　　　　　　の最大（第1章）
      busier: 0.9,           // 章が1つ進むごとに、客の来る間隔がこの倍になる（行列ができる）
      seats: 3,              // 同時に座れる客の数
      lastOrderBefore: 20,   // 閉店の何秒前から、新しい客が来なくなるか
      lateNight: 0.65        // 営業時間のこの割合を過ぎると「夜ふけ」（〆の茶漬けが頼まれやすい）
    },
    // 季節：この日数ごとに 春→夏→秋→冬 と進む
    SEASON_DAYS: 7,

    // ---------------------------------------------------------
    // 食材（下ごしらえ済みの形で在庫に入る）
    //   cat   : 'skin' 皮 / 'main' 具 / 'salsa' サルサ / 'herb' 薬味 / 'ready' 作り置き
    //   taste : [辛, 酸, 旨, 香, 食感]
    //   value : 「おまかせ」の値段を決めるときの食材の値打ち（文）
    //   tags  : 'fish' 魚介 / 'meat' 肉 / 'egg' 卵 / 'red' 赤い / 'white' 白い / 'rare' 珍品 / 'lean' 赤身 / 'fatty' 脂
    //   as    : 皮のとき、どの皮の代わりになるか（もろこし粉の皮は、トルティーヤの代わりに使える）
    // ---------------------------------------------------------
    INGREDIENTS: {
      // ----- 皮 -----
      tortilla:    { cat: 'skin', taste: [0, 0, 1, 2, 2], value: 4, tags: [] },
      morokoshi:   { cat: 'skin', taste: [0, 0, 1, 1, 0], value: 3, tags: [], as: 'tortilla' },
      funoyaki:    { cat: 'skin', taste: [0, 0, 1, 1, 1], value: 3, tags: ['white'] },
      aburaage:    { cat: 'skin', taste: [0, 0, 2, 1, 3], value: 3, tags: [] },
      nori:        { cat: 'skin', taste: [0, 0, 2, 3, 1], value: 4, tags: [] },
      soba:        { cat: 'skin', taste: [0, 0, 1, 3, 2], value: 3, tags: [] },
      usuyaki:     { cat: 'skin', taste: [0, 0, 2, 1, 1], value: 4, tags: ['egg'] },
      yakionigiri: { cat: 'skin', taste: [0, 0, 2, 3, 3], value: 4, tags: [] },
      aigawa:      { cat: 'skin', taste: [0, 0, 1, 1, 2], value: 4, tags: [] },
      // ----- 作り置き -----
      kagomushi:   { cat: 'ready', taste: [0, 1, 4, 3, 2], value: 8, tags: [] },
      // ----- 具：魚介 -----
      tai:        { cat: 'main', taste: [0, 0, 4, 1, 1], value: 14, tags: ['fish', 'red', 'white'] },
      kisu_ten:   { cat: 'main', taste: [0, 0, 3, 1, 4], value: 10, tags: ['fish', 'white'] },
      tako:       { cat: 'main', taste: [0, 0, 3, 0, 3], value: 11, tags: ['fish', 'red'] },
      katsuo:     { cat: 'main', taste: [0, 0, 5, 2, 1], value: 12, tags: ['fish', 'red'] },
      aji_nanban: { cat: 'main', taste: [1, 3, 3, 1, 3], value: 9, tags: ['fish'] },
      iwashi:     { cat: 'main', taste: [0, 0, 4, 2, 1], value: 6, tags: ['fish'] },
      zuke:       { cat: 'main', taste: [0, 1, 4, 1, 1], value: 13, tags: ['fish', 'red', 'lean'] },
      akami:      { cat: 'main', taste: [0, 0, 4, 1, 1], value: 14, tags: ['fish', 'red', 'lean'] },
      chutoro:    { cat: 'main', taste: [0, 0, 5, 1, 1], value: 22, tags: ['fish', 'red', 'fatty'] },
      otoro:      { cat: 'main', taste: [0, 0, 6, 1, 0], value: 32, tags: ['fish', 'fatty', 'rare'] },
      kabayaki:   { cat: 'main', taste: [0, 0, 6, 4, 2], value: 20, tags: ['fish'] },
      uni:        { cat: 'main', taste: [0, 0, 6, 2, 0], value: 30, tags: ['fish', 'rare'] },
      kujira:     { cat: 'main', taste: [0, 0, 5, 1, 2], value: 24, tags: ['fish', 'red', 'rare'] },
      // ----- 具：里山・山 -----
      inago:      { cat: 'main', taste: [0, 0, 3, 1, 4], value: 8, tags: ['meat', 'rare'] },
      hachinoko:  { cat: 'main', taste: [0, 0, 4, 2, 2], value: 14, tags: ['meat', 'rare'] },
      makomo:     { cat: 'main', taste: [0, 0, 2, 3, 3], value: 12, tags: ['rare'] },
      inoshishi:  { cat: 'main', taste: [0, 0, 5, 2, 2], value: 16, tags: ['meat', 'red'] },
      ino_bara:   { cat: 'main', taste: [0, 0, 6, 1, 2], value: 16, tags: ['meat', 'fatty'] },
      ino_shita:  { cat: 'main', taste: [0, 0, 4, 1, 3], value: 18, tags: ['meat', 'rare'] },
      ino_mimi:   { cat: 'main', taste: [0, 0, 2, 1, 5], value: 9, tags: ['meat'] },
      shika:      { cat: 'main', taste: [0, 0, 4, 2, 2], value: 18, tags: ['meat', 'red'] },
      // ----- 具：鳥屋・豆腐屋・青物 -----
      shamo:      { cat: 'main', taste: [0, 0, 4, 1, 3], value: 15, tags: ['meat'] },
      kamo:       { cat: 'main', taste: [0, 0, 5, 2, 2], value: 17, tags: ['meat'] },
      atsuyaki:   { cat: 'main', taste: [0, 0, 3, 1, 2], value: 7, tags: ['egg'] },
      tofu_soboro: { cat: 'main', taste: [0, 0, 3, 1, 1], value: 4, tags: ['white'] },
      yakidofu:   { cat: 'main', taste: [0, 0, 3, 1, 2], value: 4, tags: [] },
      nidaikon:   { cat: 'main', taste: [0, 0, 3, 1, 2], value: 3, tags: ['white'] },
      konnyaku:   { cat: 'main', taste: [0, 0, 1, 0, 4], value: 3, tags: [] },
      satsumaimo: { cat: 'main', taste: [0, 0, 2, 2, 2], value: 4, tags: [] },
      satoimo:    { cat: 'main', taste: [0, 0, 2, 1, 3], value: 4, tags: ['white'] },
      nasu:       { cat: 'main', taste: [0, 0, 3, 2, 2], value: 5, tags: [] },
      matsutake:  { cat: 'main', taste: [0, 0, 4, 6, 3], value: 30, tags: ['rare'] },
      sumeshi:    { cat: 'main', taste: [0, 3, 2, 1, 1], value: 4, tags: ['white'] },
      // ----- サルサ -----
      shiraae:      { cat: 'salsa', taste: [0, 0, 2, 1, 0], value: 3, tags: ['white'] },
      sumiso:       { cat: 'salsa', taste: [0, 3, 2, 1, 0], value: 3, tags: [] },
      bainiku:      { cat: 'salsa', taste: [0, 5, 1, 2, 0], value: 3, tags: ['red'] },
      irizake:      { cat: 'salsa', taste: [0, 2, 3, 1, 0], value: 2, tags: [] },
      shichimi_miso: { cat: 'salsa', taste: [4, 0, 3, 2, 0], value: 3, tags: ['red'] },
      miso:         { cat: 'salsa', taste: [0, 0, 4, 2, 0], value: 2, tags: [] },
      dengaku_miso: { cat: 'salsa', taste: [0, 0, 4, 3, 0], value: 3, tags: [] },
      dashi:        { cat: 'salsa', taste: [0, 0, 4, 2, 0], value: 2, tags: ['fish'] },
      // ----- 薬味 -----
      daikon:      { cat: 'herb', taste: [1, 0, 0, 1, 3], value: 1, tags: ['white'] },
      oroshi:      { cat: 'herb', taste: [1, 0, 0, 1, 1], value: 1, tags: ['white'] },
      kyuri:       { cat: 'herb', taste: [0, 0, 0, 1, 3], value: 1, tags: [] },
      myoga:       { cat: 'herb', taste: [0, 0, 0, 4, 2], value: 2, tags: [] },
      amazu_myoga: { cat: 'herb', taste: [0, 3, 0, 4, 2], value: 2, tags: ['red'] },
      negi:        { cat: 'herb', taste: [1, 0, 1, 3, 1], value: 1, tags: [] },
      shiraganegi: { cat: 'herb', taste: [1, 0, 0, 3, 2], value: 1, tags: ['white'] },
      yakinegi:    { cat: 'herb', taste: [0, 0, 2, 3, 1], value: 1, tags: [] },
      shoga:       { cat: 'herb', taste: [2, 0, 0, 4, 1], value: 1, tags: [] },
      shiso:       { cat: 'herb', taste: [0, 0, 0, 5, 1], value: 1, tags: [] },
      mitsuba:     { cat: 'herb', taste: [0, 0, 0, 4, 1], value: 1, tags: [] },
      yuzu:        { cat: 'herb', taste: [0, 3, 0, 4, 0], value: 2, tags: [] },
      goma:        { cat: 'herb', taste: [0, 0, 2, 3, 2], value: 1, tags: [] },
      kizaminori:  { cat: 'herb', taste: [0, 0, 2, 3, 1], value: 1, tags: [] },
      wasabi:      { cat: 'herb', taste: [4, 0, 0, 4, 0], value: 3, tags: [] },
      sansho:      { cat: 'herb', taste: [3, 0, 0, 5, 0], value: 2, tags: [] },
      shichimi:    { cat: 'herb', taste: [5, 0, 0, 3, 0], value: 1, tags: ['red'] },
      togarashi:   { cat: 'herb', taste: [6, 0, 0, 2, 1], value: 1, tags: ['red'] },

      // ----- 第3段階：山・対決・行事・旅の客 -----
      kashira:     { cat: 'main', taste: [0, 0, 6, 2, 3], value: 20, tags: ['meat', 'rare'] },
      ino_karaage: { cat: 'main', taste: [0, 0, 5, 2, 4], value: 14, tags: ['meat'] },
      amazu:       { cat: 'salsa', taste: [0, 4, 2, 1, 0], value: 3, tags: ['red'] },
      sanmai:      { cat: 'skin', taste: [0, 0, 3, 5, 5], value: 12, tags: [], virtual: true },
      pan:         { cat: 'skin', taste: [0, 0, 2, 3, 2], value: 6, tags: [] },
      sakura:      { cat: 'herb', taste: [0, 2, 0, 5, 0], value: 3, tags: ['red'] },
      ranou:       { cat: 'salsa', taste: [0, 0, 5, 1, 0], value: 4, tags: ['egg'] },
      konbu:       { cat: 'herb', taste: [0, 0, 4, 2, 1], value: 2, tags: [] },
      yuba:        { cat: 'skin', taste: [0, 0, 3, 2, 1], value: 8, tags: ['white'] },
      sake:        { cat: 'main', taste: [0, 0, 5, 2, 1], value: 14, tags: ['fish', 'red'] },
      buta:        { cat: 'main', taste: [0, 0, 6, 2, 2], value: 14, tags: ['meat'] },
      // ----- 第3段階：長崎の抜け荷（本場の食材） -----
      kosho:       { cat: 'herb', taste: [4, 0, 0, 4, 0], value: 4, tags: ['rare'] },
      nikkei:      { cat: 'herb', taste: [0, 0, 1, 6, 0], value: 4, tags: ['rare'] },
      choji:       { cat: 'herb', taste: [1, 0, 1, 6, 0], value: 4, tags: ['rare'] },
      sato:        { cat: 'salsa', taste: [0, 0, 2, 1, 0], value: 4, tags: ['white'] },
      pineapple:   { cat: 'main', taste: [0, 4, 2, 4, 3], value: 12, tags: ['rare'] },
      gyuniku:     { cat: 'main', taste: [0, 0, 7, 2, 2], value: 22, tags: ['meat', 'rare'] },
      cheese:      { cat: 'main', taste: [0, 1, 5, 2, 1], value: 14, tags: ['rare', 'white'] },
      butter:      { cat: 'salsa', taste: [0, 0, 4, 3, 0], value: 8, tags: ['rare'] },
      tomato:      { cat: 'main', taste: [0, 4, 3, 2, 2], value: 10, tags: ['rare', 'red'] },
      avocado:     { cat: 'main', taste: [0, 0, 4, 2, 1], value: 14, tags: ['rare'] },
      mole:        { cat: 'salsa', taste: [2, 0, 6, 6, 0], value: 20, tags: ['rare'] },
      honba_chili: { cat: 'herb', taste: [7, 0, 1, 4, 0], value: 4, tags: ['red', 'rare'] },
      corn:        { cat: 'raw', taste: [0, 0, 0, 0, 0], value: 4, tags: [] },
      // ----- 最終章：灰汁で煮て挽いた、本物のトウモロコシの皮 -----
      real_tortilla: { cat: 'skin', taste: [0, 0, 2, 3, 3], value: 6, tags: [], as: 'tortilla' }
    },

    // ---------------------------------------------------------
    // タコス（メニュー）
    //   skin    : 使う皮（'tortilla' のタコスは、もろこし粉の皮でも作れる）
    //   need    : 必ずのせる食材（これがそろえば「注文どおり」）
    //   price   : 値段（文）。星の数・熟練度・客によって上下する
    //   chapter : 何章から出てくるか
    //   light   : さっぱりしたタコスなら true（絵ですだちを添えない）
    //   maxStars: 星の上限（ふつうは3）
    //   season  : その季節だけ（'spring' 'summer' 'autumn' 'winter'）
    //   variants: 客が部位を選ぶタコス（部位ごとに need に1つ足される）
    // ---------------------------------------------------------
    TACOS: {
      // 第1章
      tempura:   { skin: 'tortilla', need: ['kisu_ten', 'daikon', 'shiraae', 'yuzu'], price: 32, chapter: 1 },
      takotaco:  { skin: 'tortilla', need: ['tako', 'sumiso', 'kyuri', 'myoga'], price: 30, chapter: 1, light: true },
      kohaku:    { skin: 'tortilla', need: ['tai', 'daikon', 'bainiku'], price: 40, chapter: 1, light: true },
      // 第2章
      katsuo_tataki: { skin: 'tortilla', need: ['katsuo', 'negi', 'shoga', 'irizake', 'shichimi'], price: 42, chapter: 2 },
      dorado:    { skin: 'aburaage', need: ['tofu_soboro', 'shiso'], price: 22, chapter: 2 },
      shojin:    { skin: 'funoyaki', need: ['satsumaimo', 'satoimo', 'dengaku_miso', 'goma'], price: 30, chapter: 2 },
      kago:      { skin: 'kagomushi', need: [], price: 20, chapter: 2, maxStars: 2 },
      nigiri:    { skin: 'nori', need: ['sumeshi', 'zuke', 'wasabi'], price: 44, chapter: 2, light: true },
      kamo_nanban: { skin: 'soba', need: ['kamo', 'yakinegi', 'togarashi'], price: 46, chapter: 2 },
      nanbanzuke: { skin: 'tortilla', need: ['aji_nanban', 'myoga'], price: 32, chapter: 2, light: true },
      oden:      { skin: 'tortilla', need: ['nidaikon', 'konnyaku', 'yakidofu', 'dashi'], price: 34, chapter: 2 },
      chazuke:   { skin: 'yakionigiri', need: ['dashi', 'mitsuba'], price: 26, chapter: 2, light: true },
      tamago:    { skin: 'usuyaki', need: ['atsuyaki', 'kizaminori'], price: 30, chapter: 2 },
      sutaco:    { skin: 'any', need: [], price: 1, chapter: 2, onlyWhenOut: true },
      // 第3章
      yamakujira: { skin: 'funoyaki', need: ['inoshishi', 'shichimi_miso', 'irizake', 'shiraganegi', 'yuzu'], price: 52, chapter: 3 },
      shamo_tinga: { skin: 'funoyaki', need: ['shamo', 'miso', 'togarashi', 'mitsuba'], price: 44, chapter: 3 },
      dengaku:   { skin: 'funoyaki', need: ['nasu', 'dengaku_miso', 'goma'], price: 30, chapter: 3 },
      chapulines: { skin: 'tortilla', need: ['inago', 'yuzu', 'shichimi'], price: 38, chapter: 3 },
      escamoles: { skin: 'tortilla', need: ['hachinoko', 'negi'], price: 46, chapter: 3 },
      huitlacoche: { skin: 'tortilla', need: ['makomo', 'irizake'], price: 42, chapter: 3, light: true },
      adobada:   { skin: 'tortilla', need: ['kabayaki', 'sansho', 'amazu_myoga'], price: 56, chapter: 3 },
      momiji:    { skin: 'tortilla', need: ['shika', 'yakinegi', 'yuzu'], price: 52, chapter: 3 },
      botan:     { skin: 'tortilla', need: ['inoshishi', 'miso', 'togarashi'], price: 50, chapter: 3 },
      campechano: { skin: 'funoyaki', need: ['inoshishi', 'shika', 'shamo'], price: 66, chapter: 3 },
      surtido:   { skin: 'tortilla', need: [], price: 46, chapter: 3,
                   variants: { rosu: 'inoshishi', bara: 'ino_bara', shita: 'ino_shita', mimi: 'ino_mimi' } },
      // 第4章
      maguro3:   { skin: 'tortilla', need: ['akami', 'chutoro', 'otoro'], price: 88, chapter: 4 },
      kozakana:  { skin: 'tortilla', need: ['iwashi', 'aji_nanban', 'kisu_ten'], price: 44, chapter: 4 },
      matsutake: { skin: 'funoyaki', need: ['matsutake', 'kamo', 'yuzu'], price: 78, chapter: 4, season: 'autumn' },
      uni:       { skin: 'nori', need: ['uni', 'wasabi'], price: 70, chapter: 4, light: true },
      isana:     { skin: 'tortilla', need: ['kujira'], price: 60, chapter: 4 },
      namiura:   { skin: 'aigawa', need: ['oroshi'], price: 40, chapter: 4, light: true },
      // 第3段階（needFlag = 物語やミニゲームで解禁されるまでメニューに出ない）
      yamanushi: { skin: 'tortilla', need: ['kashira', 'shiraganegi', 'yuzu'], price: 58, chapter: 3, needFlag: 'gotNushi' },
      yokozuna:  { skin: 'sanmai', need: ['inoshishi', 'shika', 'shamo'], price: 90, chapter: 3, needFlag: 'win_rikishi' },
      tojin:     { skin: 'tortilla', need: ['ino_karaage', 'amazu'], price: 54, chapter: 4, needFlag: 'win_tojin' },
      mie:       { skin: 'tortilla', need: ['tai', 'bainiku', 'oroshi', 'shiraae'], price: 64, chapter: 4, needFlag: 'win_raizo', light: true },
      oranda:    { skin: 'pan', need: ['tai', 'butter'], price: 60, chapter: 5, needFlag: 'win_oranda' },
      pastor:    { skin: 'tortilla', need: ['inoshishi', 'choji', 'nikkei', 'honba_chili', 'pineapple'], price: 96, chapter: 5 },
      quesabirria: { skin: 'tortilla', need: ['gyuniku', 'cheese'], price: 88, chapter: 5 },
      pico:      { skin: 'tortilla', need: ['tomato', 'negi', 'mitsuba', 'yuzu'], price: 58, chapter: 5, light: true },
      guacamole: { skin: 'tortilla', need: ['kisu_ten', 'avocado', 'yuzu'], price: 72, chapter: 5 },
      tenka:     { skin: 'real_tortilla', need: ['tai', 'mole', 'negi', 'shiso', 'myoga', 'yuzu'], price: 160, chapter: 6 },
      // 年中行事の限定（festival = その行事の日だけ）
      hanami:    { skin: 'tortilla', need: ['sakura', 'tai', 'shiraae'], price: 50, chapter: 4, festival: 'hanami', light: true },
      tsukimi:   { skin: 'tortilla', need: ['satoimo', 'ranou', 'dashi'], price: 46, chapter: 4, festival: 'tsukimi' },
      // 旅の客の、ふるさとのタコス（traveler = その地方の客だけが頼む）
      osaka:     { skin: 'tortilla', need: ['konbu', 'dashi', 'yakidofu'], price: 48, chapter: 4, traveler: 'osaka' },
      kyo:       { skin: 'yuba', need: ['tofu_soboro', 'mitsuba'], price: 52, chapter: 4, traveler: 'kyo', light: true },
      ezo:       { skin: 'tortilla', need: ['sake', 'konbu'], price: 50, chapter: 4, traveler: 'ezo' },
      satsuma:   { skin: 'tortilla', need: ['buta', 'satsumaimo'], price: 50, chapter: 4, traveler: 'satsuma' },
      nagasaki:  { skin: 'tortilla', need: ['tomato', 'kosho', 'negi'], price: 56, chapter: 4, traveler: 'nagasaki' }
    },

    // 素タコス（食材1つだけのタコス）：食材を初めて手に入れると図鑑に加わる
    SU_TACO: { base: 12, maxStars: 2 },

    // 熟練度：同じタコスを出した回数がこれ以上で Lv1〜5
    MASTERY: {
      served: [0, 2, 6, 12, 20],
      priceMul: [1, 1.08, 1.16, 1.25, 1.35],   // Lv ごとの値段の倍率
      maxStars: [2, 3, 3, 3, 3]                 // Lv ごとの星の上限（Lv1 は練習中で星2まで）
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
    //   fastBonus / fastSeconds : この秒数以内に出すと上乗せ
    //   looksBonus : 紅白（赤と白の食材）がそろうと上乗せ
    //   bigBonus / bigItems     : 食材をこの数以上のせると上乗せ（大盛り）
    //   rareBonus  : 珍品がのっていると上乗せ / plainPenalty : 珍品がないと引く
    //   forbid     : この種類の食材がのっていると星1（お坊さんの肉・魚・卵）
    //   tagBonus   : 食材の種類ごとの上乗せ・引き（例：お侍は赤身が好き、脂は苦手）
    // ---------------------------------------------------------
    CUSTOMERS: {
      chonin: {
        chapter: 1, want: [1, 3, 6, 7, 9], weight: [0.1, 0.15, 0.3, 0.15, 0.3],
        patience: 38, pay: 0.9, omakase: 0.15,
        likes: ['takotaco', 'tempura', 'dorado', 'kago', 'oden', 'nanbanzuke', 'tamago', 'kohaku'],
        fastBonus: 0.12, fastSeconds: 18
      },
      shokunin: {
        chapter: 1, want: [6, 2, 6, 7, 7], weight: [0.45, 0.05, 0.25, 0.1, 0.15],
        patience: 50, pay: 1.0, omakase: 0.3,
        likes: ['katsuo_tataki', 'kamo_nanban', 'botan', 'shamo_tinga', 'yamakujira', 'tempura', 'chapulines', 'takotaco']
      },
      samurai: {
        chapter: 1, want: [0, 4, 6, 6, 6], weight: [0.1, 0.2, 0.3, 0.25, 0.15],
        patience: 60, pay: 1.2, omakase: 0.15,
        likes: ['kohaku', 'nigiri', 'momiji', 'tempura', 'maguro3', 'matsutake', 'takotaco'],
        looksBonus: 0.15, tagBonus: { lean: 0.08, fatty: -0.1 }
      },
      bozu: {
        chapter: 2, want: [0, 2, 6, 8, 6], weight: [0.05, 0.1, 0.35, 0.3, 0.2],
        patience: 70, pay: 0.9, omakase: 0.25,
        likes: ['shojin', 'dorado', 'dengaku', 'huitlacoche', 'namiura'],
        forbid: ['fish', 'meat', 'egg']
      },
      rikishi: {
        chapter: 2, want: [2, 2, 10, 6, 10], weight: [0.05, 0.05, 0.4, 0.15, 0.35],
        patience: 45, pay: 1.8, omakase: 0.2,
        likes: ['campechano', 'katsuo_tataki', 'botan', 'kamo_nanban', 'oden', 'surtido', 'tempura'],
        bigBonus: 0.15, bigItems: 5
      },
      tsujin: {
        chapter: 3, want: [2, 3, 8, 9, 6], weight: [0.1, 0.15, 0.3, 0.3, 0.15],
        patience: 55, pay: 1.5, omakase: 0.35,
        likes: ['huitlacoche', 'escamoles', 'chapulines', 'maguro3', 'uni', 'adobada', 'matsutake', 'surtido'],
        rareBonus: 0.2, plainPenalty: 0.15, tagBonus: { fatty: 0.1 }
      }
    },
    // 客の好みの個人差（want を ±この数だけ、客ごとにランダムにずらす）
    CUSTOMER_JITTER: 1,
    // 客の種類が来る割合（章ごとに解禁された種類から選ぶ）
    CUSTOMER_MIX: { chonin: 5, shokunin: 3, samurai: 2, bozu: 1.3, rikishi: 1.1, tsujin: 1.2 },
    // 客がひとこと感想を言う確率
    COMMENT_CHANCE: 0.4,

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
      perStar: [0, 0, 2, 4],    // 星1〜3の客1人ごと（星1では減らない）
      angry: -2,                // 怒って帰った客1人ごと
      vipWin: 20,               // VIP対決に勝ったとき
      vipLose: -4               // VIP対決に負けたとき
    },

    // 評判ランク：rep がこの値以上でそのランク（= 章）。
    //   1 名もなき屋台 / 2 町の噂 / 3 行列の屋台 / 4 江戸の名物 / 5 将軍の耳に届く
    //   はじめての人が約1時間（11日目ごろ）で「江戸の名物」、約3時間でエンディングに届くように調整
    //   （1日 = 仕入れ＋3分の営業＋結果 でおよそ5〜6分として計算）
    RANKS: [0, 25, 85, 210, 420],

    // ---------------------------------------------------------
    // 仕入れ先
    //   kind: 'game' ミニゲームあり（1日に回れる数に数える） / 'shop' 町の店（数えない）
    //   soon: true のあいだは「近日公開」
    // ---------------------------------------------------------
    SUPPLIERS: [
      { id: 'uogashi', kind: 'game', game: 'auction', chapter: 1 },
      { id: 'ipponzuri', kind: 'game', game: 'fishing', chapter: 2 },
      { id: 'satoyama', kind: 'game', game: 'forage', chapter: 3 },
      { id: 'yama', kind: 'game', game: 'hunt', chapter: 3, needFlag: 'metKumazo' },
      { id: 'nagasaki', kind: 'game', game: 'smuggle', chapter: 5 },
      { id: 'aomono', kind: 'shop', chapter: 1 },
      { id: 'komeya', kind: 'shop', chapter: 1 },
      { id: 'tofuya', kind: 'shop', chapter: 2 },
      { id: 'toriya', kind: 'shop', chapter: 2 },
      { id: 'yagenbori', kind: 'shop', chapter: 2 },
      { id: 'momonjiya', kind: 'shop', chapter: 3 }
    ],
    MAX_GAMES_PER_DAY: 3,

    // ---------------------------------------------------------
    // 町の店の品ぞろえ
    //   id: 在庫に入る食材 / n: 何人前か / price: 値段（文） / chapter: 何章から / season: その季節だけ
    // ---------------------------------------------------------
    SHOPS: {
      aomono: [
        { id: 'daikon', n: 6, price: 12, chapter: 1 },
        { id: 'kyuri', n: 5, price: 10, chapter: 1 },
        { id: 'myoga', n: 5, price: 14, chapter: 1 },
        { id: 'negi', n: 6, price: 10, chapter: 1 },
        { id: 'yuzu', n: 5, price: 15, chapter: 1 },
        { id: 'shoga', n: 6, price: 10, chapter: 2 },
        { id: 'shiso', n: 6, price: 12, chapter: 2 },
        { id: 'yakinegi', n: 5, price: 12, chapter: 2 },
        { id: 'wasabi', n: 5, price: 25, chapter: 2 },
        { id: 'satsumaimo', n: 4, price: 16, chapter: 2 },
        { id: 'satoimo', n: 4, price: 16, chapter: 2 },
        { id: 'konnyaku', n: 4, price: 12, chapter: 2 },
        { id: 'nidaikon', n: 4, price: 14, chapter: 2 },
        { id: 'shiraganegi', n: 6, price: 12, chapter: 3 },
        { id: 'mitsuba', n: 6, price: 12, chapter: 2 },
        { id: 'nasu', n: 4, price: 16, chapter: 3 },
        { id: 'amazu_myoga', n: 5, price: 18, chapter: 3 },
        { id: 'oroshi', n: 6, price: 12, chapter: 4 },
        { id: 'matsutake', n: 3, price: 90, chapter: 4, season: 'autumn' },
        { id: 'sakura', n: 5, price: 20, chapter: 4, season: 'spring' }
      ],
      komeya: [
        { id: 'irizake', n: 10, price: 15, chapter: 1 },
        { id: 'sumiso', n: 8, price: 16, chapter: 1 },
        { id: 'bainiku', n: 8, price: 20, chapter: 1 },
        { id: 'morokoshi', n: 10, price: 40, chapter: 2 },
        { id: 'funoyaki', n: 10, price: 30, chapter: 2 },
        { id: 'soba', n: 10, price: 35, chapter: 2 },
        { id: 'nori', n: 10, price: 40, chapter: 2 },
        { id: 'yakionigiri', n: 6, price: 30, chapter: 2 },
        { id: 'sumeshi', n: 6, price: 24, chapter: 2 },
        { id: 'miso', n: 10, price: 20, chapter: 2 },
        { id: 'dengaku_miso', n: 8, price: 24, chapter: 2 },
        { id: 'dashi', n: 8, price: 20, chapter: 2 },
        { id: 'goma', n: 10, price: 12, chapter: 2 },
        { id: 'kizaminori', n: 10, price: 15, chapter: 2 },
        { id: 'aigawa', n: 8, price: 40, chapter: 4 },
        { id: 'amazu', n: 8, price: 24, chapter: 4 },
        { id: 'pan', n: 6, price: 48, chapter: 5 },
        // エンディングのあとは、江戸で育てたトウモロコシが米屋に並ぶ
        { id: 'corn', n: 5, price: 40, chapter: 6, needFlag: 'cleared' }
      ],
      tofuya: [
        { id: 'shiraae', n: 8, price: 16, chapter: 1 },
        { id: 'tofu_soboro', n: 5, price: 15, chapter: 2 },
        { id: 'yakidofu', n: 5, price: 15, chapter: 2 },
        { id: 'aburaage', n: 6, price: 18, chapter: 2 }
      ],
      toriya: [
        { id: 'shamo', n: 4, price: 60, chapter: 2 },
        { id: 'kamo', n: 4, price: 70, chapter: 2 },
        { id: 'atsuyaki', n: 5, price: 30, chapter: 2 },
        { id: 'usuyaki', n: 8, price: 28, chapter: 2 },
        { id: 'ranou', n: 6, price: 30, chapter: 4 }
      ],
      yagenbori: [
        { id: 'shichimi', n: 15, price: 20, chapter: 1 },
        { id: 'togarashi', n: 8, price: 16, chapter: 2 },
        { id: 'shichimi_miso', n: 8, price: 24, chapter: 2 }
      ],
      momonjiya: [
        { id: 'inoshishi', n: 5, price: 90, chapter: 3 },
        { id: 'ino_bara', n: 4, price: 70, chapter: 3 },
        { id: 'ino_shita', n: 3, price: 60, chapter: 3 },
        { id: 'ino_mimi', n: 4, price: 40, chapter: 3 },
        { id: 'shika', n: 4, price: 85, chapter: 3 },
        { id: 'ino_karaage', n: 5, price: 80, chapter: 4 }
      ]
    },

    // 作り置き（かご蒸しタコス）：朝のうちに蒸しておくと、夜はタップ1回で出せる
    KAGO: { chapter: 2, uses: ['tortilla', 'satoimo'], alt: ['morokoshi', 'satoimo'], batch: 4 },

    // ---------------------------------------------------------
    // ミニゲーム「魚河岸の競り」
    // ---------------------------------------------------------
    AUCTION: {
      seconds: 30,           // 1回の長さ（秒）
      lotSeconds: 5.5,       // 1匹（1山）が競りにかかっている時間（秒）
      priceLow: 0.55,        // 値札が下がる一番下（相場の何倍か）
      priceHigh: 1.55,       // 値札が上がる一番上
      whaleChance: 0.15,     // 鯨組の大物が入る日の確率（第4章から）
      // 競りに出る魚。base = 相場（文）、portions = 何人分の具になるか、gives = 在庫に入る食材
      fish: {
        tai:    { base: 90, portions: 5, gives: 'tai', weight: 3, chapter: 1 },
        kisu:   { base: 55, portions: 4, gives: 'kisu_ten', weight: 4, chapter: 1 },
        tako:   { base: 70, portions: 5, gives: 'tako', weight: 3, chapter: 1 },
        katsuo: { base: 80, portions: 6, gives: 'katsuo', weight: 2, chapter: 1 },
        uni:    { base: 120, portions: 4, gives: 'uni', weight: 1.5, chapter: 4 },
        kujira: { base: 260, portions: 12, gives: 'kujira', weight: 0, chapter: 4, whale: true }
      }
    },

    // ---------------------------------------------------------
    // ミニゲーム「江戸湾の一本釣り」
    //   押している間は糸を巻く（張りが強くなる）。離すと張りがゆるみ、魚は逃げようと離れていく。
    //   張りが100をこえると糸が切れる。距離が0になれば釣りあげ。
    // ---------------------------------------------------------
    FISHING: {
      seconds: 40,           // 1回の長さ（秒）
      reelSpeed: 34,         // 押している間、1秒に近づく距離
      tensionUp: 55,         // 押している間、1秒に上がる張り
      tensionDown: 70,       // 離している間、1秒に下がる張り
      startDistance: 100,
      nushiChance: 0.08,     // ヌシの大鮪がかかる確率（第2章から）
      // pull: 魚が引く強さ（1秒に離れる距離）、surge: ときどき強く引く強さ、weight: かかりやすさ
      fish: {
        aji:    { pull: 10, surge: 18, gives: { aji_nanban: 4 }, weight: 4 },
        iwashi: { pull: 7, surge: 12, gives: { iwashi: 5 }, weight: 4 },
        maguro: { pull: 18, surge: 34, gives: { zuke: 3, akami: 2 }, weight: 2 },
        unagi:  { pull: 12, surge: 40, gives: { kabayaki: 4 }, weight: 2 },
        nushi:  { pull: 24, surge: 44, gives: { akami: 6, chutoro: 5, otoro: 4, zuke: 5 }, weight: 0 }
      }
    },

    // ---------------------------------------------------------
    // ミニゲーム「田んぼと里山の採集」
    // ---------------------------------------------------------
    // ---------------------------------------------------------
    // ミニゲーム「山の追い込み」（猟師の熊蔵と、スワイプで獲物を罠の柵へ追い込む）
    // ---------------------------------------------------------
    HUNT: {
      seconds: 40,
      push: 170,             // スワイプ1回で獲物を押す強さ
      reach: 34,             // スワイプの線から、この距離までの獲物を押せる（ドット）
      nushiChance: 0.12,     // 山の主（大猪）が出る確率
      // speed: うろつく速さ、hits: 何回押せば罠に向かうか（大きいほど重い）
      animals: {
        boar:  { speed: 26, weight: 3, gives: { inoshishi: 3, ino_bara: 2, ino_shita: 1, ino_mimi: 2 } },
        deer:  { speed: 40, weight: 2, gives: { shika: 4 } },
        nushi: { speed: 20, weight: 0, heavy: 2.4, gives: { kashira: 10, inoshishi: 4, ino_bara: 3 } }
      }
    },

    // ---------------------------------------------------------
    // ミニゲーム「長崎の抜け荷」（夜。押している間だけ歩く。役人の提灯の明かりに入ると見つかる）
    // ---------------------------------------------------------
    SMUGGLE: {
      seconds: 45,
      walkSpeed: 34,         // 1秒に進むドット数
      pathLength: 150,       // 船から屋台の荷車までの道の長さ（ドット）
      spotTime: 0.35,        // 明かりの中にこの秒数いると見つかる（止まっていても）
      caughtRep: -6,         // 見つかったときの評判
      lanterns: 3,           // 見回りの役人の数
      // 1回運ぶごとに、この中から1つ手に入る（weight = 出やすさ、n = 何人前）
      goods: {
        kosho: { weight: 3, n: 6 }, nikkei: { weight: 2, n: 6 }, choji: { weight: 2, n: 6 },
        sato: { weight: 2, n: 6 }, pineapple: { weight: 2, n: 4 }, gyuniku: { weight: 2, n: 4 },
        cheese: { weight: 2, n: 4 }, butter: { weight: 2, n: 5 }, tomato: { weight: 2, n: 4 },
        avocado: { weight: 1.5, n: 4 }, mole: { weight: 1, n: 4 }, honba_chili: { weight: 2, n: 6 },
        corn: { weight: 1, n: 6 }
      },
      cornGuaranteeAfter: 3  // 第5章で、トウモロコシの種がまだなら、この回数運んだら必ず出る
    },

    // ---------------------------------------------------------
    // 常連（客の種類ごとに1人）。chance = その夜に常連が1人来る確率
    //   fav = 好物（頼みやすい・出すと喜ぶ）、eventAfter = 星3を何回出すと、その常連の話が起きる
    // ---------------------------------------------------------
    REGULARS: {
      chance: 0.5,
      favBonus: 0.08,
      eventAfter: 3,
      list: {
        chonin: { id: 'yokichi', fav: 'takotaco' },
        shokunin: { id: 'genpachi', fav: 'katsuo_tataki' },
        samurai: { id: 'hotta', fav: 'kohaku' },
        bozu: { id: 'jonen', fav: 'shojin' },
        rikishi: { id: 'ikazuchi', fav: 'campechano' },
        tsujin: { id: 'sessai', fav: 'huitlacoche' }
      }
    },

    // ---------------------------------------------------------
    // VIP料理対決・特別な来店。お題のタコスを、時間内に点数 minScore 以上で出せば勝ち
    //   chapter = その章で、chapterDay 日目以降の夜に来る（勝つまで何度でも来る）
    // ---------------------------------------------------------
    VIPS: {
      rikishi: { chapter: 3, chapterDay: 3, guest: 'ikazuchi', type: 'rikishi', recipe: 'yokozuna', time: 75, minScore: 0.7, win: 'win_rikishi', minItems: 5 },
      tojin:   { chapter: 4, chapterDay: 2, guest: 'chin', type: 'tsujin', recipe: 'tojin', time: 70, minScore: 0.72, win: 'win_tojin' },
      raizo:   { chapter: 4, chapterDay: 4, guest: 'raizo', type: 'samurai', recipe: 'mie', time: 80, minScore: 0.7, win: 'win_raizo', visit: true },
      oranda:  { chapter: 5, chapterDay: 2, guest: 'ransai', type: 'tsujin', recipe: 'oranda', time: 70, minScore: 0.72, win: 'win_oranda' },
      tribute: { chapter: 6, chapterDay: 1, guest: 'uesama', type: 'samurai', recipe: 'tenka', time: 90, minScore: 0.8, win: 'cleared', needFlag: 'tributeReady' }
    },
    // VIP の好みの味（お題のタコスに合うように）
    VIP_WANT: {
      ikazuchi: [2, 2, 14, 8, 12],
      chin: [1, 5, 8, 6, 6],
      raizo: [1, 5, 9, 8, 5],
      ransai: [0, 2, 8, 7, 4],
      uesama: [2, 3, 12, 20, 6]
    },

    // ---------------------------------------------------------
    // 江戸の年中行事（第4章から）。季節の何日目か（1〜SEASON_DAYS）
    //   busier: 客の来る間隔の倍率 / order: 頼まれやすくなるタコスとその倍率
    //   priceMul: そのタコスの値段の倍率 / smallBonus: 具が2つ以下の小さなタコスへの上乗せ
    // ---------------------------------------------------------
    FESTIVALS: {
      chapter: 4,
      list: {
        hanami:    { season: 'spring', day: 4, busier: 0.75, order: { hanami: 6 }, patienceMul: 1.3 },
        hatsugatsuo: { season: 'summer', day: 1, busier: 0.9, order: { katsuo_tataki: 8 }, priceMul: { katsuo_tataki: 2 } },
        kawabiraki: { season: 'summer', day: 3, busier: 0.55, patienceMul: 0.8, smallBonus: 0.15 },
        doyo:      { season: 'summer', day: 6, busier: 0.9, order: { adobada: 8 }, priceMul: { adobada: 1.3 } },
        tsukimi:   { season: 'autumn', day: 4, busier: 0.85, order: { tsukimi: 6 } }
      }
    },

    // ---------------------------------------------------------
    // 旅の客（第4章から）。ふるさとの名物を持ってきて、それでタコスを頼む
    //   bring = 来たときに在庫に足される名物
    // ---------------------------------------------------------
    TRAVELERS: {
      chapter: 4,
      chance: 0.12,          // 客1人ごとに、旅の客である確率
      list: {
        osaka:    { recipe: 'osaka', bring: { konbu: 2 }, pay: 1.4 },
        kyo:      { recipe: 'kyo', bring: { yuba: 2 }, pay: 1.5 },
        ezo:      { recipe: 'ezo', bring: { sake: 2, konbu: 1 }, pay: 1.3 },
        satsuma:  { recipe: 'satsuma', bring: { buta: 2 }, pay: 1.3 },
        nagasaki: { recipe: 'nagasaki', bring: { tomato: 1, kosho: 1 }, pay: 1.4 }
      }
    },

    // ---------------------------------------------------------
    // 最終章
    //   第5章になって summonsAfterDays 日たち、トウモロコシ（抜け荷）を手に入れていると、お城から使いが来る
    //   灰汁の知恵を借りたあと、朝に「本物の皮」を焼ける（corn 1 → real_tortilla perCorn 枚）
    // ---------------------------------------------------------
    FINALE: {
      summonsAfterDays: 4,
      perCorn: 3,
      tatsuTai: 6            // 辰五郎が届けてくれる鯛の数
    },

    // ---------------------------------------------------------
    // 物語の場面（会話は text.js の STORY）。どの場面を、いつ出すか
    //   at     : 'newgame' はじめたとき / 'morning' 朝 / 'night' 夜の開店前 / 'result' 結果のあと
    //            'rankup' ランクアップしたとき / 'regular' 常連に星3を何回も出したとき / ほか特別なとき
    //   day    : その日 / chapter : その章 / chapterDay : その章になって何日目から
    //   set    : 起きたら立てる目印 / give : もらえる食材 / rep : 評判 / money : お金
    //   regular: その夜の最初の客として来る常連（客の種類）
    // ---------------------------------------------------------
    EVENTS: [
      { id: 'prologue', at: 'newgame' },
      { id: 'day1', at: 'morning', day: 1 },
      { id: 'first_night', at: 'night', day: 1, regular: 'chonin' },
      { id: 'rival_meet', at: 'night', day: 2 },
      { id: 'ch2', at: 'rankup', chapter: 2 },
      { id: 'bozu_intro', at: 'night', chapter: 2, chapterDay: 1, regular: 'bozu' },
      { id: 'rikishi_intro', at: 'night', chapter: 2, chapterDay: 2, regular: 'rikishi' },
      { id: 'ch3', at: 'rankup', chapter: 3, set: 'metKumazo' },
      { id: 'tsujin_intro', at: 'night', chapter: 3, chapterDay: 1, regular: 'tsujin' },
      { id: 'hunt_nushi', at: 'hunt_nushi', set: 'gotNushi' },
      { id: 'ch4', at: 'rankup', chapter: 4 },
      { id: 'traveler_first', at: 'traveler' },
      { id: 'rival_storm', at: 'result', chapter: 4, chapterDay: 5 },
      { id: 'ch5', at: 'rankup', chapter: 5 },
      { id: 'smuggle_first', at: 'smuggle' },
      { id: 'summons', at: 'morning', chapter: 5, chapterDay: 5, needStock: 'corn', set: 'finale', setStock: { tortilla: 0 }, next: 'nixtamal' },
      { id: 'nixtamal', at: 'chain', set: 'nixtamal' },
      { id: 'tatsu_tai', at: 'morning', needFlag: 'madeReal', set: 'tributeReady', give: { tai: 6 } },
      { id: 'ending', at: 'ending', set: 'cleared' },
      { id: 'reg_yokichi', at: 'regular', regular: 'yokichi', rep: 12 },
      { id: 'reg_genpachi', at: 'regular', regular: 'genpachi', give: { shichimi: 20, togarashi: 8 } },
      { id: 'reg_hotta', at: 'regular', regular: 'hotta', money: 200 },
      { id: 'reg_jonen', at: 'regular', regular: 'jonen', give: { satsumaimo: 6, satoimo: 6 } },
      { id: 'reg_ikazuchi', at: 'regular', regular: 'ikazuchi', rep: 12 },
      { id: 'reg_sessai', at: 'regular', regular: 'sessai', rep: 15 }
    ],

    FORAGE: {
      seconds: 30,
      maxOnField: 5,         // 画面に同時に出る数
      // life: 出ている時間（秒）、gives: 1回とったときに入る数、weight: 出やすさ
      items: {
        inago:     { life: 2.6, gives: { inago: 1 }, weight: 5, hop: true },
        hachi:     { life: 2.0, gives: { hachinoko: 2 }, weight: 1.5 },
        sansho:    { life: 3.0, gives: { sansho: 2 }, weight: 2 },
        makomo:    { life: 2.4, gives: { makomo: 2 }, weight: 1.5 }
      }
    }
  };
})(window);
