// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title PullPayments (Pull-over-Push)
/// @notice Accrues ERC20 credits for payees; they withdraw themselves.
abstract contract PullPayments {
    using SafeERC20 for IERC20;

    IERC20 public immutable paymentToken;

    mapping(address => uint256) private _credits;

    event CreditAccrued(address indexed payee, uint256 amount);
    event Withdrawal(address indexed payee, uint256 amount);

    constructor(IERC20 token_) {
        paymentToken = token_;
    }

    function creditsOf(address payee) public view returns (uint256) {
        return _credits[payee];
    }

    function _accrueCredit(address payee, uint256 amount) internal {
        require(payee != address(0), "payee=0");
        require(amount > 0, "amount=0");
        _credits[payee] += amount;
        emit CreditAccrued(payee, amount);
    }

    function _withdrawCredit(address payee) internal returns (uint256 amount) {
        amount = _credits[payee];
        require(amount > 0, "no credit");
        _credits[payee] = 0; // effects (CEI)
        paymentToken.safeTransfer(payee, amount); // interaction
        emit Withdrawal(payee, amount);
    }
}
