# Tarefa: sessão longa de conversa com lacunas que voltam

Você vai trabalhar de forma autônoma neste repositório até concluir as frentes abaixo.
Leia primeiro `AGENTS.md`, `docs/product.md` e `docs/validation.md`. As decisões abaixo foram
fechadas com o responsável pelo produto em 12/10/2026. Não as reabra; se uma frente exigir uma
decisão que não está escrita aqui, registre a dúvida no relatório final e siga.

## Por que existe

O aluno intermediário (B1–B2) estaciona porque evita, sem perceber, o que não sabe dizer: dá
voltas, simplifica, troca para o português. A Conversa atual não captura isso: a revisão só
recebe as falas do aluno coladas (sem as perguntas da IA), devolve no máximo 3 erros e 3
refinamentos, e nada volta para a prática depois. O prompt atual ainda manda a IA simplificar
a pergunta quando o aluno trava, o que ensina a contornar a lacuna.

Critério que orienta tudo: **o aluno tenta dizer algo, percebe que não sabe, recebe a forma
natural, reconstrói e volta a usá-la outro dia, em outro contexto.** A sessão longa só vale se
gerar lacunas reais e devolvê-las a esse ciclo. Conversa com relatório e nada mais é o
problema que `docs/history.md` já apontou ("conversa livre sem fechamento pedagógico").

## Regras invioláveis

- Evolução **experimental da Conversa**, para B1+. Não altere o ciclo do tutor, o catálogo,
  os critérios de evidência (`developing` … `consistent`) nem a agenda de `docs/product.md`.
  Lacunas da conversa **não** entram no sistema de evidências oficial.
- Não remova nem esconda telas existentes (plano, teste de nível, C1, Anki etc.). Isso é
  outro trabalho, separado.
- Local-first: sem telemetria externa, sem conta, sem backend novo. Uso de nuvem só com o
  provedor que o aluno já escolheu, e deixando claro quando falas saem do dispositivo.
