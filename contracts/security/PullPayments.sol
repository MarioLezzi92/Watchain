// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

// Pattern di sicurezza Pull-over-Push
abstract contract PullPayments {
    using SafeERC20 for IERC20;

    // token utilizzato per i pagamenti 
    IERC20 public immutable paymentToken;

    // Indirizzo -> saldo accumulato
    mapping(address => uint256) private _credits;

    // EVENTI
    event CreditAccrued(address indexed payee, uint256 amount);
    event Withdrawal(address indexed payee, uint256 amount);

    constructor(IERC20 token_) {
        paymentToken = token_;
    }
    

    // Lettura pubblica del saldo accumulato
    function creditsOf(address payee) public view returns (uint256) {
        return _credits[payee];
    }


    // Aggiunge fondi al saldo virtuale di un utente
    //  soldi non restano nel contratto
    function _accrueCredit(address payee, uint256 amount) internal {
        require(payee != address(0), "payee=0");
        require(amount > 0, "amount=0");
        _credits[payee] += amount;
        emit CreditAccrued(payee, amount);
    }

    // l'utente preleva i proprio fondi
    function _withdrawCredit(address payee) internal returns (uint256 amount) {
        amount = _credits[payee];
        require(amount > 0, "nessun credito da prelevare"); //controlli  

        // Aggiornamento stato
        // saldo azzerato prima di inviare soldi
        _credits[payee] = 0;
         
        //invio effettivo
        paymentToken.safeTransfer(payee, amount); // interaction
        emit Withdrawal(payee, amount);
    }
}
