# PhraseLoop — Produto

Direção vigente consolidada em 30/09/2026 a partir do refoco do tutor e da experiência
progressiva. Este arquivo concentra decisões atuais; diagnósticos anteriores são contexto
em [history.md](history.md), não uma segunda lista de prioridades.

- [README do projeto](../README.md): apresentação, instalação e execução.
- [Arquitetura](README.md): contratos, implementação e backlog técnico.
- [Validação](validation.md): pilotos, protocolo de eficácia e registro de participantes.

## Proposta e público

**O inglês que você errou hoje vira a prática de amanhã.**

PhraseLoop é um tutor de inglês local-first para brasileiros A2–B1, inicialmente com
necessidades profissionais. Trabalha uma capacidade em uma situação concreta, oferece
feedback sobre a resposta e retoma a mesma habilidade em outro contexto, em outro dia.
O aluno deve entender o que praticar, o que ajustar e o que consegue fazer com menos ajuda.

O ponto de partida de um perfil novo é A2 e objetivo profissional, ambos editáveis.
Preferências anteriores são preservadas. A1, níveis avançados, outros objetivos e ferramentas
continuam acessíveis; não são o foco desta validação. O ambiente desktop é prioritário.
Não há criação de conta: perfil e histórico são locais.

Conteúdo próprio, áudio original, revisão espaçada e exportação Anki apoiam essa experiência.
O tutor personalizado precisa de IA conectada; sem IA, lições e revisão locais oferecem uma
primeira ação útil. Nuvem depende da escolha explícita do aluno.

## Ciclo principal

1. Hoje recomenda continuar uma sessão, retomar uma habilidade devida ou começar uma situação.
2. O aluno responde antes de ver o exemplo, por texto ou transcrição editável.
3. O feedback verifica a tarefa e a habilidade, mostra até dois ajustes e permite contestação.
4. O aluno reconstrói a resposta com apoio, até três tentativas na sessão. Um acerto inicial
   pode encerrar o ciclo sem inventar um erro. Pausar mantém tarefa e rascunho.
5. O resumo mostra a evidência observada e a data de retorno; salvar uma frase é opcional.
6. Em outro dia, a mesma habilidade reaparece em outra situação verificada, quando disponível.
7. Progresso compara respostas com contexto, data, avaliador e condições de apoio.

“Praticar algo novo” tem intenção própria e preserva a sessão anterior. Uma frase salva ou
manual pode abrir uma situação com origem registrada; essa primeira prática conta como
assistida. Conversas e correções isoladas ainda não viram dificuldades canônicas automaticamente.

O catálogo verificado inicial tem duas habilidades (`present-perfect-duration` e
`polite-requests`) e sete situações. Tarefas livres podem ser úteis sem receber crédito de
novidade. Uma fonte sem contexto verificado precisa de uma referência verificada posterior
antes de demonstrar transferência para outro contexto.

## Evidência e agenda

Concluir atividades, marcar uma autoavaliação, exportar cards ou passar tempo no app não
comprova aprendizagem. Os critérios abaixo são políticas iniciais de produto, não uma
certificação de domínio ou uma medida validada de proficiência.

### Critérios de evidência

**Acerto assistido:** a habilidade foi demonstrada, com avaliação global não inconclusiva, mas houve dica, retry, conteúdo-fonte ou exposição registrada há menos de 24h. O status geral da tarefa não é reutilizado como diagnóstico de erro da habilidade.

**Melhora após feedback:** houve uma dificuldade específica válida e um retry posterior demonstrou a habilidade com texto diferente, na mesma sessão. Múltiplos retries corretos continuam sendo uma sessão com melhora.

**Acerto independente:** a habilidade foi demonstrada na primeira tentativa, sem apoio marcado e sem exposição registrada nas últimas 24h. Uma resposta inicial correta pode ser observada sem afirmar que houve uma dificuldade anterior.

**Transferência observada:** além de independente, a resposta vem pelo menos 24h após uma dificuldade válida, em contexto verificado diferente de todos os contextos verificados anteriores. É necessário já ter uma referência de contexto verificado. Cópia normalizada de uma resposta ou exemplo anterior não recebe esse crédito. Repetir um contexto pode ser recuperação, mas não aumenta diversidade.

**Evidência consistente:** ao menos dois contextos novos com transferência, em ocasiões separadas por 24h ou mais, após a dificuldade válida mais recente. Uma nova dificuldade faz o estado voltar a desenvolvimento. Contagens históricas não são apagadas.

