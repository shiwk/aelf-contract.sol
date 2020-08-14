# aelf-contracts.sol

Here is the solidity contract collection for AElf Ecosystem. You can check the contract development processing from this repo 
which integrates source code and test cases, with [Truffle](https://www.trufflesuite.com/) developing framework.


## Getting Started

It is easy to see where to begin if you know well [Truffle](https://github.com/trufflesuite/truffle) project. 
Otherwise prepare developing environment before set out to develop. 

### Install

```
$ npm install -g truffle
```

Please make sure you have the latest nodejs & npm installed if something went wrong. 

Setup local development blockchain server before you develop with Truffle. 
We recommend you use [ganache](https://truffleframework.com/ganache/) and [ganache](https://truffleframework.com/ganache/).

+  [ganache-cli](https://github.com/trufflesuite/ganache-cli): a command-line version of Truffle's blockchain server.
+  [ganache](https://truffleframework.com/ganache/): A GUI for the server that displays your transaction history and chain state.

See [CHOOSING AN ETHEREUM CLIENT](https://www.trufflesuite.com/docs/truffle/reference/choosing-an-ethereum-client) for details.


### Example

[demo.metacoin](demo.metacoin) contains simple **metacoin** contract and test cases. 
And you can also check [init](init) directory for the basic workspace structure. 
See [Truffle docs](https://www.trufflesuite.com/docs/truffle/overview) for details.

*contracts*: Directory for Solidity contracts

*migrations*: Directory for scriptable deployment files

*test*: Directory for test files for testing your application and contracts

*truffle-config.js*: Truffle configuration file


