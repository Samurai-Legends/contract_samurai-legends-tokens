// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
import { ethers } from "hardhat";

async function main() {
  const [owner] = await ethers.getSigners();
  const SamuraiLegends = await ethers.getContractFactory("SamuraiLegends");
  const SamuraiLegendsStaking = await ethers.getContractFactory(
    "SamuraiLegendsStaking"
  );

  const smg = await SamuraiLegends.deploy();
  await smg.deployed();

  const samuraiLegendsStaking = await SamuraiLegendsStaking.deploy(smg.address);
  await samuraiLegendsStaking.deployed();

  console.log(`
SamuraiLegends deployed to: ${smg.address}
SamuraiLegendsStaking deployed to: ${samuraiLegendsStaking.address}
Owner address: ${owner.address}`);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
