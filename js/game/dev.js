/*
 * 多幸寿：開発用メニュー（ミニゲームだけを試す）
 *   アドレスの最後に ?dev をつけて開くと、タイトルの代わりにこのメニューが出る。
 *     例）https://tanukibox.github.io/OH-EDO-TACO-TUESDAY/?dev
 *   ・章をえらんで、競り・一本釣り・里山・山・長崎・夜の営業・瓦版・番付をすぐに遊べる
 *   ・ここでの遊びは別のセーブに入る（本番のセーブ「続きから」には何も残らない）
 *   ・ミニゲームが終わると、このメニューに戻る。右上の「DEV」でいつでも戻れる
 *   ことばは text.js の 'dev.*'。
 */
(function (global) {
  'use strict';
  var OT = global.OT = global.OT || {};
  if (!/[?&]dev\b/.test(global.location.search)) return;

  OT.DEV = { chapter: 1, back: false };
  OT.CFG.SAVE_KEY += '.dev';   // 本番のセーブとは別の場所に保存する

  var CH_DAY = [2, 8, 14, 22, 30, 36];   // 章ごとの日（季節もこれで決まる）

  /** 章 ch のはじめの状態を作る（物語の場面と案内は見終わったことにする） */
  function setup(ch) {
    var prev = OT.state.get(), seen = prev && prev.flags.ymLesson;   // 抜け荷のイカサマの説明は、一度見たらもう出さない
    var S = OT.state.newGame(), C = OT.CFG;
    if (seen) S.flags.ymLesson = 1;
    S.day = CH_DAY[ch - 1];
    S.rep = ch <= 5 ? C.RANKS[ch - 1] + 5 : C.RANKS[4] + 80;
    S.rankSeen = Math.min(ch - 1, C.RANKS.length - 1);
    S.chStart = { 1: 1 };
    for (var c = 2; c <= ch; c++) S.chStart[c] = CH_DAY[c - 1];
    S.money = 3000;
    C.EVENTS.forEach(function (ev) { S.flags['ev_' + ev.id] = 1; });
    S.flags.tutDone = 1; S.flags.tutNight = 1;
    if (ch >= 3) S.flags.metKumazo = 1;
    if (ch >= 6) { S.flags.finale = 1; S.flags.nixtamal = 1; }
    Object.keys(C.INGREDIENTS).forEach(function (id) {
      if (C.INGREDIENTS[id].virtual || id === 'kujira' || (ch < 6 && (id === 'real_tortilla' || id === 'corn' || id === 'mole'))) return;
      OT.state.addStock(id, 15);
    });
    S.phase = 'morning';
    S.gamesToday = 0;
    if (OT.news) { OT.news.newDay(); S.newsSeen = S.day; S.bzCelebrated = S.day; }
    // 章にとんだときに、お祝い・案内・実績のお知らせがまとめて出ないように（その章までのものは済んだことに）
    S.flags.sawKaiso = 1;
    if (OT.ach) { S.ach = {}; C.ACHIEVEMENTS.forEach(function (a) { var p = OT.ach.progress(a); if (p.n >= p.of) S.ach[a.id] = S.day; }); }
    OT.state.save();
    return S;
  }

  /** いま動いているものを全部止める */
  function stopAll() {
    ['auction', 'fishing', 'forage', 'hunt', 'smuggle', 'night'].forEach(function (k) { try { if (OT[k] && OT[k].leave) OT[k].leave(); } catch (e) { /* もう止まっている */ } });
    if (OT.title && OT.title.leave) OT.title.leave();
    if (OT.tut) OT.tut.clear();
    var d = document.getElementById('dialog'); if (d) { d.innerHTML = ''; d.className = ''; }   // 会話の幕も閉じる（開いたままだと押せない）
    Array.prototype.forEach.call(document.querySelectorAll('.kw-wrap'), function (e) { e.parentNode.removeChild(e); });
  }

  function go(fn) {
    return function () {
      OT.sfx.tap();
      stopAll();
      setup(OT.DEV.chapter);
      OT.DEV.back = true;
      OT.sprites.whenAll(fn);
    };
  }

  function enter() {
    stopAll();
    OT.DEV.back = false;
    OT.bgm.play('day');
    var root = OT.ui.screen('dev');
    root.innerHTML = '';
    root.appendChild(OT.el('h2', { class: 'scr-title', text: '🛠 ' + OT.t('dev.title') }));
    root.appendChild(OT.el('p', { class: 'lead', text: OT.t('dev.note') }));
    // 章
    var chRow = OT.el('div', { class: 'dev-ch' }, [OT.el('b', { text: OT.t('dev.chapter') })]);
    for (var c = 1; c <= 6; c++) (function (c) {
      chRow.appendChild(OT.el('button', { class: 'dev-chb' + (OT.DEV.chapter === c ? ' on' : ''), text: String(c), onclick: function () { OT.sfx.tap(); OT.DEV.chapter = c; enter(); } }));
    })(c);
    root.appendChild(chRow);
    root.appendChild(OT.el('p', { class: 'dev-chname', text: OT.t('rank.' + OT.DEV.chapter) }));
    // ミニゲーム
    root.appendChild(OT.el('h3', { text: OT.t('dev.games') }));
    var games = OT.el('div', { class: 'dev-grid' });
    [['uogashi', function () { OT.auction.enter(); }],
     ['ipponzuri', function () { OT.fishing.enter(); }],
     ['satoyama', function () { OT.forage.enter(); }],
     ['yama', function () { OT.hunt.enter(); }],
     ['nagasaki', function () { OT.smuggle.enter(); }]
    ].forEach(function (g) {
      games.appendChild(OT.button(OT.t('sup.' + g[0]), go(g[1]), 'primary'));
    });
    root.appendChild(games);
    // ほかの場面
    root.appendChild(OT.el('h3', { text: OT.t('dev.other') }));
    var other = OT.el('div', { class: 'dev-grid' });
    other.appendChild(OT.button('🏮 ' + OT.t('dev.night'), go(function () { OT.DEV.back = false; OT.flow.night(); })));
    other.appendChild(OT.button('☀ ' + OT.t('dev.morning'), go(function () { OT.DEV.back = false; OT.morning.enter(); })));
    other.appendChild(OT.button('📰 ' + OT.t('dev.news'), go(function () { OT.DEV.back = false; OT.morning.enter(); OT.news.open(); })));
    other.appendChild(OT.button('🏯 ' + OT.t('dev.banzuke'), go(function () { OT.DEV.back = false; OT.morning.enter(); OT.news.banzuke(); })));
    root.appendChild(other);
    // 絵の塗り方を、その場で切りかえて見くらべる（ずっと変えるときは config.js の ART_STYLE）
    var AS = OT.CFG.ART_STYLE;
    root.appendChild(OT.el('h3', { text: OT.t('dev.art') }));
    root.appendChild(OT.el('div', { class: 'dev-grid' }, ['stall', 'kitchen', 'map', 'minigames'].map(function (k) {
      return OT.button(OT.t('dev.artBtn', { name: OT.t('dev.art.' + k), style: OT.t('dev.style.' + AS[k]) }), function () {
        OT.sfx.tap();
        AS[k] = AS[k] === 'toon' ? 'classic' : 'toon';
        OT.sprites.wantStyle();
        try { OT.store.set('devArt_' + k, AS[k]); } catch (e) { /* 保存できなくても、この場では切りかわる */ }
        enter();
      }, 'small');
    })));
    root.appendChild(OT.el('div', { class: 'dev-foot' }, [
      OT.button(OT.t('dev.toTitle'), function () { stopAll(); OT.title.enter(); }, 'ghost small')
    ]));
  }

  OT.dev = { enter: enter, setup: setup };

  // 起動したらタイトルの代わりにメニュー。ミニゲームから朝に戻るときも、メニューへ
  function hook() {
    var title = OT.flow.title, morning = OT.flow.morning;
    var first = true;
    OT.flow.title = function () {
      if (first) {
        first = false;
        // 開発用メニューで選んだ厨房の絵（開発用のセーブにだけ覚える）
        ['stall', 'kitchen', 'map', 'minigames'].forEach(function (k) {
          try { var v = OT.store.get('devArt_' + k, null); if (v) OT.CFG.ART_STYLE[k] = v; } catch (e) { /* なし */ }
        });
        OT.sprites.wantStyle();
        enter();
      } else title();
    };
    OT.flow.morning = function () { if (OT.DEV.back) enter(); else morning(); };
    // 右上の「DEV」ボタン（どの画面からでもメニューへ）
    var b = OT.el('button', { class: 'dev-fab', text: 'DEV', onclick: function () { enter(); } });
    document.getElementById('app').appendChild(b);
  }
  if (OT.flow) hook();
  else document.addEventListener('DOMContentLoaded', hook);
})(window);
