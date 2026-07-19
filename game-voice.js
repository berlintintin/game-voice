/* =========================================================================
   game-voice.js — shared retro audio + Japanese voice for T-Money's games
   =========================================================================
   Classic script, no build step, no modules. Works from file://, GitHub
   Pages, or any host. Include it BEFORE your game script:

     <script src="../shared/game-voice.js"></script>

   Then hit functions on window.GameVoice:

     GameVoice.say("すごい！");            // 8-bit bleeps, then spoken Japanese
     GameVoice.speak("こんにちは");        // spoken only, no bleeps
     GameVoice.beep(880, .1);              // raw synth beep
     GameVoice.sfx.snap();                 // preset: correct-answer arpeggio
     GameVoice.sfx.wrong();                // preset: low buzz
     GameVoice.sfx.fanfare();              // preset: level-clear fanfare
     GameVoice.sfx.shoot();                // preset: pew
     GameVoice.praise();                   // random praise -> {jp, en}, says it
     GameVoice.oops();                     // random miss phrase -> {jp, en} (not spoken)
     GameVoice.setEnabled(false);          // mute everything (also cancels speech)
     GameVoice.enabled                     // current on/off state
     GameVoice.bindToggle(buttonEl);       // wires a ♪ ON / ♪ OFF button for you

   iOS/Safari note: audio contexts start SUSPENDED and only wake inside a
   user gesture. This library self-registers unlock listeners on
   touchstart/pointerdown/mousedown/keydown, so as long as the player has
   tapped ANYTHING before your first sound, you're fine. For extra safety,
   call GameVoice.unlock() inside your start-button handler.
   ========================================================================= */
