/*
 * 多幸寿：効果音（ブラウザの中で合成する。音声ファイルは使わない）
 */
(function (global) {
  'use strict';
  var OT = global.OT = global.OT || {};

  function S() { return OT.sound; }

  OT.sfx = {
    tap: function () { S().tone({ type: 'triangle', f0: 880, f1: 660, dur: 0.05, vol: 0.12 }); },
    place: function () {
      S().noise({ dur: 0.07, vol: 0.18, f0: 1800, f1: 600, q: 1.2 });
      S().tone({ type: 'sine', f0: 520, f1: 380, dur: 0.07, vol: 0.08 });
    },
    denied: function () { S().tone({ type: 'square', f0: 180, f1: 140, dur: 0.12, vol: 0.08 }); },
    // 拍子木（開店・閉店の合図）
    clack: function (n) {
      for (var i = 0; i < (n || 2); i++) {
        S().synth({ f: 1250, dur: 0.03, vol: 0.2, osc: [{ type: 'square' }, { type: 'triangle', mul: 2.1 }],
          env: { a: 0.001, d: 0.05, s: 0, r: 0.05 }, filter: { type: 'bandpass', f: 2200, q: 3 }, reverb: 0.25, delay: i * 0.22 });
      }
    },
    // 競り落とし（手を打つ音＋「よしっ」）
    buy: function () {
      S().noise({ dur: 0.06, vol: 0.3, f0: 2500, f1: 900, q: 0.8 });
      S().synth({ f: 660, f1: 990, dur: 0.12, vol: 0.12, osc: [{ type: 'triangle' }], echo: 0.15, delay: 0.04 });
    },
    lost: function () { S().synth({ f: 330, f1: 220, dur: 0.25, vol: 0.1, osc: [{ type: 'sawtooth' }], filter: { f: 900 } }); },
    // 包む（布ずれ）
    wrap: function () {
      S().noise({ dur: 0.22, vol: 0.14, f0: 700, f1: 2400, q: 0.7 });
      S().tone({ type: 'sine', f0: 300, f1: 520, dur: 0.18, vol: 0.06, delay: 0.05 });
    },
    // 会計（小銭）
    coin: function () {
      [1568, 2093].forEach(function (f, i) {
        S().synth({ f: f, dur: 0.06, vol: 0.09, osc: [{ type: 'sine' }, { type: 'sine', mul: 2.7, gain: 0.4 }],
          env: { a: 0.002, d: 0.2, s: 0, r: 0.2 }, reverb: 0.2, delay: i * 0.07 });
      });
    },
    happy: function (stars) {
      var notes = stars >= 3 ? [523, 659, 784, 1047] : stars === 2 ? [523, 659] : [392];
      notes.forEach(function (f, i) {
        S().synth({ f: f, dur: 0.09, vol: 0.09, osc: [{ type: 'square', gain: 0.5 }, { type: 'triangle' }],
          env: { a: 0.003, d: 0.08, s: 0.4, r: 0.08 }, filter: { f: 3000 }, delay: i * 0.07, reverb: 0.15 });
      });
    },
    angry: function () {
      S().synth({ f: 200, f1: 120, dur: 0.35, vol: 0.12, osc: [{ type: 'sawtooth', detune: -10 }, { type: 'sawtooth', detune: 10 }], filter: { f: 700 } });
    },
    arrive: function () { S().tone({ type: 'sine', f0: 988, dur: 0.08, vol: 0.07 }); S().tone({ type: 'sine', f0: 784, dur: 0.12, vol: 0.07, delay: 0.09 }); },
    tick: function () { S().tone({ type: 'square', f0: 1200, dur: 0.03, vol: 0.05 }); }
  };
})(window);
