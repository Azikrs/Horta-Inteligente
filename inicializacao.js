/*
 * Controla somente a experiência de abertura. Este arquivo não conhece os
 * cartões do painel nem cria dados: ele reage aos estados informados pela fonte
 * e libera a interface depois que `principal.js` confirma uma leitura válida.
 */
(function prepararInicializacao(escopoAplicacao) {
  "use strict";

  const tela = document.querySelector("#tela-inicializacao");
  const painel = document.querySelector("#painel-aplicacao");

  // Se a tela for removida no futuro, o restante do projeto continua iniciando.
  if (!tela || !painel) return;

  const elementos = {
    numeroEtapa: document.querySelector("#numero-etapa-inicializacao"),
    rotuloEtapa: document.querySelector("#rotulo-etapa-inicializacao"),
    estado: document.querySelector("#estado-inicializacao"),
    descricao: document.querySelector("#descricao-inicializacao"),
    mensagem: document.querySelector("#mensagem-inicializacao"),
    modo: document.querySelector("#modo-inicializacao"),
    comunicacao: document.querySelector("#comunicacao-inicializacao"),
    dados: document.querySelector("#dados-inicializacao"),
    conteudoPrincipal: document.querySelector("#conteudo-principal"),
  };

  const prefereMovimentoReduzido = escopoAplicacao.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;

  const tempos = prefereMovimentoReduzido
    ? { introducao: 50, sincronizacao: 20, conectado: 120, transicao: 50 }
    : { introducao: 900, sincronizacao: 650, conectado: 950, transicao: 1450 };

  const estadosVisuais = {
    iniciando: {
      etapa: 1,
      rotulo: "Preparação do sistema",
      titulo: "INICIANDO",
      descricao: "Preparando a interface e os módulos locais...",
      comunicacao: "VERIFICANDO",
      dados: "AGUARDANDO",
    },
    aguardando: {
      etapa: 2,
      rotulo: "Comunicação serial",
      titulo: "AGUARDANDO ARDUINO",
      descricao: "Verificando a comunicação USB e aguardando dados do cultivo...",
      comunicacao: "BUSCANDO",
      dados: "AGUARDANDO",
    },
    sincronizando: {
      etapa: 3,
      rotulo: "Dispositivo detectado",
      titulo: "ARDUINO ENCONTRADO",
      descricao: "Sincronizando e conferindo todos os dados do circuito...",
      comunicacao: "ATIVA",
      dados: "VALIDANDO",
    },
    conectado: {
      etapa: 4,
      rotulo: "Conexão confirmada",
      titulo: "SISTEMA ONLINE",
      descricao: "Leitura completa recebida. Abrindo o painel da horta...",
      comunicacao: "CONECTADA",
      dados: "RECEBIDOS",
    },
    erro: {
      etapa: 2,
      rotulo: "Diagnóstico do sistema",
      titulo: "FALHA NA INICIALIZAÇÃO",
      descricao: "Não foi possível preparar a fonte de dados.",
      comunicacao: "INDISPONÍVEL",
      dados: "INTERROMPIDOS",
    },
  };

  let estadoAtual = "iniciando";
  let modoFonte = "arduino";
  let introducaoConcluida = false;
  let comunicacaoIniciada = false;
  let primeiraLeituraConfirmada = false;
  let sequenciaConexaoIniciada = false;
  let inicializacaoFalhou = false;
  let painelLiberado = false;
  const temporizadores = new Set();

  function agendar(acao, espera) {
    const identificador = escopoAplicacao.setTimeout(() => {
      temporizadores.delete(identificador);
      acao();
    }, espera);

    temporizadores.add(identificador);
    return identificador;
  }

  function obterEstadoVisual(nomeEstado) {
    const estadoBase = { ...estadosVisuais[nomeEstado] };

    // O modo de demonstração é identificado com clareza para não fingir que o
    // Arduino físico está conectado enquanto os dados ainda vêm do simulador.
    if (modoFonte === "simulador") {
      if (nomeEstado === "aguardando") {
        estadoBase.rotulo = "Modo de demonstração";
        estadoBase.titulo = "AGUARDANDO DADOS";
        estadoBase.descricao = "Preparando a primeira leitura do simulador local...";
      }

      if (nomeEstado === "sincronizando") {
        estadoBase.rotulo = "Pacote de demonstração";
        estadoBase.titulo = "FONTE RESPONDEU";
        estadoBase.descricao = "Validando o pacote completo antes de abrir o painel...";
      }
    }

    return estadoBase;
  }

  function definirEstadoVisual(nomeEstado, descricaoPersonalizada) {
    if (!estadosVisuais[nomeEstado] || painelLiberado) return;
    if (estadoAtual === "conectado" && nomeEstado !== "conectado") return;

    const estado = obterEstadoVisual(nomeEstado);
    estadoAtual = nomeEstado;

    tela.dataset.estado = nomeEstado;
    tela.dataset.etapa = String(estado.etapa);
    elementos.numeroEtapa.textContent = `${String(estado.etapa).padStart(2, "0")} / 04`;
    elementos.rotuloEtapa.textContent = estado.rotulo;
    elementos.estado.textContent = estado.titulo;
    elementos.descricao.textContent = descricaoPersonalizada || estado.descricao;
    elementos.comunicacao.textContent = estado.comunicacao;
    elementos.dados.textContent = estado.dados;

    elementos.mensagem.classList.remove("esta-mudando");
    escopoAplicacao.requestAnimationFrame(() => {
      elementos.mensagem.classList.add("esta-mudando");
    });

    tela.dispatchEvent(
      new CustomEvent("mudancaestadoinicializacao", {
        detail: { estado: nomeEstado, etapa: estado.etapa },
      }),
    );
  }

  function revelarPainel() {
    if (painelLiberado) return;
    painelLiberado = true;

    // O painel só é renderizado neste momento. Ele já recebeu a leitura válida
    // por trás da tela, mas permaneceu oculto e fora da navegação por teclado.
    painel.hidden = false;
    document.body.classList.add("painel-preparado");

    escopoAplicacao.requestAnimationFrame(() => {
      escopoAplicacao.requestAnimationFrame(() => {
        tela.classList.add("esta-saindo");
        document.body.classList.add("inicializacao-saindo");
      });
    });

    agendar(() => {
      tela.hidden = true;
      tela.setAttribute("aria-busy", "false");
      tela.setAttribute("aria-hidden", "true");
      painel.removeAttribute("inert");
      painel.setAttribute("aria-hidden", "false");
      document.body.classList.remove(
        "inicializacao-ativa",
        "inicializacao-saindo",
        "painel-preparado",
      );
      document.body.classList.add("painel-visivel");

      // O foco é movido uma única vez, depois da abertura, para que leitores de
      // tela encontrem diretamente o conteúdo que acabou de ficar disponível.
      if (elementos.conteudoPrincipal) {
        elementos.conteudoPrincipal.setAttribute("tabindex", "-1");
        elementos.conteudoPrincipal.focus({ preventScroll: true });
      }

      temporizadores.forEach((identificador) => escopoAplicacao.clearTimeout(identificador));
      temporizadores.clear();
    }, tempos.transicao);
  }

  function executarSequenciaConexao() {
    if (
      sequenciaConexaoIniciada
      || !introducaoConcluida
      || !primeiraLeituraConfirmada
      || painelLiberado
    ) {
      return;
    }

    sequenciaConexaoIniciada = true;
    definirEstadoVisual("sincronizando");

    agendar(() => {
      definirEstadoVisual("conectado");
      agendar(revelarPainel, tempos.conectado);
    }, tempos.sincronizacao);
  }

  function interpretarEstadoDaFonte(estadoRecebido) {
    if (typeof estadoRecebido === "string") return estadoRecebido.toLowerCase();
    if (!estadoRecebido || typeof estadoRecebido !== "object") return "aguardando";

    const estado = estadoRecebido.estado ?? estadoRecebido.conexao ?? estadoRecebido.status;
    return typeof estado === "string" ? estado.toLowerCase() : "aguardando";
  }

  /**
   * Recebe apenas indícios da fonte: procura de porta, porta aberta ou bytes em
   * trânsito. Até mesmo o texto "conectado" vira sincronização aqui; nenhum
   * estado técnico isolado possui permissão para liberar o painel.
   */
  function informarEstadoDaFonte(estadoRecebido) {
    if (primeiraLeituraConfirmada || inicializacaoFalhou || painelLiberado) return;

    const estado = interpretarEstadoDaFonte(estadoRecebido);
    const estadosComComunicacao = new Set([
      "arduino-encontrado",
      "conectando",
      "conectado",
      "dados-recebidos",
      "encontrado",
      "porta-aberta",
      "sincronizando",
    ]);

    comunicacaoIniciada = estadosComComunicacao.has(estado);

    if (!introducaoConcluida) return;
    definirEstadoVisual(comunicacaoIniciada ? "sincronizando" : "aguardando");
  }

  /**
   * Esta é a única entrada que autoriza a abertura. `principal.js` chama esta
   * função somente depois de validar e desenhar a primeira leitura recebida.
   */
  function confirmarPrimeiraLeitura() {
    if (primeiraLeituraConfirmada || inicializacaoFalhou || painelLiberado) return;
    primeiraLeituraConfirmada = true;
    comunicacaoIniciada = true;
    executarSequenciaConexao();
  }

  function informarFalha(mensagem) {
    if (painelLiberado || estadoAtual === "conectado") return;
    inicializacaoFalhou = true;
    sequenciaConexaoIniciada = false;
    temporizadores.forEach((identificador) => escopoAplicacao.clearTimeout(identificador));
    temporizadores.clear();
    definirEstadoVisual("erro", mensagem);
  }

  function configurarFonte(fonteDados) {
    const tipoInformado = fonteDados?.tipoFonte ?? fonteDados?.tipo ?? "arduino";
    modoFonte = String(tipoInformado).toLowerCase() === "simulador" ? "simulador" : "arduino";
    elementos.modo.textContent = modoFonte === "simulador"
      ? "DEMONSTRAÇÃO / SIMULADOR"
      : "SERIAL / ARDUINO";
  }

  const controlador = Object.freeze({
    configurarFonte,
    confirmarPrimeiraLeitura,
    informarEstadoDaFonte,
    informarFalha,
    estaConcluida: () => painelLiberado,
    obterEstado: () => estadoAtual,
  });

  const hortaInteligente = escopoAplicacao.HortaInteligente ?? {};
  hortaInteligente.inicializacao = controlador;
  escopoAplicacao.HortaInteligente = hortaInteligente;

  // A introdução possui um tempo mínimo apenas para ser legível. Ao terminar,
  // ela continua aguardando indefinidamente se nenhuma leitura válida chegar.
  agendar(() => {
    introducaoConcluida = true;

    if (primeiraLeituraConfirmada) {
      executarSequenciaConexao();
      return;
    }

    definirEstadoVisual(comunicacaoIniciada ? "sincronizando" : "aguardando");
  }, tempos.introducao);
})(window);
