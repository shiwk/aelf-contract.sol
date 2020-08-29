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

        console.log("Assoction contract deployed!")

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

    it('add member test', async () => {
        const addMemberData = associationInstance.contract.methods.addMember(accounts[3]).encodeABI()
        const now1 = Math.floor(Date.now() / 1000) + 60;
        const addMemberProposalId = utils.getParamFromTxEvent(
            await associationInstance.createProposal(associationInstance.address, 0, addMemberData, now1, {from: accounts[0]}),
            'proposalId',
            null,
            'ProposalCreated'
        )

        assert.equal(await associationInstance.isMember(accounts[3]), false)

        // not approved
        utils.assertThrowsAsynchronously(
            () => associationInstance.release(addMemberProposalId, {from: accounts[0]})
        )
        await associationInstance.approve(addMemberProposalId, {from: accounts[0]})

        // not proposer
        utils.assertThrowsAsynchronously(
            () => associationInstance.release(addMemberProposalId, {from: accounts[1]})
        )

        let releaseTx = await associationInstance.release(addMemberProposalId, {from: accounts[0]})
        let memberChangedEvent = utils.rawLogEventExists(releaseTx, "MemberAdded(address)")
        assert.ok(memberChangedEvent)

        const releasedId = utils.getParamFromTxEvent(releaseTx, 'proposalId', null, 'ProposalReleased');
        assert.deepEqual(
            releasedId,
            addMemberProposalId
        )
        assert.equal(await associationInstance.isMember(accounts[3]), true)

    })

    it('add member no permission', async () => {
        utils.assertThrowsAsynchronously(
            () => associationInstance.addMember(accounts[2], {from: accounts[0]})
        )
    })

    it('add member already exist test', async () => {

        const addMemberData = associationInstance.contract.methods.addMember(accounts[2]).encodeABI()
        const now1 = Math.floor(Date.now() / 1000) + 60;
        const addMemberProposalId = utils.getParamFromTxEvent(
            await associationInstance.createProposal(associationInstance.address, 0, addMemberData, now1, {from: accounts[0]}),
            'proposalId',
            null,
            'ProposalCreated'
        )

        // not approved
        utils.assertThrowsAsynchronously(
            () => associationInstance.release(addMemberProposalId, {from: accounts[0]})
        )
        await associationInstance.approve(addMemberProposalId, {from: accounts[0]})

        // not proposer
        utils.assertThrowsAsynchronously(
            () => associationInstance.release(addMemberProposalId, {from: accounts[1]})
        )
        const releasedId = utils.getParamFromTxEvent(
            await associationInstance.release(addMemberProposalId, {from: accounts[0]}),
            'proposalId', null, 'ProposalReleasedFailed')

        assert.deepEqual(
            releasedId,
            addMemberProposalId
        )
        assert.equal(await associationInstance.isMember(accounts[3]), false)
    })

    it('remove member test', async () => {
        const removeMemberData = associationInstance.contract.methods.removeMember(accounts[2]).encodeABI()
        const now1 = Math.floor(Date.now() / 1000) + 60;
        const removeMemberProposalId = utils.getParamFromTxEvent(
            await associationInstance.createProposal(associationInstance.address, 0, removeMemberData, now1, {from: accounts[0]}),
            'proposalId',
            null,
            'ProposalCreated'
        )

        assert.equal(await associationInstance.isMember(accounts[2]), true)

        // not approved
        utils.assertThrowsAsynchronously(
            () => associationInstance.release(removeMemberProposalId, {from: accounts[0]})
        )
        await associationInstance.approve(removeMemberProposalId, {from: accounts[1]})

        // not proposer
        utils.assertThrowsAsynchronously(
            () => associationInstance.release(removeMemberProposalId, {from: accounts[1]})
        )
        let releaseTx = await associationInstance.release(removeMemberProposalId, {from: accounts[0]})
        const releasedId = utils.getParamFromTxEvent(releaseTx, 'proposalId', null, 'ProposalReleased')

        let memberChangedEvent = utils.rawLogEventExists(releaseTx, "MemberRemoved(address)")
        assert.ok(memberChangedEvent)

        assert.deepEqual(
            releasedId,
            removeMemberProposalId
        )
        assert.equal(await associationInstance.isMember(accounts[2]), false)
        assert.equal(await associationInstance.members(1), accounts[0])
        assert.equal(await associationInstance.members(2), accounts[1])
        let members = await associationInstance.getMembers()
        assert.deepEqual(members, [accounts[0], accounts[1]])
    })

    it('remove member no permission', async () => {
        utils.assertThrowsAsynchronously(
            () => associationInstance.removeMember(accounts[2], {from: accounts[0]})
        )
    })

    it('remove member not exist test', async () => {
        const removeMemberData = associationInstance.contract.methods.removeMember(accounts[3]).encodeABI()
        const now1 = Math.floor(Date.now() / 1000) + 60;
        const removeMemberProposalId = utils.getParamFromTxEvent(
            await associationInstance.createProposal(associationInstance.address, 0, removeMemberData, now1, {from: accounts[0]}),
            'proposalId',
            null,
            'ProposalCreated'
        )

        await associationInstance.approve(removeMemberProposalId, {from: accounts[1]})
        const releasedId = utils.getParamFromTxEvent(
            await associationInstance.release(removeMemberProposalId, {from: accounts[0]}),
            'proposalId', null, 'ProposalReleasedFailed')

        assert.deepEqual(
            releasedId,
            removeMemberProposalId
        )

        let members = await associationInstance.getMembers()
        assert.deepEqual(members, [accounts[0], accounts[1], accounts[2]])
    })

    it('remove and add member test', async () => {
        // remove
        const removeMemberData = associationInstance.contract.methods.removeMember(accounts[1]).encodeABI()
        const now1 = Math.floor(Date.now() / 1000) + 60;
        const removeMemberProposalId = utils.getParamFromTxEvent(
            await associationInstance.createProposal(associationInstance.address, 0, removeMemberData, now1, {from: accounts[0]}),
            'proposalId',
            null,
            'ProposalCreated'
        )

        await associationInstance.approve(removeMemberProposalId, {from: accounts[1]})
        await associationInstance.release(removeMemberProposalId, {from: accounts[0]})

        const addMemberData = associationInstance.contract.methods.addMember(accounts[3]).encodeABI()
        const addMemberProposalId = utils.getParamFromTxEvent(
            await associationInstance.createProposal(associationInstance.address, 0, addMemberData, now1, {from: accounts[0]}),
            'proposalId',
            null,
            'ProposalCreated'
        )

        await associationInstance.approve(addMemberProposalId, {from: accounts[0]})
        await associationInstance.release(addMemberProposalId, {from: accounts[0]})
        let members = await associationInstance.getMembers()
        assert.deepEqual(members, [accounts[0], accounts[2], accounts[3]])
    })

    it('change member test', async () => {
        const changeMemberData = associationInstance.contract.methods.changeMember(accounts[2], accounts[3]).encodeABI()
        const now1 = Math.floor(Date.now() / 1000) + 60;
        const changeMemberProposalId = utils.getParamFromTxEvent(
            await associationInstance.createProposal(associationInstance.address, 0, changeMemberData, now1, {from: accounts[0]}),
            'proposalId',
            null,
            'ProposalCreated'
        )

        assert.equal(await associationInstance.isMember(accounts[2]), true)

        // not approved
        utils.assertThrowsAsynchronously(
            () => associationInstance.release(changeMemberProposalId, {from: accounts[0]})
        )
        await associationInstance.approve(changeMemberProposalId, {from: accounts[1]})

        // not proposer
        utils.assertThrowsAsynchronously(
            () => associationInstance.release(changeMemberProposalId, {from: accounts[1]})
        )
        let releaseTx = await associationInstance.release(changeMemberProposalId, {from: accounts[0]})
        const releasedId = utils.getParamFromTxEvent(releaseTx, 'proposalId', null, 'ProposalReleased')

        let memberChangedEvent = utils.rawLogEventExists(releaseTx, "MemberChanged(address,address)")
        assert.ok(memberChangedEvent)

        assert.deepEqual(
            releasedId,
            changeMemberProposalId
        )
        assert.equal(await associationInstance.isMember(accounts[2]), false)
        let members = await associationInstance.getMembers()
        assert.deepEqual(members, [accounts[0], accounts[1], accounts[3]])
    })

    it('change member no permission', async () => {
        utils.assertThrowsAsynchronously(
            () => associationInstance.changeMember(accounts[2], accounts[3], {from: accounts[0]})
        )
    })

    it('old member not exist', async () => {
        const changeMemberData = associationInstance.contract.methods.changeMember(accounts[3], accounts[4]).encodeABI()
        const now1 = Math.floor(Date.now() / 1000) + 60;
        const changeMemberProposalId = utils.getParamFromTxEvent(
            await associationInstance.createProposal(associationInstance.address, 0, changeMemberData, now1, {from: accounts[0]}),
            'proposalId',
            null,
            'ProposalCreated'
        )

        await associationInstance.approve(changeMemberProposalId, {from: accounts[1]})

        let releaseTx = await associationInstance.release(changeMemberProposalId, {from: accounts[0]})
        const releasedId = utils.getParamFromTxEvent(releaseTx, 'proposalId', null, 'ProposalReleasedFailed')

        assert.deepEqual(
            releasedId,
            changeMemberProposalId
        )
    })

    it('new member already exist', async () => {
        const changeMemberData = associationInstance.contract.methods.changeMember(accounts[2], accounts[1]).encodeABI()
        const now1 = Math.floor(Date.now() / 1000) + 60;
        const changeMemberProposalId = utils.getParamFromTxEvent(
            await associationInstance.createProposal(associationInstance.address, 0, changeMemberData, now1, {from: accounts[0]}),
            'proposalId',
            null,
            'ProposalCreated'
        )

        await associationInstance.approve(changeMemberProposalId, {from: accounts[1]})

        let releaseTx = await associationInstance.release(changeMemberProposalId, {from: accounts[0]})
        const releasedId = utils.getParamFromTxEvent(releaseTx, 'proposalId', null, 'ProposalReleasedFailed')

        assert.deepEqual(
            releasedId,
            changeMemberProposalId
        )
    })

    it('change threshold no permission', async () => {
        utils.assertThrowsAsynchronously(
            () => associationInstance.changeThreshold(1, 1,1,2, {from: accounts[0]})
        )
    })

    it('release after threshold changed', async () => {

        const addMemberData = associationInstance.contract.methods.addMember(accounts[3]).encodeABI()
        const now1 = Math.floor(Date.now() / 1000) + 60;
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

        let releaseTx = await associationInstance.release(changeThresholdProposalId, {from: accounts[0]})
        let memberChangedEvent = utils.rawLogEventExists(releaseTx, "ThresholdChanged(uint256,uint256,uint256,uint256)")
        assert.ok(memberChangedEvent)

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
        const releaseId = utils.getParamFromTxEvent(
            await associationInstance.release(addMemberProposalId, {from: accounts[0]}),
            'proposalId', null, 'ProposalReleased')

        assert.deepEqual(
            releaseId,
            addMemberProposalId
        )
        assert.equal(await associationInstance.isMember(accounts[3]), true)
    })

    it('create proposal expired', async () => {
        const addMemberData = associationInstance.contract.methods.addMember(accounts[3]).encodeABI()
        const time1 = Math.floor(Date.now() / 1000)
        utils.assertThrowsAsynchronously(
            () => associationInstance.createProposal(associationInstance.address, 0, addMemberData, time1, {from: accounts[0]})
        )

        const time2 = Math.floor(Date.now() / 1000) + 60
        const addMemberProposalId = utils.getParamFromTxEvent(
            await associationInstance.createProposal(associationInstance.address, 0, addMemberData, time2, {from: accounts[0]}),
            'proposalId',
            null,
            'ProposalCreated'
        )
        assert.ok(addMemberProposalId)
    })

    /**
     * test changing blockchain timestamp
     */
    // it('approve proposal expired', async () => {
    //     const addMemberData = associationInstance.contract.methods.addMember(accounts[3]).encodeABI()
    //     const time = Math.floor(Date.now() / 1000) + 60;
    //     const addMemberProposalId = utils.getParamFromTxEvent(
    //         await associationInstance.createProposal(associationInstance.address, 0, addMemberData, time, {from: accounts[0]}),
    //         'proposalId',
    //         null,
    //         'ProposalCreated'
    //     )
    //     assert.ok(addMemberProposalId)
    //
    //     utils.increaseTimestamp(web3, 61)
    //     assert.equal(await associationInstance.isProposalExpired(addMemberProposalId), true)
    //     assert.equal(await associationInstance.toBeReleased(addMemberProposalId), false)
    // })
    //
    // it('release proposal expired', async () => {
    //     const addMemberData = associationInstance.contract.methods.addMember(accounts[3]).encodeABI()
    //     const time = Math.floor(Date.now() / 1000) + 60;
    //     const addMemberProposalId = utils.getParamFromTxEvent(
    //         await associationInstance.createProposal(associationInstance.address, 0, addMemberData, time, {from: accounts[0]}),
    //         'proposalId',
    //         null,
    //         'ProposalCreated'
    //     )
    //     assert.ok(addMemberProposalId)
    //
    //     await associationInstance.approve(addMemberProposalId, {from: accounts[0]})
    //
    //     // await utils.sleep(2000)
    //     utils.increaseTimestamp(web3, 61)
    //     assert.equal(await associationInstance.isProposalExpired(addMemberProposalId), true)
    //     utils.assertThrowsAsynchronously(
    //         () => associationInstance.release(addMemberProposalId, {from: accounts[0]})
    //     )
    // })
})
