#! /opt/homebrew/bin/node
const {ethers} = require('ethers')
const fs = require('fs')

require('dotenv').config();
const PrivateKey = process.env.PRIVATE_KEY;
const provider = new ethers.JsonRpcProvider(process.env.L1_API);
const wallet = new ethers.Wallet(PrivateKey, provider)

const constract = () => {
    try {
        const ftext = fs.readFileSync("FiatTokenV1.json").toString().replace(/\n/g, "")
        const proxyData = JSON.parse(ftext);
        try {
            return new ethers.Contract(
                process.env.PROXY_ADDRESS,
                proxyData.abi,
                wallet
            )
        } catch (err) {
            console.log(err)
        }
    } catch (err) {
        console.log(err);
    }
}

const call = async () => {
    const fiatTokenV2_2Contract = constract();
    // console.log(factoryContract.interface.fragments)
    try {
        // const amount = ethers.toBigInt("19999980000000000");
        // const tx = await fiatTokenV2_2Contract.mint(
        //     process.env.TO_ACCOUNT,
        //     amount
        // )

        // const tx = await  fiatTokenV2_2Contract.balanceOf(
        //        process.env.TO_ACCOUNT,
        //     )

        const amount = ethers.toBigInt("20000000000000000");
        // const tx = await fiatTokenV2_2Contract.configureMinter(
        //    process.env.TO_ACCOUNT,
        //     amount
        // )

        const tx = await fiatTokenV2_2Contract.mint(
            process.env.TO_ACCOUNT,
            amount
        )

        // const tx = await fiatTokenV2_2Contract.minterAllowance(
        //     process.env.TO_ACCOUNT,
        // )

        // const tx = await fiatTokenV2_2Contract.name()
        // const tx = await fiatTokenV2_2Contract.isMinter(
        //     process.env.TO_ACCOUNT
        // )
        // const tx = await fiatTokenV2_2Contract.symbol()
        // const tx = await fiatTokenV2_2Contract.masterMinter()

        console.log(tx);
        const rcpt = await tx.wait();
        console.log(rcpt)
    } catch (err) {
        console.log(err)
    }
}

const main = async () => {
    await call()
}  // main

main().then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })

