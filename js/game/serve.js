/*
 * 多幸寿：タコスを出す場面（このあいだ夜の時間は止まる）
 *   1. できあがり … 包んだタコスを皿にのせて大きく見せる
 *   2. お客さん …… 屋台を寄りで映し、タコスを受け取って食べる → よろこぶ / こまる
 *   3. 評価 ………… 4項目と星、代金。心付けの銭が出るので、タップして受け取る
 *   画面をタップすると、次へ早送りできる。数字や文字は config.js / text.js。
 */
(function (global) {
  'use strict';
  var OT = global.OT = global.OT || {};
  var doc = global.document;

  var S = null;   // いま開いている場面

  /** 寛永通宝のような銭（ドット絵をプログラムで描く） */
  function coinCanvas() {
    var c = OT.ui.pixelCanvas(14, 14, 'coin-ico'), g = c.getContext('2d');
    var P = [
      '....oooooo....',
      '..oo555555oo..',
      '.o5577777755o.',
      '.o5766666675o.',
      'o576666666675o',
      'o576666666675o',
      'o5766ooo66675o',
      'o5766o..o6675o',
      'o5766ooo66655o',
      'o576666666655o',
      '.o5666666655o.',
      '.o5566666555o.',
      '..oo555555oo..',
      '....oooooo....'
    ];
    var col = { o: '#5a3218', '5': '#b87838', '6': '#f4cc62', '7': '#fbe39a' };
    P.forEach(function (row, y) { for (var x = 0; x < row.length; x++) { var k = row[x]; if (col[k]) { g.fillStyle = col[k]; g.fillRect(x, y, 1, 1); } } });
    return c;
  }

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  OT.serve = {
    isOpen: function () { return !!S; },

    /**
     * opts: { root: 重ねる場所, guest, res: 評価, img: 包んだタコスの絵(canvas), name: タコスの名前,
     *         stage: { W, H, seatX, footY, festival }, onTip(n): 心付けを受け取ったとき }
     * done: 閉じたとき
     */
    play: function (opts, done) {
      var g = opts.guest, res = opts.res, St = opts.stage;
      var box = OT.el('div', { class: 'serve-scene' });
      // 1. できあがり
      var dish = OT.el('div', { class: 'sv-dish' });
      var dc = OT.ui.pixelCanvas(128, 128, 'sv-dish-img');
      var dctx = dc.getContext('2d');
      dctx.imageSmoothingEnabled = false;
      var plate = OT.art.img('plate');
      if (plate && plate.complete && plate.naturalWidth) dctx.drawImage(plate, 0, 0);
      if (opts.img) dctx.drawImage(opts.img, 0, 0);
      dish.appendChild(OT.el('div', { class: 'sv-rays' }));
      dish.appendChild(dc);
      dish.appendChild(OT.el('div', { class: 'sv-title', text: opts.name || '' }));
      dish.appendChild(OT.el('div', { class: 'sv-done', text: OT.t('sv.done') }));
      for (var k = 0; k < 10; k++) dish.appendChild(OT.el('i', { class: 'spark', style: 'left:' + (12 + Math.random() * 76) + '%;top:' + (12 + Math.random() * 60) + '%;animation-delay:' + (k * 0.1) + 's' }));
      box.appendChild(dish);
      // 2. お客さん（屋台を寄りで）
      var stageEl = OT.el('div', { class: 'sv-stage' });
      var cv = OT.ui.pixelCanvas(St.W, St.H, 'sv-canvas');
      stageEl.appendChild(cv);
      var bubble = OT.el('div', { class: 'sv-bubble' });
      stageEl.appendChild(bubble);
      var coinsEl = OT.el('div', { class: 'sv-coins' });
      stageEl.appendChild(coinsEl);
      box.appendChild(stageEl);
      // 3. 評価
      var card = OT.el('div', { class: 'sv-card' });
      box.appendChild(card);
      var next = OT.el('button', { class: 'sv-next', text: OT.t('sv.next') });
      box.appendChild(next);
      opts.root.appendChild(box);
      var hud = opts.root.querySelector('.hud');
      if (hud) box.style.top = (hud.offsetTop + hud.offsetHeight) + 'px';   // 所持金の表示は見えるように

      S = { t: 0, phase: 'dish', coinsLeft: 0, tipLeft: res.tip || 0, closed: false };
      var last = performance.now();
      var key = OT.sprites.personKey(g);
      var T_DISH = 1.5, T_SLIDE = 0.5, T_EAT = 1.5;

      function setPhase(p) {
        S.phase = p;
        box.className = 'serve-scene p-' + p;
        if (p === 'guest') OT.sfx.wrap();
        if (p === 'react') react();
      }
      function react() {
        var say = res.stars >= 3 ? 'happy' : 'worry';
        bubble.innerHTML = '<div class="b-line">' + esc(g.line || '') + '</div>' + (g.comment ? '<div class="b-line cmt">' + esc(g.comment) + '</div>' : '');
        bubble.className = 'sv-bubble on ' + say;
        OT.sfx.happy(res.stars);
        if (res.stars === 5) OT.fx.closeup(key, g.line);
        showCard();
        setTimeout(function () { if (S && !S.closed) OT.sfx.coin(); }, 350);
        if (S.tipLeft > 0) setTimeout(showCoins, 700);
        else setTimeout(function () { if (S) next.classList.add('on'); }, 900);
      }
      function showCard() {
        var P = res.parts || {};
        var rows = [['wait', P.wait], ['cook', P.cook], ['plate', P.plate], ['pref', P.pref]].map(function (r, i) {
          var v = Math.round((r[1] === undefined ? 1 : r[1]) * 100);
          return '<div class="sc-row" style="animation-delay:' + (0.1 + i * 0.12) + 's"><span>' + OT.t('k.score.' + r[0]) + '</span><i><b style="width:' + v + '%;animation-delay:' + (0.15 + i * 0.12) + 's"></b></i><em>' + v + '%</em></div>';
        }).join('');
        var stars = '';
        for (var s = 0; s < 5; s++) stars += '<span class="' + (s < res.stars ? 'on' : 'off') + '" style="animation-delay:' + (0.6 + s * 0.15) + 's">★</span>';
        card.innerHTML = '<div class="sc-name">' + esc(g.name || OT.t('cust.' + g.typeId)) + '</div><div class="sv-stars">' + stars + '</div>' + rows +
          '<div class="sc-pay">' + OT.t('sv.pay', { n: res.pay }) + '</div><div class="sv-tip"></div>';
        card.className = 'sv-card on s' + res.stars;
        for (var j = 0; j < res.stars; j++) (function (j) { setTimeout(function () { if (S && !S.closed) OT.sfx.tap(); }, 600 + j * 150); })(j);
      }
      function showCoins() {
        if (!S || S.closed) return;
        var n = Math.max(1, Math.min(5, Math.ceil(res.tip / 3)));
        S.coinsLeft = n;
        var per = Math.floor(res.tip / n), extra = res.tip - per * n;
        card.querySelector('.sv-tip').textContent = OT.t('sv.tipHint');
        for (var i = 0; i < n; i++) {
          (function (i) {
            var val = per + (i === 0 ? extra : 0);
            var b = OT.el('button', { class: 'sv-coin', style: 'left:' + (38 + i * 7 + (i % 2) * 3) + '%;top:' + (14 + (i % 3) * 7) + '%;animation-delay:' + (i * 0.08) + 's' }, [coinCanvas()]);
            b.addEventListener('pointerdown', function (e) {
              e.preventDefault(); e.stopPropagation();
              if (b.classList.contains('got')) return;
              b.classList.add('got');
              OT.sfx.coin();
              opts.onTip(val);
              S.tipLeft -= val;
              S.coinsLeft--;
              card.querySelector('.sv-tip').textContent = OT.t('k.tip', { n: res.tip - S.tipLeft });
              if (S.coinsLeft <= 0) { card.querySelector('.sv-tip').classList.add('done'); next.classList.add('on'); }
            });
            coinsEl.appendChild(b);
          })(i);
        }
      }
      function close() {
        if (!S || S.closed) return;
        if (S.tipLeft > 0) opts.onTip(S.tipLeft);   // 取り忘れた銭も、お客さんは置いていってくれる
        S.closed = true;
        box.classList.add('out');
        setTimeout(function () { if (box.parentNode) box.parentNode.removeChild(box); }, 250);
        S = null;
        if (done) done();
      }
      // タップで早送り（評価のあとは「つぎへ」）
      box.addEventListener('pointerdown', function (e) {
        if (!S || (e.target.closest && e.target.closest('.sv-coin'))) return;
        if (S.phase === 'dish') { S.t = T_DISH; setPhase('guest'); }
        else if (S.phase === 'guest') { S.t = T_DISH + T_SLIDE + T_EAT; setPhase('react'); }
        else if (S.phase === 'react' && next.classList.contains('on')) close();
      });
      next.addEventListener('click', function (e) { e.stopPropagation(); close(); });

      // 屋台の寄り（2倍）を描く
      var Z = 2, sw = St.W / Z, sh = St.H / Z;
      var sx = Math.max(0, Math.min(St.W - sw, St.seatX - sw / 2)), sy = Math.round(St.H * 0.27);
      function draw() {
        var ctx = cv.getContext('2d');
        ctx.imageSmoothingEnabled = false;
        var bg = OT.sprites.stallBg(St.festival);
        if (bg) ctx.drawImage(bg, sx, sy, sw, sh, 0, 0, St.W, St.H);
        else { ctx.fillStyle = '#0d1830'; ctx.fillRect(0, 0, St.W, St.H); }
        OT.sprites.stallDeco().forEach(function (im) { ctx.drawImage(im, sx, sy, sw, sh, 0, 0, St.W, St.H); });
        var t = S.t - T_DISH;
        var anim = S.phase === 'react' ? (res.stars >= 3 ? 'happy' : 'worry') : t > T_SLIDE ? 'eat' : 'wait';
        ctx.save();
        ctx.scale(Z, Z);
        OT.sprites.drawPerson(ctx, key, anim, S.t, St.seatX - sx, St.footY - sy, false, anim === 'eat' ? 4 : 3);
        ctx.restore();
        var fg = OT.sprites.stallFg();
        if (fg) ctx.drawImage(fg, sx, sy - St.fgY, sw, sh, 0, 0, St.W, St.H);
        // タコスがすべってきて、お客さんの手もとへ
        if (S.phase === 'guest' && t <= T_SLIDE && opts.img) {
          var f = Math.max(0, t / T_SLIDE), sz = St.H * 0.55;
          var tx = St.W / 2 - sz / 2, ty = St.H - sz * 0.2 - f * (St.H * 0.42);
          ctx.drawImage(opts.img, Math.round(tx), Math.round(ty), Math.round(sz), Math.round(sz));
        }
      }
      function loop(now) {
        if (!S) return;
        var dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        S.t += dt;
        if (S.phase === 'dish' && S.t >= T_DISH) setPhase('guest');
        if (S.phase === 'guest' && S.t >= T_DISH + T_SLIDE + T_EAT) setPhase('react');
        if (S.phase !== 'dish') draw();
        requestAnimationFrame(loop);
      }
      setPhase('dish');
      OT.sfx.happy(3);
      requestAnimationFrame(loop);
    }
  };
})(window);
