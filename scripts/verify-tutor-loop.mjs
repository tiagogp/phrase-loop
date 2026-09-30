/** Browser regression with a controlled provider and clock.
 * Start the app, then run with Playwright installed (Chrome channel required):
 * PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs node scripts/verify-tutor-loop.mjs
 * This script uses a fresh browser context; it does not touch the learner's browser data.
 */
import assert from 'node:assert/strict';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await context.newPage();
const errors = [];
page.on('pageerror', e => errors.push(e.message));
const day = 86_400_000;
const start = new Date('2026-09-29T12:00:00Z');
await page.clock.install({ time: start });
await page.route('**/api/settings', route => route.fulfill({ json: {
  defaultProvider: 'ollama', ollama: { baseUrl: 'http://localhost:11434', model: 'test-model', models: ['test-model'] },
  providers: [{ kind: 'ollama', label: 'Ollama', isLocal: true, configured: true, available: true, state: 'connected' }], writable: false, storage: 'readonly', version: 1,
} }));
let planCalls = 0;
await page.route('**/api/tutor', route => {
  const input = route.request().postDataJSON();
  if (input.action === 'help') return route.fulfill({ json: { action: 'help', answer: 'Pense em quando a experiência começou e se ela continua hoje.' } });
  if (input.action === 'plan') {
    planCalls++;
    return route.fulfill({ json: { action: 'plan', task: { goal: 'Pedir revisão de código', situation: 'Peça a uma colega para revisar seu código hoje.', instruction: 'Ask your colleague for a code review today.', successCriteria: 'Fazer um pedido claro e educado.' } } });
  }
  const error = input.text.includes('I have five years');
  const conceptId = input.context.targetConceptId ?? 'polite-requests';
  return route.fulfill({ json: { action: 'evaluate', feedback: {
    status: error ? 'partial' : 'met', feedback: error ? 'A experiência continua no presente. Ajuste a forma de expressar a duração.' : 'Você expressou a duração de uma experiência em andamento.',
    points: error ? [{ original: 'I have five years', revised: 'I have been working for five years', explanation: 'A experiência começou no passado e continua hoje.' }] : [],
    skill: { label: conceptId === 'polite-requests' ? 'Fazer pedidos com educação' : 'Falar sobre duração com present perfect', conceptId, result: error ? 'needs_work' : 'demonstrated', evidence: error ? 'I have five years' : '' },
    example: { english: 'I have been working with React for five years.', meaning: 'Trabalho com React há cinco anos.' }, retryInstruction: 'Reconstrua a resposta com suas palavras.',
  }, judge: { by: 'model', provider: 'ollama', model: 'test-model', promptVersion: 'tutor-evidence-v2' } } });
});
const sessions = () => page.evaluate(() => new Promise((resolve, reject) => {
  const request = indexedDB.open('tts-cards');
  request.onsuccess = () => { const db = request.result; const rows = db.transaction('tutorSessions').objectStore('tutorSessions').getAll(); rows.onsuccess = () => { resolve(rows.result); db.close(); }; rows.onerror = () => reject(rows.error); };
  request.onerror = () => reject(request.error);
}));
const waitText = text => page.getByText(text, { exact: false }).first().waitFor();
const back = () => page.getByRole('button', { name: /^← (Voltar|Pausar e voltar)$/ }).click();
async function expandHome() {
  const trigger = page.getByRole('button', { name: 'Outras formas de praticar', exact: true });
  if (await trigger.getAttribute('aria-expanded') !== 'true') await trigger.click();
}
async function answer(text) {
  await page.getByRole('textbox', { name: 'Sua resposta em inglês' }).fill(text);
  await page.getByRole('button', { name: 'Receber feedback', exact: true }).click();
  await page.getByRole('button', { name: 'Encerrar e ver meu resumo' }).waitFor();
}
try {
  await page.goto(process.env.TUTOR_BASE_URL || 'http://127.0.0.1:3087');
  await page.getByRole('heading', { name: 'Uma situação. Uma resposta sua.' }).waitFor();
  await page.getByRole('button', { name: 'Começar minha primeira prática →' }).click();
  const profile = await page.evaluate(() => JSON.parse(localStorage.getItem('phraseloop.learningProfile.v1')));
  assert.equal(profile.level, 'A2'); assert.equal(profile.objective, 'professional');
  await page.getByRole('textbox', { name: 'Sua resposta em inglês' }).waitFor();
  assert.equal(planCalls, 0, 'recommended catalog practice should start directly');
  await answer('I have five years working with React.');
  await page.getByRole('button', { name: 'Tentar novamente com minhas palavras' }).click();
  await answer("I've worked with React since 2021.");
  await page.getByRole('button', { name: 'Encerrar e ver meu resumo' }).click();
  await page.getByText('Minhas tentativas e evidências', { exact: true }).click();
  await waitText('Acertos com apoio: 1. Sessões com melhora após feedback: 1.');
  const dayOne = (await sessions())[0];
  assert.equal(dayOne.task.scenarioId, 'duration-interview-v1');
  assert.equal(dayOne.attempts.length, 2);
  assert.equal(dayOne.exposures.filter(e => e.kind === 'feedback').length, 2);
  await back();
  await page.clock.setSystemTime(new Date(start.getTime() + day + 120_000));
  await page.reload();
  await waitText('Você conseguiu com apoio');
  await page.getByRole('button', { name: /Começar prática/ }).click();
  await page.getByRole('textbox', { name: 'Sua resposta em inglês' }).waitFor();
  assert.equal(await page.getByText('I have been working with React for five years.', { exact: true }).count(), 0, 'return should not reveal previous example');
  await answer("I've been working remotely for two years. I like my home office.");
  await page.getByRole('button', { name: 'Encerrar e ver meu resumo' }).click();
  await page.getByText('Minhas tentativas e evidências', { exact: true }).click();
  await waitText('Transferência observada.');
  const dayTwo = (await sessions()).find(s => s.parentSessionId === dayOne.id);
  assert.equal(dayTwo.task.scenarioId, 'duration-remote-v1');
  assert.equal(dayTwo.attempts[0].supportUsed, false);
  assert.equal(dayTwo.nextReviewAt - dayTwo.completedAt, 7 * day);
  await page.screenshot({ path: '/tmp/phraseloop-tutor-day-two.png' });
  await back();
  await page.getByRole('button', { name: /Ver meu progresso/ }).click();
  await waitText('Seu progresso com o tutor');
  await page.getByRole('button', { name: 'Ver habilidades e comparar respostas' }).click();
  await waitText('Dificuldade observada');
  assert.equal(await page.getByText('Transferência observada', { exact: true }).count(), 1);
  const exposed = await sessions();
  assert.ok(exposed.every(s => s.exposures.some(e => e.kind === 'history')));
  await page.screenshot({ path: '/tmp/phraseloop-tutor-progress.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'progress must fit a narrow screen');
  await page.screenshot({ path: '/tmp/phraseloop-tutor-mobile.png' });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.getByRole('tab', { name: 'Hoje', exact: true }).click();
  await expandHome();
  await page.getByRole('button', { name: /Praticar algo novo/ }).click();
  await page.getByRole('button', { name: 'Começar a sessão' }).click();
  await page.getByRole('textbox', { name: 'Sua resposta em inglês' }).fill('Unsent draft for a new task');
  await back();
  const active = (await sessions()).find(s => s.phase !== 'complete');
  assert.ok(active);
  await expandHome();
  await page.getByRole('button', { name: /Praticar algo novo/ }).click();
  await page.getByRole('button', { name: 'Começar a sessão' }).waitFor();
  assert.equal(await page.getByRole('textbox', { name: 'Sua resposta em inglês' }).count(), 0, 'new mode must not resume the active draft');
  await back();
  await expandHome();
  await page.getByRole('button', { name: /Adicionar algo que encontrei/ }).click();
  await page.getByRole('textbox', { name: 'Frase em inglês', exact: true }).fill('Could you review my code today?');
  await page.getByRole('textbox', { name: 'Significado em português', exact: true }).fill('Você poderia revisar meu código hoje?');
  await page.getByRole('button', { name: 'Salvar frase', exact: true }).click();
  await page.getByRole('button', { name: 'Praticar uma situação com esta frase' }).click();
  await page.getByRole('textbox', { name: 'Sua resposta em inglês' }).waitFor();
  const source = (await sessions()).find(s => s.sourceCardId);
  assert.ok(source?.supportUsed);
  assert.ok(source.exposures.some(e => e.kind === 'source'));
  assert.equal(source.parentSessionId, undefined);
  assert.equal(planCalls, 1);
  assert.ok((await sessions()).some(s => s.id === active.id && s.draft === 'Unsent draft for a new task'));
  assert.deepEqual(errors, []);
  console.log('PASS: onboarding A2/work; one-click practice; day-one retry; persisted day-two transfer; progress exposure; separate new practice; source handoff; preserved active draft. Provider and clock were controlled.');
} catch (error) {
  console.error((await page.locator('body').innerText()).slice(-9000));
  await page.screenshot({ path: '/tmp/phraseloop-tutor-failure.png' });
  throw error;
} finally { await browser.close(); }
