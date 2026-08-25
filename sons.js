/*
 * Identidade sonora global da Horta Inteligente.
 *
 * Os efeitos são sintetizados localmente com a Web Audio API; a Estação entra
 * no mesmo grafo por um elemento de mídia. A interface publica apenas eventos
 * semânticos, e a futura fonte Serial não precisará conhecer síntese, volumes
 * nem a técnica de ducking.
 */
(function prepararSistemaSonoro(escopoAplicacao) {
  "use strict";

  const telaInicializacao = document.querySelector("#tela-inicializacao");
  const ConstrutorContextoAudio =
    escopoAplicacao.AudioContext || escopoAplicacao.webkitAudioContext;
  const prefereMovimentoReduzido = escopoAplicacao.matchMedia(
    "(prefers-reduced-motion: reduce)",
  );

  // Esta é a calibração técnica dos timbres. Os volumes escolhidos pelo
  // usuário vivem em `configuracoes.js` e multiplicam estes valores em runtime.
  const configuracaoAudio = Object.freeze({
    volumeMestre: 0.78,
    volumeInterface: 0.43,
    volumeAtuadores: 0.46,
    volumeAmbiente: 0.14,
    volumeMusica: 0.92,
    volumeReverberacao: 0.13,
    limiteFontes: 48,
  });

  const configuracaoAmbiente = Object.freeze({
    iniciando: { volume: 0.52, filtro: 760, pulso: 0.155, base: 98 },
    aguardando: { volume: 0.74, filtro: 980, pulso: 0.18, base: 100 },
    sincronizando: { volume: 0.88, filtro: 1450, pulso: 0.27, base: 104 },
    conectado: { volume: 0.36, filtro: 1900, pulso: 0.13, base: 108 },
    erro: { volume: 0.42, filtro: 560, pulso: 0.1, base: 92 },
  });

  const estadoAudioUsuario = {
    somGeralAtivo: true,
    efeitosAtivos: true,
    volumeEfeitos: 1,
    ambienteAtivo: true,
    volumeAmbiente: 1,
    musicaAtiva: true,
    volumeMusica: 0.72,
    duckingAtivo: true,
    nivelDucking: 0.8,
    retornoDuckingMs: 380,
    silencioAcessibilidade: false,
  };

  let somAtivado = true;
  let contextoAudio = null;
  let nosAudio = {};
  let sistemaIniciado = false;
  let sistemaEncerrado = false;
  let ambienteCriado = false;
  let introducaoEncerrada = Boolean(
    telaInicializacao?.hidden || document.body.classList.contains("painel-visivel"),
  );
  let estadoInicializacao = telaInicializacao?.dataset.estado || "iniciando";
  let temporizadorParticula = null;
  let temporizadorSuspensao = null;
  let desbloqueioRegistrado = false;
  let geracaoOperacao = 0;
  let ultimoErro = "";
  let erroJaInformado = false;
  let ultimoAlertaEm = 0;
  const instanteUltimoEfeito = new Map();
  let ladoNavegacao = -1;
  let musicaEmReproducao = false;
  let elementoMusicaPrincipal = null;
  let temporizadorParadaAmbiente = null;
  let temporizadorDucking = null;
  let geracaoDucking = 0;
  let removerAssinaturaAudio = null;
  let removerAssinaturaAcessibilidade = null;
  let fontesMusicaPorElemento = new WeakMap();
  let promessasConexaoPorElemento = new WeakMap();
  const fontesAtivas = new Set();
  const fontesAmbiente = new Set();
  const elementosMusicaConectados = new Set();

  function informarErro(erro, contexto) {
    ultimoErro = `${contexto}: ${erro?.message || String(erro)}`;
    if (!erroJaInformado) {
      console.warn("[Horta Inteligente] O sistema de som encontrou um problema.", erro);
      erroJaInformado = true;
    }
    atualizarControlesSom();
  }

  function limitarVolume(valor, padrao = 1) {
    const numero = Number(valor);
    if (!Number.isFinite(numero)) return padrao;
    return Math.min(1, Math.max(0, numero));
  }

  function obterConfiguracoesCentrais() {
    return escopoAplicacao.HortaInteligente?.configuracoes || null;
  }

  function ambienteDeveFicarSilencioso() {
    return Boolean(
      musicaEmReproducao
      && estadoAudioUsuario.musicaAtiva
      && estadoAudioUsuario.volumeMusica > 0,
    );
  }

  function calcularVolumeAmbiente(estado = estadoInicializacao) {
    const configuracaoEstado = configuracaoAmbiente[estado];
    if (
      !configuracaoEstado
      || !estadoAudioUsuario.ambienteAtivo
      || ambienteDeveFicarSilencioso()
    ) {
      return 0;
    }

    return configuracaoEstado.volume
      * configuracaoAudio.volumeAmbiente
      * estadoAudioUsuario.volumeAmbiente;
  }

  function textoDoControle(controle, ligado) {
    const estaNaIntroducao = controle.classList.contains("botao-som-inicializacao");
    if (estaNaIntroducao) return ligado ? "SOM LIGADO" : "SOM DESLIGADO";
    return ligado ? "Som ligado" : "Som desligado";
  }

  function atualizarControlesSom() {
    document.querySelectorAll("[data-controle-som]").forEach((controle) => {
      const texto = controle.querySelector("[data-texto-som]");

      if (!ConstrutorContextoAudio) {
        controle.disabled = true;
        controle.setAttribute("aria-pressed", "false");
        controle.setAttribute("aria-label", "Som indisponível neste dispositivo");
        controle.title = "Som indisponível neste dispositivo";
        controle.dataset.situacaoSom = "indisponivel";
        if (texto) texto.textContent = textoDoControle(controle, false);
        return;
      }

      controle.disabled = false;
      const aguardandoAtivacao = somAtivado && contextoAudio?.state !== "running";
      controle.setAttribute("aria-pressed", String(somAtivado));
      controle.setAttribute(
        "aria-label",
        aguardandoAtivacao
          ? "Som ligado, aguardando ativação"
          : somAtivado ? "Som do aplicativo ligado" : "Som do aplicativo desligado",
      );
      controle.title = aguardandoAtivacao
        ? "Ativar saída de som"
        : somAtivado ? "Desativar todos os sons" : "Ativar todos os sons";
      controle.dataset.situacaoSom = !somAtivado
        ? "desativado"
        : contextoAudio?.state === "running" ? "ativo" : "aguardando-interacao";
      if (texto) texto.textContent = textoDoControle(controle, somAtivado);
    });
  }

  function animarParametro(parametro, valorFinal, duracao = 0.12) {
    if (!contextoAudio || !parametro) return;
    const agora = contextoAudio.currentTime;

    if (typeof parametro.cancelAndHoldAtTime === "function") {
      parametro.cancelAndHoldAtTime(agora);
    } else {
      const valorAtual = parametro.value;
      parametro.cancelScheduledValues(agora);
      parametro.setValueAtTime(valorAtual, agora);
    }

    if (duracao <= 0) {
      parametro.setValueAtTime(valorFinal, agora);
    } else {
      parametro.linearRampToValueAtTime(valorFinal, agora + duracao);
    }
  }

  function cancelarParadaAmbiente() {
    if (temporizadorParadaAmbiente === null) return;
    escopoAplicacao.clearTimeout(temporizadorParadaAmbiente);
    temporizadorParadaAmbiente = null;
  }

  function silenciarAmbienteComFade(duracao = 0.35) {
    limparParticulasAmbiente();
    if (nosAudio.ambiente) animarParametro(nosAudio.ambiente.gain, 0, duracao);
    cancelarParadaAmbiente();
    temporizadorParadaAmbiente = escopoAplicacao.setTimeout(() => {
      temporizadorParadaAmbiente = null;
      pararFontesDoAmbiente();
    }, Math.max(40, duracao * 1000 + 45));
  }

  function atualizarGanhosDasCategorias(duracao = 0.16) {
    if (!contextoAudio) return;

    animarParametro(
      nosAudio.efeitos?.gain,
      estadoAudioUsuario.efeitosAtivos ? estadoAudioUsuario.volumeEfeitos : 0,
      duracao,
    );
    animarParametro(
      nosAudio.musica?.gain,
      estadoAudioUsuario.musicaAtiva
        ? estadoAudioUsuario.volumeMusica * configuracaoAudio.volumeMusica
        : 0,
      duracao,
    );
    if (!estadoAudioUsuario.duckingAtivo && nosAudio.duckingMusica) {
      geracaoDucking += 1;
      if (temporizadorDucking !== null) {
        escopoAplicacao.clearTimeout(temporizadorDucking);
        temporizadorDucking = null;
      }
      animarParametro(nosAudio.duckingMusica.gain, 1, duracao);
    }

    if (ambienteCriado) {
      animarParametro(
        nosAudio.ambiente?.gain,
        calcularVolumeAmbiente(),
        duracao,
      );
    }

    if (
      ambienteCriado
      && (!estadoAudioUsuario.ambienteAtivo || ambienteDeveFicarSilencioso())
    ) {
      silenciarAmbienteComFade(Math.max(0.12, duracao));
    } else if (
      estadoAudioUsuario.ambienteAtivo
      && !ambienteDeveFicarSilencioso()
      && !introducaoEncerrada
      && !document.hidden
      && somAtivado
    ) {
      cancelarParadaAmbiente();
      iniciarAmbiente().catch((erroAudio) => informarErro(erroAudio, "retomada do ambiente"));
    }
  }

  function criarBufferAr(contexto) {
    const duracao = 7.2;
    const buffer = contexto.createBuffer(2, contexto.sampleRate * duracao, contexto.sampleRate);

    for (let canal = 0; canal < buffer.numberOfChannels; canal += 1) {
      const amostras = buffer.getChannelData(canal);
      let memoria = 0;
      for (let indice = 0; indice < amostras.length; indice += 1) {
        const branco = Math.random() * 2 - 1;
        memoria = memoria * 0.72 + branco * 0.28;
        amostras[indice] = memoria * 0.72 + branco * 0.18;
      }

      // Iguala os extremos do ruído de forma distribuída. O loop fica mais longo
      // e não produz um pequeno clique ao voltar para a primeira amostra.
      const diferencaExtremos = amostras.at(-1) - amostras[0];
      for (let indice = 1; indice < amostras.length; indice += 1) {
        const progresso = indice / (amostras.length - 1);
        amostras[indice] -= diferencaExtremos * progresso;
      }
    }

    return buffer;
  }

  // A reverberação curta dá profundidade sem depender de arquivos de áudio.
  // Os agudos desaparecem progressivamente para a cauda não soar metálica.
  function criarImpulsoReverberacao(contexto) {
    const duracao = prefereMovimentoReduzido.matches ? 0.36 : 0.52;
    const comprimento = Math.floor(contexto.sampleRate * duracao);
    const impulso = contexto.createBuffer(2, comprimento, contexto.sampleRate);

    for (let canal = 0; canal < 2; canal += 1) {
      const amostras = impulso.getChannelData(canal);
      let memoria = 0;
      for (let indice = 0; indice < comprimento; indice += 1) {
        const progresso = indice / comprimento;
        const ruido = Math.random() * 2 - 1;
        memoria = memoria * 0.36 + ruido * 0.64;
        const envoltoria = (1 - progresso) ** 3.4;
        amostras[indice] = memoria * envoltoria * (canal === 0 ? 0.82 : 0.78);
      }
    }

    return impulso;
  }

  function criarPanorama(valorInicial = 0, valorFinal = valorInicial, inicio = 0, fim = 0) {
    if (typeof contextoAudio.createStereoPanner === "function") {
      const panorama = contextoAudio.createStereoPanner();
      panorama.pan.setValueAtTime(valorInicial, inicio);
      if (fim > inicio && valorFinal !== valorInicial) {
        panorama.pan.linearRampToValueAtTime(valorFinal, fim);
      }
      return panorama;
    }

    // Navegadores antigos continuam em mono sem perder nenhuma interação.
    return contextoAudio.createGain();
  }

  function criarGrafoAudio() {
    if (!ConstrutorContextoAudio || sistemaEncerrado) return null;
    if (contextoAudio?.state === "closed") {
      contextoAudio = null;
      nosAudio = {};
      ambienteCriado = false;
    }
    if (contextoAudio) return contextoAudio;

    let contextoParcial = null;
    try {
      try {
        contextoParcial = new ConstrutorContextoAudio({ latencyHint: "interactive" });
      } catch (erroConfiguracao) {
        contextoParcial = new ConstrutorContextoAudio();
      }
      contextoAudio = contextoParcial;

      const agora = contextoAudio.currentTime;
      nosAudio.mestre = contextoAudio.createGain();
      nosAudio.interface = contextoAudio.createGain();
      nosAudio.atuadores = contextoAudio.createGain();
      nosAudio.efeitos = contextoAudio.createGain();
      nosAudio.ambiente = contextoAudio.createGain();
      nosAudio.compressor = contextoAudio.createDynamicsCompressor();
      nosAudio.limitador = contextoAudio.createDynamicsCompressor();
      nosAudio.analisador = contextoAudio.createAnalyser();
      nosAudio.analisadorMusica = contextoAudio.createAnalyser();
      nosAudio.musica = contextoAudio.createGain();
      nosAudio.duckingMusica = contextoAudio.createGain();
      nosAudio.reverberadorEfeitos = contextoAudio.createConvolver();
      nosAudio.retornoReverberacaoEfeitos = contextoAudio.createGain();
      nosAudio.reverberadorAmbiente = contextoAudio.createConvolver();
      nosAudio.retornoReverberacaoAmbiente = contextoAudio.createGain();
      nosAudio.bufferAr = criarBufferAr(contextoAudio);

      nosAudio.mestre.gain.setValueAtTime(0, agora);
      nosAudio.interface.gain.setValueAtTime(configuracaoAudio.volumeInterface, agora);
      nosAudio.atuadores.gain.setValueAtTime(configuracaoAudio.volumeAtuadores, agora);
      nosAudio.efeitos.gain.setValueAtTime(
        estadoAudioUsuario.efeitosAtivos ? estadoAudioUsuario.volumeEfeitos : 0,
        agora,
      );
      nosAudio.ambiente.gain.setValueAtTime(0, agora);
      nosAudio.musica.gain.setValueAtTime(
        estadoAudioUsuario.musicaAtiva
          ? estadoAudioUsuario.volumeMusica * configuracaoAudio.volumeMusica
          : 0,
        agora,
      );
      nosAudio.duckingMusica.gain.setValueAtTime(1, agora);
      nosAudio.retornoReverberacaoEfeitos.gain.setValueAtTime(
        configuracaoAudio.volumeReverberacao,
        agora,
      );
      nosAudio.retornoReverberacaoAmbiente.gain.setValueAtTime(
        configuracaoAudio.volumeReverberacao * 0.72,
        agora,
      );
      const impulsoReverberacao = criarImpulsoReverberacao(contextoAudio);
      nosAudio.reverberadorEfeitos.buffer = impulsoReverberacao;
      nosAudio.reverberadorAmbiente.buffer = impulsoReverberacao;
      nosAudio.compressor.threshold.setValueAtTime(-15, agora);
      nosAudio.compressor.knee.setValueAtTime(9, agora);
      nosAudio.compressor.ratio.setValueAtTime(7, agora);
      nosAudio.compressor.attack.setValueAtTime(0.004, agora);
      nosAudio.compressor.release.setValueAtTime(0.16, agora);
      nosAudio.limitador.threshold.setValueAtTime(-2, agora);
      nosAudio.limitador.knee.setValueAtTime(1, agora);
      nosAudio.limitador.ratio.setValueAtTime(16, agora);
      nosAudio.limitador.attack.setValueAtTime(0.003, agora);
      nosAudio.limitador.release.setValueAtTime(0.12, agora);
      nosAudio.analisador.fftSize = 1024;
      nosAudio.analisador.smoothingTimeConstant = 0.22;
      nosAudio.analisadorMusica.fftSize = 1024;
      nosAudio.analisadorMusica.smoothingTimeConstant = 0.78;

      nosAudio.interface.connect(nosAudio.efeitos);
      nosAudio.atuadores.connect(nosAudio.efeitos);
      nosAudio.efeitos.connect(nosAudio.compressor);
      nosAudio.ambiente.connect(nosAudio.compressor);
      nosAudio.reverberadorEfeitos.connect(nosAudio.retornoReverberacaoEfeitos);
      nosAudio.retornoReverberacaoEfeitos.connect(nosAudio.efeitos);
      nosAudio.reverberadorAmbiente.connect(nosAudio.retornoReverberacaoAmbiente);
      nosAudio.retornoReverberacaoAmbiente.connect(nosAudio.ambiente);
      nosAudio.compressor.connect(nosAudio.mestre);
      nosAudio.analisadorMusica.connect(nosAudio.musica);
      nosAudio.musica.connect(nosAudio.duckingMusica);
      nosAudio.duckingMusica.connect(nosAudio.mestre);
      nosAudio.mestre.connect(nosAudio.limitador);
      nosAudio.limitador.connect(nosAudio.analisador);
      nosAudio.analisador.connect(contextoAudio.destination);

      contextoAudio.onstatechange = atualizarControlesSom;
      return contextoAudio;
    } catch (erroAudio) {
      informarErro(erroAudio, "criação do grafo");
      if (contextoParcial?.state !== "closed") {
        contextoParcial.close().catch(() => {});
      }
      contextoAudio = null;
      nosAudio = {};
      return null;
    }
  }

  function removerDesbloqueioPorGesto() {
    if (!desbloqueioRegistrado) return;
    escopoAplicacao.removeEventListener("pointerdown", desbloquearPorGesto, true);
    escopoAplicacao.removeEventListener("keydown", desbloquearPorGesto, true);
    desbloqueioRegistrado = false;
  }

  function registrarDesbloqueioPorGesto() {
    if (desbloqueioRegistrado || sistemaEncerrado || !somAtivado) return;
    escopoAplicacao.addEventListener("pointerdown", desbloquearPorGesto, true);
    escopoAplicacao.addEventListener("keydown", desbloquearPorGesto, true);
    desbloqueioRegistrado = true;
  }

  function desbloquearPorGesto(evento) {
    if (evento.target instanceof Element && evento.target.closest("[data-controle-som]")) return;
    garantirContexto().then(() => iniciarAmbiente()).catch(() => {});
  }

  async function garantirContexto() {
    if (!somAtivado || sistemaEncerrado || !ConstrutorContextoAudio) return null;
    const contexto = criarGrafoAudio();
    if (!contexto) return null;

    if (document.hidden) {
      atualizarControlesSom();
      return contexto;
    }

    try {
      if (["suspended", "interrupted"].includes(contexto.state)) {
        await contexto.resume();
      }
      if (contexto !== contextoAudio || !somAtivado || sistemaEncerrado) return null;

      if (contexto.state === "running") {
        removerDesbloqueioPorGesto();
        animarParametro(nosAudio.mestre.gain, configuracaoAudio.volumeMestre, 0.08);
      } else {
        registrarDesbloqueioPorGesto();
      }
    } catch (erroAudio) {
      informarErro(erroAudio, "ativação do dispositivo de áudio");
      registrarDesbloqueioPorGesto();
    }

    atualizarControlesSom();
    return contexto.state === "running" ? contexto : null;
  }

  function conectarVoz(saida, barramento, panoramica, reverberacao, inicio, fim) {
    const panorama = criarPanorama(
      panoramica?.[0] ?? 0,
      panoramica?.[1] ?? panoramica?.[0] ?? 0,
      inicio,
      fim,
    );
    const envioReverberacao = contextoAudio.createGain();
    const reverberador = barramento === nosAudio.ambiente
      ? nosAudio.reverberadorAmbiente
      : nosAudio.reverberadorEfeitos;
    envioReverberacao.gain.setValueAtTime(reverberacao, inicio);
    saida.connect(panorama);
    panorama.connect(barramento);
    panorama.connect(envioReverberacao);
    envioReverberacao.connect(reverberador);
    return [panorama, envioReverberacao];
  }

  function registrarFonte(fonte, nosDaVoz = [], pertenceAoAmbiente = false) {
    fontesAtivas.add(fonte);
    if (pertenceAoAmbiente) fontesAmbiente.add(fonte);

    fonte.onended = () => {
      fontesAtivas.delete(fonte);
      fontesAmbiente.delete(fonte);
      try {
        fonte.disconnect();
        nosDaVoz.forEach((no) => no.disconnect());
      } catch (erroDesconexao) {
        // Os nós podem ter sido desconectados pelo encerramento da janela.
      }
    };
  }

  function podeCriarFonte() {
    return Boolean(
      contextoAudio?.state === "running"
      && somAtivado
      && !document.hidden
      && fontesAtivas.size < configuracaoAudio.limiteFontes,
    );
  }

  function criarOsciladorComEnvelope({
    frequenciaInicial,
    frequenciaFinal = frequenciaInicial,
    volume,
    duracao,
    atraso = 0,
    ataque = 0.018,
    tipo = "sine",
    barramento = nosAudio.interface,
    panoramica = [0, 0],
    reverberacao = 0.08,
    pertenceAoAmbiente = false,
    variacaoAfinacao = 0,
  }) {
    if (!podeCriarFonte()) return null;

    const inicio = contextoAudio.currentTime + atraso;
    const fim = inicio + duracao;
    const oscilador = contextoAudio.createOscillator();
    const ganho = contextoAudio.createGain();
    const frequenciaFimSegura = Math.max(1, frequenciaFinal);
    oscilador.type = tipo;
    oscilador.frequency.setValueAtTime(Math.max(1, frequenciaInicial), inicio);
    oscilador.frequency.exponentialRampToValueAtTime(frequenciaFimSegura, fim);
    oscilador.detune.setValueAtTime(variacaoAfinacao, inicio);

    ganho.gain.setValueAtTime(0.0001, inicio);
    ganho.gain.exponentialRampToValueAtTime(
      Math.max(0.0002, volume),
      inicio + Math.min(ataque, duracao * 0.42),
    );
    ganho.gain.exponentialRampToValueAtTime(0.0001, fim);
    oscilador.connect(ganho);
    const nosEspaciais = conectarVoz(
      ganho,
      barramento,
      panoramica,
      reverberacao,
      inicio,
      fim,
    );

    registrarFonte(oscilador, [ganho, ...nosEspaciais], pertenceAoAmbiente);
    oscilador.start(inicio);
    oscilador.stop(fim + 0.025);
    return oscilador;
  }

  function criarRuidoComEnvelope({
    volume,
    duracao,
    frequenciaInicial,
    frequenciaFinal = frequenciaInicial,
    atraso = 0,
    ataque = 0.03,
    tipoFiltro = "bandpass",
    qualidade = 0.72,
    barramento = nosAudio.interface,
    panoramica = [0, 0],
    reverberacao = 0.08,
    pertenceAoAmbiente = false,
  }) {
    if (!podeCriarFonte() || !nosAudio.bufferAr) return null;

    const inicio = contextoAudio.currentTime + atraso;
    const fim = inicio + duracao;
    const fonte = contextoAudio.createBufferSource();
    const filtro = contextoAudio.createBiquadFilter();
    const ganho = contextoAudio.createGain();
    fonte.buffer = nosAudio.bufferAr;
    filtro.type = tipoFiltro;
    filtro.Q.setValueAtTime(qualidade, inicio);
    filtro.frequency.setValueAtTime(frequenciaInicial, inicio);
    filtro.frequency.exponentialRampToValueAtTime(
      Math.max(20, frequenciaFinal),
      fim,
    );
    ganho.gain.setValueAtTime(0.0001, inicio);
    ganho.gain.exponentialRampToValueAtTime(
      Math.max(0.0002, volume),
      inicio + Math.min(ataque, duracao * 0.4),
    );
    ganho.gain.exponentialRampToValueAtTime(0.0001, fim);
    fonte.connect(filtro);
    filtro.connect(ganho);
    const nosEspaciais = conectarVoz(
      ganho,
      barramento,
      panoramica,
      reverberacao,
      inicio,
      fim,
    );
    registrarFonte(
      fonte,
      [filtro, ganho, ...nosEspaciais],
      pertenceAoAmbiente,
    );

    const limiteInicio = Math.max(0, nosAudio.bufferAr.duration - duracao - 0.05);
    fonte.start(inicio, Math.random() * limiteInicio);
    fonte.stop(fim + 0.025);
    return fonte;
  }

  /*
   * Material “vidro”: quatro modos levemente inarmônicos compartilham a mesma
   * raiz, mas cada parcial perde energia mais cedo. Isso evita o timbre de um
   * seno de teste e mantém todos os efeitos dentro da mesma família.
   */
  function criarCristal({
    base,
    baseFinal = base,
    volume,
    duracao,
    atraso = 0,
    barramento = nosAudio.interface,
    panoramica = [0, 0],
    reverberacao = 0.1,
  }) {
    const relacoes = [1, 1.61, 2.37, 3.91];
    const energias = [1, 0.38, 0.2, 0.09];
    const quantidade = prefereMovimentoReduzido.matches ? 3 : relacoes.length;

    relacoes.slice(0, quantidade).forEach((relacao, indice) => {
      criarOsciladorComEnvelope({
        frequenciaInicial: base * relacao,
        frequenciaFinal: baseFinal * relacao,
        volume: volume * energias[indice],
        duracao: duracao * (1 - indice * 0.09),
        atraso: atraso + indice * 0.004,
        ataque: 0.012 + indice * 0.004,
        tipo: indice === 0 ? "sine" : "triangle",
        barramento,
        panoramica,
        reverberacao,
        variacaoAfinacao: (Math.random() * 8 - 4),
      });
    });
  }

  // Pulso e grave incluem uma harmônica audível para continuarem presentes em
  // caixas pequenas, sem depender de subgrave que o notebook não reproduz.
  function criarPulso({
    base,
    baseFinal,
    volume,
    duracao,
    atraso = 0,
    barramento = nosAudio.interface,
    reverberacao = 0.04,
  }) {
    criarOsciladorComEnvelope({
      frequenciaInicial: base,
      frequenciaFinal: baseFinal,
      volume,
      duracao,
      atraso,
      ataque: Math.min(0.022, duracao * 0.24),
      tipo: "sine",
      barramento,
      reverberacao,
    });
    criarOsciladorComEnvelope({
      frequenciaInicial: base * 2.02,
      frequenciaFinal: baseFinal * 2.02,
      volume: volume * 0.25,
      duracao: duracao * 0.76,
      atraso: atraso + 0.004,
      ataque: 0.009,
      tipo: "triangle",
      barramento,
      reverberacao: reverberacao * 0.7,
    });
  }

  function pararFontesDoAmbiente() {
    fontesAmbiente.forEach((fonte) => {
      try {
        fonte.stop();
      } catch (erroParada) {
        // Uma partícula que já terminou não precisa ser parada novamente.
      }
    });
    fontesAmbiente.clear();

    [
      "fundamentalAmbiente",
      "harmonicaAmbiente",
      "moduladorAmbiente",
      "arAmbiente",
      "filtroAmbiente",
      "ganhoRespiracao",
      "ganhoHarmonicaAmbiente",
      "ganhoArAmbiente",
      "profundidadeRespiracao",
      "profundidadeHarmonica",
    ].forEach((nomeNo) => {
      try {
        nosAudio[nomeNo]?.disconnect();
      } catch (erroDesconexao) {
        // A fonte pode ter sido desconectada pelo próprio evento `ended`.
      }
      delete nosAudio[nomeNo];
    });
    ambienteCriado = false;
  }

  function pararFontesTemporarias() {
    fontesAtivas.forEach((fonte) => {
      if (fontesAmbiente.has(fonte)) return;
      try {
        fonte.stop();
      } catch (erroParada) {
        // A voz pode ter terminado durante o fade do ganho mestre.
      }
    });
  }

  function limparParticulasAmbiente() {
    if (temporizadorParticula !== null) {
      escopoAplicacao.clearTimeout(temporizadorParticula);
      temporizadorParticula = null;
    }
  }

  function agendarParticulaAmbiente() {
    limparParticulasAmbiente();
    if (
      !somAtivado
      || !estadoAudioUsuario.ambienteAtivo
      || ambienteDeveFicarSilencioso()
      || introducaoEncerrada
      || document.hidden
    ) return;

    const espera = 8000 + Math.random() * 6000;
    temporizadorParticula = escopoAplicacao.setTimeout(() => {
      temporizadorParticula = null;
      if (
        !somAtivado
        || !estadoAudioUsuario.ambienteAtivo
        || ambienteDeveFicarSilencioso()
        || introducaoEncerrada
        || contextoAudio?.state !== "running"
      ) return;

      // Algumas janelas ficam intencionalmente em silêncio para o ambiente não
      // revelar um loop curto durante uma espera longa pelo Arduino.
      if (Math.random() > 0.22) {
        const lado = Math.random() * 0.2 - 0.1;
        criarCristal({
          base: 510 + Math.random() * 120,
          baseFinal: 528 + Math.random() * 135,
          volume: 0.028,
          duracao: 0.54,
          barramento: nosAudio.ambiente,
          panoramica: [lado, -lado * 0.45],
          reverberacao: 0.14,
        });
      }
      agendarParticulaAmbiente();
    }, espera);
  }

  function criarCamadaAmbiente() {
    if (
      ambienteCriado
      || !estadoAudioUsuario.ambienteAtivo
      || ambienteDeveFicarSilencioso()
      || introducaoEncerrada
      || !podeCriarFonte()
    ) return;
    cancelarParadaAmbiente();
    ambienteCriado = true;
    const agora = contextoAudio.currentTime;

    nosAudio.filtroAmbiente = contextoAudio.createBiquadFilter();
    nosAudio.filtroAmbiente.type = "lowpass";
    nosAudio.filtroAmbiente.frequency.setValueAtTime(760, agora);
    nosAudio.filtroAmbiente.Q.setValueAtTime(0.48, agora);
    nosAudio.ganhoRespiracao = contextoAudio.createGain();
    nosAudio.ganhoHarmonicaAmbiente = contextoAudio.createGain();
    nosAudio.ganhoArAmbiente = contextoAudio.createGain();
    nosAudio.profundidadeRespiracao = contextoAudio.createGain();
    nosAudio.profundidadeHarmonica = contextoAudio.createGain();

    nosAudio.ganhoRespiracao.gain.setValueAtTime(0.105, agora);
    nosAudio.ganhoHarmonicaAmbiente.gain.setValueAtTime(0.035, agora);
    nosAudio.ganhoArAmbiente.gain.setValueAtTime(0.038, agora);
    nosAudio.profundidadeRespiracao.gain.setValueAtTime(0.042, agora);
    nosAudio.profundidadeHarmonica.gain.setValueAtTime(0.011, agora);

    nosAudio.ganhoRespiracao.connect(nosAudio.filtroAmbiente);
    nosAudio.ganhoHarmonicaAmbiente.connect(nosAudio.filtroAmbiente);
    nosAudio.ganhoArAmbiente.connect(nosAudio.filtroAmbiente);
    nosAudio.filtroAmbiente.connect(nosAudio.ambiente);

    const fundamental = contextoAudio.createOscillator();
    const harmonica = contextoAudio.createOscillator();
    const modulador = contextoAudio.createOscillator();
    const ar = contextoAudio.createBufferSource();
    const filtroAr = contextoAudio.createBiquadFilter();
    fundamental.type = "sine";
    harmonica.type = "sine";
    modulador.type = "sine";
    fundamental.frequency.setValueAtTime(98, agora);
    harmonica.frequency.setValueAtTime(196.7, agora);
    modulador.frequency.setValueAtTime(0.155, agora);
    ar.buffer = nosAudio.bufferAr;
    ar.loop = true;
    filtroAr.type = "bandpass";
    filtroAr.frequency.setValueAtTime(1250, agora);
    filtroAr.Q.setValueAtTime(0.34, agora);

    fundamental.connect(nosAudio.ganhoRespiracao);
    harmonica.connect(nosAudio.ganhoHarmonicaAmbiente);
    modulador.connect(nosAudio.profundidadeRespiracao);
    modulador.connect(nosAudio.profundidadeHarmonica);
    nosAudio.profundidadeRespiracao.connect(nosAudio.ganhoRespiracao.gain);
    nosAudio.profundidadeHarmonica.connect(nosAudio.ganhoHarmonicaAmbiente.gain);
    ar.connect(filtroAr);
    filtroAr.connect(nosAudio.ganhoArAmbiente);

    nosAudio.fundamentalAmbiente = fundamental;
    nosAudio.harmonicaAmbiente = harmonica;
    nosAudio.moduladorAmbiente = modulador;
    nosAudio.arAmbiente = ar;
    [fundamental, harmonica, modulador, ar].forEach((fonte) => {
      registrarFonte(fonte, [], true);
      fonte.start(agora);
    });

    aplicarEstadoAmbiente(estadoInicializacao, false);
    agendarParticulaAmbiente();
  }

  async function iniciarAmbiente() {
    if (
      !somAtivado
      || !estadoAudioUsuario.ambienteAtivo
      || ambienteDeveFicarSilencioso()
      || introducaoEncerrada
      || document.hidden
    ) return;
    const contexto = await garantirContexto();
    if (!contexto || introducaoEncerrada) return;
    criarCamadaAmbiente();
    if (temporizadorParticula === null) agendarParticulaAmbiente();
  }

  function solicitarDucking(duracaoMs = 640) {
    if (
      !contextoAudio
      || !nosAudio.duckingMusica
      || !estadoAudioUsuario.duckingAtivo
      || !estadoAudioUsuario.musicaAtiva
      || !musicaEmReproducao
    ) return;

    geracaoDucking += 1;
    const geracaoAtual = geracaoDucking;
    if (temporizadorDucking !== null) {
      escopoAplicacao.clearTimeout(temporizadorDucking);
    }

    animarParametro(
      nosAudio.duckingMusica.gain,
      estadoAudioUsuario.nivelDucking,
      0.045,
    );
    temporizadorDucking = escopoAplicacao.setTimeout(() => {
      temporizadorDucking = null;
      if (geracaoAtual !== geracaoDucking || !nosAudio.duckingMusica) return;
      animarParametro(
        nosAudio.duckingMusica.gain,
        1,
        estadoAudioUsuario.retornoDuckingMs / 1000,
      );
    }, Math.max(80, duracaoMs));
  }

  function executarEfeito(acao, opcoes = {}) {
    if (
      !somAtivado
      || !estadoAudioUsuario.efeitosAtivos
      || estadoAudioUsuario.volumeEfeitos <= 0
      || sistemaEncerrado
      || document.hidden
    ) return false;

    const executarAcao = () => {
      if (opcoes.importante) solicitarDucking(opcoes.duracaoDuckingMs);
      acao();
    };

    if (contextoAudio?.state === "running") {
      executarAcao();
      return true;
    }

    garantirContexto()
      .then((contexto) => {
        if (
          contexto
          && somAtivado
          && estadoAudioUsuario.efeitosAtivos
          && estadoAudioUsuario.volumeEfeitos > 0
          && !document.hidden
        ) executarAcao();
      })
      .catch((erroAudio) => informarErro(erroAudio, "reprodução do efeito"));
    return true;
  }

  function permitirEfeito(nome, intervaloMs) {
    const agora = performance.now();
    const anterior = instanteUltimoEfeito.get(nome) ?? -Infinity;
    if (agora - anterior < intervaloMs) return false;
    instanteUltimoEfeito.set(nome, agora);
    return true;
  }

  function tocarNavegacao(direcao = 0) {
    if (!permitirEfeito("navegacao", 72)) return false;
    return executarEfeito(() => {
      ladoNavegacao = direcao || ladoNavegacao * -1;
      const duracao = prefereMovimentoReduzido.matches ? 0.09 : 0.125;
      criarCristal({
        base: 820,
        baseFinal: 862,
        volume: 0.058,
        duracao,
        panoramica: [ladoNavegacao * 0.055, ladoNavegacao * 0.025],
        reverberacao: 0.055,
      });
      criarRuidoComEnvelope({
        volume: 0.025,
        duracao: 0.052,
        frequenciaInicial: 1700,
        frequenciaFinal: 3100,
        ataque: 0.012,
        panoramica: [ladoNavegacao * 0.035, 0],
        reverberacao: 0.025,
      });
    });
  }

  function tocarAberturaPainel() {
    return executarEfeito(() => {
      const duracao = prefereMovimentoReduzido.matches ? 0.24 : 0.36;
      criarPulso({ base: 145, baseFinal: 161, volume: 0.048, duracao: 0.22 });
      criarRuidoComEnvelope({
        volume: 0.105,
        duracao,
        frequenciaInicial: 1250,
        frequenciaFinal: 4300,
        ataque: 0.052,
        panoramica: [-0.035, 0.11],
        reverberacao: 0.11,
      });
      criarCristal({
        base: 470,
        baseFinal: 610,
        volume: 0.105,
        duracao,
        atraso: 0.025,
        panoramica: [-0.025, 0.09],
        reverberacao: 0.13,
      });
    });
  }

  function tocarFechamentoPainel() {
    return executarEfeito(() => {
      const duracao = prefereMovimentoReduzido.matches ? 0.15 : 0.225;
      criarCristal({
        base: 590,
        baseFinal: 445,
        volume: 0.078,
        duracao,
        panoramica: [0.065, 0],
        reverberacao: 0.07,
      });
      criarRuidoComEnvelope({
        volume: 0.065,
        duracao: duracao * 0.86,
        frequenciaInicial: 3200,
        frequenciaFinal: 1450,
        ataque: 0.014,
        panoramica: [-0.045, 0],
        reverberacao: 0.055,
      });
    });
  }

  function tocarConfirmacao() {
    if (!permitirEfeito("confirmacao", 90)) return false;
    return executarEfeito(() => {
      const duracao = prefereMovimentoReduzido.matches ? 0.065 : 0.09;
      criarPulso({
        base: 430,
        baseFinal: 392,
        volume: 0.078,
        duracao,
        reverberacao: 0.025,
      });
      criarRuidoComEnvelope({
        volume: 0.032,
        duracao: 0.052,
        frequenciaInicial: 2100,
        frequenciaFinal: 1500,
        ataque: 0.008,
        reverberacao: 0.018,
      });
    });
  }

  function tocarSincronizacao() {
    return executarEfeito(() => {
      const quantidade = prefereMovimentoReduzido.matches ? 2 : 3;
      const bases = [610, 720, 845];
      const lados = [-0.075, 0, 0.075];
      for (let indice = 0; indice < quantidade; indice += 1) {
        criarCristal({
          base: bases[indice],
          baseFinal: bases[indice] * 1.035,
          volume: 0.047,
          duracao: 0.19,
          atraso: indice * 0.15,
          panoramica: [lados[indice], lados[indice] * 0.45],
          reverberacao: 0.11,
        });
      }
    });
  }

  function tocarConexaoArduino() {
    return executarEfeito(() => {
      const fator = prefereMovimentoReduzido.matches ? 0.72 : 1;
      criarPulso({
        base: 110,
        baseFinal: 123,
        volume: 0.13,
        duracao: 0.56 * fator,
        barramento: nosAudio.atuadores,
        reverberacao: 0.09,
      });
      [
        { base: 220, atraso: 0.06, volume: 0.095, lado: -0.055 },
        { base: 321, atraso: 0.16, volume: 0.072, lado: 0.025 },
        { base: 480, atraso: 0.27, volume: 0.052, lado: 0.08 },
      ].forEach((voz, indice) => {
        if (prefereMovimentoReduzido.matches && indice === 2) return;
        criarCristal({
          base: voz.base,
          baseFinal: voz.base * 1.055,
          volume: voz.volume,
          duracao: (0.66 - indice * 0.07) * fator,
          atraso: voz.atraso * fator,
          panoramica: [voz.lado, voz.lado * 0.45],
          reverberacao: 0.15,
        });
      });
      criarRuidoComEnvelope({
        volume: 0.07,
        duracao: 0.58 * fator,
        frequenciaInicial: 950,
        frequenciaFinal: 4100,
        atraso: 0.05,
        ataque: 0.09,
        panoramica: [-0.08, 0.08],
        reverberacao: 0.13,
      });
    }, { importante: true, duracaoDuckingMs: 760 });
  }

  function tocarBombaLigada() {
    return executarEfeito(() => {
      criarPulso({
        base: 118,
        baseFinal: 104,
        volume: 0.145,
        duracao: 0.42,
        barramento: nosAudio.atuadores,
        reverberacao: 0.055,
      });
      criarRuidoComEnvelope({
        volume: 0.14,
        duracao: prefereMovimentoReduzido.matches ? 0.3 : 0.46,
        frequenciaInicial: 430,
        frequenciaFinal: 880,
        ataque: 0.065,
        qualidade: 1.05,
        barramento: nosAudio.atuadores,
        panoramica: [-0.08, 0.08],
        reverberacao: 0.085,
      });
      criarCristal({
        base: 350,
        baseFinal: 405,
        volume: 0.032,
        duracao: 0.26,
        atraso: 0.08,
        barramento: nosAudio.atuadores,
        panoramica: [-0.025, 0.035],
        reverberacao: 0.08,
      });
    });
  }

  function tocarBombaDesligada() {
    return executarEfeito(() => {
      criarPulso({
        base: 170,
        baseFinal: 115,
        volume: 0.095,
        duracao: 0.25,
        barramento: nosAudio.atuadores,
        reverberacao: 0.075,
      });
      criarRuidoComEnvelope({
        volume: 0.08,
        duracao: 0.24,
        frequenciaInicial: 760,
        frequenciaFinal: 390,
        ataque: 0.014,
        barramento: nosAudio.atuadores,
        panoramica: [0.06, 0],
        reverberacao: 0.1,
      });
    });
  }

  function tocarLuzLigada() {
    return executarEfeito(() => {
      criarRuidoComEnvelope({
        volume: 0.08,
        duracao: 0.3,
        frequenciaInicial: 1350,
        frequenciaFinal: 4800,
        ataque: 0.055,
        barramento: nosAudio.atuadores,
        panoramica: [-0.06, 0.09],
        reverberacao: 0.13,
      });
      [
        { base: 560, atraso: 0, volume: 0.072, lado: -0.06 },
        { base: 910, atraso: 0.055, volume: 0.052, lado: 0.02 },
        { base: 1450, atraso: 0.11, volume: 0.034, lado: 0.09 },
      ].forEach((voz, indice) => {
        if (prefereMovimentoReduzido.matches && indice === 2) return;
        criarCristal({
          base: voz.base,
          baseFinal: voz.base * 1.08,
          volume: voz.volume,
          duracao: 0.29 - indice * 0.035,
          atraso: voz.atraso,
          barramento: nosAudio.atuadores,
          panoramica: [voz.lado, voz.lado * 0.45],
          reverberacao: 0.14,
        });
      });
    });
  }

  function tocarLuzDesligada() {
    return executarEfeito(() => {
      criarCristal({
        base: 1120,
        baseFinal: 650,
        volume: 0.064,
        duracao: prefereMovimentoReduzido.matches ? 0.15 : 0.22,
        barramento: nosAudio.atuadores,
        panoramica: [0.07, 0],
        reverberacao: 0.075,
      });
      criarRuidoComEnvelope({
        volume: 0.047,
        duracao: 0.18,
        frequenciaInicial: 3900,
        frequenciaFinal: 1200,
        ataque: 0.012,
        barramento: nosAudio.atuadores,
        panoramica: [-0.045, 0],
        reverberacao: 0.05,
      });
    });
  }

  function tocarAlertaSuave() {
    const agora = Date.now();
    if (agora - ultimoAlertaEm < 1800) return false;
    ultimoAlertaEm = agora;

    return executarEfeito(() => {
      criarPulso({
        base: 185,
        baseFinal: 162,
        volume: 0.09,
        duracao: 0.34,
        barramento: nosAudio.atuadores,
        reverberacao: 0.08,
      });
      criarOsciladorComEnvelope({
        frequenciaInicial: 287,
        frequenciaFinal: 263,
        volume: 0.045,
        duracao: 0.3,
        atraso: 0.065,
        tipo: "triangle",
        barramento: nosAudio.atuadores,
        panoramica: [-0.025, 0.025],
        reverberacao: 0.1,
      });
    }, { importante: true, duracaoDuckingMs: 540 });
  }

  function aplicarEstadoAmbiente(novoEstado, tocarMarco = true) {
    const configuracao = configuracaoAmbiente[novoEstado];
    if (!configuracao || introducaoEncerrada) return;
    const estadoAnterior = estadoInicializacao;
    estadoInicializacao = novoEstado;

    if (ambienteCriado && contextoAudio) {
      animarParametro(nosAudio.ambiente.gain, calcularVolumeAmbiente(novoEstado), 0.5);
      animarParametro(nosAudio.filtroAmbiente?.frequency, configuracao.filtro, 0.55);
      animarParametro(nosAudio.fundamentalAmbiente?.frequency, configuracao.base, 0.55);
      animarParametro(nosAudio.harmonicaAmbiente?.frequency, configuracao.base * 2.007, 0.55);
      animarParametro(nosAudio.moduladorAmbiente?.frequency, configuracao.pulso, 0.55);
    }

    if (!tocarMarco || novoEstado === estadoAnterior) return;
    if (novoEstado === "sincronizando") tocarSincronizacao();
    if (novoEstado === "conectado") tocarConexaoArduino();
    if (novoEstado === "erro") tocarAlertaSuave();
  }

  function aoMudarEstadoInicializacao(evento) {
    const novoEstado = evento.detail?.estado;
    if (!configuracaoAmbiente[novoEstado] || introducaoEncerrada) return;
    aplicarEstadoAmbiente(novoEstado, true);
    if (somAtivado) iniciarAmbiente();
  }

  // A saída visual da abertura silencia somente a atmosfera. O barramento de
  // efeitos e o AudioContext permanecem prontos para o dashboard.
  function encerrarAmbienteDaIntroducao() {
    if (introducaoEncerrada) return;
    introducaoEncerrada = true;
    silenciarAmbienteComFade(prefereMovimentoReduzido.matches ? 0.08 : 1.05);
  }

  function aoEventoDaHorta(evento) {
    // Durante a introdução, somente a sequência de conexão possui áudio. Isso
    // evita que uma segunda leitura rápida sobreponha atuadores ao despertar.
    if (!document.body.classList.contains("painel-visivel")) return;
    const detalhes = evento.detail || {};

    if (detalhes.tipo === "detalhes") {
      if (detalhes.acao === "abriu") tocarAberturaPainel();
      if (detalhes.acao === "fechou") tocarFechamentoPainel();
      return;
    }

    if (detalhes.tipo === "aba" && detalhes.acao === "ativou") {
      tocarNavegacao();
      return;
    }

    if (detalhes.tipo === "monitoramento") {
      tocarConfirmacao();
      return;
    }

    if (detalhes.tipo === "atuador") {
      if (detalhes.alvo === "bomba") {
        detalhes.ligado ? tocarBombaLigada() : tocarBombaDesligada();
      }
      if (detalhes.alvo === "iluminacao") {
        detalhes.ligado ? tocarLuzLigada() : tocarLuzDesligada();
      }
      return;
    }

    if (detalhes.tipo === "conexao") {
      if (detalhes.estado === "conectado") tocarConexaoArduino();
      else if (["sincronizando", "aguardando"].includes(detalhes.estado)) tocarSincronizacao();
      else tocarAlertaSuave();
      return;
    }

    if (detalhes.tipo === "alerta") tocarAlertaSuave();
  }

  async function aplicarAtivacaoEfetiva(ativo, tocarTeste = false) {
    if (sistemaEncerrado || !ConstrutorContextoAudio) return false;
    const novoEstado = Boolean(ativo);
    if (novoEstado === somAtivado && contextoAudio?.state === "running") {
      if (tocarTeste) tocarConfirmacao();
      atualizarControlesSom();
      return somAtivado;
    }

    somAtivado = novoEstado;
    geracaoOperacao += 1;
    const operacaoAtual = geracaoOperacao;

    if (!somAtivado) {
      limparParticulasAmbiente();
      removerDesbloqueioPorGesto();
      if (temporizadorSuspensao !== null) {
        escopoAplicacao.clearTimeout(temporizadorSuspensao);
        temporizadorSuspensao = null;
      }
      if (contextoAudio && nosAudio.mestre) {
        animarParametro(nosAudio.mestre.gain, 0, 0.08);
        temporizadorSuspensao = escopoAplicacao.setTimeout(async () => {
          temporizadorSuspensao = null;
          if (somAtivado || operacaoAtual !== geracaoOperacao) return;
          pararFontesTemporarias();
          try {
            if (contextoAudio?.state === "running") await contextoAudio.suspend();
          } catch (erroAudio) {
            informarErro(erroAudio, "suspensão do som");
          }
          atualizarControlesSom();
        }, 105);
      }
      atualizarControlesSom();
      return false;
    }

    if (temporizadorSuspensao !== null) {
      escopoAplicacao.clearTimeout(temporizadorSuspensao);
      temporizadorSuspensao = null;
    }
    const contexto = await garantirContexto();
    if (!contexto || operacaoAtual !== geracaoOperacao || !somAtivado) {
      atualizarControlesSom();
      return somAtivado;
    }

    if (!introducaoEncerrada) {
      criarCamadaAmbiente();
      aplicarEstadoAmbiente(estadoInicializacao, false);
      if (temporizadorParticula === null) agendarParticulaAmbiente();
    }

    // A confirmação imediata permite verificar alto-falante e volume sem
    // aguardar uma mudança futura de sensor.
    if (tocarTeste) tocarConfirmacao();
    atualizarControlesSom();
    return true;
  }

  /*
   * Configurações mudam primeiro no estado central. O grafo apenas traduz o
   * snapshot recebido em ganhos; ele não possui uma segunda persistência. Isso
   * mantém introdução, dashboard e Estação sempre sincronizados.
   */
  function sincronizarConfiguracoesAudio(configuracoesAudio = null) {
    const configuracoes = obterConfiguracoesCentrais();
    const audio = configuracoesAudio || configuracoes?.obter("audio", {}) || {};
    const silenciarAcessibilidade = configuracoes?.obter(
      "acessibilidade.silenciarTudo",
      false,
    ) ?? false;

    estadoAudioUsuario.somGeralAtivo = typeof audio.somGeralAtivo === "boolean"
      ? audio.somGeralAtivo
      : estadoAudioUsuario.somGeralAtivo;
    estadoAudioUsuario.efeitosAtivos = typeof audio.efeitos?.ativo === "boolean"
      ? audio.efeitos.ativo
      : estadoAudioUsuario.efeitosAtivos;
    estadoAudioUsuario.volumeEfeitos = limitarVolume(
      audio.efeitos?.volume,
      estadoAudioUsuario.volumeEfeitos,
    );
    estadoAudioUsuario.ambienteAtivo = typeof audio.ambiente?.ativo === "boolean"
      ? audio.ambiente.ativo
      : estadoAudioUsuario.ambienteAtivo;
    estadoAudioUsuario.volumeAmbiente = limitarVolume(
      audio.ambiente?.volume,
      estadoAudioUsuario.volumeAmbiente,
    );
    estadoAudioUsuario.musicaAtiva = typeof audio.musica?.ativo === "boolean"
      ? audio.musica.ativo
      : estadoAudioUsuario.musicaAtiva;
    estadoAudioUsuario.volumeMusica = limitarVolume(
      audio.musica?.volume,
      estadoAudioUsuario.volumeMusica,
    );
    estadoAudioUsuario.duckingAtivo = typeof audio.ducking?.ativo === "boolean"
      ? audio.ducking.ativo
      : estadoAudioUsuario.duckingAtivo;
    estadoAudioUsuario.nivelDucking = limitarVolume(
      audio.ducking?.nivel,
      estadoAudioUsuario.nivelDucking,
    );
    estadoAudioUsuario.retornoDuckingMs = Math.min(
      3000,
      Math.max(80, Number(audio.ducking?.retornoMs) || estadoAudioUsuario.retornoDuckingMs),
    );
    estadoAudioUsuario.silencioAcessibilidade = Boolean(silenciarAcessibilidade);

    const somEfetivamenteAtivo = estadoAudioUsuario.somGeralAtivo
      && !estadoAudioUsuario.silencioAcessibilidade;
    atualizarGanhosDasCategorias();
    if (somEfetivamenteAtivo !== somAtivado) {
      aplicarAtivacaoEfetiva(somEfetivamenteAtivo, false).catch((erroAudio) => {
        informarErro(erroAudio, "aplicação das configurações de áudio");
      });
    } else {
      atualizarControlesSom();
    }

    return obterEstado();
  }

  function alterarConfiguracaoAudio(caminho, valor, aplicarLocalmente) {
    const configuracoes = obterConfiguracoesCentrais();
    if (configuracoes) {
      configuracoes.alterar(caminho, valor);
      return;
    }

    aplicarLocalmente();
    sincronizarConfiguracoesAudio({
      somGeralAtivo: estadoAudioUsuario.somGeralAtivo,
      efeitos: {
        ativo: estadoAudioUsuario.efeitosAtivos,
        volume: estadoAudioUsuario.volumeEfeitos,
      },
      ambiente: {
        ativo: estadoAudioUsuario.ambienteAtivo,
        volume: estadoAudioUsuario.volumeAmbiente,
      },
      musica: {
        ativo: estadoAudioUsuario.musicaAtiva,
        volume: estadoAudioUsuario.volumeMusica,
      },
      ducking: {
        ativo: estadoAudioUsuario.duckingAtivo,
        nivel: estadoAudioUsuario.nivelDucking,
        retornoMs: estadoAudioUsuario.retornoDuckingMs,
      },
    });
  }

  function definirAtivo(ativo, registrarConfiguracao = true) {
    const novoEstado = Boolean(ativo);
    if (registrarConfiguracao) {
      const configuracoes = obterConfiguracoesCentrais();
      if (
        novoEstado
        && configuracoes?.obter("acessibilidade.silenciarTudo", false)
      ) {
        configuracoes.alterarLote({
          "audio.somGeralAtivo": true,
          "acessibilidade.silenciarTudo": false,
        });
      } else {
        alterarConfiguracaoAudio("audio.somGeralAtivo", novoEstado, () => {
          estadoAudioUsuario.somGeralAtivo = novoEstado;
        });
      }
    } else {
      estadoAudioUsuario.somGeralAtivo = novoEstado;
    }

    return aplicarAtivacaoEfetiva(
      novoEstado && !estadoAudioUsuario.silencioAcessibilidade,
      novoEstado,
    );
  }

  function definirEfeitosAtivos(ativo) {
    alterarConfiguracaoAudio("audio.efeitos.ativo", Boolean(ativo), () => {
      estadoAudioUsuario.efeitosAtivos = Boolean(ativo);
    });
    return Boolean(ativo);
  }

  function definirVolumeEfeitos(volume) {
    const valor = limitarVolume(volume, estadoAudioUsuario.volumeEfeitos);
    alterarConfiguracaoAudio("audio.efeitos.volume", valor, () => {
      estadoAudioUsuario.volumeEfeitos = valor;
    });
    return valor;
  }

  function definirAmbienteAtivo(ativo) {
    alterarConfiguracaoAudio("audio.ambiente.ativo", Boolean(ativo), () => {
      estadoAudioUsuario.ambienteAtivo = Boolean(ativo);
    });
    return Boolean(ativo);
  }

  function definirVolumeAmbiente(volume) {
    const valor = limitarVolume(volume, estadoAudioUsuario.volumeAmbiente);
    alterarConfiguracaoAudio("audio.ambiente.volume", valor, () => {
      estadoAudioUsuario.volumeAmbiente = valor;
    });
    return valor;
  }

  function definirMusicaAtiva(ativo) {
    alterarConfiguracaoAudio("audio.musica.ativo", Boolean(ativo), () => {
      estadoAudioUsuario.musicaAtiva = Boolean(ativo);
    });
    return Boolean(ativo);
  }

  function definirVolumeMusica(volume) {
    const valor = limitarVolume(volume, estadoAudioUsuario.volumeMusica);
    alterarConfiguracaoAudio("audio.musica.volume", valor, () => {
      estadoAudioUsuario.volumeMusica = valor;
    });
    return valor;
  }

  function informarEstadoMusica(estado) {
    const novoEstado = typeof estado === "boolean"
      ? estado
      : Boolean(estado?.tocando ?? estado?.reproduzindo);
    musicaEmReproducao = novoEstado;

    if (musicaEmReproducao && ambienteDeveFicarSilencioso()) {
      silenciarAmbienteComFade(0.42);
      if (somAtivado && !document.hidden) {
        garantirContexto().catch((erroAudio) => {
          informarErro(erroAudio, "início da reprodução musical");
        });
      }
    } else if (!introducaoEncerrada && estadoAudioUsuario.ambienteAtivo) {
      iniciarAmbiente().catch((erroAudio) => {
        informarErro(erroAudio, "retomada do ambiente sem música");
      });
    }

    if (!musicaEmReproducao && nosAudio.duckingMusica) {
      geracaoDucking += 1;
      if (temporizadorDucking !== null) {
        escopoAplicacao.clearTimeout(temporizadorDucking);
        temporizadorDucking = null;
      }
      animarParametro(nosAudio.duckingMusica.gain, 1, 0.12);
    }

    atualizarGanhosDasCategorias();
    return musicaEmReproducao;
  }

  function algumElementoMusicaTocando() {
    return [...elementosMusicaConectados].some((elemento) => (
      !elemento.paused && !elemento.ended && elemento.readyState > 0
    ));
  }

  /*
   * Cada HTMLAudioElement pode originar somente um MediaElementAudioSourceNode.
   * O WeakMap torna chamadas repetidas idempotentes e o analisador exclusivo
   * deixa o visualizador reagir apenas à música, nunca aos SFX do software.
   */
  async function conectarElementoMusica(elementoAudio) {
    const ElementoMidia = escopoAplicacao.HTMLMediaElement;
    if (!ElementoMidia || !(elementoAudio instanceof ElementoMidia)) {
      throw new TypeError("conectarElementoMusica requer um elemento <audio> válido.");
    }

    const registroExistente = fontesMusicaPorElemento.get(elementoAudio);
    if (registroExistente) {
      if (!registroExistente.conectado) {
        registroExistente.fonte.connect(nosAudio.analisadorMusica);
        registroExistente.eventos.forEach((nomeEvento) => {
          elementoAudio.addEventListener(
            nomeEvento,
            registroExistente.reconciliarReproducao,
          );
        });
        registroExistente.conectado = true;
        elementosMusicaConectados.add(elementoAudio);
      }
      elementoMusicaPrincipal = elementoAudio;
      return nosAudio.analisadorMusica;
    }

    const conexaoPendente = promessasConexaoPorElemento.get(elementoAudio);
    if (conexaoPendente) return conexaoPendente;

    // A promessa entra no WeakMap antes do primeiro await. Assim chamadas vindas
    // simultaneamente da inicialização e do botão Play compartilham uma só fonte.
    const promessaConexao = (async () => {
      const contexto = criarGrafoAudio();
      if (!contexto || !nosAudio.analisadorMusica) return null;
      if (somAtivado && !document.hidden) await garantirContexto();
      if (sistemaEncerrado || contexto !== contextoAudio || !nosAudio.analisadorMusica) return null;

      const registroCriadoEnquantoAguardava = fontesMusicaPorElemento.get(elementoAudio);
      if (registroCriadoEnquantoAguardava) return nosAudio.analisadorMusica;

      try {
        const fonte = contexto.createMediaElementSource(elementoAudio);
        fonte.connect(nosAudio.analisadorMusica);
        const reconciliarReproducao = () => informarEstadoMusica(
          algumElementoMusicaTocando(),
        );
        const eventos = ["play", "playing", "pause", "ended", "emptied"];
        eventos.forEach((nomeEvento) => {
          elementoAudio.addEventListener(nomeEvento, reconciliarReproducao);
        });

        fontesMusicaPorElemento.set(elementoAudio, {
          fonte,
          eventos,
          reconciliarReproducao,
          conectado: true,
        });
        elementosMusicaConectados.add(elementoAudio);
        elementoMusicaPrincipal = elementoAudio;
        reconciliarReproducao();
        return nosAudio.analisadorMusica;
      } catch (erroAudio) {
        informarErro(erroAudio, "conexão do player musical");
        return null;
      }
    })();

    promessasConexaoPorElemento.set(elementoAudio, promessaConexao);
    void promessaConexao.finally(() => {
      if (promessasConexaoPorElemento.get(elementoAudio) === promessaConexao) {
        promessasConexaoPorElemento.delete(elementoAudio);
      }
    }).catch(() => {});
    return promessaConexao;
  }

  function desconectarElementoMusica(elementoAudio) {
    const registro = fontesMusicaPorElemento.get(elementoAudio);
    if (!registro) return false;

    registro.eventos.forEach((nomeEvento) => {
      elementoAudio.removeEventListener(nomeEvento, registro.reconciliarReproducao);
    });
    try {
      registro.fonte.disconnect();
    } catch (erroDesconexao) {
      // O encerramento do AudioContext pode ter desconectado o nó primeiro.
    }
    registro.conectado = false;
    elementosMusicaConectados.delete(elementoAudio);
    if (elementoMusicaPrincipal === elementoAudio) elementoMusicaPrincipal = null;
    informarEstadoMusica(algumElementoMusicaTocando());
    return true;
  }

  function obterAnalisadorMusica() {
    criarGrafoAudio();
    return nosAudio.analisadorMusica || null;
  }

  function testarEfeito() {
    return tocarConfirmacao();
  }

  function alternarSom() {
    return definirAtivo(!somAtivado);
  }

  function aoClicarControleSom(evento) {
    const controle = evento.target instanceof Element
      ? evento.target.closest("[data-controle-som]")
      : null;
    if (!controle) return;

    // Se o navegador aguardava um gesto, o primeiro clique deve desbloquear a
    // saída — nunca transformar “som ligado” em “desligado” por acidente.
    if (somAtivado && contextoAudio?.state !== "running") {
      aplicarAtivacaoEfetiva(true, true);
      return;
    }
    alternarSom();
  }

  async function suspenderEnquantoOculto() {
    geracaoOperacao += 1;
    limparParticulasAmbiente();
    if (!contextoAudio || contextoAudio.state !== "running") return;

    // Um player deve continuar audível ao minimizar. Só o ambiente e vozes
    // temporárias param; a Estação interrompe separadamente seu visualizador.
    if (musicaEmReproducao && estadoAudioUsuario.musicaAtiva && somAtivado) {
      silenciarAmbienteComFade(0.08);
      pararFontesTemporarias();
      atualizarControlesSom();
      return;
    }

    try {
      animarParametro(nosAudio.mestre.gain, 0, 0.055);
      await new Promise((resolver) => escopoAplicacao.setTimeout(resolver, 70));
      if (document.hidden && contextoAudio?.state === "running") {
        pararFontesTemporarias();
        await contextoAudio.suspend();
      }
    } catch (erroAudio) {
      informarErro(erroAudio, "suspensão em segundo plano");
    }
    atualizarControlesSom();
  }

  function aoMudarVisibilidade() {
    if (document.hidden) {
      suspenderEnquantoOculto();
      return;
    }

    if (!somAtivado || sistemaEncerrado) return;
    garantirContexto()
      .then(() => iniciarAmbiente())
      .catch((erroAudio) => informarErro(erroAudio, "retomada da janela"));
  }

  function obterNivelSaida() {
    if (!nosAudio.analisador) return { pico: 0, rms: 0 };
    const amostras = new Float32Array(nosAudio.analisador.fftSize);
    nosAudio.analisador.getFloatTimeDomainData(amostras);
    let pico = 0;
    let somaQuadrados = 0;

    amostras.forEach((amostra) => {
      pico = Math.max(pico, Math.abs(amostra));
      somaQuadrados += amostra * amostra;
    });

    return {
      pico: Number(pico.toFixed(5)),
      rms: Number(Math.sqrt(somaQuadrados / amostras.length).toFixed(5)),
    };
  }

  function obterEstado() {
    return {
      somAtivado,
      somGeralAtivo: estadoAudioUsuario.somGeralAtivo,
      estadoContexto: contextoAudio?.state || (ConstrutorContextoAudio ? "nao-criado" : "indisponivel"),
      estadoInicializacao,
      introducaoEncerrada,
      ambienteAtivo: ambienteCriado,
      musicaEmReproducao,
      elementoMusicaConectado: Boolean(elementoMusicaPrincipal),
      fontesAtivas: fontesAtivas.size,
      nivelSaida: obterNivelSaida(),
      ultimoErro,
      volumes: {
        calibracao: { ...configuracaoAudio },
        efeitos: estadoAudioUsuario.volumeEfeitos,
        ambiente: estadoAudioUsuario.volumeAmbiente,
        musica: estadoAudioUsuario.volumeMusica,
      },
      categorias: {
        efeitosAtivos: estadoAudioUsuario.efeitosAtivos,
        ambienteAtivo: estadoAudioUsuario.ambienteAtivo,
        musicaAtiva: estadoAudioUsuario.musicaAtiva,
      },
      ducking: {
        ativo: estadoAudioUsuario.duckingAtivo,
        nivelConfigurado: estadoAudioUsuario.nivelDucking,
        ganhoAtual: Number((nosAudio.duckingMusica?.gain.value ?? 1).toFixed(4)),
      },
    };
  }

  function integrarConfiguracoesCentrais() {
    const configuracoes = obterConfiguracoesCentrais();
    if (!configuracoes) {
      document.addEventListener("configuracoesprontas", integrarConfiguracoesCentrais, {
        once: true,
      });
      return;
    }

    removerAssinaturaAudio?.();
    removerAssinaturaAcessibilidade?.();
    removerAssinaturaAudio = configuracoes.assinar("audio", (audio) => {
      sincronizarConfiguracoesAudio(audio);
    });
    removerAssinaturaAcessibilidade = configuracoes.assinar(
      "acessibilidade.silenciarTudo",
      () => sincronizarConfiguracoesAudio(),
    );
  }

  async function encerrarSistemaSonoro(evento) {
    if (evento?.persisted) {
      suspenderEnquantoOculto();
      return;
    }
    if (sistemaEncerrado) return;
    sistemaEncerrado = true;
    somAtivado = false;
    geracaoOperacao += 1;
    limparParticulasAmbiente();
    removerDesbloqueioPorGesto();
    cancelarParadaAmbiente();
    geracaoDucking += 1;
    if (temporizadorDucking !== null) {
      escopoAplicacao.clearTimeout(temporizadorDucking);
      temporizadorDucking = null;
    }
    if (temporizadorSuspensao !== null) {
      escopoAplicacao.clearTimeout(temporizadorSuspensao);
      temporizadorSuspensao = null;
    }

    document.removeEventListener("click", aoClicarControleSom);
    document.removeEventListener("configuracoesprontas", integrarConfiguracoesCentrais);
    removerAssinaturaAudio?.();
    removerAssinaturaAcessibilidade?.();
    removerAssinaturaAudio = null;
    removerAssinaturaAcessibilidade = null;
    telaInicializacao?.removeEventListener(
      "mudancaestadoinicializacao",
      aoMudarEstadoInicializacao,
    );
    telaInicializacao?.removeEventListener(
      "encerramentoinicializacao",
      encerrarAmbienteDaIntroducao,
    );
    document.removeEventListener("eventohorta", aoEventoDaHorta);
    document.removeEventListener("visibilitychange", aoMudarVisibilidade);
    escopoAplicacao.removeEventListener("focus", aoMudarVisibilidade);
    escopoAplicacao.removeEventListener("pagehide", encerrarSistemaSonoro);

    fontesAtivas.forEach((fonte) => {
      try {
        fonte.stop();
        fonte.disconnect();
      } catch (erroParada) {
        // A fonte pode ter terminado no mesmo quadro do encerramento.
      }
    });
    fontesAtivas.clear();
    fontesAmbiente.clear();

    elementosMusicaConectados.forEach((elemento) => {
      const registro = fontesMusicaPorElemento.get(elemento);
      registro?.eventos.forEach((nomeEvento) => {
        elemento.removeEventListener(nomeEvento, registro.reconciliarReproducao);
      });
      try {
        registro?.fonte.disconnect();
      } catch (erroDesconexao) {
        // O contexto pode ter sido encerrado antes da limpeza dos elementos.
      }
    });
    elementosMusicaConectados.clear();
    fontesMusicaPorElemento = new WeakMap();
    promessasConexaoPorElemento = new WeakMap();
    elementoMusicaPrincipal = null;
    musicaEmReproducao = false;

    if (contextoAudio) {
      const contextoParaFechar = contextoAudio;
      contextoParaFechar.onstatechange = null;
      try {
        if (contextoParaFechar.state !== "closed") await contextoParaFechar.close();
      } catch (erroAudio) {
        // O encerramento da BrowserWindow também libera o dispositivo.
      }
      contextoAudio = null;
      nosAudio = {};
    }
  }

  function iniciarSistemaSonoro() {
    if (sistemaIniciado || sistemaEncerrado) return;
    sistemaIniciado = true;
    integrarConfiguracoesCentrais();
    document.addEventListener("click", aoClicarControleSom);
    telaInicializacao?.addEventListener(
      "mudancaestadoinicializacao",
      aoMudarEstadoInicializacao,
    );
    telaInicializacao?.addEventListener(
      "encerramentoinicializacao",
      encerrarAmbienteDaIntroducao,
    );
    document.addEventListener("eventohorta", aoEventoDaHorta);
    document.addEventListener("visibilitychange", aoMudarVisibilidade);
    // O foco apenas solicita uma reconciliação; ele nunca é requisito para som.
    escopoAplicacao.addEventListener("focus", aoMudarVisibilidade);
    escopoAplicacao.addEventListener("pagehide", encerrarSistemaSonoro);

    const iniciarSaidaConfigurada = () => {
      if (sistemaEncerrado) return;
      sincronizarConfiguracoesAudio();
      atualizarControlesSom();
      if (!somAtivado) return;

      // Cria o contexto somente depois de carregar a preferência persistida;
      // assim, uma sessão silenciada nunca vaza um instante de som no boot.
      criarGrafoAudio();
      if (!document.hidden) {
        garantirContexto()
          .then(() => iniciarAmbiente())
          .catch((erroAudio) => informarErro(erroAudio, "inicialização do som"));
      }
    };

    const configuracoes = obterConfiguracoesCentrais();
    if (configuracoes?.pronto) {
      configuracoes.pronto.then(iniciarSaidaConfigurada).catch((erroConfiguracoes) => {
        informarErro(erroConfiguracoes, "carregamento das configurações de som");
        iniciarSaidaConfigurada();
      });
    } else {
      iniciarSaidaConfigurada();
    }
  }

  const apiSons = Object.freeze({
    iniciar: iniciarSistemaSonoro,
    definirAtivo,
    ativar: () => definirAtivo(true),
    desativar: () => definirAtivo(false),
    alternar: alternarSom,
    obterEstado,
    tocarNavegacao,
    tocarAberturaPainel,
    tocarFechamentoPainel,
    tocarConfirmacao,
    tocarConexaoArduino,
    tocarBombaLigada,
    tocarBombaDesligada,
    tocarLuzLigada,
    tocarLuzDesligada,
    tocarAlertaSuave,
    testarEfeito,
    sincronizarConfiguracoesAudio,
    definirEfeitosAtivos,
    definirVolumeEfeitos,
    definirAmbienteAtivo,
    definirVolumeAmbiente,
    definirMusicaAtiva,
    definirVolumeMusica,
    conectarElementoMusica,
    desconectarElementoMusica,
    informarEstadoMusica,
    obterAnalisadorMusica,
    encerrar: encerrarSistemaSonoro,
  });

  const hortaInteligente = escopoAplicacao.HortaInteligente ?? {};
  hortaInteligente.sons = apiSons;
  escopoAplicacao.HortaInteligente = hortaInteligente;
  iniciarSistemaSonoro();
})(window);
