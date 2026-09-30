/*
 * 多幸寿：ミニゲーム「魚河岸の競り」
 *   魚が1匹ずつ出て、値札の数字が上がったり下がったりする。安いときにタップで競り落とす。
 *   数字は config.js の AUCTION。
 */
(function (global) {
  'use strict';
  var OT = global.OT = global.OT || {};

  var A = null;

  function cfg() { return OT.CFG.AUCTION; }
  function st() { return OT.state.get(); }

  function pickFish() {
    var f = cfg().fish, keys = Object.keys(f), sum = 0;
    keys.forEach(function (k) { sum += f[k].weight; });
    var r = Math.random() * sum;
    for (var i = 0; i < keys.length; i++) { r -= f[keys[i]].weight; if (r <= 0) return keys[i]; }
    return keys[0];
  }

  function newLot() {
    var kind = pickFish();
    A.lot = {
      kind: kind, info: cfg().fish[kind], t: 0,
      w: 1.7 + Math.random() * 1.6, ph: Math.random() * Math.PI * 2, w2: 3.1 + Math.random() * 2
    };
    OT.art.drawFish(A.fishCanvas.getContext('2d'), kind, 96, 64);
    A.nameEl.textContent = OT.t('fish.' + kind) + '  ' + OT.t('auc.portions', { n: A.lot.info.portions });
    A.marketEl.textContent = OT.t('auc.market', { n: A.lot.info.base });
    A.panel.classList.remove('won', 'lost');
  }

  function price() {
    var L = A.lot, c = cfg();
    var mid = (c.priceLow + c.priceHigh) / 2, amp = (c.priceHigh - c.priceLow) / 2;
    var wave = Math.sin(L.w * L.t + L.ph) * 0.8 + Math.sin(L.w2 * L.t) * 0.2;
    return Math.max(1, Math.round(L.info.base * (mid + amp * wave)));
  }

  function bid() {
    if (!A || !A.running || !A.lot || A.cooldown > 0) return;
    var p = price();
    if (st().money < p) { OT.sfx.denied(); flash(OT.t('auc.poor'), 'lost'); A.cooldown = 0.4; return; }
    st().money -= p;
    OT.state.addStock(A.lot.info.gives, A.lot.info.portions);
    A.bought.push({ kind: A.lot.kind, price: p, n: A.lot.info.portions });
    OT.sfx.buy();
    flash(OT.t('auc.won', { n: p }), 'won');
    A.panel.classList.add('won');
    refreshMoney();
    A.cooldown = 0.7;
    A.lot = null;
  }

  function flash(msg, cls) {
    A.msgEl.textContent = msg;
    A.msgEl.className = 'auc-msg show ' + cls;
    clearTimeout(A.msgTimer);
    A.msgTimer = setTimeout(function () { if (A) A.msgEl.className = 'auc-msg'; }, 700);
  }

  function refreshMoney() {
    A.root.querySelector('.hud-money').textContent = '💰 ' + OT.t('ui.money', { n: st().money });
  }

  OT.auction = {
    enter: function () {
      var root = OT.ui.screen('auction');
      root.innerHTML = '';
      A = { root: root, running: false, time: 0, bought: [], cooldown: 0 };
      root.appendChild(OT.ui.hud());
      root.appendChild(OT.el('h2', { class: 'scr-title', text: OT.t('auc.title') }));
      var intro = OT.el('div', { class: 'auc-intro' }, [
        OT.el('p', { text: OT.t('auc.howto') }),
        OT.button(OT.t('auc.start'), start, 'primary big')
      ]);
      root.appendChild(intro);
      A.intro = intro;
    },
    leave: function () { if (A && A.raf) cancelAnimationFrame(A.raf); A = null; }
  };

  function start() {
    var root = A.root;
    root.removeChild(A.intro);
    A.timeBar = OT.el('div', { class: 'auc-time' }, [OT.el('i')]);
    root.appendChild(A.timeBar);
    A.panel = OT.el('div', { class: 'auc-panel', onpointerdown: function (e) { e.preventDefault(); bid(); } });
    A.fishCanvas = OT.ui.pixelCanvas(96, 64, 'auc-fish');
    A.nameEl = OT.el('div', { class: 'auc-name' });
    A.marketEl = OT.el('div', { class: 'auc-market' });
    A.priceEl = OT.el('div', { class: 'auc-price' });
    A.lotBar = OT.el('div', { class: 'auc-lot' }, [OT.el('i')]);
    A.msgEl = OT.el('div', { class: 'auc-msg' });
    A.panel.appendChild(A.fishCanvas);
    A.panel.appendChild(A.nameEl);
    A.panel.appendChild(A.marketEl);
    A.panel.appendChild(A.priceEl);
    A.panel.appendChild(A.lotBar);
    A.panel.appendChild(OT.el('div', { class: 'auc-tap', text: OT.t('auc.tap') }));
    A.panel.appendChild(A.msgEl);
    root.appendChild(A.panel);
    A.logEl = OT.el('ul', { class: 'auc-log' });
    root.appendChild(A.logEl);
    A.running = true;
    newLot();
    OT.sfx.clack(2);
    A.last = performance.now();
    A.raf = requestAnimationFrame(loop);
    // PC ではスペースキーでも競り落とせる
    OT.input.onPress = function (p) { if (p.source === 'key') bid(); };
  }

  function loop(now) {
    if (!A) return;
    var dt = Math.min(0.05, (now - A.last) / 1000);
    A.last = now;
    A.time += dt;
    if (A.cooldown > 0) {
      A.cooldown -= dt;
      if (A.cooldown <= 0 && !A.lot && A.time < cfg().seconds) newLot();
    }
    var c = cfg();
    A.timeBar.firstChild.style.width = Math.max(0, 100 - A.time / c.seconds * 100) + '%';
    if (A.lot) {
      A.lot.t += dt;
      var p = price();
      A.priceEl.textContent = p + OT.t('ui.mon');
      var cheap = p < A.lot.info.base * 0.85, pricey = p > A.lot.info.base * 1.2;
      A.priceEl.className = 'auc-price' + (cheap ? ' cheap' : pricey ? ' pricey' : '') + (st().money < p ? ' poor' : '');
      A.lotBar.firstChild.style.width = Math.max(0, 100 - A.lot.t / c.lotSeconds * 100) + '%';
      if (A.lot.t >= c.lotSeconds) {
        OT.sfx.lost();
        flash(OT.t('auc.lost'), 'lost');
        A.panel.classList.add('lost');
        A.lot = null;
        A.cooldown = 0.6;
      }
    }
    renderLog();
    if (A.time >= c.seconds && A.cooldown <= 0) { finish(); return; }
    A.raf = requestAnimationFrame(loop);
  }

  function renderLog() {
    var html = A.bought.map(function (b) {
      return '<li>' + OT.t('auc.got', { name: OT.t('fish.' + b.kind), n: b.n, price: b.price }) + '</li>';
    }).join('');
    if (A.logEl.innerHTML !== html) A.logEl.innerHTML = html;
  }

  function finish() {
    A.running = false;
    OT.input.onPress = null;
    OT.sfx.clack(1);
    var root = A.root;
    root.innerHTML = '';
    root.appendChild(OT.ui.hud());
    root.appendChild(OT.el('h2', { class: 'scr-title', text: OT.t('auc.result') }));
    var list = OT.el('ul', { class: 'auc-log big' });
    if (!A.bought.length) list.appendChild(OT.el('li', { text: OT.t('auc.none') }));
    A.bought.forEach(function (b) {
      list.appendChild(OT.el('li', { text: OT.t('auc.got', { name: OT.t('fish.' + b.kind), n: b.n, price: b.price }) }));
    });
    root.appendChild(list);
    st().gamesToday += 1;
    OT.state.save();
    root.appendChild(OT.button(OT.t('auc.done'), function () { OT.auction.leave(); OT.flow.morning(); }, 'primary big'));
  }
})(window);
