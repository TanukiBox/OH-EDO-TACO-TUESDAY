/*
 * 多幸寿：瓦版と番付
 *   江戸の屋台・食べ物屋の評判が毎朝少しずつ変わる。自分の店（多幸寿）の評判とならべて「番付」にする。
 *   朝いちばんに「瓦版」が出て、多幸寿の番付の上がり下がり・ゆうべの売れ行き・ほかの店のできごと・
 *   今日の年中行事や鯨組の大物・今夜の客のうわさ・はやりのタコスを知らせる。
 *   数字は config.js の BANZUKE と KAWARABAN。ことばは text.js の 'news.*' と 'bz.*'。
 */
(function (global) {
  'use strict';
  var OT = global.OT = global.OT || {};

  function C() { return OT.CFG.BANZUKE; }
  function st() { return OT.state.get(); }
  function rnd(a, b) { return a + Math.random() * (b - a); }

  /** ほかの店の評判（まだなければ、はじめの評判で作る） */
  function shopReps() {
    var s = st(), B = C().shops;
    s.shopRep = s.shopRep || {};
    Object.keys(B).forEach(function (id) { if (s.shopRep[id] === undefined) s.shopRep[id] = B[id].rep; });
    return s.shopRep;
  }

  /** 番付：評判の高い順。[{ id, rep, me }]（その章でまだ出てこない店は入れない。多幸寿は番付に載ってから） */
  function ranking() {
    var R = shopReps(), B = C().shops, ch = OT.state.chapter();
    var list = Object.keys(B).filter(function (id) { return B[id].chapter <= ch; }).map(function (id) { return { id: id, rep: Math.round(R[id]) }; });
    if (st().bzListed) list.push({ id: 'me', rep: st().rep, me: true });
    list.sort(function (a, b) { return b.rep - a.rep || (a.me ? -1 : 1); });
    return list;
  }

  /** 番付の位（0 から）→ 「東の大関」など */
  function titleOf(i) {
    var side = OT.t(i % 2 === 0 ? 'bz.east' : 'bz.west');
    var san = ['bz.ozeki', 'bz.sekiwake', 'bz.komusubi'];
    if (i < C().sanyaku) return side + OT.t(san[Math.floor(i / 2)] || 'bz.komusubi');
    var m = Math.floor((i - C().sanyaku) / 2) + 1;
    return side + OT.t('bz.maegashira') + (m === 1 ? OT.t('bz.hitto') : OT.t('bz.mai', { n: m }));
  }
  /** 多幸寿の番付の位（0 から）。まだ番付外なら -1 */
  function myPos() { var r = ranking(); for (var i = 0; i < r.length; i++) if (r[i].me) return i; return -1; }
  function toEntry() { return Math.max(1, C().entryRep - st().rep); }

  function shopName(id) { return id === 'me' ? OT.t('bz.me') : OT.t('bz.s.' + id); }

  // ---------------------------------------------------------------
  // 新しい朝：ほかの店の評判を動かして、瓦版の記事を作る
  // ---------------------------------------------------------------
  function newDay() {
    var s = st(), B = C(), R = shopReps(), ch = OT.state.chapter();
    var items = [];
    // ほかの店の評判は毎日少しずつ伸びる（ゆれもある）
    Object.keys(B.shops).forEach(function (id) {
      R[id] = Math.max(5, R[id] + B.shops[id].grow + rnd(-B.jitter, B.jitter));
    });
    // ほかの店のできごと（評判が上がる・下がる）
    var open = Object.keys(B.shops).filter(function (id) { return B.shops[id].chapter <= ch; });
    if (s.day > 1 && Math.random() < B.eventChance && open.length) {
      var id = open[Math.floor(Math.random() * open.length)], up = Math.random() < 0.55;
      R[id] = Math.max(5, R[id] + (up ? 1 : -1) * Math.round(rnd(B.eventSize[0], B.eventSize[1])));
      items.push({ k: 'rival', id: id, up: up });
    }
    // 多幸寿の番付（評判が entryRep になるまでは番付外。一度載ったら外れない）
    var firstNews = !s.newsBegun && s.bzPos === undefined;
    s.newsBegun = true;
    var wasListed = !!s.bzListed;
    if (!wasListed && s.rep >= B.entryRep) s.bzListed = true;
    var pos = myPos();
    if (firstNews && !s.bzListed) items.unshift({ k: 'intro' });
    else if (s.bzListed && !wasListed) { items.unshift({ k: 'debut', pos: pos }); delete s.bzPrev; }
    else if (s.bzListed) {
      var prev = s.bzPos === undefined ? pos : s.bzPos;
      if (pos < prev) items.unshift({ k: 'rankup', pos: pos });
      else if (pos > prev) items.unshift({ k: 'rankdown', pos: pos });
      s.bzPrev = prev;
    }
    if (s.bzListed) s.bzPos = pos; else delete s.bzPos;
    // ゆうべの多幸寿
    var r = s.lastResult;
    if (s.day > 1 && r) items.push({ k: 'yesterday', served: r.served, best: r.best, variant: r.bestVariant, omakase: r.bestIsOmakase });
    // 今日のこと：年中行事・鯨組・今夜の VIP・はやりのタコス
    var fest = OT.todayFestival && OT.todayFestival();
    if (fest) items.push({ k: 'fest', fest: fest });
    if (s.whaleDay) items.push({ k: 'whale' });
    var vip = OT.night && OT.night.pickVip && OT.night.pickVip();
    if (vip) items.push({ k: 'vip', vip: vip });
    s.trend = null;
    if (s.day > 1 && Math.random() < OT.CFG.KAWARABAN.trendChance) {
      // はやりになるのは、今夜ふつうに頼まれるタコス（行事・旅の客・鯨・作り置き・〆の茶漬けはのぞく）
      var menu = Object.keys(OT.CFG.TACOS).filter(function (t) {
        var x = OT.CFG.TACOS[t];
        if (x.chapter > ch || x.festival || x.traveler || x.onlyWhenOut) return false;
        if (x.season && x.season !== OT.state.season()) return false;
        if (x.needFlag && !s.flags[x.needFlag]) return false;
        return ['kago', 'isana', 'chazuke', 'tenka'].indexOf(t) < 0;
      });
      if (menu.length) { s.trend = menu[Math.floor(Math.random() * menu.length)]; items.push({ k: 'trend', taco: s.trend }); }
    }
    s.news = { day: s.day, items: items };
  }

  // ---------------------------------------------------------------
  // 瓦版（紙の絵）
  // ---------------------------------------------------------------
  function closeBtn(fn) { return OT.el('button', { class: 'kw-close', text: OT.t('news.close'), onclick: function () { OT.sfx.tap(); fn(); } }); }
  function close(box) { box.classList.add('out'); setTimeout(function () { if (box.parentNode) box.parentNode.removeChild(box); }, 250); }
  function iconOf(id) {
    var c = OT.ui.pixelCanvas(32, 32, 'kw-ico');
    var B = C().shops[id];
    if (B && B.owner && OT.sprites.drawFace(c, B.owner, false)) return c;
    OT.art.drawIcon(c, B ? B.icon : 'tortilla');
    return c;
  }

  function article(it) {
    var head = '', body = '', pic = null, cls = '';
    if (it.k === 'intro') { head = OT.t('news.introH'); body = OT.t('news.intro'); cls = 'top'; pic = OT.ui.ponFace('kw-pic'); }
    else if (it.k === 'rankup' || it.k === 'rankdown' || it.k === 'debut') {
      head = OT.t('news.' + it.k + 'H', { title: titleOf(it.pos) });
      body = OT.t('news.' + it.k, { title: titleOf(it.pos), n: it.pos + 1 });
      cls = it.k === 'rankdown' ? '' : 'top';
      pic = OT.ui.pixelCanvas(48, 48, 'kw-pic');
      OT.sprites.drawFace(pic, 'mateo_happi', it.k === 'rankdown' ? 'sad' : true);
    } else if (it.k === 'yesterday') {
      head = OT.t('news.yesterdayH');
      body = it.served ? OT.t('news.yesterday', { n: it.served, best: it.best ? OT.tacoName(it.best, it.variant) : OT.t('night.omakaseName') }) : OT.t('news.yesterdayNone');
    } else if (it.k === 'rival') {
      head = shopName(it.id);
      body = OT.t('news.r.' + it.id + (it.up ? '.up' : '.down'));
      pic = iconOf(it.id);
      cls = it.up ? 'rival up' : 'rival down';
    } else if (it.k === 'fest') { head = OT.t('fest.' + it.fest); body = OT.t('fest.' + it.fest + '.desc'); cls = 'event'; }
    else if (it.k === 'whale') { head = OT.t('news.whaleH'); body = OT.t('news.whale'); cls = 'event'; }
    else if (it.k === 'vip') { var V = OT.CFG.VIPS[it.vip]; head = OT.t('news.vipH'); body = OT.t('news.vip', { name: OT.STORY[OT.i18n.lang].who[V.guest] }); cls = 'event'; }
    else if (it.k === 'trend') {
      head = OT.t('news.trendH'); body = OT.t('news.trend', { taco: OT.tacoName(it.taco) }); cls = 'trend';
      pic = OT.ui.pixelCanvas(32, 32, 'kw-ico');
      var need = OT.needOf(it.taco); OT.art.drawIcon(pic, need[0] || 'tortilla');
    }
    return OT.el('div', { class: 'kw-art ' + cls }, [pic, OT.el('div', { class: 'kw-txt' }, [OT.el('b', { text: head }), OT.el('p', { text: body })])].filter(Boolean));
  }

  function openNews(done) {
    var s = st();
    if (!s.news || s.news.day !== s.day) newDay();
    s.newsSeen = s.day;
    OT.state.save();
    var paper = OT.el('div', { class: 'kw-paper' }, [
      OT.el('div', { class: 'kw-mast' }, [OT.el('span', { class: 'kw-name', text: OT.t('news.title') }), OT.el('span', { class: 'kw-date', text: OT.seasonMark[OT.state.season()] + ' ' + OT.t('ui.day', { n: s.day }) })]),
      OT.el('div', { class: 'kw-body' }, s.news.items.map(article)),
      OT.el('div', { class: 'kw-foot' }, [
        OT.el('span', { text: s.bzListed ? OT.t('news.myRank', { title: titleOf(myPos()) }) : OT.t('news.notListed', { n: toEntry() }) }),
        OT.el('button', { class: 'kw-bz', text: '🏯 ' + OT.t('bz.open'), onclick: function () { OT.sfx.tap(); openBanzuke(); } })
      ])
    ]);
    var box = OT.el('div', { class: 'kw-wrap' });
    box.appendChild(paper);
    box.appendChild(closeBtn(function () { close(box); if (done) done(); }));
    document.getElementById('app').appendChild(box);
    OT.sfx.wrap();
  }

  // ---------------------------------------------------------------
  // 番付（東・西にならべ、多幸寿を赤く）
  // ---------------------------------------------------------------
  function openBanzuke() {
    var list = ranking(), s = st(), me = myPos();
    var grid = OT.el('div', { class: 'bz-grid' });
    for (var i = 0; i < list.length; i += 2) {
      var row = OT.el('div', { class: 'bz-row' + (i < C().sanyaku ? ' sanyaku' : '') });
      [list[i], list[i + 1]].forEach(function (e, k) {
        if (!e) { row.appendChild(OT.el('div', { class: 'bz-cell empty' })); return; }
        var pos = i + k;
        var cell = OT.el('div', { class: 'bz-cell' + (e.me ? ' me' : '') }, [
          OT.el('span', { class: 'bz-title', text: titleOf(pos) }),
          OT.el('span', { class: 'bz-shop', text: shopName(e.id) }),
          e.me ? null : iconOf(e.id),
          OT.el('span', { class: 'bz-rep', text: OT.t('bz.rep', { n: e.rep }) })
        ].filter(Boolean));
        if (e.me && s.bzPrev !== undefined && s.bzPrev !== pos) cell.appendChild(OT.el('i', { class: 'bz-move ' + (pos < s.bzPrev ? 'up' : 'down'), text: pos < s.bzPrev ? '▲' : '▼' }));
        row.appendChild(cell);
      });
      grid.appendChild(row);
    }
    var paper = OT.el('div', { class: 'bz-paper' }, [
      OT.el('div', { class: 'bz-head' }, [OT.el('span', { class: 'bz-east', text: OT.t('bz.east') }), OT.el('b', { text: OT.t('bz.title') }), OT.el('span', { class: 'bz-west', text: OT.t('bz.west') })]),
      grid,
      me < 0 ? OT.el('div', { class: 'bz-cell me out' }, [
        OT.el('span', { class: 'bz-title', text: OT.t('bz.out') }),
        OT.el('span', { class: 'bz-shop', text: shopName('me') }),
        OT.el('span', { class: 'bz-rep', text: OT.t('bz.rep', { n: s.rep }) })
      ]) : null,
      OT.el('div', { class: 'bz-note', text: me < 0 ? OT.t('bz.noteOut', { n: toEntry() }) : OT.t('bz.note', { title: titleOf(me), n: me + 1, m: list.length }) })
    ].filter(Boolean));
    var box = OT.el('div', { class: 'kw-wrap bz' });
    box.appendChild(paper);
    box.appendChild(closeBtn(function () { close(box); }));
    document.getElementById('app').appendChild(box);
    setTimeout(function () { var m = paper.querySelector('.bz-cell.me'); if (m && m.scrollIntoView) m.scrollIntoView({ block: 'center' }); }, 60);
  }

  OT.news = {
    newDay: newDay,
    open: openNews,
    banzuke: openBanzuke,
    ranking: ranking,
    titleOf: titleOf,
    /** 朝の画面に来たら、その日の瓦版をいちど見せる */
    morningShow: function () {
      var s = st();
      if (!s || s.newsSeen === s.day) return false;
      openNews();
      return true;
    }
  };
})(window);
