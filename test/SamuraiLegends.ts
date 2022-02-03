import { expect } from 'chai'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { ethers } from 'hardhat'
import ms from 'ms'

// eslint-disable-next-line node/no-missing-import
import { SamuraiLegends } from '../typechain'

const amount = (value: number) => ethers.utils.parseUnits(value.toString(), 9)
const s = (value: string) => Math.floor(ms(value) / 1000)
const toFuture = async (value: string) => {
  const blockNumber = await ethers.provider.getBlockNumber()
  const { timestamp } = await ethers.provider.getBlock(blockNumber)

  await ethers.provider.send('evm_mine', [timestamp + s(value)])
}

describe('SamuraiLegendsStaking', function () {
  let smg: SamuraiLegends
  let owner: SignerWithAddress

  before(async () => {
    ;[owner] = await ethers.getSigners()
    const SamuraiLegends = await ethers.getContractFactory('SamuraiLegends')

    smg = await SamuraiLegends.deploy()
    await smg.deployed()

    console.log(`
  SamuraiLegends deployed to: ${smg.address}
  Owner address: ${owner.address}
`)
  })

  it('Should verify decimals', async function () {
    expect(await smg.decimals()).to.equal(9)
  })

  it('Should verify totalSupply', async function () {
    expect(await smg.totalSupply()).to.equal(amount(600_000_000))
  })
})
