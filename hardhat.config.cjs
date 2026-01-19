require("@nomicfoundation/hardhat-toolbox");

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: "0.8.20", // Versione dei tuoi contratti
  networks: {
    hardhat: {
      chainId: 31337
    },
    // Se ti serve localhost per Firefly/Docker
    localhost: {
      url: "http://127.0.0.1:8545",
    }
  },
  paths: {
    artifacts: "./artifacts",
    cache: "./cache",
    sources: "./contracts",
    tests: "./test",
  },
};