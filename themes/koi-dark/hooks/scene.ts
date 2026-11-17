// Koi on black. Each koi is a chain of dots that share one looping route:
// the head leads and every dot behind it runs the same route two cells
// later, so the body bends wherever the head went. A dot is drawn as a small
// disc of cells, wide at the shoulders and narrow at the tail. CSS
// `offset-path` with `steps()` snaps every dot onto the grid; the scene runs
// no script, which the sandboxed frame would refuse anyway.
//
// Two things make it swim. The route itself weaves from side to side, so the
// whole body snakes through the bends the head made. And the back half beats:
// each dot there slides across the body, further the nearer the tail, a
// moment after the dot ahead of it.
//
// Now and then a koi brightens as if it came up to a surface, and the cells
// of the grid lift in a ring that spreads from where its head was.
//
// Everything is drawn as bars a cell thick on whole cells, and the grid is
// laid over the top in black, so its lines cut every shape into cells and
// vanish against the background.
//
// The scene is drawn for a moment `t` seconds along: every animation starts
// as far into its loop as it would be by then. Drawing it again for a later
// moment therefore carries on where the last drawing was, which lets the
// frame be replaced without the koi jumping back to the start.

const CELL = 3
const COLS = 534
const ROWS = 337

// Routes are written on a coarser grid, this many cells to the unit.
const UNIT = 16 / 3

// Cells along the route from one dot to the next.
const GAP = 2

// w white, r red, k ink, x grey, g gold, y pale gold, o orange, e ember,
// f fin, s shade.
type Colour = 'w' | 'r' | 'k' | 'x' | 'g' | 'y' | 'o' | 'e' | 'f' | 's'

type Cell = [x: number, y: number]

type Kind = {
  // Radius of each dot of the body in cells, head first.
  radii: number[]
  // The tail fan: for each dot after the body, how far out its two lobes sit
  // and their radius.
  fan: Array<[number, number]>
  // How many cells each dot slides sideways at the height of a tail beat.
  beat: number[]
  // The dot the eyes ride on and how far from the middle they sit.
  eyes: [number, number]
  // Fins: the dot each pair rides on, how far out it starts, how long it is.
  fins: Array<[number, number, number]>
  // The weave of a route: cells to either side, and cells from crest to crest.
  weave: { reach: number; length: number }
  // How many times in one lap of its route the koi comes up to the surface.
  rises: number
  // Seconds for one tail beat.
  period: number
  glow: number
}

const ADULT: Kind = {
  radii: [1.5, 2.5, 3.5, 4, 4.5, 5, 5.5, 5.5, 5.5, 5.5, 5, 5, 4.5, 4, 3.5, 3, 2.5, 2, 1.5, 1.5, 1, 1, 1],
  fan: [[1, 1.5], [2, 2], [4, 2]],
  beat: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 2, 2, 2, 3, 3, 3, 4, 4, 4, 4, 4, 4],
  eyes: [2, 3],
  fins: [[6, 6, 4], [13, 5, 2]],
  weave: { reach: 4, length: 70 },
  rises: 2,
  period: 1.1,
  glow: 30,
}

const FRY: Kind = {
  radii: [1.5, 2.5, 3, 3, 3, 2.5, 2, 1.5, 1, 1, 1],
  fan: [[1, 1], [2, 1.5]],
  beat: [0, 0, 0, 0, 0, 1, 1, 2, 2, 2, 3, 3, 3],
  eyes: [1, 2],
  fins: [[3, 4, 2]],
  weave: { reach: 2.5, length: 42 },
  rises: 1,
  period: 0.7,
  glow: 18,
}

// Share of a beat each dot waits on the dot ahead.
const BEAT_LAG = 1 / 30

type Route = { cx: number; cy: number; ax: number; ay: number; fx: number; fy: number; px: number; py: number; bx?: number; gx?: number; by?: number; gy?: number }

type Koi = {
  kind: Kind
  base: Colour
  // Stretches of the body in another colour: from dot, to dot, colour.
  bands?: Array<[number, number, Colour]>
  // Markings scattered over the steady front half: colour, how many.
  marks?: Array<[Colour, number]>
  route: Route
  step: number
  phase: number
  glow?: boolean
}

