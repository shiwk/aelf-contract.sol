const Association = artifacts.require('association')
const MetaCoin = artifacts.require('MetaCoin')
const web3 = Association.web3

const createAssociation = (owners, minimalApproval, maximalReject, maximalAbstain, required) => {
    return Association.new(owners, minimalApproval, maximalReject, maximalAbstain, required)
}

const utils = require('./utils')

contract('association', (accounts) => {
    let associationInstance
    let metaCoinInstance
    const minimalApproval = 1
    const maximalReject = 0
    const maximalAbstain = 0
    const required = 1

    const metaAmount = 100;

    beforeEach(async () => {
        associationInstance = await createAssociation([accounts[0], accounts[1], accounts[2]], minimalApproval, maximalReject, maximalAbstain, required)
        assert.ok(associationInstance)

        metaCoinInstance = await MetaCoin.deployed()

        console.log("Assoction contract deployed!")

        const deposit = 10000000
        // Send ether to association contract
        await new Promise((resolve, reject) => web3.eth.sendTransaction({
            to: associationInstance.address,
            value: deposit,
            from: accounts[0]
        }, e => (e ? reject(e) : resolve())))
        const balance = await utils.balanceOf(web3, associationInstance.address)
        assert.equal(balance.valueOf(), deposit)

        // send metacoin to association contract
        await metaCoinInstance.sendCoin(associationInstance.address, metaAmount, {from: accounts[0]})
        const metabalance = await metaCoinInstance.getBalance(associationInstance.address)
        assert.equal(metabalance, metaAmount)
    })

    it('send coint test', async () => {

        const amount = 10;
        const sendCoinData = metaCoinInstance.contract.methods.sendCoin(accounts[9], amount).encodeABI()

        const beforeBalance = await metaCoinInstance.getBalance(accounts[9])
        assert.equal(beforeBalance, 0)

        const now1 = Math.floor(Date.now() / 1000) + 60;
        const sendCoinProposalId = utils.getParamFromTxEvent(
            await associationInstance.createProposal(metaCoinInstance.address, 0, sendCoinData, now1, {from: accounts[0]}),
            'proposalId',
            null,
            'ProposalCreated'
        )

        let approveTx = await associationInstance.approve(sendCoinProposalId, {from: accounts[0]})
        let approveReceiptType = utils.getParamFromTxEvent(approveTx, 'receiptType', null, 'ReceiptCreated')
        assert.equal(approveReceiptType, 1)

        let tx = await associationInstance.release(sendCoinProposalId, {from: accounts[0]})
        const releasedId = utils.getParamFromTxEvent(tx, 'proposalId', null, 'ProposalReleased')

        assert.deepEqual(
            releasedId,
            sendCoinProposalId
        )

        let event = utils.rawLogEventExists(tx, "Transfer(address,address,uint256)")
        assert.ok(event, "Transfer event not emitted");

        const afterBalance = await metaCoinInstance.getBalance(accounts[9])
        assert.equal(afterBalance, amount)

        const contractBalance = await metaCoinInstance.getBalance(associationInstance.address)
        assert.equal(contractBalance, metaAmount - amount)
    })

    it('send coin test - rejected', async () => {

        const amount = 10;
        const sendCoinData = metaCoinInstance.contract.methods.sendCoin(accounts[9], amount).encodeABI()

        const now1 = Math.floor(Date.now() / 1000) + 60;
        const sendCoinProposalId = utils.getParamFromTxEvent(
            await associationInstance.createProposal(metaCoinInstance.address, 0, sendCoinData, now1, {from: accounts[0]}),
            'proposalId',
            null,
            'ProposalCreated'
        )

        let rejectTx = await associationInstance.reject(sendCoinProposalId, {from: accounts[1]})
        let rejectReceiptType = utils.getParamFromTxEvent(rejectTx, 'receiptType', null, 'ReceiptCreated')
        assert.equal(rejectReceiptType, 2)

        utils.assertThrowsAsynchronously(
            () => associationInstance.release(sendCoinProposalId, {from: accounts[1]})
        )
    })

    it('send coin test - abstain', async () => {

        const amount = 10;
        const sendCoinData = metaCoinInstance.contract.methods.sendCoin(accounts[9], amount).encodeABI()

        const now1 = Math.floor(Date.now() / 1000) + 60;
        const sendCoinProposalId = utils.getParamFromTxEvent(
            await associationInstance.createProposal(metaCoinInstance.address, 0, sendCoinData, now1, {from: accounts[0]}),
            'proposalId',
            null,
            'ProposalCreated'
        )

        let abstainTx = await associationInstance.abstain(sendCoinProposalId, {from: accounts[1]})
        let abstainReceiptType = utils.getParamFromTxEvent(abstainTx, 'receiptType', null, 'ReceiptCreated')
        assert.equal(abstainReceiptType, 3)

        utils.assertThrowsAsynchronously(
            () => associationInstance.release(sendCoinProposalId, {from: accounts[1]})
        )
    })
})