# Watchain ⌚️

DApp per la tracciabilità e la compravendita di orologi di lusso. Utilizza la blockchain per creare un "gemello digitale" (NFT) di ogni orologio, garantendone l'autenticità e gestendo il mercato secondario tramite un sistema di Escrow.

## Tecnologie principali
* **Smart Contracts:** Solidity (Standard ERC-721 per gli orologi, ERC-20 per la moneta di scambio)
* **Infrastruttura:** Hyperledger FireFly 
* **Backend:** Node.js (gestione Webhooks e WebSocket)
* **Frontend:** React.js

## Struttura del progetto
* `/contracts`: Codice sorgente degli Smart Contract in Solidity.
* `/frontend`: Interfaccia utente React.
* `/off-chain`: Backend Node.js per l'interazione con FireFly e l'aggiornamento UI in tempo reale.
* `/scripts`: Script di utilità per il deploy.

## Come avviare
1. Clona la repository.
2. Vai in `/frontend` ed esegui `npm install`.
3. Vai in `/off-chain` ed esegui `npm install`.
4. Assicurati di avere l'infrastruttura FireFly locale in esecuzione prima di lanciare l'app.
