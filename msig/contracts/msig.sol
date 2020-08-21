pragma solidity >=0.5.0;

contract acs3 {
    function createProposal(address _to, uint _value, bytes calldata _data, uint _expiration) external returns (uint);

    function approve(uint _proposalId) external;

    function reject(uint _proposalId) external;

    function abstain(uint _proposalId) external;

    function release(uint _proposalId) external returns (bool);

    event ProposalCreated(uint proposalId, uint value, address dest, bytes data);
    event ProposalReleased(uint proposalId);
    event ProposalReleasedFailed(uint proposalId);
    event ReceiptCreated(uint proposalId, uint receiptType);
}

contract governed {

    event MemberChanged(address from, address to);
    event MemberAdded(address member);
    event MemberRemoved(address member);
    event ThresholdChanged(uint _minimalApproval, uint _maximalRejection, uint _maximalAbstention, uint _required);

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
        require(m_member_indices[_member] != 0);
        _;
    }

    modifier validMemberCount(uint _count) {
        require(_count > 1);
        _;
    }

    modifier validThreshold(uint _minimalApproval, uint _maximalRejection, uint _maximalAbstention, uint _required, uint _memberCount){
        require(isThresholdValid(_minimalApproval, _maximalRejection, _maximalAbstention, _required, _memberCount));
        _;
    }

    function init(address[] memory _members) internal {
        members.push(address(0));
        for (uint i = 0; i < _members.length; ++i)
        {
            members.push(_members[i]);
            m_member_indices[_members[i]] = 1 + i;
        }
    }

    // Add a new member
    function addMember(address _member)
    onlySelf
    memberNotExists(_member)
    validThreshold(minimal_approval, maximal_rejection, maximal_abstention, required, members.length + 1)
    external {
        members.push(_member);
        m_member_indices[_member] = members.length - 1;
        emit MemberAdded(_member);
    }

    // Replaces an owner `_from` with another `_to`.
    function changeMember(address _from, address _to) onlySelf memberExists(_from) memberNotExists(_to) external {
        uint index = m_member_indices[_from];
        members[index] = _to;
        m_member_indices[_from] = 0;
        m_member_indices[_to] = index;
        emit MemberChanged(_from, _to);
    }

    // remove a member
    function removeMember(address _member)
    onlySelf
    memberExists(_member)
    validMemberCount(members.length - 1)
    validThreshold(minimal_approval, maximal_rejection, maximal_abstention, required, members.length - 1)
    external {
        uint index = m_member_indices[_member];
        // swap
        members[index] = members[members.length - 1];
        m_member_indices[members[index]] = index;

        // remove
        delete m_member_indices[_member];
        delete members[members.length - 1];
        members.length--;

        emit MemberRemoved(_member);
    }

    function isThresholdValid(uint _minimalApproval, uint _maximalRejection, uint _maximalAbstention, uint _required, uint _memberCount)
    internal
    pure
    returns (bool){
        return _minimalApproval > 0 &&
        _minimalApproval <= _required && _maximalRejection <= _required && _maximalAbstention <= _required &&
        _required <= _memberCount &&
        _minimalApproval + _maximalAbstention <= _memberCount &&
        _minimalApproval + _maximalRejection <= _memberCount;
    }

    function setThreshold(uint _minimalApproval, uint _maximalRejection, uint _maximalAbstention, uint _required) internal {
        minimal_approval = _minimalApproval;
        maximal_rejection = _maximalRejection;
        maximal_abstention = _maximalAbstention;
        required = _required;
    }

    function isMember(address _addr) public view returns (bool) {
        return m_member_indices[_addr] > 0;
    }

    function isSelf(address _addr) internal view returns (bool) {
        return _addr == address(this);
    }

    function getMembers() public view returns (address[] memory){
        address[] memory return_members = new address[](members.length -1);
        for (uint i = 1; i < members.length; i++)
            return_members[i - 1] = members[i];
        return return_members;
    }

    // threshold
    uint public minimal_approval;
    uint public maximal_rejection;
    uint public maximal_abstention;
    uint public required;

    // members
    address[] public members;
    mapping(address => uint) m_member_indices;
}


contract association is acs3, governed {

    mapping(uint => Proposal) private m_proposals;
    mapping(uint => mapping(address => uint)) public m_votes; // 1: approve; 2: reject; 3: abstain
    uint public proposalCount;

    event Deposit(address indexed sender, uint value);

    struct Proposal {
        address dest;
        address proposer;
        uint value;
        bytes data;
        uint expiration; // in second
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

    modifier notExpired(uint time) {
        require(time > now);
        _;
    }

    modifier notVoted (uint _proposalId) {
        require(m_votes[_proposalId][msg.sender] == 0);
        _;
    }

    modifier onlyProposer(uint _proposalId) {
        require(m_proposals[_proposalId].proposer == msg.sender);
        _;
    }

    constructor (address[] memory _members, uint _minimalApproval, uint _maximalRejection,
        uint _maximalAbstention, uint _required)
    validMemberCount(_members.length - 1)
    validThreshold(_minimalApproval, _maximalRejection, _maximalAbstention, _required, _members.length)
    public
    {
        init(_members);
        setThreshold(_minimalApproval, _maximalRejection, _maximalAbstention, _required);
    }

    // METHODS
    function changeThreshold(uint _minimalApproval, uint _maximalRejection, uint _maximalAbstention, uint _required)
    onlySelf
    validThreshold(_minimalApproval, _maximalRejection, _maximalAbstention, _required, members.length)
    external {
        setThreshold(_minimalApproval, _maximalRejection, _maximalAbstention, _required);
        emit ThresholdChanged(_minimalApproval, _maximalRejection, _maximalAbstention, _required);
    }

    function createProposal(address _to, uint _value, bytes calldata _data, uint _expiration)
    notExpired(_expiration)
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
        //        if (external_call(proposal.dest, proposal.value, proposal.data.length, proposal.data))
        //            emit Execution(_proposalId);
        (b,) = proposal.dest.call.value(proposal.value)(proposal.data);
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

    function toBeReleased(uint _proposalId) public view returns (bool)
    {
        if (isProposalExpired(_proposalId))
            return false;
        uint approved = 0;
        uint rejected = 0;
        uint abstained = 0;
        uint total = 0;
        for (uint i = 0; i < members.length; i++) {
            uint v = m_votes[_proposalId][members[i]];
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

    function isProposalExpired(uint _proposalId) public view returns (bool){
        return m_proposals[_proposalId].expiration <= now;
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

    function()
    external
    payable
    {
        if (msg.value > 0)
            emit Deposit(msg.sender, msg.value);
    }
}