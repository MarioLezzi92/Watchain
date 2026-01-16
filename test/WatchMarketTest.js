import { expect } from "chai";
import hre from "hardhat"; 

// Accediamo a ethers solo dopo che hre è stato caricato
const ethers = hre.ethers;

describe("Watchain Ecosystem - Integration Tests", function () {
  let lux, nft, market;
  let owner, producer, reseller, consumer;

  before(async function () {
    // Verifica di sicurezza: se ethers è ancora undefined, il plugin non è caricato nel config
    if (!ethers) {
      throw new Error("Plugin 'hardhat-ethers' non caricato. Controlla il tuo hardhat.config.js");
    }

    [owner, producer, reseller, consumer] = await ethers.getSigners();

    // Deploy LUX
    const LuxuryCoin = await ethers.getContractFactory("LuxuryCoin");
    lux = await LuxuryCoin.deploy(reseller.address, consumer.address);

    // Deploy NFT
    const WatchNFT = await ethers.getContractFactory("WatchNFT");
    nft = await WatchNFT.deploy(producer.address);

    // Deploy Market
    const WatchMarket = await ethers.getContractFactory("WatchMarket");
    market = await WatchMarket.deploy(await lux.getAddress(), await nft.getAddress());

    // Abilita Reseller
    await nft.connect(owner).setReseller(reseller.address, true);
  });

  it("Dovrebbe impedire listing secondario senza certificazione", async function () {
    await nft.connect(producer).manufacture(reseller.address);
    await nft.connect(reseller).approve(await market.getAddress(), 1);

    [cite_start]// Deve fallire come previsto dal tuo WatchMarket.sol [cite: 33-34]
    await expect(
      market.connect(reseller).listSecondary(1, ethers.parseEther("500"))
    ).to.be.revertedWith("Only certified watches can be listed");
  });

  it("Dovrebbe gestire correttamente il pattern Pull Payments", async function () {
    await nft.connect(reseller).certify(1);
    await market.connect(reseller).listSecondary(1, ethers.parseEther("1000"));

    await lux.connect(consumer).approve(await market.getAddress(), ethers.parseEther("1000"));
    await market.connect(consumer).buy(1);

    [cite_start]// Verifica credito nel market (non nel wallet) [cite: 57-58]
    expect(await market.creditsOf(reseller.address)).to.equal(ethers.parseEther("1000"));
  });
});