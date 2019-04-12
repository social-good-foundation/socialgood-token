var SocialGoodToken = artifacts.require('./SocialGoodToken.sol');

module.exports = function(deployer) {
  deployer.deploy(SocialGoodToken);
};