Estados apresentados: em desenvolvimento; aguardando confirmação independente; transferência observada; evidência consistente. São políticas iniciais de produto, não uma medida científica de domínio.

### Agenda explicável

- Sessão em andamento tem prioridade de continuação.
- Entre habilidades devidas: dificuldade atual → acerto só com apoio → falta de transferência → confirmação de evidência observada/consistente.
- Próximo intervalo: 1 dia após apoio ou tarefa não atendida; 3 após acerto ainda sem transferência; 7 com transferência; 14 com evidência consistente.
- Nunca antes de 24h desde a última exposição registrada daquela habilidade.
- A sessão mais recentemente praticada representa o conceito na agenda. Consultar uma sessão antiga não a transforma na prática mais recente.
- Excluir todas as avaliações elegíveis retira sua base de agendamento. Optar por não sugerir uma retomada não apaga evidência de progresso.

A independência é limitada à exposição conhecida: dica, feedback, fonte e consulta de
histórico registrados. Ajuda externa e exposição em todas as ferramentas não são observáveis
integralmente. A comparação registra exposição **antes** de revelar respostas.
Diagnósticos contestados ou excluídos deixam de sustentar progresso e agenda; a exposição
ao feedback continua registrada. Sem avaliação válida, a resposta permanece prática.

Na revisão de cards, recuperação independente exige resposta antes de revelar, correção
observada e ausência de apoio. A comparação semanal usa a última observação por cartão e
avaliador, com ao menos cinco cartões comuns às duas janelas. Provas D7/D30/D60 são separadas
do FSRS. A projeção das tentativas do tutor nas métricas gerais usa `evaluated: false`;
os resultados específicos do tutor ficam em seu próprio contrato.

## Primeira experiência e descoberta

Uma tela curta de boas-vindas oferece começar, personalizar ou explorar. Com IA, começar abre
a situação recomendada; sem IA, abre uma lição local. Nível, objetivo, tempo, CEFR, provedores
e Anki não devem competir com a primeira resposta. Tempo de 5/10/20 minutos orienta o tamanho
da prática, sem prometer duração exata.

Hoje e Frases formam a navegação essencial. Conteúdo, Conversa e Progresso ficam acessíveis
em Explorar; “Mostrar todos os atalhos” funciona desde o início. Configurações mantém perfil,
conexão, ferramentas, C1 experimental, backup e exclusão acessíveis. Familiaridade nunca
bloqueia uma ferramenta nem equivale a proficiência em inglês.

### Estados de experiência

Estados são derivados dos registros existentes. Não criar níveis pedagógicos paralelos nem inferir ativação de `onboardingCompleted`, clique, tier legado, número de arquivos importados ou declaração de C1.

| Estado | Aprendeu | Visível e reduzido | Próxima ação | Condição de transição |
| --- | --- | --- | --- | --- |
| NEW_USER · maturidade 0 | Ainda sem ação observável | Hoje, Frases, ação inicial; demais destinos em Explorar | Responder ou iniciar apoio local | Sessão iniciada, produção ou frase salva |
| FIRST_ACTION · maturidade 0 | Encontrou um ponto de partida | Retomar atividade; ferramentas sob demanda | Receber feedback / revisar a frase | Tentativa avaliada elegível ou revisão da frase |
| FIRST_RESULT · maturidade 1 | Viu retorno sobre uma tentativa | Feedback, retry, ajuda contextual | Reconstruir e encerrar | Sessão completa com tentativa válida e retry, ou resposta inicial atendida; caminho local exige salvar e revisar a mesma frase |
| FIRST_LOOP_COMPLETE · maturidade 1 | Conhece um ciclo | Data de retorno, resultado, uma descoberta | Voltar quando houver prática devida | Nova prática em outro dia, pelo menos 24h após ciclo anterior |
| FAMILIAR_USER · maturidade 2 | Retomou prática | Resumo, pendências, atalhos relacionados e organização sob demanda | Usar conteúdo próprio / variar contexto | Retomada em outro dia e uso real de fonte própria ou fluxo complementar |
| POWER_USER · maturidade 3 | Combina fluxos | Atalhos completos por preferência explícita; ferramentas diretas | Executar com eficiência | Estado de orientação, sem novo desbloqueio |

