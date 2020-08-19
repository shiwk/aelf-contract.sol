//sol Wallet
// Multi-sig, daily-limited account proxy/wallet.
// @authors:
// Gav Wood <g@ethdev.com>
// inheritable "property" contract that enables methods to be protected by requiring the acquiescence of either a
// single, or, crucially, each of a number of, designated owners.
// usage:
// use modifiers onlyowner (just own owned) or onlymanyowners(hash), whereby the same hash must be provided by
// some number (specified in constructor) of the set of owners (specified in the constructor, modifiable) before the
// interior is executed.

pragma solidity >=0.5.0;

contract governed {

    // TYPES

    // struct for the status of a pending operation.
    //    struct PendingState {
    //        uint yetNeeded;
    //        uint ownersDone;
    //        uint index;
    //    }

    // EVENTS

    // this contract only has six types of events: it can accept a confirmation, in which case
    // we record owner and operation (hash) alongside it.
    //    event Confirmation(address owner, bytes32 operation);
    //    event Revoke(address owner, bytes32 operation);
    // some others are in the case of an owner changing.
    //    event OwnerChanged(address oldOwner, address newOwner);
    event MemberChanged(address from, address to);
    //    event OwnerAdded(address newOwner);
    event MemberAdded(address member);
    //    event OwnerRemoved(address oldOwner);
    event MemberRemoved(address member);
    // the last one is emitted if the required signatures change
    event RequirementChanged(uint _minimalApproval, uint _maximalRejection, uint _maximalAbstention, uint _required);

    // MODIFIERS

    // sender authority
    modifier onlyMember {
        require(isMember(msg.sender));
        _;
    }

    // check contract address
    modifier onlySelf{
        require(isSelf(msg.sender));
        _;
    }

    modifier memberNotExists(address _member) {
        require(m_member_indices[_member] == 0);
        _;
    }

    modifier memberExists(address _member) {
        require(m_member_indices[_member] == 0);
        _;
    }

    function init(address[] memory _members) internal{
        m_members.push(address(0));
        for (uint i = 0; i < _members.length; ++i)
        {
            m_members.push(_members[i]);
            m_member_indices[_members[i]] = 1 + i;
        }
    }

    // Add a new member
    function addMember(address _member) onlySelf memberNotExists(_member) external {
        m_members.push(_member);
        m_member_indices[_member] = m_members.length - 1;
        emit MemberAdded(_member);
    }

    // Replaces an owner `_from` with another `_to`.
    function changeMember(address _from, address _to) onlySelf memberExists(_from) memberNotExists(_to) external {
        uint index = m_member_indices[_from];
        m_members[index] = _to;
        m_member_indices[_from] = 0;
        m_member_indices[_to] = index;
        emit MemberChanged(_from, _to);
    }

    function removeMember(address _member) onlySelf memberExists(_member) external {
        uint index = m_member_indices[_member];
        // swap
        m_members[index] = m_members[m_members.length - 1];
        m_member_indices[m_members[index]] = index;
        // remove
        delete m_members[m_members.length - 1];

        emit MemberRemoved(_member);
    }

    function isMember(address _addr) public view returns (bool) {
        return m_member_indices[_addr] > 0;
    }

    function isSelf(address _addr) internal view returns (bool) {
        return _addr == address(this);
    }


    // list of owners
    address[] m_members;
    uint constant c_maxOwners = 250;
    mapping(address => uint) m_member_indices;
//    bytes32[] m_pendingIndex;
}

// aelf contract standard
contract acs3 {
//    function createProposal(address _to, uint _value, bytes calldata _data) external returns (uint);
//
//    function approve(uint _proposalId) external;
//
//    function reject(uint _proposalId) external;
//
//    function abstain(uint _proposalId) external;
//
//    function release(uint _proposalId) external returns (bool);
//
    event ProposalCreated(uint proposalId, uint value, address dest, bytes data);
    event ProposalReleased(uint proposalId);
    event ProposalReleasedFailed(uint proposalId);
    event ReceiptCreated(uint proposalId, uint receiptType);
}

