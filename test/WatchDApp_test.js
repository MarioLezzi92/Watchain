import { expect } from "chai";
import hardhat from "hardhat";
const { ethers } = hardhat;
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers.js";

describe("WatchDApp System Security & Flow", function () {

  // --- FIXTURE: SETUP INIZIALE ---
  async function deploySystemFixture() {
    const [producer, reseller, consumer, hacker] = await ethers.getSigners();

    // 1. Deploy LuxuryCoin (LUX)
    const LuxuryCoin = await ethers.getContractFactory("LuxuryCoin");
    const lux = await LuxuryCoin.deploy(reseller.address, consumer.address);
    await lux.waitForDeployment(); 

    // 2. Deploy WatchNFT
    const WatchNFT = await ethers.getContractFactory("WatchNFT");
    const nft = await WatchNFT.deploy(producer.address);
    await nft.waitForDeployment();

    // 3. Deploy WatchMarket
    const WatchMarket = await ethers.getContractFactory("WatchMarket");
    const market = await WatchMarket.deploy(await lux.getAddress(), await nft.getAddress());
    await market.waitForDeployment();

    // 4. Configurazione Iniziale
    await nft.connect(producer).setApprovalForAll(await market.getAddress(), true);
    
    // Setup Fondi per i test
    const maxUint = 2n ** 256n - 1n; // Valore massimo uint256
    await lux.connect(reseller).approve(await market.getAddress(), maxUint);
    await lux.connect(consumer).approve(await market.getAddress(), maxUint);

    // ABILITIAMO IL RESELLER
    await nft.connect(producer).setReseller(reseller.address, true);

    return { lux, nft, market, producer, reseller, consumer, hacker };
  }

  // --- TEST GROUP 1: INTEGRITÀ DEL DEPLOY ---
  describe("Deployment & Configuration", function () {
    it("Should set the right owner (Producer)", async function () {
      const { nft, producer } = await loadFixture(deploySystemFixture);
      expect(await nft.owner()).to.equal(producer.address);
    });

    it("Should distribute initial LUX tokens correctly", async function () {
      const { lux, reseller, consumer } = await loadFixture(deploySystemFixture);
      const expectedBalance = ethers.parseEther("10000");
      expect(await lux.balanceOf(reseller.address)).to.equal(expectedBalance);
      expect(await lux.balanceOf(consumer.address)).to.equal(expectedBalance);
    });
  });

  // --- TEST GROUP 2: CICLO DI VITA PRODOTTO (MINTING) ---
  describe("Production (Minting)", function () {
    it("Should allow Producer to mint a new watch", async function () {
      const { nft, producer } = await loadFixture(deploySystemFixture);
      
      await expect(nft.connect(producer).manufacture(producer.address))
        .to.emit(nft, "Manufactured")
        .withArgs(1, producer.address);
        
      expect(await nft.ownerOf(1)).to.equal(producer.address);
    });

    it("Should REJECT minting from non-producer (Security)", async function () {
      const { nft, hacker } = await loadFixture(deploySystemFixture);
      await expect(nft.connect(hacker).manufacture(hacker.address))
        .to.be.revertedWith("Only Producer can do this"); 
    });
  });

  // --- TEST GROUP 3: MERCATO PRIMARIO (PRODUCER -> RESELLER) ---
  describe("Primary Market", function () {
    it("Should allow Producer to list on Primary", async function () {
      const { nft, market, producer } = await loadFixture(deploySystemFixture);
      await nft.manufacture(producer.address); // ID 1

      const price = ethers.parseEther("100");
      
      await expect(market.connect(producer).listPrimary(1, price))
        .to.emit(market, "Listed")
        .withArgs(1, producer.address, price, 0); // 0 = SaleType.PRIMARY
    });

    it("Should REJECT Consumer buying from Primary (RBAC Security)", async function () {
      const { nft, market, producer, consumer } = await loadFixture(deploySystemFixture);
      await nft.manufacture(producer.address);
      await market.connect(producer).listPrimary(1, ethers.parseEther("100"));

      await expect(market.connect(consumer).buy(1))
        .to.be.revertedWith("Only resellers can buy primary");
    });

    it("Should allow Reseller to buy from Primary", async function () {
      const { nft, market, producer, reseller } = await loadFixture(deploySystemFixture);
      await nft.manufacture(producer.address);
      const price = ethers.parseEther("500");
      await market.connect(producer).listPrimary(1, price);

      await expect(market.connect(reseller).buy(1))
        .to.emit(market, "Purchased")
        .withArgs(1, reseller.address, producer.address, price, 0);

      expect(await nft.ownerOf(1)).to.equal(reseller.address);
    });
  });

  // --- TEST GROUP 4: CERTIFICAZIONE E SECONDARIO ---
  describe("Certification & Secondary Market", function () {
    it("Should REJECT listing on Secondary if not certified", async function () {
      const { nft, market, producer, reseller } = await loadFixture(deploySystemFixture);
      await nft.manufacture(producer.address);
      await market.connect(producer).listPrimary(1, ethers.parseEther("100"));
      await market.connect(reseller).buy(1);

      await expect(market.connect(reseller).listSecondary(1, ethers.parseEther("200")))
        .to.be.revertedWith("Only certified watches");
    });

    it("Should allow Reseller to certify owned watch", async function () {
      const { nft, market, producer, reseller } = await loadFixture(deploySystemFixture);
      await nft.manufacture(producer.address);
      await market.connect(producer).listPrimary(1, ethers.parseEther("100"));
      await market.connect(reseller).buy(1);

      await expect(nft.connect(reseller).certify(1))
        .to.emit(nft, "Certified")
        .withArgs(1, reseller.address);
        
      expect(await nft.certified(1)).to.equal(true);
    });

    it("Should allow Consumer to buy on Secondary", async function () {
      const { nft, market, producer, reseller, consumer } = await loadFixture(deploySystemFixture);
      
      await nft.manufacture(producer.address);
      await market.connect(producer).listPrimary(1, ethers.parseEther("100"));
      await market.connect(reseller).buy(1);
      await nft.connect(reseller).certify(1);

      await nft.connect(reseller).setApprovalForAll(await market.getAddress(), true);

      const secPrice = ethers.parseEther("150");
      await market.connect(reseller).listSecondary(1, secPrice);

      await expect(market.connect(consumer).buy(1))
        .to.emit(market, "Purchased")
        .withArgs(1, consumer.address, reseller.address, secPrice, 1);
      
      expect(await nft.ownerOf(1)).to.equal(consumer.address);
    });
  });

  // --- TEST GROUP 5: PULL PAYMENTS ---
  describe("Pull Payments (Security Pattern)", function () {
    it("Should accumulate credits instead of direct transfer", async function () {
      const { nft, market, producer, reseller } = await loadFixture(deploySystemFixture);
      await nft.manufacture(producer.address);
      const price = ethers.parseEther("1000");
      await market.connect(producer).listPrimary(1, price);
      
      await market.connect(reseller).buy(1);

      const credits = await market.creditsOf(producer.address);
      expect(credits).to.equal(price);
    });

    it("Should allow seller to withdraw credits", async function () {
      const { lux, nft, market, producer, reseller } = await loadFixture(deploySystemFixture);
      await nft.manufacture(producer.address);
      await market.connect(producer).listPrimary(1, ethers.parseEther("100"));
      await market.connect(reseller).buy(1);

      const initialBalance = await lux.balanceOf(producer.address);
      
      await expect(market.connect(producer).withdraw())
        .to.emit(market, "CreditsWithdrawn")
        .withArgs(producer.address, ethers.parseEther("100"));

      const finalBalance = await lux.balanceOf(producer.address);
      expect(finalBalance).to.equal(initialBalance + ethers.parseEther("100"));
    });
  });

  // --- TEST GROUP 6: EMERGENCY STOP & DEMO SCENARIO ---
  describe("Emergency & Role Management", function () {
    it("Should freeze market operations when paused", async function () {
      const { market, producer } = await loadFixture(deploySystemFixture);
      await market.connect(producer).setEmergencyStop(true);

      await expect(market.connect(producer).listPrimary(1, 100))
        .to.be.revertedWith("paused");
    });

    it("DEMO SCENARIO: Reseller disabled -> Error -> Enabled -> Success", async function () {
      const { nft, producer, reseller } = await loadFixture(deploySystemFixture);
      
      // 1. Disabilitiamo il reseller
      await nft.connect(producer).setReseller(reseller.address, false);

      // 2. Creiamo un orologio e lo diamo al reseller
      await nft.manufacture(reseller.address);

      // 3. Il Reseller prova a certificare -> DEVE FALLIRE
      await expect(nft.connect(reseller).certify(1))
        .to.be.revertedWith("Only Active Reseller can do this");

      // 4. Il Producer riabilita il Reseller
      await nft.connect(producer).setReseller(reseller.address, true);

      // 5. Il Reseller riprova -> DEVE FUNZIONARE
      await expect(nft.connect(reseller).certify(1))
        .to.emit(nft, "Certified");
    });
  });
});