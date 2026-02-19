# Watchain ⌚️

DApp per la tracciabilità e la compravendita di orologi di lusso. Utilizza la blockchain per creare un "gemello digitale" (NFT) di ogni orologio, garantendone l'autenticità e gestendo la compravendita in totale sicurezza tramite Smart Contract.

## Tecnologie principali
* **Smart Contracts:** Solidity (Standard ERC-721 per gli orologi, ERC-20 per la moneta di scambio).
* **Infrastruttura:** Hyperledger FireFly (eseguito in ambiente Docker).
* **Backend:** Node.js.
* **Frontend:** React.js.

## Struttura del progetto
* `/contracts`: Codice sorgente degli Smart Contract in Solidity.
* `/frontend`: Interfaccia utente in React.
* `/off-chain`: Backend Node.js (intermediario per FireFly).
* `/scripts`: Script di utilità per il deploy e configurazione.

## Come avviare
1. Clona la repository sul tuo ambiente locale.
2. Apri il terminale, vai nella cartella `/frontend` ed esegui `npm install`.
3. Fai lo stesso nella cartella `/off-chain` eseguendo `npm install`.
4. Assicurati di avere **Docker** (o Docker Desktop) in esecuzione sul tuo PC.
5. Avvia la rete locale tramite la CLI di Hyperledger FireFly prima di lanciare l'applicazione.
