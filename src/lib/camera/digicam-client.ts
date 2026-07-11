/**
 * Thin wrapper for the digiCamControl HTTP API.
 *
 * digiCamControl is a Windows-only tether app that bundles Canon EDSDK
 * legally. Enable its built-in web server (File → Settings → Webserver) and
 * it exposes `/?slc=<command>&param1=<...>&param2=<...>` for control.
 *
 * Why HTTP from the renderer:
 *  - Electron renderer has no CORS restriction against localhost.
 *  - Avoids native node bindings that break across Node/Electron versions.
 *  - Same code path runs from main process if we ever move it for IPC.
 */

interface SlcOk {
  response: string
}

interface SlcErr {
  error: string
}

type SlcResult = SlcOk | SlcErr

export class DigiCamClient {
  constructor(
    private readonly baseUrl: string,
    private readonly defaultTimeoutMs = 6_000,
  ) {}

  /** Returns true when the API answers — used to decide webcam fallback. */
  async ping(): Promise<boolean> {
    try {
      const res = await this.fetchSlc('list', 'cameras', '', 2_000)
      return 'response' in res
    } catch {
      return false
    }
  }

  /** Set a camera property (iso, shutterspeed, aperture, etc.). */
  async setProperty(name: string, value: string): Promise<void> {
    const res = await this.fetchSlc('set', name, value)
    if ('error' in res) {
      // digiCamControl reports unknown/unsupported properties as errors —
      // surface them so the caller can decide (e.g. log + continue).
      throw new Error(`digiCamControl set ${name}=${value}: ${res.error}`)
    }
  }

  /**
   * Read a camera property (e.g. 'autoexposuremode'). Returns the trimmed
   * value, or null when digiCamControl errors / the property is unknown — so
   * callers can use it for best-effort diagnostics without try/catch noise.
   */
  async getProperty(name: string): Promise<string | null> {
    const res = await this.fetchSlc('get', name, '')
    if ('error' in res) return null
    const value = res.response.trim()
    return value && value !== '?' ? value : null
  }

  /**
   * Trigger the shutter. digiCamControl saves the file under its configured
   * session folder; we get the path back via `getLastCaptured`.
   */
  async capture(): Promise<void> {
    const res = await this.fetchSlc('capture', '', '')
    if ('error' in res) throw new Error(`digiCamControl capture: ${res.error}`)
  }

  /** Return digiCamControl's current last-captured path, if any. */
  async getLastCaptured(): Promise<string | null> {
    const res = await this.fetchSlc('get', 'lastcaptured', '')
    if ('error' in res) return null
    const path = res.response.trim()
    return path && path !== '?' ? path : null
  }

  /**
   * Poll until the most-recent capture filename changes from `prev` (or
   * exists at all on first run). digiCamControl writes the file path
   * asynchronously, so we have to wait until it lands.
   */
  async waitForNewCapture(prev: string | null, timeoutMs: number): Promise<string> {
    console.info('[digicam] waiting for captured file', { previousPath: prev, timeoutMs })
    const deadline = Date.now() + timeoutMs
    let lastSeen = prev
    let polls = 0
    while (Date.now() < deadline) {
      polls += 1
      const res = await this.fetchSlc('get', 'lastcaptured', '', this.defaultTimeoutMs, false)
      if ('response' in res) {
        const path = res.response.trim()
        if (path && path !== '?' && path !== prev) {
          console.info('[digicam] captured file detected', { path, polls })
          return path
        }
        lastSeen = path || lastSeen
      }
      await wait(150)
    }
    console.error('[digicam] timed out waiting for captured file', {
      previousPath: prev,
      lastSeenPath: lastSeen,
      polls,
      timeoutMs,
    })
    throw new Error(
      `digiCamControl: timed out waiting for captured file ` +
        `(previous=${prev ?? '(none)'}, lastSeen=${lastSeen ?? '(none)'})`,
    )
  }

  /**
   * Download a saved JPEG. digiCamControl exposes session files at
   * `/image/<filename>`. `pathOrName` may be either a full local path
   * (Windows) or a bare filename — we strip directories either way.
   */
  async downloadImage(pathOrName: string): Promise<Blob> {
    const filename = pathOrName.split(/[\\/]/).pop() ?? pathOrName
    const url = `${this.baseUrl}/image/${encodeURIComponent(filename)}?t=${Date.now()}`
    console.info('[digicam] downloading image', { filename, url })
    const res = await fetch(url)
    if (!res.ok) throw new Error(`digiCamControl image ${filename}: HTTP ${res.status}`)
    const blob = await res.blob()
    if (blob.size <= 0) {
      throw new Error(`digiCamControl image ${filename}: empty response blob`)
    }
    console.info('[digicam] image downloaded', {
      filename,
      blobBytes: blob.size,
      blobType: blob.type || '(unknown)',
    })
    return blob
  }

  private async fetchSlc(
    command: string,
    param1: string,
    param2: string,
    timeoutMs = this.defaultTimeoutMs,
    log = true,
  ): Promise<SlcResult> {
    const url =
      `${this.baseUrl}/?slc=${encodeURIComponent(command)}` +
      `&param1=${encodeURIComponent(param1)}` +
      `&param2=${encodeURIComponent(param2)}`
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), timeoutMs)
    const startedAt = performance.now()
    if (log) {
      console.info('[digicam] request', { command, param1, param2, timeoutMs, url })
    }
    try {
      const res = await fetch(url, { signal: ctrl.signal })
      const elapsedMs = Math.round(performance.now() - startedAt)
      if (!res.ok) {
        if (log) console.warn('[digicam] response error', { command, status: res.status, elapsedMs })
        return { error: `HTTP ${res.status}` }
      }
      const text = (await res.text()).trim()
      if (log) {
        console.info('[digicam] response', {
          command,
          status: res.status,
          elapsedMs,
          body: text.slice(0, 300),
        })
      }
      // digiCamControl encodes errors as plain text starting with a known
      // marker; everything else is treated as the success payload.
      if (/^(null|error)/i.test(text)) return { error: text }
      return { response: text }
    } catch (e) {
      if (log) {
        console.warn('[digicam] request failed', {
          command,
          param1,
          param2,
          timeoutMs,
          elapsedMs: Math.round(performance.now() - startedAt),
          error: e instanceof Error ? e.message : String(e),
        })
      }
      throw e
    } finally {
      clearTimeout(t)
    }
  }
}

function wait(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms))
}
