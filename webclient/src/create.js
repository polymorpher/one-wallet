import React, { Component } from 'react';
const twofactor = require("node-2fa");
import crypto from "crypto";
import b32 from "thirty-two";
import wallet from "../../lib/wallet";
import * as truffleClient from "./truffle_client";

class Create extends Component {
    constructor(props) {
        super(props);

        var time = Math.floor((Date.now() / 1000));
        var timeOffset = time - (time% 300);        
        this.state = {duration: 300, depth: 10, timeOffset: timeOffset, expires: 0, secret:"", creating: false};
    }

    makeSecret() {
        const newSecret = twofactor.generateSecret({ name: "My Awesome App", account: "johndoe" });
        const config = {
            name: encodeURIComponent("SmartWallet"),
            account: encodeURIComponent("User"),
            step: encodeURIComponent(this.state.duration),
        }

        const bin = crypto.randomBytes(20);
        const base32 = b32.encode(bin).toString("utf8").replace(/=/g, "");
      
        const secret = base32
          .toLowerCase()
          .replace(/(\w{4})/g, "$1 ")
          .trim()
          .split(" ")
          .join("")
          .toUpperCase();
      
        const query = `?secret=${secret}&issuer=${config.name}`
        const encodedQuery = query.replace('?', '%3F').replace('&', '%26')
        const uri = `otpauth://totp/${config.name}${config.account}`
        const qr_fixed = `https://chart.googleapis.com/chart?chs=166x166&chld=L|0&cht=qr&chl=${uri}${encodedQuery}`;

        // var time = Math.floor((Date.now() / 1000));
        // var timeOffset = time - (time% 300);

        this.setState({
            secret: secret,
            uri: uri,
            qr_fixed: qr_fixed,
        })
    }
    componentDidMount(){
        console.log(this);
        this.makeSecret();
        this.update();
    }

    create(e) {
        this.setState({creating: true});

        e.preventDefault();
        var self = this;
        truffleClient.createWallet(this.state.rootHash, this.state.depth, this.state.duration, this.state.timeOffset, this.state.leafs).then(e=>{
            console.log(e);
            self.props.onCreated(e);
        });
        return false;
    }
    changeDepth(e) {
        this.setState({depth: parseInt(e.target.value)}, this.update);
    }
    changeDuration(e){
        this.setState({duration: parseInt(e.target.value)},this.update);
    }    

    update() {
        var mywallet = wallet.generateWallet(this.state.secret, this.state.depth, this.state.duration, this.state.timeOffset)
        var expires =  this.state.timeOffset + (Math.pow(2, this.state.depth) * this.state.duration);
        this.setState({
            rootHash: mywallet.root,
            leafs: mywallet.leafs,
            expires: expires
        })
    }
    render() {
        return (
            <div className="card bg-light mb-3 mt-3">
                <div className="card-header">Create a wallet
                <span className="pull-right clickable close-icon" data-effect="fadeOut" onClick={(e)=>{this.props.onClose(); e.preventDefault();}}><i className="fa fa-times"></i></span>
                </div>
                <div className="card-body">
                    <form>
                        <div className="form-group row">
                            <label htmlFor="inputEmail3" className="col-sm-4 col-form-label">TOTP Secret</label>
                            <div className="col-sm-8">
                                {this.state.secret && 
                                <div className="mb-4">
                                    <img src={this.state.qr_fixed}/><br/>
                                    {this.state.secret}<br/>
                                    Scan with your Google Authenticator
                                </div>}
                            </div>
                        </div>
                        <div className="form-group row">
                            <label htmlFor="inputEmail3" className="col-sm-4 col-form-label">Merkle Hash</label>
                            <div className="col-sm-8">
                                <input type="text" readOnly className="form-control" id="inputEmail3" value={this.state.rootHash}/>
                            </div>
                        </div>
                        <div className="form-group row">
                            <label htmlFor="inputEmail3" className="col-sm-4 col-form-label">Duration</label>
                            <div className="col-sm-8">
                                <input type="number" className="form-control" id="inputEmail3" value={this.state.duration} onChange={this.changeDuration.bind(this)}/>
                            </div>
                        </div>
                        <div className="form-group row">
                            <label htmlFor="inputEmail3" className="col-sm-4 col-form-label">Tree Depth</label>
                            <div className="input-group col-sm-8">
                                <input type="number" className="form-control" value={this.state.depth}   onChange={this.changeDepth.bind(this)} placeholder="Recipient's username" aria-label="Recipient's username" aria-describedby="basic-addon2"/>
                                <div className="input-group-append">
                                    <span className="input-group-text" id="basic-addon2">{Math.pow(2, this.state.depth)} leafs</span>
                                </div>
                            </div>
                        </div>  
                        <div className="form-group row">
                            <label htmlFor="inputEmail3" className="col-sm-4 col-form-label">Time Offset</label>
                            <div className="input-group col-sm-8">
                                <input type="text" className="form-control" value={this.state.timeOffset} placeholder="Recipient's username" aria-label="Recipient's username" aria-describedby="basic-addon2"/>
                                <div className="input-group-append">
                                    <span className="input-group-text" id="basic-addon2">{new Date(this.state.timeOffset*1000).toISOString()}</span>
                                </div>
                            </div>
                        </div>     
                        <div className="form-group row">
                            <label htmlFor="inputEmail3" className="col-sm-4 col-form-label">Expires</label>
                            <div className="input-group col-sm-8">
                                <input type="text" readOnly className="form-control" value={this.state.expires} placeholder="Recipient's username" aria-label="Recipient's username" aria-describedby="basic-addon2"/>
                                <div className="input-group-append">
                                    <span className="input-group-text" id="basic-addon2">{new Date(this.state.expires*1000).toISOString()}</span>
                                </div>
                            </div>
                        </div>                                                 
                        <div className="form-group row mt-4">
                            <label htmlFor="inputEmail3" className="col-sm-4 col-form-label"></label>
                            <div className="col-sm-8">
                                {!this.state.creating && <button className="btn btn-primary" onClick={this.create.bind(this)}>Create Contract</button>}
                                {this.state.creating && <button className="btn btn-primary" disabled>Submitting..(wait)</button>}
                            </div>
                        </div>                                                    
                    </form>     
                </div>                  
            </div>
        );
    }
}

export default Create;