// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
import { ethers } from 'hardhat'

const amount = (value: number) => ethers.utils.parseUnits(value.toString(), 9)

async function main() {
  const [owner, ...users] = await ethers.getSigners()
  const SamuraiLegends = await ethers.getContractFactory('SamuraiLegends')
  const SamuraiLegendsStaking = await ethers.getContractFactory('SamuraiLegendsStaking')

  const smg = await SamuraiLegends.deploy()
  await smg.deployed()

  const samuraiLegendsStaking = await SamuraiLegendsStaking.deploy(smg.address)
  await samuraiLegendsStaking.deployed()

  await smg.approve(samuraiLegendsStaking.address, amount(10_000_000))

  for (const user of users) {
    await smg.transfer(user.address, amount(100_000))
  }

  await samuraiLegendsStaking.addReward(amount(5_000_000))

  console.log(`
SamuraiLegends deployed to: ${smg.address}
SamuraiLegendsStaking deployed to: ${samuraiLegendsStaking.address}
Owner address: ${owner.address}`)
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
