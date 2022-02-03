import { expect } from 'chai'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { ethers } from 'hardhat'
import ms from 'ms'

// eslint-disable-next-line node/no-missing-import
import { Koku } from '../typechain'
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
const balances = async (koku: Koku, address1: string, address2: string) => [
  await koku.balanceOf(address1),
  await koku.balanceOf(address2),
  await koku.balanceOf(koku.address),
]

const DEFAULT_ADMIN_ROLE =
  '0x0000000000000000000000000000000000000000000000000000000000000000'
const MINTER_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes('MINTER_ROLE'))

describe('Koku', function () {
  let koku: Koku
  let owner: SignerWithAddress
  let pair1: SignerWithAddress
  let pair2: SignerWithAddress
  let game: SignerWithAddress
  let users: SignerWithAddress[]
  let accounts: SignerWithAddress[]
  let kokuBalance = ethers.BigNumber.from(0)

  async function getMintableTokens(
    lastTimeMintedAt: number,
    mintableTokensPerSecond: BigNumber,
    mintableTokensHardCap: BigNumber,
  ) {
    const a = mintableTokensPerSecond.mul((await getTimestamp()) - lastTimeMintedAt)
    const b = mintableTokensHardCap
    const mintableTokens = a.lt(b) ? a : b

    return mintableTokens
  }

  before(async () => {
    ;[owner, pair1, pair2, game, ...users] = await ethers.getSigners()
    const Koku = await ethers.getContractFactory('Koku')
    accounts = [pair1, pair2, game, ...users]

    koku = await Koku.deploy()
    await koku.deployed()

    console.log(`
  Koku deployed to: ${koku.address}
  Owner address: ${owner.address}
  Pair1 address: ${pair1.address}
  Pair2 address: ${pair2.address}
  Game address: ${game.address}
  Number of users: ${users.length}
`)
  })

  it('Should check 100k initial mint', async function () {
    expect(await koku.totalSupply()).to.equal(amount(100_000))
    expect(await koku.balanceOf(owner.address)).to.equal(amount(100_000))
  })

  it('Should check admin roles', async function () {
    expect(await koku.hasRole(DEFAULT_ADMIN_ROLE, owner.address)).to.equal(true)
    expect(await koku.hasRole(MINTER_ROLE, owner.address)).to.equal(true)
  })

  it('Should let owner send 1k $KOKU to every account', async function () {
    for (const account of accounts) {
      await expect(koku.transfer(account.address, amount(1_000))).to.emit(
        koku,
        'Transfer',
      )
      expect(await koku.balanceOf(account.address)).to.equal(amount(1_000))
    }

    // Send 1k to Koku address
    await expect(koku.transfer(koku.address, amount(1_000))).to.emit(koku, 'Transfer')
    expect(await koku.balanceOf(koku.address)).to.equal(amount(1_000))

    kokuBalance = kokuBalance.add(amount(1_000))
  })

  it('Should let owner add pair1 and pair2', async function () {
    await expect(koku.connect(users[0]).setPair(pair1.address, true)).to.be.reverted

    // Add pair1
    await expect(koku.setPair(pair1.address, true)).to.emit(koku, 'PairAdded')
    expect(await koku.isPair(pair1.address)).to.equal(true)
    await expect(koku.setPair(pair1.address, false)).to.emit(koku, 'PairRemoved')
    expect(await koku.isPair(pair1.address)).to.equal(false)
    await expect(koku.setPair(pair1.address, true)).to.emit(koku, 'PairAdded')

    // Add pair2
    await expect(koku.setPair(pair2.address, true)).to.emit(koku, 'PairAdded')
  })

  it('Should let owner add fees', async function () {
    let fee = await koku.fee()
    expect(fee.numerator).to.equal(0)
    expect(fee.denominator).to.equal(1000)

    // Update fees
    await expect(koku.setFee(100, 0)).to.be.revertedWith('Denominator must not equal 0.') // 10%
    await expect(koku.setFee(100, 1000)).to.emit(koku, 'FeeUpdated') // 10%
    fee = await koku.fee()
    expect(fee.numerator).to.equal(100)
    expect(fee.denominator).to.equal(1000)
  })

  it("Shouldn't tax Owner -> Koku", async function () {
    const oldBalances = await balances(koku, owner.address, koku.address)
    await expect(koku.transfer(koku.address, amount(100))).to.emit(koku, 'Transfer')
    const newBalances = await balances(koku, owner.address, koku.address)
    expect(newBalances[0]).to.equal(oldBalances[0].sub(amount(100)))
    expect(newBalances[1]).to.equal(oldBalances[1].add(amount(100)))
    expect(newBalances[2]).to.equal(oldBalances[2].add(amount(100)))

    kokuBalance = kokuBalance.add(amount(100))
  })

  it("Shouldn't tax Owner -> Pair", async function () {
    const oldBalances = await balances(koku, owner.address, pair1.address)
    await expect(koku.transfer(pair1.address, amount(100))).to.emit(koku, 'Transfer')
    const newBalances = await balances(koku, owner.address, pair1.address)
    expect(newBalances[0]).to.equal(oldBalances[0].sub(amount(100)))
    expect(newBalances[1]).to.equal(oldBalances[1].add(amount(100)))
    expect(newBalances[2]).to.equal(oldBalances[2])
  })

  it("Shouldn't tax Pair -> Owner", async function () {
    const oldBalances = await balances(koku, pair1.address, owner.address)
    await expect(koku.connect(pair1).transfer(owner.address, amount(100))).to.emit(
      koku,
      'Transfer',
    )
    const newBalances = await balances(koku, pair1.address, owner.address)
    expect(newBalances[0]).to.equal(oldBalances[0].sub(amount(100)))
    expect(newBalances[1]).to.equal(oldBalances[1].add(amount(100)))
    expect(newBalances[2]).to.equal(oldBalances[2])
  })

  it("Shouldn't tax Owner -> User", async function () {
    const oldBalances = await balances(koku, owner.address, users[0].address)
    await expect(koku.transfer(users[0].address, amount(100))).to.emit(koku, 'Transfer')
    const newBalances = await balances(koku, owner.address, users[0].address)
    expect(newBalances[0]).to.equal(oldBalances[0].sub(amount(100)))
    expect(newBalances[1]).to.equal(oldBalances[1].add(amount(100)))
    expect(newBalances[2]).to.equal(oldBalances[2])
  })

  it("Shouldn't tax User -> Owner", async function () {
    const oldBalances = await balances(koku, users[0].address, owner.address)
    await expect(koku.connect(users[0]).transfer(owner.address, amount(100))).to.emit(
      koku,
      'Transfer',
    )
    const newBalances = await balances(koku, users[0].address, owner.address)
    expect(newBalances[0]).to.equal(oldBalances[0].sub(amount(100)))
    expect(newBalances[1]).to.equal(oldBalances[1].add(amount(100)))
    expect(newBalances[2]).to.equal(oldBalances[2])
  })

  it("Shouldn't tax Pair -> Koku", async function () {
    const oldBalances = await balances(koku, pair1.address, koku.address)
    await expect(koku.connect(pair1).transfer(koku.address, amount(100))).to.emit(
      koku,
      'Transfer',
    )
    const newBalances = await balances(koku, pair1.address, koku.address)
    expect(newBalances[0]).to.equal(oldBalances[0].sub(amount(100)))
    expect(newBalances[1]).to.equal(oldBalances[1].add(amount(100)))
    expect(newBalances[2]).to.equal(oldBalances[2].add(amount(100)))

    kokuBalance = kokuBalance.add(amount(100))
  })

  it("Shouldn't tax User -> Koku", async function () {
    const oldBalances = await balances(koku, users[0].address, koku.address)
    await expect(koku.connect(users[0]).transfer(koku.address, amount(100))).to.emit(
      koku,
      'Transfer',
    )
    const newBalances = await balances(koku, users[0].address, koku.address)
    expect(newBalances[0]).to.equal(oldBalances[0].sub(amount(100)))
    expect(newBalances[1]).to.equal(oldBalances[1].add(amount(100)))
    expect(newBalances[2]).to.equal(oldBalances[2].add(amount(100)))

    kokuBalance = kokuBalance.add(amount(100))
  })

  it("Shouldn't tax User -> User", async function () {
    const oldBalances = await balances(koku, users[0].address, users[1].address)
    await expect(koku.connect(users[0]).transfer(users[1].address, amount(100))).to.emit(
      koku,
      'Transfer',
    )
    const newBalances = await balances(koku, users[0].address, users[1].address)
    expect(newBalances[0]).to.equal(oldBalances[0].sub(amount(100)))
    expect(newBalances[1]).to.equal(oldBalances[1].add(amount(100)))
    expect(newBalances[2]).to.equal(oldBalances[2])
  })

  it('Should tax Pair -> User', async function () {
    const oldBalances = await balances(koku, pair1.address, users[0].address)
    await expect(koku.connect(pair1).transfer(users[0].address, amount(100))).to.emit(
      koku,
      'Transfer',
    )
    const newBalances = await balances(koku, pair1.address, users[0].address)
    expect(newBalances[0]).to.equal(oldBalances[0].sub(amount(100)))
    expect(newBalances[1]).to.equal(oldBalances[1].add(amount(90)))
    expect(newBalances[2]).to.equal(oldBalances[2].add(amount(10)))

    kokuBalance = kokuBalance.add(amount(10))
  })

  it('Should tax User -> Pair', async function () {
    const oldBalances = await balances(koku, users[0].address, pair1.address)
    await expect(koku.connect(users[0]).transfer(pair1.address, amount(100))).to.emit(
      koku,
      'Transfer',
    )
    const newBalances = await balances(koku, users[0].address, pair1.address)
    expect(newBalances[0]).to.equal(oldBalances[0].sub(amount(100)))
    expect(newBalances[1]).to.equal(oldBalances[1].add(amount(90)))
    expect(newBalances[2]).to.equal(oldBalances[2].add(amount(10)))

    kokuBalance = kokuBalance.add(amount(10))
  })

  it('Should tax Pair -> Pair', async function () {
    const oldBalances = await balances(koku, pair1.address, pair2.address)
    await expect(koku.connect(pair1).transfer(pair2.address, amount(100))).to.emit(
      koku,
      'Transfer',
    )
    const newBalances = await balances(koku, pair1.address, pair2.address)
    expect(newBalances[0]).to.equal(oldBalances[0].sub(amount(100)))
    expect(newBalances[1]).to.equal(oldBalances[1].add(amount(90)))
    expect(newBalances[2]).to.equal(oldBalances[2].add(amount(10)))

    kokuBalance = kokuBalance.add(amount(10))
  })

  it('Should check taxing balance', async function () {
    expect(await koku.balanceOf(koku.address)).to.equal(kokuBalance)
  })

  it('Should let owner recover taxing balance', async function () {
    const oldBalances = await balances(koku, owner.address, koku.address)
    await expect(
      koku.recoverERC20(koku.address, oldBalances[1].mul(2)),
    ).to.be.revertedWith('Invalid input amount.')
    await expect(koku.recoverERC20(koku.address, oldBalances[1])).to.emit(
      koku,
      'Transfer',
    )
    const newBalances = await balances(koku, owner.address, koku.address)
    expect(newBalances[0]).to.equal(oldBalances[0].add(oldBalances[1]))
    expect(newBalances[1]).to.equal(0)

    kokuBalance = ethers.BigNumber.from(0)
  })

  it('Should let owner add/revoke MINTER_ROLE to game account', async function () {
    expect(await koku.hasRole(MINTER_ROLE, game.address)).to.equal(false)

    await expect(koku.grantRole(MINTER_ROLE, game.address)).to.emit(koku, 'RoleGranted')
    expect(await koku.hasRole(MINTER_ROLE, game.address)).to.equal(true)

    await expect(koku.revokeRole(MINTER_ROLE, game.address)).to.emit(koku, 'RoleRevoked')
    expect(await koku.hasRole(MINTER_ROLE, game.address)).to.equal(false)

    await expect(koku.grantRole(MINTER_ROLE, game.address)).to.emit(koku, 'RoleGranted')
    expect(await koku.hasRole(MINTER_ROLE, game.address)).to.equal(true)
  })

  it('Should let owner make a special mint', async function () {
    await toFuture('30 days')

    const hardcap = await koku.adminMintableTokensHardCap()

    // Shouldn't let the owner exceeds the hardcap
    await expect(koku.specialMint(hardcap.add(1))).to.be.revertedWith(
      'amount exceeds the mintable tokens amount.',
    )

    const ownerBalance = await koku.balanceOf(owner.address)
    const totalSupply = await koku.totalSupply()

    // Shouldn't let a user make a special mint
    await expect(koku.connect(users[0]).specialMint(hardcap)).to.be.revertedWith(
      `AccessControl: account ${users[0].address.toLowerCase()} is missing role ${DEFAULT_ADMIN_ROLE}`,
    )

    // Shouldn't let the owner make an empty special mint
    await expect(koku.specialMint(0)).to.be.revertedWith('Invalid input amount.')

    // Should let the owner make a special mint
    await expect(koku.specialMint(hardcap)).to.emit(koku, 'AdminBalanceIncremented')
    expect(await koku.totalSupply()).to.equal(totalSupply.add(hardcap))
    expect(await koku.balanceOf(owner.address)).to.equal(ownerBalance.add(hardcap))

    // Should revert since there isn't enough mintable tokens
    await expect(koku.specialMint(hardcap)).to.be.revertedWith(
      'amount exceeds the mintable tokens amount.',
    )
  })

  it('Should check admin mintable tokens limit', async function () {
    const mintableTokens = await getMintableTokens(
      await koku.lastTimeAdminMintedAt(),
      await koku.adminMintableTokensPerSecond(),
      await koku.adminMintableTokensHardCap(),
    )
    await expect(koku.specialMint(mintableTokens.add(amount(1)))).to.be.revertedWith(
      'amount exceeds the mintable tokens amount.',
    )

    await expect(koku.specialMint(mintableTokens)).to.emit(
      koku,
      'AdminBalanceIncremented',
    )
  })

  it('Should change admin mintable tokens per second', async function () {
    await expect(koku.setAdminMintableTokensPerSecond(amount(2, 6))).to.emit(
      koku,
      'AdminMintableTokensPerSecondUpdated',
    )
    expect(await koku.adminMintableTokensPerSecond()).to.equal(amount(2, 6))
  })

  it('Should change admin mintable tokens hardcap', async function () {
    await expect(koku.setAdminMintableTokensHardCap(amount(20_000))).to.emit(
      koku,
      'AdminMintableTokensHardCapUpdated',
    )
    expect(await koku.adminMintableTokensHardCap()).to.equal(amount(20_000))
  })

  it('Should check admin mintable tokens limit after change', async function () {
    const mintableTokens = await getMintableTokens(
      await koku.lastTimeAdminMintedAt(),
      await koku.adminMintableTokensPerSecond(),
      await koku.adminMintableTokensHardCap(),
    )
    await expect(koku.specialMint(mintableTokens.add(amount(1)))).to.be.revertedWith(
      'amount exceeds the mintable tokens amount.',
    )

    await expect(koku.specialMint(mintableTokens)).to.emit(
      koku,
      'AdminBalanceIncremented',
    )
  })

  it('Should let game increment balances', async function () {
    await toFuture('30 days')

    const hardcap = await koku.gameMintableTokensHardCap()

    // Shouldn't let the game exceeds the hardcap
    await expect(
      koku.connect(game).incrementBalances(
        users.slice(0, 3).map((e) => e.address),
        [
          hardcap.mul(50).div(100).add(1),
          hardcap.mul(30).div(100).add(1),
          hardcap.mul(20).div(100).add(1),
        ],
        hardcap.add(amount(3)),
      ),
    ).to.be.revertedWith('valuesSum exceeds the mintable tokens amount.')

    const userBalances = await Promise.all(
      users.slice(0, 3).map(async (e) => await koku.balanceOf(e.address)),
    )
    const totalSupply = await koku.totalSupply()

    // Shouldn't let a user increment balances
    await expect(
      koku.connect(users[0]).incrementBalances(
        users.slice(0, 3).map((e) => e.address),
        [hardcap.mul(50).div(100), hardcap.mul(30).div(100), hardcap.mul(20).div(100)],
        hardcap,
      ),
    ).to.be.revertedWith(
      `AccessControl: account ${users[0].address.toLowerCase()} is missing role ${MINTER_ROLE}`,
    )

    // Should revert since sum exceeds mintableTokens limit
    await expect(
      koku.connect(game).incrementBalances(
        users.slice(0, 3).map((e) => e.address),
        [
          hardcap.mul(50).div(100),
          hardcap.mul(30).div(100),
          hardcap.mul(30).div(100).add(1),
        ],
        hardcap,
      ),
    ).to.be.revertedWith('sum exceeds the mintable tokens amount.')

    // Should revert since accounts and values don't have the same lenght
    await expect(
      koku.connect(game).incrementBalances(
        users.slice(0, 2).map((e) => e.address),
        [hardcap.mul(50).div(100), hardcap.mul(30).div(100), hardcap.mul(20).div(100)],
        hardcap,
      ),
    ).to.be.revertedWith('Arrays must have the same length.')

    // Should revert since accounts and values don't have the same lenght
    await expect(
      koku.connect(game).incrementBalances(
        users.slice(0, 3).map((e) => e.address),
        [hardcap.mul(50).div(100), hardcap.mul(30).div(100), hardcap.mul(20).div(100)],
        0,
      ),
    ).to.be.revertedWith('Invalid valuesSum amount.')

    // Should let the game increment balances
    await expect(
      koku.connect(game).incrementBalances(
        users.slice(0, 3).map((e) => e.address),
        [hardcap.mul(50).div(100), hardcap.mul(30).div(100), hardcap.mul(20).div(100)],
        hardcap,
      ),
    ).to.emit(koku, 'UserBalancesIncremented')

    expect(await koku.totalSupply()).to.equal(totalSupply.add(hardcap))

    for (let i = 0; i < 3; i++) {
      expect(await koku.balanceOf(users[i].address)).to.equal(
        userBalances[i].add(hardcap.mul([50, 30, 20][i]).div(100)),
      )
    }

    // Should revert since there isn't enough mintable tokens
    await expect(
      koku.connect(game).incrementBalances(
        users.slice(0, 3).map((e) => e.address),
        [hardcap.mul(50).div(100), hardcap.mul(30).div(100), hardcap.mul(20).div(100)],
        hardcap,
      ),
    ).to.be.revertedWith('valuesSum exceeds the mintable tokens amount.')
  })

  it('Should check game mintable tokens limit', async function () {
    const mintableTokens = await getMintableTokens(
      await koku.lastTimeGameMintedAt(),
      await koku.gameMintableTokensPerSecond(),
      await koku.gameMintableTokensHardCap(),
    )

    await expect(
      koku.connect(game).incrementBalances(
        users.slice(0, 3).map((e) => e.address),
        [
          mintableTokens.mul(50).div(100).add(1),
          mintableTokens.mul(30).div(100).add(1),
          mintableTokens.mul(20).div(100).add(1),
        ],
        mintableTokens.add(amount(3)),
      ),
    ).to.be.revertedWith('valuesSum exceeds the mintable tokens amount.')

    await expect(
      koku.connect(game).incrementBalances(
        users.slice(0, 3).map((e) => e.address),
        [
          mintableTokens.mul(50).div(100),
          mintableTokens.mul(30).div(100),
          mintableTokens.mul(20).div(100),
        ],
        mintableTokens,
      ),
    ).to.emit(koku, 'UserBalancesIncremented')
  })

  it('Should change game mintable tokens per second', async function () {
    await expect(koku.setGameMintableTokensPerSecond(amount(50, 6))).to.emit(
      koku,
      'GameMintableTokensPerSecondUpdated',
    )
    expect(await koku.gameMintableTokensPerSecond()).to.equal(amount(50, 6))
  })

  it('Should change game mintable tokens hardcap', async function () {
    await expect(koku.setGameMintableTokensHardCap(amount(15_000))).to.emit(
      koku,
      'GameMintableTokensHardCapUpdated',
    )
    expect(await koku.gameMintableTokensHardCap()).to.equal(amount(15_000))
  })

  it('Should check game mintable tokens limit after change', async function () {
    const mintableTokens = await getMintableTokens(
      await koku.lastTimeGameMintedAt(),
      await koku.gameMintableTokensPerSecond(),
      await koku.gameMintableTokensHardCap(),
    )

    await expect(
      koku.connect(game).incrementBalances(
        users.slice(0, 3).map((e) => e.address),
        [
          mintableTokens.mul(50).div(100).add(1),
          mintableTokens.mul(30).div(100).add(1),
          mintableTokens.mul(20).div(100).add(1),
        ],
        mintableTokens.add(amount(3)),
      ),
    ).to.be.revertedWith('valuesSum exceeds the mintable tokens amount.')

    await expect(
      koku.connect(game).incrementBalances(
        users.slice(0, 3).map((e) => e.address),
        [
          mintableTokens.mul(50).div(100),
          mintableTokens.mul(30).div(100),
          mintableTokens.mul(20).div(100),
        ],
        mintableTokens,
      ),
    ).to.emit(koku, 'UserBalancesIncremented')
  })

  it('Should verify decimals to be 9', async function () {
    expect(await koku.decimals()).to.equal(9)
  })
})
