var web3 = require("web3");
var HDWalletProvider = require("truffle-hdwallet-provider");

module.exports = {
  networks: {
    development: {
      host: "127.0.0.1",
      port: 8545,
      network_id: "*" // Match any network id
    },
	ropsten: {
      provider: function() {
        return new HDWalletProvider(process.env.ETH_MNEMONIC, process.env.ETH_ROPSTEN_ENDPOINT)
      },
      network_id: 3,
      gasPrice: web3.utils.toWei("10", "gwei")
    }
  }
};