Uma resposta incerta, contestada ou excluída não estabelece primeiro resultado válido. Uma sessão vazia encerrada não completa ciclo. Um aluno importado com revisões anteriores não deve receber instrução básica repetida. A maturidade adapta a orientação, nunca limita acesso. “Mostrar todos os atalhos” é uma preferência explícita separada dos estados e deve funcionar desde o início. Restaurar backup recalcula os estados. Falha ao ler histórico exibe recuperação e não trata o aluno como novo.

### Regras de apresentação

- Hoje oferece uma ação dominante e no máximo uma descoberta contextual. Após a prática,
  há um lugar claro para parar e uma data de retorno.
- Dica permanece acessível; pergunta livre, histórico, estatísticas e parâmetros ficam sob demanda.
  Feedback, contestação e falhas operacionais permanecem encontráveis.
- Frases vazias têm uma explicação e uma ação de lição. Biblioteca sempre acessível; busca só
  com material. Conteúdo prioriza captura manual e abre importação por intenção ou prefill.
- Conversa começa com um cenário; parceiro, modo e nível ficam em ajustes opcionais.
- Progresso vazio orienta a primeira prática. Com histórico, habilidades e respostas vêm antes
  de contagens. Anki prioriza frases salvas; JSON, voz e arquivo ficam em opções avançadas.
- Plano é opcional e lê o perfil ao abrir. C1 não depende de tier ou de cliques anteriores.
- Uma sugestão pode propor revisão após salvar, conteúdo próprio após o primeiro ciclo, ou
  conversa após retorno e uso de fontes. Dispensar ou seguir a sugestão a retira; não há popup
  nem reapresentação automática. Falha de armazenamento ainda respeita a dispensa na sessão.
- Preferências de apresentação são locais e separadas do histórico de aprendizagem; não
  integram seu backup. A navegação completa depende de preferência explícita.

## Escopo e prioridades

| Área | Papel atual |
| --- | --- |
| Hoje, tutor, memória de habilidade, retorno e progresso | Núcleo a validar com alunos. |
| Persistência, pausa, backup e restauração | Continuidade necessária para retornar. |
| Conteúdo, cards/FSRS, correção, conversa, lições e escuta | Apoio ao ciclo; não usar suas contagens como prova de transferência. |
| Pronúncia, transcrição, Kokoro e Anki | Ferramentas disponíveis; texto transcrito não mede pronúncia. |
| Plano, configurações e idiomas de interface | Apoio por intenção do aluno. |
| Expansão C1, catálogo, idiomas, provedores, analytics e currículo adaptativo longo | Adiada enquanto o ciclo A2–B1 profissional é validado. |

Próximos passos:

1. Calibrar o feedback com provedor real e revisão humana de respostas corretas, incorretas,
   paráfrases válidas e evasão da habilidade. Trecho literal não garante diagnóstico correto.
2. Observar primeiro uso, retry e retorno elegível em outros dias com alunos A2–B1.
3. Validar retenção e transferência com intervalos, apoio e contextos registrados.
4. Verificar restauração com dados reais, confiabilidade de importação e distribuição desktop
   assinada/notarizada antes de ampliar o lançamento.
5. Ampliar integração de conversas/correções, catálogo ou recursos apenas quando a evidência
   justificar. Uma variação imediata continua prática próxima do feedback, não retenção posterior.

As jornadas implementadas e suas verificações estão no [histórico](history.md).
A suíte de software não demonstra eficácia educacional. O [protocolo de validação](validation.md)
separa descoberta de produto, piloto de instrumentação e estudo confirmatório.

## Modelo de negócio

Hipótese a validar: base gratuita local, lições, SRS e chave própria; uma eventual oferta paga
resolve uma dor concreta. Candidatos anteriores: nuvem gerenciada sem chave, revisão com sync
entre dispositivos ou conteúdo curado. Nenhum é compromisso de implementação.

Perguntar o que a pessoa já paga, qual dor recorrente removeria e qual rotina substituiria.
O critério exploratório anterior de ao menos 3/10 nomearem a mesma dor paga continua como
referência para investigar; sem esse sinal, billing fica fora do roadmap. Não confundir
disposição declarada com compra observada.

## Princípios de aprendizagem e confiança

