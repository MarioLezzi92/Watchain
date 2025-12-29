// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title EmergencyStop (Circuit Breaker)
/// @notice Minimal Pausable-like module. Inherit and protect functions with `whenNotPaused`.
abstract contract EmergencyStop {
    event Paused(address indexed account);
    event Unpaused(address indexed account);

    bool private _paused;

    modifier whenNotPaused() {
        require(!_paused, "paused");
        _;
    }

    modifier whenPaused() {
        require(_paused, "not paused");
        _;
    }

    function paused() public view returns (bool) {
        return _paused;
    }

    /// @dev implement access control in the inheriting contract (e.g., onlyOwner)
    function _pause() internal whenNotPaused {
        _paused = true;
        emit Paused(msg.sender);
    }

    /// @dev implement access control in the inheriting contract (e.g., onlyOwner)
    function _unpause() internal whenPaused {
        _paused = false;
        emit Unpaused(msg.sender);
    }
}
