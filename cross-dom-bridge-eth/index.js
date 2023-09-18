#! /opt/homebrew/bin/node

// Transfers between L1 and L2 using the Optimism SDK

const ethers = require("ethers")
const optimismSDK = require("@eth-optimism/sdk")
require('dotenv').config()


const mnemonic = process.env.MNEMONIC
const private_key = process.env.PRIVATE_KEY

const words = process.env.MNEMONIC.match(/[a-zA-Z]+/g).length
validLength = [12, 15, 18, 24]
if (!validLength.includes(words)) {
   console.log(`The mnemonic (${process.env.MNEMONIC}) is the wrong number of words`)
   process.exit(-1)
}

const l1Url = `https://eth-goerli.g.alchemy.com/v2/${process.env.GOERLI_ALCHEMY_KEY}`
// const l2Url = `https://opt-goerli.g.alchemy.com/v2/${process.env.OP_GOERLI_ALCHEMY_KEY}`
const l2Url = `http://8.219.129.226:8545`


// Global variable because we need them almost everywhere
let crossChainMessenger
let addr    // Our address

const getSigners = async () => {
    const l1RpcProvider = new ethers.providers.JsonRpcProvider(l1Url)
    const l2RpcProvider = new ethers.providers.JsonRpcProvider(l2Url)
    // const hdNode = ethers.utils.HDNode.fromMnemonic(mnemonic)
    // const privateKey = hdNode.derivePath(ethers.utils.defaultPath).privateKey
    const l1Wallet = new ethers.Wallet(private_key, l1RpcProvider)
    const l2Wallet = new ethers.Wallet(private_key, l2RpcProvider)

    return [l1Wallet, l2Wallet]
}   // getSigners


const setup = async() => {
  const [l1Signer, l2Signer] = await getSigners()
  addr = l1Signer.address
  crossChainMessenger = new optimismSDK.CrossChainMessenger({
      l1ChainId: 5,    // Goerli value, 1 for mainnet
      l2ChainId: 1852,  // Goerli value, 10 for mainnet
      l1SignerOrProvider: l1Signer,
      l2SignerOrProvider: l2Signer,
      contracts: {
          l1: {
              AddressManager: '0xA5803cf9Ad79f20567809EB710bC1489EE1aC786',
              L1CrossDomainMessenger:
                  '0xBFC07C1966AeFFb4dcE3E285B82F95B2af4b0c93',
              L1StandardBridge: '0x556984E35037DF7A6aeb5B9F1a86e7Bf4C2Bbe13',
              StateCommitmentChain:
                  '0x0000000000000000000000000000000000000000',
              CanonicalTransactionChain:
                  '0x0000000000000000000000000000000000000000',
              BondManager: '0x0000000000000000000000000000000000000000',
              OptimismPortal: '0x4adad1a0E565c8dF6e99E53bEf9b053D141F7E05',
              L2OutputOracle: '0x8652a6ad0dBDDa34459Bb2D0a15494240823a26B',
          },
          l2: optimismSDK.DEFAULT_L2_CONTRACT_ADDRESSES,
      },
      bridges: {
          Standard: {
              l1Bridge: '0x556984E35037DF7A6aeb5B9F1a86e7Bf4C2Bbe13',
              l2Bridge: "0x4200000000000000000000000000000000000010",
              Adapter: optimismSDK.StandardBridgeAdapter
          },
          ETH: {
              Adapter: optimismSDK.ETHBridgeAdapter,
              l1Bridge: '0x556984E35037DF7A6aeb5B9F1a86e7Bf4C2Bbe13',
              l2Bridge: '0x4200000000000000000000000000000000000010',
          }
      },
      bedrock: true
  })
}    // setup



const gwei = BigInt(1e9)
const eth = gwei * gwei   // 10^18
const centieth = eth/1000n


const reportBalances = async () => {
  const l1Balance = (await crossChainMessenger.l1Signer.getBalance()).toString().slice(0,-9)
  const l2Balance = (await crossChainMessenger.l2Signer.getBalance()).toString().slice(0,-9)

  console.log(`On L1:${l1Balance} Gwei    On L2:${l2Balance} Gwei`)
}    // reportBalances


const depositETH = async () => {

  console.log("Deposit ETH")
  await reportBalances()
  const start = new Date()

  const response = await crossChainMessenger.depositETH(10000000n * gwei)
  console.log(`Transaction hash (on L1): ${response.hash}`)
  await response.wait()
  console.log("Waiting for status to change to RELAYED")
  console.log(`Time so far ${(new Date()-start)/1000} seconds`)
  await crossChainMessenger.waitForMessageStatus(response.hash,
                                                  optimismSDK.MessageStatus.RELAYED)

  await reportBalances()
  console.log(`depositETH took ${(new Date()-start)/1000} seconds\n\n`)
}     // depositETH()





const withdrawETH = async () => { 
  
  console.log("Withdraw ETH")
  const start = new Date()  
  await reportBalances()

  const response = await crossChainMessenger.withdrawETH(centieth, {
      recipient: '0x1e6c765B2fFf66D9F672c20640A136730EE5E2D1',
      overrides: {
          gasLimit: 5000000,
      }
  })
  console.log(`Transaction hash (on L2): ${response.hash}`)
  console.log(`\tFor more information: https://goerli-optimism.etherscan.io/tx/${response.hash}`)
  await response.wait()

  console.log("Waiting for status to be READY_TO_PROVE")
  console.log(`Time so far ${(new Date()-start)/1000} seconds`)
  await crossChainMessenger.waitForMessageStatus(response.hash, 
    optimismSDK.MessageStatus.READY_TO_PROVE)
  console.log(`Time so far ${(new Date()-start)/1000} seconds`)  
  await crossChainMessenger.proveMessage(response.hash)
  

  console.log("In the challenge period, waiting for status READY_FOR_RELAY") 
  console.log(`Time so far ${(new Date()-start)/1000} seconds`)
  await crossChainMessenger.waitForMessageStatus(response.hash, 
                                                optimismSDK.MessageStatus.READY_FOR_RELAY) 
  console.log("Ready for relay, finalizing message now")
  console.log(`Time so far ${(new Date()-start)/1000} seconds`)  
  await crossChainMessenger.finalizeMessage(response.hash)

  console.log("Waiting for status to change to RELAYED")
  console.log(`Time so far ${(new Date()-start)/1000} seconds`)  
  await crossChainMessenger.waitForMessageStatus(response, 
    optimismSDK.MessageStatus.RELAYED)
  
  await reportBalances()   
  console.log(`withdrawETH took ${(new Date()-start)/1000} seconds\n\n\n`)  
}     // withdrawETH()


const main = async () => {
    await setup()
    // await depositETH()
    await withdrawETH()
    // await depositERC20()
    // await withdrawERC20()
}  // main



main().then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })





