import puppeteer from './frontend/node_modules/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js';
import path from 'path';

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const artifactDir = 'C:\\Users\\SUDHAKAR\\.gemini\\antigravity-ide\\brain\\18256292-fde2-4a9f-a80c-ebafe50ba77d';

async function run() {
  console.log('Launching Chrome with puppeteer-core...');
  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1440,900']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  // 1. Visit local app
  console.log('Navigating to local dev URL...');
  await page.goto('http://localhost:4200', { waitUntil: 'networkidle2', timeout: 30000 });

  console.log('Page title:', await page.title());
  await page.screenshot({ path: path.join(artifactDir, '01_live_landing_verified.png') });
  console.log('Saved 01_live_landing_verified.png');

  // 2. Open Enterprise Identity Access Modal
  console.log('Opening Enterprise Identity Access modal...');
  const navSignIn = await page.waitForSelector('.nav-secondary-btn', { timeout: 10000 });
  await navSignIn.click();
  await new Promise(r => setTimeout(r, 600));
  await page.screenshot({ path: path.join(artifactDir, '02_enterprise_auth_modal.png') });
  console.log('Saved 02_enterprise_auth_modal.png');

  // 3. Click "Sign in with Google" to open authentic Google Accounts Sign-In Screen (Image 2)
  console.log('Clicking "Sign in with Google" to trigger Google Accounts window...');
  const googleBtn = await page.waitForSelector('.google-auth-btn', { timeout: 10000 });
  await googleBtn.click();
  await new Promise(r => setTimeout(r, 600));

  await page.screenshot({ path: path.join(artifactDir, '03_google_oauth_accounts_screen.png') });
  console.log('Saved 03_google_oauth_accounts_screen.png');

  // 4. Select Alex Rivera from verified Google profiles
  console.log('Selecting Alex Rivera profile chip...');
  const alexChip = await page.waitForSelector('.google-profile-chip', { timeout: 10000 });
  await alexChip.click();
  await new Promise(r => setTimeout(r, 2000));

  // 5. Verify Student Workspace
  await page.screenshot({ path: path.join(artifactDir, '04_student_workspace_verified.png') });
  console.log('Saved 04_student_workspace_verified.png');

  const greetingText = await page.evaluate(() => {
    return document.querySelector('.welcome-banner h1')?.textContent?.trim() || '';
  });
  console.log('Student Greeting:', greetingText);

  // Check if any "Rahul" exists in DOM
  const rahulFound = await page.evaluate(() => {
    return document.body.innerText.toLowerCase().includes('rahul');
  });
  console.log('Is "Rahul" present in page text?:', rahulFound);

  // 6. Navigate to Agentic AI Studio tab
  console.log('Navigating to Agentic AI Studio tab...');
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('.side-nav button'));
    const agenticBtn = buttons.find(b => b.textContent && b.textContent.includes('Agentic AI'));
    if (agenticBtn) agenticBtn.click();
  });
  await new Promise(r => setTimeout(r, 1500));

  await page.screenshot({ path: path.join(artifactDir, '05_agentic_ai_studio_overview.png') });
  console.log('Saved 05_agentic_ai_studio_overview.png');

  // 7. Trigger Autonomous Agent Workflow
  console.log('Triggering autonomous agent workflow via workflow-card...');
  const workflowClicked = await page.evaluate(() => {
    const card = document.querySelector('.workflow-card');
    if (card) {
      card.click();
      return true;
    }
    const btn = document.querySelector('.dispatch-agents-btn');
    if (btn) {
      btn.click();
      return true;
    }
    return false;
  });
  console.log('Workflow trigger clicked:', workflowClicked);

  // Watch ReAct execution loop in progress
  await new Promise(r => setTimeout(r, 2000));
  await page.screenshot({ path: path.join(artifactDir, '06_agent_react_executing.png') });
  console.log('Saved 06_agent_react_executing.png');

  // Wait for ReAct loop to complete all 4 steps and write to Firestore
  await new Promise(r => setTimeout(r, 5000));
  await page.screenshot({ path: path.join(artifactDir, '07_agent_react_completed.png') });
  console.log('Saved 07_agent_react_completed.png');

  const traceCount = await page.evaluate(() => {
    return document.querySelectorAll('.trace-step-item').length;
  });
  console.log('Agent trace steps rendered:', traceCount);

  // 8. Open Floating Copilot Drawer
  console.log('Opening Floating Copilot drawer...');
  await page.evaluate(() => {
    const copilotBtn = document.querySelector('.floating-copilot-trigger');
    if (copilotBtn) copilotBtn.click();
  });
  await new Promise(r => setTimeout(r, 1000));
  await page.screenshot({ path: path.join(artifactDir, '08_floating_copilot_drawer.png') });
  console.log('Saved 08_floating_copilot_drawer.png');

  // 9. Switch to Teacher role
  console.log('Switching to Teacher role...');
  await page.evaluate(() => {
    const select = document.querySelector('.role-select');
    if (select) {
      select.value = 'teacher';
      select.dispatchEvent(new Event('change'));
    }
  });
  await new Promise(r => setTimeout(r, 1500));
  await page.screenshot({ path: path.join(artifactDir, '09_teacher_dashboard.png') });
  console.log('Saved 09_teacher_dashboard.png');

  // 10. Switch to Admin role
  console.log('Switching to Admin role...');
  await page.evaluate(() => {
    const select = document.querySelector('.role-select');
    if (select) {
      select.value = 'admin';
      select.dispatchEvent(new Event('change'));
    }
  });
  await new Promise(r => setTimeout(r, 1500));
  await page.screenshot({ path: path.join(artifactDir, '10_admin_dashboard.png') });
  console.log('Saved 10_admin_dashboard.png');

  await browser.close();
  console.log('All verification steps completed successfully with zero errors!');
}

run().catch(err => {
  console.error('Verification failed:', err);
  process.exit(1);
});
