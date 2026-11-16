import type { EngineInterface, Register, ThemeSetArgs } from 'claude-code'

import { makeColors } from './make-colors.js'
import { pond } from './scene'

// The app's own surfaces: cool slate-blue grays with a glacier-blue accent.
const { theme, problems } = makeColors({
  label: 'Koi pond',
  roles: { accent: '#3a7cb8', danger: '#c8443a', success: '#3f8f63', warning: '#c08a1e', pro: '#7a6bb8' },
  light: {
    gray: {
      anchors: {
        'surface-0': '#e4e9f0',
        'surface-1': '#ecf0f5',
        'surface-2': '#f4f6fa',
        'text-primary': '#18212e',
        'text-secondary': '#3c4a5c',
        'text-muted': '#566476',
      },
    },
  },
  dark: {
    gray: {
      anchors: {
        'surface-0': '#0f141c',
        'surface-1': '#151b25',
        'surface-2': '#1b2330',
        'surface-3': '#212a38',
        'text-primary': '#e6ecf4',
        'text-secondary': '#bcc7d6',
        'text-muted': '#96a3b5',
      },
    },
  },
})

// The app can leave the pond standing still, and only drawing it afresh sets
// it moving again. So the look is sent again every so often under a new scene
// name that carries the time of day, and the pond is drawn for that moment:
// a fresh drawing carries on where the last one was.
const SCENE = 'koi-pond-'
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

      drawn = { scene: e.props.scene, source: pond(Number.isFinite(seconds) ? seconds : 0) }
    }

    const { Svg } = $.ui.resolve(e)

    return (
      <Svg
        source={drawn.source}
        alt="A painted pond seen from above: koi made of small square cells swim among lily pads, reeds and drifting petals"
        isInteractive
      />
    )
  })
}
