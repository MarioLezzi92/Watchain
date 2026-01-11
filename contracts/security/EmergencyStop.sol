// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// EmergencyStop (Circuit Breaker)
// Permette di congelare il contratto in caso di attacchi/bug 
// protegge le funzioni critiche con "whenNotPaused"
abstract contract EmergencyStop {
    event Paused(address indexed account);
    event Unpaused(address indexed account);

    bool private _paused;


    // lascia passare solo se il sistema è attivo 
    modifier whenNotPaused() {
        require(!_paused, "paused");
        _;
    }

    // lascia passre solo se il sistema è bloccato
    modifier whenPaused() {
        require(_paused, "not paused");
        _;
    }

    // getter per sapere se il sistema è in pausa
    function paused() public view returns (bool) {
        return _paused;
    }


    // Blocca il contrato, deve essere chiamata da una funzione con controlli di accesso
    function _pause() internal whenNotPaused {
        _paused = true;
        emit Paused(msg.sender);
    }

    // sblocca il contratto
    function _unpause() internal whenPaused {
        _paused = false;
        emit Unpaused(msg.sender);
    }
}
2