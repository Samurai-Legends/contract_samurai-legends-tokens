// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
import util from 'util'
import { ethers } from 'hardhat'

const exec = util.promisify(require('child_process').exec)

async function main() {
  const [owner] = await ethers.getSigners()
  const Koku = await ethers.getContractFactory('Koku')

  const koku = await Koku.deploy()
  await koku.deployed()

  console.log(`
Koku deployed to: ${koku.address}
Owner address: ${owner.address}`)

  // verify
  await exec(`npx hardhat verify --network bsc ${koku.address}`)
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
