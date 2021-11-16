pragma solidity 0.5.16;

contract Election {
    // Model a candidate
    struct Candidate {
        uint id;
        string name;
        uint voteCount;
    }

    struct Voter {
        bool isRegistered;
        bool hasVoted;
        uint votedProposalId;
        uint votingPower;
    }
    
    enum WorkflowStatus {
        RegisteringVoters,
        VotingSessionStarted,
        VotingSessionEnded
    }

    address public administrator;

    WorkflowStatus public workflowStatus;

    // Store accounts that have voted
    mapping(address => Voter) public voters;
    // Store candidates
    // Fetch candidate
    mapping(uint => Candidate) public candidates;
    // Store candidates count
    uint public candidatesCount;
    // Store winning candidate's ID
    uint private winningCandidateId;

    // voted event
    event votedEvent (
        uint indexed _candidateId
    );

    event VoterRegisteredEvent (address voterAddress);
    event ProposalRegisteredEvent (
        uint proposalId
    );
    event VotingSessionStartedEvent ();
    event VotingSessionEndedEvent ();

    event WorkflowStatusChangeEvent (
        WorkflowStatus previousStatus,
        WorkflowStatus newStatus
    );

    // ----------------- MODIFIERS -----------------
    modifier onlyAdministrator() {
        require(msg.sender == administrator, "The caller of this function must be the administrator!");
        _;
    }
    modifier onlyRegisteredVoter() {
        require(voters[msg.sender].isRegistered, "The caller of this function must be a registered voter");
        _;
    }
    modifier onlyDuringVotersRegistration() {
        require(workflowStatus == WorkflowStatus.RegisteringVoters, "This function can be called only during voters registration");
        _;
    }

    modifier onlyDuringVotingSession() {
        require(workflowStatus == WorkflowStatus.VotingSessionStarted, "This function can be called only when voting session has started");
        _;
    }
    modifier onlyAfterVotingSession() {
        require(workflowStatus == WorkflowStatus.VotingSessionEnded, "This function can be called only when voting session has ended");
        _;
    }
    
    // ----------------- VIEWS (HELPER FUNCTIONS) -----------------
    function getProposalsNumber() public view returns (uint) {
        return candidatesCount;
    }

    function getProposalDescription(uint index) public view returns (string memory) {
        return candidates[index].name;
    }

    function getWinningProposalId() 
        public onlyAfterVotingSession view returns (uint) {
        return winningCandidateId;
    }

    function getWinningProposalDescription()
        public onlyAfterVotingSession view returns (string memory) {
        return candidates[winningCandidateId].name;    
    }

    function getWinningProposalVoteCounts()
        public onlyAfterVotingSession view returns (uint) {
        return candidates[winningCandidateId].voteCount;
    }

    function isRegisteredVoter(address _voterAddress) public view returns (bool) {
        return voters[_voterAddress].isRegistered;
    }

    function getVotingPower(address _voterAddress) public view returns (uint) {
        return voters[_voterAddress].votingPower;
    }

    function isAdministrator(address _address) public view returns (bool) {
        return (_address == administrator);
    }

    function getWorkflowStatus() public view returns (WorkflowStatus) {
        return workflowStatus;
    }

    // ----------------- Constructor -----------------
    constructor() public {
        administrator = msg.sender;
        workflowStatus = WorkflowStatus.RegisteringVoters;
    }

    function registerVoter(address _voterAddress, uint _voterPower) public onlyAdministrator onlyDuringVotersRegistration {
        require(!voters[_voterAddress].isRegistered, "the voter is already registered!");

        voters[_voterAddress].isRegistered = true;
        voters[_voterAddress].hasVoted = false;
        voters[_voterAddress].votedProposalId = 0;
        voters[_voterAddress].votingPower = _voterPower;
        
        emit VoterRegisteredEvent(_voterAddress);
    }

    function addCandidate (string memory _name) 
        public onlyAdministrator {
        candidatesCount ++;
        candidates[candidatesCount] = Candidate(candidatesCount, _name, 0); // initialize new Candidate struct 
        emit ProposalRegisteredEvent(candidatesCount);
    }

    function startVotingSession()
        public onlyAdministrator onlyDuringVotersRegistration {
        workflowStatus = WorkflowStatus.VotingSessionStarted;
        emit VotingSessionStartedEvent();
        emit WorkflowStatusChangeEvent(WorkflowStatus.RegisteringVoters, workflowStatus);
    } 
    
    function vote(uint _candidateId) 
        public onlyRegisteredVoter onlyDuringVotingSession {
        require(!voters[msg.sender].hasVoted, "the caller has already voted"); // make sure voter's boolean for hasVoted is false

        require(_candidateId > 0 && _candidateId <= candidatesCount);

        voters[msg.sender].hasVoted = true;
        voters[msg.sender].votedProposalId = _candidateId;

        candidates[_candidateId].voteCount += voters[msg.sender].votingPower;

        emit votedEvent(_candidateId);
    }

    function tallyVotes()
        public onlyAdministrator onlyDuringVotingSession {
        uint winningVoteCount = 0;
        uint winningProposalIndex = 0;
        for (uint i = 0; i < candidatesCount + 1; i++) {
            if (candidates[i].voteCount > winningVoteCount) {
                winningVoteCount = candidates[i].voteCount;
                winningProposalIndex = i;
            }
        }
        winningCandidateId = winningProposalIndex;
        workflowStatus = WorkflowStatus.VotingSessionEnded;
        emit VotingSessionEndedEvent();
        emit WorkflowStatusChangeEvent(WorkflowStatus.VotingSessionStarted, workflowStatus);
    }
}