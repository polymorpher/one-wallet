var window = self;

import wallet from "../../../lib/wallet";

onmessage = function(event) {
    var mywallet = wallet.generateWallet(event.data.secret, event.data.depth,
                         event.data.duration, event.data.timeOffset, (current, total)=>{
                             postMessage({status: "working", current: current, total: total})
                         });    
    postMessage({status: "done", mywallet: mywallet});
  };
  