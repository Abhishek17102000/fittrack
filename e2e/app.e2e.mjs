// End-to-end tests against the production build (run `npm run build` first; `npm run e2e` does both).
// Uses the system Chrome through playwright-core, so no browser download is needed.
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdirSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { chromium, devices } from 'playwright-core'

const PORT = 4179
const URL = `http://127.0.0.1:${PORT}/`
const CHROME = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].find((p) => p && existsSync(p))
const SHOTS = process.env.SHOTS_DIR || 'e2e/shots'
mkdirSync(SHOTS, { recursive: true })

let server
let browser

before(async () => {
  assert.ok(CHROME, 'No Chrome/Edge found. Set CHROME_PATH.')
  server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--port', String(PORT), '--strictPort', '--host', '127.0.0.1'], { stdio: 'ignore' })
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(URL)).ok) break
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 250))
  }
  browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--no-proxy-server'] })
})

after(async () => {
  await browser?.close()
  server?.kill()
})

/** A fresh phone-sized browser profile with a fixed clock and timezone. */
async function freshPage(iso, { tz = 'Asia/Kolkata', permissions = ['notifications'] } = {}) {
  const context = await browser.newContext({ ...devices['Pixel 7'], timezoneId: tz, locale: 'en-IN', permissions, acceptDownloads: true })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
  page.on('console', (m) => m.type() === 'error' && errors.push(`console: ${m.text()}`))
  await page.clock.setFixedTime(new Date(iso))
  await page.goto(URL)
  return { context, page, errors }
}

async function onboard(page, name = 'Asha') {
  await page.getByLabel('Your name').fill(name)
  await page.getByRole('button', { name: 'Continue' }).click()
  await page.getByRole('radio', { name: /Beginner/ }).waitFor()
  await page.getByRole('button', { name: 'Continue' }).click()
  await page.getByRole('button', { name: "Let's go" }).click()
  await page.getByText("Today's plan").waitFor()
}

/** Ticks every visible 'Complete set' button, waiting for the UI to catch up after each tap. */
async function tickAll(page) {
  let ticked = 0
  for (;;) {
    const n = await page.locator('button[aria-label^="Complete set"]').count()
    if (n === 0) return ticked
    await page.locator('button[aria-label^="Complete set"]').first().click()
    await page.waitForFunction((want) => document.querySelectorAll('button[aria-label^="Complete set"]').length === want, n - 1)
    ticked++
  }
}

const MONDAY_11AM = '2026-10-12T11:00:00+05:30'

test('first run: onboarding lands on today\'s workout (Monday = Lower Body) with no errors', async () => {
  const { context, page, errors } = await freshPage(MONDAY_11AM)
  await page.getByText('Welcome to FitTrack').waitFor()
  await page.screenshot({ path: `${SHOTS}/01-onboarding.png` })
  await onboard(page)
  await page.getByRole('heading', { name: 'Lower Body Strength' }).waitFor()
  await page.getByText('Good morning, Asha').waitFor()
  await page.getByText('Beginner').first().waitFor()
  await page.getByText('Goblet Squat').first().waitFor() // beginner variant
  await page.screenshot({ path: `${SHOTS}/02-today.png`, fullPage: true })
  assert.deepEqual(errors, [])
  await context.close()
})

test('1:30 AM Monday (IST) still shows Sunday\'s rest day because of the 4 AM day boundary', async () => {
  const { context, page } = await freshPage('2026-10-12T01:30:00+05:30')
  await onboard(page)
  await page.getByRole('heading', { name: 'Rest & Recover' }).waitFor()
  await page.getByText(/Sunday,? 11 October/).waitFor()
  await context.close()
})

test('same instant in another timezone shows that timezone\'s day', async () => {
  // 2026-10-12 11:00 IST == 2026-10-11 23:30 in New York => Sunday there
  const { context, page } = await freshPage(MONDAY_11AM, { tz: 'America/New_York' })
  await onboard(page)
  await page.getByText(/Sunday,? 11 October/).waitFor()
  await page.getByRole('heading', { name: 'Rest & Recover' }).waitFor()
  await context.close()
})