(function () {
  "use strict";

  // ------------------------------ state ------------------------------
  let AC = null;
  let audioUnlocked = false;
  let enabled = true;
  let jaVoice = null;

  // ------------------------------ unlock ------------------------------
  // iOS/Safari start the AudioContext SUSPENDED — it only wakes inside a
  // user gesture. (Speech synthesis is a separate system with its own rules.)
  function unlock() {
    try {
      if (!AC) AC = new (window.AudioContext || window.webkitAudioContext)();
      if (AC.state === "suspended") AC.resume();
      if (!audioUnlocked) {
        audioUnlocked = true;
        const o = AC.createOscillator(), g = AC.createGain();
        g.gain.value = 0.0001;
        o.connect(g).connect(AC.destination);
        o.start();
        o.stop(AC.currentTime + 0.02);
      }
    } catch (e) { /* no audio available — degrade silently */ }
  }
  ["touchstart", "pointerdown", "mousedown", "keydown"].forEach(function (ev) {
    window.addEventListener(ev, unlock, { passive: true });
  });

  // ------------------------------ synth ------------------------------
  function beep(freq, dur, type, vol, when, slide) {
    if (!enabled) return;
    type = type || "square"; vol = vol == null ? 0.05 : vol;
    when = when || 0; slide = slide || 0;
    try {
      AC = AC || new (window.AudioContext || window.webkitAudioContext)();
      const o = AC.createOscillator(), g = AC.createGain();
      o.type = type;
      o.frequency.setValueAtTime(freq, AC.currentTime + when);
      if (slide) o.frequency.exponentialRampToValueAtTime(
        Math.max(40, freq + slide), AC.currentTime + when + dur);
      g.gain.setValueAtTime(vol, AC.currentTime + when);
      g.gain.exponentialRampToValueAtTime(0.0001, AC.currentTime + when + dur);
      o.connect(g).connect(AC.destination);
      o.start(AC.currentTime + when);
      o.stop(AC.currentTime + when + dur + 0.02);
    } catch (e) { }
  }

  // ------------------------------ sfx presets ------------------------------
  const sfx = {
    snap:    function () { beep(523, .09, "square", .05); beep(659, .09, "square", .05, .08); beep(784, .14, "square", .05, .16); },
    wrong:   function () { beep(140, .3, "sawtooth", .05, 0, -60); },
    fanfare: function () { [523, 659, 784, 1047].forEach(function (f, i) { beep(f, .12, "square", .05, i * .09); }); },
    shoot:   function () { beep(880, .09, "square", .04, 0, -600); },
    chip:    function () { beep(300, .05, "square", .04); },
    pickup:  function (n) { beep(900 + (n || 0) * 8, .06, "sine", .02); },
  };

  // ------------------------------ speech ------------------------------
  function pickVoice() {
    if (!window.speechSynthesis) return;
    const vs = speechSynthesis.getVoices();
    jaVoice = vs.find(function (v) { return v.lang === "ja-JP" && /kyoko|otoya|google/i.test(v.name); })
           || vs.find(function (v) { return v.lang && v.lang.indexOf("ja") === 0; })
           || null;
  }
  if (window.speechSynthesis) {
    pickVoice();
    speechSynthesis.onvoiceschanged = pickVoice; // voice list loads async
  }

  // Spoken only — no bleeps.
  function speak(text, opts) {
    if (!enabled || !window.speechSynthesis) return;
    opts = opts || {};
    try {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = opts.lang || "ja-JP";
      u.pitch = opts.pitch == null ? 1.0 : opts.pitch;
      u.rate = opts.rate == null ? 1.0 : opts.rate;
      if (u.lang === "ja-JP" && jaVoice) u.voice = jaVoice;
      speechSynthesis.speak(u);
    } catch (e) { }
  }

  // Retro "voice": square-wave syllable bleeps (the 8-bit part), then the
  // words spoken with a Japanese voice (the 16-bit part).
  function say(text, opts) {
    if (!enabled) return;
    const sylls = Math.min(8, text.replace(/[ーっ！!。〜]/g, "").length);
    for (let i = 0; i < sylls; i++) {
      const f = 520 + Math.random() * 380 + (i === sylls - 1 ? -160 : 0);
      beep(f, .08, "square", .05, i * 0.085);
    }
    setTimeout(function () { speak(text, opts); }, sylls * 85 + 60);
  }

  // ------------------------------ phrase banks ------------------------------
  const PRAISE = [
    ["すばらしい！", "Subarashii! — Magnificent!"],
    ["いちばん！", "Ichiban! — You're number one!"],
    ["かんぺき！", "Kanpeki! — Flawless!"],
    ["よくできました！", "Yoku dekimashita! — Well done!"],
    ["てんさい！", "Tensai! — Genius!"],
    ["そのちょうし！", "Sono choushi! — Keep it up!"],
    ["やったね！", "Yatta ne! — You did it!"],
    ["すごい！", "Sugoi! — Incredible!"],
    ["せいかい！", "Seikai! — Correct!"],
    ["おみごと！", "O-migoto! — Bravo!"],
    ["さすが！", "Sasuga! — That's the stuff!"],
    ["いいぞ、いいぞ！", "Ii zo, ii zo! — Yeah, keep going!"],
    ["ナイスショット！", "Naisu shotto! — Nice shot!"],
    ["かっこいい！", "Kakkoii! — So cool!"],
    ["しんじられない！", "Shinjirarenai! — Unbelievable!"],
  ];
  const OOPS = [
    ["ちがうよ〜", "Chigau yo — not that one"],
    ["もういちど！", "Mō ichido! — one more try!"],
    ["おしい！", "Oshii! — so close!"],
  ];
  function pick(bank) { return bank[Math.floor(Math.random() * bank.length)]; }

  // Random praise, spoken with bleeps. Returns {jp, en} so you can show
  // your own bubble/toast. Pass {silent:true} to skip the voice.
  function praise(opts) {
    const p = pick(PRAISE);
    if (!(opts && opts.silent)) say(p[0]);
    return { jp: p[0], en: p[1] };
  }
  // Miss phrases return only — a spoken scold on every miss gets old fast.
  // Call GameVoice.say(o.jp) yourself if a given game wants it audible.
  function oops() {
    const o = pick(OOPS);
    return { jp: o[0], en: o[1] };
  }

  // ------------------------------ enable / toggle ------------------------------
  function setEnabled(on) {
    enabled = !!on;
    if (!enabled && window.speechSynthesis) speechSynthesis.cancel();
  }
  // Wires up a mute button: sets its label, flips state on click.
  function bindToggle(btn, onLabel, offLabel) {
    onLabel = onLabel || "♪ ON"; offLabel = offLabel || "♪ OFF";
    btn.textContent = enabled ? onLabel : offLabel;
    btn.addEventListener("click", function () {
      setEnabled(!enabled);
      btn.textContent = enabled ? onLabel : offLabel;
    });
  }

  // ------------------------------ export ------------------------------
  window.GameVoice = {
    unlock: unlock,
    beep: beep,
    sfx: sfx,
    speak: speak,
    say: say,
    praise: praise,
    oops: oops,
    PRAISE: PRAISE,
    OOPS: OOPS,
    setEnabled: setEnabled,
    bindToggle: bindToggle,
    get enabled() { return enabled; },
  };
})();
