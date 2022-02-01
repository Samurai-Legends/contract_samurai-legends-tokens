import { expect } from 'chai'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { ethers } from 'hardhat'
import ms from 'ms'

import {
  Migration,
  SamuraiLegends,
  SamuraiLegendsWithdrawing,
  // eslint-disable-next-line node/no-missing-import
} from '../typechain'
import { BigNumber } from 'ethers'

const amount = (value: number, decimals = 9) =>
  ethers.utils.parseUnits(value.toString(), decimals)
const s = (value: string) => Math.floor(ms(value) / 1000)
const getTimestamp = async () => {
  const blockNumber = await ethers.provider.getBlockNumber()
  const { timestamp } = await ethers.provider.getBlock(blockNumber)
  return timestamp
}
const toFuture = async (value: string) => {
  const timestamp = await getTimestamp()

  await ethers.provider.send('evm_mine', [timestamp + s(value)])
}

describe('SamuraiLegendsWithdrawing', function () {
  let smg: SamuraiLegends
  let migration: Migration
  let withdrawing: SamuraiLegendsWithdrawing
  let owner: SignerWithAddress
  let user1: SignerWithAddress
  let user2: SignerWithAddress

  before(async () => {
    ;[owner, user1, user2] = await ethers.getSigners()

    const SamuraiLegends = await ethers.getContractFactory('SamuraiLegends')
    smg = await SamuraiLegends.deploy()
    await smg.deployed()

    const Migration = await ethers.getContractFactory('Migration')
    migration = await Migration.deploy()
    await migration.deployed()

    const SamuraiLegendsWithdrawing = await ethers.getContractFactory(
      'SamuraiLegendsWithdrawing',
    )
    withdrawing = await SamuraiLegendsWithdrawing.deploy(smg.address, migration.address)
    await withdrawing.deployed()

    console.log(`
  SamuraiLegendsWithdrawing deployed to: ${withdrawing.address}
  Owner address: ${owner.address}
  User1 address: ${user1.address}
  User2 address: ${user2.address}
`)
  })

  it('Should verify vesting period', async function () {
    expect(await withdrawing.vestingPeriod()).to.equal(s('30 days'))
  })

  it('Should let user1, user2 deposit RSUN to migration contract', async function () {
    await expect(migration.connect(user1).depositRSUN(amount(10_000))).to.emit(
      migration,
      'DepositedRSUN',
    )
    expect(await migration.rsunBalances(user1.address)).to.equal(amount(10_000))
    expect(await migration.rsunDepositedTotal()).to.equal(amount(10_000))

    await expect(migration.connect(user2).depositRSUN(amount(20_000))).to.emit(
      migration,
      'DepositedRSUN',
    )
    expect(await migration.rsunBalances(user2.address)).to.equal(amount(20_000))
    expect(await migration.rsunDepositedTotal()).to.equal(amount(30_000))
  })

  it('Should let user1, user2 deposit INF to migration contract', async function () {
    await expect(migration.connect(user1).depositINF(amount(1250))).to.emit(
      migration,
      'DepositedINF',
    )
    expect(await migration.infBalances(user1.address)).to.equal(amount(1250))
    expect(await migration.infDepositedTotal()).to.equal(amount(1250))

    await expect(migration.connect(user2).depositINF(amount(2500))).to.emit(
      migration,
      'DepositedINF',
    )
    expect(await migration.infBalances(user2.address)).to.equal(amount(2500))
    expect(await migration.infDepositedTotal()).to.equal(amount(3750))
  })

  it('Should verify the amount that needs to be deposited by an Admin', async function () {
    expect(await withdrawing.toDeposit()).to.equal(
      (await migration.rsunDepositedTotal())
        .mul(10)
        .div(1000)
        .add((await migration.infDepositedTotal()).mul(10).div(125))
        .mul(10)
        .div(100),
    )
  })

  it("Shouldn't let a user unlock before owner make a deposit", async function () {
    await expect(withdrawing.connect(user1).unlock()).to.revertedWith(
      'ERC20: transfer amount exceeds balance',
    )
  })

  it('Should let the owner deposit SMG tokens', async function () {
    const toDeposit = await withdrawing.toDeposit()
    await expect(smg.transfer(withdrawing.address, toDeposit)).to.emit(smg, 'Transfer')
    expect(await smg.balanceOf(withdrawing.address)).to.equal(toDeposit)

    expect(await withdrawing.toDeposit()).to.equal(0)
    expect(await smg.balanceOf(owner.address)).to.equal(
      await (await smg.totalSupply()).sub(toDeposit),
    )
  })

  it('Should let user1, user2 unlock 10% at first', async function () {
    // User 1
    const smgToBeUnlockedByUser1 = (await migration.rsunBalances(user1.address))
      .mul(10)
      .div(1000)
      .add((await migration.infBalances(user1.address)).mul(10).div(125))

    let toDeposit = await withdrawing.toDeposit()
    await expect(withdrawing.connect(user1).unlock()).to.emit(
      withdrawing,
      'UnlockCreated',
    )
    expect(await smg.balanceOf(user1.address)).to.equal(
      smgToBeUnlockedByUser1.mul(10).div(100),
    )
    expect(await withdrawing.toDeposit()).to.equal(
      toDeposit.add(smgToBeUnlockedByUser1.mul(90).div(100)),
    )

    // User 2
    const smgToBeUnlockedByUser2 = (await migration.rsunBalances(user2.address))
      .mul(10)
      .div(1000)
      .add((await migration.infBalances(user2.address)).mul(10).div(125))

    toDeposit = toDeposit.add(smgToBeUnlockedByUser1.mul(90).div(100))
    await expect(withdrawing.connect(user2).unlock()).to.emit(
      withdrawing,
      'UnlockCreated',
    )
    expect(await smg.balanceOf(user2.address)).to.equal(
      smgToBeUnlockedByUser2.mul(10).div(100),
    )
    expect(await withdrawing.toDeposit()).to.equal(
      toDeposit.add(smgToBeUnlockedByUser2.mul(90).div(100)),
    )
  })

  it('Should verify user1, user2 unlock balances', async function () {
    // User 1
    const user1FullAmount = (await migration.rsunBalances(user1.address))
      .mul(10)
      .div(1000)
      .add((await migration.infBalances(user1.address)).mul(10).div(125))

    expect(await withdrawing.userUnlockIds(user1.address)).to.have.a.lengthOf(1)

    const user1Unlock = await withdrawing.unlocks(user1.address, 0)

    expect(user1Unlock.claimedAmount).to.equal(0)
    expect(user1Unlock.fullAmount).to.equal(user1FullAmount)
    expect(user1Unlock.vestedAmount).to.equal(user1FullAmount.mul(90).div(100))

    // User 2
    const user2FullAmount = (await migration.rsunBalances(user2.address))
      .mul(10)
      .div(1000)
      .add((await migration.infBalances(user2.address)).mul(10).div(125))

    expect(await withdrawing.userUnlockIds(user2.address)).to.have.a.lengthOf(1)

    const user2Unlock = await withdrawing.unlocks(user2.address, 0)

    expect(user2Unlock.claimedAmount).to.equal(0)
    expect(user2Unlock.fullAmount).to.equal(user2FullAmount)
    expect(user2Unlock.vestedAmount).to.equal(user2FullAmount.mul(90).div(100))
  })

  it('Should verify total unlock balances', async function () {
    expect(await withdrawing.totalUnlockBalance()).to.equal(
      amount(30_000).mul(10).div(1000).add(amount(3750).mul(10).div(125)),
    )
  })

  it('Should let the owner deposit more SMG tokens', async function () {
    expect(await withdrawing.toDeposit()).to.not.equal(0)

    const toDeposit = await withdrawing.toDeposit()
    expect(await smg.balanceOf(withdrawing.address)).to.equal(0)
    await expect(smg.transfer(withdrawing.address, toDeposit)).to.emit(smg, 'Transfer')
    expect(await smg.balanceOf(withdrawing.address)).to.equal(toDeposit)

    expect(await withdrawing.toDeposit()).to.equal(0)

    const totalSupply = await smg.totalSupply()
    expect(await smg.balanceOf(owner.address)).to.equal(
      totalSupply.sub(
        amount(30_000).mul(10).div(1000).add(amount(3750).mul(10).div(125)),
      ),
    )
  })

  it('Should let user1 claim after 10 days', async function () {
    await toFuture('10 days')
    await expect(withdrawing.connect(user1).claim(0))
      .to.emit(withdrawing, 'UnlockUpdated')
      .to.emit(withdrawing, 'Claimed')

    const unlock = await withdrawing.unlocks(user1.address, 0)

    expect(unlock.claimedAmount).to.be.closeTo(
      unlock.vestedAmount.mul(10).div(30),
      amount(1).toNumber(),
    )

    expect(await smg.balanceOf(user1.address)).to.be.closeTo(
      unlock.fullAmount.mul(10).div(100).add(unlock.vestedAmount.mul(10).div(30)),
      amount(1).toNumber(),
    )

    expect(await withdrawing.toDeposit()).to.equal(0)
  })

  it('Should let user2 claim after 15 days', async function () {
    await toFuture('5 days')
    await expect(withdrawing.connect(user2).claim(0))
      .to.emit(withdrawing, 'UnlockUpdated')
      .to.emit(withdrawing, 'Claimed')

    const unlock = await withdrawing.unlocks(user2.address, 0)

    expect(unlock.claimedAmount).to.be.closeTo(
      unlock.vestedAmount.mul(15).div(30),
      amount(1).toNumber(),
    )

    expect(await smg.balanceOf(user2.address)).to.be.closeTo(
      unlock.fullAmount.mul(10).div(100).add(unlock.vestedAmount.mul(15).div(30)),
      amount(1).toNumber(),
    )

    expect(await withdrawing.toDeposit()).to.equal(0)
  })

  it('Should let user1 make a full claim after 60 days', async function () {
    await toFuture('45 days')
    const unlock = await withdrawing.unlocks(user1.address, 0)

    await expect(withdrawing.connect(user1).claim(0))
      .to.emit(withdrawing, 'UnlockFinished')
      .to.emit(withdrawing, 'Claimed')

    expect(await smg.balanceOf(user1.address)).to.be.closeTo(
      unlock.fullAmount,
      amount(1).toNumber(),
    )

    expect(await withdrawing.toDeposit()).to.equal(0)

    expect(await withdrawing.userUnlockIds(user1.address)).to.have.a.lengthOf(0)

    await expect(withdrawing.connect(user1).claim(0)).to.be.reverted
  })

  it('Should let user2 make a full claim after 60 days', async function () {
    const unlock = await withdrawing.unlocks(user2.address, 0)

    await expect(withdrawing.connect(user2).claim(0))
      .to.emit(withdrawing, 'UnlockFinished')
      .to.emit(withdrawing, 'Claimed')

    expect(await smg.balanceOf(user2.address)).to.be.closeTo(
      unlock.fullAmount,
      amount(1).toNumber(),
    )

    expect(await withdrawing.toDeposit()).to.equal(0)

    expect(await withdrawing.userUnlockIds(user2.address)).to.have.a.lengthOf(0)

    await expect(withdrawing.connect(user2).claim(0)).to.be.reverted
  })

  it('Should let user1 deposit more INF', async function () {
    await expect(migration.connect(user1).depositINF(amount(1250))).to.emit(
      migration,
      'DepositedINF',
    )
  })

  it('Should let the owner deposit more SMG tokens', async function () {
    expect(await withdrawing.toDeposit()).to.not.equal(0)

    const toDeposit = await withdrawing.toDeposit()
    expect(await smg.balanceOf(withdrawing.address)).to.equal(0)
    await expect(smg.transfer(withdrawing.address, toDeposit)).to.emit(smg, 'Transfer')
    expect(await smg.balanceOf(withdrawing.address)).to.equal(toDeposit)
    expect(await withdrawing.toDeposit()).to.equal(0)
  })

  it('Should let user1 create new unlock[0] and get 10% at first', async function () {
    const balance = await smg.balanceOf(user1.address)
    const totalUnlockBalance = await withdrawing.totalUnlockBalance()
    const userUnlockBalance = await withdrawing.userUnlockBalance(user1.address)

    await expect(withdrawing.connect(user1).unlock()).to.emit(
      withdrawing,
      'UnlockCreated',
    )

    const unlock = await withdrawing.unlocks(user1.address, 0)

    expect(await smg.balanceOf(user1.address)).to.equal(
      balance.add(amount(1250).mul(10).div(125).mul(10).div(100)),
    )
    expect(await withdrawing.totalUnlockBalance()).to.equal(
      totalUnlockBalance.add(amount(1250).mul(10).div(125)),
    )
    expect(await withdrawing.userUnlockBalance(user1.address)).to.equal(
      userUnlockBalance.add(amount(1250).mul(10).div(125)),
    )
    expect(unlock.fullAmount).to.equal(amount(1250).mul(10).div(125))
    expect(unlock.vestedAmount).to.equal(amount(1250).mul(10).div(125).mul(90).div(100))
    expect(unlock.claimedAmount).to.equal(0)
  })

  it('Should verify claimable amount after 20 days', async function () {
    await toFuture('20 days')

    const unlock = await withdrawing.unlocks(user1.address, 0)
    const [passedPeriod, claimableAmount] = await withdrawing.getClaimableAmount(
      user1.address,
      0,
    )

    expect(passedPeriod).to.equal(s('20 days'))
    expect(claimableAmount).to.equal(unlock.vestedAmount.mul(20).div(30))
  })

  it('Should let user1 deposit more INF', async function () {
    await expect(migration.connect(user1).depositINF(amount(2500))).to.emit(
      migration,
      'DepositedINF',
    )
  })

  it('Should let the owner deposit more SMG tokens', async function () {
    expect(await withdrawing.toDeposit()).to.not.equal(0)

    const toDeposit = await withdrawing.toDeposit()
    expect(await smg.balanceOf(withdrawing.address)).to.equal(0)
    await expect(smg.transfer(withdrawing.address, toDeposit)).to.emit(smg, 'Transfer')
    expect(await smg.balanceOf(withdrawing.address)).to.equal(toDeposit)
    expect(await withdrawing.toDeposit()).to.equal(0)
  })

  it('Should let user1 create new unlock[1] and get 10% at first', async function () {
    const balance = await smg.balanceOf(user1.address)
    const totalUnlockBalance = await withdrawing.totalUnlockBalance()
    const userUnlockBalance = await withdrawing.userUnlockBalance(user1.address)

    await expect(withdrawing.connect(user1).unlock()).to.emit(
      withdrawing,
      'UnlockCreated',
    )

    const unlock = await withdrawing.unlocks(user1.address, 1)

    expect(await smg.balanceOf(user1.address)).to.equal(
      balance.add(amount(2500).mul(10).div(125).mul(10).div(100)),
    )
    expect(await withdrawing.totalUnlockBalance()).to.equal(
      totalUnlockBalance.add(amount(2500).mul(10).div(125)),
    )
    expect(await withdrawing.userUnlockBalance(user1.address)).to.equal(
      userUnlockBalance.add(amount(2500).mul(10).div(125)),
    )
    expect(unlock.fullAmount).to.equal(amount(2500).mul(10).div(125))
    expect(unlock.vestedAmount).to.equal(amount(2500).mul(10).div(125).mul(90).div(100))
    expect(unlock.claimedAmount).to.equal(0)
  })

  it('Should verify user1 unlock ids', async function () {
    expect(await withdrawing.userUnlockIds(user1.address)).to.have.a.lengthOf(2)
  })

  it('Should move timestamp by 5 days', async function () {
    await toFuture('5 days')
  })

  it('Should verify user1 unlock[0]', async function () {
    const unlock = await withdrawing.unlocks(user1.address, 0)
    const [passedPeriod, claimableAmount] = await withdrawing.getClaimableAmount(
      user1.address,
      0,
    )
    expect(passedPeriod).to.be.closeTo(BigNumber.from(s('25 days')), 3)
    expect(claimableAmount).to.be.closeTo(
      unlock.vestedAmount.mul(25).div(30),
      amount(1).toNumber(),
    )
  })

  it('Should verify user1 unlock[1]', async function () {
    const unlock = await withdrawing.unlocks(user1.address, 1)
    const [passedPeriod, claimableAmount] = await withdrawing.getClaimableAmount(
      user1.address,
      1,
    )
    expect(passedPeriod).to.be.closeTo(BigNumber.from(s('5 days')), 3)
    expect(claimableAmount).to.be.closeTo(
      unlock.vestedAmount.mul(5).div(30),
      amount(1).toNumber(),
    )
  })

  it('Should let the owner deposit more SMG tokens', async function () {
    expect(await withdrawing.toDeposit()).to.not.equal(0)

    const unlock = await withdrawing.unlocks(user1.address, 0)
    const toDeposit = await withdrawing.toDeposit()
    expect(await smg.balanceOf(withdrawing.address)).to.equal(unlock.vestedAmount)
    await expect(smg.transfer(withdrawing.address, toDeposit)).to.emit(smg, 'Transfer')
    expect(await smg.balanceOf(withdrawing.address)).to.equal(
      toDeposit.add(unlock.vestedAmount),
    )
    expect(await withdrawing.toDeposit()).to.equal(0)
  })

  it('Should let user1 claim unlock[0] after 100 days', async function () {
    await toFuture('100 days')
    const balance = await smg.balanceOf(user1.address)
    const unlock = await withdrawing.unlocks(user1.address, 0)

    await expect(withdrawing.connect(user1).claim(0))
      .to.emit(withdrawing, 'UnlockFinished')
      .to.emit(withdrawing, 'Claimed')

    expect(await smg.balanceOf(user1.address)).to.be.closeTo(
      balance.add(unlock.vestedAmount).sub(unlock.claimedAmount),
      amount(1).toNumber(),
    )

    expect(await withdrawing.toDeposit()).to.equal(0)

    expect(await withdrawing.userUnlockIds(user1.address)).to.have.a.lengthOf(1)
  })

  it('Should let user1 claim unlock[1] after 200 days', async function () {
    await toFuture('200 days')
    const balance = await smg.balanceOf(user1.address)
    const unlock = await withdrawing.unlocks(user1.address, 0)

    await expect(withdrawing.connect(user1).claim(0))
      .to.emit(withdrawing, 'UnlockFinished')
      .to.emit(withdrawing, 'Claimed')

    expect(await smg.balanceOf(user1.address)).to.be.closeTo(
      balance.add(unlock.vestedAmount).sub(unlock.claimedAmount),
      amount(1).toNumber(),
    )

    expect(await withdrawing.toDeposit()).to.equal(0)

    expect(await withdrawing.userUnlockIds(user1.address)).to.have.a.lengthOf(0)
  })

  it('Should verify balances after all unlocks are done', async function () {
    expect(await smg.balanceOf(withdrawing.address)).to.equal(0)
    const ownerBalance = await smg.balanceOf(owner.address)
    const user1Balance = await smg.balanceOf(user1.address)
    const user2Balance = await smg.balanceOf(user2.address)

    expect(await smg.totalSupply()).to.equal(
      ownerBalance.add(user1Balance).add(user2Balance),
    )
  })

  it('Should let the owner know if he over deposited', async function () {
    expect(await withdrawing.toDeposit()).to.equal(0)
    await expect(smg.transfer(withdrawing.address, amount(10_000))).to.emit(
      smg,
      'Transfer',
    )
    expect(await withdrawing.toDeposit()).to.be.lt(0)
  })
})
