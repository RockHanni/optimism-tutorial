#! /usr/local/bin/node

// View transfers between L1 and L2 using the Optimism SDK

const ethers = require("ethers")
const optimismSDK = require("@eth-optimism/sdk")
require('dotenv').config()

// Global variable because we need them almost everywhere
let crossChainMessenger


const setup = async () => {

    l1SignerOrProvider = new ethers.providers.JsonRpcProvider(process.env.L1URL)
    l2SignerOrProvider = new ethers.providers.JsonRpcProvider(process.env.L2URL)
    const zeroAddr = "0x".padEnd(42, "0")
    const l1Contracts = {
        StateCommitmentChain: zeroAddr,
        CanonicalTransactionChain: zeroAddr,
        BondManager: zeroAddr,
        //DEVNET
        AddressManager: "0x8B016f48ED0AA76C8A0984FAE83429E13A90Ba76",   // Lib_AddressManager.json
        L1CrossDomainMessenger: "0xd9448dE6Cb1c52b368e092B6Ade54D39985D382a",   // Proxy__OVM_L1CrossDomainMessenger.json
        L1StandardBridge: "0x162900dEFC8cC83Ae94B815461BB5FA7d7598CB3",   // Proxy__OVM_L1StandardBridge.json
        OptimismPortal: "0x395f28246294062C2cEa739208B207d4501083B7",   // OptimismPortalProxy.json
        L2OutputOracle: "0x3E0aC9E17333DD68C4a7c5EB643Db51979953257",   // L2OutputOracleProxy.json
    }

    crossChainMessenger = new optimismSDK.CrossChainMessenger({
        l1ChainId: (await l1SignerOrProvider._networkPromise).chainId,
        l2ChainId: (await l2SignerOrProvider._networkPromise).chainId,
        l1SignerOrProvider: l1SignerOrProvider,
        l2SignerOrProvider: l2SignerOrProvider,
        contracts: {
            l1: l1Contracts,
            l2: optimismSDK.DEFAULT_L2_CONTRACT_ADDRESSES,
        },
    })
}    // setup


// Only the part of the ABI we need to get the symbol
const ERC20ABI = [
    {
        "constant": true,
        "inputs": [],
        "name": "symbol",
        "outputs": [
            {
                "name": "",
                "type": "string"
            }
        ],
        "payable": false,
        "stateMutability": "view",
        "type": "function"
    }
]     // ERC20ABI


const getSymbol = async l1Addr => {
    if (l1Addr == '0x0000000000000000000000000000000000000000')
        return "ETH"
    const l1Contract = new ethers.Contract(l1Addr, ERC20ABI, crossChainMessenger.l1SignerOrProvider)
    return await l1Contract.symbol()
}   // getSymbol

// Describe a cross domain transaction, either deposit or withdrawal
const describeTx = async tx => {
    console.log(`tx:${tx.transactionHash}`)
    // Assume all tokens have decimals = 18
    console.log(`\tAmount: ${tx.amount / 1e18} ${await getSymbol(tx.l1Token)}`)
    console.log(`\tRelayed: ${await crossChainMessenger.getMessageStatus(tx.transactionHash)
    == optimismSDK.MessageStatus.RELAYED}`)
}  // describeTx


const main = async () => {
    await setup()

    // The address we trace
    const addr = "0xBCf86Fd70a0183433763ab0c14E7a760194f3a9F"

    const deposits = await crossChainMessenger.getDepositsByAddress(addr)
    console.log(`Deposits by address ${addr}`)
    for (var i = 0; i < deposits.length; i++)
        await describeTx(deposits[i])

    const withdrawals = await crossChainMessenger.getWithdrawalsByAddress(addr)
    console.log(`\n\n\nWithdrawals by address ${addr}`)
    for (var i = 0; i < withdrawals.length; i++)
        await describeTx(withdrawals[i])

}  // main


main().then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })