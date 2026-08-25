/*
 * Isola toda a lógica falsa e registra somente a fábrica da fonte de dados.
 * Esse formato mantém os arquivos separados e também funciona por duplo clique.
 */
(function registrarFonteSimulada(escopoAplicacao) {
"use strict";

const LIMITE_MINIMO_SENSOR = 0;
const LIMITE_MAXIMO_SENSOR = 1023;
const QUANTIDADE_HISTORICO = 24;

/**
 * Mantém um número dentro de uma faixa conhecida.
 * Essa proteção também será útil quando a fonte real receber leituras inesperadas.
 */
function limitarValor(valor, minimo, maximo) {
  return Math.min(Math.max(valor, minimo), maximo);
}

function gerarVariacao(minimo, maximo) {
  return minimo + Math.random() * (maximo - minimo);
}

function arredondar(valor, casasDecimais = 0) {
  const multiplicador = 10 ** casasDecimais;
  return Math.round(valor * multiplicador) / multiplicador;
}

/**
 * Aproxima a leitura bruta de um sensor capacitivo: quanto mais úmido o solo,
 * menor tende a ser o valor analógico. Os números exatos deverão ser calibrados
 * para o sensor físico quando o Arduino for conectado.
 */
function calcularValorBruto(umidadeSolo) {
  const leituraComRuido = 850 - umidadeSolo * 5.5 + gerarVariacao(-5, 5);
  return Math.round(limitarValor(leituraComRuido, LIMITE_MINIMO_SENSOR, LIMITE_MAXIMO_SENSOR));
}

function obterConfiguracao(caminho, valorPadrao) {
  return escopoAplicacao.HortaInteligente?.configuracoes?.obter?.(caminho, valorPadrao)
    ?? valorPadrao;
}

function horarioParaSegundos(horario, padrao) {
  const [horas, minutos] = String(horario ?? padrao).split(":").map(Number);
  if (!Number.isFinite(horas) || !Number.isFinite(minutos)) return horarioParaSegundos(padrao, "00:00");
  return (horas * 3600) + (minutos * 60);
}

function formatarRtc(segundos) {
  const normalizado = ((segundos % 86400) + 86400) % 86400;
  const horas = Math.floor(normalizado / 3600);
  const minutos = Math.floor((normalizado % 3600) / 60);
  const segundosRestantes = Math.floor(normalizado % 60);
  return [horas, minutos, segundosRestantes].map((valor) => String(valor).padStart(2, "0")).join(":");
}

function horarioDentroDoCiclo(atual, inicio, fim) {
  if (inicio === fim) return false;
  return inicio < fim ? atual >= inicio && atual < fim : atual >= inicio || atual < fim;
}

function gerarHistoricoInicial(valorCentral) {
  let valorAnterior = valorCentral - gerarVariacao(-2, 2);
  const historico = [];

  for (let indice = 0; indice < QUANTIDADE_HISTORICO; indice += 1) {
    valorAnterior = limitarValor(valorAnterior + gerarVariacao(-0.8, 0.8), 0, 100);
    historico.push(arredondar(valorAnterior, 1));
  }

  historico[historico.length - 1] = arredondar(valorCentral, 1);
  return historico;
}

/**
 * Cria a fonte de dados simulada usada durante o desenvolvimento.
 *
 * O objeto retornado segue uma API pequena (`iniciar`, `pausar`, `retomar` e
 * `parar`). Uma futura fonte Serial poderá oferecer os mesmos métodos e entregar
 * objetos com o mesmo formato, sem alterar a lógica visual de `principal.js`.
 */
function criarSimuladorHorta({ intervaloAtualizacao = 4000 } = {}) {
  const agora = new Date();
  const estadoSimulado = {
    umidadeSolo: 49.5,
    bombaLigada: false,
    iluminacaoLigada: false,
    numeroLeitura: 1841,
    segundosRtc: (agora.getHours() * 3600) + (agora.getMinutes() * 60) + agora.getSeconds(),
    historicoUmidade: gerarHistoricoInicial(49.5),
  };

  let identificadorIntervalo = null;
  let receberDados = null;
  let simulacaoPausada = false;

  /**
   * Faz os dados evoluírem em um ritmo acelerado de demonstração. A histerese
   * dos atuadores usa limites diferentes para ligar e desligar, evitando
   * alternâncias rápidas perto do corte.
   * Os limites vêm da mesma configuração lida pelo painel. No modo simulado o
   * RTC avança trinta minutos por pacote para tornar o ciclo da Grow Light
   * observável durante uma apresentação, sem inventar um sensor de luz.
   */
  function atualizarAmbienteSimulado() {
    const variacaoUmidade = estadoSimulado.bombaLigada
      ? gerarVariacao(2.2, 3.1)
      : gerarVariacao(-1, -0.62);

    estadoSimulado.umidadeSolo = limitarValor(
      estadoSimulado.umidadeSolo + variacaoUmidade,
      0,
      100,
    );

    const limiteMinimo = limitarValor(Number(obterConfiguracao("horta.limiteUmidadeMinima", 45)), 5, 95);
    const limiteMaximo = limitarValor(Number(obterConfiguracao("horta.limiteUmidadeMaxima", 72)), limiteMinimo + 1, 100);
    const limiteDesligamento = Math.min(limiteMaximo, limiteMinimo + 15);

    if (!estadoSimulado.bombaLigada && estadoSimulado.umidadeSolo < limiteMinimo) {
      estadoSimulado.bombaLigada = true;
    } else if (estadoSimulado.bombaLigada && estadoSimulado.umidadeSolo > limiteDesligamento) {
      estadoSimulado.bombaLigada = false;
    }

    estadoSimulado.segundosRtc = (estadoSimulado.segundosRtc + 1800) % 86400;
    const inicio = horarioParaSegundos(obterConfiguracao("horta.horarioIluminacaoInicio", "08:00"), "08:00");
    const fim = horarioParaSegundos(obterConfiguracao("horta.horarioIluminacaoFim", "20:00"), "20:00");
    estadoSimulado.iluminacaoLigada = horarioDentroDoCiclo(estadoSimulado.segundosRtc, inicio, fim);
  }

  /**
   * Monta um retrato completo da horta. Atualmente os valores vêm do estado
   * simulado; no futuro, a comunicação Serial deverá montar este mesmo objeto
   * com as mensagens enviadas pelo Arduino.
   */
  function gerarDadosSimulados() {
    atualizarAmbienteSimulado();

    const umidadeSolo = arredondar(estadoSimulado.umidadeSolo, 1);
    const horarioIluminacaoInicio = obterConfiguracao("horta.horarioIluminacaoInicio", "08:00");
    const horarioIluminacaoFim = obterConfiguracao("horta.horarioIluminacaoFim", "20:00");

    estadoSimulado.numeroLeitura += 1;
    estadoSimulado.historicoUmidade.push(umidadeSolo);
    estadoSimulado.historicoUmidade = estadoSimulado.historicoUmidade.slice(-QUANTIDADE_HISTORICO);

    return {
      umidadeSolo,
      valorBrutoSensor: calcularValorBruto(umidadeSolo),
      bombaLigada: estadoSimulado.bombaLigada,
      iluminacaoLigada: estadoSimulado.iluminacaoLigada,
      horarioRtc: formatarRtc(estadoSimulado.segundosRtc),
      horarioIluminacaoInicio,
      horarioIluminacaoFim,
      estadoArduino: {
        conexao: "conectado",
        porta: "COM4 · simulada",
        recebendoDados: true,
      },
      ultimaAtualizacao: new Date().toISOString(),
      numeroLeitura: estadoSimulado.numeroLeitura,
      intervaloAtualizacao,
      fonteDados: "simulador",
      historicoUmidade: [...estadoSimulado.historicoUmidade],
    };
  }

  // Entrega uma leitura à interface e agenda as próximas no intervalo definido.
  function publicarLeitura() {
    if (typeof receberDados === "function" && !simulacaoPausada) {
      receberDados(gerarDadosSimulados());
    }
  }

  function agendarLeituras() {
    window.clearInterval(identificadorIntervalo);
    identificadorIntervalo = window.setInterval(publicarLeitura, intervaloAtualizacao);
  }

  /**
   * Registra quem receberá os dados. A primeira leitura é enviada imediatamente,
   * para que a página não permaneça vazia esperando o primeiro intervalo.
   */
  function iniciar(aoReceberDados) {
    if (typeof aoReceberDados !== "function") {
      throw new TypeError("O simulador precisa receber uma função para entregar os dados.");
    }

    parar();
    receberDados = aoReceberDados;
    simulacaoPausada = false;
    publicarLeitura();
    agendarLeituras();
  }

  function pausar() {
    simulacaoPausada = true;
    window.clearInterval(identificadorIntervalo);
    identificadorIntervalo = null;
  }

  function retomar() {
    if (typeof receberDados !== "function") return;

    simulacaoPausada = false;
    publicarLeitura();
    agendarLeituras();
  }

  // Encerra a fonte e remove a função inscrita, evitando temporizadores duplicados.
  function parar() {
    window.clearInterval(identificadorIntervalo);
    identificadorIntervalo = null;
    receberDados = null;
    simulacaoPausada = false;
  }

  function estaPausado() {
    return simulacaoPausada;
  }

  // Metadados simples permitem que a abertura identifique claramente este modo
  // como demonstração, sem dar a impressão de que há um Arduino físico ativo.
  return {
    tipoFonte: "simulador",
    nomeFonte: "Simulador local",
    iniciar,
    pausar,
    retomar,
    parar,
    estaPausado,
  };
}

/*
 * Expõe somente a fábrica da fonte no espaço da aplicação. O restante do
 * simulador continua privado e não disputa nomes com `principal.js`.
 */
const hortaInteligente = escopoAplicacao.HortaInteligente ?? {};
hortaInteligente.criarSimuladorHorta = criarSimuladorHorta;

// No projeto atual, o simulador é a fonte selecionada. Se um módulo Serial já
// tiver registrado uma fonte explícita, este arquivo nunca a substitui por
// dados falsos — comportamento importante para a futura versão do CaseMod.
if (typeof hortaInteligente.criarFonteDados !== "function") {
  hortaInteligente.criarFonteDados = criarSimuladorHorta;
}
escopoAplicacao.HortaInteligente = hortaInteligente;
})(window);
