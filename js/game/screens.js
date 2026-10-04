/*
 * 多幸寿：タイトル・朝（仕入れ先を選ぶ）・結果の画面
 */
(function (global) {
  'use strict';
  var OT = global.OT = global.OT || {};

  function st() { return OT.state.get(); }

  // ---------------------------------------------------------------
  // タイトル
  // ---------------------------------------------------------------
  var titleAnim = null;

  OT.title = {
    enter: function () {
      var root = OT.ui.screen('title');
      root.innerHTML = '';
      var noren = OT.ui.pixelCanvas(240, 160, 'title-noren');
      root.appendChild(OT.el('div', { class: 'title-top' }, [
        noren,
        OT.sprites.has('logo') ? (function () {
          var lc = OT.ui.pixelCanvas(240, 132, 'logo-img');
          lc.getContext('2d').drawImage(OT.sprites.get('logo'), 0, 0);
          lc.setAttribute('aria-label', OT.t('title.logo') + ' 多幸寿');
          return lc;
        })() : OT.el('h1', { class: 'logo' }, [
          OT.el('span', { class: 'logo-en', text: OT.t('title.logo') }),
          OT.el('span', { class: 'logo-ja', text: '多幸寿' })
        ]),
        OT.el('p', { class: 'tagline', text: OT.t('title.tagline') }),
        OT.state.load() && OT.state.get().flags.cleared ? OT.el('p', { class: 'cleared', text: OT.t('title.cleared') }) : null
      ]));
      var btns = OT.el('div', { class: 'title-btns' });
      var saved = OT.state.load();
      if (saved) {
        btns.appendChild(OT.button(OT.t('title.continue', { day: saved.day }), function () { OT.title.leave(); OT.flow.resume(); }, 'primary big'));
        btns.appendChild(OT.button(OT.t('title.newgame'), function () {
          if (global.confirm(OT.t('title.resetConfirm'))) { OT.title.leave(); OT.flow.newGame(); }
        }, 'ghost'));
      } else {
        btns.appendChild(OT.button(OT.t('title.start'), function () { OT.title.leave(); OT.flow.newGame(); }, 'primary big'));
      }
      root.appendChild(btns);
      var soundBtn = OT.button(OT.sound.muted ? OT.t('ui.soundOff') : OT.t('ui.soundOn'), function () {
        OT.sound.toggle();
        soundBtn.textContent = OT.sound.muted ? OT.t('ui.soundOff') : OT.t('ui.soundOn');
      }, 'small');
      var bgmBtn = OT.button(OT.bgm.on() ? OT.t('ui.bgmOn') : OT.t('ui.bgmOff'), function () {
        OT.bgm.toggle();
        bgmBtn.textContent = OT.bgm.on() ? OT.t('ui.bgmOn') : OT.t('ui.bgmOff');
      }, 'small');
      var langBtn = OT.button(OT.t('ui.lang'), function () {
        var next = OT.i18n.lang === 'ja' ? 'en' : 'ja';
        OT.i18n.setLang(next);
        OT.store.set('lang', next);
        global.document.documentElement.lang = next;
        OT.title.leave();
        OT.title.enter();
      }, 'small');
      root.appendChild(OT.el('div', { class: 'title-foot' }, [soundBtn, bgmBtn, langBtn, OT.el('span', { class: 'by', text: OT.t('title.by') })]));
      OT.bgm.play('day');

      // 暖簾のはためき（開店カットインの絵を、タイトルでも流す）
      var ctx = noren.getContext('2d'), f = 0;
      function tick() {
        ctx.clearRect(0, 0, 240, 160);
        var im = OT.art.img('noren' + f);
        if (im && im.complete) ctx.drawImage(im, 0, 0);
        f = (f + 1) % 6;
      }
      tick();
      titleAnim = setInterval(tick, 120);
    },
    leave: function () { clearInterval(titleAnim); titleAnim = null; }
  };

  // ---------------------------------------------------------------
  // 朝：仕入れ先を選ぶ
  // ---------------------------------------------------------------
  OT.morning = {
    enter: function () {
      var s = st();
      s.phase = 'morning';
      OT.state.save();
      var root = OT.ui.screen('morning');
      root.innerHTML = '';
      root.appendChild(OT.ui.hud());
      root.appendChild(OT.el('h2', { class: 'scr-title', text: '☀ ' + OT.t('morning.title') }));
      var tipKey = s.day === 1 ? 'pon.morning1' : (OT.needCorn && OT.needCorn() && OT.state.stockOf('corn') === 0) ? 'pon.needCorn' : s.whaleDay ? 'pon.whale' : s.stock.tortilla <= 10 && s.stock.tortilla > 0 ? 'pon.morningLow' :
        s.stock.tortilla <= 0 && OT.state.chapter() >= 2 && !s.flags.nixtamal ? 'pon.noTortilla' : 'pon.morning' + (1 + (s.day % 4));
      root.appendChild(OT.ui.pon(tipKey));
      root.appendChild(OT.el('div', { class: 'row-btns' }, [
        OT.button('📖 ' + OT.t('dex.title'), function () { OT.sprites.whenAll(function () { OT.dex.enter('morning'); }); }, 'small'),
        OT.button('📰 ' + OT.t('news.title'), function () { OT.news.open(); }, 'small'),
        OT.button('🏯 ' + OT.t('bz.open'), function () { OT.news.banzuke(); }, 'small'),
        OT.state.chapter() >= OT.CFG.UPGRADES.chapter ? OT.button('🔨 ' + OT.t('kaiso.title'), function () { OT.kaiso.enter(); }, 'small') : null,
        OT.el('span', { class: 'chapter-name', text: OT.t('rank.' + OT.state.chapter()) })
      ]));

      var left = OT.CFG.MAX_GAMES_PER_DAY - s.gamesToday;
      root.appendChild(OT.el('p', { class: 'lead', text: left > 0 ? OT.t('morning.left', { n: left }) : OT.t('morning.done') }));

      // 町の地図（仕入れ先の場所）
      if (OT.sprites.has('map')) root.appendChild(mapView(left));
      var list = OT.el('div', { class: 'suppliers' });
      OT.CFG.SUPPLIERS.forEach(function (sup) {
        var soon = sup.soon || sup.chapter > OT.state.chapter() || (sup.needFlag && !s.flags[sup.needFlag]);
        var locked = !sup.soon && sup.chapter > OT.state.chapter();
        var blocked = sup.kind === 'game' && left <= 0;
        var card = OT.el('button', {
          class: 'sup ' + sup.kind + (soon ? ' soon' : '') + (blocked && !soon ? ' blocked' : ''),
          onclick: function () {
            if (soon || blocked) { OT.sfx.denied(); return; }
            OT.sfx.tap();
            OT.flow.supplier(sup);
          }
        }, [
          OT.el('span', { class: 'sup-kind', text: OT.t('morning.kind.' + sup.kind) }),
          OT.el('span', { class: 'sup-name', text: OT.t('sup.' + sup.id) }),
          OT.el('span', { class: 'sup-desc', text: locked ? OT.t('morning.lockedCh', { n: sup.chapter }) : soon ? OT.t('morning.soon') : OT.t('sup.' + sup.id + '.desc') })
        ]);
        list.appendChild(card);
      });
      root.appendChild(list);

      // 今日の年中行事・今夜の VIP の予告
      var fest = OT.todayFestival();
      if (fest) root.appendChild(OT.el('div', { class: 'notice fest' }, [OT.t('morning.festival', { name: OT.t('fest.' + fest), desc: OT.t('fest.' + fest + '.desc') })]));
      if (s.trend && s.news && s.news.day === s.day) root.appendChild(OT.el('div', { class: 'notice trend' }, [OT.t('morning.trend', { taco: OT.tacoName(s.trend) })]));
      var vip = OT.night.pickVip();
      if (vip) root.appendChild(OT.el('div', { class: 'notice vip' }, [OT.t('vip.preview', { name: OT.STORY[OT.i18n.lang].who[OT.CFG.VIPS[vip].guest], odai: OT.t('vip.' + vip + '.odai') })]));

      // 最終章：灰汁で煮たトウモロコシで、本物の皮を焼く／献上の料理勝負
      if (s.flags.nixtamal) root.appendChild(realPanel());
      if (s.flags.tributeReady && !s.flags.cleared) root.appendChild(tributePanel());
      if (s.flags.cleared && OT.ach) {
        var nx = OT.ach.next(3);
        if (nx.length) root.appendChild(OT.el('div', { class: 'notice goals' }, [
          OT.el('b', { text: '🏆 ' + OT.t('ach.goals') }),
          OT.el('ul', {}, nx.map(function (a) { var p = OT.ach.progress(a); return OT.el('li', { text: OT.t('ach.' + a.id) + '：' + OT.t('ach.' + a.id + '.desc') + (p.of > 1 ? '（' + p.n + '/' + p.of + '）' : '') }); })),
          OT.button(OT.t('ach.open'), function () { OT.sprites.whenAll(function () { OT.dex.enter('morning', 'ach'); }); }, 'small')
        ]));
      }

      // 作り置き：かご蒸しタコスを蒸しておく
      if (OT.state.chapter() >= OT.CFG.KAGO.chapter) root.appendChild(kagoPanel());

      // いまの在庫
      var pantry = OT.el('div', { class: 'pantry' }, [OT.el('h3', { text: OT.t('morning.stockTitle') })]);
      var chips = OT.el('div', { class: 'chips' });
      Object.keys(OT.CFG.INGREDIENTS).forEach(function (id) {
        if (!s.seen[id]) return;
        var n = s.stock[id] || 0;
        var icon = OT.ui.pixelCanvas(24, 24, 'chip-icon');
        OT.art.drawIcon(icon, id);
        chips.appendChild(OT.el('span', { class: 'chip' + (n ? '' : ' zero') }, [icon, OT.el('span', { text: OT.ingName(id) + ' ' + n })]));
      });
      pantry.appendChild(chips);
      root.appendChild(pantry);

      root.appendChild(OT.el('div', { class: 'sticky-bottom' }, [
        OT.button('🏮 ' + OT.t('morning.toNight'), function () { if (OT.tut) OT.tut.done('m2'); OT.flow.night(); }, 'primary big')
      ]));
      // はじめての1日の案内
      if (OT.tut) {
        if (s.gamesToday === 0) OT.tut.point('m1', '#scr-morning .sup.game');
        else { OT.tut.done('m1'); OT.tut.point('m2', '#scr-morning .sticky-bottom .btn'); }
      }
      // 2日目からは、朝いちばんに瓦版（その日いちど）
      if (s.day > 1 && OT.news) OT.news.morningShow();
      // 屋台の改装ができるようになったら、いちどだけポン吉が教える
      if (OT.state.chapter() >= OT.CFG.UPGRADES.chapter && !s.flags.sawKaiso) {
        s.flags.sawKaiso = 1; OT.state.save();
        setTimeout(function () { OT.ui.toast(OT.t('pon.kaiso'), 'tip long'); }, 600);
      }
    }
  };

  /** 町の地図：仕入れ先の場所に目印（タップで行ける） */
  function mapView(left) {
    var wrap = OT.el('div', { class: 'map' });
    var c = OT.ui.pixelCanvas(256, 160, 'map-img');
    c.getContext('2d').drawImage(OT.sprites.get('map'), 0, 0);
    wrap.appendChild(c);
    var P = OT.sprites.manifest.places || {};
    OT.CFG.SUPPLIERS.forEach(function (sup) {
      var p = P[sup.id];
      if (!p) return;
      var soon = sup.soon || sup.chapter > OT.state.chapter() || (sup.needFlag && !st().flags[sup.needFlag]);
      var blocked = sup.kind === 'game' && left <= 0;
      var pin = OT.el('button', { class: 'pin ' + sup.kind + (soon ? ' soon' : '') + (blocked && !soon ? ' blocked' : ''),
        style: 'left:' + (p[0] * 100) + '%;top:' + (p[1] * 100) + '%',
        onclick: function () { if (soon || blocked) { OT.sfx.denied(); return; } OT.sfx.tap(); OT.flow.supplier(sup); } }, [
        // 地図の上では短い名前（'pin.○○' があればそちら。英語で札が重ならないように）
        OT.el('span', { text: soon ? '？' : OT.t(OT.TEXT.en['pin.' + sup.id] ? 'pin.' + sup.id : 'sup.' + sup.id) })
      ]);
      wrap.appendChild(pin);
    });
    if (P.stall) wrap.appendChild(OT.el('span', { class: 'pin home', style: 'left:' + (P.stall[0] * 100) + '%;top:' + (P.stall[1] * 100) + '%' }, [OT.el('span', { text: '🏮 ' + OT.t('map.stall') })]));
    return wrap;
  }

  function realPanel() {
    var per = OT.CFG.FINALE.perCorn, have = OT.state.stockOf('corn');
    var btn = OT.button(OT.t('real.bake'), function () {
      if (!OT.state.useStock('corn', 1)) { OT.sfx.denied(); OT.ui.toast(OT.t('real.need')); return; }
      OT.state.addStock('real_tortilla', per);
      var first = !st().flags.madeReal;
      st().flags.madeReal = 1;
      OT.state.save();
      OT.sfx.wrap();
      if (first) OT.flow.morning(); else OT.morning.enter();
    }, 'small');
    if (!have) btn.disabled = true;
    return OT.el('div', { class: 'kago-panel real' }, [
      OT.el('div', {}, [
        OT.el('b', { text: '🌽 ' + OT.t('real.title') + '（' + OT.t('ui.stock', { n: OT.state.stockOf('real_tortilla') }) + '）' }),
        OT.el('span', { text: have ? OT.t('real.desc', { n: per, have: have }) : OT.t('real.need') })
      ]),
      btn
    ]);
  }

  function tributePanel() {
    var r = OT.CFG.TACOS.tenka;
    var missing = [r.skin].concat(r.need).filter(function (id) { return OT.state.stockOf(id) <= 0; });
    var btn = OT.button('👑 ' + OT.t('tribute.go'), function () {
      if (missing.length) { OT.sfx.denied(); OT.ui.toast(OT.t('tribute.missing', { items: missing.map(OT.ingName).join('・') })); return; }
      OT.flow.night({ tribute: true });
    }, 'primary');
    return OT.el('div', { class: 'tribute-panel' }, [
      OT.el('b', { text: '👑 ' + OT.t('tribute.title') }),
      OT.el('span', { text: OT.t('tribute.desc') }),
      missing.length ? OT.el('span', { class: 'miss', text: OT.t('tribute.missing', { items: missing.map(OT.ingName).join('・') }) }) : null,
      btn
    ]);
  }

  function kagoPanel() {
    var K = OT.CFG.KAGO, s = st();
    var uses = K.uses.every(function (id) { return OT.state.stockOf(id) >= K.batch; }) ? K.uses :
      K.alt.every(function (id) { return OT.state.stockOf(id) >= K.batch; }) ? K.alt : null;
    var btn = OT.button(OT.t('kago.make', { n: K.batch }), function () {
      if (!uses) { OT.sfx.denied(); OT.ui.toast(OT.t('kago.need')); return; }
      uses.forEach(function (id) { OT.state.useStock(id, K.batch); });
      OT.state.addStock('kagomushi', K.batch);
      OT.state.save();
      OT.sfx.wrap();
      OT.morning.enter();
    }, 'small');
    if (!uses) btn.disabled = true;
    return OT.el('div', { class: 'kago-panel' }, [
      OT.el('div', {}, [
        OT.el('b', { text: '🧺 ' + OT.t('kago.title') + '（' + OT.t('ui.stock', { n: OT.state.stockOf('kagomushi') }) + '）' }),
        OT.el('span', { text: OT.t('kago.desc', { n: K.batch }) })
      ]),
      btn
    ]);
  }

  // ---------------------------------------------------------------
  // 結果
  // ---------------------------------------------------------------
  /** ランクアップのお知らせと、解禁されたもの */
  function rankUpPanel(ch) {
    var C = OT.CFG, items = [];
    Object.keys(C.TACOS).forEach(function (id) { if (C.TACOS[id].chapter === ch) items.push('🌮 ' + OT.tacoName(id)); });
    Object.keys(C.CUSTOMERS).forEach(function (id) { if (C.CUSTOMERS[id].chapter === ch) items.push('👤 ' + OT.t('cust.' + id)); });
    C.SUPPLIERS.forEach(function (sp) { if (sp.chapter === ch && !sp.soon) items.push('🗺 ' + OT.t('sup.' + sp.id)); });
    Object.keys(C.SHOPS).forEach(function (shopId) {
      C.SHOPS[shopId].forEach(function (it) { if (it.chapter === ch && C.INGREDIENTS[it.id].cat === 'skin') items.push('🫓 ' + OT.ingName(it.id)); });
    });
    OT.sfx.happy(3);
    return OT.el('div', { class: 'rankup' }, [
      OT.el('div', { class: 'rankup-title', text: OT.t('rank.up') }),
      OT.el('div', { class: 'rankup-name', text: OT.t('rank.' + ch) }),
      OT.el('p', { text: OT.t('rank.unlocked') }),
      OT.el('ul', {}, items.map(function (x) { return OT.el('li', { text: x }); }))
    ]);
  }

  OT.result = {
    enter: function () {
      var s = st(), r = s.lastResult;
      var root = OT.ui.screen('result');
      root.innerHTML = '';
      root.appendChild(OT.ui.hud());
      root.appendChild(OT.el('h2', { class: 'scr-title', text: '🏮 ' + OT.t('res.title', { n: r.day }) }));
      var bestName = r.best ? OT.tacoName(r.best, r.bestVariant) : r.bestIsOmakase ? OT.t('night.omakaseName') : OT.t('res.bestNone');
      if (r.rankUp) root.appendChild(rankUpPanel(r.rankUp));
      var starsTxt = r.served ? r.avg.toFixed(1) + ' ' + '★'.repeat(Math.round(r.avg)) : '—';
      var rows = [
        [OT.t('res.sales'), OT.t('ui.money', { n: r.sales }), 'big'],
        [OT.t('res.tips'), '🏺 ' + OT.t('ui.money', { n: r.tips || 0 })],
        [OT.t('res.served'), OT.t('res.servedVal', { n: r.served, a: r.angry })],
        [OT.t('res.stars'), starsTxt],
        [OT.t('res.satisfaction'), r.satisfaction + '%'],
        [OT.t('res.rep'), (r.rep >= 0 ? '+' : '') + r.rep + '  →  ' + s.rep, r.rep >= 0 ? 'up' : 'down'],
        [OT.t('res.best'), bestName],
        [OT.t('res.money'), OT.t('ui.money', { n: s.money })]
      ];
      var table = OT.el('div', { class: 'res-table' });
      rows.forEach(function (row) {
        table.appendChild(OT.el('div', { class: 'res-row ' + (row[2] || '') }, [
          OT.el('span', { text: row[0] }), OT.el('b', { text: row[1] })
        ]));
      });
      root.appendChild(table);
      var shareText = OT.t('share.text', { day: r.day, sales: r.sales, taco: bestName });
      root.appendChild(OT.el('div', { class: 'res-btns' }, [
        OT.button(OT.t('res.share'), function () { OT.shareOnX(shareText); }, 'x'),
        OT.button('📖 ' + OT.t('dex.title'), function () { OT.sprites.whenAll(function () { OT.dex.enter('result'); }); }, 'ghost'),
        OT.button(OT.t('res.next'), function () { if (OT.tut) OT.tut.finish(); OT.flow.nextDay(); }, 'primary big')
      ]));
      if (OT.tut) setTimeout(function () { OT.tut.point('r1', '#scr-result .res-table'); }, 300);
    }
  };
})(window);
