/*
 * 多幸寿：屋台の改装（お金の使いみち）
 *   提灯・のれん・カウンター（台）・焼き場を、それぞれ3段まで良くできる。見た目が変わり、商売もしやすくなる。
 *     提灯   … お客さんが多く来る（来る間隔が短くなる）
 *     のれん … お客さんが長く待ってくれる
 *     台     … 料理の代金と心付けが上がる
 *     焼き場 … 焼き加減の「ちょうど良い」の幅が広がる
 *   値段・効き目・何章からかは config.js の UPGRADES。ことばは text.js の 'kaiso.*'。
 */
(function (global) {
  'use strict';
  var OT = global.OT = global.OT || {};
  var KINDS = ['chochin', 'noren', 'dai', 'yakiba'];
  var ICON = { chochin: '🏮', noren: '🎏', dai: '🪵', yakiba: '🔥' };

  function cfg() { return OT.CFG.UPGRADES; }
  function st() { return OT.state.get(); }

  OT.upg = {
    kinds: KINDS,
    /** いまの段（0 = 改装していない） */
    level: function (k) { var s = st(); return (s && s.upgrades && s.upgrades[k]) || 0; },
    /** いまの段の効き目（改装していなければ 1） */
    value: function (k, key) { var lv = OT.upg.level(k); return lv ? cfg()[k].levels[lv - 1][key] : 1; }
  };

  /** 効き目を、ことばに（例：「お客さんが 15% 多く来る」） */
  function effectText(k, lv) {
    if (!lv) return OT.t('kaiso.none');
    var L = cfg()[k].levels[lv - 1];
    var pct = k === 'chochin' ? Math.round((1 / L.arrival - 1) * 100) : k === 'noren' ? Math.round((L.patience - 1) * 100) :
      k === 'dai' ? Math.round((L.pay - 1) * 100) : Math.round((L.window - 1) * 100);
    return OT.t('kaiso.eff.' + k, { n: pct });
  }

  /** 改装の見本：夜の屋台（お客さんなし）に、いまの提灯・のれん・台を重ねる */
  function drawPreview(canvas) {
    var ctx = canvas.getContext('2d'), W = canvas.width, H = canvas.height;
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#0d1830'; ctx.fillRect(0, 0, W, H);
    var bg = OT.sprites.stallBg(null);
    if (bg) ctx.drawImage(bg, 0, 0);
    OT.sprites.stallDeco().forEach(function (im) { ctx.drawImage(im, 0, 0); });
    var fg = OT.sprites.stallFg();
    if (fg) ctx.drawImage(fg, 0, Math.round(H * 0.125));
  }

  OT.kaiso = {
    enter: function () {
      var s = st(), ch = OT.state.chapter();
      var root = OT.ui.screen('kaiso');
      root.innerHTML = '';
      root.appendChild(OT.ui.hud());
      root.appendChild(OT.el('h2', { class: 'scr-title', text: '🔨 ' + OT.t('kaiso.title') }));
      root.appendChild(OT.el('p', { class: 'lead', text: OT.t('kaiso.lead') }));
      var size = OT.sprites.manifest.stallSize || [384, 216];
      var pv = OT.ui.pixelCanvas(size[0], size[1], 'kaiso-preview');
      drawPreview(pv);
      root.appendChild(pv);
      var list = OT.el('div', { class: 'kaiso-list' });
      KINDS.forEach(function (k) {
        var lv = OT.upg.level(k), levels = cfg()[k].levels, next = levels[lv];
        var row = OT.el('div', { class: 'kaiso-row' }, [
          OT.el('span', { class: 'kaiso-icon', text: ICON[k] }),
          OT.el('div', { class: 'kaiso-info' }, [
            OT.el('b', { text: OT.t('kaiso.' + k) + '　' + '★'.repeat(lv) + '☆'.repeat(levels.length - lv) }),
            OT.el('span', { class: 'kaiso-now', text: OT.t('kaiso.' + k + '.' + lv) + '：' + effectText(k, lv) }),
            next ? OT.el('span', { class: 'kaiso-next', text: OT.t('kaiso.next', { name: OT.t('kaiso.' + k + '.' + (lv + 1)), eff: effectText(k, lv + 1) }) }) : null
          ].filter(Boolean))
        ]);
        if (!next) row.appendChild(OT.el('span', { class: 'kaiso-max', text: OT.t('kaiso.max') }));
        else if (next.chapter > ch) row.appendChild(OT.el('span', { class: 'kaiso-max', text: OT.t('kaiso.fromCh', { n: next.chapter }) }));
        else {
          var poor = s.money < next.price;
          row.appendChild(OT.button(OT.t('kaiso.buy', { price: next.price }), function () {
            if (st().money < next.price) { OT.sfx.denied(); OT.ui.toast(OT.t('shop.poor')); return; }
            st().money -= next.price;
            st().upgrades = st().upgrades || {};
            st().upgrades[k] = lv + 1;
            OT.state.save();
            OT.sfx.buy();
            OT.kaiso.enter();
            OT.ui.toast(OT.t('kaiso.done', { name: OT.t('kaiso.' + k + '.' + (lv + 1)) }), 'tip');
            if (OT.fx && OT.fx.confetti) OT.fx.confetti();
          }, 'small' + (poor ? ' off' : '')));
        }
        list.appendChild(row);
      });
      root.appendChild(list);
      root.appendChild(OT.el('div', { class: 'sticky-bottom' }, [
        OT.button(OT.t('shop.leave'), function () { OT.flow.morning(); }, 'primary big')
      ]));
    }
  };
})(window);
