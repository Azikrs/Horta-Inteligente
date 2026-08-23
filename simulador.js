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

/**
 * Usa o horário local para criar um ciclo de luz plausível. Isso permite ver a
 * iluminação auxiliar ligada à noite e desligada quando há luz natural suficiente.
 */
function calcularLuminosidadeAlvo() {
  const horaAtual = new Date().getHours();

  if (horaAtual >= 8 && horaAtual < 17) return 76;
  if (horaAtual >= 6 && horaAtual < 8) return 48;
  if (horaAtual >= 17 && horaAtual < 19) return 42;
  return 22;
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
  const luminosidadeInicial = calcularLuminosidadeAlvo() + gerarVariacao(-3, 3);
  const estadoSimulado = {
    umidadeSolo: 64.8,
    luminosidade: limitarValor(luminosidadeInicial, 0, 100),
    bombaLigada: false,
    iluminacaoLigada: luminosidadeInicial < 35,
    numeroLeitura: 1841,
    historicoUmidade: gerarHistoricoInicial(64.8),
  };

  let identificadorIntervalo = null;
  let receberDados = null;
  let simulacaoPausada = false;

  /**
   * Faz os dados evoluírem aos poucos. A histerese dos atuadores usa limites
   * diferentes para ligar e desligar, evitando alternâncias rápidas perto do corte.
   * A faixa entre 45% (conforto visual) e 36% (acionamento) funciona como margem
   * de observação, para que a bomba não ligue após qualquer pequena oscilação.
   */
  function atualizarAmbienteSimulado() {
    const variacaoUmidade = estadoSimulado.bombaLigada
      ? gerarVariacao(0.8, 1.5)
      : gerarVariacao(-0.34, -0.06);

    estadoSimulado.umidadeSolo = limitarValor(
      estadoSimulado.umidadeSolo + variacaoUmidade,
      0,
      100,
    );

    if (!estadoSimulado.bombaLigada && estadoSimulado.umidadeSolo < 36) {
      estadoSimulado.bombaLigada = true;
    } else if (estadoSimulado.bombaLigada && estadoSimulado.umidadeSolo > 60) {
      estadoSimulado.bombaLigada = false;
    }

    const alvoLuminosidade = calcularLuminosidadeAlvo();
    const aproximacaoDoAlvo = (alvoLuminosidade - estadoSimulado.luminosidade) * 0.08;
    estadoSimulado.luminosidade = limitarValor(
      estadoSimulado.luminosidade + aproximacaoDoAlvo + gerarVariacao(-1.2, 1.2),
      0,
      100,
    );

    if (!estadoSimulado.iluminacaoLigada && estadoSimulado.luminosidade < 34) {
      estadoSimulado.iluminacaoLigada = true;
    } else if (estadoSimulado.iluminacaoLigada && estadoSimulado.luminosidade > 44) {
      estadoSimulado.iluminacaoLigada = false;
    }
  }

  /**
   * Monta um retrato completo da horta. Atualmente os valores vêm do estado
   * simulado; no futuro, a comunicação Serial deverá montar este mesmo objeto
   * com as mensagens enviadas pelo Arduino.
   */
  function gerarDadosSimulados() {
    atualizarAmbienteSimulado();

    const umidadeSolo = arredondar(estadoSimulado.umidadeSolo, 1);
    const luminosidade = arredondar(estadoSimulado.luminosidade, 0);

    estadoSimulado.numeroLeitura += 1;
    estadoSimulado.historicoUmidade.push(umidadeSolo);
    estadoSimulado.historicoUmidade = estadoSimulado.historicoUmidade.slice(-QUANTIDADE_HISTORICO);

    return {
      umidadeSolo,
      valorBrutoSensor: calcularValorBruto(umidadeSolo),
      bombaLigada: estadoSimulado.bombaLigada,
      luminosidade,
      luminosidadeLux: Math.round(luminosidade * 240 + gerarVariacao(-90, 90)),
      iluminacaoLigada: estadoSimulado.iluminacaoLigada,
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
hortaInteligente.criarFonteDados = criarSimuladorHorta;
hortaInteligente.criarSimuladorHorta = criarSimuladorHorta;
escopoAplicacao.HortaInteligente = hortaInteligente;
})(window);
