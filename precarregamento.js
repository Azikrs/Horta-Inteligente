const { contextBridge, ipcRenderer } = require("electron");

/**
 * A ponte oferece somente operações específicas e validadas pelo processo principal.
 * O renderer não recebe `ipcRenderer`, caminhos arbitrários nem acesso direto ao Node.js.
 */
contextBridge.exposeInMainWorld("ponteHorta", {
  configuracoes: {
    carregar: () => ipcRenderer.invoke("configuracoes:carregar"),
    salvar: (estadoCompleto) => ipcRenderer.invoke("configuracoes:salvar", estadoCompleto),
  },
  biblioteca: {
    escolherPasta: () => ipcRenderer.invoke("biblioteca:escolher-pasta"),
    obter: () => ipcRenderer.invoke("biblioteca:obter"),
    reescanear: () => ipcRenderer.invoke("biblioteca:reescanear"),
    aoProgresso: (callback) => {
      if (typeof callback !== "function") {
        throw new TypeError("O acompanhamento da biblioteca precisa receber uma função.");
      }

      // O objeto interno do evento Electron nunca atravessa a contextBridge.
      const ouvinte = (_evento, dados) => callback(dados);
      ipcRenderer.on("biblioteca:progresso", ouvinte);

      return () => {
        ipcRenderer.removeListener("biblioteca:progresso", ouvinte);
      };
    },
  },
  sistema: {
    obterInformacoes: () => ipcRenderer.invoke("sistema:obter-informacoes"),
    abrirPastaDados: () => ipcRenderer.invoke("sistema:abrir-pasta-dados"),
    confirmarEncerramento: () => ipcRenderer.invoke("sistema:confirmar-encerramento"),
    aoSolicitarEncerramento: (callback) => {
      if (typeof callback !== "function") {
        throw new TypeError("A preparação do encerramento precisa receber uma função.");
      }
      const ouvinte = () => callback();
      ipcRenderer.on("sistema:preparar-encerramento", ouvinte);
      return () => ipcRenderer.removeListener("sistema:preparar-encerramento", ouvinte);
    },
  },
});
