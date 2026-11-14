/* World Pulse globe.
   A realistic Earth drawn pixel by pixel on a canvas:
   - real coastlines (Natural Earth 1:110m, loaded from world-land.js as window.WORLD_LAND)
   - land coloured by climate band (ice, tundra, forest, desert), ocean with depth texture
   - the real day and night line, worked out from the sun's position at the current time
   - city lights on the night side (real city locations)
   - optional story markers with pulse rings, and an optional orbiting spacecraft
   Drag to spin. Usage: var g = WorldGlobe(canvasElement, options).
*/
(function () {
  var D2R = Math.PI / 180, TW = 2048, TH = 1024, TEX = null;

  function hash(x, y) { var h = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return h - Math.floor(h); }
  function vnoise(x, y) {
    var xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    var a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
    var u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }
  function fbm(x, y) { return vnoise(x, y) * 0.5 + vnoise(x * 2.1, y * 2.1) * 0.3 + vnoise(x * 4.3, y * 4.3) * 0.2; }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function smooth(a, b, x) { var t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }

  // Rough boxes of the big dry regions: [west lon, east lon, south lat, north lat]
  var DESERTS = [[-17, 35, 15, 32], [34, 60, 13, 32], [113, 141, -31, -20], [12, 26, -29, -19], [-117, -103, 26, 37],
    [90, 112, 39, 46], [52, 70, 37, 45], [-72, -68, -27, -17], [66, 74, 24, 29], [-70, -64, -45, -38], [75, 92, 36, 41]];
  function desertness(lon, lat) {
    var best = 0;
    for (var i = 0; i < DESERTS.length; i++) {
      var b = DESERTS[i];
      var dx = Math.max(b[0] - lon, 0, lon - b[1]), dy = Math.max(b[2] - lat, 0, lat - b[3]);
      var dist = Math.sqrt(dx * dx + dy * dy);
      best = Math.max(best, 1 - smooth(0, 5, dist));
    }
    return best;
  }

  function buildTexture() {
    // Colours are worked out on a 1024 by 512 grid; the coastline mask is drawn at 2048 by 1024 and blended,
    // so coasts stay smooth without slowing the start.
    var LW = TW / 2, LH = TH / 2, landC = new Float32Array(LW * LH * 3), seaC = new Float32Array(LW * LH * 3);
    for (var y = 0; y < LH; y++) {
      var lat = 90 - (y + 0.5) / LH * 180, alat = Math.abs(lat);
      for (var x = 0; x < LW; x++) {
        var lon = (x + 0.5) / LW * 360 - 180, k = (y * LW + x) * 3;
        var n = fbm(lon / 9, lat / 9), n2 = fbm(lon / 2.5 + 40, lat / 2.5);
        var depth = 0.6 + 0.4 * n, r = 6 + 10 * depth, gg = 34 + 30 * depth, b = 78 + 46 * depth;
        if (alat > 66) { var ice = smooth(66, 78, alat) * (0.5 + 0.5 * n2); r += (220 - r) * ice * 0.55; gg += (232 - gg) * ice * 0.55; b += (240 - b) * ice * 0.55; }
        seaC[k] = r; seaC[k + 1] = gg; seaC[k + 2] = b;
        var des = clamp(desertness(lon, lat) * (0.75 + 0.5 * (n - 0.5)), 0, 1);
        var tropic = 1 - smooth(10, 30, alat), boreal = smooth(48, 62, alat);
        r = 46 + 20 * n2 - 12 * tropic + 50 * boreal; gg = 86 + 26 * n2 - 6 * tropic + 18 * boreal; b = 38 + 12 * n2 + 30 * boreal;
        var grass = smooth(0.45, 0.8, n) * (1 - tropic) * (1 - boreal);
        r += (128 - r) * grass * 0.45; gg += (128 - gg) * grass * 0.45; b += (72 - b) * grass * 0.45;
        r += (204 - r) * des; gg += (174 - gg) * des; b += (124 - b) * des;
        var iceL = Math.max(smooth(-60, -66, lat), smooth(70, 76, lat));
        if (lon > -73 && lon < -12 && lat > 59) iceL = Math.max(iceL, smooth(59, 66, lat) * (0.85 + 0.15 * n2));
        r += (236 - r) * iceL; gg += (240 - gg) * iceL; b += (246 - b) * iceL;
        landC[k] = r; landC[k + 1] = gg; landC[k + 2] = b;
      }
    }
    var out = new Uint8ClampedArray(TW * TH * 4);
    var c = document.createElement('canvas'); c.width = TW; c.height = TH;
    var g = c.getContext('2d');
    if (!g) return out;
    g.fillStyle = '#000'; g.fillRect(0, 0, TW, TH);
    g.fillStyle = '#fff'; g.beginPath();
    (window.WORLD_LAND || []).forEach(function (r) {
      for (var i = 0; i < r.length; i += 2) {
        var x = (r[i] + 180) / 360 * TW, y = (90 - r[i + 1]) / 180 * TH;
        if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
      }
      g.closePath();
    });
    g.fill('evenodd');
    var mask = g.getImageData(0, 0, TW, TH).data;
    for (var yy = 0; yy < TH; yy++) {
      for (var xx = 0; xx < TW; xx++) {
        var q = (yy * TW + xx) * 4, m = mask[q] / 255, lk = ((yy >> 1) * LW + (xx >> 1)) * 3;
        out[q] = seaC[lk] + (landC[lk] - seaC[lk]) * m;
        out[q + 1] = seaC[lk + 1] + (landC[lk + 1] - seaC[lk + 1]) * m;
        out[q + 2] = seaC[lk + 2] + (landC[lk + 2] - seaC[lk + 2]) * m;
        out[q + 3] = m > 0.5 ? 1 : 0;
      }
    }
    return out;
  }

  // Real city locations for night lights [lat, lon, brightness]
  var CITIES = [[35.7,139.7,1],[28.6,77.2,1],[31.2,121.5,1],[-23.5,-46.6,1],[19.4,-99.1,1],[30.0,31.2,1],[19.1,72.9,1],[39.9,116.4,1],
    [23.8,90.4,.8],[34.7,135.5,.9],[40.7,-74.0,1],[24.9,67.0,.8],[-34.6,-58.4,.9],[41.0,29.0,.9],[22.6,88.4,.8],[6.5,3.4,.7],
    [14.6,121.0,.8],[-22.9,-43.2,.8],[23.1,113.3,1],[34.1,-118.2,1],[55.8,37.6,1],[48.9,2.35,1],[51.5,-0.1,1],[-6.2,106.8,.9],
    [37.6,127.0,1],[-12.0,-77.0,.7],[13.8,100.5,.8],[41.9,-87.6,.9],[35.7,51.4,.8],[4.7,-74.1,.7],[-26.2,28.0,.7],[40.4,-3.7,.8],
    [43.7,-79.4,.8],[29.8,-95.4,.8],[32.8,-96.8,.8],[25.8,-80.2,.7],[33.7,-84.4,.7],[38.9,-77.0,.7],[37.8,-122.4,.8],[47.6,-122.3,.6],
    [33.4,-112.1,.6],[39.7,-105.0,.6],[45.5,-73.6,.6],[-33.9,151.2,.8],[-37.8,145.0,.7],[1.35,103.8,.8],[22.3,114.2,.9],[24.7,46.7,.7],
    [25.2,55.3,.8],[52.5,13.4,.8],[41.9,12.5,.7],[50.45,30.5,.6],[-1.3,36.8,.5],[-4.3,15.3,.5],[-33.4,-70.6,.6],[25.0,121.6,.8],
    [10.8,106.7,.7],[3.1,101.7,.7],[45.5,9.2,.8],[41.4,2.2,.6],[52.2,21.0,.6],[13.1,80.3,.7],[13.0,77.6,.7],[31.5,74.3,.7],
    [33.3,44.4,.6],[9.0,38.7,.4],[33.6,-7.6,.5],[36.8,3.1,.5],[5.6,-0.2,.4],[10.5,-66.9,.5],[23.1,-82.4,.4],[49.3,-123.1,.5],
    [-31.95,115.9,.5],[-36.85,174.8,.5],[21.3,-157.9,.4],[59.3,18.1,.5],[52.4,4.9,.7],[50.85,4.35,.7],[48.2,16.4,.6],[38.0,23.7,.6],
    [41.3,69.2,.5],[43.2,76.9,.4],[55.0,82.9,.4],[29.6,106.5,.8],[30.7,104.1,.8],[30.6,114.3,.8],[34.3,108.9,.7],[45.8,126.6,.6],
    [35.2,129.1,.7],[21.0,105.8,.6],[26.1,-80.1,.5],[42.4,-71.1,.8],[39.95,-75.2,.7],[44.98,-93.3,.5],[29.95,-90.1,.5],[36.2,-115.1,.6],
    [32.7,-117.2,.6],[25.7,-100.3,.6],[20.7,-103.3,.6],[53.5,-2.2,.6],[55.9,-4.3,.4],[53.3,-6.3,.4],[59.9,30.3,.7],[45.0,7.7,.5],
    [47.4,8.5,.5],[50.1,8.7,.6],[48.1,11.6,.6],[53.6,10.0,.6],[51.2,6.8,.8],[-8.0,-34.9,.5],[-15.8,-47.9,.5],[-19.9,-43.9,.6],
    [-30.0,-51.2,.5],[3.4,-76.5,.4],[18.5,-69.9,.4],[18.0,-76.8,.3],[14.1,-87.2,.3],[9.9,-84.1,.3],[8.98,-79.5,.4],[-0.2,-78.5,.4],
    [-2.2,-79.9,.4],[-16.5,-68.1,.3],[-25.3,-57.6,.3],[-34.9,-56.2,.4],[30.0,32.5,.4],[31.2,29.9,.6],[32.1,34.8,.6],[33.9,35.5,.4],
    [36.2,37.2,.4],[39.9,32.9,.6],[38.4,27.1,.5],[40.4,49.9,.4],[41.7,44.8,.3],[29.4,47.98,.5],[26.2,50.6,.4],[25.3,51.5,.5],
    [21.5,39.2,.6],[17.4,78.5,.7],[18.5,73.9,.7],[23.0,72.6,.7],[26.9,75.8,.5],[26.8,80.9,.6],[25.6,85.1,.5],[6.9,79.9,.4],
    [27.7,85.3,.4],[16.8,96.2,.4],[-6.9,107.6,.6],[-7.25,112.75,.6],[14.1,120.6,.3],[10.3,123.9,.4],[7.1,125.6,.3],[35.0,135.8,.6],
    [35.2,136.9,.7],[33.6,130.4,.6],[43.1,141.3,.5],[38.3,140.9,.5],[36.1,120.4,.6],[36.7,117.0,.6],[32.1,118.8,.7],[30.3,120.2,.7],
    [26.1,119.3,.5],[22.5,114.1,.9],[25.0,102.7,.4],[43.8,87.6,.3],[36.1,103.8,.4],[41.8,123.4,.6],[38.9,121.6,.5],[39.1,117.2,.7],
    [-27.5,153.0,.5],[-34.9,138.6,.4],[-41.3,174.8,.3],[64.1,-21.9,.2],[60.2,24.9,.4],[59.4,24.75,.3],[56.9,24.1,.3],[54.7,25.3,.3],
    [53.9,27.6,.4],[50.1,14.4,.5],[47.5,19.0,.5],[44.4,26.1,.5],[42.7,23.3,.4],[44.8,20.5,.4],[45.8,16.0,.3],[46.05,14.5,.2],
    [37.98,-1.1,.3],[38.7,-9.1,.5],[41.15,-8.6,.4],[39.5,-0.4,.4],[37.4,-6.0,.4],[43.3,5.4,.4],[45.75,4.85,.4],[43.6,1.4,.3],
    [44.8,-0.6,.3],[47.2,-1.55,.3],[50.6,3.1,.4],[51.9,4.5,.5],[51.2,4.4,.5],[49.6,6.1,.2],[55.7,12.6,.5],[59.9,10.75,.4],
    [57.7,11.97,.3],[40.85,14.25,.5],[45.4,12.3,.3],[44.5,11.3,.4],[38.1,13.4,.4],[43.8,11.25,.4],[35.9,14.5,.2],[34.0,-6.8,.3],
    [36.8,10.2,.4],[32.9,13.2,.3],[12.0,8.5,.4],[9.06,7.5,.4],[14.7,-17.4,.4],[5.3,-4.0,.5],[12.4,-1.5,.2],[3.85,11.5,.2],
    [4.05,9.7,.3],[-8.8,13.2,.4],[-17.8,31.0,.3],[-15.4,28.3,.3],[-6.8,39.3,.4],[0.3,32.6,.4],[-29.85,31.0,.5],[-33.9,18.4,.5],
    [-25.7,28.2,.5],[-4.0,39.7,.3],[2.0,45.3,.3],[15.3,38.9,.2],[-18.9,47.5,.3]];

  function sunVector(ms) {
    var d = new Date(ms), start = Date.UTC(d.getUTCFullYear(), 0, 0), day = (ms - start) / 86400000;
    var decl = -23.44 * Math.cos(2 * Math.PI / 365 * (day + 10));
    var B = 2 * Math.PI * (day - 81) / 364, eot = 9.87 * Math.sin(2 * B) - 7.53 * Math.cos(B) - 1.5 * Math.sin(B);
    var hours = d.getUTCHours() + d.getUTCMinutes() / 60 + d.getUTCSeconds() / 3600;
    var lon = -15 * (hours - 12 + eot / 60);
    return vec(decl, lon);
  }
  function vec(lat, lon) { var p = lat * D2R, l = lon * D2R; return [Math.cos(p) * Math.sin(l), Math.sin(p), Math.cos(p) * Math.cos(l)]; }
  function gmstDeg(ms) { var jd = ms / 86400000 + 2440587.5; return (280.46061837 + 360.98564736629 * (jd - 2451545.0)) % 360; }

  window.WorldGlobe = function (canvas, o) {
    o = o || {};
    var ctx = canvas && canvas.getContext ? canvas.getContext('2d') : null;
    var api = { ok: !!ctx, markers: [], focus: function () {}, setMarkers: function (m) { api.markers = m || []; }, orbitPos: function () { return null; } };
    if (!ctx) return api;
    if (!TEX) TEX = buildTexture();
    // An orbit can be given by where the craft was at one moment (startLat, startLon at t0, heading east):
    // the plane is worked out here. It is a drawing of a plausible path, not live tracking.
    if (o.orbit && o.orbit.startLat != null) {
      var ob = o.orbit, ii = ob.incl * D2R, sl0 = Math.sin(ob.startLat * D2R) / Math.sin(ii);
      var u0 = Math.asin(clamp(sl0, -1, 1)), rel = Math.atan2(Math.cos(ii) * Math.sin(u0), Math.cos(u0)) / D2R;
      ob.u0 = u0; ob.raan = ob.startLon - rel + gmstDeg(ob.t0);
    }
    var W = 0, img = null, R = 0, cx = 0, cy = 0;
    var lon0 = o.lon != null ? o.lon : -40, lat0 = o.lat != null ? o.lat : 18, spin = o.spin != null ? o.spin : 4;
    var drag = null, idleUntil = 0, target = null, hits = [], hover = null, lastT = 0, lastDraw = 0;
    var clock = o.clock || function () { return Date.now(); };
    api.markers = o.markers || [];

    function fit() {
      var cw = canvas.clientWidth || 420, dpr = Math.min(window.devicePixelRatio || 1, 1.25);
      var w = Math.max(200, Math.min(640, Math.round(cw * dpr)));
      if (w !== W) { W = w; canvas.width = W; canvas.height = W; img = ctx.createImageData(W, W); }
      R = W * (o.orbit ? 0.40 : 0.44); cx = W / 2; cy = W / 2;
    }
    fit();
    window.addEventListener('resize', fit);

    function toView(v) {
      var cl = Math.cos(lon0 * D2R), sl = Math.sin(lon0 * D2R), cp = Math.cos(lat0 * D2R), sp = Math.sin(lat0 * D2R);
      var x1 = v[0] * cl - v[2] * sl, z1 = v[0] * sl + v[2] * cl, y1 = v[1];
      return [x1, y1 * cp - z1 * sp, y1 * sp + z1 * cp];
    }
    function screen(vv, scale) { scale = scale || 1; return [cx + vv[0] * R * scale, cy - vv[1] * R * scale]; }

    function orbitECEF(t, u) {
      var ob = o.orbit, i = ob.incl * D2R, Om = ob.raan * D2R;
      var x = Math.cos(Om) * Math.cos(u) - Math.sin(Om) * Math.sin(u) * Math.cos(i);
      var y = Math.sin(Om) * Math.cos(u) + Math.cos(Om) * Math.sin(u) * Math.cos(i);
      var z = Math.sin(u) * Math.sin(i);
      var th = gmstDeg(t) * D2R, xe = x * Math.cos(th) + y * Math.sin(th), ye = -x * Math.sin(th) + y * Math.cos(th);
      return [ye, z, xe];
    }
    function shipU(t) { var ob = o.orbit; return ob.u0 + 2 * Math.PI * (t - ob.t0) / ob.period; }
    api.orbitPos = function (t) {
      if (!o.orbit) return null;
      var v = orbitECEF(t, shipU(t));
      return { lat: Math.asin(v[1]) / D2R, lon: Math.atan2(v[0], v[2]) / D2R };
    };
    api.focus = function (lat, lon) { target = [lat, lon]; idleUntil = performance.now() + 9000; };

    function draw(ts) {
      var dt = lastT ? Math.min(100, ts - lastT) : 16; lastT = ts;
      if (target) {
        var dl = ((target[1] - lon0 + 540) % 360) - 180, dp = target[0] - lat0;
        lon0 += dl * 0.08; lat0 += dp * 0.08;
        if (Math.abs(dl) < 0.2 && Math.abs(dp) < 0.2) target = null;
      } else if (!drag && ts > idleUntil) { lon0 += spin * dt / 1000; }
      lon0 = ((lon0 + 540) % 360) - 180; lat0 = clamp(lat0, -70, 70);
      if (ts - lastDraw < 33) { requestAnimationFrame(draw); return; }
      lastDraw = ts;
      var now = clock();
      var S = sunVector(Date.now()), Sv = toView(S);
      var hx = Sv[0], hy = Sv[1], hz = Sv[2] + 1, hl = Math.sqrt(hx * hx + hy * hy + hz * hz); hx /= hl; hy /= hl; hz /= hl;
      var cl = Math.cos(lon0 * D2R), sl = Math.sin(lon0 * D2R), cp = Math.cos(lat0 * D2R), sp = Math.sin(lat0 * D2R);
      var data = img.data, invR = 1 / R, x0 = Math.max(0, Math.floor(cx - R - 1)), x1 = Math.min(W, Math.ceil(cx + R + 1));
      data.fill(0);
      for (var py = Math.max(0, Math.floor(cy - R - 1)); py < Math.min(W, Math.ceil(cy + R + 1)); py++) {
        var ny = -(py + 0.5 - cy) * invR, ny2 = ny * ny;
        for (var px = x0; px < x1; px++) {
          var nx = (px + 0.5 - cx) * invR, r2 = nx * nx + ny2;
          if (r2 > 1) continue;
          var z = Math.sqrt(1 - r2);
          var y1 = ny * cp + z * sp, z1 = -ny * sp + z * cp;
          var X = nx * cl + z1 * sl, Z = -nx * sl + z1 * cl, Y = y1;
          var lat = Math.asin(Y > 1 ? 1 : Y < -1 ? -1 : Y), lon = Math.atan2(X, Z);
          var tx = ((lon / (2 * Math.PI) + 0.5) * TW) | 0, ty = ((0.5 - lat / Math.PI) * TH) | 0;
          if (tx >= TW) tx = TW - 1; if (ty >= TH) ty = TH - 1; if (ty < 0) ty = 0;
          var k = (ty * TW + tx) * 4, cr = TEX[k], cg = TEX[k + 1], cb = TEX[k + 2], isLand = TEX[k + 3];
          var d = X * S[0] + Y * S[1] + Z * S[2];
          var day = d < -0.1 ? 0 : d > 0.12 ? 1 : (d + 0.1) / 0.22; day = day * day * (3 - 2 * day);
          var lit = 0.30 + 0.85 * Math.sqrt(d > 0 ? d : 0);
          var r = cr * lit, g = cg * lit, b = cb * lit;
          if (!isLand) {
            var sdot = nx * hx + ny * hy + z * hz; if (sdot > 0) { var sp2 = Math.pow(sdot, 90) * 70; r += sp2; g += sp2; b += sp2 * 0.9; }
          }
          var nr = cr * 0.07 + 3, ng = cg * 0.07 + 5, nb = cb * 0.09 + 14;
          r = nr + (r - nr) * day; g = ng + (g - ng) * day; b = nb + (b - nb) * day;
          var rim = (1 - z); rim = rim * rim * rim;
          var atm = 0.25 + 0.75 * day;
          r += 45 * rim * atm; g += 85 * rim * atm; b += 160 * rim * atm;
          var edge = (1 - Math.sqrt(r2)) * R; edge = edge > 1 ? 1 : edge;
          var q = (py * W + px) * 4;
          data[q] = r; data[q + 1] = g; data[q + 2] = b; data[q + 3] = 255 * edge;
        }
      }
      ctx.clearRect(0, 0, W, W);
      ctx.putImageData(img, 0, 0);

      // atmosphere glow behind the planet
      ctx.save(); ctx.globalCompositeOperation = 'destination-over';
      var gr = ctx.createRadialGradient(cx, cy, R * 0.98, cx, cy, R * 1.09);
      gr.addColorStop(0, 'rgba(110,170,255,0.38)'); gr.addColorStop(1, 'rgba(110,170,255,0)');
      ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(cx, cy, R * 1.09, 0, 2 * Math.PI); ctx.fill(); ctx.restore();

      // city lights on the night side
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (var c = 0; c < CITIES.length; c++) {
        var cv = vec(CITIES[c][0], CITIES[c][1]), dd = cv[0] * S[0] + cv[1] * S[1] + cv[2] * S[2];
        if (dd > 0.02) continue;
        var vv = toView(cv); if (vv[2] < 0.08) continue;
        var night = clamp((0.02 - dd) / 0.15, 0, 1) * CITIES[c][2] * vv[2];
        var p = screen(vv), rad = (1.2 + 2.4 * CITIES[c][2]) * (W / 420);
        var lg = ctx.createRadialGradient(p[0], p[1], 0, p[0], p[1], rad * 2.2);
        lg.addColorStop(0, 'rgba(255,214,140,' + (0.95 * night) + ')'); lg.addColorStop(0.35, 'rgba(255,170,70,' + (0.45 * night) + ')'); lg.addColorStop(1, 'rgba(255,150,40,0)');
        ctx.fillStyle = lg; ctx.beginPath(); ctx.arc(p[0], p[1], rad * 2.2, 0, 2 * Math.PI); ctx.fill();
      }
      ctx.restore();

      // story markers with pulse rings
      hits = [];
      var phase = (ts % 2400) / 2400;
      api.markers.forEach(function (m, idx) {
        var vv = toView(vec(m.lat, m.lon)); if (vv[2] < 0.05) return;
        var p = screen(vv), s = W / 420, fade = clamp(vv[2] * 2, 0, 1);
        var ph = (phase + idx * 0.13) % 1;
        ctx.globalAlpha = fade * (1 - ph);
        ctx.strokeStyle = m.color || '#ffb300'; ctx.lineWidth = 2 * s;
        ctx.beginPath(); ctx.arc(p[0], p[1], (4 + ph * 16 * (m.heat || 1)) * s, 0, 2 * Math.PI); ctx.stroke();
        ctx.globalAlpha = fade;
        ctx.fillStyle = m.color || '#ffb300'; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5 * s;
        ctx.beginPath(); ctx.arc(p[0], p[1], (hover === m ? 6.5 : 4.5) * s, 0, 2 * Math.PI); ctx.fill(); ctx.stroke();
        if (hover === m || m.label) {
          var txt = hover === m ? m.title : m.label;
          if (txt) {
            ctx.font = '600 ' + Math.round(11.5 * s) + 'px Segoe UI, Arial, sans-serif';
            var tw = ctx.measureText(txt).width;
            var lx = p[0] + 9 * s; if (lx + tw + 10 * s > W) lx = p[0] - 9 * s - tw - 10 * s;
            ctx.fillStyle = 'rgba(8,20,40,0.82)'; ctx.fillRect(lx, p[1] - 9 * s, tw + 10 * s, 18 * s);
            ctx.fillStyle = '#ffffff'; ctx.fillText(txt, lx + 5 * s, p[1] + 4 * s);
          }
        }
        ctx.globalAlpha = 1;
        hits.push({ m: m, x: p[0], y: p[1] });
      });

      // optional spacecraft and its orbit
      if (o.orbit && (o.orbit.showUntil == null || now < o.orbit.showUntil) && now > o.orbit.t0) {
        var u = shipU(now), alt = 1 + (o.orbit.drawAlt || 0.12);
        ctx.lineWidth = 1.6 * (W / 420);
        for (var j = 0; j < 160; j++) {
          var ua = u + j / 160 * 2 * Math.PI, ub = u + (j + 1) / 160 * 2 * Math.PI;
          var va = toView(orbitECEF(now, ua)), vb = toView(orbitECEF(now, ub));
          var hidden = (va[2] < 0 && (va[0] * va[0] + va[1] * va[1]) * alt * alt < 1);
          if (hidden) continue;
          var a1 = screen(va, alt), b1 = screen(vb, alt);
          ctx.strokeStyle = 'rgba(255,179,0,' + (0.85 - 0.6 * j / 160) + ')';
          ctx.beginPath(); ctx.moveTo(a1[0], a1[1]); ctx.lineTo(b1[0], b1[1]); ctx.stroke();
        }
        var sv = toView(orbitECEF(now, u)), behind = sv[2] < 0 && (sv[0] * sv[0] + sv[1] * sv[1]) * alt * alt < 1;
        var spt = screen(sv, alt), s2 = W / 420;
        ctx.globalAlpha = behind ? 0.25 : 1;
        var pg = ctx.createRadialGradient(spt[0], spt[1], 0, spt[0], spt[1], 16 * s2);
        pg.addColorStop(0, 'rgba(255,200,60,0.9)'); pg.addColorStop(1, 'rgba(255,200,60,0)');
        ctx.fillStyle = pg; ctx.beginPath(); ctx.arc(spt[0], spt[1], 16 * s2, 0, 2 * Math.PI); ctx.fill();
        ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(spt[0], spt[1], 3.2 * s2, 0, 2 * Math.PI); ctx.fill();
        if (o.orbit.label) {
          ctx.font = '700 ' + Math.round(12 * s2) + 'px Segoe UI, Arial, sans-serif'; ctx.fillStyle = '#ffd36b';
          var lw = ctx.measureText(o.orbit.label).width, lx2 = spt[0] + 12 * s2; if (lx2 + lw > W - 2) lx2 = spt[0] - 12 * s2 - lw;
          ctx.fillText(o.orbit.label, lx2, spt[1] - 8 * s2);
        }
        ctx.globalAlpha = 1;
      }
      requestAnimationFrame(draw);
    }
    requestAnimationFrame(draw);

    function pos(e) { var r = canvas.getBoundingClientRect(); return [(e.clientX - r.left) * W / r.width, (e.clientY - r.top) * W / r.height]; }
    function pick(p) {
      var best = null, bd = 14 * W / 420;
      hits.forEach(function (h) { var d = Math.hypot(h.x - p[0], h.y - p[1]); if (d < bd) { bd = d; best = h.m; } });
      return best;
    }
    canvas.style.touchAction = 'none';
    canvas.addEventListener('pointerdown', function (e) { drag = { x: e.clientX, y: e.clientY, lon: lon0, lat: lat0, moved: false }; target = null; try { canvas.setPointerCapture(e.pointerId); } catch (x) {} });
    canvas.addEventListener('pointermove', function (e) {
      if (drag) {
        var dx = e.clientX - drag.x, dy = e.clientY - drag.y, k = 180 / (canvas.getBoundingClientRect().width || 400);
        if (Math.abs(dx) + Math.abs(dy) > 3) drag.moved = true;
        lon0 = drag.lon - dx * k; lat0 = clamp(drag.lat + dy * k, -70, 70);
      } else {
        hover = pick(pos(e)); canvas.style.cursor = hover ? 'pointer' : 'grab';
      }
    });
    canvas.addEventListener('pointerup', function (e) {
      if (drag && !drag.moved) { var m = pick(pos(e)); if (m && o.onPick) o.onPick(m); }
      drag = null; idleUntil = performance.now() + 5000;
    });
    canvas.addEventListener('pointerleave', function () { hover = null; });
    return api;
  };
})();
