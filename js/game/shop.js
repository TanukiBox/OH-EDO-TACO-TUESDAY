/*
 * 多幸寿：町の店（ミニゲームなし。1日に回れる数に数えない）
 *   品ぞろえ・値段は config.js の SHOPS
 */
(function (global) {
  'use strict';
  var OT = global.OT = global.OT || {};

  function st() { return OT.state.get(); }

  OT.shop = {
    enter: function (shopId) {
      var root = OT.ui.screen('shop');
      root.innerHTML = '';
      root.appendChild(OT.ui.hud());
      root.appendChild(OT.el('h2', { class: 'scr-title', text: '🏪 ' + OT.t('sup.' + shopId) }));
      root.appendChild(OT.el('p', { class: 'lead', text: OT.t('shop.lead.' + shopId) }));
      var list = OT.el('div', { class: 'shop-list' });
      var ch = OT.state.chapter(), season = OT.state.season();
      (OT.CFG.SHOPS[shopId] || []).forEach(function (item) {
        if (item.chapter > ch) return;
        var off = item.season && item.season !== season;
        var icon = OT.ui.pixelCanvas(24, 24, 'shop-icon');
        OT.art.drawIcon(icon, item.id);
        var have = OT.el('span', { class: 'shop-have' });
        var btn = OT.button(OT.t('shop.buy', { price: item.price }), function () {
          if (st().money < item.price) { OT.sfx.denied(); OT.ui.toast(OT.t('shop.poor')); return; }
          st().money -= item.price;
          OT.state.addStock(item.id, item.n);
          OT.sfx.coin();
          OT.state.save();
          refresh();
        }, 'small buy');
        if (off) btn.disabled = true;
        var row = OT.el('div', { class: 'shop-row' + (off ? ' off' : '') }, [
          icon,
          OT.el('div', { class: 'shop-info' }, [
            OT.el('b', { text: OT.ingName(item.id) }),
            OT.el('span', { text: off ? OT.t('shop.offSeason', { season: OT.t('season.' + item.season) }) : OT.t('shop.lot', { n: item.n }) }),
            have
          ]),
          btn
        ]);
        row._refresh = function () { have.textContent = OT.t('shop.have', { n: OT.state.stockOf(item.id) }); };
        list.appendChild(row);
      });
      root.appendChild(list);
      root.appendChild(OT.el('div', { class: 'sticky-bottom' }, [
        OT.button(OT.t('shop.leave'), function () { OT.flow.morning(); }, 'primary big')
      ]));
      function refresh() {
        root.querySelector('.hud-money').textContent = '💰 ' + OT.t('ui.money', { n: st().money });
        var rows = list.querySelectorAll('.shop-row');
        for (var i = 0; i < rows.length; i++) rows[i]._refresh();
      }
      refresh();
      if (shopId === 'komeya' && ch >= 2 && !st().flags.sawMorokoshi) {
        st().flags.sawMorokoshi = 1;
        OT.state.save();
        setTimeout(function () { OT.ui.toast(OT.t('pon.morokoshi'), 'tip long'); }, 300);
      }
    }
  };
})(window);
