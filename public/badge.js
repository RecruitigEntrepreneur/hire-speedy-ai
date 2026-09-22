/*! Matchunt Partner-Abzeichen · https://matchunt.ai/badge.js
 *
 *   <script src="https://matchunt.ai/badge.js" async></script>
 *   <matchunt-badge partner="MP-XXXX-XXXX"></matchunt-badge>
 *
 * Optional: theme="dark", size="s". Das Abzeichen fragt den Status beim Laden bei
 * Matchunt ab und verlinkt auf die Prüfseite. Es setzt keine Cookies und speichert
 * nichts im Browser. Bitte unverändert einbinden (Markenrichtlinie, Anlage 6).
 */
(function () {
  'use strict';
  if (!window.customElements || customElements.get('matchunt-badge')) return;
  var API = 'https://dngycrrhbnwdohbftpzq.supabase.co/functions/v1/partner-check';
  var CHECK = 'https://matchunt.ai/partner/';
  var NUMBER = /^MP-[2-9A-HJKMNP-TV-Z]{4}-[2-9A-HJKMNP-TV-Z]{4}$/;
  var MARK = '<svg viewBox="400 300 1000 600" width="30" height="18" aria-hidden="true" focusable="false"><g transform="translate(0,1200) scale(0.1,-0.1)" fill="currentColor"><path d="M8226 8437 c25 -37 93 -143 111 -172 7 -11 16 -29 22 -40 5 -11 20 -36 33 -55 13 -19 27 -42 31 -50 4 -8 15 -27 25 -42 9 -15 43 -69 75 -120 31 -51 63 -102 70 -113 11 -17 25 -40 74 -120 7 -11 17 -29 23 -40 6 -11 18 -32 28 -47 9 -15 62 -101 117 -192 l100 -166 473 0 c266 0 472 4 472 9 0 5 -21 43 -47 85 -65 105 -66 106 -168 271 -49 81 -95 154 -100 163 -6 9 -22 35 -35 57 -14 23 -30 50 -37 60 -25 43 -159 258 -175 283 -10 15 -22 36 -28 47 -6 11 -18 32 -28 47 -74 115 -92 149 -87 158 4 7 406 10 1179 10 l1173 0 20 -22 c16 -19 147 -227 201 -320 7 -13 21 -35 30 -50 9 -15 37 -59 62 -98 25 -39 53 -83 62 -98 10 -15 21 -34 25 -42 3 -8 18 -33 32 -55 14 -22 30 -48 36 -57 5 -9 43 -70 83 -135 40 -65 78 -127 85 -138 7 -11 30 -49 53 -85 22 -36 65 -105 95 -153 30 -48 62 -100 71 -115 10 -15 21 -34 25 -42 4 -8 30 -51 58 -95 28 -44 84 -135 125 -203 41 -68 83 -135 92 -150 10 -15 22 -36 28 -47 6 -11 18 -32 28 -47 9 -15 58 -93 107 -173 50 -81 98 -159 107 -173 10 -15 22 -36 28 -47 6 -11 19 -33 30 -50 11 -16 23 -37 27 -45 3 -8 18 -31 33 -50 15 -19 29 -42 32 -51 3 -8 23 -42 44 -75 48 -73 61 -95 70 -114 4 -8 26 -44 49 -80 36 -57 89 -142 128 -205 7 -11 24 -39 40 -63 15 -24 27 -45 27 -48 0 -3 19 -35 43 -72 24 -37 68 -107 98 -156 30 -48 62 -100 71 -115 10 -14 22 -35 28 -46 6 -11 19 -33 30 -50 11 -16 24 -39 30 -50 6 -11 18 -32 28 -47 9 -15 36 -57 60 -95 24 -37 48 -75 54 -84 6 -9 8 -24 5 -33 -6 -15 -91 -16 -1064 -14 l-1057 3 -30 42 c-33 44 -148 221 -155 238 -2 5 -23 37 -46 70 -23 33 -45 67 -49 75 -10 21 -25 46 -77 125 -70 106 -123 189 -129 200 -3 6 -34 54 -69 108 l-64 97 -446 2 c-245 1 -468 2 -496 2 -57 1 -75 -2 -75 -15 0 -7 49 -85 168 -269 9 -14 21 -33 27 -42 10 -17 116 -188 145 -233 8 -13 35 -56 60 -95 25 -39 52 -82 60 -95 8 -13 42 -67 75 -120 33 -53 68 -109 77 -123 47 -73 46 -85 -18 -184 -24 -37 -44 -70 -44 -73 0 -3 -12 -24 -27 -48 -38 -58 -51 -80 -60 -97 -4 -8 -79 -136 -168 -285 -88 -148 -164 -277 -168 -285 -4 -8 -16 -28 -27 -45 -11 -16 -24 -39 -30 -50 -6 -11 -19 -33 -30 -50 -11 -16 -23 -37 -27 -45 -4 -8 -40 -70 -80 -137 -40 -68 -73 -125 -73 -127 0 -3 -13 -24 -29 -48 -16 -24 -39 -62 -52 -86 -29 -52 -36 -64 -72 -119 -15 -24 -27 -45 -27 -49 0 -10 -41 -64 -49 -64 -4 0 -25 30 -46 66 -22 36 -48 78 -57 92 -10 15 -22 36 -28 47 -6 11 -19 34 -30 50 -11 17 -24 39 -30 50 -6 11 -18 32 -28 47 -35 55 -258 420 -281 461 -13 23 -36 60 -50 82 -14 22 -34 56 -44 75 -11 19 -39 64 -62 100 -37 57 -278 451 -313 513 -7 12 -22 36 -32 52 -11 17 -24 39 -30 50 -6 11 -18 32 -28 47 -22 36 -194 314 -207 336 -29 50 -82 137 -97 161 -10 14 -21 33 -25 41 -4 8 -18 31 -31 50 -13 19 -28 44 -33 55 -5 11 -17 32 -27 46 -9 15 -64 104 -122 199 -58 94 -112 182 -120 195 -8 14 -96 157 -195 320 -99 163 -188 308 -197 323 -10 15 -21 34 -25 42 -4 8 -19 33 -34 55 -15 22 -35 56 -46 75 -10 19 -37 62 -58 95 -47 71 -62 95 -71 115 -4 8 -19 33 -33 55 -36 56 -49 77 -61 100 -6 11 -18 32 -28 46 -14 23 -62 101 -97 161 -35 60 -106 175 -150 243 -28 44 -55 87 -58 95 -4 8 -15 27 -25 42 -9 15 -64 104 -122 199 -119 194 -116 190 -151 244 -14 22 -29 47 -32 55 -4 8 -15 27 -25 42 -9 15 -51 82 -92 149 -41 67 -83 133 -92 148 -10 14 -22 35 -28 46 -6 11 -18 32 -28 47 -36 56 -112 185 -112 191 0 4 429 7 953 7 l952 0 21 -33z"/><path d="M6181 7115 c12 -22 33 -58 48 -80 15 -22 30 -47 34 -55 4 -8 15 -27 25 -42 18 -28 153 -247 175 -283 7 -11 23 -38 37 -60 14 -22 29 -47 33 -55 4 -8 15 -27 25 -41 14 -23 55 -90 97 -161 14 -23 156 -253 177 -286 10 -15 22 -36 28 -47 6 -11 18 -32 28 -47 14 -22 68 -110 205 -333 12 -19 50 -81 74 -120 7 -11 17 -29 23 -40 6 -11 19 -33 30 -50 11 -16 24 -39 30 -50 6 -11 18 -32 28 -47 9 -14 51 -81 92 -148 41 -67 83 -134 92 -148 10 -15 22 -36 28 -47 6 -11 19 -33 30 -50 11 -16 23 -37 27 -45 4 -8 18 -31 31 -50 13 -19 28 -44 33 -55 5 -11 17 -32 27 -47 47 -71 80 -133 76 -140 -3 -4 -700 -8 -1550 -8 -1287 0 -1545 2 -1550 13 -3 8 29 71 71 142 41 70 75 128 75 130 0 2 33 59 73 126 40 68 76 131 80 139 4 8 16 29 26 45 11 17 29 48 41 70 67 123 84 151 95 165 6 8 15 22 19 30 4 8 12 24 19 35 7 11 30 52 52 90 22 39 45 79 52 90 7 11 15 27 19 35 4 8 17 31 29 50 12 19 39 67 60 105 20 39 44 77 51 86 8 8 14 19 14 23 0 5 27 53 60 108 33 54 60 101 60 103 0 2 47 83 105 180 58 98 105 179 105 180 0 2 19 36 43 77 24 40 46 80 50 88 4 8 16 29 27 45 11 17 23 37 27 45 4 8 32 58 63 110 31 52 59 102 63 110 4 8 13 24 20 35 7 11 27 47 46 80 46 81 60 92 83 63 10 -13 27 -41 39 -63z"/></g></svg>';
  var cache = {};

  function status(n) {
    if (!cache[n]) {
      cache[n] = fetch(API + '?n=' + encodeURIComponent(n) + '&embed=1', { credentials: 'omit', mode: 'cors' })
        .then(function (r) { return r.ok ? r.json() : { state: 'unknown' }; })
        .catch(function () { return { state: 'unknown' }; });
    }
    return cache[n];
  }

  var CSS = ':host{display:inline-block;vertical-align:middle;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif;line-height:1.2}'
    + 'a{display:inline-flex;flex-direction:column;gap:5px;text-decoration:none;border:1px solid #E4E4E7;background:#fff;color:#0A0A0A;border-radius:10px;padding:7px 13px 7px 9px;transition:border-color .15s}'
    + 'a:hover{border-color:#A1A1AA}a:focus-visible{outline:2px solid #2563EB;outline-offset:2px}'
    + '.row{display:flex;align-items:center;gap:10px}.line{width:1px;height:24px;background:#E4E4E7}'
    + '.top{display:block;font-size:10px;letter-spacing:.03em;color:#6B6B6B}.main{display:block;font-size:14px;font-weight:700}'
    + '.state{display:flex;align-items:center;gap:6px;font-size:11px;color:#6B6B6B;padding-left:2px}.dot{width:6px;height:6px;border-radius:50%;background:#A1A1AA}'
    + '.active .state{color:#15803D}.active .dot{background:#16A34A}.off{opacity:.62}'
    + '.dark{background:#0A0A0A;border-color:#2A2A2A;color:#fff}.dark .line{background:#3F3F46}.dark .top{color:#A1A1AA}.dark.active .state{color:#86EFAC}'
    + '.gold{background:#0A0A0A;border-color:#0A0A0A;color:#fff}.gold svg,.gold .top{color:#C8A24A}.gold .line{background:#3F3F46}.gold.active .state{color:#86EFAC}'
    + '.s{padding:5px 10px 5px 7px}.s .state{display:none}.s .main{font-size:12px}.s svg{width:24px;height:14px}.s .line{height:18px}';

  var TEXT = { active: 'aktiv · geprüft', paused: 'derzeit nicht aktiv', ended: 'nicht mehr aktiv', invalid: 'Nummer ungültig', pending: 'wird geprüft …' };

  class MatchuntBadge extends HTMLElement {
    static get observedAttributes() { return ['partner', 'theme', 'size']; }
    connectedCallback() { this.update(); }
    attributeChangedCallback() { if (this.isConnected) this.update(); }
    draw(n, state, tier) {
      var root = this.shadowRoot || this.attachShadow({ mode: 'open' });
      var cls = ['card', this.getAttribute('size') === 's' ? 's' : '', state === 'active' ? 'active' : '', state === 'ended' || state === 'invalid' ? 'off' : '',
        tier === 'gold' ? 'gold' : this.getAttribute('theme') === 'dark' ? 'dark' : ''].filter(Boolean).join(' ');
      var label = tier === 'gold' ? 'Gold Partner' : 'Partner';
      root.innerHTML = '<style>' + CSS + '</style>'
        + '<a class="' + cls + '" href="' + CHECK + encodeURIComponent(n) + '" target="_blank" rel="noopener" aria-label="Matchunt ' + label + ', Status prüfen">'
        + '<span class="row">' + MARK + '<span class="line"></span><span><span class="top">Matchunt</span><span class="main">' + label + '</span></span></span>'
        + (state !== 'unknown' ? '<span class="state"><span class="dot"></span>' + TEXT[state] + '</span>' : '')
        + '</a>';
    }
    update() {
      var self = this;
      var n = String(this.getAttribute('partner') || '').trim().toUpperCase();
      if (!NUMBER.test(n)) { this.draw(n, 'invalid', 'partner'); return; }
      this.draw(n, 'pending', 'partner');
      status(n).then(function (r) {
        if (String(self.getAttribute('partner') || '').trim().toUpperCase() !== n) return;
        self.draw(n, r && TEXT[r.state] ? r.state : 'unknown', r && r.tier === 'gold' ? 'gold' : 'partner');
      });
    }
  }

  customElements.define('matchunt-badge', MatchuntBadge);
})();
