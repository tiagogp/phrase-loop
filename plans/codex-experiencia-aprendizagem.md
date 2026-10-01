# Tarefa: fortalecer aprendizagem e experiência do PhraseLoop

Você vai trabalhar de forma autônoma neste repositório até concluir as frentes abaixo.
Leia primeiro `AGENTS.md`, `docs/product.md` e `docs/validation.md`. O método (produção antes
do exemplo, feedback focal, retry, retorno espaçado em outro contexto, sem gamificação) está
correto e deve ser preservado. O problema é que o núcleo é estreito, a dose diária é baixa, o
tom é frio e a configuração de IA afasta o público A2–B1. Seu trabalho é corrigir isso sem
enfraquecer os critérios de evidência.

## Regras invioláveis

- Não invente dados de alunos, resultados de piloto, métricas de eficácia nem calibração.
  Onde algo depende de pessoas, prepare a ferramenta e registre como pendente.
- Não afrouxe os critérios de evidência de `docs/product.md` (assistido, independente,
  transferência, consistente) nem os intervalos da agenda. Nada pode alegar domínio, nível
  CEFR ou progresso sem evidência válida.
- Não adicione XP, moedas, badges, sequência, notificações ou outra pressão de engajamento.
- Mantenha local-first: nenhuma telemetria externa, nenhuma conta, nenhum backend novo.
- Não remova ferramentas existentes (lições, cards, conversa, correção, C1, Anki, etc.).
- Siga `AGENTS.md`: esta versão do Next.js difere do seu treino; consulte
  `node_modules/next/dist/docs/` antes de usar APIs do Next. Use `graphify query` para
  orientar-se e rode `graphify update .` após mudanças de código.
- Todo texto visível ao aluno deve existir em português e inglês, usando o sistema de i18n
  já existente (`src/i18n/`, `useTutorTranslation`, `journeyMessages.ts`).
- Siga o estilo do código ao redor. Escreva testes Vitest para toda lógica nova.

## Como trabalhar

1. Execute as frentes na ordem. Uma frente por commit, mensagem no estilo do histórico
   (`feat: ...`, `fix: ...`). Não faça push.
2. Ao final de cada frente rode: `yarn test`, `yarn lint`, `npx tsc --noEmit -p .`.
   Só avance com tudo verde.
3. Se uma frente exigir uma decisão de produto ou de negócio que não está escrita aqui,
   não decida sozinho e não fique tentando: registre a dúvida no relatório final e passe
   para a próxima frente.
4. Ao terminar todas, rode `yarn build` uma vez e atualize `docs/product.md` (comportamento
   e prioridades) e `docs/history.md` (marco e limites da verificação), conforme a seção
   "Manutenção da documentação". Não crie outro arquivo .md de documentação.

## Frentes

### 0. Bug do timer de retry abandonado

Em `src/features/correct/components/CorrectTab.tsx`, `evaluate()` limpa o retry com IA
(`setRetryOf(null)`) mas não pausa nem descarta o `retryTimer`, que continua contando até o
próximo retry concluído. Ao abandonar um retry, descarte o tempo dele, sem creditar.
Pronto quando: há teste ou ajuste coberto pelo controller em
`src/features/method/stageTimerController.ts` e o crédito do retry seguinte não inclui o
tempo do retry abandonado.

### 1. Catálogo do tutor: de 2 para 6–8 habilidades

Hoje `src/features/tutor/catalog.ts` tem 2 habilidades e 7 situações; o resto vira
`unclassified` e não alcança transferência verificada, então o aluno esgota o núcleo em
uma ou duas semanas.

- Adicione 4–6 habilidades comunicativas de alta frequência para profissionais
  brasileiros A2–B1 (sugestões: dar um status de trabalho; explicar um problema e a causa;
  concordar e discordar com educação; pedir esclarecimento; propor e confirmar próximos
  passos; descrever experiência passada com past simple). Escolha habilidades que erros
  típicos de brasileiros tornam úteis.
- Cada habilidade: `label` em PT, `rubric` em inglês no mesmo formato das existentes
  (o que demonstra, alternativas aceitas, o que não conta), e 3–4 situações em contextos
  distintos com `goal`, `situation`, `instruction`, `successCriteria`. As situações não
  podem revelar a resposta nem nomear a regra gramatical.
- `src/features/tutor/prompts.ts` tem o enum de `conceptId` escrito à mão no schema
  (`"present-perfect-duration|polite-requests|unclassified"`). Gere-o a partir de
  `TUTOR_CONCEPTS` para que o catálogo seja a única fonte.
- IDs de sessões já salvas devem continuar válidos (não renomeie os existentes).

Pronto quando: os testes de catálogo, `verifiedTutorContext`, `chooseTutorScenario` e do
prompt cobrem as novas habilidades; nenhum texto de situação contém a resposta. Registre em
`docs/product.md` que o novo conteúdo está pendente de revisão editorial humana de inglês e
PT-BR.

### 2. Conclusão que mostra progresso concreto

`src/features/tutor/components/TutorPractice.tsx` já compara com a sessão anterior
(`parent`), mas de forma discreta e técnica ("different tasks are not the same test").

- Quando houver uma sessão anterior da mesma habilidade, mostre em destaque, na conclusão,
  a resposta anterior e a de hoje lado a lado, com as condições de cada uma (com/sem apoio,
  dias de intervalo, situação). Mantenha a ressalva honesta, com linguagem simples.
