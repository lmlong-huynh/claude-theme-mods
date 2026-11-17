import type { EngineInterface, Register, ThemeSetArgs } from 'claude-code'

import { makeColors } from './make-colors.js'
import { koi } from './scene'

// The app's own surfaces: near-black neutrals, with the koi's orange as the
// accent. Made for the dark only.
const { theme, problems } = makeColors({
  label: 'Koi dark',
  only: 'dark',
  roles: { accent: '#e8742c', danger: '#d6453b', success: '#4f9a62', warning: '#d1a233', pro: '#8f7bc4' },
  dark: {
    gray: {
      anchors: {
        'surface-0': '#050505',
        'surface-1': '#0b0b0c',
        'surface-2': '#111113',
        'surface-3': '#151517',
        'text-primary': '#eeeeec',
        'text-secondary': '#c6c6c2',
        'text-muted': '#a0a09c',
      },
    },
  },
})

// The app can leave the scene standing still, and only drawing it afresh sets
// it moving again. So the look is sent again every so often under a new scene
// name that carries the time of day, and the koi are drawn for that moment:
// a fresh drawing carries on where the last one was.
const SCENE = 'koi-dark-'
const REDRAW_MS = 60_000
const DAY_MS = 86_400_000
// Roughly how long a fresh drawing takes to reach the window.
const LATE_SECONDS = 0.25

let drawn: { scene: string; source: string } | undefined

async function apply($: EngineInterface): Promise<void> {
  const look: ThemeSetArgs = {
    colors: theme,
    backdrop: { scene: `${SCENE}${(await $.clock.now()) % DAY_MS}`, glass: { blur: 3, opacity: 0.5 } },
  }
  const set = await $.theme.set(look)

  // Cleared once a window draws it, or an early "nothing draws themes" stays up.
  $.ui.status(set.isDrawn ? undefined : set.reason)
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const unpainted = problems.find(line => line.startsWith("Desktop won't paint"))

    if (unpainted !== undefined) {
      $.ui.toast(unpainted)
    }
    await apply($)
    $.clock.every(REDRAW_MS, () => apply($).catch(() => undefined))

    return next(e)
  })

  // A desktop or mobile app that joins after the start gets the look too.
  on('session.attach', async ($, e, next) => {
    const joined = await next(e)

    await apply($).catch(() => undefined)

    return joined
  })

  on('prompt.submit', async ($, e, next) => {
    await apply($).catch(() => undefined)

    return next(e)
  })

  on('ui.render', { component: 'Backdrop' }, ($, e, next) => {
    if ((e.surface !== 'desktop' && e.surface !== 'mobile') || typeof e.props.scene !== 'string' || !e.props.scene.startsWith(SCENE)) {
      return next(e)
    }

    if (drawn?.scene !== e.props.scene) {
      const seconds = Number(e.props.scene.slice(SCENE.length)) / 1000 + LATE_SECONDS

      drawn = { scene: e.props.scene, source: koi(Number.isFinite(seconds) ? seconds : 0) }
    }

    const { Svg } = $.ui.resolve(e)

    return (
      <Svg
        source={drawn.source}
        alt="Koi made of small square cells swimming across a black background"
        isInteractive
      />
    )
  })
}
