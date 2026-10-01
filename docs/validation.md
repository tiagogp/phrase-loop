# PhraseLoop — Validação

Protocolo e registros reunidos em 30/09/2026. Não há resultados de alunos inseridos aqui.
Testes de software e provedores simulados estão no [histórico](history.md).
Critérios de evidência do app estão em [product.md](product.md#evidência-e-agenda).

## Descoberta de produto: tutor e retorno

Observar alunos A2–B1 com necessidades profissionais no percurso atual: boas-vindas →
resposta própria → feedback → retry → encerramento → retorno elegível em outro dia.
O caminho sem IA começa com produção local a partir da lição, antes dos exemplos,
comparação e autoavaliação explícita. A autoavaliação não comprova acerto nem transferência. As lições completas continuam disponíveis em Explorar.

Perguntas: a pessoa começa sem orientação externa, entende o ajuste, reconhece a razão da
retomada e aponta uma resposta concreta com menos apoio? Registrar abandono por excesso de
opções, conexão, dificuldade ou falha técnica. Medir tempo até tentativa e resultado válido,
retry/conclusão e retorno D1/D7, sem criar telemetria externa por esta documentação.

Verificar também a hierarquia da experiência: em cinco segundos a pessoa identifica a
ação em Hoje? Encontra uma ferramenta específica em Explorar sem ajuda? Entende que pode
encerrar mesmo com revisão pendente? Ao retornar, reconhece a continuidade da prática?
Registrar tempo até a primeira tentativa, primeira prática salva, abandono antes da tentativa,
trocas de seção antes de começar e retorno em outro dia. Contagens de uso não provam aprendizado.

A proposta exploratória anterior de 8–12 participantes por duas semanas serve para descoberta,
não para alegações causais. Usar tarefas equivalentes inéditas, amostras de áudio/escrita/fala,
rubrica de compreensibilidade, correção, variedade lexical e realização da tarefa; comparar
com rotina anterior ou alternativa e relatar resultados individuais. Auditar uma amostra de
autoavaliações contra respostas digitadas e testar se exemplos antes/depois ajudam a perceber
mudança. Separar melhora imediata, retenção, transferência próxima e transferência inédita.

O estudo confirmatório abaixo preserva o desenho anterior. Antes de executá-lo, fixar a versão
do produto e explicitar como o tutor e seus critérios entram na intervenção; não misturar
resultados de versões ou mudar o desfecho depois de ver os dados.

## Estudo confirmatório de eficácia

Status: protocol ready; recruitment and longitudinal data collection have not started.

### Claim under test

For Brazilian A2-B1 independent learners who already use real English content, PhraseLoop
improves delayed, unaided English production and cross-context transfer more than an
activity-matched recognition-card workflow.

### Design

- Randomized, parallel, 12-week study plus a 4-week no-training follow-up.
- Target: 60 completers (30 per arm); recruit 76 to allow about 20% attrition.
- Stratify randomization by A2/B1, prior Anki use, and baseline production score.
- PhraseLoop arm: the complete guided loop, productive cards, FSRS, evaluated transfer.
- Active control: the same source phrases, audio exposure, session budget, and reminders,
  but English-front recognition cards and no feedback/retry loop.
- Evaluators receive anonymized answers and remain blind to arm and measurement occasion.

### Outcomes

Primary outcome: proportion of predeclared target meanings produced acceptably in English at
D30, before any answer or scaffold is shown, on prompts not seen since the preceding test.

Secondary outcomes:

- D7 and D60 observed production.
- Near transfer: new situation, same target pattern.
- Cold transfer: new topic and prompt wording, with no displayed model phrase.
- Novel listening comprehension using held-out human recordings and speakers absent from
  training; score main idea and details separately.
- Error rate per elicited opportunity for each predeclared pattern.
- Four-week maintenance after training stops.
- Time on task, attrition, and scaffold use as process measures, never learning outcomes.

### Measurement contract

- Capture the response and latency before reveal.
- `responseCorrect` is evaluator/local-check evidence, not a self grade.
- Report D7 at 5-10 days, D30 at 24-38 days, and D60 at 50-75 days.
- A transfer success requires `evaluated !== false`, task completion, and no blocking issue.
- Count errors over elicited opportunities, not raw error totals.
- CEFR is measured only by a separate standardized assessment; in-app activity cannot raise it.

### Analysis

- Intention-to-treat is primary; multiple imputation and complete-case analyses are sensitivity
  checks.
- Compare D30 proportions with a mixed-effects logistic model (participant and item random
  intercepts; arm, baseline, level, and prior Anki use fixed effects).
- Publish absolute difference, odds ratio, 95% confidence interval, and item/participant counts.
- Control false discovery rate across secondary outcomes. Do not replace missing D30 evidence
  with FSRS predictions or self grades.

### Decision rules

- Continue the learning claim only if the D30 interval excludes zero in PhraseLoop's favor and
  no serious usability harm appears.
- Revise the method if D7 improves but D30/D60 or cold transfer does not.
- Treat better retention with materially higher time-on-task as inconclusive until efficiency
  is tested.
- Remove level/proficiency language if the standardized assessment does not corroborate it.

### Execution checklist

1. Freeze protocol and analysis before viewing outcomes.
2. Obtain consent and a data-retention policy for recordings/transcripts.
3. Prepare held-out human audio and an item bank with parallel forms.
4. Run a five-person instrumentation pilot; do not include it in the confirmatory sample.
5. Register randomization, exclusions, and analysis code.
6. Recruit, run 12 weeks, complete D60/follow-up, then analyze.

O contrato `evaluated !== false` acima pertence às medidas gerais avaliadas. Tentativas do
tutor projetadas com `evaluated: false` não entram automaticamente nesse denominador;
uma avaliação independente do estudo deve registrar instrumento e condições próprios.

## Piloto de instrumentação e registro

Use this table for the five-person instrumentation pilot. Confirmatory efficacy data belongs to
[estudo confirmatório](#estudo-confirmatório-de-eficácia); pilot participants must not
be included in that analysis.

Primary outcome for this run: every D7/D30/D60 production attempt captures a pre-reveal response,
observed correctness, scaffold state, exact interval, task completion, and target pattern.

Comparison condition: active recognition-card workflow with matched source material and time.

| Participant | Profile | Baseline task scores | In-app tasks completed | D+1 return | D+7 unaided production | Near transfer | Cold transfer | Interview signal | Decision |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| P01 | A2/B1, Anki yes/no, real-content habit yes/no | audio / writing / speaking | onboarding, lesson, own source, review, correction, retry | yes/no | attempts/correct | pass/partial/fail | pass/partial/fail | keep/change/remove quote | keep/change/remove |

### Required Tasks

1. Complete onboarding with no AI provider configured.
2. Complete the first bundled lesson.
3. Save 1-3 phrases.
4. Review same-day and next-day.
5. Produce one written or spoken sentence.
6. Correct it and retry without copying.
7. Complete one transfer task on a different theme.

### Interview Prompts

- What do you think PhraseLoop is trying to improve?
- What felt useful enough to come back tomorrow?
- What felt like too much work?
- Did it feel like you learned, or just completed a task?
- What phrase or error do you remember without opening the app?
- Would this replace or sit beside Anki, ChatGPT, classes, or YouTube?
- What repeated pain would you pay to remove?

### Decision Rules

Keep when the learner completes the loop and improves on at least one predeclared primary metric. Change when the learner likes the app but cannot explain the gain, needs too much help, or improves only on practiced items. Remove or defer surfaces that create engagement without production, feedback, retry, delayed retention, or transfer.

## Ferramenta local de calibração do feedback

Os 48 casos em `scripts/content/tutor-feedback-cases.json` cobrem as oito habilidades:
resposta correta, incorreta, paráfrase válida, evasão, português e vazio. São casos sintéticos
para teste de software, não respostas de alunos. Status e resultado esperados estão pendentes
de revisão humana de inglês, PT-BR e rubrica; não são uma referência validada nem comprovam
calibração.

- Verificar o conjunto sem chamadas: `node scripts/eval-tutor-feedback.mjs --dry-run --output /tmp/tutor-cases.json`.
- Com Ollama já configurado: `node scripts/eval-tutor-feedback.mjs --provider ollama --output /tmp/tutor-feedback.json`.
- Para um provedor em nuvem já configurado em ambiente/`.env.local`, usar `--provider openai`,
  `claude` ou `openrouter`. A execução faz 48 chamadas e pode ter custo. Sem credencial
  existente, o script para antes de chamar. Chaves exclusivas do cofre do desktop precisam
  estar disponíveis ao processo; o script não exporta credenciais do cofre.

O script reutiliza `buildTutorPrompt`, o catálogo, os validadores e os provedores do app,
inclusive seus modelos configurados. O JSON local informa versão do prompt, modelo,
concordância conjunta de status/resultado por status esperado e habilidade, falhas de contrato
e casos individuais. Falha de contrato ou de chamada conta como discordância. Os relatórios
não contêm chaves nem são enviados por telemetria. A execução real e a revisão dos casos
permanecem pendentes; um dry-run não mede concordância.

## Exportação do piloto

Em Configurações → Dados e privacidade, “Exportar dados do piloto” baixa um JSON no
computador. Por padrão, leva apenas campos derivados: início conhecido/tempo até a primeira
tentativa, primeira conclusão válida do tutor ou conclusão local com autoavaliação, retries,
retornos D+1 (24–48h) e D+7 (dias 5–10), apoio e situações por habilidade. Inclui intervalos
exatos e indica se a janela terminou. Tempo sem início conhecido fica nulo; registros antigos
sem data explícita de conclusão não recebem uma data inventada. Projeções das tentativas do
tutor são deduplicadas. Retries e registros de resolução são apresentados separadamente.

A caixa “Incluir o texto das minhas respostas neste arquivo” começa desmarcada. Apenas
marcá-la inclui respostas digitadas/transcritas e respostas de revisão; gravações, conversas
inteiras, perguntas ao tutor, tarefas livres, feedback e credenciais continuam fora. O arquivo
não é enviado a um servidor. Compartilhar arquivos, obter consentimento e conduzir o piloto
continuam sendo trabalho humano. Não há participantes nem resultados novos registrados.
