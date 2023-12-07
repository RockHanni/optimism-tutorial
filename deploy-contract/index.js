#! /opt/homebrew/bin/node
const fs = require(`fs`)
const {ethers} = require('ethers')

require('dotenv').config();
const l2PrivateKey = process.env.L2_PRIVATE_KEY;

const optimismMintableERC20Factory = () => {
    const provider = new ethers.JsonRpcProvider(process.env.L2_API);
    const wallet = new ethers.Wallet(l2PrivateKey, provider)
    const optimismMintableERC20FactoryAddress = process.env.L2_OPTIMISM_MINTABLE_ERC20_FACTORY_ADDRESS;
    try {
        const ftext = fs.readFileSync("node_modules/@eth-optimism/contracts-bedrock/forge-artifacts/OptimismMintableERC20Factory.sol/OptimismMintableERC20Factory.json").toString().replace(/\n/g, "")
        const optimismMintableERC20FactoryData = JSON.parse(ftext);
        try {
            return new ethers.Contract(
                optimismMintableERC20FactoryAddress,
                optimismMintableERC20FactoryData.abi,
                wallet
            )
        } catch (err) {
            console.log(err)
        }
    } catch (err) {
        console.log(err);
    }
}

const deploy = async () => {
    const factoryContract = optimismMintableERC20Factory();
    // console.log(factoryContract.interface.fragments)
    try {
        const tx = await factoryContract.createOptimismMintableERC20WithDecimals(
            process.env.L1_TOKEN_ADDRESS,
            process.env.TOKEN_NAEME,
            process.env.TOKEN_SYMBOL,
            6
        );
        console.log(tx);
        const rcpt = await tx.wait();
        console.log(rcpt)
    } catch (err) {
        console.log(err)
    }
}

const main = async () => {
    await deploy()
}  // main

main().then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })

