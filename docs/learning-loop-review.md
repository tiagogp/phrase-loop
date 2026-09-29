# Revisão do aprendizado e da experiência — 29/09/2026

O problema principal era a distância entre a qualidade das ferramentas e a clareza do caminho. O app já tinha revisão espaçada, produção própria, correção, conversas, provas de retenção e bastante conteúdo. Mas o aluno precisava descobrir como conectar essas partes; algumas ficavam escondidas por nível ou quantidade de uso. O progresso também exigia interpretar muitos indicadores.

A mudança organiza essa base em uma rotina curta: **lembrar → usar → receber feedback → tentar de novo → retomar depois**. Terminar a rotina significa ter praticado. Aprendizado duradouro continua dependendo de observações em outros dias.

## O que foi revisado e alterado

| Área | Problema encontrado | Resultado implementado |
| --- | --- | --- |
| Primeiro uso | Muitas decisões antes de começar; conexão com IA fazia parte do caminho principal. | Três etapas: propósito, nível e rotina. A pessoa escolhe 5, 10 ou 20 minutos; pode começar sem conectar IA. |
| Hoje | Recomendações e detalhes competiam pela atenção. | Uma ação principal conforme biblioteca, revisões e produção do dia, três passos visíveis e um exemplo real da própria prática. |
| Navegação | Destinos apareciam por desbloqueios; conversa dependia de nível e provedor. | Cinco destinos estáveis: Hoje, Praticar, Conversa, Conteúdo e Progresso. Correção, planos, configurações e Kokoro/Anki continuam acessíveis. |
| Revisão | A fila voltava a carregar ao terminar. Autoavaliação podia parecer acurácia. | Blocos de até 3, 6 ou 10 cartões, pausa explícita e resumo com respostas verificadas antes de revelar a resposta. O agendamento FSRS continua intacto. |
| Produção | O título de certos cartões podia revelar o inglês; transferência sem avaliador podia prender a pessoa. | Instrução neutra antes de revelar, tentativa própria depois da revisão, feedback e opção de guardar a tentativa e encerrar. Tentativas sem avaliação não viram sucesso. |
| Feedback e nova tentativa | Repetições de transferência pareciam novas produções independentes. | Tentativas seguintes ficam ligadas à primeira. Melhorias verificadas podem aparecer como antes/depois; repetições não entram como transferência independente. |
| Progresso | Volume de uso e evidências de aprendizagem estavam próximos demais. | Exemplos das respostas do aluno, recuperação sem dicas, provas separadas D7/D30/D60 e uso verificado em outro contexto. Sem medida, aparece “ainda não medido”. |
| Conversa | Descoberta tardia e ausência de caminho útil sem IA. | Conversa acessível em todos os níveis, cenários avançados mantidos para C1/C2 e fala guiada como alternativa sem provedor. |
| Conteúdo | Adicionar uma frase conhecida exigia passar pela importação/geração. | Cadastro direto de inglês + significado, com cartões nas duas direções, sem IA e sem reiniciar o agendamento ao repetir uma importação. Vídeos, artigos, PDFs e demais fontes permanecem disponíveis. |
| Kokoro e Anki | Ferramentas escondidas e pouca conexão com a biblioteca. Download novo do modelo falhava na integridade. | Acesso pelo cabeçalho e por Hoje; modos Baralho, Áudio e Frases por tema; biblioteca vira lista exportável. Digest e tamanho atualizados conforme o asset oficial, mantendo a checagem SHA-256. |
| Continuidade | Trocar para uma ferramenta/configuração desmontava a área principal. | Destinos principais montam na primeira visita e preservam estado enquanto ficam ocultos. Falhas de gravação mantêm a resposta; falhas secundárias de log não convidam a gravá-la de novo. |

## Como o progresso evita promessas falsas

- Recuperação independente exige resposta de produção registrada antes da revelação, correção observada e ausência de dica ou apoio. Marcar “Bom” não basta.
- Um exemplo de memória só usa o último resultado daquele cartão. Um erro posterior remove o exemplo de sucesso; o intervalo exibido vem da revisão imediatamente anterior.
- Uma melhoria após feedback exige vínculo com a tentativa original e redução de problemas. Descartar ou adiar feedback não é melhora. Nas novas tentativas de estudo, os instrumentos de avaliação também precisam coincidir.
- Transferência exige avaliação, verificação de contexto novo, tarefa cumprida e ausência de problemas e de apoio. Prática sem avaliação fica salva, mas fora desse denominador.
- A comparação semanal usa a última observação de cada combinação de cartão e avaliador nas duas janelas, com pelo menos cinco cartões em comum. Repetir muitas vezes um cartão fácil não aumenta seu peso. A comparação continua sendo observacional, sem equivaler a um experimento controlado.
- As provas de retenção continuam separadas do FSRS: medir a retenção não altera o agendamento. Elas agora também entram corretamente no painel detalhado.
- Não houve migração dos dados locais nem troca de provedor. Perfis antigos recebem dez minutos como padrão; os campos anteriores continuam legíveis.