const SHOAL: Koi[] = [
  {
    kind: ADULT,
    base: 'w',
    bands: [[1, 4, 'r'], [8, 11, 'r'], [15, 17, 'r']],
    marks: [['w', 6], ['r', 9], ['s', 8]],
    route: { cx: 50, cy: 31, ax: 40, ay: 22, fx: 1, fy: 2, px: 0, py: 0.6, bx: 5, gx: 3 },
    step: 0.035,
    phase: 0.1,
  },
  {
    kind: ADULT,
    base: 'w',
    bands: [[3, 5, 'r'], [10, 12, 'r']],
    marks: [['k', 10], ['x', 6], ['r', 5], ['s', 6]],
    route: { cx: 48, cy: 30, ax: 36, ay: 24, fx: 2, fy: 1, px: 1.4, py: 0, by: 4, gy: 3 },
    step: 0.04,
    phase: 0.55,
  },
  {
    kind: ADULT,
    base: 'r',
    bands: [[5, 7, 'w'], [13, 15, 'w'], [21, 25, 'w']],
    marks: [['w', 8], ['k', 5], ['s', 8]],
    route: { cx: 52, cy: 32, ax: 44, ay: 20, fx: 3, fy: 2, px: 2.2, py: 0.3 },
    step: 0.037,
    phase: 0.3,
  },
  {
    kind: ADULT,
    base: 'g',
    bands: [[21, 25, 'y']],
    marks: [['y', 12], ['w', 3], ['s', 8]],
    route: { cx: 30, cy: 26, ax: 22, ay: 18, fx: 1, fy: 1, px: 0, py: 1.57, bx: 6, gx: 2, by: 5, gy: 3 },
    step: 0.042,
    phase: 0.7,
  },
  {
    kind: ADULT,
    base: 'o',
    bands: [[21, 25, 'e']],
    marks: [['e', 9], ['y', 4], ['s', 6]],
    route: { cx: 70, cy: 30, ax: 24, ay: 22, fx: 1, fy: 1, px: 1.57, py: 0, bx: 5, gx: 3 },
    step: 0.033,
    phase: 0.2,
    glow: true,
  },
  {
    kind: ADULT,
    base: 'w',
    bands: [[0, 2, 'r']],
    marks: [['r', 4], ['x', 8], ['s', 8]],
    route: { cx: 50, cy: 34, ax: 42, ay: 18, fx: 1, fy: 3, px: 3.1, py: 1 },
    step: 0.044,
    phase: 0.85,
  },
  {
    kind: FRY,
    base: 'w',
    bands: [[0, 1, 'r'], [4, 5, 'r']],
    marks: [['r', 2], ['s', 3]],
    route: { cx: 22, cy: 46, ax: 14, ay: 10, fx: 2, fy: 3, px: 0.5, py: 0 },
    step: 0.033,
    phase: 0.4,
  },
  {
    kind: FRY,
    base: 'o',
    marks: [['e', 3], ['y', 2]],
    route: { cx: 80, cy: 48, ax: 15, ay: 9, fx: 3, fy: 2, px: 0, py: 0.9 },
    step: 0.03,
    phase: 0.65,
    glow: true,
  },
  {
    kind: FRY,
    base: 'w',
    marks: [['k', 4], ['r', 2], ['s', 3]],
    route: { cx: 76, cy: 14, ax: 16, ay: 8, fx: 2, fy: 1, px: 2, py: 0.4 },
    step: 0.035,
    phase: 0.15,
  },
]

