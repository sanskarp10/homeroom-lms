#!/usr/bin/env python3
"""
Browser smoke test for Homeroom (optional).

Drives real Chromium through the main journeys, including a two-person live
class over WebRTC using Chromium's fake camera and microphone.

    pip install playwright && playwright install chromium
    npm run build && npm start            # app on http://localhost:4000 with demo data
    python3 scripts/e2e_smoke.py [BASE_URL] [path/to/any-video.mp4]

It needs the demo data (npm run seed -- --reset) and prints PASS/FAIL per step.
"""
import asyncio, sys, time
from playwright.async_api import async_playwright, expect

BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:4000'
VIDEO = sys.argv[2] if len(sys.argv) > 2 else None
PASSWORD = 'homeroom123'
results = []

async def step(name, coro):
    t = time.time()
    try:
        await coro
        results.append((name, True, time.time() - t, ''))
        print(f'PASS  {name}  ({time.time() - t:.1f}s)', flush=True)
    except Exception as e:  # noqa: BLE001
        results.append((name, False, time.time() - t, str(e).split('\n')[0][:200]))
        print(f'FAIL  {name}: {str(e)[:400]}', flush=True)

async def login(page, email):
    await page.goto(f'{BASE}/login')
    await page.fill('input[type=email]', email)
    await page.fill('input[type=password]', PASSWORD)
    await page.click('button[type=submit]')
    await page.wait_for_url(lambda u: '/login' not in u)

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(args=['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required'])
        errors = []
        async def new_page(viewport=(1360, 900)):
            ctx = await browser.new_context(viewport={'width': viewport[0], 'height': viewport[1]}, permissions=['camera', 'microphone'])
            page = await ctx.new_page()
            page.on('pageerror', lambda e: errors.append(str(e)))
            return page

        student = await new_page()
        teacher = await new_page()

        # ---- Catalog and search (signed out) ----
        async def catalog():
            await student.goto(f'{BASE}/courses')
            await expect(student.get_by_role('heading', name='Courses', exact=True)).to_be_visible()
            await student.fill('input[type=search]', 'sql')
            await expect(student.get_by_text('1 course for "sql"')).to_be_visible()
            await student.get_by_role('link', name='SQL for analysts').click()
            await expect(student.get_by_role('heading', level=1, name='SQL for analysts')).to_be_visible()
        await step('catalog search finds a course', catalog())

        async def preview():
            await student.get_by_role('button', name='Preview').first.click()
            video = student.locator('[role=dialog] video')
            await expect(video).to_be_visible()
            await student.wait_for_function("() => { const v = document.querySelector('[role=dialog] video'); return v && v.readyState >= 2 && v.videoWidth > 0; }", timeout=15000)
            await student.keyboard.press('Escape')
        await step('free preview video streams over HLS without signing in', preview())

        # ---- Purchase through the test gateway ----
        async def buy():
            await login(student, 'sam@homeroom.test')
            await student.goto(f'{BASE}/courses/sql-for-analysts')
            await student.get_by_role('button', name='Buy this course').click()
            await student.wait_for_url('**/checkout/**')
            await student.fill('input[autocomplete=cc-name]', 'Sam Carter')
            await student.fill('input[autocomplete=cc-number]', '4000000000000002')
            await student.fill('input[autocomplete=cc-exp]', '1234')
            await student.fill('input[autocomplete=cc-csc]', '123')
            await student.get_by_role('button', name='Pay $59').click()
            await expect(student.get_by_role('alert')).to_contain_text('declined')
            await student.get_by_role('button', name='Fill in the test card').click()
            await student.get_by_role('button', name='Pay $59').click()
            await student.wait_for_url('**/learn/**')
        await step('checkout: declined card is rejected, test card enrolls the student', buy())

        # ---- Player: video with quality levels, article, quiz ----
        async def watch():
            await student.wait_for_function("() => { const v = document.querySelector('video'); return v && v.readyState >= 2 && v.videoWidth > 0; }", timeout=15000)
            await expect(student.get_by_label('Quality')).to_be_visible()   # adaptive renditions detected by hls.js
            await student.get_by_role('button', name='Next lesson').click()
            await expect(student.get_by_role('heading', level=1, name='GROUP BY in one picture')).to_be_visible()
            await student.get_by_role('button', name='Complete and continue').click()
            await expect(student.get_by_role('heading', level=1, name='Running totals and rankings')).to_be_visible()
        await step('player: HLS video plays with a quality menu, article completes', watch())

        async def quiz():
            await student.get_by_role('link', name='Quiz: grouping and windows').click()
            await student.get_by_label('WHERE', exact=True).check()                     # wrong
            await student.get_by_label('True', exact=True).check()                      # wrong
            await student.get_by_label('The join key is not unique in one table').check()  # right
            await student.get_by_role('button', name='Submit answers').click()
            await expect(student.get_by_text('Not passed yet')).to_be_visible()
            await expect(student.get_by_text('33%')).to_be_visible()
            await student.get_by_role('button', name='Try again').click()
            await student.get_by_label('HAVING', exact=True).check()
            await student.get_by_label('False', exact=True).check()
            await student.get_by_label('The join key is not unique in one table').check()
            await student.get_by_role('button', name='Submit answers').click()
            await expect(student.get_by_text('Passed', exact=True)).to_be_visible()
            await expect(student.get_by_text('100%').first).to_be_visible()
        await step('quiz: wrong answers fail with explanations, a retake passes', quiz())

        # ---- Finish a course and get the certificate ----
        async def certificate():
            await student.goto(f'{BASE}/courses/japanese-for-travellers')
            await student.get_by_role('button', name='Enroll for free').click()
            await student.wait_for_url('**/learn/**')
            await student.wait_for_function("() => { const v = document.querySelector('video'); return v && v.readyState >= 1; }", timeout=15000)
            await student.get_by_label('Mark as complete').check()
            await student.get_by_role('button', name='Next lesson').click()
            await student.get_by_role('button', name='Complete and continue').click()
            await student.get_by_label('Ohayou gozaimasu').check()
            await student.get_by_label('True', exact=True).check()
            await student.get_by_role('button', name='Submit answers').click()
            await expect(student.get_by_role('dialog', name='Course complete')).to_be_visible()
            href = await student.get_by_role('link', name='Download certificate').get_attribute('href')
            res = await student.request.get(f'{BASE}{href}')
            assert res.ok and (await res.body())[:5] == b'%PDF-', 'certificate is not a PDF'
            await student.get_by_role('button', name='Keep reviewing').click()
            await student.goto(f'{BASE}/certificates')
            await expect(student.get_by_role('heading', name='Japanese for travellers')).to_be_visible()
        await step('finishing every lesson issues a PDF certificate', certificate())

        # ---- Instructor: build a course, upload a video, publish ----
        async def build():
            await login(teacher, 'maya@homeroom.test')
            await teacher.goto(f'{BASE}/teach')
            await expect(teacher.get_by_text('Earned all time')).to_be_visible()
            await teacher.get_by_role('button', name='New course').first.click()
            await teacher.get_by_label('Course title').fill('Smoke test course')
            await teacher.get_by_label('Price (USD)').fill('15')
            await teacher.get_by_role('button', name='Create draft').click()
            await teacher.wait_for_url('**/teach/courses/**')
            await teacher.get_by_role('button', name='Reading', exact=True).click()
            await teacher.get_by_label('Lesson title').fill('Welcome')
            await teacher.locator('textarea').first.fill('## Hello\n\nThis lesson was written by the smoke test.')
            await teacher.get_by_role('button', name='Save lesson').click()
            await expect(teacher.get_by_text('All changes saved')).to_be_visible()
            await teacher.get_by_role('button', name='Quiz', exact=True).click()
            await teacher.get_by_label('Lesson title').fill('Check in')
            await teacher.get_by_role('button', name='Add a question').click()
            await teacher.get_by_label('Question', exact=True).fill('Is this a test?')
            await teacher.get_by_label('Answer type').select_option('boolean')
            await teacher.get_by_role('button', name='Save lesson').click()
            await expect(teacher.get_by_text('All changes saved')).to_be_visible()
        await step('instructor creates a course with a reading and a quiz', build())

        if VIDEO:
            async def upload():
                await teacher.get_by_role('button', name='Video', exact=True).click()
                await teacher.get_by_label('Lesson title').fill('Intro video')
                await teacher.get_by_role('button', name='Save lesson').click()
                await teacher.locator('input[type=file]').set_input_files(VIDEO)
                await expect(teacher.get_by_text('Ready to stream')).to_be_visible(timeout=180000)
                await teacher.wait_for_function("() => { const v = document.querySelector('video'); return v && v.readyState >= 1; }", timeout=15000)
            await step('video upload is transcoded by the background worker and becomes streamable', upload())

        async def publish():
            await teacher.get_by_role('button', name='Publish').click()
            await expect(teacher.get_by_role('alert')).to_contain_text('description')
            await teacher.get_by_role('tab', name='Details and price').click()
            await teacher.get_by_label('Description').fill('A course created by the automated smoke test to prove the builder works end to end.')
            await teacher.get_by_role('button', name='Save details').click()
            await expect(teacher.get_by_text('All changes saved')).to_be_visible()
            await teacher.get_by_role('button', name='Publish').click()
            await expect(teacher.get_by_role('button', name='Unpublish')).to_be_visible()
        await step('publish is blocked until the checklist passes, then goes live', publish())

        # ---- Live class over WebRTC, two real browsers ----
        async def live():
            await teacher.goto(f'{BASE}/live')
            await teacher.get_by_role('link', name='Office hours: your hooks questions').first.click()
            await teacher.wait_for_url('**/live/**')
            url = teacher.url
            await student.goto(url)
            await expect(student.get_by_text('Waiting for Maya to start the class')).to_be_visible()
            await teacher.get_by_role('button', name='Start the class').click()
            await expect(teacher.get_by_role('button', name='Leave the class')).to_be_visible()
            await student.get_by_role('button', name='Join the class').click(timeout=15000)   # lobby polls and unlocks by itself
            await expect(student.get_by_role('button', name='Leave the class')).to_be_visible()
            remote = "() => [...document.querySelectorAll('video')].filter(v => !v.muted && v.srcObject && v.videoWidth > 0 && v.srcObject.getAudioTracks().length > 0).length >= 1"
            await teacher.wait_for_function(remote, timeout=20000)
            await student.wait_for_function(remote, timeout=20000)
            await student.get_by_role('textbox', name='Message').fill('Hello from the smoke test')
            await student.get_by_role('button', name='Send message').click()
            await expect(teacher.get_by_text('Hello from the smoke test')).to_be_visible()
            await student.get_by_role('button', name='Raise your hand').click()
            await teacher.get_by_role('tab', name='People (2)').click()
            await expect(teacher.get_by_role('button', name='Hand up')).to_be_visible()
            await teacher.get_by_role('button', name='End class').first.click()
            await teacher.get_by_role('dialog').get_by_role('button', name='End class').click()
            await expect(student.get_by_text('This class has ended')).to_be_visible()
        await step('live class: two browsers exchange audio/video over WebRTC, chat and raise hand work', live())

        async def admin():
            page = await new_page()
            await login(page, 'admin@homeroom.test')
            await page.goto(f'{BASE}/admin')
            await expect(page.get_by_text('Sales, all time')).to_be_visible()
            await page.get_by_role('tab', name='People').click()
            await page.fill('input[type=search]', 'sam@homeroom')
            await expect(page.get_by_text('Sam Carter')).to_be_visible()
        await step('admin sees platform totals and can search people', admin())

        await browser.close()
        failed = [r for r in results if not r[1]]
        print(f'\n{len(results) - len(failed)}/{len(results)} journeys passed' + (f'; page errors: {errors[:3]}' if errors else '; no uncaught page errors'))
        sys.exit(1 if failed else 0)

asyncio.run(main())