Espaçamento e recuperação ativa orientam essa organização. O guia do [Institute of Education Sciences sobre organização do estudo](https://ies.ed.gov/ncee/wwc/PracticeGuide/1) sustenta esses princípios; ele não prova a eficácia específica do PhraseLoop.

## Conteúdo e limites observados

O catálogo contém 100 lições, 804 frases e 1.394 arquivos de áudio gerado. Isso dá uma base para prática guiada, mas não mede compreensão de falantes desconhecidos: o catálogo de clipes humanos autênticos ainda está vazio. A importação de fontes próprias continua importante para trazer variação de voz e contexto.

O verificador local tem alcance limitado. Ele serve para recuperação de frases e estruturas que consegue verificar. Uma resposta aberta sem padrão verificável precisa de um avaliador para receber julgamento de adequação; a interface informa isso e permite continuar. Feedback de IA também é julgamento, não certificação de proficiência.

As escolhas de 5/10/20 minutos controlam o tamanho do bloco, não prometem duração exata. Revisões iniciais do FSRS podem voltar no mesmo dia. A pessoa pode encerrar o bloco ou iniciar outro deliberadamente.

## Validação

- **Suíte automatizada:** 88 arquivos, 769 testes aprovados. Inclui regressões de revisão, armazenamento, contratos de avaliação, retenção, rotas, importação e exportação; os novos casos cobrem fila limitada, datas locais, evidência sem dicas, comparação equivalente, novas tentativas e preservação do agendamento ao cadastrar uma frase repetida.
- **TypeScript e lint:** verificação de tipos aprovada; lint sem erros. Permanecem três avisos anteriores de variáveis não utilizadas em dois testes.
- **Conteúdo:** `learn:content:validate` aprovado; `learn:audio:verify` confirmou todos os 1.394 clipes declarados. A ausência de clipes humanos autênticos continua explícita.
- **Compilação:** `yarn build` e `yarn landing:build` aprovados com Next.js 16.3.3. A primeira tentativa encontrou uma restrição do sandbox ao abrir uma porta do compilador; após executar com a permissão adequada e separar o cache dessa falha, o build completo passou.
- **Kokoro real:** a rota local gerou um WAV RIFF/WAVE de 79.426 bytes. A exportação real gerou um `.apkg` de 206.718 bytes; a inspeção do ZIP e do banco Anki confirmou uma nota, um cartão, tradução e áudio referenciado e presente. Nenhum pacote foi importado no Anki do usuário.
- **Navegador:** conferidos onboarding, escolha de cinco minutos, cadastro de frase, revisão nas duas direções, resposta de produção antes da revelação, resumo da revisão e salvamento de tentativa aberta sem avaliador. A inspeção encontrou e levou à correção do título que revelava a resposta em inglês.
- **Limites do teste visual:** a automação nativa deixou de localizar a janela (`cgWindowNotFound`) durante a validação. A conferência visual final de Progresso, das telas restantes e da largura móvel ficou pendente. Não foi feita conversa ao vivo com provedor de IA nem gravação por microfone nesta rodada.
- **Grafo do projeto:** atualizado com `graphify update .`, por extração AST, sem chamadas de avaliação por IA.

## Próxima validação com alunos

A implementação deixa o ciclo utilizável e sua evidência legível. Para verificar se isso melhora a aprendizagem de fato, a próxima etapa é acompanhar pessoas reais:

1. **Primeiro uso:** observar se encontram o próximo passo e completam uma revisão e uma produção sem orientação externa. Pedir que expliquem, com as próprias palavras, por que uma frase voltará depois.
2. **Retorno:** acompanhar D1/D7 e perguntar qual resposta concreta mostra uma melhora. Separar desistência por dificuldade, excesso de opções e falha técnica.
3. **Retenção:** coletar as provas independentes D7/D30, com versões do avaliador e condições de apoio registradas. Incluir itens difíceis e participantes que deixam de voltar.
4. **Transferência:** usar situações inéditas e revisão humana de uma amostra das avaliações, especialmente paráfrases que o verificador local não reconhece.
5. **Escuta:** incorporar clipes autênticos com licença e proveniência antes de afirmar progresso com vozes desconhecidas.

Esses dados devem orientar a próxima rodada de produto; sessões concluídas ou uma interface mais simples, sozinhas, não demonstram ganho de proficiência.
