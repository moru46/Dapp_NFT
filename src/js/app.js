App = {

    contracts: {},  // Store contract abstractions
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
        new Web3
        return App.initFactory();
    },

    //Load the Factory contract by which the Try contract instance is retrieved
    initFactory: function() { 
        //Upload the contract's
        // Store ETH current account
        web3.eth.getCoinbase(function(err, account) {
            if(err == null) {
                App.account = account;
                $("#accountId").html(account);
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
                if(!App.isManager){
                    alert("New lottery is on!")
                    setLocalCookie("startNotified","yes")
                    // reload contract
                    return App.initContract();
                }
            });
        })
        App.contracts["Lottery"].at(App.lotteryAddr).then(async (instance) => {
            instance.newRound().on('data', function (event) {
                if(!App.isManager)
                    alert("New round is on! Ticket are available now!")
                setCookie("roundNotified","yes")
            });
            // Ticket successfully bought, update interface
            instance.newTicketBought().on('data', function (event) {
                var ticket = event.returnValues._numbers;
                var td_1 = "<td class=\"u-align-center u-border-1 u-border-grey-30 u-table-cell\">"+ticket.slice(0,5)+"</td>"
                var td_2 = "<td class=\"u-align-center u-border-1 u-border-grey-30 u-table-cell\">"+ticket[5]+"</td>"
                document.getElementById("ticketList").innerHTML +=
                    "<tr style=\"height: 75px;\">" + td_1 + td_2 + "</tr>"
                alert("Ticket successfully bought!")
            });
            // Get winning numbers for this round
            instance.newDrawn().on('data', function (event) {
                if(!App.isManager)
                    alert("New drawn!Let's check if you win...")
            });
            instance.givePrizeToPlayers().on('data', function (event) {
                var winningPlayer = event.returnValues.winningPlayer;
                if (winningPlayer.toLowerCase() == App.account){
                    var _prizeToGive = event.returnValues._prizeToGive;
                    alert("You win a NFT of class "+_prizeToGive+" ! Reload the page to check...")
                }
            });

            instance.closeLotteryEvent().on('data', function (event) {
                if(!App.isManager)
                    alert("Lottery has been closed.")
                setLocalCookie("startNotified","no")
                setCookie("roundNotified","no")
            });
            instance.closeLotteryAndRefund().on('data', function (event) {
                var buyer = event.returnValues.buyer;
                var _refund = event.returnValues._refund;
                if (App.account == buyer.toLowerCase()){
                    alert("You have been refunded for " + _refund)
                }
            });
        });
        return App.render();
    },

    //Rendering App
    render: function() { 
        //Render page
        App.contracts["Lottery"].at(App.lotteryAddr).then(async(instance) =>{
            const check = await instance.lotteryOperator();
            //if you are the manager
            if (check.toLowerCase()==App.account){
                App.isManager = true;
                document.getElementById("managerButton").style.display="block";
                document.getElementById("managerButton1").style.display="block";
            }
            var docElem = document.getElementById("price")
            if(docElem != null){
                var ticketPrice = await instance.ticketPrice();
                docElem.innerHTML= parseInt(ticketPrice)/1000000000 + " GWEI";
            }
            var isLotteryActive = await instance.isLotteryActive();
            var isRoundActive = await instance.isActive();
            var prizeGiven = await instance.prizeGiven();
            var players = await instance.getPlayers();
            players = parseInt(players);
            // Cookie management for offline notification
            if(App.isManager==false){
                // notify if was offline for new lottery
                if (isLotteryActive && (getCookie("startNotified")=="no")){
                    alert("A new lottery has started, stay tuned for a new round to start!")
                    setLocalCookie("startNotified","yes")
                }
                // notify for a new round
                if (isRoundActive && !prizeGiven && (getCookie("roundNotified")=="no")){
                    alert("New round has started! Buy tickets now!")
                    setLocalCookie("roundNotified","yes")
                }
                // re-set cookie
                if (!isLotteryActive && (getCookie("startNotified")=="yes" || getCookie("roundNotified")=="yes")){
                    alert("Lottery is over! Try again later...")
                    setLocalCookie("startNotified","no")
                    setLocalCookie("roundNotified","no")
                }
                if (prizeGiven && (getCookie("roundNotified")=="yes"))
                    setLocalCookie("roundNotified","no")
            }
            docElem = document.getElementById("lastWinningNumbers");
            // rendering winning numbers
            if(docElem != null){
                if (prizeGiven){
                    var winningNumbers = await instance.getWinningNumbers();
                    var banner = "";
                    if(winningNumbers[5].words[0] != 0){
                        for(let i = 0; i <winningNumbers.length; i++) {
                            if(i != 5)
                                banner += winningNumbers[i].words[0] + " ";
                        }
                        document.getElementById("lastWinningNumbers").innerHTML=banner;
                        document.getElementById("lastWinningNumbers").style.display="block";
                        document.getElementById("lastWinningNumbers_pb").innerHTML=winningNumbers[5].words[0];
                        document.getElementById("lastWinningNumbers_pb").style.display="block";
                    }
                }
            }
            // rendering user tickets
            docElem = document.getElementById("ticketSection")
            if(docElem != null){
                //var tickets = await instance.getTicketsFromAddress(App.account)
                var nTicket = await instance.getTotTickets(App.account);
                if (nTicket > 0){
                //if(tickets.length > 0){
                    for(let i = 1; i <= nTicket; i++) {
                        var numbers = await instance.getTicketList(App.account,i);
                        var td_1 = "<td class=\"u-align-center u-border-1 u-border-grey-30 u-table-cell\">"+numbers.slice(0,5)+"</td>"
                        var td_2 = "<td class=\"u-align-center u-border-1 u-border-grey-30 u-table-cell\">"+numbers[5]+"</td>"
                        document.getElementById("ticketList").innerHTML +=
                            "<tr style=\"height: 75px;\">" + td_1 + td_2 + "</tr>"
                    }
                    docElem.style.display="block";
                }
            }
            // rendering NFTs
            docElem = document.getElementById("NFTSection")
            if(docElem != null){
                var nfts = await instance.getWonNFTsFromAddress(App.account)
                if(nfts.length > 0){
                    console.log(nfts.length);
                    console.log(nfts);
                    for(let i = 0; i < nfts.length; i++) {
                        var nftDescr = nfts[i];
                            var td_1 = "<td class=\"u-align-center u-border-1 u-border-grey-30 u-table-cell\">You win an "+nftDescr+"</td>"
                        document.getElementById("NFTList").innerHTML +=
                            "<tr style=\"height: 30px;\">" + td_1 + "</tr>"
                    }
                    docElem.style.display="block";
                }
            }
        });      
    },

     // Call a function of a smart contract
     buy: function(ticket) {
        App.contracts["Lottery"].at(App.lotteryAddr).then(async(instance) =>{
            var ticketPrice = await instance.ticketPrice();
            await instance.buy(ticket,{from: App.account, value: web3.utils.toWei(ticketPrice.toString(), 'wei')});
        }).catch((err) => {
            if(err.message.includes("Lottery is not active at the moment")){
                alert("Lottery is not active at the moment")
            }
            else if (err.message.includes("Round is not active, wait for new one!")){
                alert("Round is not active, wait for new one!")
            }
            else if (err.message.includes("Round is over, try later")){
                alert("Round is over, try later")
            }
            else if (err.message.includes("Need more gwei to buy a ticket!")){
                alert("Fee of" + ticketPrice + " gwei or more is required to buy a ticket")
            }
        });
    }
}

// Call init whenever the window loads
$(window).on('load', function () {
    if(getCookie('startNotified') == "")
        setLocalCookie("startNotified","no")
    if(getCookie('roundNotified') == "")
        setLocalCookie("roundNotified","no")
    App.init();
});

//Utility functions to manage cookies

function setCookie(cname, cvalue) {
    document.cookie = cname + "=" + cvalue + ";path=/";
}

function setLocalCookie(cname, cvalue) {
    document.cookie = cname + "=" + cvalue;
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


