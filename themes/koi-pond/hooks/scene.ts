// A koi pond painted in deep greens: lighter and darker washes in the water,
// sunlight drifting over it, a bank of mossy stones and reeds, lily pads,
// petals blown across, and fireflies and a dragonfly above. It is deeper
// toward the edges. Now and then a koi comes up to the surface and goes back
// down, and where it broke the water the cells of the grid lift in a ring
// that spreads outward. Each koi is a
// chain of dots that share one looping route: the head leads and every dot
// behind it runs the same route two cells later, so the body bends wherever
// the head went. A dot is drawn as a small disc of cells, wide at the
// shoulders and narrow at the tail. CSS `offset-path` with `steps()` snaps
// every dot onto the grid; the scene runs no script, which the sandboxed
// frame would refuse anyway.
//
// Two things make it swim. The route itself weaves from side to side, so the
// whole body snakes through the bends the head made. And the back half beats:
// each dot there slides across the body, further the nearer the tail, a
// moment after the dot ahead of it.
//
// Everything is drawn as bars a cell thick on whole cells, and the grid is
// laid over the top, so its lines cut every shape into cells.
//
// The scene is drawn for a moment `t` seconds along: every animation starts
// as far into its loop as it would be by then. Drawing it again for a later
// moment therefore carries on where the last drawing was, which lets the
// frame be replaced without the koi jumping back to the start.

const CELL = 3
const COLS = 534
const ROWS = 337

// Routes and the places of stones, pads, food and rings are written on a
// coarser grid, this many cells to the unit.
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
  // The shadow on the bottom: the dots it follows and how wide each part is.
  shadow: Array<[number, number]>
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
  shadow: [[4, 17], [10, 16], [17, 10]],
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
  shadow: [[3, 10]],
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

