/**
 * Princípios de aprendizagem que orientam o PhraseLoop, com a força da evidência,
 * a regra de produto que deriva deles e como verificar. Fonte e discussão completa:
 * docs/learning.md. O harness (harness.test.ts) marca cada verificação com o ID do
 * princípio entre colchetes, e `yarn learning:harness` cruza testes e registro.
 *
 * Verificação automática prova só que o app aplica a regra. Que a regra faz a pessoa
 * aprender é medido em `outcome`, com pessoas, nunca pela suíte.
 */
export type EvidenceStrength = "strong" | "moderate" | "limited" | "product";

export interface LearningPrinciple {
  id: string;
  title: string;
  strength: EvidenceStrength;
  /** O que a pesquisa sustenta, com seus limites. */
  claim: string;
  /** O que o produto precisa fazer por causa disso. */
  rule: string;
  sources: string[];
  /** Como saber se, com pessoas, a regra está ajudando. */
  outcome: string;
  /** Verificações ainda não automatizadas (ex.: dependem do plano da conversa longa). */
  planned: string[];
}

export const LEARNING_PRINCIPLES: LearningPrinciple[] = [
  {
    id: "P1",
    title: "Tentar lembrar antes de ver a resposta",
    strength: "strong",
    claim: "Recuperar da memória (testar-se) ensina mais que reler ou rever. Tentativas que falham, seguidas da resposta, também ajudam.",
    rule: "O aluno produz antes de ver exemplo. Resposta dada logo depois de ver ajuda conta como acerto com apoio, não como acerto independente.",
    sources: ["Dunlosky et al. 2013 (PSPI)", "Yang et al. 2021 (Psychological Bulletin), g ≈ 0,50", "Kornell, Hays & Bjork 2009 (JEP:LMC)"],
    outcome: "Acerto sem apoio em ocasião posterior (D7/D30), não acerto na mesma sessão.",
    planned: ["Reconstrução da revisão da conversa: esconder a forma natural antes de o aluno falar de novo."],
  },
  {
    id: "P2",
    title: "Espaçar e voltar várias vezes",
    strength: "strong",
    claim: "Prática espaçada supera prática concentrada em L2, com efeito médio a grande. Intervalo curto empata no teste imediato e perde no adiado. Esquema crescente e fixo empatam. Voltar ao mesmo item em 2–3 sessões espaçadas aumenta muito a retenção.",
    rule: "Nunca retomar uma habilidade antes de 24h da última exposição. O intervalo cresce com a evidência (1 → 3 → 7 → 14 dias).",
    sources: ["Kim & Webb 2022 (Language Learning)", "Rawson & Dunlosky, reaprendizagem sucessiva", "Simon & Bjork 2001"],
    outcome: "Retenção observada em D7/D30/D60 comparada à previsão do agendamento.",
    planned: [],
  },
  {
    id: "P3",
    title: "Feedback focal, e quem reconstrói é o aluno",
    strength: "strong",
    claim: "Feedback corretivo oral tem efeito significativo e durável. Pedir que o aluno se corrija (prompt) gera mais reparo do que só reformular por ele (recast).",
    rule: "No máximo dois ajustes por resposta. Sempre há retry. Melhora só conta se o retry for um texto diferente do original.",
    sources: ["Lyster & Ranta 1997", "Lyster & Saito 2010 (SSLA)", "Mackey & Goo 2007"],
    outcome: "Melhora após feedback seguida de acerto independente em outro dia.",
    planned: ["Conversa longa: revisão termina com o aluno dizendo de novo cada lacuna."],
  },
  {
    id: "P4",
    title: "Transferência só vale em outro contexto, outro dia, sem cópia",
    strength: "moderate",
    claim: "O que se aprende fica preso ao contexto em que foi praticado. Repetir a mesma tarefa melhora essa tarefa; ganho em tarefa nova é muito menos estudado.",
    rule: "Transferência exige contexto verificado diferente, pelo menos 24h após a dificuldade, sem apoio e sem copiar exemplo anterior.",
    sources: ["Lightbown 2008 (transfer-appropriate processing)", "Metanálises de repetição de tarefa, System e LTR 2025"],
    outcome: "Transferência próxima e transferência fria em tarefas inéditas (ver validation.md).",
    planned: ["Conversa longa: lacuna só fecha com uso sem ajuda em sessão posterior, ≥24h."],
  },
  {
    id: "P5",
    title: "Sensação de aprender não é aprender",
    strength: "strong",
    claim: "Prática concentrada e fácil dá mais confiança e menos retenção. Autoavaliação de fala correlaciona só r ≈ 0,44 com medida externa.",
    rule: "Autoavaliação, tempo, conclusão e avaliação contestada ou incerta não viram evidência de acerto.",
    sources: ["Bjork; Koriat & Bjork 2005", "Simon & Bjork 2001", "Li & Zhang 2021, metanálise de autoavaliação em L2"],
    outcome: "Comparar autoavaliações com avaliação cega numa amostra.",
    planned: [],
  },
  {
    id: "P6",
    title: "Perceber a lacuna enquanto tenta dizer",
    strength: "limited",
    claim: "Produzir pode fazer o aluno notar o que não sabe dizer (hipótese do output). O apoio empírico é parcial. Evitação existe, mas é difícil de provar sem a intenção do aluno.",
    rule: "Nunca mostrar um rótulo de fraqueza sem o trecho real como prova. Não simplificar a pergunta quando o aluno trava.",
    sources: ["Swain 1995", "Izumi et al. (apoio parcial)", "Schachter 1974; Kamimoto et al. 1992 (crítica)"],
    outcome: "Lacunas com prova que depois fecham sem ajuda.",
    planned: [
      "Conversa longa: prompt sem instrução de simplificar quando o aluno trava.",
      "Conversa longa: lacuna sem trecho real é descartada.",
    ],
  },
  {
    id: "P7",
    title: "IA que responde no lugar do aluno vira muleta",
    strength: "moderate",
    claim: "Num experimento de campo, alunos com GPT sem salvaguardas foram melhor na prática e 17% pior na prova sem IA. A versão que dava pistas, não respostas, neutralizou o dano. Um tutor desenhado com a pedagogia do curso dobrou o ganho.",
    rule: "Pergunta ao tutor, dica e consulta de histórico contam como exposição; acerto logo depois é com apoio.",
    sources: ["Bastani et al. 2025 (PNAS)", "Kestin et al. 2025 (Scientific Reports)"],
    outcome: "Desempenho sem IA disponível (sonda de fala, provas adiadas).",
    planned: [],
  },
  {
    id: "P8",
    title: "Conversar com sistema ajuda a fala, mas o desenho importa",
    strength: "moderate",
    claim: "Sistemas de diálogo têm efeito moderado na fala em L2 (g ≈ 0,61). Tipo de sistema, restrição de sentido e modalidade moderam; correção não apareceu como moderador.",
    rule: "Conversa é prática de produção. Só alimenta evidência quando fecha o ciclo (lacuna → forma → reconstrução → uso posterior).",
    sources: ["Hou & Min 2025 (ReCALL), metanálise em três níveis"],
    outcome: "Sonda de fala periódica com cenário nunca praticado.",
    planned: ["Conversa longa: métricas de processo rotuladas como tal na exportação."],
  },
  {
    id: "P9",
    title: "Repetir a tarefa, com pressão de tempo, ganha fluência",
    strength: "moderate",
    claim: "Repetir a mesma tarefa melhora complexidade e precisão, e um pouco a fluência; mais repetições, efeito maior. Recontar em menos tempo (4/3/2) reduz pausas.",
    rule: "Repetição é bem-vinda para fluência, mas não é medida de transferência.",
    sources: ["Metanálise de repetição de tarefa oral, System 2025", "Nation, técnica 4/3/2"],
    outcome: "Velocidade de fala e pausas no meio da frase em tarefa nova, não na repetida.",
    planned: [],
  },
  {
    id: "P10",
    title: "Blocos prontos sustentam a fala",
    strength: "limited",
    claim: "Quem usa mais sequências prontas é julgado mais proficiente e fluente. Estudos de ensino de blocos são poucos, pequenos e quase-experimentais.",
    rule: "Expressão exposta pela IA não é expressão aprendida; só conta quando o aluno a usa sem ajuda.",
    sources: ["Boers et al. 2006", "Wood 2009; Thomson 2017", "Boers & Lindstromberg 2012"],
    outcome: "Uso espontâneo, sem ajuda, em sessão posterior.",
    planned: ["Conversa longa: uso nas 2 falas seguintes a a IA dizer a forma não conta."],
  },
  {
    id: "P11",
    title: "Pouca ansiedade, controle do aluno",
    strength: "product",
    claim: "Ansiedade em L2 correlaciona negativamente com desempenho (r ≈ −0,36). Abrir mão de XP, sequência e notificações é decisão do produto, não conclusão da pesquisa.",
    rule: "Sem XP, moedas, badges, sequência ou notificações. Pausar mantém o estado.",
    sources: ["Teimouri, Goetze & Plonsky 2019 (SSLA)", "docs/product.md"],
    outcome: "Retorno voluntário D+1/D+7 sem lembrete.",
    planned: [],
  },
];

export const learningPrinciple = (id: string) => LEARNING_PRINCIPLES.find(p => p.id === id);
