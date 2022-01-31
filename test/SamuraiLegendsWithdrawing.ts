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

  it('Should', async function () {})
})
