/*
 * Estado central de configurações da Horta Inteligente.
 *
 * No Electron, o renderer nunca acessa o sistema de arquivos diretamente: a
 * ponte segura carrega e salva o documento mantido pelo processo principal.
 * O localStorage existe apenas como alternativa para abrir o front-end fora do
 * Electron e usa uma única chave, evitando preferências espalhadas pelo projeto.
 */
(function prepararConfiguracoes(escopoAplicacao) {
  "use strict";

  const chaveArmazenamentoNavegador = "horta-inteligente:configuracoes";
  const chavesAudioLegado = [
    "horta-inteligente:som-ativo",
    "horta-inteligente:som-inicializacao-ativo",
  ];
  const atrasoPersistencia = 180;
  const ponteConfiguracoes = escopoAplicacao.ponteHorta?.configuracoes;
  const executandoNoElectron = /\bElectron\//i.test(navigator.userAgent);
  const possuiPonteElectron = Boolean(
    ponteConfiguracoes
      && typeof ponteConfiguracoes.carregar === "function"
      && typeof ponteConfiguracoes.salvar === "function",
  );

  const configuracoesPadrao = congelarProfundamente({
    versaoEsquema: 2,

    geral: {
      nomeSistema: "Horta Inteligente",
      perfilSistema: "padrao",
    },

    audio: {
      somGeralAtivo: true,
      efeitos: {
        ativo: true,
        volume: 1,
      },
      ambiente: {
        ativo: true,
        volume: 1,
      },
      musica: {
        ativo: true,
        volume: 0.72,
      },
      perfil: "imersivo",
      ducking: {
        ativo: true,
        nivel: 0.8,
        retornoMs: 380,
      },
    },

    aparencia: {
      modoCor: "cultivo",
      atmosfera: "natural",
      corDestaque: "cultivo",
      corPersonalizada: "#65d99a",
      intensidadeVisual: "normal",
      temaAutomatico: {
        ativo: false,
        inicio: "20:00",
        fim: "07:00",
      },
    },

    estacao: {
      pastaBiblioteca: null,
      autoplayInicializacao: false,
      musicasInicializacao: [],
      aleatorio: false,
      repeticao: "biblioteca",
      retomarSessao: true,
      retomarPosicao: true,
      mostrarMiniPlayer: true,
      mostrarVisualizador: true,
      modoImersivo: false,
      musicaSilenciada: false,
      favoritas: [],
      recentes: [],
      fila: [],
      ultimaFaixaId: null,
      posicao: 0,
    },

    interface: {
      animacoesAtivas: true,
      intensidadeAnimacoes: "normal",
      efeitosFundoAtivos: true,
      microinteracoesAtivas: true,
      visualizadorMusicaAtivo: true,
      indicadorNovaLeituraAtivo: true,
      modoFoco: false,
      modoApresentacao: false,
      modoAmbienteMinutos: 0,
    },

    horta: {
      nomePlanta: "",
      limiteUmidadeMinima: 45,
      limiteUmidadeMaxima: 72,
      horarioIluminacaoInicio: "08:00",
      horarioIluminacaoFim: "20:00",
      modoAutomatico: true,
    },

    acessibilidade: {
      reduzirMovimentos: false,
      altoContraste: false,
      aumentarTextos: false,
      desativarTransparencias: false,
      semVisualizador: false,
      silenciarTudo: false,
    },
  });

  const perfisAudio = congelarProfundamente({
    silencioso: {
      "audio.somGeralAtivo": false,
      "audio.perfil": "silencioso",
    },
    discreto: {
      "audio.somGeralAtivo": true,
      "audio.efeitos.ativo": true,
      "audio.efeitos.volume": 0.46,
      "audio.ambiente.ativo": false,
      "audio.ambiente.volume": 0.5,
      "audio.musica.ativo": true,
      "audio.musica.volume": 0.58,
      "audio.ducking.ativo": true,
      "audio.ducking.nivel": 0.86,
      "audio.ducking.retornoMs": 300,
      "audio.perfil": "discreto",
    },
    imersivo: {
      "audio.somGeralAtivo": true,
      "audio.efeitos.ativo": true,
      "audio.efeitos.volume": 1,
      "audio.ambiente.ativo": true,
      "audio.ambiente.volume": 1,
      "audio.musica.ativo": true,
      "audio.musica.volume": 0.72,
      "audio.ducking.ativo": true,
      "audio.ducking.nivel": 0.8,
      "audio.ducking.retornoMs": 380,
      "audio.perfil": "imersivo",
    },
    personalizado: {
      "audio.perfil": "personalizado",
    },
  });

  const perfisSistema = congelarProfundamente({
    padrao: {
      "geral.perfilSistema": "padrao",
      "aparencia.modoCor": "cultivo",
      "aparencia.intensidadeVisual": "normal",
      "interface.efeitosFundoAtivos": true,
      "interface.modoFoco": false,
      "interface.modoApresentacao": false,
    },
    apresentacao: {
      "geral.perfilSistema": "apresentacao",
      "aparencia.modoCor": "cultivo",
      "aparencia.intensidadeVisual": "vibrante",
      "interface.animacoesAtivas": true,
      "interface.intensidadeAnimacoes": "alta",
      "interface.efeitosFundoAtivos": true,
      "interface.modoFoco": false,
      "interface.modoApresentacao": true,
    },
    noturno: {
      "geral.perfilSistema": "noturno",
      "aparencia.modoCor": "escuro",
      "aparencia.intensidadeVisual": "sutil",
      "interface.efeitosFundoAtivos": true,
      "interface.modoFoco": false,
      "interface.modoApresentacao": false,
    },
    foco: {
      "geral.perfilSistema": "foco",
      "aparencia.intensidadeVisual": "sutil",
      "interface.efeitosFundoAtivos": false,
      "interface.modoFoco": true,
      "interface.modoApresentacao": false,
    },
    musica: {
      "geral.perfilSistema": "musica",
      "aparencia.intensidadeVisual": "vibrante",
      "interface.efeitosFundoAtivos": true,
      "interface.modoFoco": false,
      "interface.modoApresentacao": false,
      "estacao.mostrarMiniPlayer": true,
      "estacao.mostrarVisualizador": true,
    },
  });

  let estadoConfiguracoes = clonar(configuracoesPadrao);
  let configuracoesCarregadas = false;
  let temporizadorPersistencia = null;
  let versaoEstado = 0;
  let salvamentoEmFila = Promise.resolve();
  let migracaoAudioPendente = false;
  const assinantes = new Set();

  function congelarProfundamente(valor) {
    if (!valor || typeof valor !== "object" || Object.isFrozen(valor)) return valor;
    Object.values(valor).forEach(congelarProfundamente);
    return Object.freeze(valor);
  }

  function clonar(valor) {
    if (valor === undefined || valor === null || typeof valor !== "object") return valor;
    if (typeof structuredClone === "function") return structuredClone(valor);
    return JSON.parse(JSON.stringify(valor));
  }

  function limitar(numero, minimo, maximo) {
    return Math.min(maximo, Math.max(minimo, numero));
  }

  function normalizarBooleano(valor, padrao) {
    return typeof valor === "boolean" ? valor : padrao;
  }

  function normalizarNumero(valor, padrao, minimo, maximo) {
    const numero = Number(valor);
    return Number.isFinite(numero) ? limitar(numero, minimo, maximo) : padrao;
  }

  function normalizarTexto(valor, padrao, tamanhoMaximo, permiteVazio = false) {
    if (typeof valor !== "string") return padrao;
    const texto = valor.trim().slice(0, tamanhoMaximo);
    return texto || (permiteVazio ? "" : padrao);
  }

  function normalizarTextoNulo(valor, tamanhoMaximo) {
    if (valor === null || valor === undefined || valor === "") return null;
    if (typeof valor !== "string") return null;
    const texto = valor.replace(/[\u0000-\u001f\u007f]/g, "").trim();
    return texto ? texto.slice(0, tamanhoMaximo) : null;
  }

  function normalizarListaTextos(valor, quantidadeMaxima) {
    if (!Array.isArray(valor)) return [];
    return [...new Set(valor
      .filter((item) => typeof item === "string" && /^[\da-f]{64}$/i.test(item))
      .map((item) => item.toLowerCase()))]
      .slice(0, quantidadeMaxima);
  }

  function normalizarIdentificadorNulo(valor) {
    return typeof valor === "string" && /^[\da-f]{64}$/i.test(valor)
      ? valor.toLowerCase()
      : null;
  }

  function normalizarOpcao(valor, opcoes, padrao) {
    return opcoes.includes(valor) ? valor : padrao;
  }

  function normalizarHorario(valor, padrao) {
    return typeof valor === "string" && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(valor)
      ? valor
      : padrao;
  }

  function normalizarCor(valor, padrao) {
    return typeof valor === "string" && /^#[\da-f]{6}$/i.test(valor)
      ? valor.toLowerCase()
      : padrao;
  }

  function lerCaminhoNoObjeto(objeto, caminho) {
    if (!caminho) return objeto;
    return caminho.split(".").reduce((atual, parte) => atual?.[parte], objeto);
  }

  function caminhoExisteNoPadrao(caminho) {
    if (!caminho || caminho.includes("__proto__") || caminho.includes("constructor")) {
      return false;
    }
    return lerCaminhoNoObjeto(configuracoesPadrao, caminho) !== undefined;
  }

  function escreverCaminhoNoObjeto(objeto, caminho, valor) {
    const partes = caminho.split(".");
    const propriedade = partes.pop();
    const destino = partes.reduce((atual, parte) => atual[parte], objeto);
    destino[propriedade] = valor;
  }

  /*
   * A normalização aceita somente campos conhecidos. Além de impedir que um
   * arquivo antigo ou corrompido quebre a interface, isso faz a fronteira do
   * renderer coincidir com a validação realizada novamente no processo main.
   */
  function normalizarConfiguracoes(entrada = {}) {
    const padrao = configuracoesPadrao;
    const origem = entrada && typeof entrada === "object" ? entrada : {};
    const geral = origem.geral || {};
    const audio = origem.audio || {};
    const efeitos = audio.efeitos || {};
    const ambiente = audio.ambiente || {};
    const musica = audio.musica || {};
    const ducking = audio.ducking || {};
    const aparencia = origem.aparencia || {};
    const temaAutomatico = aparencia.temaAutomatico || {};
    const estacao = origem.estacao || {};
    const interfaceUsuario = origem.interface || {};
    const horta = origem.horta || {};
    const acessibilidade = origem.acessibilidade || {};

    return {
      versaoEsquema: padrao.versaoEsquema,
      geral: {
        nomeSistema: normalizarTexto(
          geral.nomeSistema,
          padrao.geral.nomeSistema,
          80,
        ),
        perfilSistema: normalizarOpcao(
          geral.perfilSistema,
          Object.keys(perfisSistema),
          padrao.geral.perfilSistema,
        ),
      },
      audio: {
        somGeralAtivo: normalizarBooleano(
          audio.somGeralAtivo,
          padrao.audio.somGeralAtivo,
        ),
        efeitos: {
          ativo: normalizarBooleano(efeitos.ativo, padrao.audio.efeitos.ativo),
          volume: normalizarNumero(efeitos.volume, padrao.audio.efeitos.volume, 0, 1),
        },
        ambiente: {
          ativo: normalizarBooleano(ambiente.ativo, padrao.audio.ambiente.ativo),
          volume: normalizarNumero(ambiente.volume, padrao.audio.ambiente.volume, 0, 1),
        },
        musica: {
          ativo: normalizarBooleano(musica.ativo, padrao.audio.musica.ativo),
          volume: normalizarNumero(musica.volume, padrao.audio.musica.volume, 0, 1),
        },
        perfil: normalizarOpcao(
          audio.perfil,
          Object.keys(perfisAudio),
          padrao.audio.perfil,
        ),
        ducking: {
          ativo: normalizarBooleano(ducking.ativo, padrao.audio.ducking.ativo),
          nivel: normalizarNumero(ducking.nivel, padrao.audio.ducking.nivel, 0.1, 1),
          retornoMs: Math.round(normalizarNumero(
            ducking.retornoMs,
            padrao.audio.ducking.retornoMs,
            80,
            3000,
          )),
        },
      },
      aparencia: {
        modoCor: normalizarOpcao(
          aparencia.modoCor,
          ["sistema", "cultivo", "escuro", "claro"],
          padrao.aparencia.modoCor,
        ),
        atmosfera: normalizarOpcao(
          aparencia.atmosfera,
          ["natural", "noturno", "tecno", "neutro", "personalizado"],
          padrao.aparencia.atmosfera,
        ),
        corDestaque: normalizarOpcao(
          aparencia.corDestaque,
          ["cultivo", "azul", "roxo", "ambar", "ciano", "rosa", "personalizada"],
          padrao.aparencia.corDestaque,
        ),
        corPersonalizada: normalizarCor(
          aparencia.corPersonalizada,
          padrao.aparencia.corPersonalizada,
        ),
        intensidadeVisual: normalizarOpcao(
          aparencia.intensidadeVisual,
          ["sutil", "normal", "vibrante"],
          padrao.aparencia.intensidadeVisual,
        ),
        temaAutomatico: {
          ativo: normalizarBooleano(
            temaAutomatico.ativo,
            padrao.aparencia.temaAutomatico.ativo,
          ),
          inicio: normalizarHorario(
            temaAutomatico.inicio,
            padrao.aparencia.temaAutomatico.inicio,
          ),
          fim: normalizarHorario(
            temaAutomatico.fim,
            padrao.aparencia.temaAutomatico.fim,
          ),
        },
      },
      estacao: {
        pastaBiblioteca: normalizarTextoNulo(estacao.pastaBiblioteca, 4096),
        autoplayInicializacao: normalizarBooleano(
          estacao.autoplayInicializacao,
          padrao.estacao.autoplayInicializacao,
        ),
        musicasInicializacao: normalizarListaTextos(
          estacao.musicasInicializacao,
          10000,
        ),
        aleatorio: normalizarBooleano(
          estacao.aleatorio,
          padrao.estacao.aleatorio,
        ),
        repeticao: normalizarOpcao(
          estacao.repeticao,
          ["desativada", "faixa", "biblioteca"],
          padrao.estacao.repeticao,
        ),
        retomarSessao: normalizarBooleano(
          estacao.retomarSessao,
          padrao.estacao.retomarSessao,
        ),
        retomarPosicao: normalizarBooleano(
          estacao.retomarPosicao,
          padrao.estacao.retomarPosicao,
        ),
        mostrarMiniPlayer: normalizarBooleano(
          estacao.mostrarMiniPlayer,
          padrao.estacao.mostrarMiniPlayer,
        ),
        mostrarVisualizador: normalizarBooleano(
          estacao.mostrarVisualizador,
          padrao.estacao.mostrarVisualizador,
        ),
        modoImersivo: normalizarBooleano(
          estacao.modoImersivo,
          padrao.estacao.modoImersivo,
        ),
        musicaSilenciada: normalizarBooleano(
          estacao.musicaSilenciada,
          padrao.estacao.musicaSilenciada,
        ),
        favoritas: normalizarListaTextos(estacao.favoritas, 10000),
        recentes: normalizarListaTextos(estacao.recentes, 50),
        fila: normalizarListaTextos(estacao.fila, 2000),
        ultimaFaixaId: normalizarIdentificadorNulo(estacao.ultimaFaixaId),
        posicao: normalizarNumero(
          estacao.posicao,
          padrao.estacao.posicao,
          0,
          60 * 60 * 24 * 30,
        ),
      },
      interface: {
        animacoesAtivas: normalizarBooleano(
          interfaceUsuario.animacoesAtivas,
          padrao.interface.animacoesAtivas,
        ),
        intensidadeAnimacoes: normalizarOpcao(
          interfaceUsuario.intensidadeAnimacoes,
          ["reduzida", "normal", "alta"],
          padrao.interface.intensidadeAnimacoes,
        ),
        efeitosFundoAtivos: normalizarBooleano(
          interfaceUsuario.efeitosFundoAtivos,
          padrao.interface.efeitosFundoAtivos,
        ),
        microinteracoesAtivas: normalizarBooleano(
          interfaceUsuario.microinteracoesAtivas,
          padrao.interface.microinteracoesAtivas,
        ),
        visualizadorMusicaAtivo: normalizarBooleano(
          interfaceUsuario.visualizadorMusicaAtivo,
          padrao.interface.visualizadorMusicaAtivo,
        ),
        indicadorNovaLeituraAtivo: normalizarBooleano(
          interfaceUsuario.indicadorNovaLeituraAtivo,
          padrao.interface.indicadorNovaLeituraAtivo,
        ),
        modoFoco: normalizarBooleano(
          interfaceUsuario.modoFoco,
          padrao.interface.modoFoco,
        ),
        modoApresentacao: normalizarBooleano(
          interfaceUsuario.modoApresentacao,
          padrao.interface.modoApresentacao,
        ),
        modoAmbienteMinutos: normalizarOpcao(
          Number(interfaceUsuario.modoAmbienteMinutos),
          [0, 2, 5, 10, 20],
          padrao.interface.modoAmbienteMinutos,
        ),
      },
      horta: {
        nomePlanta: normalizarTexto(
          horta.nomePlanta,
          padrao.horta.nomePlanta,
          80,
          true,
        ),
        limiteUmidadeMinima: normalizarNumero(
          horta.limiteUmidadeMinima,
          padrao.horta.limiteUmidadeMinima,
          0,
          100,
        ),
        limiteUmidadeMaxima: normalizarNumero(
          horta.limiteUmidadeMaxima,
          padrao.horta.limiteUmidadeMaxima,
          0,
          100,
        ),
        horarioIluminacaoInicio: normalizarHorario(
          horta.horarioIluminacaoInicio,
          padrao.horta.horarioIluminacaoInicio,
        ),
        horarioIluminacaoFim: normalizarHorario(
          horta.horarioIluminacaoFim,
          padrao.horta.horarioIluminacaoFim,
        ),
        modoAutomatico: normalizarBooleano(
          horta.modoAutomatico,
          padrao.horta.modoAutomatico,
        ),
      },
      acessibilidade: {
        reduzirMovimentos: normalizarBooleano(
          acessibilidade.reduzirMovimentos,
          padrao.acessibilidade.reduzirMovimentos,
        ),
        altoContraste: normalizarBooleano(
          acessibilidade.altoContraste,
          padrao.acessibilidade.altoContraste,
        ),
        aumentarTextos: normalizarBooleano(
          acessibilidade.aumentarTextos,
          padrao.acessibilidade.aumentarTextos,
        ),
        desativarTransparencias: normalizarBooleano(
          acessibilidade.desativarTransparencias,
          padrao.acessibilidade.desativarTransparencias,
        ),
        semVisualizador: normalizarBooleano(
          acessibilidade.semVisualizador,
          padrao.acessibilidade.semVisualizador,
        ),
        silenciarTudo: normalizarBooleano(
          acessibilidade.silenciarTudo,
          padrao.acessibilidade.silenciarTudo,
        ),
      },
    };
  }

  function obter(caminho = "", valorAlternativo) {
    const valor = lerCaminhoNoObjeto(estadoConfiguracoes, caminho);
    if (valor === undefined) return valorAlternativo;
    return valor && typeof valor === "object" ? clonar(valor) : valor;
  }

  function obterTudo() {
    return clonar(estadoConfiguracoes);
  }

  function caminhosRelacionados(caminhoAssinado, caminhosAlterados) {
    if (!caminhoAssinado) return true;
    return caminhosAlterados.some((caminho) => (
      caminho === caminhoAssinado
      || caminho.startsWith(`${caminhoAssinado}.`)
      || caminhoAssinado.startsWith(`${caminho}.`)
    ));
  }

  function emitirAlteracoes(caminhos, origem) {
    const detalhe = {
      configuracoes: obterTudo(),
      caminhos: [...new Set(caminhos)],
      origem,
    };

    assinantes.forEach((assinante) => {
      if (!caminhosRelacionados(assinante.caminho, detalhe.caminhos)) return;
      try {
        assinante.callback(obter(assinante.caminho), detalhe);
      } catch (erroAssinante) {
        console.error("[Horta Inteligente] Falha em observador de configurações.", erroAssinante);
      }
    });

    document.dispatchEvent(new CustomEvent("configuracoesalteradas", { detail: detalhe }));
  }

  function removerPreferenciasLegadas() {
    try {
      chavesAudioLegado.forEach((chave) => escopoAplicacao.localStorage.removeItem(chave));
    } catch (erroArmazenamento) {
      // A nova configuração já foi salva; a chave antiga pode ser ignorada.
    }
  }

  function lerPreferenciaAudioLegada() {
    try {
      for (const chave of chavesAudioLegado) {
        const valor = escopoAplicacao.localStorage.getItem(chave);
        if (valor === "true" || valor === "false") return valor === "true";
      }
    } catch (erroArmazenamento) {
      // Ambientes que bloqueiam armazenamento apenas usam os valores padrão.
    }
    return null;
  }

  async function persistirCaptura(captura, versaoCaptura) {
    if (possuiPonteElectron) {
      const resposta = await ponteConfiguracoes.salvar(captura);

      // A resposta do main pode conter campos protegidos, como a pasta escolhida
      // pelo diálogo. Ela só substitui o estado se nada mudou durante o IPC.
      if (resposta && versaoCaptura === versaoEstado) {
        const estadoNormalizado = normalizarConfiguracoes(
          resposta.configuracoes ?? resposta,
        );
        if (JSON.stringify(estadoNormalizado) !== JSON.stringify(estadoConfiguracoes)) {
          estadoConfiguracoes = estadoNormalizado;
          versaoEstado += 1;
          emitirAlteracoes([""], "processo-principal");
        }
      }
      return true;
    }

    if (!executandoNoElectron) {
      escopoAplicacao.localStorage.setItem(
        chaveArmazenamentoNavegador,
        JSON.stringify(captura),
      );
      return true;
    }

    console.warn(
      "[Horta Inteligente] A ponte de configurações não está disponível; "
      + "as escolhas desta sessão não serão persistidas.",
    );
    return false;
  }

  function persistirAgora() {
    if (temporizadorPersistencia !== null) {
      escopoAplicacao.clearTimeout(temporizadorPersistencia);
      temporizadorPersistencia = null;
    }

    const captura = obterTudo();
    const versaoCaptura = versaoEstado;
    salvamentoEmFila = salvamentoEmFila
      .catch(() => {})
      .then(() => persistirCaptura(captura, versaoCaptura))
      .then((persistiu) => {
        if (!persistiu || !migracaoAudioPendente) return;
        migracaoAudioPendente = false;
        removerPreferenciasLegadas();
      })
      .catch((erroPersistencia) => {
        console.warn(
          "[Horta Inteligente] Não foi possível salvar as configurações.",
          erroPersistencia,
        );
      });

    return salvamentoEmFila;
  }

  function agendarPersistencia() {
    if (temporizadorPersistencia !== null) {
      escopoAplicacao.clearTimeout(temporizadorPersistencia);
    }
    temporizadorPersistencia = escopoAplicacao.setTimeout(
      persistirAgora,
      atrasoPersistencia,
    );
  }

  function aplicarAlteracoes(alteracoes, origem = "usuario", marcarPersonalizado = true) {
    if (!alteracoes || typeof alteracoes !== "object" || Array.isArray(alteracoes)) {
      return obterTudo();
    }

    const candidato = obterTudo();
    const caminhosSolicitados = [];

    Object.entries(alteracoes).forEach(([caminho, valor]) => {
      if (!caminhoExisteNoPadrao(caminho)) {
        console.warn(`[Horta Inteligente] Configuração desconhecida ignorada: ${caminho}`);
        return;
      }
      escreverCaminhoNoObjeto(candidato, caminho, clonar(valor));
      caminhosSolicitados.push(caminho);
    });

    let normalizado = normalizarConfiguracoes(candidato);
    const personalizouAudio = marcarPersonalizado
      && caminhosSolicitados.some((caminho) => (
        caminho.startsWith("audio.")
        && caminho !== "audio.somGeralAtivo"
        && caminho !== "audio.perfil"
        && JSON.stringify(lerCaminhoNoObjeto(estadoConfiguracoes, caminho))
          !== JSON.stringify(lerCaminhoNoObjeto(normalizado, caminho))
      ));
    if (personalizouAudio && !caminhosSolicitados.includes("audio.perfil")) {
      candidato.audio.perfil = "personalizado";
      caminhosSolicitados.push("audio.perfil");
      normalizado = normalizarConfiguracoes(candidato);
    }
    const caminhosAlterados = caminhosSolicitados.filter((caminho) => (
      JSON.stringify(lerCaminhoNoObjeto(estadoConfiguracoes, caminho))
      !== JSON.stringify(lerCaminhoNoObjeto(normalizado, caminho))
    ));

    if (!caminhosAlterados.length) return obterTudo();
    estadoConfiguracoes = normalizado;
    versaoEstado += 1;
    emitirAlteracoes(caminhosAlterados, origem);
    agendarPersistencia();
    return obterTudo();
  }

  function alterar(caminho, valor) {
    return aplicarAlteracoes({ [caminho]: valor }, "usuario", true);
  }

  function alterarLote(alteracoes) {
    return aplicarAlteracoes(alteracoes, "usuario", true);
  }

  function assinar(caminho, callback) {
    if (typeof callback !== "function") return () => {};
    const caminhoSeguro = typeof caminho === "string" ? caminho : "";
    const assinante = { caminho: caminhoSeguro, callback };
    assinantes.add(assinante);

    try {
      callback(obter(caminhoSeguro), {
        configuracoes: obterTudo(),
        caminhos: [],
        origem: "assinatura",
        pronto: configuracoesCarregadas,
      });
    } catch (erroAssinante) {
      console.error("[Horta Inteligente] Falha em observador de configurações.", erroAssinante);
    }

    return () => assinantes.delete(assinante);
  }

  function aplicarPerfilAudio(nome) {
    const perfil = perfisAudio[nome];
    if (!perfil) return obterTudo();
    return aplicarAlteracoes(perfil, `perfil-audio:${nome}`, false);
  }

  function aplicarPerfilSistema(nome) {
    const perfil = perfisSistema[nome];
    if (!perfil) return obterTudo();
    return aplicarAlteracoes(perfil, `perfil-sistema:${nome}`, false);
  }

  function restaurarSecao(nome) {
    if (!Object.prototype.hasOwnProperty.call(configuracoesPadrao, nome)) {
      return obterTudo();
    }
    if (nome === "versaoEsquema") return obterTudo();
    return aplicarAlteracoes(
      { [nome]: clonar(configuracoesPadrao[nome]) },
      `restauracao:${nome}`,
      false,
    );
  }

  /**
   * Restaura preferências visuais e comportamentais sem tocar na biblioteca,
   * favoritos, histórico de reprodução ou parâmetros do circuito. Esses itens
   * são dados pessoais/operacionais e não devem desaparecer em um reset visual.
   */
  async function redefinirAjustes() {
    const estacaoAtual = estadoConfiguracoes.estacao;
    const estacaoPadrao = clonar(configuracoesPadrao.estacao);
    [
      "pastaBiblioteca",
      "favoritas",
      "recentes",
      "fila",
      "ultimaFaixaId",
      "posicao",
    ].forEach((chave) => {
      estacaoPadrao[chave] = clonar(estacaoAtual[chave]);
    });

    aplicarAlteracoes({
      geral: clonar(configuracoesPadrao.geral),
      audio: clonar(configuracoesPadrao.audio),
      aparencia: clonar(configuracoesPadrao.aparencia),
      estacao: estacaoPadrao,
      interface: clonar(configuracoesPadrao.interface),
      acessibilidade: clonar(configuracoesPadrao.acessibilidade),
    }, "redefinicao-ajustes", false);

    await persistirAgora();
    return obterTudo();
  }

  async function carregarOrigem() {
    if (possuiPonteElectron) {
      const resposta = await ponteConfiguracoes.carregar();
      return resposta?.configuracoes ?? resposta ?? {};
    }

    if (!executandoNoElectron) {
      try {
        const armazenado = escopoAplicacao.localStorage.getItem(
          chaveArmazenamentoNavegador,
        );
        return armazenado ? JSON.parse(armazenado) : {};
      } catch (erroArmazenamento) {
        console.warn(
          "[Horta Inteligente] As configurações locais não puderam ser lidas.",
          erroArmazenamento,
        );
      }
    }

    return {};
  }

  async function inicializarConfiguracoes() {
    let origem = {};
    try {
      origem = await carregarOrigem();
    } catch (erroCarregamento) {
      console.warn(
        "[Horta Inteligente] Não foi possível carregar as configurações.",
        erroCarregamento,
      );
    }

    estadoConfiguracoes = normalizarConfiguracoes(origem);

    // A versão anterior guardava somente o mute em chaves isoladas. Quando
    // alguma delas existir, sua escolha é incorporada e removida depois que o
    // novo documento central for salvo com sucesso.
    const preferenciaLegada = lerPreferenciaAudioLegada();
    if (preferenciaLegada !== null) {
      estadoConfiguracoes.audio.somGeralAtivo = preferenciaLegada;
      migracaoAudioPendente = true;
      versaoEstado += 1;
    }

    configuracoesCarregadas = true;
    const detalhe = { configuracoes: obterTudo() };
    document.dispatchEvent(new CustomEvent("configuracoesprontas", { detail: detalhe }));
    emitirAlteracoes([""], "carregamento");

    if (migracaoAudioPendente) await persistirAgora();
    return obterTudo();
  }

  const pronto = inicializarConfiguracoes();
  const apiConfiguracoes = Object.freeze({
    pronto,
    obter,
    obterTudo,
    alterar,
    alterarLote,
    assinar,
    aplicarPerfilAudio,
    aplicarPerfilSistema,
    restaurarSecao,
    redefinirAjustes,
    salvarAgora: persistirAgora,
  });

  const hortaInteligente = escopoAplicacao.HortaInteligente ?? {};
  hortaInteligente.configuracoes = apiConfiguracoes;
  escopoAplicacao.HortaInteligente = hortaInteligente;

  escopoAplicacao.addEventListener("pagehide", persistirAgora);
})(window);
