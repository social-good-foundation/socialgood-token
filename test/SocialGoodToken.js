const chai = require('chai')
const chaiAsPromised = require('chai-as-promised')
chai.use(chaiAsPromised)
assert = chai.assert

const timer = require('./helpers/timer')

const SocialGoodToken = artifacts.require('./SocialGoodToken.sol')
const TokenTimelock = artifacts.require('../node_modules/openzeppelin-solidity/contracts/token/TokenTimelock.sol')

now = () => Math.floor(Date.now() / 1000)

contract('SocialGoodToken', accounts => {
  const eth = web3.eth
  const owner = eth.accounts[0]
  const team = eth.accounts[1]
  const someone1 = eth.accounts[2]
  const someone2 = eth.accounts[3]

  const newToken = () => SocialGoodToken.new()

  it('must have no tokens initially', async () => {
    const token = await newToken()
    assert.equal((await token.totalSupply()).toNumber(), 0)
  })

  it('must be able to initialize team tokens by issuing them', async () => {
    const token = await newToken()
    await token.initializeTeamTokens(team, now())
    assert.equal((await token.totalSupply()).toNumber(), 3.1e+24) // 3.1 mil SG
    assert.equal((await token.balanceOf(await token.timelock1())).toNumber(), 0.775e+24)
    assert.equal((await token.balanceOf(await token.timelock2())).toNumber(), 0.775e+24)
    assert.equal((await token.balanceOf(await token.timelock3())).toNumber(), 0.775e+24)
    assert.equal((await token.balanceOf(await token.timelock4())).toNumber(), 0.775e+24)
  })

  it('must create 4 token timlock contracts with the right paramters by an initialization', async () => {
    const token = await newToken()
    await token.initializeTeamTokens(team, 2000000000)
    const t1 = await TokenTimelock.at(await token.timelock1())
    const t2 = await TokenTimelock.at(await token.timelock2())
    const t3 = await TokenTimelock.at(await token.timelock3())
    const t4 = await TokenTimelock.at(await token.timelock4())

    assert.equal(await t1.beneficiary(), team)
    assert.equal(await t2.beneficiary(), team)
    assert.equal(await t3.beneficiary(), team)
    assert.equal(await t4.beneficiary(), team)

    assert.equal((await t1.releaseTime()).toNumber(), 2031557600)
    assert.equal((await t2.releaseTime()).toNumber(), 2063115200)
    assert.equal((await t3.releaseTime()).toNumber(), 2094672800)
    assert.equal((await t4.releaseTime()).toNumber(), 2126230400)
  })

  it('must be able to issue new tokens by the owner', async () => {
    const token = await newToken()
    await token.initializeTeamTokens(team, now())
    const watcher = token.Mint()

    await token.mint(someone1, 10e+18)

    const eventArgs = watcher.get()[0]['args']
    assert.equal(eventArgs.to, someone1)
    assert.equal(eventArgs.amount.toNumber(), 10e+18)

    await token.mint(someone2, 15e+18)
    await token.mint(someone1, 20e+18)

    assert.equal((await token.balanceOf(someone1)).toNumber(), 30e+18) // 30 SG
    assert.equal((await token.balanceOf(someone2)).toNumber(), 15e+18) // 15 SG
  })

  it('must allow owner to burn own tokens', async () => {
    const token = await newToken()
    await token.mint(owner, 2e+18)
    await assert.isFulfilled(token.burn(1e+18))
    assert.equal((await token.balanceOf(owner)).toNumber(), 1e+18)
  })

  it("must allow owner to burn another's tokens with an approval", async () => {
    const token = await newToken()
    await token.unpause()
    await token.mint(someone1, 2e+18)

    await assert.isRejected(token.burnFrom(someone1, 1e+18))

    await token.approve(owner, 1e+18, { from: someone1 })
    await assert.isFulfilled(token.burnFrom(someone1, 1e+18))
    assert.equal((await token.balanceOf(owner)).toNumber(), 0)
    assert.equal((await token.balanceOf(someone1)).toNumber(), 1e+18)
  })

  it('must not allow non-owners to burn own tokens', async () => {
    const token = await newToken()
    await token.mint(someone1, 2e+18)
    await assert.isRejected(token.burn(1e+18, { from: someone1 }))
    assert.equal((await token.balanceOf(someone1)).toNumber(), 2e+18)
  })

  it('must allow to issue new tokens even before it becomes exchangeable', async () => {
    const token = await newToken()

    await token.mint(someone1, 1e+18)
    assert.equal((await token.balanceOf(someone1)).toNumber(), 1e+18)

    await token.unpause()

    // can issue tokens after it became exchangeable, of course
    await token.mint(someone1, 1e+18)
    await token.mint(someone2, 3e+18)
    assert.equal((await token.balanceOf(someone1)).toNumber(), 2e+18)
    assert.equal((await token.balanceOf(someone2)).toNumber(), 3e+18)
  })

  it('must not allow to transfer issued tokens until it becomes exchangeable', async () => {
    const token = await newToken()
    await token.mint(someone1, 3e+18)

    await assert.isRejected(token.transfer(someone2, 1e+18, { from: someone1 }))

    assert.equal((await token.balanceOf(someone1)).toNumber(), 3e+18)
  })

  it('must allow to transfer tokens after it became exchangeable', async () => {
    const token = await newToken()
    await token.mint(someone1, 3e+18)

    await token.unpause()
    await token.transfer(someone2, 1e+18, { from: someone1 })

    assert.equal((await token.balanceOf(someone1)).toNumber(), 2e+18)
    assert.equal((await token.balanceOf(someone2)).toNumber(), 1e+18)
  })

  it('must not allow to pause tokens except for the initial pausing', async () => {
    const token = await newToken()
    await token.mint(someone1, 3e+18)

    await token.unpause()
    await token.transfer(someone2, 1e+18, { from: someone1 })

    await assert.isRejected(token.pause())

    await token.transfer(someone2, 1e+18, { from: someone1 })
    assert.equal((await token.balanceOf(someone1)).toNumber(), 1e+18)
    assert.equal((await token.balanceOf(someone2)).toNumber(), 2e+18)
  })

  it('must allow the beneficiary to withdraw unlocked tokens', async function() { // allow function cannot be used with this.skip()
    if (process.env.NODE_ENV !== 'test') {
      this.skip();
    }

    const token = await newToken()
    await token.initializeTeamTokens(team, now())
    const t1 = await TokenTimelock.at(await token.timelock1())

    await token.unpause()

    await assert.isRejected(t1.release())
    assert.equal((await token.balanceOf(t1.address)).toNumber(), 0.775e+24)
    assert.equal((await token.balanceOf(team)).toNumber(), 0)

    await timer(86400 * 366, { mine: true }) // wait for a year
    await assert.isFulfilled(t1.release())
    assert.equal((await token.balanceOf(t1.address)).toNumber(), 0)
    assert.equal((await token.balanceOf(team)).toNumber(), 0.775e+24)
  })

})
