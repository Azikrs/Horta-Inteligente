const {
  app,
  BrowserWindow,
  ipcMain,
  net,
  protocol,
  screen,
  session,
  shell,
} = require("electron");
const caminho = require("node:path");
const { createReadStream: criarFluxoLeitura } = require("node:fs");
const arquivos = require("node:fs/promises");
const { Readable: FluxoLegivel } = require("node:stream");
const { pathToFileURL } = require("node:url");
const iniciouPorEventoSquirrel = require("electron-squirrel-startup");
const { criarServicoConfiguracoes } = require("./configuracoes-aplicativo");
const { criarServicoBiblioteca } = require("./biblioteca-musical");

const ESQUEMA_APLICATIVO = "horta";
const ORIGEM_APLICATIVO = `${ESQUEMA_APLICATIVO}://aplicativo`;
const URL_PRINCIPAL = `${ORIGEM_APLICATIVO}/index.html`;
const caminhoIcone = caminho.join(__dirname, "recursos", "icone-horta.ico");
const extensoesPublicas = new Set([
  ".html",
  ".css",
  ".js",
  ".svg",
  ".ico",
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".woff",
  ".woff2",
]);
const arquivosPrivados = new Set([
  "aplicativo.js",
  "precarregamento.js",
  "biblioteca-musical.js",
  "configuracoes-aplicativo.js",
  "forge.config.js",
]);

let janelaPrincipal = null;
let servicoConfiguracoes = null;
let servicoBiblioteca = null;
let encerramentoSolicitado = false;
let encerramentoLiberado = false;
let encerramentoEmAndamento = false;
let temporizadorEncerramento = null;

// O registro precisa acontecer antes de `app.ready`. `stream` permite que o Chromium
// faça buffer e seek corretamente em elementos <audio> servidos pelo protocolo.
protocol.registerSchemesAsPrivileged([
  {
    scheme: ESQUEMA_APLICATIVO,
    privileges: {
      standard: true,
      secure: true,
      stream: true,
      supportFetchAPI: true,
    },
  },
]);

function criarResposta(texto, status, tipo = "text/plain; charset=utf-8") {
  return new Response(texto, {
    status,
    headers: {
      "content-type": tipo,
      "cache-control": "no-store",
    },
  });
}

function caminhoEstaDentro(diretorioRaiz, caminhoCandidato) {
  const relativo = caminho.relative(diretorioRaiz, caminhoCandidato);
  return (
    relativo === "" ||
    (relativo !== ".." && !relativo.startsWith(`..${caminho.sep}`) && !caminho.isAbsolute(relativo))
  );
}

function resolverRecursoDoAplicativo(nomeUrl) {
  let nomeDecodificado;

  try {
    nomeDecodificado = decodeURIComponent(nomeUrl === "/" ? "/index.html" : nomeUrl);
  } catch {
    return null;
  }

  if (nomeDecodificado.includes("\0") || nomeDecodificado.includes("\\")) {
    return null;
  }

  const caminhoResolvido = caminho.resolve(__dirname, `.${nomeDecodificado}`);
  const relativo = caminho.relative(__dirname, caminhoResolvido).replaceAll("\\", "/");

  if (
    !relativo ||
    !caminhoEstaDentro(__dirname, caminhoResolvido) ||
    !extensoesPublicas.has(caminho.extname(caminhoResolvido).toLowerCase()) ||
    arquivosPrivados.has(relativo.toLowerCase())
  ) {
    return null;
  }

  return caminhoResolvido;
}

function interpretarIntervaloBytes(cabecalho, tamanho) {
  if (!cabecalho) return null;
  const correspondencia = /^bytes=(\d*)-(\d*)$/i.exec(cabecalho.trim());
  if (!correspondencia || (!correspondencia[1] && !correspondencia[2]) || tamanho <= 0) {
    return { invalido: true };
  }

  const inicioInformado = correspondencia[1] ? Number(correspondencia[1]) : null;
  const fimInformado = correspondencia[2] ? Number(correspondencia[2]) : null;
  if (
    (inicioInformado !== null && (!Number.isSafeInteger(inicioInformado) || inicioInformado < 0))
    || (fimInformado !== null && (!Number.isSafeInteger(fimInformado) || fimInformado < 0))
  ) return { invalido: true };

  if (inicioInformado === null) {
    if (!fimInformado) return { invalido: true };
    const quantidade = Math.min(fimInformado, tamanho);
    return { inicio: tamanho - quantidade, fim: tamanho - 1 };
  }

  if (inicioInformado >= tamanho) return { invalido: true };
  const fim = fimInformado === null ? tamanho - 1 : Math.min(fimInformado, tamanho - 1);
  if (fim < inicioInformado) return { invalido: true };
  return { inicio: inicioInformado, fim };
}

