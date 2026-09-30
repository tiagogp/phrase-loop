# PhraseLoop — Arquitetura

Mapa técnico consolidado em 30/09/2026. Direção e critérios pedagógicos ficam em
[product.md](product.md), protocolos em [validation.md](validation.md) e marcos de
implementação em [history.md](history.md). Instalação e comandos estão no [README](../README.md).

## Limites e navegação

```text
UI features/* -> app/api/* -> server/runtime -> áudio nativo / LLM
      |
      v
IndexedDB: fontes, cards, revisões, tentativas, conversas, planos e sessões do tutor
```

`/` redireciona para `/app`. Hoje, Frases, Conteúdo, Conversa e Progresso são painéis de uma
única página; tutor, lições, correção, C1, ferramentas e configurações são sobreposições internas.
As áreas principais montam na primeira visita e mantêm estado enquanto ocultas. `/api/*`
presta serviços, não navegação. `apps/landing` é um workspace separado, com demonstração,
privacidade e lista de espera. Não há dashboard autenticado.

As rotas preservam URLs e responsabilidades HTTP; regras de domínio ficam em `features`,
`lib` e `server`. IndexedDB guarda aprendizagem; o runtime local cuida de áudio, arquivos
e integrações. Configuração de IA no browser é somente leitura; a escrita desktop usa o
caminho existente do Electron, com confirmação de versão para evitar corrida de leitura.

## Tutor

| Responsabilidade | Referência |
| --- | --- |
| Sessões, tentativas e contrato de validação | [types.ts](../src/features/tutor/types.ts), [contract.ts](../src/features/tutor/contract.ts) |
| Situações verificadas e conceitos canônicos | [catalog.ts](../src/features/tutor/catalog.ts) |
| Evidência agregada por habilidade | [learning.ts](../src/features/tutor/learning.ts) |
| Memória, prioridades e agenda | [model.ts](../src/features/tutor/model.ts) |
| Persistência e concorrência | [store.ts](../src/features/tutor/store.ts), [useTutorSession.ts](../src/features/tutor/useTutorSession.ts) |
| Planejar, avaliar e explicar | [API](../src/app/api/tutor/route.ts), [prompts.ts](../src/features/tutor/prompts.ts) |
| Entrada, sessão e memória visível | [TutorWorkspace](../src/features/tutor/components/TutorWorkspace.tsx), [TutorPractice](../src/features/tutor/components/TutorPractice.tsx), [TutorMemoryPanel](../src/features/tutor/components/TutorMemoryPanel.tsx) |

O tutor reutiliza a abstração existente de OpenAI, Claude, OpenRouter e Ollama. Não cria SDK
nem provedor global paralelo. O app recupera evidências, valida saídas, persiste tentativas e
calcula a agenda; a LLM propõe situações, explica e avalia respostas abertas. O aluno decide
objetivo, apoio, pausa e mudança de foco.

Dados do aluno entram nos prompts como citações. Correções precisam de trecho literal da
resposta; incerteza permanece explícita. A validação rejeita saídas incompletas e situações
repetidas, mas não prova correção semântica. IDs de contexto vindos da geração são removidos;
um contexto só é verificado por correspondência completa com o catálogo versionado.

### Modelo de dados

A implementação reutiliza `TutorSession`, `TutorAttempt`, feedback e stores existentes. O estado de habilidade é uma projeção calculada sobre os registros, sem novo banco paralelo.

| Informação | Implementação |
| --- | --- |
| Conceito | `TutorSkill.conceptId`; duas chaves iniciais: `present-perfect-duration` e `polite-requests`. Conceitos não classificados continuam locais ao episódio. |
| Origem | `originSessionId` e `originContext`; `parentSessionId` mantém a ligação da retomada. |
| Contexto verificado | `TutorTask.scenarioId` mais igualdade com os campos do cenário versionado do catálogo. |
| Diagnóstico | `feedback.skill.result`, `conceptId` e `evidence`; uma dificuldade precisa de trecho literal ligado a um ponto de correção. |
| Apoio | `attempt.supportUsed`, posição de retry e `exposures: { id, kind, at }[]`; perguntas também preservam data. |
| Captura | `sourceCardId` e exposição `source`; conteúdo importado não é resultado de aprendizado. |
| Evolução | Acertos assistidos/independentes, sessões com melhora, últimas cinco respostas, última ajuda, contextos novos, antes/depois e estado. |
| Compatibilidade | Registros antigos continuam legíveis; sem conceito/contexto verificável, não ganham crédito retroativo de transferência. |

### Memória e persistência

O contexto da IA usa até seis registros permitidos, priorizando fonte escolhida e sessão
anterior vinculada, depois relevância e recência. Perguntas recebem até quatro trocas anteriores.
Não se envia todo o histórico. Preferências são editáveis; observações apontam para tentativas
reais. Conversa e correção isolada podem fornecer observações, sem normalização automática em
dificuldades canônicas.

