#! /opt/homebrew/bin/node

// Transfers between L1 and L2 using the Optimism SDK

const ethers = require("ethers")
const optimismSDK = require("@eth-optimism/sdk")
const fs = require("fs");
const {Web3} = require("web3");
require('dotenv').config()

const mnemonic = process.env.MNEMONIC
const private_key = process.env.PRIVATE_KEY

const words = process.env.MNEMONIC.match(/[a-zA-Z]+/g).length
validLength = [12, 15, 18, 24]
if (!validLength.includes(words)) {
    console.log(`The mnemonic (${process.env.MNEMONIC}) is the wrong number of words`)
    process.exit(-1)
}

const l1Url = `https://eth-sepolia.g.alchemy.com/v2/${process.env.GOERLI_ALCHEMY_KEY}`
// const l2Url = `https://opt-goerli.g.alchemy.com/v2/${process.env.OP_GOERLI_ALCHEMY_KEY}`
const l2Url = `${process.env.L2URL}`


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


const setup = async () => {
    const [l1Signer, l2Signer] = await getSigners()
    addr = l1Signer.address
    crossChainMessenger = new optimismSDK.CrossChainMessenger({
        l1ChainId: 11155111,    // sepolia value, 1 for mainnet
        l2ChainId: 1852,  // sepolia value, 852 for mainnet
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

}    // setup


const gwei = BigInt(1e9)
const eth = gwei * gwei   // 10^18
const centieth = eth


const reportBalances = async () => {
    const l1Balance = (await crossChainMessenger.l1Signer.getBalance()).toString().slice(0, -9)
    const l2Balance = (await crossChainMessenger.l2Signer.getBalance()).toString().slice(0, -9)

    console.log(`On L1:${l1Balance} Gwei    On L2:${l2Balance} Gwei`)
}    // reportBalances


const depositETH = async () => {

    console.log("Deposit ETH")
    await reportBalances()
    const start = new Date()

    const response = await crossChainMessenger.depositETH(5000000n * gwei, {
        // recipient: '0xC50Fd4a5a738cB02FEb9aF4F3C9147a4c234385d'
    })
    console.log(`Transaction hash (on L1): ${response.hash}`)
    await response.wait()
    console.log("Waiting for status to change to RELAYED")
    console.log(`Time so far ${(new Date() - start) / 1000} seconds`)
    await crossChainMessenger.waitForMessageStatus(response.hash,
        optimismSDK.MessageStatus.RELAYED)

    await reportBalances()
    console.log(`depositETH took ${(new Date() - start) / 1000} seconds\n\n`)
}     // depositETH()

const withdrawETH = async () => {

    console.log("Withdraw ETH")
    const start = new Date()
    await reportBalances()

    const response = await crossChainMessenger.withdrawETH(2000000n * gwei, {
        // recipient: '0xc309507A5508c5E91d1A5e04614D723851BCb571',
        overrides: {
            gasLimit: 5000000,
        }
    })
    // fix failed tx
    const l2RpcProvider = new ethers.providers.JsonRpcProvider(l2Url)
    const response = await l2RpcProvider.getTransaction('0x78163deb9517538bc96757dd086fed6d029d969d23445f2ee4113f1f083dac54')


    console.log(`Transaction hash (on L2): ${response.hash}`)
    console.log(`\tFor more information: https://goerli-optimism.etherscan.io/tx/${response.hash}`)
    await response.wait()

    console.log("Waiting for status to be READY_TO_PROVE")
    console.log(`Time so far ${(new Date() - start) / 1000} seconds`)
    await crossChainMessenger.waitForMessageStatus(response.hash,
        optimismSDK.MessageStatus.READY_TO_PROVE)
    console.log(`Time so far ${(new Date() - start) / 1000} seconds`)
    await crossChainMessenger.proveMessage(response.hash, {
        overrides:{
            gasLimit: 1000000
        }
    })


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

    await reportBalances()
    console.log(`withdrawETH took ${(new Date() - start) / 1000} seconds\n\n\n`)
}     // withdrawETH()


const depositWETH = async () => {
    const { Web3 } = require("web3");
    const fs = require("fs");
    const abi  = JSON.parse(fs.readFileSync("./WETH9.json"));
    const web3 = new Web3(
        new Web3.providers.HttpProvider(
            `http://sepolia.ipollo.xyz`,
        ),
    );

    // Creating a signing account from a private key
    const signer = web3.eth.accounts.privateKeyToAccount(
        process.env.L2_PRIVATE_KEY
    );

    web3.eth.accounts.wallet.add(signer);

    // Creating a Contract instance
    const contract = new web3.eth.Contract(
        abi,
        // Replace this with the address of your deployed contract
        `0x4200000000000000000000000000000000000006`,
    );

    const gasPrice = await web3.eth.getGasPrice();
    const method_abi = contract.methods.deposit(signer.address, 4000000n * gwei).encodeABI();
    const tx = {
        from: signer.address,
        to: contract.options.address,
        data: method_abi,
        value: 4000000n * gwei,
        gasPrice: gasPrice,
    };
    const gas_estimate = await web3.eth.estimateGas(tx);
    tx.gas = gas_estimate;
    const signedTx = await web3.eth.accounts.signTransaction(tx, signer.privateKey);
    console.log("Raw transaction data: " + ( signedTx).rawTransaction);
    // Sending the transaction to the network
    const receipt = await web3.eth
        .sendSignedTransaction(signedTx.rawTransaction)
        .once("transactionHash", (txhash) => {
            console.log(`Mining transaction ...`);
            console.log(`https://sepolia.ipolloscan.io/tx/${txhash}`);
        });
    // The transaction is now on chain!
    console.log(`Mined in block ${receipt.blockNumber}`);
}     // depositWETH()

const withdrawWETH = async () => {
    const { Web3 } = require("web3");
    const fs = require("fs");
    const abi  = JSON.parse(fs.readFileSync("./WETH9.json"));
    const web3 = new Web3(
        new Web3.providers.HttpProvider(
            `http://sepolia.ipollo.xyz`,
        ),
    );

    // Creating a signing account from a private key
    const signer = web3.eth.accounts.privateKeyToAccount(
        process.env.L2_PRIVATE_KEY
    );

    web3.eth.accounts.wallet.add(signer);

    // Creating a Contract instance
    const contract = new web3.eth.Contract(
        abi,
        // Replace this with the address of your deployed contract
        `0x4200000000000000000000000000000000000006`,
    );

    const gasPrice = await web3.eth.getGasPrice();

    const method_abi = contract.methods.withdraw(3000000n * gwei).encodeABI();
    const tx = {
        from: signer.address,
        to: contract.options.address,
        data: method_abi,
        value: '0',
        gasPrice: gasPrice,
    };

    tx.gas = await web3.eth.estimateGas(tx);
    const signedTx = await web3.eth.accounts.signTransaction(tx, signer.privateKey);
    console.log("Raw transaction data: " + ( signedTx).rawTransaction);
    // Sending the transaction to the network
    const receipt = await web3.eth
        .sendSignedTransaction(signedTx.rawTransaction)
        .once("transactionHash", (txhash) => {
            console.log(`Mining transaction ...`);
            console.log(`https://sepolia.ipolloscan.io/tx/${txhash}`);
        });
    // The transaction is now on chain!
    console.log(`Mined in block ${receipt.blockNumber}`);
}     // withdrawWETH()


const mintERC20Mock = async () => {
    const { Web3 } = require("web3");
    const fs = require("fs");
    const abi  = JSON.parse(fs.readFileSync("./ERC20Mock.json"));
    const web3 = new Web3(
        new Web3.providers.HttpProvider(
            `http://sepolia.ipollo.xyz`,
        ),
    );

    // Creating a signing account from a private key
    const signer = web3.eth.accounts.privateKeyToAccount(
        process.env.L2_PRIVATE_KEY
    );

    web3.eth.accounts.wallet.add(signer);

    // Creating a Contract instance
    const contract = new web3.eth.Contract(
        abi,
        // Replace this with the address of your deployed contract
        `0x689fd67e579742488bd562AdddaEE08e099D6E53`,
    );
    const method_abi = contract.methods.mint(signer.address, 1000000n * gwei).encodeABI();
    const gasPrice = await web3.eth.getGasPrice();
    const tx = {
        from: signer.address,
        to: contract.options.address,
        data: method_abi,
        value: '0',
        gasPrice: gasPrice,
    };

    tx.gas = await web3.eth.estimateGas(tx);
    const signedTx = await web3.eth.accounts.signTransaction(tx, signer.privateKey);
    console.log("Raw transaction data: " + ( signedTx).rawTransaction);
    // Sending the transaction to the network
    const receipt = await web3.eth
        .sendSignedTransaction(signedTx.rawTransaction)
        .once("transactionHash", (txhash) => {
            console.log(`Mining transaction ...`);
            console.log(`https://sepolia.ipolloscan.io/tx/${txhash}`);
        });
    // The transaction is now on chain!
    console.log(`Mined in block ${receipt.blockNumber}`);
}

const withdrawFee = async () => {
    const { Web3 } = require("web3");
    const fs = require("fs");
    const abi  = JSON.parse(fs.readFileSync("./FeeVault.json"));
    const web3 = new Web3(
        new Web3.providers.HttpProvider(
            `http://sepolia.ipollo.xyz`,
        ),
    );

    // Creating a signing account from a private key
    const signer = web3.eth.accounts.privateKeyToAccount(
        process.env.L2_PRIVATE_KEY
    );

    web3.eth.accounts.wallet.add(signer);

    // Creating a Contract instance
    const contract = new web3.eth.Contract(
        abi,
        // Replace this with the address of your deployed contract
        `0x4200000000000000000000000000000000000011`,
    );

    const method_abi = contract.methods.withdraw().encodeABI();
    const tx = {
        from: signer.address,
        to: contract.options.address,
        data: method_abi,
        value: '0',
        gasPrice: '1000000',
    };

    const gas_estimate = await web3.eth.estimateGas(tx);
    tx.gas = gas_estimate;
    const signedTx = await web3.eth.accounts.signTransaction(tx, signer.privateKey);
    console.log("Raw transaction data: " + ( signedTx).rawTransaction);
    // Sending the transaction to the network
    const receipt = await web3.eth
        .sendSignedTransaction(signedTx.rawTransaction)
        .once("transactionHash", (txhash) => {
            console.log(`Mining transaction ...`);
            console.log(`https://sepolia.ipolloscan.io/tx/${txhash}`);
        });
    // The transaction is now on chain!
    console.log(`Mined in block ${receipt.blockNumber}`);
}     // withdrawWETH()


const main = async () => {
    await setup()
    // await depositWETH()
    // await withdrawWETH()
    await mintERC20Mock()
    // await depositETH()
    await withdrawETH()
    // await depositERC20()
    // await withdrawERC20()
    // await withdrawFee()
}  // main


main().then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })






