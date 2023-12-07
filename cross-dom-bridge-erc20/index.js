#! /usr/local/bin/node

// ERC-20 transfers between L1 and L2 using the Optimism SDK

const ethers = require("ethers")
const optimismSDK = require("@eth-optimism/sdk")
const fs = require("fs");
require('dotenv').config()


// const mnemonic = process.env.MNEMONIC
const private_key = process.env.PRIVATE_KEY

// const words = process.env.MNEMONIC.match(/[a-zA-Z]+/g).length
// validLength = [12, 15, 18, 24]
// if (!validLength.includes(words)) {
//    console.log(`The mnemonic (${process.env.MNEMONIC}) is the wrong number of words`)
//    process.exit(-1)
// }

// const l1Url = `https://eth-goerli.g.alchemy.com/v2/${process.env.GOERLI_ALCHEMY_KEY}`
// const l1Url = `https://eth-sepolia.g.alchemy.com/v2/${process.env.SEPOLIA_ALCHEMY_KEY}`
const l1Url = `https://sepolia.infura.io/v3/5b4c68069e4e4c7d8e42fc3154900188`
// const l2Url = `https://opt-goerli.g.alchemy.com/v2/${process.env.OP_GOERLI_ALCHEMY_KEY}`
const l2Url = `${process.env.L2URL}`

// Contract addresses for OPTb tokens, taken
// from https://github.com/ethereum-optimism/ethereum-optimism.github.io/blob/master/data/OUTb/data.json
const erc20Addrs = {
    l1Addr: "0xeb0c2e842bb7c1789D04c09B33eBb893Ed23D2D2",
    l2Addr: "0x9e0577FE71A18445ce65d7Fc220198b78e010ff9"
}    // erc20Addrs

// To learn how to deploy an L2 equivalent to an L1 ERC-20 contract,
// see here: 
// https://github.com/ethereum-optimism/optimism-tutorial/tree/main/standard-bridge-standard-token


// Global variable because we need them almost everywhere
let crossChainMessenger
let l1ERC20, l2ERC20    // OUTb contracts to show ERC-20 transfers
let ourAddr             // The address of the signer we use.  


// Get signers on L1 and L2 (for the same address). Note that 
// this address needs to have ETH on it, both on Optimism and
// Optimism Georli
// const getSigners = async () => {
//     const l1RpcProvider = new ethers.providers.JsonRpcProvider(l1Url)
//     const l2RpcProvider = new ethers.providers.JsonRpcProvider(l2Url)
//     const hdNode = ethers.utils.HDNode.fromMnemonic(mnemonic)
//     const privateKey = hdNode.derivePath(ethers.utils.defaultPath).privateKey
//     const l1Wallet = new ethers.Wallet(privateKey, l1RpcProvider)
//     const l2Wallet = new ethers.Wallet(privateKey, l2RpcProvider)
//
//     return [l1Wallet, l2Wallet]
// }   // getSigners

const getSigners = async () => {
    const l1RpcProvider = new ethers.providers.JsonRpcProvider(l1Url)
    const l2RpcProvider = new ethers.providers.JsonRpcProvider(l2Url)
    const l1Wallet = new ethers.Wallet(private_key, l1RpcProvider)
    const l2Wallet = new ethers.Wallet(private_key, l2RpcProvider)

    return [l1Wallet, l2Wallet]
}   // getSigners


const usdcConstract = (token_addr ,signer) => {
    try {
        const ftext = fs.readFileSync("FiatTokenV1.json").toString().replace(/\n/g, "")
        const proxyData = JSON.parse(ftext);
        try {
            return new ethers.Contract(
                token_addr,
                proxyData.abi,
                signer
            )
        } catch (err) {
            console.log(err)
        }
    } catch (err) {
        console.log(err);
    }
}

// The ABI fragment for the contract. We only need to know how to do two things:
// 1. Get an account's balance
// 2. Call the faucet to get more (only works on L1). Of course, production 
//    ERC-20 tokens tend to be a bit harder to acquire.
const erc20ABI = [
  // balanceOf
  {
    constant: true,
    inputs: [{ name: "_owner", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "balance", type: "uint256" }],
    type: "function",
  },
  // faucet
  {
    inputs: [],
    name: "faucet",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function"
  }
]    // erc20ABI


const setup = async () => {
    const [l1Signer, l2Signer] = await getSigners()
    ourAddr = l1Signer.address
    console.log(`our address ${ourAddr}`)
    crossChainMessenger = new optimismSDK.CrossChainMessenger({
        l1ChainId: 11155111,    // Goerli value, 1 for mainnet
        l2ChainId: 1852,  // Goerli value, 10 for mainnet
        l1SignerOrProvider: l1Signer,
        l2SignerOrProvider: l2Signer,
        contracts: {
            l1: {
                AddressManager: '0xB2CdE4cc52Bd844b9FE1193E73404d6a93E9f698',
                L1CrossDomainMessenger:
                    '0x3E0aC9E17333DD68C4a7c5EB643Db51979953257',
                L1StandardBridge: '0x395f28246294062C2cEa739208B207d4501083B7',
                StateCommitmentChain:
                    '0x0000000000000000000000000000000000000000',
                CanonicalTransactionChain:
                    '0x0000000000000000000000000000000000000000',
                BondManager: '0x0000000000000000000000000000000000000000',
                OptimismPortal: '0x8B016f48ED0AA76C8A0984FAE83429E13A90Ba76',
                L2OutputOracle: '0x21725a38977f68cebE96A51D11C08572AA6e542a',
            },
            l2: optimismSDK.DEFAULT_L2_CONTRACT_ADDRESSES,
        },
        bridges: {
            Standard: {
                l1Bridge: '0x395f28246294062C2cEa739208B207d4501083B7',
                l2Bridge: "0x4200000000000000000000000000000000000010",
                Adapter: optimismSDK.StandardBridgeAdapter
            },
            ETH: {
                Adapter: optimismSDK.ETHBridgeAdapter,
                l1Bridge: '0x395f28246294062C2cEa739208B207d4501083B7',
                l2Bridge: '0x4200000000000000000000000000000000000010',
            }
        },
        bedrock: true
    })
    l1ERC20 = new ethers.Contract(erc20Addrs.l1Addr, erc20ABI, l1Signer)
    // l1ERC20 =  usdcConstract(erc20Addrs.l1Addr, l1Signer)
    l2ERC20 = new ethers.Contract(erc20Addrs.l2Addr, erc20ABI, l2Signer)
    // l2ERC20 =  usdcConstract(erc20Addrs.l2Addr, l2Signer)
}    // setup