const POND: Koi[] = [
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

const LOOPS = POND.map(koi => trace(koi.route, koi.kind.weave))

function swimmers(t: number): { routes: string; shadows: string; fish: string; rings: string } {
  let routes = ''
  let shadows = ''
  let fish = ''
  let rings = ''

  POND.forEach((koi, i) => {
    const { radii, fan, beat: reaches, period } = koi.kind
    const cells = LOOPS[i]!
    const steps = cells.length
    const length = radii.length + fan.length
    const seconds = (steps * koi.step).toFixed(3)
    const lead = Math.floor(steps * koi.phase) + length * GAP
    // Half a step off the tick, so no dot sits on the edge between two cells.
    const delay = (k: number): string => into((lead - k * GAP + 0.5) * koi.step, steps * koi.step, t)
    const fishFrom = fish.length
    const shadeFrom = shadows.length
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

    for (const [dot, wide] of koi.kind.shadow) {
      shadows += `<circle class="k${i} shade" r="${wide}" style="--d:${delay(dot)}"/>`
    }

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

    // Coming up for air. The koi swims a little dimmed, as if under the
    // water, with its shadow close by. At a few moments in its lap it rises:
    // it comes clear, its shadow drops away beneath it, a ripple starts where
    // its head is, and it sinks again. The moments are picked once, at places
    // well inside the pond, so they look like whim and still repeat each lap.
    const lap = steps * koi.step
    const span = lap / Math.round(lap / RIPPLE_SECONDS)
    const headAt = (lead + 0.5) * koi.step
    const pick = dice(i * 4421 + 99)
    const share = (u: number): string => `${((u / lap) * 100).toFixed(2)}%`
    const moments: number[] = []
    let up = ''
    let down = ''

    for (let tries = 0; tries < 600 && moments.length < koi.kind.rises; tries++) {
      const at = Math.floor(pick() * steps)
      const [x, y] = cells[at]!
      const u = at * koi.step
      const inside = x > COLS * 0.16 && x < COLS * 0.84 && y > ROWS * 0.14 && y < ROWS * 0.86
      // Open water only: a ripple under a pad or through a stone looks wrong.
      const open =
        PADS_AT.every(p => Math.hypot(x - scaled(p.x), y - scaled(p.y)) > p.radius * UNIT + 16) &&
        BANK_STONES.every(([sx, sy, r]) => Math.hypot(x - scaled(sx!), y - scaled(sy!)) > r! * UNIT + 14)

      if (!inside || !open || u < 4 || u > lap - 8 || moments.some(m => Math.abs(m - u) < 14)) {
        continue
      }

      const gate = `gate${i}_${moments.length}`

      moments.push(u)
      routes += `@keyframes ${gate}{${share(u)}{visibility:visible}${share(u + span)}{visibility:hidden}}`
      rings += `<use href="#rip" x="${x * CELL}" y="${y * CELL}" class="rp" style="animation:${gate} ${seconds}s step-end infinite;animation-delay:${delay(0)};--r:${into(headAt - u, span, t)};--p:${span.toFixed(3)}s"/>`
    }

    for (const u of [...moments].sort((a, b) => a - b)) {
      up += `${share(u - 1.4)}{opacity:.8}${share(u - 0.1)},${share(u + 0.9)}{opacity:1}${share(u + 2.6)}{opacity:.8}`
      down += `${share(u - 1.4)}{translate:0 0;opacity:1}${share(u - 0.1)},${share(u + 0.9)}{translate:9px 11px;opacity:.55}${share(u + 2.6)}{translate:0 0;opacity:1}`
    }

    routes += `@keyframes up${i}{${up}}@keyframes down${i}{${down}}.s${i}{opacity:.8;animation:up${i} ${seconds}s linear infinite}.h${i}{animation:down${i} ${seconds}s linear infinite}`
    fish = `${fish.slice(0, fishFrom)}<g class="s${i}" style="animation-delay:${delay(0)}">${fish.slice(fishFrom)}</g>`
    shadows = `${shadows.slice(0, shadeFrom)}<g class="h${i}" style="animation-delay:${delay(0)}">${shadows.slice(shadeFrom)}</g>`
  })

  return { routes, shadows, fish, rings }
}

const scaled = (n: number): number => Math.round(n * UNIT)

// Cells sorted by tone, each tone drawn as one outline.
function toned(tones: Map<string, Cell[]>): string {
  return [...tones].map(([tone, cells]) => `<path class="${tone}" d="${outline(cells, 0)}"/>`).join('')
}

function tone(tones: Map<string, Cell[]>, name: string, cell: Cell): void {
  tones.set(name, [...(tones.get(name) ?? []), cell])
}

// Washes in the water: wide soft patches, lighter or darker than it, that
// make the pond look brushed. Place, then size, then which.
const WASH = [
  [20, 14, 20, 11, 'wash'], [62, 22, 24, 13, 'wash'], [38, 46, 22, 12, 'wash'], [84, 44, 16, 12, 'wash'], [50, 8, 14, 7, 'wash'],
  [8, 36, 12, 14, 'wash'], [72, 58, 18, 8, 'wash'], [44, 28, 16, 10, 'murk'], [78, 12, 14, 9, 'murk'], [24, 56, 16, 8, 'murk'], [92, 28, 10, 12, 'murk'],
]
  .map(([x, y, rx, ry, kind]) => `<ellipse class="${kind}" cx="${scaled(x as number) * CELL}" cy="${scaled(y as number) * CELL}" rx="${scaled(rx as number) * CELL}" ry="${scaled(ry as number) * CELL}"/>`)
  .join('')

// The bank: stones that break the water, moss on their near side, and tufts
// of reeds fanning out beside them. Koi pass beneath.
const BANK_STONES = [
  [15, 30, 2], [12.5, 33, 1.4], [16.5, 34, 1.1], [86, 30, 1.8], [88.5, 33.5, 1.5], [84.5, 34.5, 1], [50, 3.5, 1.5],
]

// Where a tuft grows, the way it faces in turns of a circle, and its blades.
const BANK_REEDS = [
  [13, 28.5, 0.62, 7], [14.5, 35.5, 0.2, 6], [87.5, 28, 0.88, 7], [85.5, 36, 0.3, 6], [53, 4, 0.2, 5],
]

function bank(): string {
  const tones = new Map<string, Cell[]>()

  BANK_STONES.forEach(([x, y, r], index) => {
    const roll = dice(index * 31 + 5)
    const radius = r! * UNIT
    const cx = scaled(x!)
    const cy = scaled(y!)
    const lean = Math.round((roll() - 0.5) * radius)
    const seen = new Set<string>()

    for (const [px, py] of [...disc(radius), ...disc(radius * 0.7, lean, Math.round(radius * 0.5))]) {
      if (seen.has(`${px},${py}`)) {
        continue
      }
      seen.add(`${px},${py}`)

      const mossy = px + py > radius * 0.35 && roll() < 0.75
      const lit = Math.hypot(px + radius * 0.3, py + radius * 0.3) < radius * 0.55

      tone(tones, mossy ? (roll() < 0.3 ? 'n3' : 'n2') : lit ? 'n1' : 'n0', [cx + px, cy + py])
    }
  })

  BANK_REEDS.forEach(([x, y, facing, blades], index) => {
    const roll = dice(index * 977 + 3)

    for (let blade = 0; blade < blades!; blade++) {
      const angle = 2 * Math.PI * (facing! + (blade / (blades! - 1) - 0.5) * 0.45 + (roll() - 0.5) * 0.04)
      const long = 9 + Math.floor(roll() * 9)
      const bend = (roll() - 0.5) * 0.03
      const seeded = roll() < 0.4

      for (let n = 1; n <= long; n++) {
        const turn = angle + bend * n
        const cell: Cell = [scaled(x!) + Math.round(Math.cos(turn) * n), scaled(y!) + Math.round(Math.sin(turn) * n)]

        tone(tones, seeded && n > long - 3 ? 'r2' : n > long / 2 ? 'r1' : 'r0', cell)
      }
    }
  })

  return toned(tones)
}

const BANK = bank()

// Sunlight through leaves: soft patches that drift to and fro and brighten.
const sun = (t: number): string =>
  [
    [16, 20, 9, 6], [36, 12, 11, 6], [58, 34, 12, 7], [78, 22, 9, 6], [30, 44, 10, 5], [66, 50, 11, 6], [90, 40, 8, 6], [48, 22, 8, 5],
  ]
    .map(([x, y, rx, ry], i) => `<ellipse class="sun" cx="${scaled(x!) * CELL}" cy="${scaled(y!) * CELL}" rx="${scaled(rx!) * CELL}" ry="${scaled(ry!) * CELL}" style="animation-delay:${into(i * 13, 92, t)}"/>`)
    .join('')

// Petals and leaves blown slowly across the water, a cell at a time.
const PETALS: Cell[][] = [
  [[0, 0], [1, 0], [1, 1]],
  [[0, 0], [1, 0], [0, 1], [1, 1], [2, 1]],
  [[0, 0], [1, 1], [2, 1]],
]

const petals = (t: number): string =>
  [8, 51, 23, 40, 15, 58, 31, 4, 46, 27, 12, 36]
    .map((y, i) => `<path class="pt ${['f1', 'f0', 'p2', 'f3', 'cy'][i % 5]}" d="${outline(PETALS[i % 3]!.map(([px, py]): Cell => [px, py + scaled(y)]), 0)}" style="animation-delay:${into(i * 14.3, 170, t)}"/>`)
    .join('')

// Fireflies, in the dark only: small lights that wander and come and go.
const flies = (t: number): string =>
  [
    [10, 12], [24, 34], [41, 9], [57, 52], [69, 17], [83, 39], [93, 14], [15, 54], [35, 26], [62, 6], [76, 48], [48, 40],
  ]
    .map(([x, y], i) => `<circle class="fly ${i % 2 === 0 ? 'fa' : 'fb'}" cx="${scaled(x!) * CELL}" cy="${scaled(y!) * CELL}" r="5" style="animation-delay:${into(i * 1.7, 6, t)},${into(i * 5, 46, t)}"/>`)
    .join('')

// One dragonfly: it darts along a line across the pond, hovers, darts on.
const dragonfly = (t: number): string =>
  `<g class="dfly" style="animation-delay:${into(0, 38, t)}"><path class="dw" d="${outline(pair([[0, 1], [0, 2], [1, 1], [1, 2], [1, 3]]), -0.5)}"/><path class="db" d="${outline([[-3, 0], [-2, 0], [-1, 0], [0, 0], [1, 0], [2, 0]], -0.5)}"/><path class="ck" d="${outline([[3, 0]], -0.5)}"/></g>`

// Food on the water: faint rings that come and go out of step.
const food = (t: number): string =>
  [
    [3, 49], [6, 51], [4, 54], [2, 57], [9, 55], [13, 61], [17, 53], [21, 49],
    [33, 60], [49, 3], [62, 9], [88, 28], [94, 41], [70, 58], [58, 47], [11, 44],
  ]
    .map(([x, y], i) => `<circle class="food" cx="${scaled(x!) * CELL + CELL / 2}" cy="${scaled(y!) * CELL + CELL / 2}" r="2" style="animation-delay:${into(i * 0.7, 7, t)}"/>`)
    .join('')

// Lily pads: a round of green cells with a wedge cut out, a darker rim and
// veins running out from the middle, some in flower. They sit over the koi,
// toward the corners but clear of the strip a narrow window crops off each
// side, and rock a cell to and fro.
type Pad = { x: number; y: number; radius: number; cut: Cell; flower?: boolean; sway: number }

const PADS_AT: Pad[] = [
  { x: 18, y: 9, radius: 3, cut: [1, 1], flower: true, sway: 0 },
  { x: 23.5, y: 12.5, radius: 1.75, cut: [-1, 0], sway: 5 },
  { x: 82, y: 51, radius: 3.5, cut: [-1, -1], sway: 9 },
  { x: 76, y: 55.5, radius: 2, cut: [0, -1], flower: true, sway: 3 },
  { x: 80, y: 10, radius: 2.25, cut: [-1, 1], sway: 12 },
  { x: 20, y: 52, radius: 2.5, cut: [1, -1], sway: 7 },
  { x: 14, y: 47.5, radius: 1.3, cut: [0, 1], sway: 10 },
]

function pad(p: Pad, index: number, t: number): string {
  const radius = p.radius * UNIT
  const cx = scaled(p.x)
  const cy = scaled(p.y)
  const size = Math.hypot(p.cut[0], p.cut[1])
  const roll = dice(index * 104729 + 7)
  const turn = roll() * Math.PI
  const tones = new Map<string, Cell[]>()

  for (const [x, y] of disc(radius)) {
    const far = Math.hypot(x, y)

    // The wedge: cells that lie close to the line from the centre out.
    if (far > 1 && (x * p.cut[0] + y * p.cut[1]) / (far * size) > 0.95) {
      continue
    }

    // How far the cell lies from the nearest of eight veins.
    const off = far * Math.abs(Math.sin(4 * (Math.atan2(y, x) + turn)) / 4)
    const name = far > radius - 1.8 ? 'p0' : far > 2 && off < 0.5 ? 'p2' : roll() < 0.07 ? 'p3' : 'p1'

    tone(tones, name, [cx + x, cy + y])
  }

  if (p.flower === true) {
    const fx = cx - Math.sign(p.cut[0]) * Math.round(radius / 2.5)
    const fy = cy - Math.sign(p.cut[1]) * Math.round(radius / 2.5)

    for (const [x, y] of disc(4.2)) {
      const far = Math.hypot(x, y)

      // Gaps between petals: the diagonals and the axes, away from the heart.
      if (far > 2.5 && (Math.abs(x) === Math.abs(y) || (far > 3.5 && (x === 0 || y === 0)))) {
        continue
      }

      tone(tones, far <= 1 ? 'f2' : far <= 2.3 ? 'f0' : far <= 3.3 ? 'f1' : 'f3', [fx + x, fy + y])
    }
  }

  // Later tones are drawn over earlier ones, and the flower's go in last.
  return `<g class="pad" style="animation-delay:${into(p.sway, 16, t)}">${toned(tones)}</g>`
}

const pads = (t: number): string => PADS_AT.map((p, index) => pad(p, index, t)).join('')

// A ripple lifts the cells of the grid: bands of cells, each two cells wider
// than the last, rise one after another from the middle out and fade towards
// the rim. A band is drawn three times. Its top slides up towards the light
// as it rises, then sinks dark behind the next band. A darker copy stays
// where it stood, so it shows below the top as the side of a raised block.
// And its shadow slides the other way, further the higher the block. Ripples
// lie over the grid and are cut into cells of their own, since cells that
// have left their places no longer line up with its lines.
// The bands are kept once; each takes its place in the order from its own
// rule, and a ripple only says when its middle band starts.
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

    return part('qd') + part('qs') + part('ql')
  }).join('') +
  '</g>'

