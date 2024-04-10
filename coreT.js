const readline = require('readline');
const fs = require('fs');
const path = require('path');
const DataBuilder=require('./src/DataBuilder.js')
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const mainMenu = () => {
  console.log("\nCoreT- Menu");
  console.log("1. Build data");
  console.log("2. Trade");
  console.log("3. Test");
  console.log("0. Exit");
  rl.question('Run: ', (answer) => {
    switch(answer) {
      case '1':
        buildDataMenu();
        break;
      case '2':
        tradeMenu();
        break;
      case '3':
        testMenu();
        break;
      case '0':
        rl.close();
        break;
      default:
        console.log("Opção inválida. Tente novamente.");
        mainMenu();
    }
  });
};


const buildDataMenu = () => {
    rl.question('Insira o ativo base (por exemplo, USDT): ', (ativo) => {
      rl.question('Insira o intervalo (por exemplo, 1d): ', (interval) => {
        rl.question('Insira as datas no formato YYYY-MM-DD, separadas por vírgula (por exemplo, 2022-01-01,2022-01-02): ', (dates) => {
          try {
            
            let dataBuilder = new DataBuilder(ativo, interval, dates.split(','));
            console.log('Dados sendo construídos...');
          } catch (e) {
            console.error('Erro ao construir dados:', e.message);
          }
          mainMenu();
        });
      });
    });
  };
const tradeMenu = () => {
  // Implementar lógica para Trade
};

const testMenu = () => {
  rl.question('Binance ou arquivos? (binance/files): ', (answer) => {
    if (answer === 'binance') {
      // Implementar lógica para Test Binance
    } else if (answer === 'files') {
      listFilesInDirectory('./data');
    } else {
      console.log("Opção inválida. Tente novamente.");
      testMenu();
    }
  });
};

const listFilesInDirectory = (dirPath) => {
  fs.readdir(dirPath, (err, files) => {
    if (err) {
      console.log('Erro ao listar arquivos:', err);
      return;
    }
    console.log('\nArquivos disponíveis:');
    files.forEach(file => console.log(file));
    // Implementar lógica para escolher um arquivo
  });
};

// Iniciar o menu principal
mainMenu();
