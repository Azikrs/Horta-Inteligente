"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { calcularCiclo } = require("../ciclo-iluminacao");
const { interpretarLinhaArduino } = require("../serial-arduino");
const dataLocal = (horas, minutos = 0, segundos = 0) => new Date(2026, 9, 2, horas, minutos, segundos);

test("ciclo diário de 12 horas: inclui 08h e encerra exatamente às 20h", () => {
  for (const [horas, minutos, segundos, ativo] of [[7, 59, 59, false], [8, 0, 0, true], [19, 59, 59, true], [20, 0, 0, false], [23, 59, 59, false], [0, 0, 0, false]]) {
    const ciclo = calcularCiclo({}, {}, dataLocal(horas, minutos, segundos));
    assert.equal(ciclo.ativo, ativo);
    assert.equal(ciclo.duracaoHoras, 12);
    assert.equal(ciclo.usaRelogioLocal, true);
  }
  assert.equal(calcularCiclo({}, {}, dataLocal(8)).progresso, 0);
  assert.equal(calcularCiclo({}, {}, dataLocal(14)).progresso, 50);
  assert.equal(calcularCiclo({}, {}, dataLocal(20)).progresso, 100);
  assert.equal(calcularCiclo({}, {}, dataLocal(0)).progresso, 0);
});

test("mensagem atual do Arduino permite exibir o ciclo sem inventar telemetria", () => {
  const dados = interpretarLinhaArduino("UMIDADE = 40%; BRUTO = 415; BOMBA = 1; LEITURAS = 3", "COM7");
  const original = structuredClone(dados);
  const ciclo = calcularCiclo(dados, {}, dataLocal(14));
  assert.equal(ciclo.ativo, true);
  assert.equal(ciclo.horario, "14:00:00");
  assert.deepEqual(dados, original);
  assert.equal(dados.horarioRtc, null);
  assert.equal(dados.iluminacaoLigada, null);
});

test("RTC e horários enviados pela fonte têm prioridade sobre o computador", () => {
  const ciclo = calcularCiclo({ horarioRtc: "21:00:00", horarioIluminacaoInicio: "20:00", horarioIluminacaoFim: "08:00" }, {}, dataLocal(12));
  assert.equal(ciclo.usaRelogioLocal, false);
  assert.equal(ciclo.ativo, true);
  assert.equal(ciclo.duracaoHoras, 12);
  assert.equal(ciclo.horario, "21:00:00");
});

test("ajustes locais são respeitados e horários inválidos não viram ciclo ativo", () => {
  assert.equal(calcularCiclo({}, { horarioIluminacaoInicio: "09:00", horarioIluminacaoFim: "21:00" }, dataLocal(8)).ativo, false);
  for (const configuracao of [{ horarioIluminacaoInicio: "99:00" }, { horarioIluminacaoInicio: "20:00", horarioIluminacaoFim: "20:00" }]) {
    assert.equal(calcularCiclo({}, configuracao, dataLocal(14)).valido, false);
  }
});
