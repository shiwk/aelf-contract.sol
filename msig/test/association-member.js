const Association = artifacts.require('association')
const web3 = Association.web3

const createAssociation = (owners, minimalApproval, maximalReject, maximalAbstain, required) => {
    return Association.new(owners, minimalApproval, maximalReject, maximalAbstain, required)
}


const utils = require('./utils')

contract('association', (accounts) => {
    let associationInstance


    const minimalApproval = 1
    const maximalReject = 0
    const maximalAbstain = 0
    const required = 1

    beforeEach(async () => {
        associationInstance = await createAssociation([accounts[0], accounts[1], accounts[2]], minimalApproval, maximalReject, maximalAbstain, required)
        assert.ok(associationInstance)

        console.log("assoction created!")

        const deposit = 10000000
        // Send money to association contract
        await new Promise((resolve, reject) => web3.eth.sendTransaction({
            to: associationInstance.address,
            value: deposit,
            from: accounts[0]
        }, e => (e ? reject(e) : resolve())))
        const balance = await utils.balanceOf(web3, associationInstance.address)
        assert.equal(balance.valueOf(), deposit)
    })

    it('test execution after requirements changed', async () => {

        const addMemberData = associationInstance.contract.methods.addMember(accounts[3]).encodeABI()
        const now1 = Math.floor(Date.now() / 1000) + 60;
        console.log(`now = ${now1}`)
        const addMemberProposalId = utils.getParamFromTxEvent(
            await associationInstance.createProposal(associationInstance.address, 0, addMemberData, now1, {from: accounts[0]}),
            'proposalId',
            null,
            'ProposalCreated'
        )

        assert.equal(await associationInstance.isMember(accounts[3]), false)

        // Update required to 1
        const newMinimalApprove = minimalApproval + 1;
        const newRequired = required + 1;
        const updateRequirementData = associationInstance.contract.methods.changeThreshold(newMinimalApprove, maximalReject, maximalAbstain, newRequired).encodeABI()

        // Submit successfully
        const now2 = Math.floor(Date.now() / 1000) + 60;
        let createProposalTx = await associationInstance.createProposal(associationInstance.address, 0, updateRequirementData, now2, {from: accounts[0]});
        const changeThresholdProposalId = utils.getParamFromTxEvent(
            createProposalTx,
            'proposalId',
            null,
            'ProposalCreated'
        )

        // Confirm change requirement transaction
        let approveTx1 = await associationInstance.approve(changeThresholdProposalId, {from: accounts[0]});
        assert.deepEqual(utils.getParamFromTxEvent(
            approveTx1,
            'proposalId',
            null,
            'ReceiptCreated'
            ),
            changeThresholdProposalId
        )
        let approveTx2 = await associationInstance.approve(changeThresholdProposalId, {from: accounts[1]})
        assert.deepEqual(utils.getParamFromTxEvent(
            approveTx2,
            'proposalId',
            null,
            'ReceiptCreated'
            ),
            changeThresholdProposalId
        )

        assert.equal((await associationInstance.minimal_approval()).toNumber(), minimalApproval)
        assert.equal((await associationInstance.required()).toNumber(), required)

        // not proposer
        utils.assertThrowsAsynchronously(
            () => associationInstance.release(changeThresholdProposalId, {from: accounts[9]})
        )

        await associationInstance.release(changeThresholdProposalId, {from: accounts[0]})
        // releaseTx

        assert.equal((await associationInstance.minimal_approval()).toNumber(), newMinimalApprove)
        assert.equal((await associationInstance.required()).toNumber(), newRequired)

        // not approved
        utils.assertThrowsAsynchronously(
            () => associationInstance.release(addMemberProposalId, {from: accounts[0]})
        )
        await associationInstance.approve(addMemberProposalId, {from: accounts[0]})
        await associationInstance.approve(addMemberProposalId, {from: accounts[1]})

        // not proposer
        utils.assertThrowsAsynchronously(
            () => associationInstance.release(addMemberProposalId, {from: accounts[1]})
        )
        await associationInstance.release(addMemberProposalId, {from: accounts[0]})
        assert.equal(await associationInstance.isMember(accounts[3]), true)

    })

})
