App = {
    // Attributes
    contracts: {}, // Store contract abstractions
    web3Provider: null, // Web3 provider
    url: 'http://localhost:8545', // Url for web3
    account: '0x0', // current ethereum account
    isManager: false, // tell if the connected user is the manager
    lotteryAddr: null, // it stores the address of the deployed contract

    init: async function() { return await App.initWeb3(); },

    //This function initialize Web3
    initWeb3: async function() { 
        // Modern dapp browsers...
        if (window.ethereum) {
            App.web3Provider = window.ethereum;
    
            try{
                // Request account access
                await window.ethereum.request({method: "eth_requestAccounts"});
            } catch (error) {
                // User denied account access
                console.error("User denied account access");
            }
        }
        // Legacy dapp browser
        else if (window.web3){
            App.web3Provider = window.web3.currentProvider;
        }
        // If no injected web3 instance is detected => Ganache
        else{
            App.web3Provider = new Web3.providers.HttpProvider(url);
        }
        web3 = new Web3(App.web3Provider);
        return App.initFactory();
    },

    //Load the TryFactory contract by which the Try contract instance is retrieved.
    initFactory: function() { 
        //Upload contracts
        // Store ETH current account
        web3.eth.getCoinbase(function(err, account) {
            if(err == null) {
                App.account = account;
            }
        });
        // retrieve the factory
        $.getJSON("Factory.json").done(function(data) {
            App.contracts["Factory"] = TruffleContract(data);
            App.contracts["Factory"].setProvider(App.web3Provider);
            return App.initContract();
        });
    },

    //Retrieve the Try contract
    
    initContract: function(){
        App.contracts["Factory"].deployed().then(async (instance) => {
            App.lotteryAddr = await instance.getAddr()
            // Here we are retrieving the instantiated contract
            var jsonInt = await $.getJSON("Lottery.json") 
            var myContract = await TruffleContract(jsonInt)
            myContract.setProvider(App.web3Provider)
            App.contracts["Lottery"] = myContract
            return App.listenForEvents();
        })
    },

   //Listener for important events from the backend.
    listenForEvents: function() { 
        //Activate event listeners
        App.contracts["Factory"].deployed().then(async (instance) => {
            instance.LotteryCreated().on('data', function (event) {
                alert("New lottery is on!")
                // reload contract
                return App.initContract();
            });
        })
        App.contracts["Lottery"].at(App.lotteryAddr).then(async (instance) => {
            instance.newRound().on('data', function (event) {
                alert("New round is on!")
                window.location.reload()
            });
            instance.winningNumbers().on('data', function (event) {
                alert("Winning numbers extracted!")
                window.location.reload()
            });
            instance.newTicketBought().on('data', function (event) {
                alert("New ticket purchased")
                window.location.reload()
            });
            instance.refundLotteryOperator().on('data', function (event) {
                var result = event.returnValues.str;
                if (result =="Refund Lottery Operator"){
                    var balance = event.returnValues.value;
                    alert("Operator refundef for "+balance)
                    window.location.reload()
                }
            });
            instance.closeLotteryEvent().on('data', function (event) {
                alert("Lottery has been closed.")
                window.location.reload()
            });
        });
        return App.render();
    },

    //Rendering the application.
    render: function(){
        App.contracts["Lottery"].at(App.lotteryAddr).then(async(instance) =>{
            
            const v = await instance.lotteryOperator();
            if (v.toLowerCase()==App.account){
                App.isManager = true;
            
            }
            // getting balance to show
            var balance = await web3.eth.getBalance(instance.address);
            document.getElementById("balance").innerHTML = parseInt(balance)/1000000000 + " GWEI"
            
            var isLotteryActive = await instance.isLotteryActive();
            var isActive = await instance.isActive();
            var prizeGiven = await instance.prizeGiven();
            var nPlayers = await instance.getPlayers();
            var roundClosing = await instance.roundClosing();
            var kValue = await instance.valueK();
            var duration = await instance.duration();
            nPlayers = parseInt(nPlayers);
            var status = "";
            // update dapp status
            if (isLotteryActive){
                status = "Lottery is active. A round can be started";
                if(isActive){
                    status = "A round is in progress. It will end at block "+ roundClosing + " !";
                }
                else if (prizeGiven && (nPlayers>0)){
                    status = "Winning numbers extracted!"
                }
            } else if (!isLotteryActive){
                status = "Lottery is closed";
            } else{
                status = "Lottery is not yet started"
            }   
            document.getElementById("status").innerHTML = status
            if(nPlayers != "undefined"){
                document.getElementById("players").innerHTML = nPlayers
                // render buyers
                if(nPlayers > 0){
                    docElem = document.getElementById("viewSection")
                    for(var i = 0; i < nPlayers; i++) {
                        var buyerAddr = await instance.players(i);
                        console.log(buyerAddr);
                        var player = await instance.getTicketsFromAddress(buyerAddr);
                        var price = await instance.ticketPrice();
                        var td1 = "<td class=\"u-border-1 u-border-grey-40 u-border-no-left u-border-no-right u-table-cell\" style=\"text-align:center;\">"+buyerAddr+"</td>"
                        var td2 = "<td class=\"u-border-1 u-border-grey-40 u-border-no-left u-border-no-right u-table-cell\" style=\"text-align:center;\">"+player.length+"</td>"
                        var td3 = "<td class=\"u-border-1 u-border-grey-40 u-border-no-left u-border-no-right u-table-cell\" style=\"text-align:center;\">"+(player.length*price)/1000000000+"</td>"
                        document.getElementById("ticketBody").innerHTML +=
                            "<tr style=\"height: 76px;\">" + td1 + td2 + td3 + "</tr>"
                    }
                    docElem.style.display="block";
                }
            } else document.getElementById("players").innerHTML = 0
            
        });
    },

    // Smart contract functions:
    createLottery: function(_K,_duration, price) {
        // here we need to close the previous lottery
        App.contracts["Lottery"].at(App.lotteryAddr).then(async(instance) =>{
            var isLotteryActive = await instance.isLotteryActive();
            if(isLotteryActive)
                await instance.closeLottery({from: App.account});
        })
        App.contracts["Factory"].deployed().then(async(instance) =>{

            await instance.newLottery(_K, _duration, price, {from: App.account})

        })
    },

    startNewRound: function() {
        App.contracts["Lottery"].at(App.lotteryAddr).then(async(instance) =>{
            await instance.startNewRound({from: App.account});
        }).catch((err) => {
            if(err.message.includes("Lottery is not active at the moment")){
                alert("Lottery is not active at the moment")
            } else if (err.message.includes("Wait the end of previous round before starting a new one")){
                alert("Wait the end of previous round before starting a new one")
            } else if (err.message.includes("You must give prize to players before starting a new round")){
                alert("You must give prize to players before starting a new round")
            }
        });
    },

    drawNumbers: function() {
        App.contracts["Lottery"].at(App.lotteryAddr).then(async(instance) =>{
            await instance.drawNumbers({from: App.account});
        }).catch((err) => {
            if(err.message.includes("Lottery is not active at the moment.")){
                alert("Lottery is not active at the moment.")
            } else if (err.message.includes("Too early to draw numbers")){
                alert("Too early to draw numbers")
            } else if (err.message.includes("You have already drawn numbers!")){
                alert("You have already drawn numbers!")
            } else alert("Extracted numbers are duplicated")
        });
    },

    closeLottery: function() {
        App.contracts["Lottery"].at(App.lotteryAddr).then(async(instance) =>{
            await instance.closeLottery({from: App.account});
        }).catch((err) => {
            if(err.message.includes("Lottery is not active at the moment"))
                alert("Lottery is not active at the moment")
        });
    }
}  

// Call init whenever the window loads
    $(window).on('load', function () {
        App.init();
    }); 


//Utility functions to manage cookies
function setCookie(cname, cvalue) {
    document.cookie = cname + "=" + cvalue + ";path=/";
}

function getCookie(cname) {
    let name = cname + "=";
    let decodedCookie = decodeURIComponent(document.cookie);
    let ca = decodedCookie.split(';');
    for(let i = 0; i <ca.length; i++) {
      let c = ca[i];
      while (c.charAt(0) == ' ') {
        c = c.substring(1);
      }
      if (c.indexOf(name) == 0) {
        return c.substring(name.length, c.length);
      }
    }
    return "";
}

function checkCookie(cname) {
    let _cookie = getCookie(cname);
    if (_cookie != "") {
     return 1;
    } else return 0
}