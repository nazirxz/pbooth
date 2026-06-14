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
   * Trigger the shutter. digiCamControl saves the file under its configured
   * session folder; we get the path back via `getLastCaptured`.
   */
  async capture(): Promise<void> {
    const res = await this.fetchSlc('capture', '', '')
    if ('error' in res) throw new Error(`digiCamControl capture: ${res.error}`)
  }

  /**
   * Poll until the most-recent capture filename changes from `prev` (or
   * exists at all on first run). digiCamControl writes the file path
   * asynchronously, so we have to wait until it lands.
   */
  async waitForNewCapture(prev: string | null, timeoutMs: number): Promise<string> {
    const deadline = Date.now() + timeoutMs
    let last = prev
    while (Date.now() < deadline) {
      const res = await this.fetchSlc('get', 'lastcaptured', '')
      if ('response' in res) {
        const path = res.response.trim()
        if (path && path !== '?' && path !== last) return path
        last = path || last
      }
      await wait(150)
    }
    throw new Error('digiCamControl: timed out waiting for captured file')
  }

  /**
   * Download a saved JPEG. digiCamControl exposes session files at
   * `/image/<filename>`. `pathOrName` may be either a full local path
   * (Windows) or a bare filename — we strip directories either way.
   */
  async downloadImage(pathOrName: string): Promise<Blob> {
    const filename = pathOrName.split(/[\\/]/).pop() ?? pathOrName
    const url = `${this.baseUrl}/image/${encodeURIComponent(filename)}`
    const res = await fetch(url)
    if (!res.ok) throw new Error(`digiCamControl image ${filename}: HTTP ${res.status}`)
    return await res.blob()
  }

  private async fetchSlc(
    command: string,
    param1: string,
    param2: string,
    timeoutMs = this.defaultTimeoutMs,
  ): Promise<SlcResult> {
    const url =
      `${this.baseUrl}/?slc=${encodeURIComponent(command)}` +
      `&param1=${encodeURIComponent(param1)}` +
      `&param2=${encodeURIComponent(param2)}`
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), timeoutMs)
    try {
      const res = await fetch(url, { signal: ctrl.signal })
      if (!res.ok) return { error: `HTTP ${res.status}` }
      const text = (await res.text()).trim()
      // digiCamControl encodes errors as plain text starting with a known
      // marker; everything else is treated as the success payload.
      if (/^(null|error)/i.test(text)) return { error: text }
      return { response: text }
    } finally {
      clearTimeout(t)
    }
  }
}

function wait(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms))
}
