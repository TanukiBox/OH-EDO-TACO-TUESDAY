/*
 * 多幸寿：X（旧Twitter）シェア（Tanuki Box の他のゲームと同じしくみ）
 * 文章は text.js の 'share.text'、URL は config.js の SHARE_URL。
 */
(function (global) {
  'use strict';
  var OT = global.OT = global.OT || {};

  OT.shareIntentUrl = function (text, url) {
    var q = 'text=' + encodeURIComponent(text);
    if (url) q += '&url=' + encodeURIComponent(url);
    return 'https://x.com/intent/post?' + q;
  };

  /** X の投稿画面を開く（新しいタブ。開けなければ同じタブで） */
  OT.shareOnX = function (text) {
    var href = OT.shareIntentUrl(text, OT.CFG.SHARE_URL);
    var w = global.open(href, '_blank', 'noopener');
    if (!w) global.location.href = href;
  };
})(window);
