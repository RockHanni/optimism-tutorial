// Plugins
require('@nomiclabs/hardhat-ethers')

// Load environment variables from .env
require('dotenv').config();


// const words = process.env.MNEMONIC.match(/[a-zA-Z]+/g).length
// validLength = [12, 15, 18, 24]
// if (!validLength.includes(words)) {
//    console.log(`The mnemonic (${process.env.MNEMONIC}) is the wrong number of words`)
//    process.exit(-1)
// }

module.exports = {
  networks: {
    // 'optimism-goerli': {
    //   chainId: 420,
    //   url: `https://opt-goerli.g.alchemy.com/v2/${process.env.L2_ALCHEMY_KEY}`,
    //   accounts: { mnemonic: process.env.MNEMONIC }
    // },
    // 'optimism-mainnet': {
    //   chainId: 10,
    //   url: `https://opt-mainnet.g.alchemy.com/v2/${process.env.L2_ALCHEMY_KEY}`,
    //   accounts: { mnemonic: process.env.MNEMONIC }
    // },
    'ipollo-sepolia': {
      chainId: 1852,
      url: `${process.env.L2URL}`,
      accounts: {
        mnemonic: `${process.env.MNEMONIC}`
      }
    }
  },
  solidity: '0.8.13',
}
