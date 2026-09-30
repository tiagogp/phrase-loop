# Tutor com LLM — primeira versão

Implementado em 29/09/2026, a partir da [proposta de produto](tutor-llm-concept.md).

## Experiência disponível

Em **Hoje → Praticar com meu tutor**, o aluno escolhe um objetivo concreto. Tempo de 5/10/20 minutos, nível informado e uma frase salva como ponto de partida ficam em ajustes opcionais. As outras áreas também têm acesso ao tutor, preservando as cinco abas principais, a conversa livre e a adição de conteúdo.

A IA escolhida propõe uma situação sem mostrar uma resposta pronta. O aluno escreve ou usa a transcrição opcional, que pode editar antes de enviar. Recebe feedback sobre a tarefa, até dois ajustes e um exemplo identificado como gerado por IA. Pode perguntar, pedir uma dica, contestar a avaliação ou reconstruir a resposta. A sessão termina após até três tentativas ou quando o aluno decide encerrar.

O resumo mostra as respostas reais, as condições de apoio e o avaliador. **Progresso** também mostra a primeira e a última resposta da sessão mais recente. Não transforma o feedback em porcentagem de domínio, estimativa CEFR ou avaliação de pronúncia.

Uma retomada é agendada para 24 horas depois, ou 72 horas se a última resposta atender ao objetivo sem apoio e sem contestação. Essa é uma política inicial de produto, não um intervalo otimizado ou resultado de pesquisa. A retomada aparece em Hoje quando vence, pede uma nova situação para a mesma capacidade e mantém o vínculo com a sessão anterior. O lembrete anterior só é consumido quando existe uma tentativa na retomada. O aluno pode dispensá-lo.

O exemplo pode ser ouvido com **Kokoro** e salvo como frase de reconhecimento e produção. Em **Kokoro & Anki → Usar minhas frases salvas**, ele entra no fluxo de exportação existente. Exportar não conta como aprender; o app não presume acesso às revisões externas do Anki.

## Memória e integridade dos registros

- **Preferências:** objetivo e idioma das explicações editáveis em “O que meu tutor lembra”. O nível escolhido na sessão não altera o nível geral do perfil.
- **Observações:** respostas de práticas, revisões, conversas já avaliadas/registradas e sessões do tutor, com origem, data e informação de apoio disponível. A ausência de informação de apoio continua explícita.
- **Contexto da IA:** até seis registros permitidos; material escolhido e a sessão anterior vinculada têm prioridade, seguidos por relevância textual e recência. Perguntas recebem até quatro trocas anteriores daquela sessão. O histórico completo não é enviado.
- **Controle do aluno:** excluir uma observação do contexto não apaga o histórico. Avaliações contestadas deixam de orientar o tutor, inclusive quando estavam no contexto de uma sessão antiga. A recomendação é uma escolha de prática, não um diagnóstico permanente.
- **Persistência:** IndexedDB v13 adiciona `tutorSessions` e `tutorPreferences`. Rascunhos são salvos a cada edição; sessão e projeções das tentativas são gravadas atomicamente. Revisões concorrentes impedem que outra janela sobrescreva dados silenciosamente.
- **Portabilidade:** as novas coleções entram no backup, restauração validada e exclusão de dados existentes. Backups anteriores, sem essas coleções, continuam aceitos. Atualizações bloqueadas por uma janela antiga exibem instrução para fechar as outras janelas e recarregar.

As tentativas projetadas em `productionAttempts` contam como prática realizada e mantêm `retryOf`, mas usam `evaluated: false` para as métricas gerais: a rubrica do tutor avalia realização da tarefa, enquanto os indicadores existentes pressupõem outros critérios e contagem de erros. O resultado específico e o instrumento real (`provider`, modelo e versão do prompt) permanecem no registro do tutor. Não são geradas provas de retenção ou transferência a partir de uma simples opinião da IA.

## Arquitetura

- [Tipos e estados](../src/features/tutor/types.ts), [validação](../src/features/tutor/contract.ts), [regras de memória e retomada](../src/features/tutor/model.ts).
- [Persistência com controle de concorrência](../src/features/tutor/store.ts) e [fila de salvamento/cancelamento](../src/features/tutor/useTutorSession.ts).
- [Endpoint `/api/tutor`](../src/app/api/tutor/route.ts): ações limitadas a planejar, avaliar e explicar, usando a abstração existente de OpenAI, Claude, OpenRouter e Ollama. Sem novo SDK ou troca de provedor global.
- [Prompts](../src/features/tutor/prompts.ts): dados tratados como citações, aceitação de paráfrases, incerteza explícita, prioridade comunicativa. A validação rejeita saídas incompletas, trechos de correção ausentes na resposta e repetição literal da situação anterior. Ela não prova a qualidade semântica de todas as respostas possíveis.
- [Entrada e configuração](../src/features/tutor/components/TutorWorkspace.tsx), [sessão](../src/features/tutor/components/TutorPractice.tsx), [memória visível](../src/features/tutor/components/TutorMemoryPanel.tsx) e [comparação em Progresso](../src/features/tutor/components/TutorProgressCard.tsx).

Sem IA disponível, o tutor preserva a sessão e oferece conexão ou acesso às práticas existentes. Falha, timeout, cancelamento ou resposta inválida não apagam o rascunho nem registram um acerto. Nenhuma chave é armazenada nos registros do tutor.

## Validação realizada

- TypeScript sem erros; ESLint sem novos avisos (três avisos anteriores em testes de outras funcionalidades).
- Suíte completa: **91 arquivos, 787 testes aprovados**. Inclui contexto limitado e exclusões, situações repetidas, avaliações incertas, fontes geradas, concorrência, persistência de rascunho, consumo do lembrete, backup e migração aditiva.
- Build de produção concluído com `/api/tutor` e validação das 100 lições existentes.
- Teste no navegador com provedor **local simulado, identificado como `tutor-qa-simulado`**: criar tarefa → escrever → recarregar → recuperar rascunho → feedback → pergunta → resposta revisada com apoio → resumo com retomada → salvar frase → Kokoro → exportador carregando a frase → download `.apkg` concluído. Progresso mostrou as duas tentativas, sem alterar as taxas de retenção e transferência não medidas.
- Caminho sem provedor verificado no navegador. Nenhuma IA real estava conectada neste ambiente; o teste simulado valida a integração, não a qualidade pedagógica de um modelo. Microfone/transcrição usam o fluxo existente e não receberam um novo ensaio com fala humana nesta validação.

## Limites desta versão

O tutor trabalha uma capacidade por sessão e faz uma recuperação simples de evidências. Ainda não oferece currículo adaptativo validado, mapa longitudinal de capacidades, revisão humana sistemática do feedback ou diagnóstico de pronúncia. Conversas completas não são monitoradas por um segundo tutor em tempo real; suas tentativas já registradas podem alimentar a memória. Conteúdo entra pelas frases salvas, não pela compreensão automática de toda a biblioteca.

A continuidade, as condições de apoio e a comparação de exemplos estão implementadas. Demonstrar que isso aumenta retenção e autonomia exige as sessões com alunos previstas na proposta e no [protocolo de eficácia](learning-efficacy-experiment.md).
