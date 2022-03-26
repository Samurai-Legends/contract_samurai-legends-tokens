// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
import util from 'util'
import { ethers } from 'hardhat'

const exec = util.promisify(require('child_process').exec)

const SMG_ADDRESS = ''

async function main() {
  const [owner] = await ethers.getSigners()
  const SamuraiLegendsStaking = await ethers.getContractFactory('SamuraiLegendsStaking')

  const samuraiLegendsStaking = await SamuraiLegendsStaking.deploy(SMG_ADDRESS)
  await samuraiLegendsStaking.deployed()

  console.log(`
SamuraiLegends address: ${SMG_ADDRESS}
SamuraiLegendsStaking deployed to: ${samuraiLegendsStaking.address}
Owner address: ${owner.address}`)

  // verify=
  await exec(
    `npx hardhat verify --network bsc ${samuraiLegendsStaking.address} ${SMG_ADDRESS}`,
  )
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
