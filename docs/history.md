# PhraseLoop — Histórico de decisões e verificações

Síntese consolidada em 30/09/2026. Registros abaixo descrevem as condições de cada rodada;
contagens de testes e diagnósticos antigos não são um retrato automaticamente atualizado.
Direção vigente: [produto](product.md). Contratos: [arquitetura](README.md).
Estudos com alunos: [validação](validation.md).

## 01/10/2026 — Experiência de aprendizagem e ferramentas do piloto

As onze frentes do plano foram implementadas em commits locais, sem push: descarte do timer
de retry abandonado; oito habilidades/25 situações com enum de prompt derivado do catálogo;
comparação de respostas com condições; até duas situações extras diárias; textos mais
calorosos; origem falada registrada; produção local antes de exemplos; conexão de IA em
três etapas; preferência explícita de idioma em todos os níveis; ferramenta de calibração
com 48 casos sintéticos; exportação local do piloto sem respostas por padrão.

A revisão final restringiu a frase de conclusão à habilidade demonstrada quando a tarefa
inteira não foi atendida e protegeu o limite diário de extras em uma transação, inclusive
com janelas concorrentes. As políticas de evidência e os intervalos do tutor não foram
reduzidos. Prática local e autoavaliação continuam com `evaluated: false`; revisões futuras
existentes não são antecipadas. Não há conta, backend, telemetria ou gamificação novos.

Verificação desta rodada: `yarn test` passou com 894 testes em 113 arquivos; `yarn lint`
passou sem erros e com três avisos preexistentes de variáveis não usadas em testes;
`npx tsc --noEmit -p .` passou. `graphify update .` manteve o grafo atualizado.
O dry-run da calibração verificou 48 casos/oito habilidades, sem chamadas a provedores
e sem medir concordância. Casos sintéticos são fixtures de software, não dados de alunos.

`yarn build` com Turbopack falhou duas vezes por restrição do ambiente ao abrir uma porta
interna no processamento de CSS, inclusive na tentativa com permissão ampliada.
`yarn build --webpack`, opção documentada nesta instalação do Next.js, concluiu o build
de produção e o prebuild de áudio/conteúdo sem alterar a configuração do projeto.
A compilação padrão com Turbopack precisa ser verificada em ambiente que permita a porta.
Não houve revisão visual em navegador nem conexão real com IA nesta rodada.

Pendências humanas: revisar inglês e PT-BR do catálogo/textos e status/resultados esperados
dos casos; executar calibração com provedor configurado; conduzir o piloto de cinco pessoas
e decidir se haverá provedor gerenciado. Nenhum resultado educacional ou de piloto foi
criado. Alterações anteriores sem commit foram preservadas; saídas geradas do Graphify
continuam fora dos commits de implementação desta rodada.

## Auditorias anteriores: conclusões preservadas

As auditorias pedagógicas, de produto e OSS convergiram em uma hipótese plausível, ainda sem
evidência externa de retenção/transferência. Implementar FSRS, correção e conteúdo não demonstra
que o produto ensina melhor. A versão comercial centrada em criar cards com áudio foi substituída
pelo tutor: dificuldade real → feedback → retry → retorno em contexto novo.

| Achado histórico | Destino ou limite atual |
| --- | --- |
| Reconhecimento e autoavaliação podiam parecer produção independente | Resposta antes de revelar e evidência observada; regras em produto. |
| Múltipla escolha sintetizada não mede compreensão ampla | Distinguir discriminação de compreensão; escuta inédita no protocolo. |
| Minutos, conclusões e previsão FSRS podiam parecer aprendizagem | Esforço, desempenho, retenção e transferência separados. |
| Feedback via gramática sem conhecer a tarefa | Contrato de tarefa e habilidade no tutor; revisar consistência dos outros fluxos. |
| Primeiras lições B1–C2 incompletas e cobertura editorial desigual | Contagens antigas variavam por campo; validar o catálogo, não reutilizar percentuais de auditoria. |
| Áudio sintético não sustenta alegação de falantes humanos desconhecidos | Proveniência explícita e aquisição de material humano licenciado ainda necessária. |
| Transcrição/alinhamento não é avaliação fonética | Tratar como apoio; avaliação de pronúncia requer evidência própria. |
| Conversa livre sem fechamento pedagógico | Priorizar feedback/retry/revisão antes de ampliar seu destaque. |
| Ollama podia omitir crítica; placement gerado e avaliado por LLM podia descalibrar | Verificação técnica e calibração permanecem candidatas, não resolvidas por documentação. |
| Muitas superfícies competiam antes da primeira resposta | Navegação essencial, Explorar e apresentação progressiva de 30/09. |
| Faltavam documentos OSS e caminho de contribuição | Hoje existe CONTRIBUTING; compatibilidade de licenças de código, modelos e conteúdo precisa de verificação própria. |
| Mac e dependências nativas restringiam recrutamento/distribuição | Medir perdas por plataforma e fricção de instalação antes de expandir escopo. |