Produção antes da resposta, recuperação espaçada, feedback focal e retry orientam o método.
Desafio e apoio devem se ajustar sem forçar dificuldade, inventar domínio ou transformar CEFR
autodeclarado em nível comprovado. Observações, preferências e interpretações provisórias
precisam permanecer distinguíveis, com origem e controle do aluno.

Áudio sintético deve ser identificado; velocidade aumentada não comprova compreensão de
fala natural ou de vozes desconhecidas. Priorizar comparação consigo mesmo, com exemplos,
em vez de XP, moedas, badges, pressão de sequência ou notificações agressivas.

C1 permanece experimental: amostra curta, evidência ao lado de cada dificuldade, um domínio
e prática com feedback. Nunca mostrar um rótulo de fraqueza sem frase real. Continuar sua
expansão apenas se o diagnóstico mudar a prática e gerar retorno voluntário.

## Currículo

O bundle atual contem **100 licoes e 804 frases** em `src/features/learn/lessons.json`. O foco
editorial continua em A2-B1, mas existe uma trilha completa de A1 a C2. O numero de licoes nao e
evidencia de aprendizagem; uma licao so esta pronta para release depois de revisao de ingles e
PT-BR, audio com proveniencia, QA tecnico e piloto com learners.

| Level | Current | Target | Add | Final share |
| --- | ---: | ---: | ---: | ---: |
| A1 | 15 | 15 | 0 | 15% |
| A2 | 22 | 22 | 0 | 22% |
| B1 | 25 | 25 | 0 | 25% |
| B2 | 18 | 18 | 0 | 18% |
| C1 | 12 | 12 | 0 | 12% |
| C2 | 8 | 8 | 0 | 8% |

### Gates editoriais

1. Conteudo: objetivo comunicativo, contexto real, frases uteis, dialogo, compreensao,
   producao, feedback, retry e review conectados.
2. Audio: texto e clip correspondem, entrega natural adequada ao nivel, diversidade de vozes e
   proveniencia/licenca registrada. Kokoro e fallback sintetico, nao audio nativo.
3. Pedagogia: naturalidade, traducao PT-BR, carga CEFR e utilidade revisadas; nao tratar a falta
   de compreensao palavra por palavra como fracasso.
4. Tecnico: IDs unicos, clips decodificaveis, perguntas nao ambiguas, traducoes presentes e
   testes/typecheck/lint/build aprovados.
5. Evidencia: piloto mede conclusao, compreensao, retry, frases salvas e retorno D+1/D+7.

### Backlog original incorporado pelo validador

As 64 adicoes abaixo ja existem no bundle. A tabela permanece porque
`scripts/validate-lesson-content.mjs` usa os IDs para validar a cobertura e os campos expandidos.

