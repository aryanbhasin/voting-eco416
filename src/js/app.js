App = {
  web3Provider: null,
  contracts: {},
  account: '0x0',
  init: function() {
    return App.initWeb3();
  },

  initWeb3: function() {
    if (typeof web3 !== 'undefined') {
      // If a web3 instance is already provided by Meta Mask.
      window.ethereum.enable();
      App.web3Provider = web3.currentProvider;
      web3 = new Web3(web3.currentProvider);
    } else {
      // Specify default instance if no web3 instance provided
      App.web3Provider = new Web3.providers.HttpProvider('http://localhost:7545');
      web3 = new Web3(App.web3Provider);
    }
    return App.initContract();
  },

  initContract: function() {
    $.getJSON("Election.json", function(election) {
      // Instantiate a new truffle contract from the artifact
      App.contracts.Election = TruffleContract(election);
      // Connect provider to interact with contract
      App.contracts.Election.setProvider(App.web3Provider);

      App.listenForEvents();
      App.refreshWorkflowStatus();
      App.refreshNetFund();

      return App.render();
    });
  },

  // listen for events emitted from the contract
  listenForEvents: function() {
    App.contracts.Election.deployed().then(function(instance) {
      instance.votedEvent({}, {
        fromBlock: 0,
        toBlock: 'latest'
      }).watch(function(error, event) {
        // Reload when a new vote is recorded
        App.render();
      })
    });

    App.contracts.Election.deployed()
      .then(instance => instance.WorkflowStatusChangeEvent())
      .then(workflowStatusChangeEventSubscription => {
          workflowStatusChangeEvent = workflowStatusChangeEventSubscription;
          workflowStatusChangeEvent.watch((error, _) => {
            if (!error) {
              refreshWorkflowStatus();
            }
            else {
              console.log(error);
            }
          })
      });
    
    App.contracts.Election.deployed()
      .then(instance => instance.ProposalRegisteredEvent())
      .then(proposalRegisteredEventSubscription => {
        proposalRegisteredEvent = proposalRegisteredEventSubscription;
        proposalRegisteredEvent.watch((error, result) => {
          if (!error) {
            $("#proposalRegistrationMessage").html("The proposal has been registered successfully");
            App.render(); // reload when new candidate added
          } else {
            console.log(error);
          }
        })
      })

    App.contracts.Election.deployed()
      .then(instance => instance.VotingSessionStartedEvent())
      .then(votingSessionStartedEventSubscription => {
        votingSessionStartedEvent = votingSessionStartedEventSubscription;
        votingSessionStartedEvent.watch((error, result) => {
          if (!error) {
            $("#votingSessionMessage").html("The voting session has started");
            App.render(); // reload when voting session begins
          } else {
            console.log(error);
          }
        })
      })
    
    App.contracts.Election.deployed()
      .then(instance => instance.VotingSessionEndedEvent())
      .then(votingSessionEndedEventSubscription => {
        votingSessionEndedEvent = votingSessionEndedEventSubscription;
        votingSessionEndedEvent.watch((error, result) => {
          if (!error) {
            $("#votingSessionMessage").html("The voting session has ended");
            App.render();
          } else {
            console.log(error);
          }
        })
      })

    App.contracts.Election.deployed()
    .then(instance => instance.NetFundChangeEvent())
    .then(netFundChangeEventSubscription => {
        netFundChangeEvent = netFundChangeEventSubscription;
        netFundChangeEvent.watch((error, _) => {
          if (!error) {
            refreshNetFund();
          }
          else {
            console.log(error);
          }
        })
    });
      
  },

  render: function() {
    var electionInstance;
    var loader = $("#loader");
    var content = $("#content");

    loader.show();
    content.hide();

    // Load account data
    web3.eth.getCoinbase(function(err, account) {
      if (err === null) {
        App.account = account;
        $("#accountAddress").html("logged in as: " + account);
      }
    });

    var winnerMessage = "Winning Proposal is ";
    App.contracts.Election.deployed()
      .then(instance => instance.getWorkflowStatus())
      .then(workflowStatus => {
        if (workflowStatus == 2) {
          return App.contracts.Election.deployed()
            .then(instance => instance.getWinningProposalDescription())
            .then(winningProposal => {
              winnerMessage += "<b>" + winningProposal + "</b>";
              return App.contracts.Election.deployed()
                .then(instance => instance.getWinningProposalVoteCounts())
                .then(voteCounts => {
                  winnerMessage += " by " + voteCounts + " votes";
                  $("#winnerAnnouncement").html(winnerMessage);
                })
            })
        }
      });

    // Load contract data
    App.contracts.Election.deployed().then(function(instance) {
      electionInstance = instance;
      return electionInstance.candidatesCount();
    }).then(function(candidatesCount) {
      var candidatesResults = $("#candidatesResults");
      candidatesResults.empty();

      var candidatesSelect = $("#candidatesSelect");
      candidatesSelect.empty();

      for (var i = 1; i <= candidatesCount; i++) {
        electionInstance.candidates(i).then(function(candidate) {
          var id = candidate[0];
          var name = candidate[1];
          var cost = candidate[2];
          var voteCount = candidate[3];
          // Render candidate Result
          var candidateTemplate = "<tr><th>" + id + "</th><td>" + name + "</td><td>$" + cost + "</td><td>" + voteCount + "</td></tr>"
          candidatesResults.append(candidateTemplate);

          // Render candidate ballot option
          var candidateOption = "<option value='" + id + "' >" + name + " ($" + cost + ")</option>"
          candidatesSelect.append(candidateOption);
        });
      }
      return electionInstance.voters(App.account);
    }).then(function(voter) {
      var hasVoted = voter[1];
      if (hasVoted) {
        $('#votingForm').hide();
      }
      loader.hide();
      content.show();
    }).catch(function(error) {
      console.warn(error);
    });
  },

  loginAsVoter: function() {
    var voterLoginAddress = $("#voterLoginAddress").val();
    App.contracts.Election.deployed()
      .then(instance => instance.isRegisteredVoter(voterLoginAddress))
      .then(isRegisteredVoter => {
        if (isRegisteredVoter) {
          window.location.href="/vote.html";
        } else {
          $("#voterLoginMessage").html("Incorrect Voter Login");
        }
      })
      .catch(e => $("#voterLoginMessage").html("Incorrect Voter Login"))
  },

  castVote: function() {
    var candidateId = $('#candidatesSelect').val();
    var voterAddress = $("#voterAddress").val();

    App.contracts.Election.deployed()
      .then(instance => instance.isRegisteredVoter(voterAddress))
      .then(isRegisteredVoter => {
        if (isRegisteredVoter) {
          return App.contracts.Election.deployed()
            .then(instance => instance.getWorkflowStatus())
            .then(workflowStatus => {
              if (workflowStatus < 1) {
                $("#voteConfirmationMessage").html("The voting session has not started yet");
              } else  if (workflowStatus > 1) {
                $("#voteConfirmationMessage").html("The voting session has already ended");
              } else {
                App.contracts.Election.deployed()
                  .then(instance => instance.getProposalsNumber())
                  .then(proposalsNumber => {
                    if (proposalsNumber == 0) {
                      $("#voteConfirmationMessage").html("There are no proposals registered for voting");
                    } else {
                      App.contracts.Election.deployed()
                        .then(instance => instance.vote(candidateId, {from: App.account, gas: 200000}))
                        .catch(e => $("#voteConfirmationMessage").html(e))
                        .then(_ => {
                          $("#content").hide();
                          $("#loader").show();
                        })
                        .catch(e => console.log(e))
                    }
                  })
              }
            })
        } else {
          $("#proposalRegistrationMessage").html("You are not a registered voter")
        }
      })
  },

  unlockVoter: function() {
    var voterAddress = $("#voterAddress").val();
    
    App.contracts.Election.deployed()
      .then(instance => instance.isRegisteredVoter(voterAddress))
      .then(isRegisteredVoter => {
        if (isRegisteredVoter) {
          $("#voterUnlockedMessage").html("Voter account has been unlocked");
        } else {
          $("#voterUnlockedMessage").html("Voter account has NOT been unlocked");
        }
        return;
      })
      .catch(e => $("#voterUnlockedMessage").html(e))

  },

  // ------------- ADMIN FUNCTIONS -------------

  loginAsAdmin: function() {
    var adminLoginAddress = $("#adminLoginAddress").val();
    App.contracts.Election.deployed()
      .then(instance => instance.isAdministrator(adminLoginAddress))
      .then(isAdministrator => {
        if (isAdministrator) {
          web3.eth.defaultAccount=web3.eth.accounts[0];
          window.location.href="/admin.html";
        } else {
          $("#adminLoginMessage").html("Incorrect Login");
        }
      })
      .catch(e => $("#adminLoginMessage").html("Incorrect Login"))
  },

  unlockAdmin: function() {
    var adminAddress = $("#adminAddress").val();
    // var adminPassword = $("#adminPassword").val();
    // var result = web3.personal.unlockAccount(adminAddress, adminPassword, 180, function(error, result) {
    //   if (error) {
    //     console.log(error);
    //     $("#adminMessage").html("Admin account has NOT been unlocked");
    //   } else {
    //     console.log(result);
    //     $("#adminMessage").html("Admin account has been unlocked");
    //   }
    // })
    
    App.contracts.Election.deployed()
      .then(instance => instance.isAdministrator(adminAddress))
      .then(isAdministrator => {
        if (isAdministrator) {
          $("#adminMessage").html("Admin account has been unlocked");
        } else {
          $("#adminMessage").html("Admin account has NOT been unlocked");
        }
        return;
      })
      .catch(e => $("#adminMessage").html(e))

  },

  registerVoter: function() {
    $("#voterRegistrationMessage").html("");
    var adminAddress = $("#adminAddress").val();

    var voterToRegister = $("#voterAddress").val();
    var voterPower = parseInt($("#voterPower").val() ?? 1);
    App.contracts.Election.deployed()
      .then(instance => instance.isAdministrator(adminAddress))
      .then(isAdministrator => {
        if (isAdministrator) {
          return App.contracts.Election.deployed()
            .then(instance => instance.isRegisteredVoter(voterToRegister))
            .then(isVoterRegistered => {
              if (isVoterRegistered) {
                $("#voterRegistrationMessage").html("Voter is already registered");
              } else {
                return App.contracts.Election.deployed()
                  .then(instance => instance.getWorkflowStatus())
                  .then(workflowStatus => {
                    if (workflowStatus > 0) {
                      $("#voterRegistrationMessage").html("Voter registration has already ended");
                    }
                    else {
                      App.contracts.Election.deployed()
                        .then(instance => instance.registerVoter(voterToRegister, voterPower, {from: App.account, gas: 200000}))
                        .catch(e => $("#voterRegistrationMessage").html(e))
                    }
                  })
              }
            })
        } else {
          $("#voterRegistrationMessage").html("Not logged in as admin");
        }
      })
  },

  checkVoterRegistration: function() {
    $("#registrationVerificationMessage").html("");
    var address = $("#checkVoterRegistrationAddress").val();
    
    App.contracts.Election.deployed()
      .then(instance => instance.isRegisteredVoter(address))
      .then(isRegisteredVoter => {
        if (isRegisteredVoter) {
          App.contracts.Election.deployed()
            .then(instance => instance.getVotingPower(address))
            .then(votingPower => {
              $("#registrationVerificationMessage").html("Yes, this voter is registered and is alloted " + votingPower + " votes");
            })
        } else {
          $("#registrationVerificationMessage").html("No, this voter is NOT registered");
        }
      });
  },

  registerProposal: function() {
    $("#proposalRegistrationMessage").html('');
    var adminAddress = $("#adminAddress").val();
    var proposalName = $("#proposalName").val();
    var proposalCost = $("#proposalCost").val();

    if (proposalName.length == 0 || isNaN(proposalCost)) {
      if (proposalName.length == 0) {
        $("#proposalRegistrationMessage").html("No proposal name entered");
      }
      if (isNaN(proposalCost)) {
        $("#proposalRegistrationMessage2").html("Cost must be number");
      }
    } else {
      App.contracts.Election.deployed()
        .then(instance => instance.isAdministrator(adminAddress))
        .then(isAdministrator => {
          if (isAdministrator) {
            App.contracts.Election.deployed()
              .then(instance => instance.addCandidate(proposalName, proposalCost, {from: App.account, gas: 200000}))
              .catch(e => $("#proposalRegistrationMessage").html(e))
          } else {
            $("#proposalRegistrationMessage").html("You need to unlock your account first");
          }
        })
    }
  },

  startVotingSession: function() {
    $("#votingSessionMessage").html('');
    var adminAddress = $("#adminAddress").val();

    App.contracts.Election.deployed()
      .then(instance => instance.isAdministrator(adminAddress))
      .then(isAdministrator => {
        if (isAdministrator) {
          return App.contracts.Election.deployed()
            .then(instance => instance.getWorkflowStatus())
            .then(workflowStatus => {
              if (workflowStatus > 0) {
                $("v#otingSessionMessage").html("The voting session has already begun");
              } else {
                App.contracts.Election.deployed()
                  .then(instance => instance.startVotingSession({from: App.account, gas: 200000}))
                  .catch(e => $("#votingSessionMessage").html(e))
              }
            })
        } else {
          $("#votingSessionMessage").html("You need to unlock your account first");
        }
      })
  },

  tallyVotes: function() {
    $("#votingSessionMessage").html("");
    var adminAddress = $("#adminAddress").val();
    App.contracts.Election.deployed()
      .then(instance => instance.isAdministrator(adminAddress))
      .then(isAdministrator => {
        if (isAdministrator) {
          return App.contracts.Election.deployed()
            .then(instance => instance.getWorkflowStatus())
            .then(workflowStatus => {
              if (workflowStatus == 2) {
                $("#votingSessionMessage").html("The voting session has already closed");
              } else {
                return App.contracts.Election.deployed()
                  .then(instance => instance.tallyVotes({from: App.account, gas:200000}))
                  .catch(e => $("#votingSessionMessage").html(e))
              }
            })
        } else {
          $("#votingSessionMessage").html("You are not logged in as an admin");
        }
      })
  },

  refreshWorkflowStatus: function() {
    App.contracts.Election.deployed()
      .then(instance => instance.getWorkflowStatus())
      .then(workflowStatus => {
        var workflowStatusDescription;
        switch (workflowStatus.toString()) {
          case '0':
            workflowStatusDescription = "Voting Registration Open";
            break;
          case '1':
            workflowStatusDescription = "Voting has started";
            break; 
          case '2':
            workflowStatusDescription = "Voting has ended";
            break; 
            break; 
          default:
            workflowStatusDescription = "Unknown Status";
        }

        $("#currentWorkflowStatusMessage").html(workflowStatusDescription);
      })
  },

  refreshNetFund: function() {
    console.log('Hello: updating fund');
    var usedFund;
    App.contracts.Election.deployed()
      .then(instance => {
        electionInstance = instance;
        return electionInstance.fund();
      })
      .then(fund => {
        var initialFund = fund[0].c[0];
        var usedFund = fund[1].c[0];
        var netFund = initialFund-usedFund;
        var ratio = usedFund * 100/initialFund;

        var bar = "<div class='progress-bar' role='progressbar' id='progressbar' style='width: "+ ratio + "%;' aria-valuenow='" + ratio + "' aria-valuemin='0' aria-valuemax='100'>" + ratio + "%</div>";

        $("#currentFunded").html(initialFund);
        $("#currentUsedFund").html(usedFund);
        $("#netFund").html(netFund);
        $("#progressbar").html(bar);
      })
  }


};

$(function() {
  $(window).load(function() {
    App.init();
  });
});