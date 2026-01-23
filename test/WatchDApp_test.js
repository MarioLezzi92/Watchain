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

    it("knownReseller diventa sticky quando abiliti reseller", async function () {
      const { nft, deployer, stranger } = await loadFixture(deployFixture);
      expect(await nft.knownReseller(stranger.address)).to.equal(false);

      await nft.connect(deployer).setReseller(stranger.address, true);
      expect(await nft.knownReseller(stranger.address)).to.equal(true);

      await nft.connect(deployer).setReseller(stranger.address, false);
      expect(await nft.knownReseller(stranger.address)).to.equal(true);
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

    it("Consumer non può comprare primary", async function () {
      const { nft, market, coin, factoryUser, consumerUser, marketAddr } = await loadFixture(
        deployFixture
      );
      const price = ethers.parseEther("1000");

      await nft.connect(factoryUser).manufacture();
      await nft.connect(factoryUser).setApprovalForAll(marketAddr, true);
      await market.connect(factoryUser).listPrimary(1, price);

      await coin.connect(consumerUser).approve(marketAddr, price);
      await expect(market.connect(consumerUser).buy(1)).to.be.revertedWith(
        "Only resellers can buy primary"
      );
    });

    it("Ex reseller disabilitato può ancora comprare primary (knownReseller sticky)", async function () {
      const { nft, market, coin, deployer, factoryUser, resellerUser, marketAddr } = await loadFixture(
        deployFixture
      );
      const price = ethers.parseEther("500");

      await nft.connect(deployer).setReseller(resellerUser.address, false);

      await nft.connect(factoryUser).manufacture();
      await nft.connect(factoryUser).setApprovalForAll(marketAddr, true);
      await market.connect(factoryUser).listPrimary(1, price);

      await coin.connect(resellerUser).approve(marketAddr, price);
      await market.connect(resellerUser).buy(1);

      expect(await nft.ownerOf(1)).to.equal(resellerUser.address);
    });
  });

  describe("WatchMarket - Secondary (Reseller -> Consumer) con Certificazione", function () {
    it("Secondary: fallisce senza certificazione, poi passa dopo certify, con escrow", async function () {
      const { nft, market, coin, factoryUser, resellerUser, consumerUser, marketAddr } =
        await loadFixture(deployFixture);
      const price = ethers.parseEther("2000");

      await nft.connect(factoryUser).manufacture();
      await nft.connect(factoryUser).transferFrom(factoryUser.address, resellerUser.address, 1);

      await nft.connect(resellerUser).setApprovalForAll(marketAddr, true);

      await expect(market.connect(resellerUser).listSecondary(1, price)).to.be.revertedWith(
        "Only certified watches"
      );

      await nft.connect(resellerUser).certify(1);
      expect(await nft.certified(1)).to.equal(true);

      await market.connect(resellerUser).listSecondary(1, price);
      expect(await nft.ownerOf(1)).to.equal(marketAddr);

      await coin.connect(consumerUser).approve(marketAddr, price);
      await market.connect(consumerUser).buy(1);

      expect(await nft.ownerOf(1)).to.equal(consumerUser.address);
      expect(await market.creditsOf(resellerUser.address)).to.equal(price);
    });

    it("Reseller NON può comprare secondary (protezione arbitraggio)", async function () {
      const { nft, market, coin, deployer, factoryUser, resellerUser, stranger, marketAddr } =
        await loadFixture(deployFixture);
      const price = ethers.parseEther("500");

      await nft.connect(deployer).setReseller(stranger.address, true);

      await nft.connect(factoryUser).manufacture();
      await nft.connect(factoryUser).transferFrom(factoryUser.address, resellerUser.address, 1);

      await nft.connect(resellerUser).certify(1);
      await nft.connect(resellerUser).setApprovalForAll(marketAddr, true);
      await market.connect(resellerUser).listSecondary(1, price);

      await fundWithLux({ coin, deployer, to: stranger.address, amount: price });
      await coin.connect(stranger).approve(marketAddr, price);

      await expect(market.connect(stranger).buy(1)).to.be.revertedWith(
        "Only consumer can buy secondary"
      );
    });

    it("Freeze: se disabiliti seller, buy fallisce ma cancelListing funziona", async function () {
      const { nft, market, coin, deployer, factoryUser, resellerUser, consumerUser, marketAddr } =
        await loadFixture(deployFixture);
      const price = ethers.parseEther("700");

      await nft.connect(factoryUser).manufacture();
      await nft.connect(factoryUser).transferFrom(factoryUser.address, resellerUser.address, 1);

      await nft.connect(resellerUser).certify(1);
      await nft.connect(resellerUser).setApprovalForAll(marketAddr, true);
      await market.connect(resellerUser).listSecondary(1, price);

      await nft.connect(deployer).setReseller(resellerUser.address, false);

      await coin.connect(consumerUser).approve(marketAddr, price);
      await expect(market.connect(consumerUser).buy(1)).to.be.revertedWith("Seller disabled");

      await market.connect(resellerUser).cancelListing(1);
      expect(await nft.ownerOf(1)).to.equal(resellerUser.address);
    });

    it("updateListingPrice: ok se attivo, FAIL se disabilitato (solo SECONDARY)", async function () {
      const { nft, market, deployer, factoryUser, resellerUser, marketAddr } = await loadFixture(
        deployFixture
      );
      const initialPrice = ethers.parseEther("100");
      const newPrice = ethers.parseEther("150");

      await nft.connect(factoryUser).manufacture();
      await nft.connect(factoryUser).transferFrom(factoryUser.address, resellerUser.address, 1);

      await nft.connect(resellerUser).certify(1);
      await nft.connect(resellerUser).setApprovalForAll(marketAddr, true);
      await market.connect(resellerUser).listSecondary(1, initialPrice);

      await market.connect(resellerUser).updateListingPrice(1, newPrice);
      let listing = await market.listings(1);
      expect(listing.price).to.equal(newPrice);

      await nft.connect(deployer).setReseller(resellerUser.address, false);
      await expect(market.connect(resellerUser).updateListingPrice(1, initialPrice)).to.be.revertedWith(
        "Seller disabled"
      );
    });
  });

  describe("Integrità Escrow, Listing e Failures", function () {
    it("Already listed: non puoi listare due volte lo stesso tokenId", async function () {
      const { nft, market, factoryUser, marketAddr } = await loadFixture(deployFixture);
      const price = ethers.parseEther("10");

      await nft.connect(factoryUser).manufacture();
      await nft.connect(factoryUser).setApprovalForAll(marketAddr, true);

      await market.connect(factoryUser).listPrimary(1, price);
      await expect(market.connect(factoryUser).listPrimary(1, price)).to.be.revertedWith(
        "Already listed"
      );
    });

    it("cancelListing fallisce se non sei il seller", async function () {
      const { nft, market, factoryUser, resellerUser, marketAddr } = await loadFixture(deployFixture);
      const price = ethers.parseEther("10");

      await nft.connect(factoryUser).manufacture();
      await nft.connect(factoryUser).setApprovalForAll(marketAddr, true);
      await market.connect(factoryUser).listPrimary(1, price);

      await expect(market.connect(resellerUser).cancelListing(1)).to.be.revertedWith("Not seller");
    });

    it("buy fallisce se item non listato", async function () {
      const { market, resellerUser } = await loadFixture(deployFixture);
      await expect(market.connect(resellerUser).buy(999)).to.be.revertedWith("Item not listed");
    });

    it("updateListingPrice fallisce se item non listato", async function () {
      const { market, factoryUser } = await loadFixture(deployFixture);
      await expect(market.connect(factoryUser).updateListingPrice(999, 1)).to.be.revertedWith(
        "Item not listed"
      );
    });

    it("buy fallisce se seller compra il proprio item", async function () {
      const { nft, market, factoryUser, marketAddr } = await loadFixture(deployFixture);
      const price = ethers.parseEther("10");

      await nft.connect(factoryUser).manufacture();
      await nft.connect(factoryUser).setApprovalForAll(marketAddr, true);
      await market.connect(factoryUser).listPrimary(1, price);

      await expect(market.connect(factoryUser).buy(1)).to.be.revertedWith("Seller cannot buy own item");
    });

    it("cancelListing restituisce NFT e azzera listing", async function () {
      const { nft, market, factoryUser, marketAddr } = await loadFixture(deployFixture);
      const price = ethers.parseEther("10");

      await nft.connect(factoryUser).manufacture();
      await nft.connect(factoryUser).setApprovalForAll(marketAddr, true);
      await market.connect(factoryUser).listPrimary(1, price);

      expect(await nft.ownerOf(1)).to.equal(marketAddr);

      await market.connect(factoryUser).cancelListing(1);

      expect(await nft.ownerOf(1)).to.equal(factoryUser.address);
      const listing = await market.listings(1);
      expect(listing.seller).to.equal(ethers.ZeroAddress);
    });

    it("Price too large (uint88) -> revert", async function () {
      const { nft, market, factoryUser, marketAddr } = await loadFixture(deployFixture);

      await nft.connect(factoryUser).manufacture();
      await nft.connect(factoryUser).setApprovalForAll(marketAddr, true);

      const tooLarge = 1n << 88n; // > max uint88
      await expect(market.connect(factoryUser).listPrimary(1, tooLarge)).to.be.revertedWith(
        "Price too large"
      );
    });
  });

  describe("Emergency Stop (Market) & Withdraw", function () {
    it("Pausa Market blocca list/buy/update, ma NON blocca cancelListing", async function () {
      const { nft, market, coin, deployer, factoryUser, resellerUser, marketAddr } = await loadFixture(
        deployFixture
      );
      const price = ethers.parseEther("100");

      await nft.connect(factoryUser).manufacture();
      await nft.connect(factoryUser).setApprovalForAll(marketAddr, true);
      await market.connect(factoryUser).listPrimary(1, price);

      await market.connect(deployer).setEmergencyStop(true);

      await expect(market.connect(factoryUser).updateListingPrice(1, price)).to.be.revertedWith("paused");

      await coin.connect(resellerUser).approve(marketAddr, price);
      await expect(market.connect(resellerUser).buy(1)).to.be.revertedWith("paused");

      await market.connect(factoryUser).cancelListing(1);
      expect(await nft.ownerOf(1)).to.equal(factoryUser.address);
    });

    it("withdraw trasferisce token e azzera crediti", async function () {
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
      const balanceBefore = await coin.balanceOf(factoryUser.address);

      await market.connect(factoryUser).withdraw();

      expect(await market.creditsOf(factoryUser.address)).to.equal(0);
      expect(await coin.balanceOf(factoryUser.address)).to.equal(balanceBefore + price);
    });

    it("withdraw senza crediti reverte", async function () {
      const { market, resellerUser } = await loadFixture(deployFixture);
      await expect(market.connect(resellerUser).withdraw()).to.be.revertedWith(
        "nessun credito da prelevare"
      );
    });

    it("no double-withdraw (secondo withdraw reverte)", async function () {
      const { nft, market, coin, factoryUser, resellerUser, marketAddr } = await loadFixture(
        deployFixture
      );
      const price = ethers.parseEther("123");

      await nft.connect(factoryUser).manufacture();
      await nft.connect(factoryUser).setApprovalForAll(marketAddr, true);
      await market.connect(factoryUser).listPrimary(1, price);

      await coin.connect(resellerUser).approve(marketAddr, price);
      await market.connect(resellerUser).buy(1);

      await market.connect(factoryUser).withdraw();
      await expect(market.connect(factoryUser).withdraw()).to.be.revertedWith("nessun credito da prelevare");
    });
  });

  describe("Event sanity", function () {
    it("Emette PriceUpdated con old/new corretti", async function () {
      const { nft, market, factoryUser, marketAddr } = await loadFixture(deployFixture);
      const initialPrice = ethers.parseEther("10");
      const newPrice = ethers.parseEther("20");

      await nft.connect(factoryUser).manufacture();
      await nft.connect(factoryUser).setApprovalForAll(marketAddr, true);
      await market.connect(factoryUser).listPrimary(1, initialPrice);

      await expect(market.connect(factoryUser).updateListingPrice(1, newPrice))
        .to.emit(market, "PriceUpdated")
        .withArgs(1, initialPrice, newPrice);
    });

    it("Emette Canceled correttamente", async function () {
      const { nft, market, factoryUser, marketAddr } = await loadFixture(deployFixture);
      const price = ethers.parseEther("10");

      await nft.connect(factoryUser).manufacture();
      await nft.connect(factoryUser).setApprovalForAll(marketAddr, true);
      await market.connect(factoryUser).listPrimary(1, price);

      await expect(market.connect(factoryUser).cancelListing(1))
        .to.emit(market, "Canceled")
        .withArgs(1, factoryUser.address);
    });

    it("Emette Purchased correttamente (primary)", async function () {
      const { nft, market, coin, factoryUser, resellerUser, marketAddr } = await loadFixture(
        deployFixture
      );
      const price = ethers.parseEther("77");

      await nft.connect(factoryUser).manufacture();
      await nft.connect(factoryUser).setApprovalForAll(marketAddr, true);
      await market.connect(factoryUser).listPrimary(1, price);

      await coin.connect(resellerUser).approve(marketAddr, price);

      await expect(market.connect(resellerUser).buy(1))
        .to.emit(market, "Purchased")
        .withArgs(1, resellerUser.address, factoryUser.address, price, 0); // SaleType.PRIMARY = 0
    });
  });
});