Sugestões de exercícios foram preservadas como opções, não novo roadmap: reconstruir frase
ouvida, resumir, responder pergunta inesperada, explicar de modo simples, comparar respostas,
usar a mesma expressão em contextos diferentes, shadowing, reescrita de registro, continuar
diálogo e simular reunião. Leitura mais longa, reciclagem de vocabulário, trilhas profissionais,
packs comunitários, regras por língua nativa, engine separado e modo professor ficam adiados.

### Critérios exploratórios anteriores

Eram hipóteses do posicionamento centrado em cards; não foram resultados observados nem
substituem o [protocolo atual](validation.md). São mantidos para permitir rever as decisões:

- Recrutar 10 participantes qualificados em 14 dias; se falhar, distinguir segmento de barreira Mac.
- Demo: 500 visualizações qualificadas e cerca de 20 comentários; menos de 2% de conversão ou
  nenhuma menção espontânea ao diferencial sugeriam rever a promessa.
- Comparar criação manual de card com seis usuários de Anki; mediana abaixo de quatro minutos
  ou quatro de seis sem usar áudio enfraqueciam a dor comercial proposta.
- Primeiro ciclo: 6/10 sem ajuda, mediana abaixo de dois minutos, 7/10 capazes de explicar
  a proposta, 40% de retorno D1 e 25% D7; três de dez nomeando diferencial e substituição do fluxo.
- Explain-back abaixo de 7/10 após duas revisões da experiência, ou D7 abaixo de 25% em duas
  coortes, sugeria rever proposta/hábito antes de ampliar conteúdo.
- Menos de 3/10 escolhendo a mesma dor paga em duas coortes sugeria abandonar billing.
- D30 abaixo de 40% era um sinal exploratório para investigar conteúdo e calibração, nunca
  um limiar científico validado nem justificativa automática para mais lógica adaptativa.

### Fontes de pesquisa preservadas

Referências citadas nas auditorias originais, sem nova revisão bibliográfica nesta consolidação.
Sustentam a investigação dos mecanismos, não uma alegação de eficácia do PhraseLoop:

