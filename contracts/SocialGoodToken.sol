pragma solidity ^0.4.24;

import 'openzeppelin-solidity/contracts/math/SafeMath.sol';
import 'openzeppelin-solidity/contracts/ownership/Superuser.sol';
import 'openzeppelin-solidity/contracts/token/ERC20/CappedToken.sol';
import 'openzeppelin-solidity/contracts/token/ERC20/PausableToken.sol';
import 'openzeppelin-solidity/contracts/token/ERC20/TokenTimelock.sol';

/// @title Token contract - ERC20 compatible SocialGood token contract.
/// @author Social Good Foundation Inc. - <info@socialgood-foundation.com>
contract SocialGoodToken is CappedToken(210000000e18), PausableToken, Superuser { // capped at 210 mil
    using SafeMath for uint256;

    /*
     *  Constants / Token meta data
     */
    string constant public name = 'SocialGood'; // Token name
    string constant public symbol = 'SG';       // Token symbol
    uint8 constant public decimals = 18;
    uint256 constant public totalTeamTokens = 3100000e18;  // 3.1 mil reserved tokens for the team
    uint256 constant private secsInYear = 365 * 86400 + 21600;  // including the extra seconds in a leap year

    /*
     *  Timelock contracts for team's tokens
     */
    address public timelock1;
    address public timelock2;
    address public timelock3;
    address public timelock4;

    /*
     *  Events
     */
    event Burn(address indexed burner, uint256 value);

    /*
     *  Contract functions
     */
    /**
     * @dev Contract constructor function
     */
    constructor() public {
        paused = true; // not to allow token transfers initially
    }

    /**
     * @dev Initialize this contract
     * @param socialGoodTeamAddr Address to receive unlocked team tokens
     * @param startTimerAt Time to start counting the lock-up periods
     */
    function initializeTeamTokens(address socialGoodTeamAddr, uint256 startTimerAt) external {
        require(socialGoodTeamAddr != 0 && startTimerAt > 0);

        // Tokens for the SocialGood team (loked-up initially)
        // 25% tokens will be released every year
        timelock1 = new TokenTimelock(ERC20Basic(this), socialGoodTeamAddr, startTimerAt.add(secsInYear));
        timelock2 = new TokenTimelock(ERC20Basic(this), socialGoodTeamAddr, startTimerAt.add(secsInYear.mul(2)));
        timelock3 = new TokenTimelock(ERC20Basic(this), socialGoodTeamAddr, startTimerAt.add(secsInYear.mul(3)));
        timelock4 = new TokenTimelock(ERC20Basic(this), socialGoodTeamAddr, startTimerAt.add(secsInYear.mul(4)));
        mint(timelock1, totalTeamTokens / 4);
        mint(timelock2, totalTeamTokens / 4);
        mint(timelock3, totalTeamTokens / 4);
        mint(timelock4, totalTeamTokens / 4);
    }

    /**
     * @dev Burns a specific amount of tokens.
     * @param _value The amount of token to be burned.
     */
    function burn(uint256 _value) public onlyOwner {
        _burn(msg.sender, _value);
    }

    // save some gas by making only one contract call
    function burnFrom(address _from, uint256 _value)
        public
        onlyOwner
    {
        assert(transferFrom(_from, msg.sender, _value));
        _burn(msg.sender, _value);
    }

    // this inherited function is disabled to prevent centralized pausing
    function pause() public { revert(); }

    function _burn(address _who, uint256 _value) internal {
        require(_value <= balances[_who]);
        // no need to require value <= totalSupply, since that would imply the
        // sender's balance is greater than the totalSupply, which *should* be an assertion failure

        balances[_who] = balances[_who].sub(_value);
        totalSupply_ = totalSupply_.sub(_value);
        emit Burn(_who, _value);
        emit Transfer(_who, address(0), _value);
    }
}