const style = (routes: string): string =>
  [
    `path{fill:none;stroke-width:${CELL}px}`,
    '.bg{fill:#0c1d22}.grid{stroke:#08151a;stroke-width:.8;opacity:.8}',
    '.wash{fill:url(#wash);opacity:.5}.murk{fill:url(#murk);opacity:.6}',
    '.n0{stroke:#2d3a3d}.n1{stroke:#435355}.n2{stroke:#3f6b3c}.n3{stroke:#5f8f4a}.r0{stroke:#1f4a33}.r1{stroke:#3f8246}.r2{stroke:#8a5a33}',
    '.cw{stroke:#f3ead8}.cr{stroke:#de5238}.ck{stroke:#2a2826}.cx{stroke:#9a9690}.cg{stroke:#e8bd45}.cy{stroke:#f7e3a0}.co{stroke:#ee8233}.ce{stroke:#d05f22}',
    '.cf{stroke:#f3ead8;opacity:.5}.cs{stroke:#000;opacity:.13}',
    '.shade{fill:url(#shade);opacity:.6;transform:translate(10px,13px)}',
    '.sun{fill:url(#lit);opacity:.06;animation:sun 46s ease-in-out infinite alternate}',
    '@keyframes sun{from{translate:-42px -15px;opacity:.04}50%{opacity:.17}to{translate:48px 18px;opacity:.06}}',
    `.pt{animation:drift 170s steps(${COLS + 20}) infinite}`,
    `@keyframes drift{from{translate:-30px 0}to{translate:${COLS * CELL + 30}px 0}}`,
    '.fly{fill:url(#lit);opacity:0;animation:blink 6s ease-in-out infinite,roam 23s ease-in-out infinite alternate}.fb{animation-name:blink,stray}',
    '@keyframes blink{0%,50%,100%{opacity:0}65%,85%{opacity:.95}}',
    '@keyframes roam{from{translate:-26px 12px}to{translate:32px -24px}}@keyframes stray{from{translate:22px 18px}to{translate:-30px -14px}}',
    '.dfly{offset-path:path("M-40 300L420 230L900 540L1310 170L1660 270");offset-rotate:0deg;animation:dart 38s linear infinite}',
    '@keyframes dart{0%{offset-distance:0%}4%,15%{offset-distance:24%}20%,31%{offset-distance:55%}36%,45%{offset-distance:80%}50%,100%{offset-distance:100%}}',
    '.db{stroke:#49b9c9}.dw{stroke:#eaf6f4;animation:wing .14s steps(2,jump-none) infinite alternate}@keyframes wing{from{opacity:.2}to{opacity:.7}}',
    '.glow{fill:url(#warm);opacity:.7}',
    '.food{fill:none;stroke:#c9a54a;stroke-width:1;animation:food 7s ease-in-out infinite}',
    '.p0{stroke:#23563c}.p1{stroke:#37794c}.p2{stroke:#6fa85a}.p3{stroke:#2e6b45}',
    '.f0{stroke:#fbdde6}.f1{stroke:#f3a9c0}.f2{stroke:#f6d77a}.f3{stroke:#e58aa6}',
    '.pad{animation:sway 16s step-end infinite}',
    `@keyframes sway{0%{translate:0 0}30%{translate:${CELL}px 0}55%{translate:${CELL}px ${CELL}px}80%{translate:0 ${CELL}px}}`,
    '.bd{stroke-width:2.2px;stroke-dasharray:2.2 .8}',
    `.rp{visibility:hidden}.ql,.qd,.qs{opacity:0;animation:${RIPPLE_SECONDS}s ease-in-out infinite;animation-duration:var(--p)}.ql{animation-name:lit}.qd{stroke:#01070a;animation-name:cast}.qs{stroke:#2a7770;animation-name:wall}`,
    '@keyframes lit{0%{opacity:0;translate:0 0;stroke:#9be6dc}10%{opacity:.95;translate:-2px -3px;stroke:#9be6dc}21%{opacity:.55;translate:0 1px;stroke:#04141a}37%,100%{opacity:0;translate:0 0;stroke:#04141a}}',
    '@keyframes wall{0%{opacity:0}10%{opacity:.95}17.5%,100%{opacity:0}}',
    '@keyframes cast{0%{opacity:0;translate:0 0}10%{opacity:.75;translate:3px 4px}19.5%,100%{opacity:0;translate:0 0}}',
    Array.from({ length: BANDS }, (_, n) => `.q${n}{animation-delay:calc(var(--r) + ${(n * BAND_LAG).toFixed(1)}s)}`).join(''),
    '@keyframes food{0%,100%{opacity:.15}50%{opacity:.7}}',
    'use,.glow,.shade{offset-rotate:0deg;offset-anchor:0 0}',
    '@keyframes swim{from{offset-distance:0%}to{offset-distance:100%}}',
    [1, 2, 3, 4].map(beat).join(''),
    routes,
    // The app sets the frame's colour scheme to its own, so the pond follows it.
    '@media (prefers-color-scheme:light){.bg{fill:#d3e8df}.grid{stroke:#b9d6cc}.wash{opacity:.13}.murk,.depth,.fly{display:none}.n0{stroke:#8f9c97}.n1{stroke:#aab6b0}.cw{stroke:#fffaf0}.cf{stroke:#e6dcc8}.shade{opacity:.22}.sun{opacity:.3}.food{stroke:#b08a2a}.glow{opacity:.35}.qs{stroke:#4f9f96}}',
    '@media (prefers-reduced-motion:reduce){use,g,.glow,.shade,.food,.sun,.pt,.fly,.dfly,.dw{animation-play-state:paused}}',
  ].join('')