- Acrescente uma frase "agora você consegue..." baseada em `successCriteria`/`goal` da
  tarefa, mostrada somente quando houver evidência válida (status `met` ou habilidade
  `demonstrated`) e nunca como alegação de domínio.

Pronto quando: há testes para a lógica que decide o que mostrar (com e sem sessão anterior,
com tentativa incerta ou contestada, que não deve gerar a frase).

### 3. Mais uma situação, opcional e limitada

Depois de concluir, o aluno só pode parar. Adicione na conclusão e na tela Hoje concluída
(`src/features/home/components/HojeHome.tsx`, `nextPractice.ts`) uma ação secundária
"Praticar mais uma situação", com limite diário (sugestão: 2 extras). "Pode parar aqui"
continua sendo a mensagem principal. Extras são prática nova e não antecipam nenhuma
retomada agendada nem quebram a regra de 24h.
Pronto quando: há testes de `nextPractice` para o limite e para não antecipar retomadas.

### 4. Tom dos textos voltados ao aluno

Revise as strings de Hoje, tutor e Progresso. Troque frases que soam como laudo
("aguardando confirmação independente", "Uma prática posterior mostrará o que ficou") por
frases calorosas e concretas, mantendo a honestidade: dizer o que a pessoa fez e o próximo
passo, sem prometer domínio. Os nomes internos dos estados não mudam; muda só o que o
aluno lê. Atualize testes de i18n que dependam dessas strings.
Pronto quando: nenhum texto visível usa jargão do modelo de evidência ("independente",
"transferência", "evidência consistente") sem explicação em linguagem comum.

### 5. Responder falando, com o mesmo destaque que escrever

O público precisa falar em reuniões. No `TutorPractice`, a gravação com transcrição
editável deve ser uma opção de resposta tão visível quanto o texto (não escondida). A
tentativa deve registrar se foi falada. O feedback continua avaliando apenas o texto e nunca
infere pronúncia; deixe isso claro ao aluno em uma linha.
Pronto quando: há teste de que a tentativa falada é marcada como tal e de que nada deriva
pronúncia da transcrição.

### 6. Caminho sem IA mais forte

Sem IA, o aluno hoje só vê uma frase e tenta lembrar. Use as lições existentes
(`src/features/learn/lessons.json`) para oferecer uma prática local de produção: situação
curta, o aluno escreve antes de ver, depois compara com o modelo e marca a própria
autoavaliação. A autoavaliação é registrada como tal e não conta como acerto independente
nem como transferência (veja `docs/product.md`).
Pronto quando: há testes de que essa prática nunca gera evidência avaliada
(`evaluated: false` ou equivalente) e de que ela respeita a agenda.

### 7. Configuração de IA em poucos passos

Sem criar backend ou provedor gerenciado (é uma decisão de negócio pendente), reduza o
atrito: um fluxo guiado de no máximo 3 passos para conectar um provedor (escolher, colar a
chave ou detectar o Ollama, testar), com mensagens de erro em linguagem de aluno e um botão
"continuar sem IA" sempre visível que leva à frente 6. Reaproveite
`src/features/settings/` e `/api/settings/test`.
Pronto quando: o fluxo é coberto por testes de componente ou lógica, e a falha do teste de
conexão mostra o próximo passo em vez de um erro técnico.

### 8. Idioma da interface respeita a escolha do aluno

`src/i18n/config.ts` força inglês a partir do B1 mesmo com preferência salva por português.
Mude para: preferência explícita sempre vence; sem preferência, B1+ usa inglês por padrão.
Atualize `src/i18n/config.test.ts` e o trecho correspondente de `docs/product.md`.

### 9. Ferramenta de calibração do feedback (sem alegar calibração)

Crie `scripts/eval-tutor-feedback.mjs` e um conjunto de casos em
`scripts/content/` com pelo menos 40 respostas cobrindo, para cada habilidade do catálogo:
correta, incorreta, paráfrase válida, evasão da habilidade, resposta em português e
resposta vazia, cada uma com o status e o resultado esperados. O script roda contra o
provedor configurado, usando o mesmo `buildTutorPrompt`, e gera um relatório de
concordância (por status e por habilidade) em arquivo local. Não rode contra provedores
pagos sem configuração existente. Registre em `docs/validation.md` como usar o script e que
os casos esperados precisam de revisão humana antes de servirem como referência.

### 10. Exportação local para o piloto

O piloto de 5 pessoas (`docs/validation.md`) precisa de dados sem telemetria externa.
Adicione em Configurações uma ação "Exportar dados do piloto" que gera um JSON local com:
tempo até a primeira tentativa, primeira prática concluída, retries, retornos D+1 e D+7,
uso de apoio e situações por habilidade. Não inclua texto livre das respostas, a menos que
o aluno marque explicitamente essa opção.
Pronto quando: há testes da derivação das métricas a partir de históricos de exemplo.

## Fora do escopo (não faça)

- Rodar o piloto, recrutar pessoas ou preencher a tabela de participantes.
- Declarar o feedback como calibrado.
- Remover ou esconder ferramentas para reduzir a navegação.
- Criar provedor gerenciado, cobrança, contas ou sincronização em nuvem.

## Relatório final

Ao terminar, responda com:
1. As frentes concluídas, com os commits.
2. As frentes parciais ou bloqueadas e o motivo.
3. As decisões de produto que ficaram para o responsável.
4. O que precisa de revisão humana: conteúdo do catálogo, casos esperados da calibração,
   textos novos.
5. O resultado de `yarn test`, `yarn lint`, `tsc` e `yarn build`.
