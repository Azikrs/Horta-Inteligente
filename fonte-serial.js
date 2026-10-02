(function registrarFonteSerial(escopo) {
  "use strict";
  const ponte = escopo.ponteHorta?.serial;
  // Abrir index.html no navegador continua oferecendo a demonstração local.
  if (!ponte) return;
  const horta = escopo.HortaInteligente ?? {};
  horta.criarFonteDados = () => {
    let removerOuvinte = null;
    let pausado = false;
    let geracao = 0;
    return {
      tipoFonte: "arduino",
      nomeFonte: "Arduino Serial",
      iniciar(aoReceberDados, aoMudarEstado) {
        removerOuvinte?.();
        const atual = ++geracao;
        pausado = false;
        removerOuvinte = ponte.aoEvento(({ tipo, dados }) => {
          if (tipo === "leitura" && !pausado) aoReceberDados(dados);
          if (tipo === "estado") aoMudarEstado(dados);
        });
        ponte.iniciar().then((estado) => {
          if (atual === geracao) aoMudarEstado(estado);
        }).catch(() => {
          if (atual === geracao) aoMudarEstado({ estado: "erro", mensagem: "Não foi possível iniciar a leitura do Arduino." });
        });
      },
      pausar() { pausado = true; },
      retomar() { pausado = false; },
      estaPausado() { return pausado; },
      parar() { geracao++; removerOuvinte?.(); removerOuvinte = null; },
    };
  };
  escopo.HortaInteligente = horta;
})(window);
