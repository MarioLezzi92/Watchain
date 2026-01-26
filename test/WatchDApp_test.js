const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");

describe("Ecosistema WatchChain - Test Suite Ultra Completa", function () {
  async function deployFixture() {
    const [deployer, factoryUser, resellerUser, consumerUser, stranger, stranger2] =
      await ethers.getSigners();

    // 1) Deploy LuxuryCoin (ERC20)
    // ctor: (address reseller, address consumer)
    const LuxuryCoin = await ethers.getContractFactory("LuxuryCoin");
    const coin = await LuxuryCoin.deploy(resellerUser.address, consumerUser.address);
    await coin.waitForDeployment();

    // 2) Deploy WatchNFT
    // ctor: (address factory_)
    const WatchNFT = await ethers.getContractFactory("WatchNFT");
    const nft = await WatchNFT.deploy(factoryUser.address);
    await nft.waitForDeployment();

    // 3) Deploy WatchMarket
    // ctor: (IERC20 paymentToken_, address watchNftAddress_)
    const WatchMarket = await ethers.getContractFactory("WatchMarket");
    const market = await WatchMarket.deploy(await coin.getAddress(), await nft.getAddress());
    await market.waitForDeployment();

    const marketAddr = await market.getAddress();

    // Setup reseller iniziale (owner = deployer)
    await nft.connect(deployer).setReseller(resellerUser.address, true);

    return {
      coin,
      nft,
      market,
      marketAddr,
      deployer,
      factoryUser,
      resellerUser,
      consumerUser,
      stranger,
      stranger2,
    };
  }

  async function fundWithLux({ coin, deployer, to, amount }) {
    await coin.connect(deployer).transfer(to, amount);
  }

  describe("Deployment & Inizializzazione", function () {
    it("Distribuisce 10k LUX a reseller e consumer", async function () {
      const { coin, resellerUser, consumerUser } = await loadFixture(deployFixture);
      expect(await coin.balanceOf(resellerUser.address)).to.equal(ethers.parseEther("10000"));
      expect(await coin.balanceOf(consumerUser.address)).to.equal(ethers.parseEther("10000"));
    });

    it("Imposta factory correttamente nel WatchNFT", async function () {
      const { nft, factoryUser } = await loadFixture(deployFixture);
      expect(await nft.factory()).to.equal(factoryUser.address);
    });

    it("Imposta correttamente indirizzi NFT e token nel Market", async function () {
      const { market, nft, coin } = await loadFixture(deployFixture);
      expect(await market.watch()).to.equal(await nft.getAddress());
      expect(await market.paymentToken()).to.equal(await coin.getAddress());
    });
  });

  describe("WatchNFT - Access Control & Regole", function () {
    it("Solo la factory può manufacture()", async function () {
      const { nft, resellerUser } = await loadFixture(deployFixture);
      await expect(nft.connect(resellerUser).manufacture()).to.be.revertedWith(
        "Only Producer can do this"
      );
    });

    it("manufacture() minta SEMPRE al factory", async function () {
      const { nft, factoryUser } = await loadFixture(deployFixture);
      await nft.connect(factoryUser).manufacture();
      expect(await nft.ownerOf(1)).to.equal(factoryUser.address);
    });

    it("Solo owner può setReseller()", async function () {
      const { nft, resellerUser, stranger } = await loadFixture(deployFixture);
      await expect(nft.connect(resellerUser).setReseller(stranger.address, true)).to.be.reverted;
    });

    it("setReseller blocca factory come reseller", async function () {
      const { nft, deployer, factoryUser } = await loadFixture(deployFixture);
      await expect(nft.connect(deployer).setReseller(factoryUser.address, true)).to.be.revertedWith(
        "factory cannot be reseller"
      );
    });

    it("setReseller blocca cambi di stato ridondanti", async function () {
      const { nft, deployer, resellerUser } = await loadFixture(deployFixture);
      await expect(nft.connect(deployer).setReseller(resellerUser.address, true)).to.be.revertedWith(
        "No state change"
      );
    });

    it("reseller è permanente, activeReseller si può abilitare/disabilitare", async function () {
      const { nft, deployer, stranger } = await loadFixture(deployFixture);

      expect(await nft.reseller(stranger.address)).to.equal(false);
      expect(await nft.activeReseller(stranger.address)).to.equal(false);

      await nft.connect(deployer).setReseller(stranger.address, true);
      expect(await nft.reseller(stranger.address)).to.equal(true);
      expect(await nft.activeReseller(stranger.address)).to.equal(true);

      await nft.connect(deployer).setReseller(stranger.address, false);
      expect(await nft.reseller(stranger.address)).to.equal(true); // resta reseller
      expect(await nft.activeReseller(stranger.address)).to.equal(false); // ma disabilitato
    });

    it("Solo reseller attivo può certify()", async function () {
      const { nft, factoryUser, consumerUser } = await loadFixture(deployFixture);

      await nft.connect(factoryUser).manufacture();
      await nft.connect(factoryUser).transferFrom(factoryUser.address, consumerUser.address, 1);

      await expect(nft.connect(consumerUser).certify(1)).to.be.revertedWith(
        "Only Active Reseller can do this"
      );
    });

    it("certify richiede ownership del token", async function () {
      const { nft, factoryUser, resellerUser } = await loadFixture(deployFixture);
      await nft.connect(factoryUser).manufacture();
      await expect(nft.connect(resellerUser).certify(1)).to.be.revertedWith(
        "Must own watch to certify"
      );
    });

    it("certify non si può fare due volte", async function () {
      const { nft, factoryUser, resellerUser } = await loadFixture(deployFixture);

      await nft.connect(factoryUser).manufacture();
      await nft.connect(factoryUser).transferFrom(factoryUser.address, resellerUser.address, 1);

      await nft.connect(resellerUser).certify(1);
      await expect(nft.connect(resellerUser).certify(1)).to.be.revertedWith("Already certified");
    });

    it("Pausa NFT blocca manufacture e certify", async function () {
      const { nft, deployer, factoryUser, resellerUser } = await loadFixture(deployFixture);

      await nft.connect(deployer).setEmergencyStop(true);
      await expect(nft.connect(factoryUser).manufacture()).to.be.revertedWith("paused");

      await nft.connect(deployer).setEmergencyStop(false);
      await nft.connect(factoryUser).manufacture();
      await nft.connect(factoryUser).transferFrom(factoryUser.address, resellerUser.address, 1);

      await nft.connect(deployer).setEmergencyStop(true);
      await expect(nft.connect(resellerUser).certify(1)).to.be.revertedWith("paused");
    });
  });

  describe("WatchMarket - Primary (Factory -> Reseller) con Escrow", function () {
    it("Primary sale completa con escrow", async function () {
      const { nft, market, coin, factoryUser, resellerUser, marketAddr } = await loadFixture(
        deployFixture
      );
      const price = ethers.parseEther("1000");

      await nft.connect(factoryUser).manufacture();
      await nft.connect(factoryUser).setApprovalForAll(marketAddr, true);

      await market.connect(factoryUser).listPrimary(1, price);
      expect(await nft.ownerOf(1)).to.equal(marketAddr);

      await coin.connect(resellerUser).approve(marketAddr, price);
      await market.connect(resellerUser).buy(1);

      expect(await nft.ownerOf(1)).to.equal(resellerUser.address);
      expect(await market.creditsOf(factoryUser.address)).to.equal(price);
    });

    it("listPrimary fallisce senza approval", async function () {
      const { nft, market, factoryUser } = await loadFixture(deployFixture);
      await nft.connect(factoryUser).manufacture();

      await expect(market.connect(factoryUser).listPrimary(1, ethers.parseEther("1"))).to.be
        .revertedWith("Market not approved for NFT");
    });

    it("listPrimary fallisce se price = 0", async function () {
      const { nft, market, factoryUser, marketAddr } = await loadFixture(deployFixture);
      await nft.connect(factoryUser).manufacture();
      await nft.connect(factoryUser).setApprovalForAll(marketAddr, true);

      await expect(market.connect(factoryUser).listPrimary(1, 0)).to.be.revertedWith("Price > 0");
    });

    it("Solo il producer può listare primary", async function () {
      const { nft, market, factoryUser, resellerUser, marketAddr } = await loadFixture(deployFixture);
      const price = ethers.parseEther("1");

      // mint dal producer
      await nft.connect(factoryUser).manufacture();

      // trasferisci al reseller (così il revert sarà sul require del producer, non su Not owner)
      await nft.connect(factoryUser).transferFrom(factoryUser.address, resellerUser.address, 1);

      // approve al market da reseller (per non far fallire su approval)
      await nft.connect(resellerUser).setApprovalForAll(marketAddr, true);

      // ora deve fallire perché msg.sender non è factory
      await expect(
        market.connect(resellerUser).listPrimary(1, price)
      ).to.be.revertedWith("Only Producer can list primary");
    });

    it("Consumer non può comprare primary", async function () {
      const { nft, market, coin, factoryUser, consumerUser, marketAddr } = await loadFixture(
        deployFixture
      );
      const price = ethers.parseEther("500");

      await nft.connect(factoryUser).manufacture();
      await nft.connect(factoryUser).setApprovalForAll(marketAddr, true);
      await market.connect(factoryUser).listPrimary(1, price);

      await coin.connect(consumerUser).approve(marketAddr, price);
      await expect(market.connect(consumerUser).buy(1)).to.be.revertedWith(
        "Only active resellers can buy primary"
      );
    });

    it("Reseller disabilitato NON può comprare primary", async function () {
      const { nft, market, coin, deployer, factoryUser, resellerUser, marketAddr } = await loadFixture(
        deployFixture
      );
      const price = ethers.parseEther("500");

      // disabilita reseller
      await nft.connect(deployer).setReseller(resellerUser.address, false);

      await nft.connect(factoryUser).manufacture();
      await nft.connect(factoryUser).setApprovalForAll(marketAddr, true);
      await market.connect(factoryUser).listPrimary(1, price);

      await coin.connect(resellerUser).approve(marketAddr, price);
      await expect(market.connect(resellerUser).buy(1)).to.be.revertedWith(
        "Only active resellers can buy primary"
      );
    });
  });

  describe("WatchMarket - Secondary (Reseller -> Consumer) con Certificazione", function () {
    it("Reseller può listare secondary solo se certificato", async function () {
      const { nft, market, factoryUser, resellerUser, marketAddr } = await loadFixture(deployFixture);
      const price = ethers.parseEther("200");

      await nft.connect(factoryUser).manufacture();
      await nft.connect(factoryUser).transferFrom(factoryUser.address, resellerUser.address, 1);

      await nft.connect(resellerUser).setApprovalForAll(marketAddr, true);

      // non certificato => revert
      await expect(market.connect(resellerUser).listSecondary(1, price)).to.be.revertedWith(
        "Only certified watches"
      );

      await nft.connect(resellerUser).certify(1);

      await market.connect(resellerUser).listSecondary(1, price);
      expect(await nft.ownerOf(1)).to.equal(marketAddr);
    });

    it("Consumer può comprare secondary solo se seller è attivo", async function () {
      const { nft, market, coin, deployer, factoryUser, resellerUser, consumerUser, marketAddr } =
        await loadFixture(deployFixture);
      const price = ethers.parseEther("300");

      await nft.connect(factoryUser).manufacture();
      await nft.connect(factoryUser).transferFrom(factoryUser.address, resellerUser.address, 1);

      await nft.connect(resellerUser).certify(1);
      await nft.connect(resellerUser).setApprovalForAll(marketAddr, true);
      await market.connect(resellerUser).listSecondary(1, price);

      // disabilita reseller DOPO listing: con policy nuova deve bloccare l'acquisto
      await nft.connect(deployer).setReseller(resellerUser.address, false);

      await coin.connect(consumerUser).approve(marketAddr, price);
      await expect(market.connect(consumerUser).buy(1)).to.be.revertedWith("Seller disabled");
    });
  });

  describe("Market - Cancel Listing & Update Price", function () {
    it("Cancel listing restituisce NFT anche se market è in pausa", async function () {
      const { nft, market, deployer, factoryUser, marketAddr } = await loadFixture(deployFixture);
      const price = ethers.parseEther("100");

      await nft.connect(factoryUser).manufacture();
      await nft.connect(factoryUser).setApprovalForAll(marketAddr, true);
      await market.connect(factoryUser).listPrimary(1, price);

      // pausa fatta dall'owner del market
      await market.connect(deployer).setEmergencyStop(true);

      await expect(market.connect(factoryUser).cancelListing(1)).to.not.be.reverted;
      expect(await nft.ownerOf(1)).to.equal(factoryUser.address);
    });

    it("Update price su secondary fallisce se seller disabilitato", async function () {
      const { nft, market, deployer, factoryUser, resellerUser, marketAddr } = await loadFixture(
        deployFixture
      );
      const price = ethers.parseEther("200");

      await nft.connect(factoryUser).manufacture();
      await nft.connect(factoryUser).transferFrom(factoryUser.address, resellerUser.address, 1);

      await nft.connect(resellerUser).certify(1);
      await nft.connect(resellerUser).setApprovalForAll(marketAddr, true);
      await market.connect(resellerUser).listSecondary(1, price);

      await nft.connect(deployer).setReseller(resellerUser.address, false);

      await expect(
        market.connect(resellerUser).updateListingPrice(1, ethers.parseEther("250"))
      ).to.be.revertedWith("Seller disabled");
    });
  });

  describe("PullPayments - Withdraw", function () {
    it("Seller può prelevare credits", async function () {
      const { nft, market, coin, factoryUser, resellerUser, marketAddr } = await loadFixture(
        deployFixture
      );
      const price = ethers.parseEther("1000");

      await nft.connect(factoryUser).manufacture();
      await nft.connect(factoryUser).setApprovalForAll(marketAddr, true);
      await market.connect(factoryUser).listPrimary(1, price);

      await coin.connect(resellerUser).approve(marketAddr, price);
      await market.connect(resellerUser).buy(1);

      expect(await market.creditsOf(factoryUser.address)).to.equal(price);

      const before = await coin.balanceOf(factoryUser.address);
      await market.connect(factoryUser).withdraw();
      const after = await coin.balanceOf(factoryUser.address);

      expect(after - before).to.equal(price);
      expect(await market.creditsOf(factoryUser.address)).to.equal(0);
    });
  });
});
