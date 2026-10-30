const { _electron: electron } = require('playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
const os = require('node:os');
const fs = require('node:fs/promises');
(async () => {
  const userData = await fs.mkdtemp(path.join(os.tmpdir(), 'bottleneck-test-'));
  const app = await electron.launch({ args: ['.', '--user-data-dir='+userData] });
  try {
    const page = await app.firstWindow();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    assert.equal(await page.locator('#library').count(),0);
    await page.locator('#scan').click();
    await page.waitForFunction(() => document.querySelector('#profile-tag').textContent === 'DETECTED', { timeout: 30000 });
    await page.locator('#manual').click();
    await page.locator('[name="gpu"]').fill('NVIDIA GeForce RTX 3060');
    await page.locator('[name="ram"]').fill('16');
    await page.locator('#edit-form button[type="submit"]').click();
    await page.locator('#query').fill('1091500');
    await page.locator('#search-form button').click();
    await page.locator('#detail').waitFor({state:'visible',timeout:30000});
    assert.equal(await page.locator('#add-benchmark').count(),0);
    assert.equal(await page.locator('#save-game').count(),0);
    await page.waitForFunction(() => /FPS/.test(document.querySelector('#overview-fps strong')?.textContent ?? ''),{timeout:60000});
    for (const size of [{width:1180,height:820},{width:900,height:680}]) {
      await page.setViewportSize(size);
      assert.equal(await page.evaluate(()=>document.documentElement.scrollHeight <= innerHeight),true);
      assert.equal(await page.evaluate(()=>document.querySelector('.panel-body').scrollHeight <= document.querySelector('.panel-body').clientHeight),true);
    }
    await page.setViewportSize({width:1180,height:820});
    await page.locator('#tab-benchmarks').click();
    assert.match(await page.locator('#fps-result').innerText(),/Low confidence/);
    await page.waitForFunction(()=>document.querySelector('#device-results').textContent.includes('SteamFPS device references'),{timeout:30000});
    await page.locator('#resolution').selectOption('3840×2160');
    assert.match(await page.locator('#fps-result').innerText(),/supports 1080p High/);
    await page.locator('#preset').selectOption('Ultra');
    await page.locator('#reference-scope').selectOption('all');
    await page.locator('.public-result').first().waitFor({timeout:30000});
    assert.match(await page.locator('#public-results').innerText(),/58 AVG FPS/);
    await page.locator('#resolution').selectOption('1920×1080');
    await page.locator('#preset').selectOption('High');
    await page.waitForFunction(()=>document.getAnimations().every(animation=>animation.playState==='finished'));
    await page.screenshot({path:path.join(userData,'preview.png'),fullPage:true});
    console.log('Passed: hardware scan, automatic PC estimate, SteamFPS references, measured references, removed features, viewport layout.');
    console.log('Screenshot: '+path.join(userData,'preview.png'));
    assert.deepEqual(errors,[]);
  } finally { await app.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
