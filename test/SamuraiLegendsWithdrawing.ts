import { expect } from 'chai'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { ethers } from 'hardhat'
import ms from 'ms'

import {
  Migration,
  SamuraiLegends,
  SamuraiLegendsWithdrawing,
  TokenCreator,
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
  let rsun: TokenCreator
  let inf: TokenCreator
  let apeLP: TokenCreator
  let wbnb: TokenCreator
  let migration: Migration
  let withdrawing: SamuraiLegendsWithdrawing
  let owner: SignerWithAddress
  let users: SignerWithAddress[]

  before(async () => {
    ;[owner, ...users] = await ethers.getSigners()

    const SamuraiLegends = await ethers.getContractFactory('SamuraiLegends')
    smg = await SamuraiLegends.deploy()
    await smg.deployed()

    const TokenCreator = await ethers.getContractFactory('TokenCreator')

    rsun = await TokenCreator.deploy('RisingSun', 'RSUN', amount(10_000_000_000))
    await rsun.deployed()

    inf = await TokenCreator.deploy('Influence', 'INF', amount(5_000_000))
    await inf.deployed()

    apeLP = await TokenCreator.deploy('ApeLp', 'ApeLP', amount(100_000_000))
    await apeLP.deployed()

    wbnb = await TokenCreator.deploy('Wrapped BNB', 'WBNB', amount(5_000_000, 18))
    await wbnb.deployed()

    const Migration = await ethers.getContractFactory('Migration')
    migration = await Migration.deploy(
      rsun.address,
      inf.address,
      apeLP.address,
      wbnb.address,
    )
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

  it('Should', async function () {})
})