/**
 * Áudio precisa responder Range de verdade: é isso que permite ao Chromium
 * descobrir a duração finita e buscar outro ponto sem baixar a faixa inteira.
 */
async function buscarAudioLocal(requisicao, caminhoArquivo, tipoMime) {
  try {
    const informacao = await arquivos.stat(caminhoArquivo);
    if (!informacao.isFile() || !Number.isSafeInteger(informacao.size)) {
      return criarResposta("Arquivo não encontrado", 404);
    }

    const tamanho = informacao.size;
    const intervalo = interpretarIntervaloBytes(requisicao.headers.get("range"), tamanho);
    const cabecalhos = new Headers({
      "accept-ranges": "bytes",
      "cache-control": "no-store",
      "content-type": tipoMime,
    });

    if (intervalo?.invalido) {
      cabecalhos.set("content-range", `bytes */${tamanho}`);
      cabecalhos.set("content-length", "0");
      return new Response(null, { status: 416, headers: cabecalhos });
    }

    const inicio = intervalo?.inicio ?? 0;
    const fim = intervalo?.fim ?? Math.max(tamanho - 1, 0);
    const comprimento = tamanho ? fim - inicio + 1 : 0;
    const status = intervalo ? 206 : 200;
    cabecalhos.set("content-length", String(comprimento));
    if (intervalo) cabecalhos.set("content-range", `bytes ${inicio}-${fim}/${tamanho}`);

    const corpo = requisicao.method === "HEAD" || comprimento === 0
      ? null
      : FluxoLegivel.toWeb(criarFluxoLeitura(caminhoArquivo, { start: inicio, end: fim }));
    return new Response(corpo, { status, headers: cabecalhos });
  } catch {
    return criarResposta("Arquivo não encontrado", 404);
  }
}

async function buscarArquivoLocal(requisicao, caminhoArquivo, tipoMime = null) {
  if (requisicao.method !== "GET" && requisicao.method !== "HEAD") {
    return criarResposta("Método não permitido", 405);
  }

  if (tipoMime?.startsWith("audio/")) {
    return buscarAudioLocal(requisicao, caminhoArquivo, tipoMime);
  }

  try {
    // Os cabeçalhos, inclusive Range, são encaminhados ao net.fetch. Isso mantém
    // reprodução progressiva, busca na linha do tempo e respostas 206 do arquivo local.
    const resposta = await net.fetch(pathToFileURL(caminhoArquivo).toString(), {
      method: requisicao.method,
      headers: requisicao.headers,
    });

    if (!tipoMime || resposta.headers.get("content-type") === tipoMime) {
      return resposta;
    }

    const cabecalhos = new Headers(resposta.headers);
    cabecalhos.set("content-type", tipoMime);
    return new Response(resposta.body, {
      status: resposta.status,
      statusText: resposta.statusText,
      headers: cabecalhos,
    });
  } catch {
    return criarResposta("Arquivo não encontrado", 404);
  }
}

/**
 * O aplicativo e as músicas compartilham a mesma origem. Assim o visualizador pode
 * conectar o <audio> ao AnalyserNode sem liberar CORS nem expor caminhos do Windows.
 */
function registrarProtocoloLocal() {
  protocol.handle(ESQUEMA_APLICATIVO, async (requisicao) => {
    let url;
    try {
      url = new URL(requisicao.url);
    } catch {
      return criarResposta("Endereço inválido", 400);
    }

    if (url.host !== "aplicativo") {
      return criarResposta("Origem não permitida", 403);
    }

    const correspondenciaMidia = url.pathname.match(/^\/midia\/(faixa|capa)\/([\da-f]{64})$/i);
    if (correspondenciaMidia) {
      const midia = await servicoBiblioteca?.resolverMidia(
        correspondenciaMidia[1].toLowerCase(),
        correspondenciaMidia[2],
      );
      return midia
        ? buscarArquivoLocal(requisicao, midia.caminhoArquivo, midia.tipoMime)
        : criarResposta("Mídia não encontrada", 404);
    }

    const recurso = resolverRecursoDoAplicativo(url.pathname);
    return recurso
      ? buscarArquivoLocal(requisicao, recurso)
      : criarResposta("Recurso não encontrado", 404);
  });
}

