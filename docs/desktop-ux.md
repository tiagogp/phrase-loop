# PhraseLoop — Guia de UX/UI para o app desktop (Electron)

Regras para qualquer mudança em `electron/*`, `src/platform/electron/*`, `src/app/desktop-shell.css`
e nos componentes de shell (`AppHeader`, `HomeClient`). Leia antes de mexer. O objetivo é que o app
pareça um app de desktop nativo, não um site dentro de uma janela, sem abrir mão de segurança.

Fontes: [Electron Security](https://www.electronjs.org/docs/latest/tutorial/security) e
[Electron Performance](https://www.electronjs.org/docs/latest/tutorial/performance) (lidas na
elaboração deste guia), mais as diretrizes de plataforma (Apple HIG, Windows/Fluent) e prática
comum de apps Electron maduros. Itens marcados **[oficial]** vêm da documentação do Electron; o
resto é convenção de plataforma.

## 1. Como usar este guia

- Cada regra é verificável. Ao terminar uma mudança de shell, percorra a seção 10 (checklist).
- A seção 9 lista lacunas conhecidas do app hoje. Não as "corrija de passagem": são trabalho
  próprio, com escopo e teste.
- Regra de ouro: **a UI web continua funcionando no browser** (`yarn dev`). Tudo que for específico
  de Electron fica atrás de `window.phraseLoop` (ver `src/platform/electron/bridge.ts`) ou de
  `html[data-electron="true"]`, nunca de `navigator.userAgent`.

## 2. Janela e ciclo de vida

1. **Sem flash branco.** `show: false` + `ready-to-show` + `backgroundColor` igual ao tema inicial.
   O `backgroundColor` não pode ser fixo se o usuário usa tema claro: derive de
   `nativeTheme.shouldUseDarkColors`.
2. **Lembrar a janela.** Persistir tamanho, posição, estado maximizado/tela cheia e o monitor;
   restaurar validando que os bounds ainda cabem em algum `screen.getAllDisplays()` (monitor
   desconectado = janela fora da tela). Gravar com debounce em `resize`/`move`, não a cada evento.
3. **Não maximizar à força.** Maximizar só na primeira execução (sem estado salvo).
4. **Tamanho mínimo** coerente com o layout (`minWidth`/`minHeight` já existem); o CSS deve
   sobreviver nesse mínimo sem scroll horizontal.
5. **Instância única.** `app.requestSingleInstanceLock()`; no `second-instance`, restaurar e focar
   a janela existente. Dois processos disputando a mesma pasta de dados/IndexedDB é bug de dados.
6. **Convenção de fechar por plataforma.** macOS: fechar a janela não encerra o app
   (`window-all-closed` só dá `quit` fora do Mac; `activate` recria a janela). Windows/Linux:
   fechar a última janela encerra.
7. **Encerrar limpo.** Matar processos filhos (servidor Next, utilityProcess) em `before-quit`,
   e nunca deixar órfãos. Se houver trabalho em andamento (gravação, download de modelo),
   confirmar antes de sair.
8. **Splash honesto.** `loading.html` mostra estado real (iniciando servidor, baixando modelo,
   erro) com mensagem em PT-BR e ação de tentar de novo/abrir logs. Nunca spinner infinito sem texto.
9. **Mostrar a UI primeiro, adiar o resto [oficial].** Verificação de update, indexação, download
   de modelos e I/O pesado só depois da primeira tela interativa.

## 3. Barra de título e chrome

1. **Área arrastável explícita.** `-webkit-app-region: drag` só na faixa do header, e `no-drag` em
   *todo* elemento interativo dentro dela (botões, links, inputs, `[role=button]`, tabs). Esquecer
   um `no-drag` gera "botão que não clica". Mantenha o padrão já presente em `desktop-shell.css`.
2. **macOS:** `titleBarStyle: "hiddenInset"` + `trafficLightPosition`. Reserve ~80px à esquerda do
   header para os semáforos; não coloque conteúdo clicável embaixo deles.
3. **Windows:** `titleBarOverlay` com `color`/`symbolColor` acompanhando o tema (atualizar em
   `nativeTheme.on("updated")`); reserve a largura dos controles à direita (`env(titlebar-area-*)`).
4. **Linux:** manter a barra nativa (`default`); custom title bar em Linux quebra em vários WMs.
5. **Duplo clique no header** deve maximizar/restaurar (já é o comportamento nativo da região
   `drag`; não intercepte).
6. **Seleção de texto e cursor.** `user-select: none` e `cursor: default` no chrome (header, tabs,
   botões), mas **texto de conteúdo continua selecionável** (frases, correções, transcrições).
7. **Sem barra de rolagem de site.** Em macOS use scrollbars overlay; em geral estilize
   `::-webkit-scrollbar` fino e discreto, respeitando o tema.

## 4. Menus, atalhos e comandos

1. **Menu de aplicação nativo no macOS é obrigatório.** Sem ele, `Cmd+C/V/X/A/Z`, `Cmd+Q`,
   `Cmd+H`, `Cmd+M` e Hide/Services somem. Use **roles** (`copy`, `paste`, `undo`, `selectAll`,
   `quit`, `togglefullscreen`, `zoomIn`…) em vez de handlers manuais [oficial]: dão rótulo,
   atalho e comportamento corretos por plataforma e idioma.
2. **Estrutura mínima:** App (Sobre, Configurações `Cmd+,`, Ocultar, Sair) · Arquivo · Editar
   (roles padrão) · Visualizar (zoom, tela cheia, recarregar só em dev) · Janela · Ajuda.
3. **Windows/Linux:** hoje o menu é `null` (ganha espaço, perde `Ctrl+±`, `F11`, `Ctrl+R`
   em dev). Se mantiver sem menu, registre os atalhos essenciais em `before-input-event`, ou use
   menu com `autoHideMenuBar: true` (Alt revela).
4. **Atalhos** com `CommandOrControl+...`. Atalhos locais (menu/accelerator) por padrão; **atalho
   global (`globalShortcut`) só com consentimento explícito do usuário e configurável** [oficial
   recomenda reservar para poucas ações].
5. **Todo atalho precisa ser descobrível:** aparece no menu, em tooltip do botão e na tela de
   atalhos (`?` ou `Cmd+/`). Conflitos com o sistema ou com o campo de texto focado são bug.
6. **Menu de contexto nativo** (`Menu.popup` em `context-menu`) em campos de texto (cortar,
   copiar, colar, corrigir ortografia) e em links/frases (copiar, abrir). Sem isso o clique
   direito parece "quebrado".
7. **Atalhos de teclado do produto** (ouvir, gravar, próxima frase, revelar) devem ignorar quando o
   foco está em `input`/`textarea`/`contenteditable` e respeitar `event.isComposing` (IME).

## 5. Aparência, tema e tipografia

1. **Seguir o sistema.** `prefers-color-scheme` + `nativeTheme.themeSource` ("system" por padrão;
   o usuário pode forçar claro/escuro nas configurações). Sem flash de tema errado: aplicar o
   tema antes da primeira pintura (`ThemeInitScript` já faz isso no renderer; o `backgroundColor`
   da janela precisa concordar).
2. **Cor de destaque do sistema** (`systemPreferences.getAccentColor()`) é opcional; se usar,
   apenas em estados de seleção/foco, nunca em texto de corpo.
3. **Tokens, não hex.** Cores, raios, sombras e espaçamentos vêm das variáveis CSS existentes
   (`--accent`, `--border`, `--text-muted`…). Hex solto em componente é regressão.
4. **Fonte de interface = fonte do sistema** para chrome (`system-ui`); fonte de marca só no
   wordmark. Fontes empacotadas (não baixadas em runtime) [oficial: evitar requests de rede
   desnecessários].
5. **Densidade desktop.** Alvos de clique ≥ 28–32px com hover/pressed/focus/disabled visíveis;
   no desktop o hover existe, use-o. Não herde padding "mobile" por inércia.
6. **Contraste AA** (4.5:1 texto, 3:1 UI) nos dois temas; verificar também o estado desabilitado
   e o texto sobre `--accent`.
7. **Zoom do usuário.** `Cmd/Ctrl +/-/0` deve funcionar (e persistir); o layout não pode quebrar
   em 80%–150%.
8. **Vibrancy/mica** (`vibrancy`, `backgroundMaterial`) é opcional e só em superfícies do chrome;
   texto de estudo precisa de fundo sólido.

## 6. Interação e feedback

1. **Resposta imediata.** Toda ação tem feedback em < 100 ms (estado pressed, loading local);
   operação > 1 s mostra progresso real (barra determinada quando há total, indeterminada só
   quando não há), e > 10 s oferece cancelar.
2. **Nunca bloquear a thread.** I/O síncrono (`fs.*Sync`, `execSync`) no processo principal e
   trabalho pesado no renderer travam a janela inteira [oficial]. Use async, `utilityProcess`,
   Worker ou Web Worker (já usamos `utilityProcess` para o servidor).
3. **Estados completos por tela:** vazio (com a próxima ação), carregando (skeleton, sem layout
   shift), erro (o que houve + o que fazer + tentar de novo), offline/sem provedor de IA,
   modelo não baixado, sucesso. Mensagens em PT-BR claras, sem stack trace nem códigos soltos.
4. **Desfazer em vez de confirmar.** Ações destrutivas e reversíveis: toast com "Desfazer".
   Irreversíveis (apagar dados, resetar progresso): diálogo nativo (`dialog.showMessageBox`) com o
   botão destrutivo nomeado ("Apagar progresso", nunca "OK") e foco no cancelar.
5. **Diálogos nativos para arquivo** (`showSaveDialog`/`showOpenDialog`) lembrando a última pasta;
   após salvar, oferecer "Mostrar no Finder/Explorer" (`shell.showItemInFolder`).
6. **Notificações e badge com parcimônia:** badge do Dock/ícone de cartões vencidos
   (`useDockDueBadge`) é bom; notificações do sistema só opt-in, nunca por padrão.
7. **Drag & drop** de arquivos/links na janela com destaque da área de soltura e rejeição clara de
   tipo inválido. `dragover`/`drop` fora da área prevista não pode navegar a janela para o arquivo.
8. **Movimento com propósito.** Transições 120–250 ms, só `opacity`/`transform`; honrar
   `prefers-reduced-motion` (já existe em `desktop-shell.css`; todo novo `animation` precisa do
   bloco reduzido correspondente).
9. **Texto de tela, não de página.** Sem `alert()`/`confirm()` do browser; sem navegação
   completa de página no meio do fluxo (SPA, estado preservado ao trocar de painel).

## 7. Acessibilidade e idioma

1. **Teclado completo:** tudo operável por Tab/Shift+Tab/Enter/Espaço/Esc, ordem de foco lógica,
   foco visível (`:focus-visible`, nunca `outline: none` sem substituto), diálogos com trap de foco
   e retorno do foco ao elemento de origem; `Esc` fecha sobreposições.
2. **Semântica:** `button` para ação, `a` para navegação, `role="dialog"` + `aria-labelledby`,
   `aria-live="polite"` para resultados de correção/progresso, `aria-busy` em carregamentos.
3. **Leitor de tela:** nome acessível em todo botão só-ícone; áudio/gravação anunciam estado
   ("Gravando", "Parado").
4. **Respeitar preferências do SO:** `prefers-reduced-motion`, `prefers-contrast`,
   `prefers-reduced-transparency`, tamanho de fonte/zoom.
5. **i18n:** todo texto visível passa por `src/i18n` (PT-BR e EN); sem string solta em componente
   ou em `main.js` (diálogos, menu, tray também). Datas/números via `Intl` com o locale do app.
6. **Nunca depender só de cor** para certo/errado/vencido; some ícone ou texto.

## 8. Segurança, performance e distribuição

### Segurança [oficial: checklist do Electron]

- `contextIsolation: true`, `nodeIntegration: false`, `sandbox` ligado, `webSecurity` ligado.
  Declare explicitamente em `webPreferences` (não confie no default da versão).
- **Preload mínimo:** `contextBridge` expõe funções nomeadas e estreitas, nunca `ipcRenderer` ou
  `event`. Canal novo = função nova com argumentos validados no main (tipo, tamanho, caminho
  permitido). Prefixo `phrase-loop:` em todo canal.
- **Validar o remetente de todo `ipcMain.handle/on`** (`event.senderFrame.url` contra a origem do
  app) antes de qualquer ação privilegiada (gravar arquivo, salvar chave de API, abrir pasta).
- **Navegação e janelas novas:** `will-navigate` e `setWindowOpenHandler` comparando origem com
  `new URL(url).origin`, não `url.startsWith(...)` (`http://localhost:3000.evil.com` passa em
  `startsWith`). Links externos só `http(s)` via `shell.openExternal`, nunca dado do usuário sem
  validar o protocolo.
- **Permissões:** `session.setPermissionRequestHandler` negando por padrão e liberando só
  microfone (e só para a origem do app). Gravar sem aviso é inaceitável: indicador visível de
  gravação sempre.
- **CSP** restritiva (`script-src 'self'`; sem `unsafe-eval` em produção). Sem conteúdo remoto
  em `webview`/`iframe`. Segredos (chaves de API) ficam no main (`safeStorage`), nunca no
  renderer, IndexedDB ou logs.
- **Fuses** (`@electron/fuses`): desligar `runAsNode` e `nodeCliInspect` no build de release.
- Manter Electron atualizado, um major por vez, lendo o guia de breaking changes.
- Assinatura/notarização (macOS) e assinatura de código (Windows) antes de distribuir a terceiros;
  `entitlements.mac.plist` com o mínimo (microfone, JIT se necessário).

### Performance [oficial]

- Medir antes de otimizar (tempo até a primeira tela interativa; memória ociosa). Meta:
  janela visível com splash < 1 s; app interativo no menor tempo possível, resto em background.
- Carregar módulos pesados sob demanda (`require`/`import()` tardio); revisar o custo de cada
  dependência nova antes de adicionar.
- Sem polyfills desnecessários (Chromium do Electron é moderno). Fontes e assets empacotados.
- Pausar trabalho invisível: janela oculta/minimizada não deve manter animações, timers de UI nem
  polling agressivo (`document.visibilityState`, `powerMonitor` para suspend/resume).
- Listas longas (frases, histórico) virtualizadas; imagens/áudio com carregamento preguiçoso.

### Atualização, logs e dados

- Auto-update com canal e release notes, nunca reiniciar sem aviso; "Procurar atualizações" no menu.
- Logs em arquivo rotativo (`app.getPath("logs")`), com "Abrir pasta de logs" em Ajuda; sem
  dados do aluno nem chaves nos logs.
- Dados em `app.getPath("userData")` (ou `PHRASELOOP_DATA_DIR`); migrações versionadas e com
  backup antes de alterar. Nada de gravar dentro do bundle do app.
- Exportar/importar dados do aluno e "Resetar app" claros em Configurações.

## 9. Lacunas conhecidas no código atual

Observadas em `electron/main.js` e `electron/preload.js` na elaboração deste guia. Cada uma é uma
tarefa separada; não misturar com outras mudanças.

| # | Lacuna | Regra |
| --- | --- | --- |
| 4 | `startsWith(FRONTEND_URL)` em `setWindowOpenHandler` e `will-navigate`; `openExternal` sem checar protocolo | §8 Navegação |
| 5 | `webPreferences` sem `sandbox`/`nodeIntegration`/`webSecurity` explícitos | §8 Segurança |
| 6 | Sem `setPermissionRequestHandler` (microfone auto-aprovado) | §8 Permissões |
| 7 | Handlers `ipcMain` sem validação de `senderFrame` | §8 IPC |
| 8 | Menu `null` em Windows/Linux; sem menu de contexto nativo; sem tela de atalhos | §4 |
| 9 | Sem fuses, sem CSP verificada no build empacotado | §8 |
| 10 | `dataset.electron` injetado via `executeJavaScript` após o load (pode haver flash do header sem `no-drag`); preferir `additionalArguments`/preload | §3.1 |

Resolvidas: bounds/maximização persistidos, instância única e cores da janela/overlay seguindo o tema
(numeração original 1–3; `loading.html` ainda é sempre escuro). Antes de implementar qualquer uma, confirme o estado atual do código (esta tabela envelhece).

## 10. Checklist antes de concluir uma mudança de shell/UI desktop

- [ ] Funciona em macOS, e não quebra Windows/Linux (condicionais por `process.platform` no main,
      não no renderer).
- [ ] Tema claro e escuro, sem flash; contraste AA.
- [ ] Teclado completo, foco visível, `Esc` fecha, atalhos listados.
- [ ] Estados: vazio, carregando, erro, offline/sem IA, modelo ausente.
- [ ] Nenhum `no-drag` faltando em controle novo dentro do header.
- [ ] Nenhum canal IPC novo sem validação de remetente e argumentos; preload continua estreito.
- [ ] Nenhuma string nova fora de `src/i18n`.
- [ ] `prefers-reduced-motion` coberto em animações novas.
- [ ] Nada de I/O síncrono ou trabalho pesado na thread principal/renderer.
- [ ] Verificado rodando o app (`yarn start` ou a skill `verify`), não só testes: abrir, redimensionar
      até o mínimo, trocar tema, usar só o teclado.
- [ ] `yarn lint && yarn test`, depois `graphify update .`.
