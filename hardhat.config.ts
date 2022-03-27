import * as dotenv from 'dotenv'

import { HardhatUserConfig, task } from 'hardhat/config'
import '@nomiclabs/hardhat-etherscan'
import '@nomiclabs/hardhat-waffle'
import '@typechain/hardhat'
import 'hardhat-gas-reporter'
import 'hardhat-log-remover'
import 'solidity-coverage'
import 'hardhat-docgen'

dotenv.config()

// This is a sample Hardhat task. To learn how to create your own go to
// https://hardhat.org/guides/create-task.html
task('accounts', 'Prints the list of accounts', async (taskArgs, hre) => {
  const accounts = await hre.ethers.getSigners()

  for (const account of accounts) {
    console.log(account.address)
  }
})

task('create-wallet', 'Create a new wallet', async (taskArgs, hre) => {
  const wallet = await hre.ethers.Wallet.createRandom()

  console.log(`
Address: ${wallet.address}
Mnemonic: ${wallet.mnemonic.phrase}  
`)
})

// You need to export an object to set up your config
// Go to https://hardhat.org/config/ to learn more

const config: HardhatUserConfig = {
  solidity: {
    version: '0.8.4',
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    hardhat: {
      mining: {
        auto: true,
        interval: 1000,
      },
    },
    bsc: {
      url: process.env.RPC,
      accounts: [process.env.PRIVATE_KEY!],
    },
    bsc_testnet: {
      url: process.env.RPC,
      accounts: process.env.PRIVATE_KEY!.split(',').map((e) => e.trim()),
    },
  },
  gasReporter: {
    enabled: true,
    currency: 'USD',
  },
  etherscan: {
    apiKey: process.env.BSCSCAN_API,
  },
  docgen: {
    path: './docs',
    clear: true,
  },
}

export default config