const reportERC20Balances = async () => {
    const l1Balance = (await l1ERC20.balanceOf(ourAddr)).toString().slice(0, -18)
    const l2Balance = (await l2ERC20.balanceOf(ourAddr)).toString().slice(0, -18)
    console.log(`OUTb on L1:${l1Balance}     OUTb on L2:${l2Balance}`)

    // if (l1Balance != 0) {
    //     return
    // }

    // console.log(`You don't have enough OUTb on L1. Let's call the faucet to fix that`)
    // const tx = (await l1ERC20.faucet())
    // console.log(`Faucet tx: ${tx.hash}`)
    // console.log(`\tMore info: https://sepolia.etherscan.io/tx/${tx.hash}`)
    // await tx.wait()
    // const newBalance = (await l1ERC20.balanceOf(ourAddr)).toString().slice(0, -18)
    // console.log(`New L1 OUTb balance: ${newBalance}`)
}    // reportERC20Balances


const oneToken = BigInt(1e6)


const depositERC20 = async () => {

    console.log("Deposit ERC20")
    await reportERC20Balances()
    const start = new Date()

    // Need the l2 address to know which bridge is responsible
    const allowanceResponse = await crossChainMessenger.approveERC20(
        erc20Addrs.l1Addr, erc20Addrs.l2Addr, oneToken)
    await allowanceResponse.wait()
    console.log(`Allowance given by tx ${allowanceResponse.hash}`)
    console.log(`\tMore info: https://sepolia.etherscan.io/tx/${allowanceResponse.hash}`)
    console.log(`Time so far ${(new Date() - start) / 1000} seconds`)

    const response = await crossChainMessenger.depositERC20(
        erc20Addrs.l1Addr, erc20Addrs.l2Addr, oneToken)
    console.log(`Deposit transaction hash (on L1): ${response.hash}`)
    console.log(`\tMore info: https://sepolia.etherscan.io/tx/${response.hash}`)
    await response.wait()
    console.log("Waiting for status to change to RELAYED")
    console.log(`Time so far ${(new Date() - start) / 1000} seconds`)
    await crossChainMessenger.waitForMessageStatus(response.hash,
        optimismSDK.MessageStatus.RELAYED)

    await reportERC20Balances()
    console.log(`depositERC20 took ${(new Date() - start) / 1000} seconds\n\n`)
}     // depositERC20()


const withdrawERC20 = async () => {

    console.log("Withdraw ERC20")
    const start = new Date()
    await reportERC20Balances()

    const response = await crossChainMessenger.withdrawERC20(
        erc20Addrs.l1Addr, erc20Addrs.l2Addr, oneToken)
    console.log(`Transaction hash (on L2): ${response.hash}`)
    console.log(`\tFor more information: https://goerli-optimism.etherscan.io/tx/${response.hash}`)
    await response.wait()

    console.log("Waiting for status to be READY_TO_PROVE")
    console.log(`Time so far ${(new Date() - start) / 1000} seconds`)
    await crossChainMessenger.waitForMessageStatus(response.hash,
        optimismSDK.MessageStatus.READY_TO_PROVE)
    console.log(`Time so far ${(new Date() - start) / 1000} seconds`)
    await crossChainMessenger.proveMessage(response.hash)


    console.log("In the challenge period, waiting for status READY_FOR_RELAY")
    console.log(`Time so far ${(new Date() - start) / 1000} seconds`)
    await crossChainMessenger.waitForMessageStatus(response.hash,
        optimismSDK.MessageStatus.READY_FOR_RELAY)
    console.log("Ready for relay, finalizing message now")
    console.log(`Time so far ${(new Date() - start) / 1000} seconds`)
    await crossChainMessenger.finalizeMessage(response.hash)

    console.log("Waiting for status to change to RELAYED")
    console.log(`Time so far ${(new Date() - start) / 1000} seconds`)
    await crossChainMessenger.waitForMessageStatus(response,
        optimismSDK.MessageStatus.RELAYED)
    await reportERC20Balances()
    console.log(`withdrawERC20 took ${(new Date() - start) / 1000} seconds\n\n\n`)
}     // withdrawERC20()


const main = async () => {
    await setup()
    await reportERC20Balances()
    await depositERC20()
    // await withdrawERC20()
}  // main


main().then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })





