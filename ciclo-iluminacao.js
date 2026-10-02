(function registrarCicloIluminacao(escopo) {
  "use strict";

  function segundosDoHorario(horario) {
    if (typeof horario !== "string" || !/^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(horario)) return null;
    const [horas, minutos, segundos = 0] = horario.split(":").map(Number);
    return horas * 3600 + minutos * 60 + segundos;
  }

  // Calcula uma programação visual. Nunca transforma uma previsão em estado
  // físico da lâmpada nem preenche o campo horarioRtc enviado pela placa.
  function calcularCiclo(dados = {}, configuracao = {}, data = new Date()) {
    const inicioTexto = dados.horarioIluminacaoInicio ?? configuracao.horarioIluminacaoInicio ?? "08:00";
    const fimTexto = dados.horarioIluminacaoFim ?? configuracao.horarioIluminacaoFim ?? "20:00";
    const usaRelogioLocal = dados.horarioRtc == null;
    const horario = usaRelogioLocal
      ? [data.getHours(), data.getMinutes(), data.getSeconds()].map((valor) => String(valor).padStart(2, "0")).join(":")
      : dados.horarioRtc;
    const inicio = segundosDoHorario(inicioTexto);
    const fim = segundosDoHorario(fimTexto);
    const agora = segundosDoHorario(horario);
    const base = { inicio: inicioTexto, fim: fimTexto, horario, usaRelogioLocal };
    if (inicio === null || fim === null || agora === null || inicio === fim) {
      return { ...base, valido: false, ativo: false, progresso: 0 };
    }
    const duracao = (fim - inicio + 86400) % 86400;
    const decorrido = (agora - inicio + 86400) % 86400;
    const ativo = decorrido < duracao;
    const progresso = ativo ? decorrido / duracao * 100 : agora >= fim ? 100 : 0;
    return { ...base, valido: true, ativo, progresso, duracaoHoras: duracao / 3600 };
  }

  if (typeof module === "object" && module.exports) module.exports = { calcularCiclo };
  else {
    escopo.HortaInteligente ??= {};
    escopo.HortaInteligente.calcularCicloIluminacao = calcularCiclo;
  }
})(globalThis);
