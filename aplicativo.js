const { app, BrowserWindow, screen } = require("electron");
const caminho = require("node:path");
const iniciouPorEventoSquirrel = require("electron-squirrel-startup");

let janelaPrincipal = null;
const caminhoIcone = caminho.join(__dirname, "recursos", "icone-horta.ico");

/**
 * Cria a janela desktop e carrega a interface já existente do projeto.
 * O tamanho inicial respeita a área útil do monitor para não abrir fora da tela.
 */
function criarJanelaPrincipal() {
  const { width: larguraDisponivel, height: alturaDisponivel } =
    screen.getPrimaryDisplay().workAreaSize;

  janelaPrincipal = new BrowserWindow({
    width: Math.min(1440, larguraDisponivel),
    height: Math.min(960, alturaDisponivel),
    minWidth: 360,
    minHeight: 600,
    center: true,
    resizable: true,
    autoHideMenuBar: true,
    backgroundColor: "#07110f",
    icon: caminhoIcone,
    show: false,
    webPreferences: {
      // A interface não precisa acessar diretamente os recursos internos do Node.js.
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });

  janelaPrincipal.loadFile(caminho.join(__dirname, "index.html"));

  // Evita exibir um quadro branco enquanto o HTML e os estilos estão carregando.
  janelaPrincipal.once("ready-to-show", () => {
    janelaPrincipal.show();
  });

  janelaPrincipal.on("closed", () => {
    janelaPrincipal = null;
  });
}

// Registra o ciclo de vida usado somente quando o usuário abre o aplicativo normalmente.
function iniciarAplicativo() {
  // Mantém o atalho e a janela agrupados com a identidade própria do aplicativo no Windows.
  app.setAppUserModelId("com.squirrel.HortaInteligente.HortaInteligente");

  app.whenReady().then(() => {
    criarJanelaPrincipal();

    // Mantém o comportamento esperado caso o projeto seja aberto em outro sistema.
    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        criarJanelaPrincipal();
      }
    });
  });

  // No Windows, encerrar a última janela também encerra completamente o aplicativo.
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
