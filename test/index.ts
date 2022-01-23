import { expect } from "chai";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { ethers } from "hardhat";
import ms from "ms";

// eslint-disable-next-line node/no-missing-import
import { SamuraiLegends, SamuraiLegendsStaking } from "../typechain";

const amount = (value: number) => ethers.utils.parseUnits(value.toString(), 9);
const s = (value: string) => Math.floor(ms(value) / 1000);
const toFuture = async (value: string) => {
  const blockNumber = await ethers.provider.getBlockNumber();
  const { timestamp } = await ethers.provider.getBlock(blockNumber);

  await ethers.provider.send("evm_mine", [timestamp + s(value)]);
};

describe("SamuraiLegendsStaking", function () {
  let smg: SamuraiLegends;
  let staking: SamuraiLegendsStaking;
  let owner: SignerWithAddress;
  let users: SignerWithAddress[];

  before(async () => {
    [owner, ...users] = await ethers.getSigners();
    const SamuraiLegends = await ethers.getContractFactory("SamuraiLegends");
    const SamuraiLegendsStaking = await ethers.getContractFactory(
      "SamuraiLegendsStaking"
    );

    smg = await SamuraiLegends.deploy();
    await smg.deployed();

    staking = await SamuraiLegendsStaking.deploy(smg.address);
    await staking.deployed();

    console.log(`
  SamuraiLegends deployed to: ${smg.address}
  SamuraiLegendsStaking deployed to: ${staking.address}
  Owner address: ${owner.address}
  Number of users: ${users.length}
`);
  });

  it("Should make the owner approve 10m token to the staking contract", async function () {
    await smg.approve(staking.address, amount(10_000_000));
    expect(await smg.allowance(owner.address, staking.address)).to.equal(
      amount(10_000_000)
    );
  });

  it("Should make the owner transfer 100k smg to every user", async function () {
    for (const user of users) {
      await smg.transfer(user.address, amount(100_000));
    }

    for (const user of users) {
      expect(await smg.balanceOf(user.address)).to.equal(amount(100_000));
    }
  });

  it("Should verify the new owner balance", async function () {
    const totalSupply = await smg.totalSupply();
    expect(await smg.balanceOf(owner.address)).to.equal(
      totalSupply.sub(amount(100_000).mul(users.length))
    );
  });

  it("Should make the owner add 5m smg as a staking reward", async function () {
    await staking.addReward(amount(5_000_000));
    expect(await smg.balanceOf(staking.address)).to.equal(amount(5_000_000));
  });

  it("Should verify reward rate", async function () {
    const rewardRate = await staking.rewardRate();
    const rewardDuration = await staking.rewardDuration();
    expect(rewardRate).to.equal(amount(5_000_000).div(rewardDuration));
  });

  it("Should verify total duration reward", async function () {
    const totalDurationReward = await staking.totalDurationReward();
    const rewardRate = await staking.rewardRate();
    const rewardDuration = await staking.rewardDuration();
    expect(totalDurationReward).to.equal(rewardRate.mul(rewardDuration));
  });

  it("Should verify the staking isn't active yet", async function () {
    expect(await staking.rewardPerToken()).to.equal(0);
    expect(await staking.totalStake()).to.equal(0);
  });

  it("Should let user stake 20k smg", async function () {
    await smg.connect(users[0]).approve(staking.address, amount(20_000));
    expect(await smg.allowance(users[0].address, staking.address)).to.equal(
      amount(20_000)
    );

    await staking.connect(users[0]).stake(amount(20_000));

    expect(await smg.balanceOf(users[0].address)).to.equal(amount(80_000));
    expect(await staking.userStake(users[0].address)).to.equal(amount(20_000));
    expect(await staking.totalStake()).to.equal(amount(20_000));
  });

  it("Should let user withdraw 10k smg after 1 week", async function () {
    await toFuture("1 week");

    const userStake = await staking.userStake(users[0].address);
    const totalStake = await staking.totalStake();

    await expect(staking.connect(users[0]).withdraw(amount(10_000))).to.emit(
      staking,
      "PendingCreated"
    );
    expect(await staking.userStake(users[0].address)).to.be.closeTo(
      userStake.sub(amount(10_000)),
      amount(1).toNumber()
    );
    expect(await staking.totalStake()).to.be.closeTo(
      totalStake.sub(amount(10_000)),
      amount(1).toNumber()
    );
  });

  it("Should verify user pending", async function () {
    expect(await staking.userPendingIds(users[0].address)).to.have.a.lengthOf(
      1
    );
    const pending = await staking.userPending(users[0].address, 0);
    expect(await pending.claimedAmount).to.equal(0);
    expect(await pending.fullAmount).to.equal(amount(10_000));
  });

  it("Should not let user claim unfinished pending", async function () {
    await expect(staking.connect(users[0]).claim(0)).to.be.reverted;
  });

  it("Should let user claim 25% finished pendings", async function () {
    await toFuture("1 week");

    const balance = await smg.balanceOf(users[0].address);
    await expect(staking.connect(users[0]).claim(0)).to.emit(
      staking,
      "PendingUpdated"
    );
    const pending = await staking.userPending(users[0].address, 0);
    expect(await pending.claimedAmount).to.equal(amount(2_500));

    expect(await smg.balanceOf(users[0].address)).to.be.closeTo(
      balance.add(amount(2_500)),
      amount(1).toNumber()
    );
  });

  it("Should let user cancel the rest of the pending", async function () {
    const userStake = await staking.userStake(users[0].address);
    const totalStake = await staking.totalStake();

    await expect(staking.connect(users[0]).cancelPending(0)).to.emit(
      staking,
      "PendingCanceled"
    );
    expect(await staking.userPendingIds(users[0].address)).to.have.a.lengthOf(
      0
    );
    expect(await staking.userStake(users[0].address)).to.be.closeTo(
      userStake.add(amount(7_500)),
      amount(1).toNumber()
    );
    expect(await staking.totalStake()).to.be.closeTo(
      totalStake.add(amount(7_500)),
      amount(1).toNumber()
    );
  });

  it("Should let owner decrease 2.5m staking rewards", async function () {
    const rewardRate = await staking.rewardRate();
    await expect(staking.decreaseReward(amount(2_500_000))).to.emit(
      staking,
      "RewardDecreased"
    );

    expect(await staking.rewardRate()).to.be.lt(rewardRate);
  });

  it("Should let user withdraw all after 10 weeks", async function () {
    await toFuture("10 weeks");

    const userStake = await staking.userStake(users[0].address);

    await expect(staking.connect(users[0]).withdrawAll()).to.emit(
      staking,
      "PendingCreated"
    );
    expect(await staking.userStake(users[0].address)).to.be.equal(0);
    expect(await staking.totalStake()).to.be.equal(0);
    expect(await staking.userPendingIds(users[0].address)).to.have.a.lengthOf(
      1
    );
    const pending = await staking.userPending(users[0].address, 0);
    expect(await pending.claimedAmount).to.equal(0);
    expect(await pending.fullAmount).to.be.closeTo(
      userStake,
      amount(1).toNumber()
    );
  });

  it("Should let user claim 100% finished pending", async function () {
    await toFuture("4 weeks");

    await expect(staking.connect(users[0]).claim(0)).to.emit(
      staking,
      "Claimed"
    );

    expect(await staking.userPendingIds(users[0].address)).to.have.a.lengthOf(
      0
    );
    expect(await smg.balanceOf(users[0].address)).to.be.closeTo(
      amount(2_500_000 + 100_000),
      amount(2).toNumber()
    );
  });

  it("Should let the owner recover stucked ERC20 tokens", async function () {
    expect(await smg.balanceOf(staking.address)).to.not.equal(0);
    await expect(
      staking.recoverERC20(smg.address, await smg.balanceOf(staking.address))
    ).to.emit(smg, "Transfer");
    expect(await smg.balanceOf(staking.address)).to.equal(0);
  });

  it("Should let the owner update reward duration and pending period", async function () {
    await expect(staking.updateRewardDuration(s("3 weeks"))).to.emit(
      staking,
      "RewardDurationUpdated"
    );
    expect(await staking.rewardDuration()).to.equal(s("3 weeks"));

    await expect(staking.updatePendingPeriod(3, s("4 days"))).to.emit(
      staking,
      "PendingPeriodUpdated"
    );
    const pending = await staking.pendingPeriod();
    expect(pending.repeat).to.equal(3);
    expect(pending.period).to.equal(s("4 days"));

    await expect(staking.addReward(amount(5_000))).to.emit(
      staking,
      "RewardAdded"
    );

    await smg.connect(users[0]).approve(staking.address, amount(1_000));
    await expect(staking.connect(users[0]).stake(amount(1_000))).to.emit(
      staking,
      "Staked"
    );

    expect(await staking.userStake(users[0].address)).to.equal(amount(1_000));

    await toFuture("3 weeks");

    expect(await staking.userStake(users[0].address)).to.be.closeTo(
      amount(6_000),
      amount(1).toNumber()
    );

    await expect(staking.connect(users[0]).withdrawAll()).to.emit(
      staking,
      "Withdrawn"
    );

    await toFuture("12 days");

    expect(
      await staking.userClaimablePendingPercentage(users[0].address, 0)
    ).to.equal(amount(100));
  });

  it("Should let the owner add fee on claim", async function () {
    await expect(staking.setFee(50, 1000)).to.emit(staking, "FeeUpdated"); // 5%

    const pending = await staking.userPending(users[0].address, 0);
    const amountToClaim = pending.fullAmount.sub(pending.claimedAmount);
    const balance = await smg.balanceOf(users[0].address);

    await expect(staking.connect(users[0]).claim(0)).to.emit(
      staking,
      "Claimed"
    );

    expect(await smg.balanceOf(users[0].address)).to.be.closeTo(
      balance.add(amountToClaim.sub(amountToClaim.mul(50).div(1000))),
      amount(1).toNumber()
    );
  });

  it("Should let the owner reset rewards", async function () {
    await expect(staking.resetReward()).to.emit(staking, "RewardReseted");
    expect(await staking.rewardRate()).to.equal(0);

    const rewardPerToken = await staking.rewardPerToken();
    await toFuture("10 weeks");
    expect(await staking.rewardPerToken()).to.equal(rewardPerToken);
  });

  it("Should let the owner pause/unpause staking", async function () {
    await smg.connect(users[0]).approve(staking.address, amount(10_000));
    await expect(staking.pause()).to.emit(staking, "Paused");
    await expect(staking.connect(users[0]).stake(amount(10_000))).to.be
      .reverted;
    await expect(staking.unpause()).to.emit(staking, "Unpaused");
    await expect(staking.connect(users[0]).stake(amount(10_000))).to.emit(
      staking,
      "Staked"
    );
  });

  it("Should verify the smg total supply", async function () {
    await expect(staking.connect(users[0]).withdrawAll()).to.emit(
      staking,
      "PendingCreated"
    );

    await toFuture("4 weeks");

    expect(
      await staking.userClaimablePendingPercentage(users[0].address, 0)
    ).to.equal(amount(100));

    await expect(staking.connect(users[0]).claim(0)).to.emit(
      staking,
      "Claimed"
    );
    expect(await staking.userStake(users[0].address)).to.equal(0);
    expect(await staking.totalStake()).to.equal(0);
    await expect(
      staking.recoverERC20(smg.address, await smg.balanceOf(staking.address))
    ).to.emit(smg, "Transfer");

    for (const user of users) {
      await smg
        .connect(user)
        .approve(user.address, await smg.balanceOf(user.address));
      await smg
        .connect(user)
        .transferFrom(
          user.address,
          owner.address,
          await smg.balanceOf(user.address)
        );
      expect(await smg.balanceOf(user.address)).to.equal(0);
    }

    expect(await smg.balanceOf(owner.address)).to.equal(amount(600_000_000));
  });

  it("Should let users with shares 40% 30% 15% 10% 5% to stake", async function () {
    await expect(staking.setFee(0, 1000)).to.emit(staking, "FeeUpdated");
    await expect(staking.updateRewardDuration(s("4 weeks"))).to.emit(
      staking,
      "RewardDurationUpdated"
    );
    await expect(staking.updatePendingPeriod(3, s("7 days"))).to.emit(
      staking,
      "PendingPeriodUpdated"
    );
    await expect(staking.addReward(amount(100_000))).to.emit(
      staking,
      "RewardAdded"
    );

    const amounts = [40_000, 30_000, 15_000, 10_000, 5_000];
    for (let i = 0; i < amounts.length; i++) {
      const user = users[i + 1];
      const _amount = amount(amounts[i]);

      expect(smg.transfer(user.address, _amount)).to.emit(smg, "Transfer");
      expect(await smg.balanceOf(user.address)).to.equal(_amount);

      await expect(smg.connect(user).approve(staking.address, _amount)).to.emit(
        smg,
        "Approval"
      );
      await expect(staking.connect(user).stake(_amount)).to.emit(
        staking,
        "Staked"
      );

      expect(await staking.userStake(user.address)).to.equal(_amount);
    }

    expect(await staking.totalStake()).to.equal(amount(100_000));
  });

  it("Should let users with shares 40% 30% 15% 10% 5% to withdrawAll", async function () {
    await toFuture("4 weeks");
    const amounts = [40_000, 30_000, 15_000, 10_000, 5_000];

    expect(await staking.totalStake()).to.be.closeTo(
      amount(200_000),
      amount(1).toNumber()
    );

    for (let i = 0; i < amounts.length; i++) {
      const user = users[i + 1];
      const _amount = amount(amounts[i]);

      expect(await staking.userStake(user.address)).to.be.closeTo(
        _amount.mul(2),
        amount(1).toNumber()
      );
      await expect(staking.connect(user).withdrawAll()).to.emit(
        staking,
        "Withdrawn"
      );
    }

    await toFuture("3 weeks");

    for (let i = 0; i < amounts.length; i++) {
      const user = users[i + 1];
      const _amount = amount(amounts[i]);

      const pending = await staking.userPending(user.address, 0);

      expect(pending.fullAmount).to.be.closeTo(
        _amount.mul(2),
        amount(1).toNumber()
      );
      expect(
        await staking.userClaimablePendingPercentage(user.address, 0)
      ).to.equal(amount(100));
      await expect(staking.connect(user).claim(0)).to.emit(staking, "Claimed");
      expect(await staking.userStake(user.address)).to.equal(0);
      expect(await smg.balanceOf(user.address)).to.be.closeTo(
        _amount.mul(2),
        amount(1).toNumber()
      );
    }

    expect(await staking.totalStake()).to.equal(0);
  });
});