| Wave | Proposed id | Lesson focus |
| --- | --- | --- |
| 2 | `a1-classroom` | Classroom objects and simple instructions |
| 2 | `a1-time-dates` | Clock time, days, dates, and schedules |
| 2 | `a1-likes` | Likes, dislikes, and simple reasons |
| 2 | `a1-abilities` | What I can and cannot do |
| 3 | `a1-errands` | Simple errands and everyday requests |
| 3 | `a1-feelings` | Feelings, preferences, and immediate needs |
| 1 | `a2-cooking` | Ingredients, quantities, and cooking instructions |
| 1 | `a2-hobbies` | Free-time activities and frequency |
| 1 | `a2-hotel` | Checking in, room needs, and simple complaints |
| 1 | `a2-airport` | Check-in, security, gates, and delays |
| 1 | `a2-appointments` | Booking and changing appointments |
| 1 | `a2-clarification` | Asking someone to repeat, slow down, or explain |
| 2 | `a2-responsibilities` | Chores, responsibilities, and routine obligations |
| 2 | `a2-technology` | Devices, messages, passwords, and basic problems |
| 2 | `a2-comparisons` | Comparing people, places, and products |
| 2 | `a2-childhood` | Childhood routines and simple memories |
| 2 | `a2-obligations` | Rules with have to, must, and can |
| 3 | `a2-home-problems` | Repairs and common problems at home |
| 3 | `a2-celebrations` | Invitations, birthdays, and celebrations |
| 3 | `a2-social-plans` | Hosting, joining, confirming, and declining social events |
| 1 | `b1-job-interviews` | Experience, strengths, and interview follow-ups |
| 1 | `b1-work-meetings` | Updates, questions, and action items |
| 1 | `b1-email-messages` | Clear professional email and chat tone |
| 1 | `b1-travel-problems` | Missed connections, lost items, and alternatives |
| 1 | `b1-personal-finance` | Budgets, bills, saving, and everyday money decisions |
| 1 | `b1-storytelling` | Sequencing and adding detail to personal stories |
| 1 | `b1-recommendations` | Reviews, recommendations, and supporting reasons |
| 1 | `b1-apologies` | Apologizing, taking responsibility, and repairing a situation |
| 2 | `b1-reasons-examples` | Explaining a point with reasons and examples |
| 2 | `b1-news-media` | Summarizing news and distinguishing fact from opinion |
| 2 | `b1-health-fitness` | Exercise, wellbeing, and sustainable routines |
| 2 | `b1-habits-change` | Describing change, setbacks, and progress |
| 2 | `b1-processes` | Explaining how a familiar process works |
| 2 | `b1-goals-progress` | Setting goals and reflecting on progress |
| 3 | `b1-cultural-differences` | Comparing customs without overgeneralizing |
| 3 | `b1-community-services` | Public services, local issues, and asking for support |
| 3 | `b1-relationships-boundaries` | Expectations, boundaries, and respectful disagreement |
| 2 | `b2-cause-effect` | Explaining causes, consequences, and contributing factors |
| 2 | `b2-persuasion` | Persuading without overstating a claim |
| 2 | `b2-project-management` | Scope, deadlines, dependencies, and risks |
| 2 | `b2-feedback-leadership` | Giving balanced feedback and setting expectations |
| 2 | `b2-data-interpretation` | Interpreting charts, changes, and uncertainty |
| 3 | `b2-ethical-dilemmas` | Weighing principles and practical consequences |
| 3 | `b2-remote-work` | Collaboration, autonomy, and communication trade-offs |
| 3 | `b2-media-bias` | Framing, evidence selection, and source reliability |
| 3 | `b2-uncertainty` | Speculation, probability, and calibrated confidence |
| 4 | `b2-proposals` | Presenting and defending a structured proposal |
| 4 | `b2-professional-disagreement` | Disagreeing clearly while preserving cooperation |
| 4 | `b2-root-causes` | Diagnosing problems beyond immediate symptoms |
| 4 | `b2-competing-views` | Summarizing and comparing competing positions |
| 3 | `c1-diplomatic-disagreement` | Challenging assumptions with diplomatic precision |
| 3 | `c1-presentations-q-and-a` | Handling difficult questions after a presentation |
| 3 | `c1-stakeholders` | Aligning stakeholders with conflicting priorities |
| 4 | `c1-crisis-communication` | Communicating uncertainty and action under pressure |
| 4 | `c1-policy-analysis` | Evaluating policy aims, mechanisms, and side effects |
| 4 | `c1-research-discussion` | Discussing evidence, limitations, and implications |
| 4 | `c1-mentoring` | Coaching, reframing, and asking productive questions |
| 4 | `c1-strategic-priorities` | Distinguishing urgent work from strategically important work |
| 4 | `c1-nuanced-narratives` | Telling complex stories with shifts in stance and perspective |
| 4 | `c2-implicit-assumptions` | Exposing assumptions and expressing epistemic caution |
| 4 | `c2-analogy-metaphor` | Using and critiquing analogy, metaphor, and framing |
| 4 | `c2-high-stakes-negotiation` | Strategic ambiguity and precise concessions |
| 4 | `c2-editorial-argument` | Building a concise, rhetorically controlled editorial argument |
| 4 | `c2-debate-synthesis` | Synthesizing dense debate without flattening disagreement |

Status: todos os quatro waves foram escritos e passam o QA estrutural, mas continuam pendentes
de proveniencia de audio, revisao editorial e pilotos. Expansao alem de 100 licoes so entra no
roadmap se a validacao mostrar demanda por mais curriculo bundled.

## Manutenção da documentação

Atualizar produto quando mudar prioridade ou comportamento de aprendizagem; arquitetura
quando mudar contrato ou fluxo técnico; validação quando mudar protocolo ou houver dados;
histórico para marcos e limites de verificações. Evitar um novo MD por sessão de trabalho
ou uma segunda lista de tarefas concluídas. Planos temporários devem ser incorporados ao
documento responsável quando encerrados. Instruções e skills de ferramentas ficam em seus
locais próprios; arquivos gerados pelo Graphify são mantidos pela ferramenta.
