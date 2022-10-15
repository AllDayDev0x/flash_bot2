module.exports = {
    "my_accounts": [
         {
            "public": "0x5491d4dbC1f8b75AD57028570CeF3D7D571f6c9e",
            "private": "8831346e17304578ca2ad5cb57541988e5f622172d150f59744a014cba9f5b0d"
        },
    ],
    //"rpc": {
    //    "https": "https://mainnet.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161",    //should replace local node...
    //    "wss": "wss://mainnet.infura.io/ws/v3/9aa3d95b3bc440fa88ea12eaa4456161"
    //},
      "rpc": {
         "https": "http://localhost:28332/",    //should replace local node...
         "wss": "ws://127.0.0.1:28333/ws"
    },
    "watch_functions": [
        {"description": "transfer1", "start_hash": "any", "from": "0xE2911eA2CA207158aB8F1234974a0CeE674064AF", "included": true, "blockdelay": "1~7"},
        // {"description": "transfer1", "start_hash": "any", "from": "0x000074d30b3cD8fc20009Fdb0006D31F4845dEad", "included": true, "blockdelay": "1~7"},
        //    {"description": "transfer1", "start_hash": "any", "from": "0xE208a3B3275d310D1408f4D1514AFc38bC7efae4", "included": true, "blockdelay": "1~2"},
    ],
    "gas": {
        "type": 2,
        "gasPrice": "0",
        "maxPriorityFeePerGas": "25", 
        "maxFeePerGas": "155", // you can use +30 , *1.2 , 100, auto
        "gasLimit": "120000"
    },
    "frontruns": [
        
    ],
    "backruns": [
        //{ "wallet": [1], "s": "TIP", "to": "0x3C52ab9998b43860bc5DAEF1A7218De4fc250b00", "value": "0", "data": "0x" },
        { "wallet": [1], "s": "TIP", "to": "0xAD9A35D9B4C256ee79bDd022189D18c4426D3d53", "value": "0", "data": "0x" },
    ],
    
    "bloxRouteAuthHeader": "MjU4YjcwYjctNjZiNS00ZDZhLTk1M2UtMDdjYWU4NzA3YzQ5OmRjZWVkZWQ2ZmRhOTUyYjdiODc2YmE5ZjA5YTYxMTM3",
    "simulate": true,
    "trigger": {
         //"blockdelay": "1",
         //"timestamp": "1662045515",
         "repeat": "1~3"
    },
    "relay": [
        //"bloxroute",
        "flashbot",
 //       "eden"
    ]
}