`tutorSessions` e `tutorPreferences` foram adicionados no IndexedDB v13. Sessão, rascunho e
projeções são gravados atomicamente, com revisão concorrente para impedir sobrescrita silenciosa
entre janelas. A fila trata salvamento e cancelamento. Campos novos são opcionais; backups
anteriores continuam legíveis sem migração destrutiva ou crédito retroativo de transferência.

Excluir uma observação do contexto não apaga o histórico. Contestação também invalida sua
participação no contexto de sessões antigas. Falha, cancelamento, timeout e saída inválida
preservam o rascunho e não registram sucesso. Chaves não entram nos registros do tutor.
Bloqueio de atualização do banco por outra janela exibe recuperação explícita.

Tentativas projetadas em `productionAttempts` mantêm `retryOf` e `evaluated: false`, pois a
rubrica do tutor não é intercambiável com os indicadores gerais. O registro do tutor preserva
provider, modelo, versão do prompt e resultado específico. Critérios e intervalos vigentes
estão em [Evidência e agenda](product.md#evidência-e-agenda).

## Experiência progressiva

[experience.ts](../src/features/activation/experience.ts) deriva os seis estados de orientação
do histórico existente. [useExperience.ts](../src/features/activation/useExperience.ts) combina
os recursos compartilhados; [experiencePreferences.ts](../src/features/activation/experiencePreferences.ts)
guarda navegação e dispensas locais, fora do backup de aprendizagem.

Não inferir ciclo concluído de clique, onboarding, tier, importação ou sessão vazia. Resultado
incerto, contestado ou excluído não estabelece resultado válido. Restaurar backup recalcula
o estado; falha de leitura mostra recuperação, sem reclassificar o aluno como novo.
Maturidade adapta orientação e sugestões; a opção de todas as abas depende do aluno.

## Fontes, cards e revisão

```text
YouTube -> yt-dlp (somente áudio) -> Whisper com timestamps ─┐
Artigo/PDF -> extração e segmentação ───────────────────────┤
Correção/conversa -> ErrorEvent ───────────────────────────┤
                                                         v
PhraseCandidate aceito / ErrorEvent -> gerar -> verificar origem -> criticar -> deduplicar
                                                         |
                                                         v
                                              Card -> revisão FSRS / exportação
```

- Fontes e erros são registros primários; cards são derivados. Curadoria humana aceita ou
  descarta candidatos antes da geração. `focus` opcional orienta a mineração.
- YouTube usa `yt-dlp` e Whisper; o antigo caminho YouTube.js/captions foi removido. Áudio fica
  em cache local e timestamps permitem recortar clipes por frase. PDF usa PDF.js (limite de
  25 MB); artigos usam Readability. Texto sem áudio recebe Kokoro identificado como sintético.
- [provider.ts](../src/lib/cards/provider.ts) orquestra `generateVettedCards` e `generateDeck`:
  origem atribuída por código, crítica por fonte e deduplicação. Embeddings são usados quando
  disponíveis; há alternativa lexical. [registry.ts](../src/lib/cards/registry.ts) resolve o
  provedor no servidor. O antigo provider heurístico foi retirado; prática local sem IA usa
  conteúdo e verificadores próprios, não um avaliador LLM fictício.
- Reforço reutiliza fontes ligadas aos cards e o mesmo pipeline. O provider escolhido em
  Settings é explícito; indisponibilidade mostra configuração, sem fallback silencioso.
- [repository.ts](../src/lib/store/repository.ts) reúne persistência e consultas. Índices de
  vencimento e data de revisão, mais buscas em lote, evitam scans e N+1 desnecessários.
- [fsrs.ts](../src/lib/srs/fsrs.ts) adapta `ts-fsrs`, serializando datas como epoch ms.
  Notas Again/Hard/Good/Easy atualizam a agenda. Reconhecimento e produção têm revisões próprias;
  áudio da resposta fica oculto antes de responder na direção de produção.
- Fraquezas agrupam conceito, tipo de erro e contexto. Metadados nas revisões sobrevivem à
  exclusão do card. Contagens e previsões FSRS são distintas de retenção observada.

## Conversa, planos e áudio

Conversa usa `converse()` e `/api/conversation`, com cenário, nível, histórico, entrada digitada
ou push-to-talk. O texto aparece antes do TTS. A revisão final considera só falas do aluno,
preserva o contexto e usa `correctReview`/`correctedAt` para evitar repetir avaliação cobrada.
Kokoro e Whisper são reutilizados; uma alternativa digitada atende ausência de áudio nativo.
Uso de nuvem deve ficar claro quando falas saem do dispositivo.

O plano de estudo usa `learningPlan`, `activityLog` e `effortHistory`, com tarefas por fase/dia,
geração e adaptação em `features/plan`. `emitActivity` registra ações de estudo, captura,
conversa e correção. Adaptação semanal considera esforço; minutos e exposição não substituem
performance ou retenção. Criar plano é opcional e usa o perfil atual ao abrir.

Exportação `.apkg` usa `ankipack` com `Front`, `Back`, `Audio`, `Concept`, `ErrorType` e
`Source`; há CSV/texto e AnkiConnect. O recorte original tem preferência quando disponível,
com Kokoro como alternativa. Exportar não prova aprendizagem e não importa automaticamente
histórico de revisão do Anki. A biblioteca alimenta o exportador existente.

## Confiabilidade e verificação

Backup/restauração validada e exclusão incluem as coleções do tutor. Erros HTTP têm taxonomia
em [providerFailure.ts](../src/server/http/providerFailure.ts), com códigos estáveis para
400/422/429/499/502/504 e mensagens acionáveis. Tamanho de entrada, timeout e cancelamento
devem ser tratados antes de qualquer registro de sucesso.

O [script do ciclo do tutor](../scripts/verify-tutor-loop.mjs) usa respostas e relógio controlados,
com persistência real. Requer app iniciado e Playwright/Chrome; aceita `PLAYWRIGHT_MODULE` e
`TUTOR_BASE_URL`. Testes relevantes: [evidência](../src/features/tutor/learning.test.ts),
[agenda](../src/features/tutor/model.test.ts), [store](../src/features/tutor/store.test.ts),
[API](../src/app/api/tutor/route.test.ts) e [experiência](../src/features/activation/experience.test.ts).
Resultados já registrados e limitações ficam no [histórico](history.md); não são novos testes.

## UI e acessibilidade

### Linguagem visual

- Superficies quentes e calmas, com texto de alto contraste e laranja reservado para acao/marca.
- Tokens de referencia: `#111111` (texto), `#faf9f6` (surface), `#dedbd6` (border), `#ff5600`
  (accent). Usar os tokens reais do app em vez de duplicar hex no componente.
- Geometria contida: 4px em botoes, 6px em navegacao, 8px em cards; profundidade por borda e
  tonalidade, nao por sombras fortes.
- Headings compactos, body legivel, labels curtos e hierarquia clara. Fontes devem degradar para
  system UI sem alterar o fluxo.
- Spacing baseado em 8px, com valores intermediarios existentes quando necessarios.
- Motion deve explicar estado e respeitar `prefers-reduced-motion`; nao usar escala exagerada em
  controles recorrentes.

### Regras de jornada

- Toda pagina primaria tem um unico heading e uma descricao curta.
- Today mostra uma acao dominante; contagens e plano sao suporte.
- Phrases e Mistakes mostram orientacao de etapas sem mudar a ordem pedagogica.
- Provider, JSON, export e controles opcionais ficam em disclosures avancados.
- Review mostra due count na navegacao.
- Overlays compartilham header e retorno; Settings oferece navegacao por secoes.
- Tablist implementa roving focus, setas, Home/End e um unico tab stop ativo.
- Layouts permanecem fluidos em largura estreita; foco visivel, acessibilidade e estados de erro
  fazem parte da definicao de pronto.

Além dessas regras: uma CTA por estado vazio, parâmetros avançados sob demanda, feedback
junto à resposta e erro sem perda de contexto. Disclosure com erro deve reabrir os detalhes
necessários. Respeitar português/inglês, teclado e largura móvel. Nenhuma regra de apresentação
altera FSRS, elegibilidade de evidência ou critérios de retry.

No tema escuro, o accent reutiliza o laranja do logo (`--color-fin`, `#ff5600`). Os accordions
usam `Disclosure`, com expansão por CSS grid em 220 ms, seta rotativa e movimento reduzido.
O conteúdo permanece montado e fica `inert` enquanto fechado. O cabeçalho e Explorar ficam
acima da navegação sticky de Frases; Escape e clique fora fecham o menu.

## Backlog técnico a reavaliar antes de executar

Os itens abaixo vêm de revisões anteriores; sua presença não significa que foram novamente
auditados nesta consolidação. Conferir o código antes de implementar ou marcar como resolvido.

- Performance: summaries denormalizados; decomposição de Discover/Converse; avanço otimista
  da fila com rollback; Suspense por aba e limpeza de exports sem uso.
- Motion: concluir `LazyMotion`, incluindo `GradeButtons`; revisar FLIP de `CorrectionList`.
- Acessibilidade: focus trap e retorno do Modal, live regions, labels e scrub de áudio por
  teclado; datas seguras para hydration.
- Pedagogia técnica: consistência do feedback entre Lesson/Correct/Converse; verificar
  proteções de crítica no Ollama, calibração de placement e cobertura editorial das lições.
- Dados e distribuição: restauração observada com alunos, compatibilidade de licenças de
  dependências/modelos/conteúdo e distribuição assinada/notarizada.
- Conteúdo: áudio humano licenciado, diversidade de vozes e progressão real de escuta.
  Não inferir compreensão de fala conectada apenas de playback mais rápido.

Extensão de navegador, sync móvel/AnkiWeb, engine como pacote independente, packs comunitários
e modo professor são ideias adiadas. Prioridades de produto continuam em [product.md](product.md).
