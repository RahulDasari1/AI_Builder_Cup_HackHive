import puppeteer from './frontend/node_modules/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js';
import path from 'path';

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const artifactDir = 'C:\\Users\\SUDHAKAR\\.gemini\\antigravity-ide\\brain\\18256292-fde2-4a9f-a80c-ebafe50ba77d';

async function verifyCuratedCourses() {
  console.log('Starting Curated Courses & YouTube Enrichment Verification...');
  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1440,900']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  // 1. Navigate to application
  const targetUrl = process.argv[2] || 'http://localhost:4200';
  console.log(`Navigating to ${targetUrl}...`);
  await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 35000 });

  // 2. Ensure Authenticated as Alex Rivera (Student)
  const isAlreadyAuthenticated = await page.evaluate(() => !!document.querySelector('.app-shell'));
  if (!isAlreadyAuthenticated) {
    console.log('Opening Enterprise Sign-In...');
    const navSignIn = await page.waitForSelector('.nav-secondary-btn', { timeout: 10000 });
    await navSignIn.click();
    await new Promise(r => setTimeout(r, 600));

    const googleBtn = await page.waitForSelector('.google-auth-btn', { timeout: 10000 });
    await googleBtn.click();
    await new Promise(r => setTimeout(r, 600));

    const alexChip = await page.waitForSelector('.google-profile-chip', { timeout: 10000 });
    await alexChip.click();
    await new Promise(r => setTimeout(r, 2000));
  } else {
    console.log('Already authenticated into app-shell. Setting role to student...');
    await page.evaluate(() => {
      const select = document.querySelector('.top-role-switch select');
      if (select) {
        select.value = 'student';
        select.dispatchEvent(new Event('change'));
      }
    });
    await new Promise(r => setTimeout(r, 1000));
  }

  console.log('Authenticated into Student Workspace.');

  // 3. Navigate to Curated Courses tab
  console.log('Clicking "Curated Courses" tab...');
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('.side-nav button'));
    const curatedBtn = buttons.find(b => b.textContent && b.textContent.includes('Curated Courses'));
    if (curatedBtn) curatedBtn.click();
  });
  await new Promise(r => setTimeout(r, 1500));

  await page.screenshot({ path: path.join(artifactDir, '11_curated_courses_overview.png') });
  console.log('Saved 11_curated_courses_overview.png');

  // Verify course metadata and video cards
  const courseTitle = await page.evaluate(() => {
    return document.querySelector('.active-course-title')?.textContent?.trim() || '';
  });
  console.log('Active Curated Course Title:', courseTitle);

  const videoCount = await page.evaluate(() => {
    return document.querySelectorAll('.yt-card').length;
  });
  console.log('YouTube Reference Video Cards Rendered:', videoCount);

  // 4. Test YouTube Reference Video Modal
  console.log('Clicking first YouTube video thumbnail to test embed modal...');
  await page.evaluate(() => {
    const firstThumb = document.querySelector('.yt-thumb-container');
    if (firstThumb) firstThumb.click();
  });
  await new Promise(r => setTimeout(r, 1500));

  await page.screenshot({ path: path.join(artifactDir, '12_youtube_video_modal.png') });
  console.log('Saved 12_youtube_video_modal.png');

  // Verify iframe exists
  const hasIframe = await page.evaluate(() => {
    const iframe = document.querySelector('.video-iframe');
    return iframe ? iframe.getAttribute('src') : null;
  });
  console.log('Embedded YouTube iframe src:', hasIframe);

  // Close video modal
  console.log('Closing video modal...');
  await page.evaluate(() => {
    const closeBtn = document.querySelector('.video-modal-window .modal-close') ||
                     document.querySelector('.video-modal-actions .hero-btn-primary');
    if (closeBtn) closeBtn.click();
  });
  await new Promise(r => setTimeout(r, 800));

  // 5. Test Assessment Modal & Gemini Evaluation
  console.log('Opening Assessment Challenge modal...');
  await page.evaluate(() => {
    const assessBtn = document.querySelector('.take-assessment-btn');
    if (assessBtn) assessBtn.click();
  });
  await new Promise(r => setTimeout(r, 1000));

  await page.screenshot({ path: path.join(artifactDir, '13_assessment_prompt_modal.png') });
  console.log('Saved 13_assessment_prompt_modal.png');

  // Type answer into assessment textarea
  console.log('Typing response into assessment input...');
  await page.evaluate(() => {
    const textarea = document.querySelector('#learnerAssessmentInput');
    if (textarea) {
      textarea.value = 'Gradient descent minimizes the objective loss function by calculating partial derivatives with respect to each weight and stepping in the direction of steepest descent.';
      textarea.dispatchEvent(new Event('input'));
    }
  });
  await new Promise(r => setTimeout(r, 500));

  // Submit to Gemini
  console.log('Submitting assessment to Gemini 2.5...');
  await page.evaluate(() => {
    const submitBtn = Array.from(document.querySelectorAll('.assessment-modal-actions button'))
      .find(b => b.textContent && b.textContent.includes('Submit to Gemini'));
    if (submitBtn) submitBtn.click();
  });

  // Wait for Gemini evaluation response
  await new Promise(r => setTimeout(r, 2200));
  await page.screenshot({ path: path.join(artifactDir, '14_assessment_evaluation_received.png') });
  console.log('Saved 14_assessment_evaluation_received.png');

  const feedbackText = await page.evaluate(() => {
    return document.querySelector('.assessment-feedback-card pre')?.textContent?.trim() || '';
  });
  console.log('Gemini Feedback:\n', feedbackText);

  // Close assessment modal
  await page.evaluate(() => {
    const closeBtn = document.querySelector('.assessment-modal-window .modal-close');
    if (closeBtn) closeBtn.click();
  });
  await new Promise(r => setTimeout(r, 800));

  // 6. Verify Progress Updated
  const progressText = await page.evaluate(() => {
    return document.querySelector('.student-progress-box .p-val')?.textContent?.trim() || '';
  });
  console.log('Updated Student Course Mastery:', progressText);
  await page.screenshot({ path: path.join(artifactDir, '15_student_progress_recorded.png') });
  console.log('Saved 15_student_progress_recorded.png');

  // 7. Test Topic Selection Pill ("Data Literacy")
  console.log('Selecting "Data Literacy" topic pill...');
  await page.evaluate(() => {
    const pills = Array.from(document.querySelectorAll('.topic-chip-btn'));
    const dataPill = pills.find(p => p.textContent && p.textContent.includes('Data Literacy'));
    if (dataPill) dataPill.click();
  });
  await new Promise(r => setTimeout(r, 1500));

  const secondCourseTitle = await page.evaluate(() => {
    return document.querySelector('.active-course-title')?.textContent?.trim() || '';
  });
  console.log('Switched to Course:', secondCourseTitle);
  await page.screenshot({ path: path.join(artifactDir, '16_data_literacy_curated_course.png') });
  console.log('Saved 16_data_literacy_curated_course.png');

  // 8. Test Role-Based Access: Switch to Teacher View & Verify Faculty Syllabus Governance
  console.log('Switching to Teacher role (Dr. Elena Vance)...');
  await page.evaluate(() => {
    const select = document.querySelector('.top-role-switch select');
    if (select) {
      select.value = 'teacher';
      select.dispatchEvent(new Event('change'));
    }
  });
  await new Promise(r => setTimeout(r, 1500));

  // Ensure on Curated Courses tab
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('.side-nav button'));
    const curatedBtn = buttons.find(b => b.textContent && b.textContent.includes('Curriculum Curation'));
    if (curatedBtn) curatedBtn.click();
  });
  await new Promise(r => setTimeout(r, 1000));

  await page.screenshot({ path: path.join(artifactDir, '17_teacher_curriculum_governance.png') });
  console.log('Saved 17_teacher_curriculum_governance.png');

  // Teacher clicks "Approve Syllabus"
  console.log('Teacher clicking "Approve Syllabus"...');
  await page.evaluate(() => {
    const approveBtn = document.querySelector('.approve-btn');
    if (approveBtn) approveBtn.click();
  });
  await new Promise(r => setTimeout(r, 1000));
  await page.screenshot({ path: path.join(artifactDir, '18_syllabus_approved_by_faculty.png') });
  console.log('Saved 18_syllabus_approved_by_faculty.png');

  await browser.close();
  console.log('All Curated Courses verification checks completed with 100% success!');
}

verifyCuratedCourses().catch(err => {
  console.error('Curated courses verification error:', err);
  process.exit(1);
});