// usage:
// bytes32 h = Wallet(w).from(oneOwner).execute(to, value, data);
// Wallet(w).from(anotherOwner).confirm(h);
contract association is acs3, governed {

    // the number of owners that must confirm the same operation before it is run.
    uint public minimal_approval;
    uint public maximal_rejection;
    uint public maximal_abstention;
    uint public required;

    mapping(uint => Proposal) private m_proposals;
    mapping(uint => mapping(address => uint)) public m_votes; // 1: approve; 2: reject; 3: abstain
    uint public proposalCount;

    event Deposit(address indexed sender, uint value);

    // Transaction structure to remember details of transaction lest it need be saved for a later call.
    struct Proposal {
        address dest;
        address proposer;
        uint value;
        bytes data;
        uint expiration; // in second
    }

    modifier validRequirementThreshold(uint _minimalApproval, uint _maximalRejection, uint _maximalAbstention, uint _required){
        require(isRequirementValid(_minimalApproval, _maximalRejection, _maximalAbstention, _required));
        _;
    }

    modifier proposalNotExists(uint _proposalId) {
        require(m_proposals[_proposalId].dest == address(0));
        _;
    }

    modifier proposalExists(uint _proposalId) {
        require(m_proposals[_proposalId].dest != address(0));
        _;
    }

    modifier proposalExpired(uint _proposalId) {
        require(m_proposals[_proposalId].expiration >= now);
        _;
    }

    modifier proposalNotExpired(uint _proposalId) {
        require(m_proposals[_proposalId].expiration > now);
        _;
    }

    modifier notVoted (uint  _proposalId) {
        require(m_votes[_proposalId][msg.sender] == 0);
        _;
    }

    modifier onlyProposer(uint _proposalId) {
        require(m_proposals[_proposalId].proposer == msg.sender);
        _;
    }

    constructor (address[] memory _organizationMembers, uint _minimalApproval, uint _maximalRejection,
        uint _maximalAbstention, uint _required)
    public
    {
        init(_organizationMembers);
        require(isRequirementValid(_minimalApproval, _maximalRejection, _maximalAbstention, _required));
        setRequirement(_minimalApproval, _maximalRejection, _maximalAbstention, _required);
    }

    // METHODS
    function changeThreshold(uint _minimalApproval, uint _maximalRejection, uint _maximalAbstention, uint _required)
    onlySelf
    validRequirementThreshold(_minimalApproval, _maximalRejection, _maximalAbstention, _required)
    external {
        setRequirement(_minimalApproval, _maximalRejection, _maximalAbstention, _required);
        emit RequirementChanged(_minimalApproval, _maximalRejection, _maximalAbstention, _required);
    }

    function createProposal(address _to, uint _value, bytes calldata _data, uint _expiration)
    external
    returns (uint proposalId){
        proposalId = proposalCount;
        m_proposals[proposalId] = Proposal({
            dest : _to,
            proposer : msg.sender,
            value : _value,
            data : _data,
            expiration : _expiration
        });
        proposalCount += 1;
        emit ProposalCreated(proposalId, _value, _to, _data);
    }

    function approve(uint _proposalId) onlyMember proposalExists(_proposalId) proposalNotExpired(_proposalId) notVoted(_proposalId) external {
        m_votes[_proposalId][msg.sender] = 1;
        emit ReceiptCreated(_proposalId, 1);
    }

    function reject(uint _proposalId) onlyMember proposalExists(_proposalId) proposalNotExpired(_proposalId) notVoted(_proposalId) external {
        m_votes[_proposalId][msg.sender] = 2;
        emit ReceiptCreated(_proposalId, 2);
    }

    function abstain(uint _proposalId) onlyMember proposalExists(_proposalId) proposalNotExpired(_proposalId) notVoted(_proposalId) external {
        m_votes[_proposalId][msg.sender] = 3;
        emit ReceiptCreated(_proposalId, 3);
    }

    function release(uint _proposalId) onlyProposer(_proposalId) proposalExists(_proposalId) proposalNotExpired(_proposalId) external returns (bool b){
        require(toBeReleased(_proposalId));
        Proposal storage proposal = m_proposals[_proposalId];
        //        proposal.executed = true;
        //        if (external_call(proposal.destination, proposal.value, proposal.data.length, proposal.data))
        //            emit Execution(transactionId);
        (b, ) =proposal.dest.call.value(proposal.value)(proposal.data);
        if (b)
        {
            emit ProposalReleased(_proposalId);
//            b = true;
        }
        else {
            emit ProposalReleasedFailed(_proposalId);
//            b = false;
        }

        delete m_proposals[_proposalId];
    }

    function toBeReleased(uint _proposalId)
    public
    view
    returns (bool)
    {
        uint approved = 0;
        uint rejected = 0;
        uint abstained = 0;
        uint total = 0;
        for (uint i = 0; i < m_members.length; i++) {
            uint v = m_votes[_proposalId][m_members[i]];
            if (v == 1)
            {
                approved += 1;
                total += 1;
            }
            if (v == 2)
            {
                rejected += 1;
                total += 1;
            }
            if (v == 3)
            {
                abstained += 1;
                total += 1;
            }
        }

        return approved >= minimal_approval && rejected <= maximal_rejection && abstained <= maximal_abstention && total >= required;
    }

    // call has been separated into its own function in order to take advantage
    // of the Solidity's code generator to produce a loop that copies tx.data into memory.
    function external_call(address destination, uint value, uint dataLength, bytes memory data) internal returns (bool) {
        bool result;
        assembly {
            let x := mload(0x40)   // "Allocate" memory for output (0x40 is where "free memory" pointer is stored by convention)
            let d := add(data, 32) // First 32 bytes are the padded length of data, so exclude that
            result := call(
            sub(gas, 34710), // 34710 is the value that solidity is currently emitting
            // It includes callGas (700) + callVeryLow (3, to pay for SUB) + callValueTransferGas (9000) +
            // callNewAccountGas (25000, in case the destination address does not exist and needs creating)
            destination,
            value,
            d,
            dataLength, // Size of the input (in bytes) - this is what fixes the padding problem
            x,
            0                  // Output is ignored, therefore the output size is zero
            )
        }
        return result;
    }

    function isRequirementValid(uint _minimalApproval, uint _maximalRejection, uint _maximalAbstention, uint _required) private view returns (bool){
        return _minimalApproval > 0 &&
        _minimalApproval <= _required && _maximalRejection <= _required && _maximalAbstention <= _required &&
        _required <= m_members.length &&
        _minimalApproval + _maximalAbstention <= m_members.length &&
        _minimalApproval + _maximalRejection <= m_members.length;
    }

    function setRequirement(uint _minimalApproval, uint _maximalRejection, uint _maximalAbstention, uint _required) private {
        minimal_approval = _minimalApproval;
        maximal_rejection = _maximalRejection;
        maximal_abstention = _maximalAbstention;
        required = _required;
    }

    /// @dev Fallback function allows to deposit ether.
    function()
    external
    payable
    {
        if (msg.value > 0)
            emit Deposit(msg.sender, msg.value);
    }

    // kills the contract sending everything to `_to`.
    //    function kill(address _to) onlymanyowners(sha3(msg.data)) external {
    //        selfdestruct(_to);
    //    }

    // gets called when no other function matches
    //    function() payable {
    //        // just being sent some cash?
    //        if (msg.value > 0)
    //            Deposit(msg.sender, msg.value);
    //    }

    // Outside-visible transact entry point. Executes transaction immediately if below daily spend limit.
    // If not, goes into multisig process. We provide a hash on return to allow the sender to provide
    // shortcuts for the other confirmations (allowing them to avoid replicating the _to, _value
    // and _data arguments). They still get the option of using them if they want, anyways.
    //    function execute(address _to, uint _value, bytes _data) external onlyowner returns (bytes32 _r) {
    //        // first, take the opportunity to check that we're under the daily limit.
    //        if (underLimit(_value)) {
    //            SingleTransact(msg.sender, _value, _to, _data);
    //            // yes - just execute the call.
    //            require(_to.call.value(_value)(_data));
    //            return 0;
    //        }
    //        // determine our operation hash.
    //        _r = sha3(msg.data, block.number);
    //        if (!confirm(_r) && m_proposals[_r].to == 0) {
    //            m_proposals[_r].dest = _to;
    //            m_proposals[_r].value = _value;
    //            m_proposals[_r].data = _data;
    //            ConfirmationNeeded(_r, msg.sender, _value, _to, _data);
    //        }
    //    }

    // confirm a transaction through just the hash. we use the previous transactions map, m_txs, in order
    // to determine the body of the transaction from the hash provided.
    //    function confirm(bytes32 _h) onlymanyowners(_h) returns (bool) {
    //        if (m_proposals[_h].to != 0) {
    //            require(m_proposals[_h].to.call.value(m_proposals[_h].value)(m_proposals[_h].data));
    //            MultiTransact(msg.sender, _h, m_proposals[_h].value, m_proposals[_h].to, m_proposals[_h].data);
    //            delete m_proposals[_h];
    //            return true;
    //        }
    //    }

    // INTERNAL METHODS

    //    function clearPending() private {
    //        uint length = m_pendingIndex.length;
    //        for (uint i = 0; i < length; ++i)
    //            delete m_proposals[m_pendingIndex[i]];
    //        super.clearPending();
    //    }

    // FIELDS
}