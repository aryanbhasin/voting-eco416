# OpenVote

OpenVote is a decentralized voting platform built as a project for ECO416. It is built on Solidity and Web3.js

## Installation

1. Clone the repository
```bash
git clone https://github.com/your_username/repository_name.git
```
2. Use the package manager _npm_ to install required packages.

```bash
npm install
```
3. Download Ganache and the Metamask Chrome extension. Open Ganache and select "Quick Project"

4. Fire up two terminal windows inside the repository folder. 

- In the first one, run
```bash
truffle compile;
truffle migrate --reset
```
- In the second one, run
```bash
npm run dev
```

5. You should now be able to interface with the project. Use the first Ethereum address in Ganache as the admin login.

## License
[MIT](https://choosealicense.com/licenses/mit/)