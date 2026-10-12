# PhraseLoop — O que faz a pessoa aprender

Guia de pesquisa consolidado em 12/10/2026. Define os princípios que orientam o método, a
força da evidência de cada um, a regra de produto que deriva dele e como verificar.
Os princípios ficam versionados em [principles.ts](../src/lib/learning/principles.ts) e são
checados pelo [harness](../src/lib/learning/harness.test.ts). Critérios de evidência
vigentes ficam em [product.md](product.md#evidência-e-agenda); protocolos com pessoas, em
[validation.md](validation.md).

## Como usar

1. **Antes de desenhar uma funcionalidade de aprendizagem**, passe pelo
   [roteiro de revisão](#roteiro-para-revisar-uma-funcionalidade). Cada decisão aponta para um
   princípio, ou fica registrada como aposta.
2. **Ao implementar**, transforme a regra em teste no harness, com o ID do princípio no
   título (`it("[P4] ...")`). Itens em `planned` viram teste quando o código existir.
3. **Para ver a situação**, rode `yarn learning:harness`: ele mostra, por princípio, quantas
   regras o app aplica, quantas estão planejadas e qual é a medida com pessoas.
4. **Para saber se funciona**, só medindo pessoas (ver [sonda de fala](#sonda-de-fala)).
   Teste verde prova que o app segue a regra, não que a regra ensina.

## A escada de evidência

Do sinal mais fraco ao mais forte. Só os degraus 3 em diante indicam aprendizagem; o resto é
processo, mesmo quando é útil.

| Degrau | O que se observa | O que significa |
| --- | --- | --- |
| 0 | Tempo, sessões, frases salvas, conversas concluídas | Esforço. Não prova nada sobre aprender. |
| 1 | Acerto logo depois de ver ajuda ou feedback | Desempenho com apoio. Pode ser cópia da memória de curto prazo. |
| 2 | Acerto sem apoio, na mesma sessão | Desempenho imediato. Superestima a retenção (P5). |
| 3 | Acerto sem apoio, ≥24h depois da última exposição | Retenção. |
| 4 | Acerto sem apoio, em contexto novo verificado, outro dia | Transferência próxima. |
| 5 | Uso espontâneo em conversa livre, sem a IA ter puxado a forma | Transferência para uso real. |
| 6 | Avaliação externa e cega (tarefa inédita, rubrica, CEFR padronizado) | Proficiência. |

O tutor já registra 1–4. A conversa longa (plano em `plans/conversa-sessao-longa.md`) mira o
degrau 5. O degrau 6 depende do estudo em [validation.md](validation.md).

## Princípios

As forças seguem a convenção: **forte** = metanálises consistentes e replicação em contexto
educacional; **moderada** = metanálise com ressalvas ou evidência indireta; **limitada** =
teoria plausível com apoio empírico parcial; **decisão de produto** = escolha nossa, apoiada
em indícios, não em conclusão da pesquisa. Números marcados com † vieram de resumos
secundários nesta pesquisa; confira o artigo antes de citar formalmente.

### P1 — Tentar lembrar antes de ver a resposta (forte)

- **Pesquisa.** Testar-se é uma das duas técnicas de "alta utilidade" na revisão de Dunlosky
  et al. (2013). Em sala de aula, quizzes elevam o desempenho com efeito médio
  (g ≈ 0,50; 222 estudos, ~48 mil alunos; Yang et al., 2021). Tentativas que **falham**,
  seguidas da resposta, também melhoram o aprendizado (Kornell, Hays & Bjork, 2009) — o
  benefício depende de o feedback vir logo depois e de o material ter relação de sentido.
- **Regra.** O aluno produz antes de ver exemplo. Acerto logo após dica, feedback, pergunta
  ao tutor ou consulta de histórico é acerto **com apoio**.
- **Harness.** Resposta 1h após feedback não é independente; 24h depois, sem apoio, é.
- **Limite.** Quase toda essa literatura usa vocabulário e conteúdo declarativo; para fala
  espontânea a evidência é indireta.

### P2 — Espaçar e voltar várias vezes (forte)

- **Pesquisa.** Em L2, prática espaçada supera concentrada com efeito médio a grande
  (Kim & Webb, 2022; 48 experimentos, N ≈ 3.400 †). Intervalo curto empata no teste imediato e
  **perde no adiado**; esquema crescente e fixo empatam. Para gramática, o intervalo ideal é
  menos claro: alguns estudos favorecem ≥7 dias, outros intervalos curtos (Suzuki &
  DeKeyser, 2017). Reaprender em 2–3 sessões espaçadas sobe a recordação após uma semana de
  ~20% para ~80% em material verbal (Rawson et al., 2018 †).
- **Regra.** Nunca retomar antes de 24h da última exposição. Intervalo 1 → 3 → 7 → 14 dias
  conforme a evidência.
- **Harness.** 200 históricos gerados: a retomada nunca cai antes de 24h da última exposição;
  a escada de intervalos segue o estado.
- **Atenção.** Alunos preferem prática concentrada e se sentem pior com a espaçada, mesmo
  aprendendo mais (Simon & Bjork, 2001). Explicar o porquê da data de retorno ajuda.

### P3 — Feedback focal, e quem reconstrói é o aluno (forte)

- **Pesquisa.** Feedback corretivo oral tem efeito significativo e durável (Lyster & Saito,
  2010; 15 estudos de sala, N = 827). Interação com feedback tem efeito maior no pós-teste
  adiado que no imediato (Mackey & Goo, 2007 †). Reformular pelo aluno (recast) é o tipo mais
  usado e o que menos leva o aluno a se corrigir; pedidos de autocorreção (elicitação,
  esclarecimento, pista metalinguística) geram mais reparo (Lyster & Ranta, 1997). Se prompts
  superam recasts no longo prazo ainda é debatido: há estudos a favor e estudos sem diferença.
- **Regra.** No máximo dois ajustes por resposta; sempre há retry; melhora só conta quando o
  retry é um texto diferente.
- **Harness.** O contrato rejeita três ajustes; sessão aceita no máximo três tentativas;
  retry idêntico não conta como melhora.

### P4 — Transferência só vale em outro contexto, outro dia, sem cópia (moderada)

- **Pesquisa.** Recuperamos melhor quando a situação de uso se parece com a de aprendizado
  (*transfer-appropriate processing*; Lightbown, 2008). Drill tende a render em testes de
  drill, não em conversa. Repetir a mesma tarefa melhora complexidade e precisão nessa tarefa
  (metanálise oral, *System*, 2025 †); ganho em tarefa **nova** quase não foi medido.
- **Regra.** Transferência exige contexto verificado diferente, ≥24h após a dificuldade, sem
  apoio, sem copiar exemplo anterior.
- **Harness.** Contexto repetido é recuperação; antes de 24h não conta; cópia do exemplo não
  conta.

### P5 — Sensação de aprender não é aprender (forte)

- **Pesquisa.** Fluência durante o estudo infla a confiança (Koriat & Bjork, 2005). Na
  maioria, alunos acham que prática em bloco funcionou melhor, mesmo depois de ver a própria
  nota mostrando o contrário (Yan, Bjork & Bjork, 2016). Autoavaliação de fala correlaciona
  r ≈ 0,44 com medida externa (Li & Zhang, 2021, 67 estudos †); melhora com rubrica e tarefas
  concretas (≈ 0,49).
- **Regra.** Autoavaliação, tempo, conclusão e avaliação incerta ou contestada não viram
  acerto.
- **Harness.** Prática do tutor entra nas métricas gerais como `evaluated: false`; status
  incerto não conta; avaliação contestada sai.

### P6 — Perceber a lacuna enquanto tenta dizer (limitada)

- **Pesquisa.** Swain (1995) propõe que produzir faz o aluno notar a distância entre o que quer
  e o que consegue dizer. Testes diretos (Izumi e colegas) deram apoio **parcial**. Alunos
  evitam estruturas difíceis (Schachter, 1974), mas evitação é difícil de provar sem saber a
  intenção (Kamimoto et al., 1992); aprendizes intermediários preferem formas gerais e
  simples às específicas, sem evitar totalmente.
- **Regra.** Nenhum rótulo de fraqueza sem trecho real. Não simplificar a pergunta quando o
  aluno trava: isso ensina a contornar.
- **Harness.** Dificuldade só vale com trecho literal ligado a um ajuste. Planejado: prompt da
  conversa longa sem a instrução de simplificar; lacuna sem prova é descartada.
- **Por que mesmo assim.** O botão "travei" resolve justamente o problema de provar a
  intenção: o aluno diz em português o que queria dizer. É uma aposta coerente, a ser medida.

### P7 — IA que responde no lugar do aluno vira muleta (moderada)

- **Pesquisa.** Num experimento com quase mil alunos de ensino médio, GPT-4 sem salvaguardas
  aumentou o desempenho na prática e **reduziu em 17%** o desempenho na prova sem IA; a versão
  que dava pistas, não respostas, neutralizou o dano (Bastani et al., *PNAS*, 2025). Um tutor
  de IA construído com a pedagogia do curso dobrou o ganho mediano em física, com pós-teste
  sem IA (Kestin et al., 2025 †). O que pesa é o desenho, não o modelo.
- **Regra.** Pergunta ao tutor, dica e histórico contam como exposição.
- **Harness.** Pergunta ao tutor antes de responder torna a resposta assistida.

### P8 — Conversar com um sistema ajuda a fala, mas o desenho importa (moderada)

- **Pesquisa.** Sistemas de diálogo têm efeito moderado na fala em L2 (g ≈ 0,61; Hou & Min,
  *ReCALL*, 2025). Tipo de sistema, restrição de sentido e modalidade moderam o efeito;
  feedback corretivo e nível **não** apareceram como moderadores. A metanálise é anterior à
  maior parte dos estudos com IA generativa; não diz qual desenho de conversa é melhor.
- **Regra.** Conversa é prática de produção. Só alimenta evidência quando fecha o ciclo
  (lacuna → forma → reconstrução → uso sem ajuda em outro dia).
- **Harness.** Ainda sem verificação automática; entra com a conversa longa.

### P9 — Repetir a tarefa, com pressão de tempo, ganha fluência (moderada)

- **Pesquisa.** Repetição de tarefa oral melhora complexidade e precisão; fluência ganha
  menos; intervalos maiores entre repetições reduzem o efeito (metanálise, *System*, 2025 †).
  Recontar a mesma história em 4, 3 e 2 minutos (Nation) reduz hesitação; pressão de tempo
  crescente ajuda mais que tempo constante.
- **Regra.** Repetição é bem-vinda para fluência, mas nunca medida de transferência (P4).
- **Harness.** Sem verificação automática: não há essa atividade no app hoje.

### P10 — Blocos prontos sustentam a fala (limitada)

- **Pesquisa.** Quem usa mais sequências prontas é julgado mais proficiente (Boers et al.,
  2006). Blocos aliviam a formulação da fala. Estudos que **ensinam** blocos para ganhar
  fluência são poucos, pequenos e quase-experimentais (Wood, 2009; Thomson, 2017), com chamada
  explícita para replicação.
- **Regra.** Expressão que a IA disse não é expressão aprendida; só conta quando o aluno usa
  sem ajuda, em sessão posterior.
- **Harness.** Planejado: uso nas duas falas seguintes a a IA dizer a forma não conta.

### P11 — Pouca ansiedade, controle do aluno (decisão de produto)

- **Pesquisa.** Ansiedade em L2 correlaciona r ≈ −0,36 com desempenho (Teimouri, Goetze &
  Plonsky, 2019; 105 amostras, N ≈ 20 mil). Correlação, não causa. Não pesquisamos aqui o
  efeito de gamificação; a ausência de XP e sequência é escolha do produto.
- **Regra.** Sem XP, moedas, badges, sequência ou notificações; pausar mantém o estado.
- **Harness.** Nenhuma tela renderiza XP, sequência ou ranking.
- **Observado na auditoria.** `computeStreak` existe em `features/plan/effort.ts` e há
  traduções "day streak"/"Streak" sem uso em tela. A Home anuncia "New section unlocked",
  linguagem de desbloqueio que conflita com "maturidade nunca limita acesso". Decidir com o
  responsável.

## O que a pesquisa não resolve

- **Corrigir na hora ou depois.** Os estudos de momento do feedback mostram benefício nos dois
  casos e, quando há diferença, ora favorecem o imediato, ora o feedback logo após a tarefa
  (Li, Zhu & Ellis, 2016 e replicação). Adiar a correção para o fim da conversa é defensável,
  desde que a revisão venha na mesma sessão e peça reconstrução.
- **Prompts contra recasts no longo prazo.** Debatido. Recast dentro da conversa é natural,
  mas sozinho gera pouco reparo; por isso o reparo precisa vir depois (P3).
- **Conversa com IA generativa especificamente.** Há estudos de percepção e de ansiedade,
  mas faltam medidas adiadas de fala com tarefa inédita.
- **Quanto do "platô intermediário" é evitação.** A ligação é plausível, não demonstrada.

## Sonda de fala

Medida de resultado, não de processo. Serve para o responsável medir o próprio aprendizado
agora e vira o desenho de uma futura funcionalidade.

- **Frequência.** Linha de base antes de começar a conversa longa; depois a cada 2 semanas.
- **Tarefa.** Monólogo de 2 minutos respondendo a uma situação de trabalho **nunca
  praticada** no app. Mantenha uma lista reservada de situações (por exemplo, 6 dos 12
  cenários do perfil de desenvolvedor, nunca usados nas sessões) e sorteie uma por sonda.
  Sem preparar, sem dicionário, sem IA.
- **Gravação.** Áudio local, fora do repositório.
- **Medidas.**
  - Velocidade: palavras por minuto (ou sílabas por minuto) sobre o tempo total.
  - Pausas: pausas silenciosas ≥250 ms por minuto, separando as **no meio da frase**, que
    melhor representam falta de fluência (Suzuki & Kormos †), das pausas entre frases.
  - Extensão média entre pausas (MLR).
  - Segundos em português e número de travadas.
  - Uso, sem ajuda, de formas das lacunas fechadas.
- **Leitura.** Uma pessoa, poucas medições: compare consigo mesmo e anote o tema sorteado.
  Melhora só na situação praticada é repetição (P9), não transferência.
- **Limite técnico atual.** O Whisper do app devolve tempos por segmento, não por palavra.
  Velocidade sai direto; pausas no meio da frase e MLR pedem marcação manual (por exemplo,
  no Praat ou no Audacity) até haver tempos por palavra.

## Roteiro para revisar uma funcionalidade

Responda antes de implementar. "Não" não proíbe; obriga a dizer que é uma aposta.

1. **Recuperação.** O aluno tenta produzir antes de ver a forma? (P1)
2. **Apoio registrado.** Toda ajuda (dica, forma dita pela IA, histórico) fica registrada e tira
   o crédito de independência por 24h? (P1, P7)
3. **Reconstrução.** Depois do feedback, quem diz de novo é o aluno, sem ler a resposta? (P3)
4. **Retorno espaçado.** O item volta em outro dia, ≥24h, e mais de uma vez? (P2)
5. **Contexto novo.** O sucesso que conta acontece em situação diferente da prática? (P4)
6. **Prova real.** Toda fraqueza mostrada tem trecho literal do aluno? (P6)
7. **Medida honesta.** Os números são de processo ou de resultado? Estão rotulados? (P5)
8. **Desempenho sem a IA.** Há momento em que o aluno usa sem a IA puxar? (P7, P8)
9. **Teste no harness.** Cada regra acima virou um `it("[P#] ...")`?

## Aplicação ao plano da conversa longa

Revisão de `plans/conversa-sessao-longa.md` com o roteiro. As decisões fechadas continuam;
os itens abaixo são recomendações para o responsável.

**Alinhado com a pesquisa**

- Não simplificar quando o aluno trava e o botão "travei" com o trecho em português (P6).
- Nenhuma lacuna sem trecho real; descarte de evitação sem prova (P5, P6).
- Revisão na mesma sessão terminando com reconstrução (P3; correção adiada é defensável).
- Fechar lacuna só com uso sem ajuda, em sessão posterior, ≥24h, e não contar uso nas duas
  falas seguintes à forma dita pela IA (P1, P2, P4, P10).
- Métricas da avaliação de 2 semanas rotuladas como processo (P5).

**Ajustes recomendados**

1. **Reconstrução como recuperação, não leitura (P1, forte).** Mostrar a forma natural,
   escondê-la e só então pedir que o aluno fale. Dizer de novo lendo a tela é degrau 1.
2. **Uma sonda de resultado ao lado das três métricas (P5, P8).** Os três números do plano
   (% fechadas, tempo em PT, sessões por semana) são de processo. Rodar a
   [sonda de fala](#sonda-de-fala) na linha de base e na semana 2 diz se a fala melhorou
   fora das situações praticadas.
3. **Fechamento em dois usos (P2, moderada).** Um único uso sem ajuda após 24h é o degrau 3.
   Reaprendizagem sucessiva sugere 2–3 retornos. Sem mudar a métrica da avaliação, vale
   registrar quantos usos sem ajuda cada lacuna teve, para ver depois quantas se mantêm.
4. **Recontar mais curto (P9, ideia fora do escopo atual).** Ao fim da sessão, recontar o
   ponto principal em 1 minuto é a técnica com melhor apoio para fluência. Registrar no
   backlog, não neste plano.

## Fontes

- Dunlosky et al. (2013). *Improving students' learning with effective learning techniques.* [APS](https://www.psychologicalscience.org/news/releases/which-study-strategies-make-the-grade.html)
- Yang, Luo, Vadillo et al. (2021). *Testing (quizzing) boosts classroom learning.* Psychological Bulletin 147(4). [Registro](https://scholars.hkbu.edu.hk/en/publications/testing-quizzing-boosts-classroom-learning-a-systematic-and-meta-/)
- Kornell, Hays & Bjork (2009). *Unsuccessful retrieval attempts enhance subsequent learning.* [PubMed](https://pubmed.ncbi.nlm.nih.gov/19586265/)
- Kim & Webb (2022). *The effects of spaced practice on second language learning: A meta-analysis.* Language Learning 72(1). [DOI](https://doi.org/10.1111/lang.12479) · [tese com o estudo](https://ir.lib.uwo.ca/etd/8600/)
- Suzuki & DeKeyser (2017). *Effects of distributed practice on the proceduralization of morphology.* LTR 21(2). Citado em [Kasprowicz et al. 2019](https://eprints.whiterose.ac.uk/141710/)
- Rawson, Dunlosky et al. — reaprendizagem sucessiva. [Resumo de pesquisa](https://www.unh.edu/teaching-learning-resource-hub/sites/default/files/media/2023-06/itow-successive-relearning-dunlosky-greve-badali-wissman-rawson.pdf)
- Simon & Bjork (2001); Koriat & Bjork (2005); Yan, Bjork & Bjork (2016). [Bjork Lab](https://sites.lifesci.ucla.edu/psych-bjorklab/wp-content/uploads/sites/13/2016/11/YanBjorkBjork2016.pdf)
- Lyster & Saito (2010). *Oral feedback in classroom SLA: A meta-analysis.* SSLA 32. [Cambridge](https://www.cambridge.org/core/journals/studies-in-second-language-acquisition/article/oral-feedback-in-classroom-sla/4999EE1C8379B2BF026B148EAF373CA1)
- Lyster & Ranta (1997). *Corrective feedback and learner uptake.* SSLA 19. [Resumo](https://archive.carla.umn.edu/immersion/acie/vol1/May1998.pdf)
- Li, Zhu & Ellis (2016). *The effects of the timing of corrective feedback.* MLJ 100. [Replicação](https://www.cambridge.org/core/journals/language-teaching/article/what-is-the-ideal-time-to-provide-corrective-feedback-replication-of-li-zhu-ellis-2016-and-arroyo-yilmaz-2018/61CDB7D7788B67238254362D7C69F798)
- Lightbown (2008). *Transfer appropriate processing as a model for classroom SLA.* In Han (Ed.), *Understanding Second Language Process.*
- Metanálise de repetição de tarefa oral (*System*, 2025). [PDF da metanálise escrita/LTR](https://todoele.net/sites/default/files/2025-12/LTR-effect-of-task-repetition-meta-analysis.pdf)
- Li & Zhang (2021). Metanálise de autoavaliação em L2. [Cambridge](https://www.cambridge.org/core/product/786D4E0E0D500DCDD43CCE24ED610592/core-reader)
- Swain (1995) e estudos de Izumi. [Revisão](https://serve.repo.nii.ac.jp/record/393/files/3338.pdf)
- Schachter (1974) e críticas. [Revisão](https://arch.neicon.ru/xmlui/handle/123456789/3069612)
- Bastani et al. (2025). *Generative AI without guardrails can harm learning.* PNAS 122(26). [SSRN](https://papers.ssrn.com/abstract=4895486)
- Kestin et al. (2025). *AI tutoring outperforms in-class active learning.* [PDF](https://biblioteca.unisced.edu.mz/bitstream/123456789/3656/1/AI_Tutoring_Outperforms_Active_Learning.pdf)
- Hou & Min (2025). *Dialogue-based CALL systems for L2 speaking development: A three-level meta-analysis.* ReCALL. [Cambridge](https://www.cambridge.org/core/product/31847710516602398819C5E594038E7B/core-reader)
- Nation, técnica 4/3/2. [LearnLab](https://learnlab.org/research/wiki/index.php/Fostering_fluency_in_second_language_learning)
- Boers et al. (2006); Wood (2009); Thomson (2017). [Chamada de replicação](https://resolve.cambridge.org/core/journals/language-teaching/article/abs/replication-research-in-pedagogical-approaches-to-spoken-fluency-and-formulaic-sequences-a-call-for-replication-of-wood-2009-and-boers-eyckmans-kappel-stengers-demecheleer-2006/8D7676F9CA677D380F6B3870CE20DA9F)
- Medidas de fluência e fluência percebida. [Cambridge](https://www.cambridge.org/core/product/FAB18835B2117A299C33F8F502248C81)
- Teimouri, Goetze & Plonsky (2019). *Second language anxiety and achievement: A meta-analysis.* SSLA. [Registro](https://experts.nau.edu/en/publications/second-language-anxiety-and-achievement/)