function remetenteEhConfiavel(evento) {
  if (
    !janelaPrincipal ||
    janelaPrincipal.isDestroyed() ||
    evento.sender !== janelaPrincipal.webContents ||
    evento.senderFrame !== janelaPrincipal.webContents.mainFrame
  ) {
    return false;
  }

  try {
    const url = new URL(evento.senderFrame.url);
    return url.protocol === `${ESQUEMA_APLICATIVO}:` && url.host === "aplicativo";
  } catch {
    return false;
  }
}

function registrarManipuladorSeguro(canal, manipulador) {
  ipcMain.handle(canal, async (evento, ...argumentos) => {
    if (!remetenteEhConfiavel(evento)) {
      throw new Error("Solicitação recusada por origem inválida.");
    }

    return manipulador(...argumentos);
  });
}

function publicarProgressoBiblioteca(dados) {
  if (janelaPrincipal && !janelaPrincipal.isDestroyed()) {
    janelaPrincipal.webContents.send("biblioteca:progresso", dados);
  }
}

async function concluirEncerramentoSeguro() {
  if (encerramentoLiberado || encerramentoEmAndamento) return;
  encerramentoEmAndamento = true;

  // Dá uma janela curta para concluir escritas, mas nunca deixa uma varredura de
  // biblioteca em disco ou nuvem prender o encerramento do aplicativo.
  let temporizadorLimite = null;
  await Promise.race([
    Promise.allSettled([
      servicoBiblioteca?.finalizar?.(),
      servicoConfiguracoes?.finalizar?.(),
    ]),
    new Promise((resolver) => {
      temporizadorLimite = setTimeout(resolver, 1500);
    }),
  ]);
  clearTimeout(temporizadorLimite);
  encerramentoLiberado = true;
  clearTimeout(temporizadorEncerramento);
  temporizadorEncerramento = null;
  if (janelaPrincipal && !janelaPrincipal.isDestroyed()) janelaPrincipal.close();
}

function registrarComunicacaoInterna() {
  registrarManipuladorSeguro("configuracoes:carregar", () => servicoConfiguracoes.carregar());
  registrarManipuladorSeguro("configuracoes:salvar", (estadoCompleto) => {
    if (!estadoCompleto || typeof estadoCompleto !== "object" || Array.isArray(estadoCompleto)) {
      throw new TypeError("Estado de configurações inválido.");
    }
    return servicoConfiguracoes.salvarDoRenderer(estadoCompleto);
  });

  registrarManipuladorSeguro("biblioteca:escolher-pasta", () =>
    servicoBiblioteca.escolherPasta(janelaPrincipal),
  );
  registrarManipuladorSeguro("biblioteca:obter", () => servicoBiblioteca.obter());
  registrarManipuladorSeguro("biblioteca:reescanear", () => servicoBiblioteca.reescanear());

  registrarManipuladorSeguro("sistema:obter-informacoes", async () => {
    const biblioteca = await servicoBiblioteca.obter();
    return {
      versao: app.getVersion(),
      plataforma: process.platform,
      tempoExecucaoSegundos: Math.floor(process.uptime()),
      diretorioDados: servicoConfiguracoes.obterDiretorioDados(),
      biblioteca: {
        pasta: biblioteca.pasta,
        quantidade: biblioteca.quantidade,
        ultimaAtualizacao: biblioteca.ultimaAtualizacao,
      },
    };
  });

  registrarManipuladorSeguro("sistema:abrir-pasta-dados", async () => {
    const erro = await shell.openPath(servicoConfiguracoes.obterDiretorioDados());
    return erro ? { sucesso: false, erro } : { sucesso: true };
  });
  registrarManipuladorSeguro("sistema:confirmar-encerramento", async () => {
    await concluirEncerramentoSeguro();
    return { sucesso: true };
  });
}

function aplicarRestricoesDaSessao() {
  session.defaultSession.setPermissionCheckHandler(() => false);
  session.defaultSession.setPermissionRequestHandler((_webContents, _permissao, responder) => {
    responder(false);
  });
}