// The same numbers on every load, so nothing scattered moves between reloads.
function dice(seed: number): () => number {
  let a = seed

  return () => {
    a = (a + 0x6d2b79f5) | 0

    let t = Math.imul(a ^ (a >>> 15), 1 | a)

    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t

    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// The loop a route traces, as grid cells in 4-connected order: each step is
// one cell sideways or one cell up or down, so every step is the same length
// and `steps()` lands each dot on a cell.
function trace(r: Route, weave: { reach: number; length: number }): Cell[] {
  const samples = 40000
  const cells: Cell[] = []
  const line: Cell[] = []
  let total = 0

  for (let i = 0; i < samples; i++) {
    const t = (2 * Math.PI * i) / samples
    const x = r.cx + r.ax * Math.sin(r.fx * t + r.px) + (r.bx ?? 0) * Math.sin((r.gx ?? 0) * t)
    const y = r.cy + r.ay * Math.sin(r.fy * t + r.py) + (r.by ?? 0) * Math.sin((r.gy ?? 0) * t)

    line.push([x * UNIT, y * UNIT])
  }

  const at = (i: number): Cell => line[(i + samples) % samples]!

  for (let i = 0; i < samples; i++) {
    total += Math.hypot(at(i + 1)[0] - at(i)[0], at(i + 1)[1] - at(i)[1])
  }

  // A whole number of crests, so the weave meets itself where the loop closes.
  const crests = Math.max(1, Math.round(total / weave.length))

  const push = (x: number, y: number): void => {
    const last = cells[cells.length - 1]

    if (last === undefined) {
      cells.push([x, y])

      return
    }

    let [lx, ly] = last

    while (lx !== x) {
      lx += Math.sign(x - lx)
      cells.push([lx, ly])
    }
    while (ly !== y) {
      ly += Math.sign(y - ly)
      cells.push([lx, ly])
    }
  }

  let travelled = 0

  for (let i = 0; i < samples; i++) {
    const [x, y] = at(i)
    const tx = at(i + 1)[0] - at(i - 1)[0]
    const ty = at(i + 1)[1] - at(i - 1)[1]
    const size = Math.hypot(tx, ty) || 1
    const side = weave.reach * Math.sin((2 * Math.PI * crests * travelled) / total)

    push(Math.floor(x - (ty / size) * side), Math.floor(y + (tx / size) * side))
    travelled += Math.hypot(at(i + 1)[0] - x, at(i + 1)[1] - y)
  }

  const first = cells[0]!

  push(first[0], first[1])
  cells.pop()

  return cells
}

// The loop as a path: one move to the first cell's centre, then runs of
// horizontal and vertical steps back round to it.
function pathOf(cells: Cell[]): string {
  const first = cells[0]!
  let d = `M${first[0] * CELL + CELL / 2},${first[1] * CELL + CELL / 2}`
  let axis = ''
  let run = 0

  const flush = (): void => {
    if (run !== 0) {
      d += `${axis}${run * CELL}`
    }
  }

  for (let i = 0; i < cells.length; i++) {
    const [x0, y0] = cells[i]!
    const [x1, y1] = cells[(i + 1) % cells.length]!
    const [a, n]: [string, number] = x1 !== x0 ? ['h', x1 - x0] : ['v', y1 - y0]

    if (a === axis && Math.sign(n) === Math.sign(run)) {
      run += n
    } else {
      flush()
      axis = a
      run = n
    }
  }
  flush()

  return d
}

// Which way the body lies at each cell of a loop: flat while the koi heads
// mostly sideways, upright while it heads mostly up or down. It changes only
// once the heading has clearly turned, so nothing flicks between the two on
// a diagonal. Whatever sits across the body (a tail beat, eyes, fins) turns
// with it.
function headings(name: string, cells: Cell[]): string {
  const steps = cells.length
  const span = 20
  let upright = false
  let frames = ''
  let last: boolean | undefined

  for (let lap = 0; lap < 2; lap++) {
    for (let i = 0; i < steps; i++) {
      const [x0, y0] = cells[(i - span + steps) % steps]!
      const [x1, y1] = cells[(i + span) % steps]!
      const dx = Math.abs(x1 - x0)
      const dy = Math.abs(y1 - y0)

      if (dy > dx * 1.5) {
        upright = true
      } else if (dx > dy * 1.5) {
        upright = false
      }

      if (lap === 1 && upright !== last) {
        frames += `${((i / steps) * 100).toFixed(2)}%{offset-rotate:${upright ? 90 : 0}deg}`
        last = upright
      }
    }
  }

  return `@keyframes ${name}{${frames}}`
}

// A tail beat of `reach` cells: a sine, held on whole cells.
function beat(reach: number): string {
  const ticks = 24
  let frames = ''
  let last: number | undefined

  for (let i = 0; i < ticks; i++) {
    const cells = Math.round(reach * Math.sin((2 * Math.PI * i) / ticks))

    if (cells !== last) {
      frames += `${((i / ticks) * 100).toFixed(1)}%{transform:translateY(${cells * CELL}px)}`
      last = cells
    }
  }

  return `@keyframes beat${reach}{${frames}}`
}

// Every cell within `radius` of a centre `dx`,`dy` cells off the origin.
function disc(radius: number, dx = 0, dy = 0): Cell[] {
  const reach = Math.floor(radius)
  const cells: Cell[] = []

  for (let y = -reach; y <= reach; y++) {
    for (let x = -reach; x <= reach; x++) {
      if (x * x + y * y <= radius * radius) {
        cells.push([x + dx, y + dy])
      }
    }
  }

  return cells
}

// Cells as one path: a stroke a cell thick along each unbroken run of a row.
// `shift` is where a cell's corner sits against its own position, in cells.
function outline(cells: Cell[], shift: number): string {
  const byRow = new Map<number, Set<number>>()

  for (const [x, y] of cells) {
    byRow.set(y, (byRow.get(y) ?? new Set()).add(x))
  }

  let d = ''

  for (const [y, row] of byRow) {
    const xs = [...row].sort((a, b) => a - b)
    let start = xs[0]!

    xs.forEach((x, n) => {
      if (xs[n + 1] !== x + 1) {
        d += `M${(start + shift) * CELL} ${(y + shift + 0.5) * CELL}h${(x - start + 1) * CELL}`
        start = xs[n + 1] ?? x
      }
    })
  }

  return d
}

const defs = new Map<string, { name: string; markup: string }>()

// A group of cells in one colour, kept once and drawn wherever it is used.
// The centre cell sits squarely on the origin, so `offset-anchor` needs no
// box and a quarter turn leaves a round or mirrored shape looking the same.
function shape(colour: Colour, cells: Cell[]): string {
  const d = outline(cells, -0.5)
  const key = `${colour}${d}`
  const known = defs.get(key)

  if (known !== undefined) {
    return known.name
  }

  const name = `s${defs.size}`

  defs.set(key, { name, markup: `<path id="${name}" class="c${colour}" d="${d}"/>` })

  return name
}

// A start `base` seconds into a loop of `length` seconds, `t` seconds on.
function into(base: number, length: number, t: number): string {
  const at = (((base + t) % length) + length) % length

  return `${-Number(at.toFixed(3))}s`
}

// Both sides of the body at once: the cells and their mirror across it.
const pair = (cells: Cell[]): Cell[] => cells.flatMap(([x, y]): Cell[] => [[x, y], [x, -y]])

const LOOPS = SHOAL.map(koi => trace(koi.route, koi.kind.weave))

function swimmers(t: number): { routes: string; fish: string; rings: string } {
  let routes = ''
  let fish = ''
  let rings = ''

  SHOAL.forEach((koi, i) => {
    const { radii, fan, beat: reaches, period } = koi.kind
    const cells = LOOPS[i]!
    const steps = cells.length
    const length = radii.length + fan.length
    const seconds = (steps * koi.step).toFixed(3)
    const lead = Math.floor(steps * koi.phase) + length * GAP
    // Half a step off the tick, so no dot sits on the edge between two cells.
    const delay = (k: number): string => into((lead - k * GAP + 0.5) * koi.step, steps * koi.step, t)
    const fishFrom = fish.length
    const swim = `swim ${seconds}s steps(${steps},end) infinite`
    const turn = `turn${i} ${seconds}s step-end infinite`

    routes += `.k${i}{offset-path:path("${pathOf(cells)}");animation:${swim};animation-delay:var(--d)}`
    routes += headings(`turn${i}`, cells)
    routes += `.k${i}.t{animation:${swim},${turn};animation-delay:var(--d)}`

    for (const reach of new Set(reaches.filter(n => n > 0))) {
      routes += `.k${i}.b${reach}{animation:${swim},${turn},beat${reach} ${period}s step-end infinite;animation-delay:var(--d),var(--d),var(--w)}`
    }

    const plain = (k: number, id: string): string => `<use href="#${id}" class="k${i}" style="--d:${delay(k)}"/>`
    const turned = (k: number, id: string): string => `<use href="#${id}" class="k${i} t" style="--d:${delay(k)}"/>`

    if (koi.glow === true) {
      fish += `<circle class="k${i} glow" r="${koi.kind.glow}" style="--d:${delay(Math.floor(radii.length / 3))}"/>`
    }

    // Fins lie under the body: a wedge either side, widest against the body.
    for (const [dot, out, long] of koi.kind.fins) {
      const wedge: Cell[] = []

      for (let j = 0; j < long; j++) {
        for (let x = -(long - 1 - j); x <= long - 1 - j; x++) {
          wedge.push([x, out + j])
        }
      }

      fish += turned(dot, shape('f', pair(wedge)))
    }

    // Tail first, so each dot sits under the one ahead of it.
    for (let k = length - 1; k >= 0; k--) {
      const band = (koi.bands ?? []).find(([from, to]) => k >= from && k <= to)
      const lobes = fan[k - radii.length]
      const dot = lobes === undefined ? disc(radii[k]!) : pair(disc(lobes[1], 0, lobes[0]))
      const id = shape(band?.[2] ?? koi.base, dot)
      const reach = reaches[k] ?? 0

      if (reach === 0) {
        fish += plain(k, id)
      } else {
        // The wait grows down the body, so the beat runs from shoulder to tail.
        fish += `<use href="#${id}" class="k${i} b${reach}" style="--d:${delay(k)};--w:${into(-k * BEAT_LAG * period, period, t)}"/>`
      }
    }

    // Markings ride only on the steady front half: a dot that beats moves
    // across the body, and a marking has no way to follow it.
    const steady = reaches.findIndex(n => n > 0)
    const roll = dice(i * 7919 + 13)

    for (const [colour, count] of koi.marks ?? []) {
      for (let n = 0; n < count; n++) {
        const k = 1 + Math.floor(roll() * (steady - 1))
        const room = Math.max(0, radii[k]! - 1.5)
        const size = Math.min(room, [0, 0, 1, 1, 1.5, 2, 2.5][Math.floor(roll() * 7)]!)
        const spread = Math.max(0, room - size)
        const dx = Math.round((roll() * 2 - 1) * spread)
        const dy = Math.round((roll() * 2 - 1) * spread)

        fish += plain(k, shape(colour, disc(size, dx, dy)))
      }
    }

    const [eyeDot, eyeOut] = koi.kind.eyes

    fish += turned(eyeDot, shape('k', pair([[0, eyeOut]])))

    // Coming up. The koi swims a little dimmed. At a few moments in its lap
    // it brightens, a ripple starts where its head is, and it dims again. The
    // moments are picked once, at places well inside the frame, so they look
    // like whim and still repeat each lap.
    const lap = steps * koi.step
    const span = lap / Math.round(lap / RIPPLE_SECONDS)
    const headAt = (lead + 0.5) * koi.step
    const pick = dice(i * 4421 + 99)
    const share = (u: number): string => `${((u / lap) * 100).toFixed(2)}%`
    const moments: number[] = []
    let up = ''

    for (let tries = 0; tries < 600 && moments.length < koi.kind.rises; tries++) {
      const at = Math.floor(pick() * steps)
      const [x, y] = cells[at]!
      const u = at * koi.step
      const inside = x > COLS * 0.16 && x < COLS * 0.84 && y > ROWS * 0.14 && y < ROWS * 0.86

      if (!inside || u < 4 || u > lap - 8 || moments.some(m => Math.abs(m - u) < 14)) {
        continue
      }

      const gate = `gate${i}_${moments.length}`

      moments.push(u)
      routes += `@keyframes ${gate}{${share(u)}{visibility:visible}${share(u + span)}{visibility:hidden}}`
      rings += `<use href="#rip" x="${x * CELL}" y="${y * CELL}" class="rp" style="animation:${gate} ${seconds}s step-end infinite;animation-delay:${delay(0)};--r:${into(headAt - u, span, t)};--p:${span.toFixed(3)}s"/>`
    }

    for (const u of [...moments].sort((a, b) => a - b)) {
      up += `${share(u - 1.4)}{opacity:.8}${share(u - 0.1)},${share(u + 0.9)}{opacity:1}${share(u + 2.6)}{opacity:.8}`
    }

    routes += `@keyframes up${i}{${up}}.s${i}{opacity:.8;animation:up${i} ${seconds}s linear infinite}`
    fish = `${fish.slice(0, fishFrom)}<g class="s${i}" style="animation-delay:${delay(0)}">${fish.slice(fishFrom)}</g>`
  })

  return { routes, fish, rings }
}

// A ripple lifts the cells of the grid: bands of cells, each two cells wider
// than the last, rise one after another from the middle out and fade towards
// the rim. A band is drawn twice. Its top slides up towards the light as it
// rises, then sinks into the black behind the next band. A darker copy stays
// where it stood, so it shows below the top as the side of a raised block.
// Ripples lie over the grid and are cut into cells of their own, since cells
// that have left their places no longer line up with its lines. The bands
// are kept once; each takes its place in the order from its own rule, and a
// ripple only says when its middle band starts.
const BANDS = 11
const BAND_LAG = 0.2
// About how long one ripple takes; each koi's is stretched a little so a
// whole number of them fits its lap, and a ripple can be shown for exactly one.
const RIPPLE_SECONDS = 4

const RIPPLE =
  Array.from({ length: BANDS }, (_, n) => {
    const inner = new Set(disc(n * 2 - 0.5).map(([x, y]) => `${x},${y}`))
    const band = disc(n * 2 + 1.5).filter(([x, y]) => !inner.has(`${x},${y}`))

    return `<path id="b${n}" class="bd" d="${outline(band, 0)}"/>`
  }).join('') +
  `<g id="rip">` +
  Array.from({ length: BANDS }, (_, n) => {
    const part = (layer: string): string => `<use href="#b${n}" class="${layer} q${n}" stroke-opacity="${(1 - n / (BANDS + 2)).toFixed(2)}"/>`

    return part('qs') + part('ql')
  }).join('') +
  '</g>'

const style = (routes: string): string =>
  [
    `path{fill:none;stroke-width:${CELL}px}`,
    '.grid{stroke:#000;stroke-width:.8}',
    '.cw{stroke:#f3ead8}.cr{stroke:#e2472d}.ck{stroke:#2a2826}.cx{stroke:#9a9690}.cg{stroke:#e8bd45}.cy{stroke:#f7e3a0}.co{stroke:#f27a22}.ce{stroke:#d05f22}',
    '.cf{stroke:#f3ead8;opacity:.5}.cs{stroke:#000;opacity:.13}',
    '.glow{fill:url(#warm);opacity:.6}',
    '.bd{stroke-width:2.2px;stroke-dasharray:2.2 .8}',
    `.rp{visibility:hidden}.ql,.qs{opacity:0;animation:${RIPPLE_SECONDS}s ease-in-out infinite;animation-duration:var(--p)}.ql{animation-name:lit}.qs{stroke:#4a4a4a;animation-name:wall}`,
    '@keyframes lit{0%{opacity:0;translate:0 0;stroke:#e6e6e6}10%{opacity:.9;translate:-2px -3px;stroke:#e6e6e6}21%{opacity:.5;translate:0 1px;stroke:#333}37%,100%{opacity:0;translate:0 0;stroke:#333}}',
    '@keyframes wall{0%{opacity:0}10%{opacity:.9}17.5%,100%{opacity:0}}',
    Array.from({ length: BANDS }, (_, n) => `.q${n}{animation-delay:calc(var(--r) + ${(n * BAND_LAG).toFixed(1)}s)}`).join(''),
    'use,.glow{offset-rotate:0deg;offset-anchor:0 0}',
    '@keyframes swim{from{offset-distance:0%}to{offset-distance:100%}}',
    [1, 2, 3, 4].map(beat).join(''),
    routes,
    '@media (prefers-reduced-motion:reduce){use,g,.glow{animation-play-state:paused}}',
  ].join('')

export function koi(t = 0): string {
  const { routes, fish, rings } = swimmers(t)
  const whole = `width="${COLS * CELL}" height="${ROWS * CELL}"`

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${COLS * CELL} ${ROWS * CELL}" preserveAspectRatio="xMidYMid slice" shape-rendering="crispEdges">`,
    `<style>${style(routes)}</style>`,
    '<defs>',
    `<pattern id="grid" width="${CELL}" height="${CELL}" patternUnits="userSpaceOnUse"><path class="grid" d="M${CELL - 0.5} 0V${CELL - 0.5}H0" fill="none"/></pattern>`,
    '<radialGradient id="warm"><stop offset="0" stop-color="#ff6a1f" stop-opacity="0.9"/><stop offset="1" stop-color="#ff6a1f" stop-opacity="0"/></radialGradient>',
    RIPPLE,
    [...defs.values()].map(d => d.markup).join(''),
    '</defs>',
    `<rect ${whole} fill="#000"/>`,
    fish,
    `<rect ${whole} fill="url(#grid)"/>`,
    rings,
    '</svg>',
  ].join('')
}
