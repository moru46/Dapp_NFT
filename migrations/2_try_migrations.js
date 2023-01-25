const KittyNFT = artifacts.require("kittyNft")
const Factory = artifacts.require("Factory")

module.exports = async (deployer, network, accounts) => {
  let FactoryDeploy = await deployer.deploy(Factory);
  let FactoryDeployed = await Factory.deployed();
  let kittyDeploy = await deployer.deploy(KittyNFT,Factory.address);
  await FactoryDeployed.setKittyAddr(KittyNFT.address)
  await FactoryDeployed.newLottery(1,5,10,{gas: 6000000});
};