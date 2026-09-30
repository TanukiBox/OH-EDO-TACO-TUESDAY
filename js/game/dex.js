/*
 * 多幸寿：タコス図鑑（作ったタコス・素タコス・食材）。まだ見つけていないものは影で表示
 */
(function (global) {
  'use strict';
  var OT = global.OT = global.OT || {};

  function st() { return OT.state.get(); }
  function cfg() { return OT.CFG; }

  var TASTE_KEYS = ['hot', 'sour', 'umami', 'aroma', 'texture'];

  /** タコスの小さな絵（見つけていなければ影） */
  function tacoThumb(skin, items, found) {
    var c = OT.ui.pixelCanvas(128, 128, 'dex-thumb');
    var ctx = c.getContext('2d');
    if (skin === 'any') skin = 'tortilla';
    OT.art.drawSkin(ctx, skin, 0);
    OT.art.drawToppings(ctx, items, 0);
    if (!found) {
      ctx.globalCompositeOperation = 'source-atop';
      ctx.fillStyle = '#243f7a';
      ctx.fillRect(0, 0, 128, 128);
      ctx.globalCompositeOperation = 'source-over';
    }
    return c;
  }

  function tasteBars(taste) {
    return OT.el('div', { class: 'taste-bars' }, TASTE_KEYS.map(function (k, i) {
      return OT.el('div', { class: 'tb' }, [
        OT.el('span', { text: OT.t('taste.' + k) }),
        OT.el('i', { style: 'width:' + Math.min(100, taste[i] / 6 * 100) + '%' })
      ]);
    }));
  }

  var tab = 'tacos', backTo = null;

  OT.dex = {
    enter: function (from) {
      backTo = from || backTo || 'morning';
      var root = OT.ui.screen('dex');
      root.innerHTML = '';
      root.appendChild(OT.ui.hud());
      root.appendChild(OT.el('h2', { class: 'scr-title', text: '📖 ' + OT.t('dex.title') }));
      var tabs = OT.el('div', { class: 'dex-tabs' });
      ['tacos', 'su', 'ings'].forEach(function (k) {
        tabs.appendChild(OT.el('button', { class: 'tab' + (tab === k ? ' on' : ''), text: OT.t('dex.tab.' + k),
          onclick: function () { OT.sfx.tap(); tab = k; OT.dex.enter(); } }));
      });
      root.appendChild(tabs);
      var grid = OT.el('div', { class: 'dex-grid' });
      var s = st(), count = 0, total = 0;

      if (tab === 'tacos') {
        Object.keys(cfg().TACOS).sort(function (a, b) { return cfg().TACOS[a].chapter - cfg().TACOS[b].chapter; }).forEach(function (id) {
          var r = cfg().TACOS[id];
          var made = s.made[id] || 0, found = made > 0;
          total++; if (found) count++;
          var items = r.variants ? r.need.concat([r.variants[Object.keys(r.variants)[0]]]) : r.need;
          var skin = r.skin === 'kagomushi' ? 'kagomushi' : r.skin;
          var lv = OT.masteryLevel(id);
          var price = Math.round(r.price * cfg().MASTERY.priceMul[lv - 1]);
          var info = found ? [
            OT.el('b', { text: OT.tacoName(id) }),
            OT.el('span', { class: 'lv', text: 'Lv' + lv + ' ' + '●'.repeat(lv) + '○'.repeat(5 - lv) }),
            OT.el('span', { text: OT.t('dex.made', { n: made }) + '　' + OT.t('ui.money', { n: price }) }),
            OT.el('span', { class: 'need', text: [skin].concat(items).filter(function (x) { return x !== 'any' && x !== 'kagomushi'; }).map(OT.ingName).join('・') }),
            r.light ? null : OT.el('span', { class: 'sudachi', text: OT.t('dex.sudachi') })
          ] : [
            OT.el('b', { text: '？？？' }),
            OT.el('span', { text: r.chapter > OT.state.chapter() ? OT.t('dex.lockedCh', { n: r.chapter }) : OT.t('dex.notYet') })
          ];
          grid.appendChild(OT.el('div', { class: 'dex-card' + (found ? '' : ' shadow') }, [tacoThumb(skin, items, found), OT.el('div', { class: 'dex-info' }, info)]));
        });
      } else if (tab === 'su') {
        Object.keys(cfg().INGREDIENTS).forEach(function (id) {
          var g = cfg().INGREDIENTS[id];
          if (g.cat === 'skin' || g.cat === 'ready') return;
          total++;
          var found = !!s.seen[id];
          if (found) count++;
          var made = s.made['su:' + id] || 0;
          grid.appendChild(OT.el('div', { class: 'dex-card small' + (found ? '' : ' shadow') }, [
            tacoThumb('tortilla', [id], found),
            OT.el('div', { class: 'dex-info' }, found ? [
              OT.el('b', { text: OT.tacoName('su:' + id) }),
              OT.el('span', { text: OT.t('dex.made', { n: made }) })
            ] : [OT.el('b', { text: '？？？' })])
          ]));
        });
      } else {
        Object.keys(cfg().INGREDIENTS).forEach(function (id) {
          var g = cfg().INGREDIENTS[id];
          total++;
          var found = !!s.seen[id];
          if (found) count++;
          var icon = OT.ui.pixelCanvas(24, 24, 'dex-icon');
          OT.art.drawIcon(icon, id);
          if (!found) {
            var ctx = icon.getContext('2d');
            ctx.globalCompositeOperation = 'source-atop'; ctx.fillStyle = '#243f7a'; ctx.fillRect(0, 0, 32, 32);
          }
          grid.appendChild(OT.el('div', { class: 'dex-card ing' + (found ? '' : ' shadow') }, [
            icon,
            OT.el('div', { class: 'dex-info' }, found ? [
              OT.el('b', { text: OT.ingName(id) }),
              OT.el('span', { class: 'cat', text: OT.t('night.tab.' + (g.cat === 'ready' ? 'skin' : g.cat)) }),
              tasteBars(g.taste)
            ] : [OT.el('b', { text: '？？？' })])
          ]));
        });
      }
      root.appendChild(OT.el('p', { class: 'lead', text: OT.t('dex.count', { n: count, total: total }) }));
      root.appendChild(grid);
      root.appendChild(OT.el('div', { class: 'sticky-bottom' }, [
        OT.button(OT.t('ui.back'), function () { if (backTo === 'result') OT.flow.result(); else OT.flow.morning(); }, 'primary big')
      ]));
    }
  };
})(window);