- Nenhuma correção durante a sessão. A IA nunca simplifica a pergunta quando o aluno trava.
- Nunca mostrar uma lacuna sem o trecho real como prova ("nunca mostrar um rótulo de
  fraqueza sem frase real").
- Sem XP, moedas, badges, sequência ou notificações.
- Todo texto visível em português e inglês, pelo i18n existente (`src/i18n/`).
- Siga `AGENTS.md`: esta versão do Next.js difere do seu treino; consulte
  `node_modules/next/dist/docs/`. Use `graphify query` para se orientar e rode
  `graphify update .` após mudanças de código.
- Siga o estilo do código ao redor. Testes Vitest para toda lógica nova.

## Como trabalhar

1. Execute as frentes na ordem. **A frente 0 roda antes de tudo** e pode mudar a frente 2.
2. Uma frente por commit, mensagem no estilo do histórico (`feat: ...`, `fix: ...`). Não faça push.
3. Ao final de cada frente: `yarn test`, `yarn lint`, `npx tsc --noEmit -p .`. Só avance com tudo verde.
4. Ao terminar, rode `yarn build` uma vez e atualize `docs/product.md` (comportamento) e
   `docs/history.md` (marco e limites da verificação). Quando concluído, incorpore este plano
   ao documento responsável, conforme "Manutenção da documentação". Não crie outro .md.

## Frentes

### 0. Teste do Whisper com português forçado

Hoje `/api/transcribe` não repassa idioma e `src/server/native/speech.ts` usa
`language: options.language || "auto"`. Em fala misturada, o modo automático pode transcrever
o português como inglês sem sentido ou traduzi-lo.

- Aceite um parâmetro opcional `language` (`"pt"`, `"en"` ou ausente → auto) em
  `transcribeAudio` (`src/features/correct/api.ts`) → `/api/transcribe` → `speech.ts`,
  validado e com teste.
- Crie `scripts/check-codeswitch-transcription.mjs` que transcreve arquivos de uma pasta
  local informada por argumento, em três modos (auto, `pt`, `en`), e gera um relatório local
  lado a lado. Não inclua gravações no repositório.
- O responsável grava 4 áudios: só inglês; só português; misturado com o trecho em PT
  gravado separado (simulando o botão); misturado sem botão.
- **Passa** se o trecho gravado com o botão sai em português correto com `language: "pt"`.
  O modo automático é só medido, para decidir depois.
- Se falhar: na frente 2, o plano B é o aluno digitar o trecho em português; o botão continua.
- As gravações dependem do responsável. Não espere o resultado: implemente o botão (com
  `language: "pt"`) **e** o plano B digitado na frente 2, de qualquer forma.

Pronto quando: o parâmetro existe com testes e o script roda. Registre em `docs/validation.md`
como usar o script. O resultado das gravações é preenchido pelo responsável; não invente.

### 1. Modo sessão longa

Novo modo dentro da Conversa (`src/features/converse/`), marcado como experimental, para B1+.

- Escolha de tema (cenários do perfil da frente 5, ou livre) e duração: **5 ou 10 minutos**
  (2 e 15 ficam para depois). Timer visível; ao fim do tempo, a fala atual termina e a sessão
  segue para a revisão.
- Desligue o limite de falas por estágio (`maxTurns`, em
  `src/features/method/progression.ts:585`) neste modo: a sessão é medida em minutos.
- Prompt deste modo (novo bloco em `buildConverseSystem`, `src/lib/cards/shared.ts`):
  - A IA fala pouco (1–2 frases) e aprofunda com perguntas que provocam as **funções do
    cenário** (discordar, estimar com incerteza, defender um trade-off…), não só "por quê?".
  - Quando o aluno trava ou muda para o português, a IA espera ou pede "try saying it another
    way". **Não** usa a instrução atual de simplificar a pergunta (linha ~30 do bloco).
  - Nenhuma correção explícita durante a sessão.
- Pausar mantém a sessão. Sessão sem nenhuma fala do aluno encerra sem revisão.

Pronto quando: testes cobrem o prompt do modo (sem a instrução de simplificar, com as funções
do cenário), a ausência de limite de falas e o encerramento por tempo.

### 2. Botão "travei"

- Botão segurar-para-falar "Travei / falar em português" visível durante a sessão longa.
  O trecho gravado com ele é transcrito com `language: "pt"` (frente 0) e marcado na
  transcrição como `codeSwitch: true`, com o texto em PT e o momento.
- Na fala seguinte, a IA usa **naturalmente** a forma em inglês do que o aluno quis dizer,
  dentro do personagem, sem corrigir nem explicar. Passe o trecho em PT ao prompt para isso.
- Plano B (se a frente 0 falhar ou sem áudio): campo para digitar o trecho em PT, com o
  mesmo efeito.
- Por sessão, registre o **número de travadas** (botão ou digitado; vale nos dois modos) e os
  **segundos em português** (só para trechos gravados; trecho digitado não tem duração e não
  entra nessa soma). Ambos são insumo da frente 7.

Pronto quando: há testes de que o trecho é marcado, chega ao prompt da fala seguinte e entra
na métrica de tempo em PT.

### 3. Revisão com a conversa inteira, lacunas e reconstrução

A revisão atual (`correctReview` em `ConverseTab.tsx`, ~linha 686) envia só as falas do aluno
coladas. No modo sessão longa:

- Envie a conversa inteira, com as falas da IA e os trechos `codeSwitch`, para o modelo de
  revisão (frente 6).
- Saída em JSON com esquema fixo. Além de pontos fortes, **no máximo 3 lacunas**, cada uma com:
  - `evidence`: o trecho real (o português do aluno, ou a volta que ele deu em inglês)
  - `intent`: o que ele quis dizer
  - `natural`: duas versões, `casual` e `neutral`
  - `why`: porquê curto, em PT para B1/B2
  - `functionId`: a função do perfil a que pertence (quando houver perfil)
  - `patternLabel`: rótulo curto e estável do padrão (ex.: `soften-disagreement`,
    `estimate-with-uncertainty`), usado para reconhecer recorrência
  - `kind`: `code_switch` | `avoidance` | `unnatural` | `error`
- Detecção de evitação (`avoidance`) só com prova: a pergunta da IA que pedia algo e a resposta
  que contornou. Sem trecho real, a lacuna é descartada.
- Ordem de escolha das 3: recorrentes (mesmo `patternLabel` aberto antes) → ligadas a uma
  função do perfil → gravidade.
- **A revisão termina com reconstrução**: o aluno fala (ou escreve) de novo cada lacuna com a
  forma natural. Registre a tentativa; não é avaliada como evidência do tutor.
- Uma lacuna pode ser salva como frase e abrir uma situação do tutor, pela ponte que já existe
  (origem registrada, primeira prática conta como assistida).

Pronto quando: testes cobrem o parser do JSON (tolerante como `repertoire.ts`: resposta
malformada não quebra a revisão), o descarte de lacuna sem prova, o limite de 3 e a ordem.

### 4. Registro das lacunas, recorrência, fechamento e expressões no B1/B2

- Persistência local (IndexedDB, via `src/lib/store/`, com migração e teste de backup) de
  `ConversationGap` com os campos da frente 3, mais sessão de origem, datas e estado.
- Estados: `open` → `closed`. Fecha quando o aluno usa a forma natural **sem ajuda, numa sessão
  posterior, pelo menos 24h depois** de ela ter sido aberta, com ou sem a IA ter puxado a
  conversa para ela (uso espontâneo também conta). Se travar de novo no mesmo `patternLabel`,
  reabre (contagem histórica preservada).
- "Sem ajuda": o uso não conta se a IA disse a forma natural em alguma das 2 falas anteriores
  da IA, nem se ocorreu na reconstrução da revisão.
- No máximo **9 lacunas abertas**; acima disso, as mais antigas ficam congeladas (não são
  puxadas) até abrir espaço.
- Recorrência pelo `patternLabel`. **Não** altere `selectRecurringError`
  (`src/features/pronunciation/speakingDrill.ts`) do tutor.
- Expressões na conversa: hoje `isRepertoireLevel` (`src/lib/cards/shared.ts:725`) só aceita
  C1/C2. Para B1/B2 no modo sessão longa:
  - Primeiro, `elicitExpressions` = lacunas abertas não congeladas.
  - Depois, expressões novas da IA: **até 2 a cada 4–5 falas da IA, no máximo 3 por sessão**,
    só quando não houver lacuna pendente a puxar naquele momento.
  - C1/C2 continuam como hoje.
- Detecção de uso: reaproveite a lógica de `detectRepertoireUse` em `repertoire.ts`.

Pronto quando: testes cobrem abrir/fechar/reabrir (incluindo a regra de 24h e "sem ajuda"), o
teto de 9, a prioridade lacunas → expressões novas e os limites do B1/B2.

### 5. Perfil de domínio: desenvolvedor de software

Arquivo JSON incluído no app (como `lessons.json`), por exemplo
`src/features/converse/domainProfiles/software-dev.json`, com validação estrutural em teste.

- Estrutura: `scenarios[]` com `id`, `label` (PT/EN), `situation`, `aiRole`,
  `functions[]` (o que o aluno precisa fazer com a língua) e `expressions[]`
  (`text`, `functionId`, `register: casual|neutral`, `note`).
- Cenários e funções definidos pelo responsável (versão inicial abaixo). **Expressões**:
  gere com o modelo mais forte disponível, confira com um segundo modelo ou com fontes reais
  (threads, transcrições de reuniões técnicas) e marque todas como `reviewed: false`.
  O responsável faz a revisão final. Não declare o conteúdo revisado.
- Ligue ao perfil do aluno: dentro do objetivo `professional`, um campo opcional de área
  (`software-dev` por enquanto), editável em Configurações.

Cenários iniciais:

1. Daily: o que fiz, o que vou fazer, o que está me bloqueando
2. Discordar de um comentário no code review
3. Explicar um incidente: o que aconteceu, a causa e o que vamos mudar
4. Estimar prazo quando há incerteza
5. Defender um trade-off técnico numa reunião de arquitetura
6. Pedir ajuda no Slack sem parecer perdido
7. Dizer "não" ou "não cabe nesse prazo" ao PM
8. Fazer uma demo para um cliente ou stakeholder
9. Um 1:1 com o chefe sobre carreira e feedback
10. Entrevista técnica: explicar um projeto e o raciocínio
11. Fazer o onboarding de um colega novo
12. Small talk no começo de uma reunião remota

Pronto quando: o JSON valida, os cenários aparecem na escolha de tema da frente 1, as funções
chegam ao prompt e todas as expressões estão `reviewed: false`.

### 6. Modelo separado para o relatório

Em Configurações, permita escolher um provedor/modelo para a **revisão** diferente do da
conversa. Padrão: o mesmo. Reaproveite a abstração de provedores existente
(`src/lib/cards/registry.ts`). Deixe claro quando a revisão vai para a nuvem.
Adapte a ideia de `scripts/eval-tutor-feedback.mjs` num script que roda a revisão da frente 3
em conversas salvas localmente com dois modelos e gera um relatório lado a lado, para o
responsável comparar. Não declare nenhum modelo calibrado.

Pronto quando: há testes da escolha e do padrão, e o script roda sem provedor pago não
configurado.

### 7. Dados para a avaliação de 2 semanas

O responsável vai avaliar a funcionalidade após **2 semanas** de uso com três números:

1. % de lacunas fechadas (meta inicial: metade). Denominador: só lacunas que tiveram ao menos
   uma sessão longa posterior, iniciada pelo menos 24h depois da abertura (lacunas sem chance
   de fechar ficam fora e são contadas à parte).
2. tempo em português por sessão (deve cair): segundos em PT dos trechos gravados e número
   de travadas por sessão, lado a lado.
3. sessões longas por semana (meta: 3 ou mais)

Registre o necessário e inclua esses números na ação existente "Exportar dados do piloto"
(`src/features/settings/pilotExport.ts`), sem texto livre a menos que a opção já existente seja
marcada. São medidas de processo, não de proficiência; diga isso na exportação.

Pronto quando: há testes da derivação dos três números a partir de históricos de exemplo.

## Fora do escopo (não faça)

- Remover ou esconder telas.
- Integrar lacunas ao sistema de evidências ou à agenda do tutor.
- Detecção automática de português sem o botão (só depois do resultado da frente 0).
- Durações de 2 e 15 minutos.
- Gerar perfis para outras profissões ou pesquisa web dentro do app.
- Avaliação de pronúncia a partir de texto.
- Declarar expressões revisadas ou feedback calibrado.

## Relatório final

Ao terminar, responda com:

1. As frentes concluídas, com os commits.
2. As frentes parciais ou bloqueadas e o motivo.
3. As decisões de produto que ficaram para o responsável.
4. O que precisa de revisão humana: expressões do perfil, textos novos, resultado do teste do Whisper.
5. O resultado de `yarn test`, `yarn lint`, `tsc` e `yarn build`.
