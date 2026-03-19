import { useEffect, useRef } from 'react'

export default function ZoniteBackground() {
  const cvRef = useRef(null)

  useEffect(() => {
    const cv = cvRef.current
    if (!cv) return
    const ct = cv.getContext('2d')
    let W, H, frame = 0, animId

    function resize() {
      const dpr = window.devicePixelRatio || 1
      W = cv.offsetWidth
      H = cv.offsetHeight
      cv.width = W * dpr
      cv.height = H * dpr
      ct.setTransform(dpr, 0, 0, dpr, 0, 0)
      makeBuildings()
    }

    const C = {
      orange: '#f5a623',
      green: '#22c55e',
      white: 'rgba(255,255,255,0.9)',
    }

    const stars = Array.from({ length: 120 }, () => ({
      x: Math.random(), y: Math.random() * 0.55,
      r: Math.random() * 1.4 + 0.2,
      p: Math.random() * 300
    }))

    let buildings = []
    function makeBuildings() {
      buildings = []
      const defs = [
        { rx: .02, rw: .07, rh: .52, f: 6 },
        { rx: .10, rw: .05, rh: .32, f: 3 },
        { rx: .16, rw: .09, rh: .60, f: 7 },
        { rx: .26, rw: .06, rh: .38, f: 4 },
        { rx: .33, rw: .10, rh: .68, f: 8 },
        { rx: .44, rw: .05, rh: .28, f: 3 },
        { rx: .50, rw: .09, rh: .55, f: 6 },
        { rx: .60, rw: .07, rh: .44, f: 5 },
        { rx: .68, rw: .10, rh: .70, f: 8 },
        { rx: .79, rw: .06, rh: .36, f: 4 },
        { rx: .86, rw: .08, rh: .50, f: 6 },
        { rx: .95, rw: .05, rh: .30, f: 3 },
      ]
      const cols = ['#151e6e', '#1a2580', '#0f1660', '#1b2878', '#13196a']
      defs.forEach((d, i) => {
        const bx = d.rx * W
        const bw = d.rw * W
        const bh = d.rh * (H * 0.62)
        const by = H * 0.72 - bh
        const wins = []
        const ww = Math.max(7, bw * 0.22)
        const wh = Math.max(8, ww * 1.1)
        const cols2 = Math.max(1, Math.floor((bw - 8) / (ww + 5)))
        for (let r = 0; r < d.f; r++) {
          for (let c = 0; c < cols2; c++) {
            wins.push({
              x: bx + 4 + c * (bw - 8) / Math.max(1, cols2 - 0.3),
              y: by + 10 + r * (bh - 10) / d.f,
              w: ww, h: wh,
              on: Math.random() > .25,
              p: Math.random() * 500
            })
          }
        }
        buildings.push({ x: bx, y: by, w: bw, h: bh, f: d.f, col: cols[i % cols.length], wins })
      })
    }

    const nodes = [
      { rx: .08, name: 'Akwa · Douala' },
      { rx: .24, name: 'Bonamoussadi' },
      { rx: .42, name: 'Bastos · Yaoundé' },
      { rx: .60, name: 'Bépanda' },
      { rx: .76, name: 'Bonaberi' },
      { rx: .91, name: 'Makepe' },
    ]

    const motos = []
    let mId = 0, lastSpawn = 0, lastToast = 0

    function spawnMoto() {
      const fi = Math.floor(Math.random() * nodes.length)
      let ti = Math.floor(Math.random() * nodes.length)
      while (ti === fi) ti = Math.floor(Math.random() * nodes.length)
      const fx = nodes[fi].rx * W
      const tx = nodes[ti].rx * W
      const dir = tx > fx ? 1 : -1
      const comm = Math.floor(800 + Math.random() * 7200)
      motos.push({
        id: mId++, x: fx, y: H * .72 - 14, tx, dir,
        spd: (2 + Math.random() * 1.5) * dir,
        pkg: true, done: false, comm, commShow: false,
        commA: 0, commY: 0, bobPhase: Math.random() * Math.PI * 2
      })
    }

    const particles = []
    function spawnParticles(x, y, color) {
      for (let i = 0; i < 8; i++) {
        const a = Math.random() * Math.PI * 2
        const spd = 1 + Math.random() * 3
        particles.push({ x, y, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd - 2, r: 2 + Math.random() * 3, color, alpha: 1, life: 60 })
      }
    }

    const toasts = []
    const toastMsgs = [
      ['🛒', 'Commande reçue'], ['✅', 'Livraison OK!'], ['💰', 'Commission créditée'],
      ['📦', 'Colis en route'], ['🎉', 'Vendeur notifié'], ['📱', 'Nouvelle vente!'],
      ['🚀', 'Stock mis à jour'], ['⭐', 'Top vendeur!'],
    ]
    function spawnToast(x, y) {
      const m = toastMsgs[Math.floor(Math.random() * toastMsgs.length)]
      toasts.push({ x: Math.min(x, W - 150), y, icon: m[0], msg: m[1], alpha: 1, vy: -0.7 })
    }

    function rr(x, y, w, h, r, fill, stroke, sw) {
      ct.beginPath()
      if (ct.roundRect) ct.roundRect(x, y, w, h, r)
      else ct.rect(x, y, w, h)
      if (fill) { ct.fillStyle = fill; ct.fill() }
      if (stroke) { ct.strokeStyle = stroke; ct.lineWidth = sw || 1; ct.stroke() }
    }

    function drawSky() {
      const grd = ct.createLinearGradient(0, 0, 0, H * .75)
      grd.addColorStop(0, '#04061a')
      grd.addColorStop(.5, '#070b28')
      grd.addColorStop(1, '#0d1240')
      ct.fillStyle = grd
      ct.fillRect(0, 0, W, H * .75)
    }

    function drawStars() {
      stars.forEach(s => {
        const a = .3 + .5 * Math.sin(frame * .015 + s.p)
        ct.beginPath()
        ct.arc(s.x * W, s.y * H, s.r, 0, Math.PI * 2)
        ct.fillStyle = `rgba(255,255,255,${a})`
        ct.fill()
      })
      const mx = W * .85, my = H * .09
      ct.beginPath(); ct.arc(mx, my, 28, 0, Math.PI * 2)
      ct.fillStyle = 'rgba(255,240,150,.05)'; ct.fill()
      ct.beginPath(); ct.arc(mx, my, 22, 0, Math.PI * 2)
      ct.fillStyle = 'rgba(255,240,160,.18)'; ct.fill()
      ct.beginPath(); ct.arc(mx + 5, my - 4, 22, 0, Math.PI * 2)
      ct.fillStyle = '#04061a'; ct.fill()
    }

    function drawBuildings() {
      buildings.forEach(b => {
        ct.fillStyle = 'rgba(0,0,0,0.4)'
        ct.fillRect(b.x + 5, b.y + 5, b.w, b.h)
        ct.fillStyle = b.col
        ct.fillRect(b.x, b.y, b.w, b.h)
        b.wins.forEach(wn => {
          const flicker = Math.sin(frame * .015 + wn.p) > .97
          if (flicker) wn.on = !wn.on
          if (wn.on) {
            ct.fillStyle = 'rgba(255,220,100,0.85)'
            ct.shadowColor = 'rgba(255,210,80,.5)'; ct.shadowBlur = 7
            ct.fillRect(wn.x, wn.y, wn.w, wn.h)
            ct.shadowBlur = 0
          } else {
            ct.fillStyle = 'rgba(255,255,255,0.05)'
            ct.fillRect(wn.x, wn.y, wn.w, wn.h)
          }
        })
        const blink = Math.sin(frame * .05 + b.x * .1) > 0
        ct.beginPath(); ct.arc(b.x + b.w / 2, b.y, 3, 0, Math.PI * 2)
        ct.fillStyle = blink ? 'rgba(255,60,60,.9)' : 'rgba(255,60,60,.15)'
        ct.shadowColor = 'rgba(255,60,60,.7)'; ct.shadowBlur = blink ? 10 : 0
        ct.fill(); ct.shadowBlur = 0
      })
    }

    function drawGround() {
      ct.fillStyle = '#0d1240'; ct.fillRect(0, H * .72, W, H * .28)
      ct.fillStyle = '#141850'; ct.fillRect(0, H * .75, W, H * .16)
      ct.strokeStyle = 'rgba(245,166,35,0.2)'; ct.lineWidth = 2
      ct.setLineDash([18, 14]); ct.beginPath()
      ct.moveTo(0, H * .83); ct.lineTo(W, H * .83); ct.stroke()
      ct.setLineDash([])
      ct.fillStyle = '#0f1445'; ct.fillRect(0, H * .91, W, H * .09)
    }

    function drawNodes() {
      nodes.forEach(n => {
        const x = n.rx * W, y = H * .72, s = 32
        rr(x - s * .55, y - s * .75, s * 1.1, s * .75, 3, '#1a2880', 'rgba(245,166,35,.35)')
        ct.beginPath()
        ct.moveTo(x - s * .7, y - s * .75); ct.lineTo(x, y - s * 1.35); ct.lineTo(x + s * .7, y - s * .75)
        ct.closePath(); ct.fillStyle = '#1d3da8'; ct.strokeStyle = 'rgba(245,166,35,.4)'; ct.lineWidth = 1
        ct.fill(); ct.stroke()
        ct.fillStyle = 'rgba(245,166,35,.45)'
        rr(x - 7, y - s * .3, 14, s * .3, 2, 'rgba(245,166,35,.45)')
        const glow = Math.sin(frame * .02 + n.rx * 8) > .3
        ct.shadowColor = 'rgba(255,210,80,.5)'; ct.shadowBlur = glow ? 10 : 0
        rr(x - s * .4, y - s * .6, s * .26, s * .22, 2, glow ? 'rgba(255,220,100,0.85)' : 'rgba(255,255,255,.06)')
        rr(x + s * .14, y - s * .6, s * .26, s * .22, 2, glow ? 'rgba(255,220,100,0.85)' : 'rgba(255,255,255,.06)')
        ct.shadowBlur = 0
        ct.font = '500 9px sans-serif'; ct.fillStyle = 'rgba(245,166,35,.8)'; ct.textAlign = 'center'
        ct.fillText(n.name, x, y + 14)
      })
    }

    function drawMoto(m) {
      const x = m.x, bob = Math.sin(frame * .18 + m.bobPhase) * 1.5, y = m.y + bob, d = m.dir
      ct.save(); ct.translate(x, y); if (d < 0) ct.scale(-1, 1)
      // wheels
      ct.beginPath(); ct.arc(-11, 7, 7, 0, Math.PI * 2); ct.fillStyle = '#1a1a2e'; ct.fill()
      ct.strokeStyle = 'rgba(245,166,35,.8)'; ct.lineWidth = 2; ct.stroke()
      ct.beginPath(); ct.arc(-11, 7, 3, 0, Math.PI * 2); ct.fillStyle = C.orange; ct.fill()
      ct.beginPath(); ct.arc(11, 7, 7, 0, Math.PI * 2); ct.fillStyle = '#1a1a2e'; ct.fill()
      ct.strokeStyle = 'rgba(245,166,35,.8)'; ct.lineWidth = 2; ct.stroke()
      ct.beginPath(); ct.arc(11, 7, 3, 0, Math.PI * 2); ct.fillStyle = C.orange; ct.fill()
      // body
      ct.fillStyle = C.orange; ct.beginPath()
      ct.moveTo(-14, 2); ct.lineTo(16, 2); ct.lineTo(14, -5); ct.lineTo(-10, -5); ct.closePath(); ct.fill()
      ct.strokeStyle = 'rgba(245,166,35,.8)'; ct.lineWidth = 2
      ct.beginPath(); ct.moveTo(8, -5); ct.lineTo(14, -9); ct.stroke()
      // rider
      rr(2, -20, 11, 15, 3, '#1a2d8a')
      ct.beginPath(); ct.arc(7, -22, 7, 0, Math.PI * 2); ct.fillStyle = C.orange; ct.fill()
      ct.beginPath(); ct.arc(7, -22, 7, Math.PI, Math.PI * 2); ct.fillStyle = '#0a0e2e'; ct.fill()
      ct.fillStyle = 'rgba(100,200,255,.3)'; ct.beginPath()
      ct.arc(7, -22, 5, Math.PI + .3, Math.PI * 2 - .3); ct.fill()
      // package
      if (m.pkg) {
        rr(-22, -14, 13, 13, 2, 'rgba(245,166,35,.9)', 'rgba(255,255,255,.3)', 1)
        ct.font = '8px sans-serif'; ct.textAlign = 'center'; ct.fillStyle = '#0a0e2e'
        ct.fillText('Z', -15, -7)
      }
      ct.restore()
      // commission popup
      if (m.commShow && m.commA > 0) {
        ct.save(); ct.globalAlpha = m.commA
        const label = `+${m.comm.toLocaleString('fr-FR')} F`
        const tw = ct.measureText(label).width
        rr(x - tw / 2 - 10, m.commY - 18, tw + 20, 24, 12, 'rgba(10,20,60,.9)', 'rgba(34,197,94,.6)', 1)
        ct.font = '500 13px sans-serif'; ct.fillStyle = C.green; ct.textAlign = 'center'
        ct.shadowColor = C.green; ct.shadowBlur = 8
        ct.fillText(label, x, m.commY); ct.shadowBlur = 0
        ct.font = '10px sans-serif'; ct.fillStyle = 'rgba(255,255,255,.7)'
        ct.fillText('Commission créditée ✓', x, m.commY + 14)
        ct.restore()
      }
    }

    function drawToasts() {
      toasts.forEach(t => {
        if (t.alpha <= 0) return
        ct.save(); ct.globalAlpha = t.alpha
        const label = t.icon + ' ' + t.msg
        ct.font = '500 11px sans-serif'
        const tw = ct.measureText(label).width
        rr(t.x, t.y - 16, tw + 20, 22, 11, 'rgba(15,22,72,.95)', 'rgba(245,166,35,.4)', 1)
        ct.fillStyle = C.white; ct.textAlign = 'left'
        ct.fillText(label, t.x + 10, t.y)
        ct.restore()
        t.y += t.vy; t.alpha -= .009
      })
    }

    function drawParticles() {
      particles.forEach(p => {
        ct.save(); ct.globalAlpha = p.alpha
        ct.beginPath(); ct.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ct.fillStyle = p.color; ct.fill(); ct.restore()
        p.x += p.vx; p.y += p.vy; p.vy += .12; p.alpha -= 1 / p.life
      })
    }

    function drawHUD() {
      const bargrd = ct.createLinearGradient(0, 0, 0, 52)
      bargrd.addColorStop(0, 'rgba(5,8,35,.95)'); bargrd.addColorStop(1, 'rgba(5,8,35,0)')
      ct.fillStyle = bargrd; ct.fillRect(0, 0, W, 52)
      ct.font = '700 18px sans-serif'; ct.fillStyle = C.orange; ct.textAlign = 'left'
      ct.shadowColor = C.orange; ct.shadowBlur = 12
      ct.fillText('ZONITE', 16, 28); ct.shadowBlur = 0
      ct.font = '400 18px sans-serif'; ct.fillStyle = 'rgba(255,255,255,.5)'
      ct.fillText(' MARKET', 16 + ct.measureText('ZONITE').width, 28)
      ct.font = '400 10px sans-serif'; ct.fillStyle = 'rgba(255,255,255,.3)'
      ct.fillText('Livraisons express · Cameroun', 16, 42)
      rr(W - 145, 10, 130, 32, 16, 'rgba(34,197,94,.12)', 'rgba(34,197,94,.35)', 1)
      ct.font = '500 10px sans-serif'; ct.fillStyle = C.green; ct.textAlign = 'right'
      ct.fillText('● LIVRAISONS EN DIRECT', W - 16, 27)
      const deliveries = 1247 + Math.floor(frame * .15)
      ct.font = '500 11px sans-serif'; ct.fillStyle = 'rgba(245,166,35,.9)'
      ct.fillText(`${deliveries.toLocaleString('fr-FR')} livraisons`, W - 16, H - 32)
      ct.font = '400 10px sans-serif'; ct.fillStyle = 'rgba(255,255,255,.3)'
      ct.fillText(`${(deliveries * 3200).toLocaleString('fr-FR')} FCFA générés aujourd'hui`, W - 16, H - 18)
      ct.textAlign = 'left'
    }

    let hidden = false
    function onVisChange() { hidden = document.hidden }
    document.addEventListener('visibilitychange', onVisChange)

    function loop() {
      if (hidden) { animId = requestAnimationFrame(loop); return }
      frame++
      ct.clearRect(0, 0, W, H)
      drawSky(); drawStars(); drawBuildings(); drawGround(); drawNodes()
      motos.forEach(m => {
        if (m.done) return
        m.x += m.spd
        const hit = (m.dir > 0 && m.x >= m.tx) || (m.dir < 0 && m.x <= m.tx)
        if (hit && !m.commShow) {
          m.x = m.tx; m.pkg = false; m.commShow = true; m.commA = 1; m.commY = m.y - 50
          spawnParticles(m.x, m.y - 20, C.green); spawnParticles(m.x, m.y - 20, C.orange)
          if (frame - lastToast > 40) { spawnToast(Math.max(8, m.x - 60), m.y - 80); lastToast = frame }
        }
        if (m.commShow) { m.commA -= .01; m.commY -= .4; if (m.commA <= 0) m.done = true }
        drawMoto(m)
      })
      while (motos.length > 10 && motos[0].done) motos.shift()
      drawParticles(); drawToasts(); drawHUD()
      const active = motos.filter(m => !m.done).length
      if (frame - lastSpawn > 70 && active < 5) { spawnMoto(); lastSpawn = frame }
      if (active < 2) spawnMoto()
      for (let i = particles.length - 1; i >= 0; i--) { if (particles[i].alpha <= 0) particles.splice(i, 1) }
      for (let i = toasts.length - 1; i >= 0; i--) { if (toasts[i].alpha <= 0) toasts.splice(i, 1) }
      animId = requestAnimationFrame(loop)
    }

    resize()
    spawnMoto(); spawnMoto(); spawnMoto()
    loop()

    const obs = new ResizeObserver(resize)
    obs.observe(cv)

    return () => {
      cancelAnimationFrame(animId)
      obs.disconnect()
      document.removeEventListener('visibilitychange', onVisChange)
    }
  }, [])

  return (
    <canvas
      ref={cvRef}
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 0 }}
    />
  )
}
