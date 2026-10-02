# Horta Inteligente

Software desktop local para acompanhar uma horta automatizada no CaseMod. No Electron, o painel recebe as leituras reais do Arduino pela porta serial. Abrir `index.html` diretamente no navegador mantém a demonstração com dados simulados.

## Preparar um computador novo

Instale o [Node.js LTS](https://nodejs.org/) e o Git. O Node 24.19.0 que foi separado para o SENAC é compatível com este projeto. O Visual Studio Code é opcional para executar, mas é recomendado para editar. Depois clone o repositório pelo GitHub Desktop ou pelo Git e abra um terminal na pasta clonada.

```powershell
npm.cmd ci
npm.cmd start
```

`npm.cmd start` abre a janela Electron em tela cheia real. Não abre uma página da internet. Para sair, use `Alt + F4`.

Na primeira preparação, `npm.cmd ci` precisa de internet para baixar as dependências descritas no `package-lock.json`. Depois disso, `npm.cmd start` funciona localmente. Rode `npm.cmd ci` novamente quando `package.json` ou `package-lock.json` mudar.

Não é necessário instalar Python. A Arduino IDE é usada para enviar o código à placa; feche seu Monitor Serial e Plotter Serial antes de abrir o aplicativo, pois a porta só pode ser utilizada por um programa de cada vez.

## Verificar o projeto

```powershell
npm.cmd test
```

Esse comando confirma os arquivos essenciais, verifica a sintaxe dos JavaScripts e testa interpretação das mensagens, fragmentação, porta ocupada e reconexão, sem alterar configurações ou a biblioteca musical.

## Música local

Na Estação, você pode escolher qualquer pasta externa pelo próprio aplicativo. As faixas originais não são copiadas nem enviadas para a internet; somente um índice é salvo nos dados locais do Electron.

No computador do SENAC, abra **Configurações → Estação → Alterar pasta** e selecione a pasta sincronizada pelo Drive. Se o caminho dessa pasta mudar entre computadores, basta escolhê-la novamente. As músicas e suas capas incorporadas permanecem fora do projeto e do GitHub.

## Dados do Arduino

Execute `npm.cmd start` com o Arduino conectado. O aplicativo procura automaticamente nas portas seriais USB, em **9600 baud**, e confirma a placa somente ao receber uma mensagem válida da horta. Não depende de um número fixo como COM7. O firmware envia uma linha a cada **4 segundos**:

```text
UMIDADE = 40%; BRUTO = 416; BOMBA = 1; LEITURAS = 108
```

O painel mostra umidade, valor bruto, estado da saída da bomba, contador e histórico. A porcentagem é exibida exatamente como enviada pelo Arduino. Os ajustes locais não alteram os limites de acionamento definidos no firmware (liga abaixo de 70%, desliga acima de 80%).

O cartão da Grow Light mostra a programação diária de **08:00 a 20:00**: 12 horas de luz e 12 horas de descanso. Quando o Arduino não envia RTC, o painel usa o horário local do computador e atualiza o ciclo a cada segundo, inclusive durante pausas ou interrupções na serial. Os horários podem ser ajustados em **Configurações → Horta**. Essa programação é apenas visual: não envia comandos à lâmpada. O estado físico da Grow Light continua como não informado até existir telemetria correspondente. Se a fonte enviar RTC e horários de iluminação, esses dados têm prioridade na exibição.

Para fixar uma porta manualmente e desativar a busca automática, configure antes de iniciar (PowerShell):

```powershell
$env:HORTA_PORTA_SERIAL = "COM8"
npm.cmd start
```

Para voltar à busca automática, execute `Remove-Item Env:HORTA_PORTA_SERIAL -ErrorAction SilentlyContinue` antes de iniciar.

A busca prioriza a última placa identificada e dispositivos com identificação Arduino. Testa uma porta por vez, sem enviar comandos, e aguarda até 12 segundos por uma linha válida. Portas ocupadas são ignoradas nessa rodada; após percorrer a lista, tenta novamente depois de 3 segundos. Ao desconectar a placa, consulta as portas novamente para encontrar inclusive uma COM diferente. Portas internas e Bluetooth não participam da busca USB; dispositivos sem identificação USB podem ser selecionados manualmente.

Se uma conexão parar de enviar leituras válidas por 12 segundos, o aplicativo sinaliza a interrupção e volta à busca. Não substitui leituras reais por simulação quando a conexão falha. Linhas inválidas ou incompletas são descartadas.

`serial-arduino.js` recebe e valida as linhas no processo principal. `fonte-serial.js` entrega os dados ao painel pela ponte restrita do Electron. O contrato é:

```text
umidadeSolo
valorBrutoSensor
bombaLigada
iluminacaoLigada
horarioRtc
horarioIluminacaoInicio
horarioIluminacaoFim
estadoArduino (conexão, porta e recebendoDados)
ultimaAtualizacao
numeroLeitura
intervaloAtualizacao
fonteDados
```

O painel não exige LDR. Os campos de iluminação e RTC são opcionais e permanecem nulos quando não enviados pela fonte.

## Arquivos principais

- `aplicativo.js`: processo principal e janela segura do Electron.
- `precarregamento.js`: ponte restrita entre Electron e interface.
- `configuracoes-aplicativo.js` e `configuracoes.js`: validação, persistência e uso das preferências.
- `biblioteca-musical.js` e `estacao.js`: índice local e player de música.
- `serial-arduino.js` e `fonte-serial.js`: leitura serial do Arduino e entrega ao painel.
- `ciclo-iluminacao.js`: cálculo da programação visual de iluminação.
- `simulador.js`: demonstração ao abrir o HTML diretamente no navegador.
- `principal.js`: contrato, validação e atualização do painel.
- `interface-sistema.js`: navegação, temas, Configurações e overlays.
- `sons.js`: identidade sonora sintetizada localmente.

## Checklist para levar ao SENAC

Antes de sair de casa:

1. confira no GitHub Desktop se todos os arquivos-fonte desta versão foram adicionados ao commit;
2. faça o commit e o `Push origin`;
3. confirme no site do GitHub que arquivos como `estacao.js`, `sons.js`, `biblioteca-musical.js`, `precarregamento.js` e `package-lock.json` aparecem no repositório;
4. se quiser um plano B no pendrive, faça um clone novo ou baixe o ZIP do GitHub depois do push.

No computador do SENAC:

```powershell
npm.cmd ci
npm.cmd test
npm.cmd start
```

Não copie a pasta atual inteira para o pendrive. `node_modules/`, `out/` e o histórico `.git/` local são grandes e reproduzíveis; um clone novo é menor e comprova que o projeto não depende de arquivos escondidos no seu computador.

## Git e builds

O código-fonte, o `package-lock.json`, os ícones e este guia devem ir para o GitHub. Não envie `node_modules/`, `out/`, bibliotecas musicais pessoais ou instaladores. Esses itens são grandes ou reproduzíveis e continuam protegidos pelo `.gitignore`.

Para gerar um build futuramente, use `npm.cmd run make`. O diretório `out/` gerado continua fora do GitHub.