/**
 * Cria a janela desktop e carrega a interface existente pelo protocolo local seguro.
 * O tamanho inicial continua respeitando a área útil antes de entrar em tela cheia.
 */
function criarJanelaPrincipal() {
  const { width: larguraDisponivel, height: alturaDisponivel } =
    screen.getPrimaryDisplay().workAreaSize;

  encerramentoSolicitado = false;
  encerramentoLiberado = false;
  janelaPrincipal = new BrowserWindow({
    width: Math.min(1440, larguraDisponivel),
    height: Math.min(960, alturaDisponivel),
    minWidth: 360,
    minHeight: 600,
    center: true,
    resizable: true,
    // Tela cheia real, sem modo quiosque: Alt + F4 continua encerrando normalmente.
    fullscreen: true,
    autoHideMenuBar: true,
    backgroundColor: "#07110f",
    icon: caminhoIcone,
    show: false,
    webPreferences: {
      preload: caminho.join(__dirname, "precarregamento.js"),
      autoplayPolicy: "no-user-gesture-required",
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
    },
  });

  janelaPrincipal.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  janelaPrincipal.webContents.on("will-attach-webview", (evento) => evento.preventDefault());
  janelaPrincipal.webContents.on("will-navigate", (evento, destino) => {
    if (destino !== URL_PRINCIPAL) {
      evento.preventDefault();
    }
  });

  janelaPrincipal.loadURL(URL_PRINCIPAL);

  // Evita exibir um quadro vazio enquanto o HTML e os estilos estão carregando.
  janelaPrincipal.once("ready-to-show", () => {
    janelaPrincipal.show();
  });

  janelaPrincipal.on("close", (evento) => {
    if (encerramentoLiberado || janelaPrincipal?.webContents?.isDestroyed()) return;
    evento.preventDefault();
    if (encerramentoSolicitado) return;
    encerramentoSolicitado = true;
    janelaPrincipal.webContents.send("sistema:preparar-encerramento");
    // Se o renderer estiver travado, o aplicativo ainda encerra depois de
    // drenar o que já chegou ao processo principal. Este caminho é independente
    // da finalização normal para também cobrir uma varredura de disco bloqueada.
    temporizadorEncerramento = setTimeout(() => {
      encerramentoLiberado = true;
      temporizadorEncerramento = null;
      if (janelaPrincipal && !janelaPrincipal.isDestroyed()) janelaPrincipal.close();
    }, 1800);
  });

  janelaPrincipal.on("closed", () => {
    clearTimeout(temporizadorEncerramento);
    temporizadorEncerramento = null;
    janelaPrincipal = null;
  });
}

async function prepararServicos() {
  const diretorioDados = app.getPath("userData");
  servicoConfiguracoes = criarServicoConfiguracoes(diretorioDados);
  await servicoConfiguracoes.inicializar();

  servicoBiblioteca = criarServicoBiblioteca({
    diretorioDados,
    servicoConfiguracoes,
    notificarProgresso: publicarProgressoBiblioteca,
  });
  await servicoBiblioteca.inicializar();

  registrarProtocoloLocal();
  registrarComunicacaoInterna();
  aplicarRestricoesDaSessao();
}

// Registra o ciclo de vida usado somente quando o usuário abre o aplicativo normalmente.
function iniciarAplicativo() {
  app.setAppUserModelId("com.squirrel.HortaInteligente.HortaInteligente");

  app.whenReady()
    .then(async () => {
      await prepararServicos();
      criarJanelaPrincipal();

      app.on("activate", () => {
        if (BrowserWindow.getAllWindows().length === 0) {
          criarJanelaPrincipal();
        }
      });
    })
    .catch((erro) => {
      console.error("Não foi possível iniciar a Horta Inteligente:", erro);
      app.quit();
    });

  app.on("before-quit", () => {
    // As operações que alteram estado já aguardam a escrita atômica. Aqui apenas
    // drenamos filas eventualmente concluídas sem bloquear o encerramento do Windows.
    void servicoBiblioteca?.finalizar();
    void servicoConfiguracoes?.finalizar();
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
      app.quit();
    }
  });
}

// Durante instalação, atualização ou remoção, o Squirrel chama o aplicativo com
// argumentos especiais. Nesses casos, ele deve encerrar antes de criar a janela normal.
if (iniciouPorEventoSquirrel) {
  app.quit();
} else {
  iniciarAplicativo();
}