test('full workout: log every set, rest timer, finish, summary, streak, completed state', async () => {
  const { context, page, errors } = await freshPage(MONDAY_11AM)
  await onboard(page)
  await page.getByRole('button', { name: /Start workout/ }).click()
  await page.waitForURL(/#\/session\/\d+/)
  await page.getByRole('heading', { level: 1 }).waitFor()
  assert.match(await page.getByText(/Warm-up · 1 of/).textContent(), /Warm-up · 1 of \d+/)

  // first main exercise: tick a set -> rest timer shows
  let ticks = 0
  for (let guard = 0; guard < 60; guard++) {
    ticks += await tickAll(page)
    if (ticks >= 8 && ticks < 12) await page.screenshot({ path: `${SHOTS}/03-session.png` })
    const next = page.getByRole('button', { name: 'Next exercise' })
    if ((await next.count()) === 0) break
    await next.click()
    await page.waitForTimeout(300)
  }
  assert.ok(ticks > 20, `expected to complete many sets, completed ${ticks}`)
  await page.getByRole('button', { name: 'Finish workout' }).first().click()
  await page.waitForURL(/#\/summary\/\d+/)
  await page.getByText('Workout complete').waitFor()
  await page.screenshot({ path: `${SHOTS}/04-summary.png`, fullPage: true })
  await page.getByText('1-day streak').waitFor()

  await page.getByRole('button', { name: 'Done' }).click()
  await page.getByText(/Completed - view summary/).waitFor()
  assert.deepEqual(errors, [])
  await context.close()
})

test('rest timer appears after a set and can be skipped; undo works; leaving keeps progress for resume', async () => {
  const { context, page } = await freshPage(MONDAY_11AM)
  await onboard(page)
  await page.getByRole('button', { name: /Start workout/ }).click()
  await page.waitForURL(/#\/session\/\d+/)
  // go to the first multi-set exercise (first main block)
  for (let i = 0; i < 6; i++) {
    await page.getByRole('button', { name: /Skip exercise|Next exercise/ }).click()
    await page.waitForTimeout(450)
  }
  await page.getByText(/Main work · 7 of/).waitFor()
  await page.getByRole('button', { name: /^Complete set 1/ }).click()
  await page.getByRole('timer', { name: 'Rest timer' }).waitFor()
  await page.getByRole('button', { name: 'Skip', exact: true }).click()
  await page.getByRole('timer', { name: 'Rest timer' }).waitFor({ state: 'detached' })
  await page.getByRole('button', { name: /^Undo set 1/ }).click()
  await page.getByRole('button', { name: /^Complete set 1/ }).waitFor()
  await page.getByRole('button', { name: /^Complete set 1/ }).click()

  // leave (pause) and resume: the logged set is still there
  await page.getByRole('button', { name: 'Leave workout' }).click()
  await page.getByRole('button', { name: /Pause/ }).click()
  await page.getByRole('button', { name: /Resume workout/ }).click()
  await page.waitForURL(/#\/session\/\d+/)
  await page.getByText(/Main work · 7 of/).waitFor()
  await page.getByRole('button', { name: /^Undo set 1/ }).waitFor()
  await context.close()
})

test('diet: add foods, portions, protein ring and totals update; custom food works', async () => {
  const { context, page, errors } = await freshPage(MONDAY_11AM)
  await onboard(page)
  await page.getByRole('link', { name: 'Diet' }).click()
  await page.getByRole('heading', { name: 'Diet' }).waitFor()
  await page.getByRole('button', { name: 'Add food to Breakfast' }).click()
  await page.getByLabel('Search foods').fill('paneer bhurji')
  await page.getByRole('button', { name: /^Paneer bhurji/ }).click()
  await page.getByRole('button', { name: /^Paneer bhurji/ }).click() // adds another portion (merges)
  await page.getByRole('button', { name: 'Close' }).click()
  await page.getByText(/2 × 1 katori/).waitFor()
  await page.getByRole('img', { name: /Protein: 38 of 95/ }).waitFor()

  // custom food
  await page.getByRole('button', { name: 'Add food to Dinner' }).click()
  await page.getByRole('button', { name: 'Add a custom food' }).click()
  await page.getByLabel('Food name').fill('Sattu drink')
  await page.getByRole('textbox', { name: 'Protein in grams' }).fill('12')
  await page.getByRole('button', { name: /Save & add/ }).click()
  await page.getByRole('button', { name: 'Close' }).click()
  await page.locator('li', { hasText: 'Sattu drink' }).first().waitFor()
  await page.screenshot({ path: `${SHOTS}/05-diet.png`, fullPage: true })

  // Today shows the same protein
  await page.getByRole('link', { name: 'Today' }).click()
  await page.getByRole('img', { name: /Protein: 50 of 95/ }).waitFor()
  assert.deepEqual(errors, [])
  await context.close()
})

test('supplements: today checklist, tick/untick, weekly vitamin D, B12 due on Mon', async () => {
  const { context, page, errors } = await freshPage(MONDAY_11AM)
  await onboard(page)
  await page.getByRole('link', { name: 'Supps' }).click()
  await page.getByRole('heading', { name: 'Supplements', exact: true }).waitFor()
  for (const n of ['Creatine monohydrate', 'Vitamin D3', 'Vitamin B12', 'Omega-3', 'Vitamin C']) {
    await page.getByRole('button', { name: new RegExp(n) }).first().waitFor({ timeout: 8000 })
  }
  await page.getByRole('button', { name: /Vitamin B12/ }).first().click()
  await page.getByRole('button', { name: /^Vitamin B12/, pressed: true }).waitFor()
  await page.getByText('Check your doses').waitFor()
  await page.screenshot({ path: `${SHOTS}/06-supps.png`, fullPage: true })
  // untick
  await page.getByRole('button', { name: /^Vitamin B12/, pressed: true }).click()
  await page.getByRole('button', { name: /^Vitamin B12/, pressed: true }).waitFor({ state: 'detached' })
  assert.deepEqual(errors, [])
  await context.close()
})

test('B12 (Mon/Wed/Fri) is not due on Tuesday', async () => {
  const { context, page } = await freshPage('2026-10-13T11:00:00+05:30')
  await onboard(page)
  await page.getByRole('link', { name: 'Supps' }).click()
  await page.getByRole('heading', { name: 'Supplements', exact: true }).waitFor()
  assert.equal(await page.getByRole('button', { name: /^Vitamin B12/ }).count(), 0)
  await page.getByRole('button', { name: /Creatine/ }).first().waitFor()
  await context.close()
})

test('supplement editor: add a custom supplement and delete it', async () => {
  const { context, page } = await freshPage(MONDAY_11AM)
  await onboard(page)
  await page.getByRole('link', { name: 'Supps' }).click()
  await page.getByRole('button', { name: 'Add', exact: true }).click()
  await page.getByLabel('Supplement name').fill('Magnesium')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await page.getByText('Magnesium').first().waitFor()
  await page.getByRole('button', { name: 'Edit Magnesium' }).click()
  await page.getByRole('button', { name: /Delete/ }).click()
  await page.getByRole('dialog', { name: /Delete Magnesium/ }).getByRole('button', { name: 'Delete' }).click()
  await page.waitForTimeout(400)
  assert.equal(await page.getByText('Magnesium').count(), 0)
  await context.close()
})

test('progress: log weight + waist, trend & goal stats update', async () => {
  const { context, page, errors } = await freshPage(MONDAY_11AM)
  await onboard(page)
  await page.getByRole('link', { name: 'Progress' }).click()
  await page.getByRole('heading', { name: 'Progress' }).waitFor()
  await page.getByRole('textbox', { name: 'Weight in kilograms' }).fill('70.4')
  await page.getByRole('textbox', { name: 'Waist in centimetres' }).fill('92')
  await page.getByRole('button', { name: /Save today's measurements/ }).click()
  await page.getByText('Saved ✓').waitFor()
  await page.getByText(/7\.4 kg to go/).waitFor()
  await page.screenshot({ path: `${SHOTS}/07-progress.png`, fullPage: true })
  assert.deepEqual(errors, [])
  await context.close()
})

test('settings: theme switch, schedule edit changes today\'s plan, export JSON, wipe + restore via import', async () => {
  const { context, page, errors } = await freshPage(MONDAY_11AM)
  await onboard(page)
  await page.getByRole('link', { name: 'Settings' }).click()
  await page.getByRole('heading', { name: 'Settings' }).waitFor()

  // theme
  assert.ok(await page.evaluate(() => document.documentElement.classList.contains('dark')))
  await page.getByRole('radio', { name: 'Light' }).click()
  await page.waitForFunction(() => !document.documentElement.classList.contains('dark'))
  await page.screenshot({ path: `${SHOTS}/08-settings-light.png`, fullPage: true })
  await page.getByRole('radio', { name: 'Dark' }).click()

  // schedule: make Monday an Upper day
  await page.getByLabel('Monday workout').selectOption('upper')
  await page.getByRole('link', { name: 'Today' }).click()
  await page.getByRole('heading', { name: 'Upper Body Strength' }).waitFor()

  // log some food so there is data to back up
  await page.getByRole('link', { name: 'Diet' }).click()
  await page.getByRole('button', { name: 'Add food to Lunch' }).click()
  await page.getByRole('button', { name: /Dal \(cooked\)/ }).click()
  await page.getByRole('button', { name: 'Close' }).click()

  // export
  await page.getByRole('link', { name: 'Settings' }).click()
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Export' }).click()])
  assert.match(download.suggestedFilename(), /^fittrack-backup-2026-10-12\.json$/)
  const path = await download.path()
  const { readFileSync } = await import('node:fs')
  const backup = JSON.parse(readFileSync(path, 'utf8'))
  assert.equal(backup.app, 'fittrack')
  assert.equal(backup.tables.foodLogs.length, 1)
  assert.equal(backup.tables.schedule.find((r) => r.weekday === 1).dayKey, 'upper')

  // wipe everything -> back to onboarding
  await page.getByRole('button', { name: 'Erase all data' }).click()
  await page.getByRole('button', { name: 'Erase all', exact: true }).click()
  await page.getByText('Welcome to FitTrack').waitFor()

  // restoring needs an onboarded app to reach Settings again; import via a second onboarding
  await onboard(page, 'Temp')
  await page.getByRole('link', { name: 'Settings' }).click()
  await page.setInputFiles('input[aria-label="Import backup file"]', path)
  await page.getByRole('button', { name: 'Restore' }).click()
  await page.getByText('Backup restored').waitFor()
  await page.getByRole('link', { name: 'Today' }).click()
  await page.getByRole('heading', { name: 'Upper Body Strength' }).waitFor()
  await page.getByRole('link', { name: 'Diet' }).click()
  await page.getByText('Dal (cooked)', { exact: true }).waitFor()

  // a non-backup file is rejected without touching data
  await page.getByRole('link', { name: 'Settings' }).click()
  await page.setInputFiles('input[aria-label="Import backup file"]', { name: 'x.json', mimeType: 'application/json', buffer: Buffer.from('{"hello":1}') })
  await page.getByText("That file isn't a FitTrack backup").waitFor()
  assert.deepEqual(errors, [])
  await context.close()
})

test('offline: after the first load the app starts with no network and keeps its data (service worker + IndexedDB)', async () => {
  const { context, page, errors } = await freshPage(MONDAY_11AM)
  await onboard(page)
  await page.getByRole('link', { name: 'Diet' }).click()
  await page.getByRole('button', { name: 'Add food to Lunch' }).click()
  await page.getByRole('button', { name: /^Roti/ }).first().click()
  await page.getByRole('button', { name: 'Close' }).click()

  // wait for the service worker to take control & precache
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready
  })
  await page.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 15000 }).catch(async () => {
    await page.reload()
    await page.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 15000 })
  })

  await context.setOffline(true)
  await page.reload() // still on the Diet tab
  await page.getByRole('heading', { name: 'Diet', exact: true }).waitFor()
  await page.getByText('Roti / chapati', { exact: true }).waitFor()
  // starting a workout offline works too
  await page.getByRole('link', { name: 'Today' }).click()
  await page.getByRole('button', { name: /Start workout/ }).click()
  await page.waitForURL(/#\/session\/\d+/)
  await context.setOffline(false)
  assert.deepEqual(errors.filter((e) => !/Failed to load resource|net::ERR/.test(e)), [])
  await context.close()
})

test('reminders: meal-log nudge fires a real notification + appears in-app; weigh-in asks for data and clears when answered', async () => {
  // Monday 16:00 IST, nothing logged: the 15:00 "log your meals" reminder is due.
  const { context, page, errors } = await freshPage('2026-10-12T16:00:00+05:30')
  await onboard(page)
  // enable reminders in Settings (permission pre-granted for the test browser)
  await page.getByRole('link', { name: 'Settings' }).click()
  // onboarding already switched reminders on (permission was granted)
  assert.equal(await page.getByRole('switch', { name: 'Notifications' }).getAttribute('aria-checked'), 'true')
  await page.getByRole('link', { name: 'Today' }).click()
  await page.getByText('Log your meals').first().waitFor()
  await page.screenshot({ path: `${SHOTS}/09-inbox.png`, fullPage: true })

  await page.evaluate(async () => navigator.serviceWorker.ready)
  await page.waitForFunction(async () => {
    const reg = await navigator.serviceWorker.getRegistration()
    const list = reg ? await reg.getNotifications() : []
    return list.some((n) => n.title.includes('Log your meals'))
  }, null, { timeout: 15000 })
  const titles = await page.evaluate(async () => (await (await navigator.serviceWorker.getRegistration()).getNotifications()).map((n) => n.title))
  assert.ok(titles.some((t) => t.includes('Log your meals')), `notifications: ${titles.join(' | ')}`)
  // supplement alerts fire only if they became due in the last 3 h: Omega-3 (14:00) yes, Creatine (10:30) is stale
  assert.ok(titles.some((t) => /Omega-3/.test(t)), `notifications: ${titles.join(' | ')}`)
  assert.ok(!titles.some((t) => /Creatine/.test(t)))
  // gym reminder (18:00) is not due yet at 16:00
  assert.ok(!titles.some((t) => /Time to train/.test(t)))

  // dismissing removes the card
  while ((await page.getByRole('button', { name: 'Dismiss reminder' }).count()) > 0) {
    await page.getByRole('button', { name: 'Dismiss reminder' }).first().click()
    await page.waitForTimeout(350)
  }
  assert.equal(await page.getByText('Log your meals').count(), 0)
  assert.equal(await page.getByText('Measure your waist').count(), 0)
  // dismissed reminders stay dismissed after a reload
  await page.reload()
  await page.getByText("Today's plan").waitFor()
  assert.equal(await page.getByText('Log your meals').count(), 0)
  assert.deepEqual(errors, [])
  await context.close()
})

test('weigh-in: asked after 7 days, saved inline, then the card disappears', async () => {
  const { context, page } = await freshPage('2026-10-12T11:00:00+05:30')
  await onboard(page) // logs 71 kg on 12 Oct
  // eight days later
  await page.clock.setFixedTime(new Date('2026-10-20T11:00:00+05:30'))
  await page.reload()
  await page.getByText('Weigh-in time').waitFor()
  await page.getByRole('textbox', { name: 'Weight in kilograms' }).fill('69.8')
  await page.getByRole('button', { name: 'Save', exact: true }).first().click() // weigh-in card comes first (waist card follows)
  await page.getByText('Weight saved: 69.8 kg').waitFor()
  await page.waitForTimeout(300)
  assert.equal(await page.getByText('Weigh-in time').count(), 0)
  await context.close()
})

test('mobile layout: no horizontal scroll on any tab at 360px', async () => {
  const { context, page } = await freshPage(MONDAY_11AM)
  await page.setViewportSize({ width: 360, height: 740 })
  await onboard(page)
  for (const tab of ['Today', 'Diet', 'Supps', 'Progress', 'Settings']) {
    await page.getByRole('link', { name: tab }).click()
    await page.waitForTimeout(300)
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    assert.ok(overflow <= 0, `${tab} overflows horizontally by ${overflow}px`)
  }
  await context.close()
})
