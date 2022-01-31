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
  let users: SignerWithAddress[]

  before(async () => {
    ;[owner, ...users] = await ethers.getSigners()

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
  Number of users: ${users.length}
`)
  })

  it('Should verify vesting period', async function () {})
  it('Should let user1, user2 deposit RSUN to migration contract', async function () {})
  it('Should let user1, user2 deposit INF to migration contract', async function () {})
  it("Shouldn't let a user unlock before owner make a deposit", async function () {})
  it("Shouldn't let a user unlock before owner make a full deposit", async function () {})
  it('Should let the owner deposit SMG tokens', async function () {})
  it('Should let user1, user2 unlock 10% at first', async function () {})
  it('Should verify user1, user2 unlock balances', async function () {})
  it('Should verify total unlock balances', async function () {})
  it('Should let user1, user2 unlock 10% at first', async function () {})
  it('Should let user1 claim after 10 days', async function () {})
  it('Should let user2 claim after 15 days', async function () {})
  it('Should let user1, user2 make a full claim after 30 days', async function () {})
  it('Should let user1 deposit more RSUN', async function () {})
  it('Should move timestamp by 60 days', async function () {})
  it('Should let user1 create new unlock[0] and get 10% at first', async function () {})
  it('Should verify claimable amount after 20 days', async function () {})
  it('Should let user1 deposit more RSUN', async function () {})
  it('Should let user1 create new unlock[1] and get 10% at first', async function () {})
  it('Should verify user1 unlock ids', async function () {})
  it('Should verify user1 unlocks after 5 days', async function () {})
  it('Should let user1 claim unlock[0] after 100 days', async function () {})
  it('Should let user1 claim unlock[1] after 200 days', async function () {})
  it('Should verify balances after all unlocks are done', async function () {})
})
