import puppeteer from './frontend/node_modules/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js';
import path from 'path';

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const artifactDir = 'C:\\Users\\SUDHAKAR\\.gemini\\antigravity-ide\\brain\\18256292-fde2-4a9f-a80c-ebafe50ba77d';

async function verifyEnterpriseLook() {
  console.log('Starting Enterprise CSS Verification on live site...');
  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1440,900']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  const targetUrl = process.argv[2] || 'https://aibuildercup2026-26b22.web.app';
  console.log(`Navigating to ${targetUrl}...`);
  await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 35000 });

  // 1. Ensure authenticated
  const isAuth = await page.evaluate(() => !!document.querySelector('.app-shell'));
  if (!isAuth) {
    console.log('Authenticating via demo account...');
    const navSignIn = await page.waitForSelector('.nav-secondary-btn', { timeout: 10000 });
    await navSignIn.click();
    await new Promise(r => setTimeout(r, 600));

    const googleBtn = await page.waitForSelector('.google-auth-btn', { timeout: 10000 });
    await googleBtn.click();
    await new Promise(r => setTimeout(r, 600));

    const alexChip = await page.waitForSelector('.google-profile-chip', { timeout: 10000 });
    await alexChip.click();
    await new Promise(r => setTimeout(r, 2000));
  }

  // Helper to switch tab
  async function selectTab(tabName) {
    await page.evaluate((name) => {
      const buttons = Array.from(document.querySelectorAll('.side-nav button'));
      const btn = buttons.find(b => b.textContent && b.textContent.includes(name));
      if (btn) btn.click();
    }, tabName);
    await new Promise(r => setTimeout(r, 1200));
  }

  // Helper to switch role
  async function setRole(roleName) {
    await page.evaluate((role) => {
      const select = document.querySelector('.top-role-switch select');
      if (select) {
        select.value = role;
        select.dispatchEvent(new Event('change'));
      }
    }, roleName);
    await new Promise(r => setTimeout(r, 1500));
  }

  console.log('--- Verifying Student Views ---');
  await setRole('student');

  // Verify Student -> My learning
  console.log('Viewing Student -> My learning...');
  await selectTab('My learning');
  await page.screenshot({ path: path.join(artifactDir, 'verified_student_my_learning.png') });

  // Verify Student -> Open Report Modal
  console.log('Opening Report Modal...');
  await page.evaluate(() => {
    const reportBtn = document.querySelector('.skill-link');
    if (reportBtn) reportBtn.click();
  });
  await new Promise(r => setTimeout(r, 1000));
  await page.screenshot({ path: path.join(artifactDir, 'verified_report_modal.png') });

  // Close report modal
  console.log('Closing Report Modal...');
  try {
    const closeDoneBtn = await page.waitForSelector('.report-modal .report-done', { timeout: 3000 });
    if (closeDoneBtn) {
      await closeDoneBtn.click();
    }
  } catch (err) {
    console.warn('Could not click report-done, clicking modal-close:', err.message);
    const closeX = await page.waitForSelector('.report-modal .modal-close', { timeout: 2000 });
    if (closeX) await closeX.click();
  }
  await new Promise(r => setTimeout(r, 1500));

  // Verify Student -> Reports tab
  console.log('Viewing Student -> Reports tab...');
  await selectTab('Reports');
  await page.screenshot({ path: path.join(artifactDir, 'verified_student_reports.png') });

  console.log('--- Verifying Teacher Views ---');
  await setRole('teacher');

  // Verify Teacher -> Cohort Pulse
  console.log('Viewing Teacher -> Cohort Pulse...');
  await selectTab('Cohort Pulse');
  await page.screenshot({ path: path.join(artifactDir, 'verified_teacher_cohort_pulse.png') });

  // Verify Teacher -> Curriculum Manager
  console.log('Viewing Teacher -> Curriculum Manager...');
  await selectTab('Curriculum Manager');
  await page.screenshot({ path: path.join(artifactDir, 'verified_teacher_curriculum_manager.png') });

  console.log('--- Verifying Admin Views ---');
  await setRole('admin');

  // Verify Admin -> Platform Health
  console.log('Viewing Admin -> Platform Health...');
  await selectTab('Platform Health');
  await page.screenshot({ path: path.join(artifactDir, 'verified_admin_platform_health.png') });

  // Verify Admin -> Course Catalog
  console.log('Viewing Admin -> Course Catalog...');
  await selectTab('Course Catalog');
  await page.screenshot({ path: path.join(artifactDir, 'verified_admin_course_catalog.png') });

  console.log('All views successfully verified and captured!');
  await browser.close();
}

verifyEnterpriseLook().catch(err => {
  console.error('Verification failed:', err);
  process.exit(1);
});