- Roediger, H. L., & Karpicke, J. D. (2006). *Test-enhanced learning: Taking memory tests improves long-term retention*. Psychological Science. https://doi.org/10.1111/j.1467-9280.2006.01693.x
- Cepeda, N. J., Vul, E., Rohrer, D., Wixted, J. T., & Pashler, H. (2008). *Spacing effects in learning: A temporal ridgeline of optimal retention*. Psychological Science. https://doi.org/10.1111/j.1467-9280.2008.02209.x
- Loschky, L. (1994). *Comprehensible input and second language acquisition: What is the relationship?* Studies in Second Language Acquisition. https://doi.org/10.1017/S0272263100013103
- Izumi, S., Bigelow, M., Fujiwara, M., & Fearnow, S. (1999). *Testing the output hypothesis: Effects of output on noticing and second-language acquisition*. Studies in Second Language Acquisition. https://doi.org/10.1017/S0272263199003034
- Izumi, S. (2002). *Output, input enhancement, and the noticing hypothesis*. Studies in Second Language Acquisition. https://doi.org/10.1017/S0272263102004023
- Pica, T., Holliday, L., Lewis, N., & Morgenthaler, L. (1989). *Comprehensible output as an outcome of linguistic demands on the learner*. Studies in Second Language Acquisition. https://doi.org/10.1017/S027226310000830X
- Nation, I. S. P. (2007). *The Four Strands*. Innovation in Language Learning and Teaching. https://doi.org/10.2167/illt039.0
- Council of Europe (2020). *Common European Framework of Reference for Languages: Companion Volume*. https://www.coe.int/en/web/common-european-framework-reference-languages/cefr-companion-volume
- Institute of Education Sciences: [Organizing Instruction and Study to Improve Student Learning](https://ies.ed.gov/ncee/wwc/PracticeGuide/1).

## Implementações anteriores ao tutor

O pipeline unificou fontes, erros, cards, crítica, deduplicação, áudio e exportação; IndexedDB
e FSRS trouxeram revisão e reforço por fraqueza. Conversa ganhou contexto, revisão final e
persistência; o plano ganhou tarefas e adaptação por esforço. O antigo provider heurístico,
YouTube.js/captions e exportador Python foram substituídos pelos caminhos descritos na arquitetura.

Query helpers reduziram scans/N+1; foram registrados guard de double-submit, error boundary
por aba, memoização de estudo e adoção parcial de LazyMotion. Revisão visual de 15/07 registrou
446 testes e inspeção desktop/mobile em dark mode. Scaffold, sessão leve/cooldown, cycle picker
e difficulty band condicionado ao gate foram implementados; benefícios D1/D7 seguem não medidos.

## 29/09 — revisão do aprendizado

Foram registrados blocos finitos de revisão, resposta antes de revelar, retries vinculados,
comparações por cartão/avaliador, provas D7/D30/D60, captura manual sem IA e acesso à biblioteca
no exportador. O onboarding de três telas e a navegação dessa rodada foram depois simplificados.

### Verificação registrada

- **Suíte automatizada:** 88 arquivos, 769 testes aprovados. Inclui regressões de revisão, armazenamento, contratos de avaliação, retenção, rotas, importação e exportação; os novos casos cobrem fila limitada, datas locais, evidência sem dicas, comparação equivalente, novas tentativas e preservação do agendamento ao cadastrar uma frase repetida.
- **TypeScript e lint:** verificação de tipos aprovada; lint sem erros. Permanecem três avisos anteriores de variáveis não utilizadas em dois testes.
- **Conteúdo:** `learn:content:validate` aprovado; `learn:audio:verify` confirmou todos os 1.394 clipes declarados. A ausência de clipes humanos autênticos continua explícita.
- **Compilação:** `yarn build` e `yarn landing:build` aprovados com Next.js 16.3.3. A primeira tentativa encontrou uma restrição do sandbox ao abrir uma porta do compilador; após executar com a permissão adequada e separar o cache dessa falha, o build completo passou.
- **Kokoro real:** a rota local gerou um WAV RIFF/WAVE de 79.426 bytes. A exportação real gerou um `.apkg` de 206.718 bytes; a inspeção do ZIP e do banco Anki confirmou uma nota, um cartão, tradução e áudio referenciado e presente. Nenhum pacote foi importado no Anki do usuário.
- **Navegador:** conferidos onboarding, escolha de cinco minutos, cadastro de frase, revisão nas duas direções, resposta de produção antes da revelação, resumo da revisão e salvamento de tentativa aberta sem avaliador. A inspeção encontrou e levou à correção do título que revelava a resposta em inglês.
- **Limites do teste visual:** a automação nativa deixou de localizar a janela (`cgWindowNotFound`) durante a validação. A conferência visual final de Progresso, das telas restantes e da largura móvel ficou pendente. Não foi feita conversa ao vivo com provedor de IA nem gravação por microfone nesta rodada.
- **Grafo do projeto:** atualizado com `graphify update .`, por extração AST, sem chamadas de avaliação por IA.

## 29/09 — primeira sessão guiada do tutor

Sessões com tarefa, feedback, perguntas, até três tentativas, pausa/rascunho, memória limitada,
contestação, proveniência e backup foram implementadas. A agenda inicial de 24/72 horas foi
substituída pelas regras por habilidade de 1/3/7/14 dias, hoje documentadas em produto.

### Verificação registrada

- TypeScript sem erros; ESLint sem novos avisos (três avisos anteriores em testes de outras funcionalidades).
- Suíte completa: **91 arquivos, 787 testes aprovados**. Inclui contexto limitado e exclusões, situações repetidas, avaliações incertas, fontes geradas, concorrência, persistência de rascunho, consumo do lembrete, backup e migração aditiva.
- Build de produção concluído com `/api/tutor` e validação das 100 lições existentes.
- Teste no navegador com provedor **local simulado, identificado como `tutor-qa-simulado`**: criar tarefa → escrever → recarregar → recuperar rascunho → feedback → pergunta → resposta revisada com apoio → resumo com retomada → salvar frase → Kokoro → exportador carregando a frase → download `.apkg` concluído. Progresso mostrou as duas tentativas, sem alterar as taxas de retenção e transferência não medidas.
- Caminho sem provedor verificado no navegador. Nenhuma IA real estava conectada neste ambiente; o teste simulado valida a integração, não a qualidade pedagógica de um modelo. Microfone/transcrição usam o fluxo existente e não receberam um novo ensaio com fala humana nesta validação.

## 29/09 — refoco e integridade de evidência

### Problemas tratados

Esta tabela substitui a lista anterior de pendências. A coluna “Problema encontrado” descreve o estado **antes** destas correções.

| # | Problema encontrado | Correção aplicada | Limite explícito |
| --- | --- | --- | --- |
| 1 | Texto diferente era suficiente para novo contexto | `scenarioId` e contexto definidos no catálogo; os campos completos precisam corresponder ao cenário. A API remove IDs fornecidos pela geração. | Tarefas livres não recebem crédito de transferência até existir referência e destino verificados. |
| 2 | Atraso contado pela criação da sessão e encerramento original | Horário da tentativa e eventos de dica, feedback, fonte e consulta ao histórico; mínimo de 24h desde a última exposição registrada. | Exposição fora destas superfícies permanece desconhecida. |
| 3 | Diagnóstico contestado ainda sustentava melhora | Contestação e exclusão filtram diagnóstico, progresso e agenda. A exposição ao feedback continua contando, mesmo se sua avaliação for descartada. | O conceito pode continuar como observação; ele não prova melhora sobre um diagnóstico excluído. |
| 4 | Dica antes da primeira tentativa não contava; retries inflavam melhora | Acertos assistidos incluem a primeira resposta. Melhora exige falha específica anterior e sucesso posterior com texto diferente; conta no máximo uma vez por sessão. | São observações de resposta, não pontuação de domínio. |
| 5 | Status geral parcial virava dificuldade específica | `needs_work` precisa de trecho real e correção associada. Resultado da tarefa e resultado da habilidade são tratados separadamente. | A validade linguística do diagnóstico continua dependendo do avaliador. |
| 6 | Mesma habilidade em raízes diferentes ficava fragmentada | `conceptId` canônico, agregação por conceito e estados derivados; origem e episódio continuam registrados. | Labels livres legados não são fundidos por suposição. |
| 7 | CTA exigia outro início; “novo” retomava sessão aberta | Intenções `recommended` e `new`, início automático da recomendação e passagem explícita de fonte. | Sem IA, a interface oferece configuração e revisões. |
| 8 | Toda retomada inventava dificuldade/melhora | Motivo e resumo dependem da evidência; exclusão e incerteza são apresentadas. | Os textos não afirmam domínio definitivo. |
| 9 | Captura terminava apenas em cards | CTA da captura transporta `sourceCardId` para uma situação. Memória de dificuldade nasce após uma resposta real. | Históricos de conversa e correção isolada continuam observações; sua normalização completa foi adiada. |
| 10 | Progresso geral e tutor pareciam se contradizer | Tutor é a leitura principal; métricas adicionais têm escopo identificado. Comparação cruza sessões e a consulta é registrada. | `ProductionAttempt.evaluated: false` continua protegendo as métricas antigas contra dupla interpretação. |
| 11 | Primeiro uso e landing continuavam cards-first/A1 | Defaults A2/profissional para novos perfis, proposta pública e demo centradas no ciclo. | Outros objetivos e ferramentas continuam acessíveis. |

Evidências: [catálogo](../src/features/tutor/catalog.ts), [agregação](../src/features/tutor/learning.ts), [agenda e razões](../src/features/tutor/model.ts), [contrato da API](../src/app/api/tutor/route.ts), [rubrica](../src/features/tutor/prompts.ts), [histórico persistido](../src/features/tutor/store.ts).

### Verificação registrada

- **824 testes passaram em 97 arquivos** na suíte completa, incluindo os testes novos de evidência e contratos do tutor.
- TypeScript do app e da landing passou.
- ESLint dos módulos alterados do app e da landing passou.
- Builds de produção do app e da landing (`next build --webpack`) passaram. O build da landing precisou de acesso à rede para baixar a fonte Google já usada pelo projeto.
- Chrome isolado: onboarding A2/profissional, início direto, erro e retry, persistência, avanço controlado de 24h, contexto diferente, resposta independente e revisão de sete dias.
- Chrome: comparação entre sessões, persistência da consulta ao histórico, prática nova sem reabrir a anterior, captura → tutor com origem e apoio, preservação do rascunho anterior.
- Progresso verificado em largura de 390px sem transbordamento horizontal. A demo da landing foi verificada em português e inglês, incluindo largura móvel; o transbordamento do título foi corrigido.
- `graphify update .` executado para atualizar o grafo após as alterações de código.
- Consulta ao endpoint público de configuração: Ollama, OpenRouter, Claude e OpenAI indisponíveis. Não foi feita avaliação com provedor real.

O teste de navegador usa **respostas e relógio controlados**, em contexto novo, sem alterar os dados do navegador do aluno. Ele está disponível em [scripts/verify-tutor-loop.mjs](../scripts/verify-tutor-loop.mjs). Precisa do app iniciado e Playwright/Chrome instalados; pode receber `PLAYWRIGHT_MODULE` apontando para uma instalação temporária e `TUTOR_BASE_URL` para outra porta.

Testes relevantes: [evidência e regressões](../src/features/tutor/learning.test.ts), [agenda e modelo](../src/features/tutor/model.test.ts), [persistência e backup](../src/features/tutor/store.test.ts), [API e diagnóstico ancorado](../src/app/api/tutor/route.test.ts).

Limites ainda relevantes: catálogo pequeno, exposição externa desconhecida, necessidade de
calibração linguística e revisão humana; fonte livre não prova contexto novo. Variação imediata
foi adiada e integração automática de conversas/correções continua fora do corte entregue.
Software exercitado com relógio controlado não equivale ao retorno de um aluno em outro dia.

## 30/09 — experiência progressiva

O diagnóstico e as matrizes de superfícies originais antecederam as alterações. A implementação concentrou a primeira experiência no tutor e manteve a alternativa local de lições e revisão. Não houve mudança de algoritmo de agendamento, critérios de avaliação ou migração de dados de aprendizado nesta intervenção.

| Prioridade | Entrega |
| --- | --- |
| P0 | Boas-vindas em uma tela, personalização opcional, início direto da tarefa; home com recomendação principal; lição/revisão quando não há IA; navegação essencial e menu Explorar. |
| P1 | Estado de experiência derivado dos registros existentes; prioridade à sessão interrompida; resumo com data de retorno e volta a Hoje; orientação inicial desaparece após ciclo válido. |
| P2 | Estado vazio único em Frases; importação secundária em Conteúdo; ajustes colapsados em Conversa; progresso sem coleção inicial de zeros; busca da biblioteca só quando há itens. |
| P3 | Evidências, perguntas, testes adicionais, detalhes de escuta e opções Anki sob demanda; nível, objetivo e duração editáveis em Configurações; acesso C1 sem requisito de tier. |
| P4 | Uma sugestão contextual por vez; dispensar ou seguir a sugestão a retira; preferência e dispensas persistem localmente; navegação completa pode ser ativada desde o primeiro dia. |
| P5 | Rótulos em português/inglês, elementos nativos de disclosure, tratamento de foco no menu, hierarquia responsiva; plano lê o perfil ao abrir; passos sem IA correspondem ao percurso local. |

O modelo está em `src/features/activation/experience.ts`, com seis testes de regras. `useExperience.ts` combina os recursos compartilhados de histórico existentes. `experiencePreferences.ts` guarda somente preferências de apresentação; não cria uma segunda fonte de dados de aprendizado. Essas preferências não integram o backup de aprendizado. A navegação não se reorganiza automaticamente por nível: o usuário controla a opção de atalhos completos, e os estados controlam orientação e sugestões.

### Verificação executada

- Suíte completa Vitest: **100 arquivos, 837 testes aprovados**, incluindo os seis novos testes de experiência.
- TypeScript sem emissão, ESLint dos arquivos alterados e `git diff --check`: aprovados.
- O script existente `scripts/verify-tutor-loop.mjs` teve seletores adaptados e sintaxe verificada; não foi executado como teste de navegador nesta tarefa. A inspeção de interface foi feita no Chrome pela automação visual.
- `graphify update .`: atualização AST do grafo, sem análise semântica paga.

| Jornada observada no navegador | Resultado |
| --- | --- |
| Nova com IA | Uma tela de boas-vindas → tarefa → resposta → feedback focal → retry → resumo → Hoje. O checklist inicial sai após concluir o ciclo. |
| Pós-primeiro ciclo / intermediária | Home permite parar, informa a data de retomada e sugere conteúdo próprio; importação e ajustes de conversa ficam sob demanda. |
| Recorrente | Recarregar mantém a sessão concluída e as preferências; a sugestão dispensada não reaparece. |
| Interrompida | Digitar resposta → Pausar e voltar → recarregar → Continuar prática recupera a mesma tarefa e o texto digitado. |
| Avançada / pula etapas | Explorar abre as demais áreas; Mostrar todos os atalhos deixa as cinco abas visíveis e persiste após recarregar. C1 abre desde o início por Configurações. |
| Sem IA | Onboarding leva à lição disponível; home orienta escolher, salvar e revisar; Frases não duplica o estado vazio; conexão é secundária. |
| Tela estreita | Inspeção em 390 × 844: home e navegação se acomodam, Explorar permanece dentro da tela, progresso vazio orienta a primeira prática. |
| Falha real do provedor | Ollama local devolveu avaliação incompleta; a interface exibiu o erro e preservou a resposta para nova tentativa. |

### Limites da evidência

O ciclo de sucesso no navegador usou um provedor determinístico identificado como `ux-fixture`, por meio de um proxy temporário restrito a localhost e origens descartáveis. A aplicação continuou usando sua persistência real; não foram alterados os dados do perfil original. A chamada ao Ollama real não comprovou o caminho de sucesso, devido à resposta incompleta mencionada acima. Portanto, este trabalho valida a jornada de interface e a recuperação de falhas, mas não a qualidade pedagógica do modelo.

Familiaridade após intervalo de 24 horas, exclusões de evidência e histórico legado foram validados por testes de estado; não se observou um aluno retornando em outro dia. A inspeção cobre navegação e hierarquia das superfícies mapeadas, mas não constitui execução integral de todas as integrações: microfone, geração de áudio, importação de mídia, pacote Anki e restauração de backup não tiveram novos testes ponta a ponta nesta tarefa. A continuidade verificada por refresh é a do tutor; não foi adicionado checkpoint às etapas das lições locais.

O próximo aprendizado de produto depende de um piloto com alunos: observar se completam a primeira tentativa sem orientação externa, se compreendem o ajuste e se voltam quando a retomada é elegível. Nenhum aumento de ativação ou retenção está sendo atribuído a esta implementação sem essa observação.

## Consolidação documental

Doze documentos de produto, arquitetura, estudos e planos foram reduzidos a quatro:

| Material anterior | Destino |
| --- | --- |
| Proposta e implementação do tutor; diagnóstico de refoco | Produto, arquitetura e verificações neste histórico. |
| Experiência progressiva e revisão do aprendizado | Regras vigentes em produto/arquitetura; entregas e limites neste histórico. |
| Auditoria adversarial, revisão educacional e auditoria pedagógica/OSS consolidada | Síntese, referências e critérios exploratórios neste histórico; pendências na arquitetura. |
| Protocolo de eficácia e log de validação | Validação, preservando estudo, amostra, desfechos e tabela do piloto. |
| Antigos roadmaps e listas de implementação dos documentos canônicos | Direção vigente em produto; contratos na arquitetura. |

A tabela de 64 IDs de lições permanece em produto porque o validador de conteúdo a utiliza.
READMEs de componentes, instruções de agentes, skills e saídas geradas do Graphify mantêm
seus destinos próprios. Esta consolidação não altera código do aplicativo nem executa
novamente os testes históricos listados acima.