export function pond(t = 0): string {
  const { routes, shadows, fish, rings } = swimmers(t)
  const whole = `width="${COLS * CELL}" height="${ROWS * CELL}"`

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${COLS * CELL} ${ROWS * CELL}" preserveAspectRatio="xMidYMid slice" shape-rendering="crispEdges">`,
    `<style>${style(routes)}</style>`,
    '<defs>',
    `<pattern id="grid" width="${CELL}" height="${CELL}" patternUnits="userSpaceOnUse"><path class="grid" d="M${CELL - 0.5} 0V${CELL - 0.5}H0" fill="none"/></pattern>`,
    '<radialGradient id="deep" r="0.75"><stop offset="0.35" stop-color="#03090b" stop-opacity="0"/><stop offset="1" stop-color="#03090b" stop-opacity="0.75"/></radialGradient>',
    ...[['wash', '#2f7370'], ['murk', '#04090c'], ['shade', '#000'], ['lit', '#f4f0b8']].map(
      ([id, colour]) => `<radialGradient id="${id}"><stop offset="0" stop-color="${colour}"/><stop offset="1" stop-color="${colour}" stop-opacity="0"/></radialGradient>`,
    ),
    '<radialGradient id="warm"><stop offset="0" stop-color="#ff6a1f" stop-opacity="0.9"/><stop offset="1" stop-color="#ff6a1f" stop-opacity="0"/></radialGradient>',
    RIPPLE,
    [...defs.values()].map(d => d.markup).join(''),
    '</defs>',
    `<rect class="bg" ${whole}/>`,
    WASH,
    `<rect class="depth" ${whole} fill="url(#deep)"/>`,
    shadows,
    fish,
    petals(t),
    BANK,
    pads(t),
    sun(t),
    `<rect ${whole} fill="url(#grid)"/>`,
    rings,
    food(t),
    flies(t),
    dragonfly(t),
    '</svg>',
  ].join('')
}
