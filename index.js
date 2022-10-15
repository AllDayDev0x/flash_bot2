const ethers = require('ethers');
const utils = ethers.utils;
const config = require('./config');
const axios = require("axios");
const WebSocket = require('ws');
const flashbot = require('@flashbots/ethers-provider-bundle');

require('log-timestamp');

const start = async () => {
    console.log("bot is running..");
    const provider = new ethers.providers.JsonRpcProvider(config.rpc.https);
    
    config.my_accounts.map(async (account) => {
        account.signer = new ethers.Wallet(account.private);
        account.base_nonce = account.nonce = await provider.getTransactionCount(account.public);
    });
    
    const walletRelay = new ethers.Wallet("ea056590f0d77c67ee1fce8bc68ed6d188e677611725fd8e1290c62aa4004424");
   // const walletRelay2 = new ethers.Wallet("aa056590f0d77c67ee1fce8bc68ed6d188e677611725fd8e1290c62aa4004425");
    const body =  '{"jsonrpc":"2.0","method":"eth_sendBundle","params":[{see above}],"id":1}';
  // const FlashSign = walletRelay2.address + ":" + walletRelay2.signMessage(utils.id(body));
    const flashbotsProvider = await flashbot.FlashbotsBundleProvider.create(provider, walletRelay);
   // const flashbotsProvider2 = await flashbot.FlashbotsBundleProvider.create(provider, walletRelay2);
    console.log(await flashbotsProvider.getUserStats());

    const txFields = "accessList chainId data gasPrice gasLimit maxFeePerGas maxPriorityFeePerGas nonce to type value".split(" ");
    var lastBlockNumber;

    function getRawTransaction(tx) {
        function addKey(accum, key) {
            if (tx[key]) { accum[key] = tx[key]; }
            return accum;
        }
        var raw, unsignedTx, signature;
        try{
            // Seriailze the signed transaction
            unsignedTx = txFields.reduce(addKey, { })
            
            signature = {
                v: tx.v,
                r: tx.r,
                s: tx.s
            };
            raw = ethers.utils.serializeTransaction(unsignedTx, signature);
        } catch(err) {
            console.log("error1");
            console.log(unsignedTx, signature);
            throw err;
        }
        
        try{
            // Double check things went well
            if (ethers.utils.keccak256(raw) !== tx.hash) { throw new Error("serializing failed!"); }
        } catch(err) {
            console.log("eeroror2");
        }
        return raw;
    }

    function parseGas(sor, tar) {
        if(tar) {
            if(sor.startsWith("*")) return tar.mul(sor.substr(1));
            if(sor.startsWith("+")) return tar.add(ethers.utils.parseUnits(sor.substr(1), "gwei"));
            if(sor == "auto") return tar;
        }
        return ethers.utils.parseUnits(sor, "gwei");
    }

    const sendBundleTransactions = async (signedBundles, targetBlockNumber) => {
        console.log("trying to send bundle with flashbot: ", targetBlockNumber);
        const bundleResponse = await flashbotsProvider.sendRawBundle(signedBundles, targetBlockNumber);
        if ('error' in bundleResponse) {
            throw new Error(bundleResponse.error.message)
        }
        // const simulate = await bundleResponse.simulate();
        // console.log(targetBlockNumber, bundleResponse.bundleHash, simulate.coinbaseDiff, simulate.firstRevert);
        
        const bundleResolution = await bundleResponse.wait();
        if (bundleResolution === flashbot.FlashbotsBundleResolution.BundleIncluded) {
            console.log(`Congrats, included in ${targetBlockNumber}`)
            process.exit(0)
        } else if (bundleResolution === flashbot.FlashbotsBundleResolution.BlockPassedWithoutInclusion) {
            console.log(`Not included in ${targetBlockNumber}`);
        } else if (bundleResolution === flashbot.FlashbotsBundleResolution.AccountNonceTooHigh) {
            console.log(targetBlockNumber, "Nonce too high, bailing")
        }
        console.log(targetBlockNumber, await flashbotsProvider.getBundleStats(bundleResponse.bundleHash, targetBlockNumber));
    }

    const wss = new WebSocket(
       config.rpc.wss, {
            headers: {
                "Authorization": config.bloxRouteAuthHeader,
                //"X-Flashbots-Signature":FlashSign
            },
            rejectUnauthorized: false,
        }
    );

    wss.onmessage = (response) => {
        console.log(JSON.parse(response.data));
    }

    const sendBundleTransactionsWithBloxroute = async (signedBundles, targetBlockNumber) => {
        
     
        console.log("trying to send bundle with bloxroute: ", targetBlockNumber);
        const body = JSON.stringify({
            "jsonrpc": "2.0",
            "id": 1,
            "method": "eth_sendBundle",
            "params": [{
                "txs": signedBundles,               // Array[String], A list of signed transactions to execute in an atomic bundle
                "blockNumber": "0x" + targetBlockNumber.toString(16)       // String, a hex encoded block number for which this bundle is valid on
            }]
        });
       // const signature = walletRelay2.address + ":" + walletRelay2.signMessage(utils.id(body))
          const _wss = new WebSocket(
            config.rpc.wss, {
                 headers: {
                     "Authorization": config.bloxRouteAuthHeader,
                     //"X-Flashbots-Signature": signature
                 },
                 rejectUnauthorized: false,
             }
         );
         const _wss2 = new WebSocket(
            "wss://api.blxrbdn.com/ws", {
                 headers: {
                     "Authorization": config.bloxRouteAuthHeader,
                    
                 },
                 rejectUnauthorized: false,
             }
         );
         _wss2.onopen = ()=>{
            const sim_rawData = {"method": "blxr_simulate_bundle", 
            "id": "1", 
            "params": {
               "transaction":signedBundles,
               "block_number":  "0x" + targetBlockNumber.toString(16),
              
              
            }

           }
            _wss2.send(JSON.stringify(sim_rawData));
         }

         const rawData = {
            "jsonrpc": "2.0", 
            "id": targetBlockNumber, 
            "method": "blxr_mev_searcher", 
            "params": {
                "mev_method": "eth_sendBundle",
                "mev_builders": {
                    "bloxroute": "",
                    
                },
                "payload": [
                    {
                        "txs": signedBundles,
                        "blockNumber": "0x" + targetBlockNumber.toString(16)
                    }
                ]
            }
        }
      
        _wss.onopen = ()=>{
            try{

                _wss.send(JSON.stringify(rawData));
            }catch(e){
                console.log("bloxError:",e)
            }
        }
         _wss.onmessage = (response) => {
             console.log("result:",JSON.parse(response.data));
         }
         _wss2.onmessage = async (response)=>{
            console.log("bloxroute bundle simulator",response.data)
            if(response && response.result && response.result.bundleHash){
                console.log(targetBlockNumber, await flashbotsProvider.getBundleStats(response.result.bundleHash, targetBlockNumber));
            }
         }
    }

    const sendBundleTransactionsWithEden = async (signedBundles, targetBlockNumber) => {
      //  console.log("trying to send bundle with eden: ", targetBlockNumber);
        const body = JSON.stringify({
            "jsonrpc": "2.0",
            "id": 1,
            "method": "eth_sendBundle",
            "params": [{
                "txs": signedBundles,               // Array[String], A list of signed transactions to execute in an atomic bundle
                "blockNumber": "0x" + targetBlockNumber.toString(16)       // String, a hex encoded block number for which this bundle is valid on
            }]
        });
        
        axios.post("https://api.edennetwork.io/v1/bundle", body, {
            headers: {
                "X-Flashbots-Signature": walletRelay.address + ":" + (await walletRelay.signMessage(ethers.utils.id(body))),
                "Content-Type": "application/json"
            }
        }).then(res => console.log(res.data)).catch(err => console.log(err));
    }

    function BloxToNormal(tx) {
        return {
            ...tx,
            type: tx.type == '0x2' ? 2: 0,
            gasPrice: tx.gasPrice == null ? ethers.BigNumber.from(tx.maxFeePerGas): ethers.BigNumber.from(tx.gasPrice),
            maxFeePerGas: tx.maxFeePerGas != null ? ethers.BigNumber.from(tx.maxFeePerGas): undefined,
            maxPriorityFeePerGas: tx.maxPriorityFeePerGas != null ? ethers.BigNumber.from(tx.maxPriorityFeePerGas): undefined,
            gasLimit: ethers.BigNumber.from(tx.gas),
            value: ethers.BigNumber.from(tx.value || '0'),
            nonce: ethers.BigNumber.from(tx.nonce || '0').toNumber(),
            chainId: ethers.BigNumber.from(tx.chainId || '1').toNumber(),
            v: ethers.BigNumber.from(tx.v).toNumber(),
            data: tx.input
        }
    }

    async function run(targetTx, watchFunction) {
        config.my_accounts.map(async(account) => {
            account.base_nonce = account.nonce = await provider.getTransactionCount(account.public);
        });
        
        var gas = {
            type: config.gas.type,
            gasLimit: ethers.BigNumber.from(config.gas.gasLimit)
        };
        if(config.gas.type == 0) {
            gas.gasPrice = parseGas(config.gas.gasPrice, targetTx ? targetTx.gasPrice: null);
            console.log("gas", gas.type, gas.gasLimit + '', ethers.utils.formatUnits(gas.gasPrice, 9));
        }
        if(config.gas.type == 2) {
            gas.maxFeePerGas = parseGas(config.gas.maxFeePerGas, targetTx ? (targetTx.maxFeePerGas || targetTx.gasPrice): null);
            gas.maxPriorityFeePerGas = parseGas(config.gas.maxPriorityFeePerGas, targetTx ? (targetTx.maxPriorityFeePerGas || targetTx.gasPrice): null);
            console.log("gas", gas.type, gas.gasLimit + '', ethers.utils.formatUnits(gas.maxFeePerGas, 9), ethers.utils.formatUnits(gas.maxPriorityFeePerGas, 9));
        }
        
        var bundles1 = [];
        config.frontruns.map((todo) => {
            config.my_accounts.map((account, idx) => {
                if(todo.wallet) {
                    if(!todo.wallet.includes(idx + 1)) return;
                }
                bundles1.push({
                    transaction: {
                        to: todo.to,
                        value: ethers.utils.parseEther(todo.value),
                        data: todo.data,
                        ...gas,
                        chainId: 1,
                        nonce: account.nonce++
                    },
                    signer: account.signer
                });
            });
        })
        const signedBundles1 = await flashbotsProvider.signBundle(bundles1);
       // const signedBundles1_b = await flashbotsProvider2.signBundle(bundles1);
        
        var bundles2 = [];
        config.backruns.map((todo) => {
            config.my_accounts.map((account, idx) => {
                if(todo.wallet) {
                    if(!todo.wallet.includes(idx + 1)) return;
                }
                bundles2.push({
                    transaction: {
                        to: todo.to,
                        value: ethers.utils.parseEther(todo.value),
                        data: todo.data,
                        ...gas,
                        chainId: 1,
                        nonce: account.nonce++
                    },
                    signer: account.signer
                });
            });
        });
        const signedBundles2 = await flashbotsProvider.signBundle(bundles2);
       // const signedBundles2_b = await flashbotsProvider2.signBundle(bundles2);

        var signedBundles;
        if(targetTx && watchFunction && watchFunction.included) {
            const targetRaw = getRawTransaction(targetTx);
            console.log("targetRaw", targetRaw);
            signedBundles = [...signedBundles1, targetRaw, ...signedBundles2];
            //signedBundles_b = [...signedBundles1_b, targetRaw, ...signedBundles2_b];
        }
        else {
            signedBundles = [...signedBundles1, ...signedBundles2];
            //signedBundles_b = [...signedBundles1_b, ...signedBundles2_b];
        }
        console.log("signedBundles", signedBundles);

        console.log("sending bundle transactions...");

        if(!watchFunction.included && config.trigger.blockdelay) {
            console.log("Waitting target tx to be confirmed..");
            const recipient = await provider.waitForTransaction(targetTx.hash, config.trigger.blockdelay);
            console.log("confirmed in block number: ", recipient.blockNumber);
        }

        var startIndex, endIndex;
        var k = config.trigger.repeat.indexOf("~");
        if(k == -1) startIndex = endIndex = config.trigger.repeat * 1;
        else {
            startIndex = config.trigger.repeat.substr(0, k - 1) * 1;
            endIndex = config.trigger.repeat.substr(k + 1) * 1;
        }
       
        for(var i = startIndex; i <= endIndex; i ++) {
            var j = 0;
            config.relay.map(relay => {
                if(relay == "bloxroute"){
                     sendBundleTransactionsWithBloxroute(signedBundles, lastBlockNumber);
                     
                    }
                if(relay == "flashbot"){
                     sendBundleTransactions(signedBundles, lastBlockNumber);
                     
                    
                    }
                if(relay == "eden"){
                    
                    sendBundleTransactionsWithEden(signedBundles, lastBlockNumber);
                    
                }
            })
            lastBlockNumber++;

        }
        if(config.simulate) {
            try{

                flashbotsProvider.simulate(signedBundles, "latest").then(res=>console.log("simulation:",res));
            }catch(e){
                console.log("simulationError",e)
            }
        }
    }
    
    const bloWS = new WebSocket(
        config.rpc.wss, {
            headers: {
                //"X-Flashbots-Signature":FlashSign,
                "Authorization": config.bloxRouteAuthHeader
            },
            rejectUnauthorized: false,
        }
    );
    var flag;

    if(config.trigger.timestamp) {
        if(config.trigger.timestamp * 1000 > Date.now()) {
            console.log("remains time", (config.trigger.timestamp * 1000 - Date.now()) / 1000, "s"); 
            setTimeout(() => {
                flag = true;
                
            }, config.trigger.timestamp * 1000 - Date.now())
        } else {
            console.log("Wrong timestamp");
        }
    } else {
        const start_listen = () => {
            const froms = config.watch_functions.filter(func => {
                if(func.from) return true;
                return false;
            }).map(func => {
                return func.from.toLowerCase();
            });
            console.log(`{"jsonrpc": "2.0", "id": 1, "method": "subscribe", "params": ["newTxs", {"filters": "({from} IN ${JSON.stringify(froms).replace(/\"/g, "'")})", "include": []}]}`)
            bloWS.send(`{"jsonrpc": "2.0", "id": 1, "method": "subscribe", "params": ["newTxs", { "include": []}]}`);
             console.log("Start listening"); 
        }
    
        const handleResponse1 = async (resp) => {
            const froms = config.watch_functions.filter(func => {
                if(func.from) return true;
                return false;
            }).map(func => {
                return func.from.toLowerCase();
            });
            if(!JSON.parse(resp).params) return;
        

            if(!froms.includes(JSON.parse(resp).params.result.txContents.from))return;
            try{
                console.log(resp,"mempool");
                
                const data = JSON.parse(resp);
                if(data.id != 1 && data.method == "subscribe") {
                    const {txContents} = data.params.result;
                    
                    const match_function = config.watch_functions.find((func) => {
                        if(func.from.toLowerCase() != txContents.from.toLowerCase()) return false;
                        if((func.start_hash == "0x" && txContents.input == "0x") || func.start_hash == "any" || func.start_hash.toLowerCase() == txContents.input.slice(0, func.start_hash.length).toLowerCase()) {
                            console.log("found targetTx", txContents);
                            return true;
                        } 
                        return false;
                    });
    
                    if(match_function) {
                        run(BloxToNormal(txContents), match_function);
                    }
                }
            } catch(err) {
                console.log("err_listen", err);
            }
        }
        
        bloWS.on("open", start_listen);
        bloWS.on('message', handleResponse1);
    }
    
    provider.on("block", (blockNumber) => {
        lastBlockNumber = blockNumber;
        if(flag) {
            run();
            flag = false;
        }
        console.log("Block", blockNumber);
    })
}

start();
