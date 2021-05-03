import React, { Component } from 'react';
import * as truffleClient from "./truffle_client";
import wallet from "../../lib/wallet";

// props <ShowWallet address="0x..."/>
class ShowWallet extends Component {
    constructor(props) {
        super(props);
        this.state = {wallet: {}, submitting: false};
    }
    componentDidMount() {
        var self = this;
        this.leafs = JSON.parse(localStorage.getItem("wallet:" + this.props.wallet)).leafs;
        truffleClient.loadWallet(this.props.wallet).then(e=>{
            console.log("wallet", e);
            self.setState({wallet: e});

        })
    }

    totpChanged(e) {
        this.setState({withdraw_totp: e.target.value})

        clearTimeout(this.timer);
        this.timer = setTimeout(() => {
            var proofs = wallet.getProofWithOTP(parseInt(e.target.value), this.leafs, this.state.wallet.timeOffset, this.state.wallet.timePeriod);
            this.setState({withdraw_totp: e.target.value, withdraw_proof: proofs[0], withdraw_sides: proofs[1]})
        }, 1000);
    }

    submit(e) {
        this.setState({submitting: true})

        var amount = web3.utils.toWei(this.state.withdraw_amount,'ether');
        console.log(amount, this.state.withdraw_proof, this.state.withdraw_sides)
        var self = this;
        this.state.wallet.contract.makeTransfer(this.state.withdraw_to, amount, this.state.withdraw_proof, this.state.withdraw_sides).then(e=>{
            console.log("submitted:", e)
            self.setState({success: e, submitting: false})
        }).catch(ex=>{
            console.log(ex);
            self.setState({err: ex.message, submitting: false})
        });
        e.preventDefault();
    }  
    addGuardian(e) {
        var self = this;
        this.state.wallet.contract.addGuardian(this.state.guardian_new, this.state.withdraw_proof, this.state.withdraw_sides).then(e=>{
            console.log("submitted:", e)
            self.setState({success: e, submitting: false})
        }).catch(ex=>{
            console.log(ex);
            self.setState({err: ex.message, submitting: false})
        });
        e.preventDefault();

    }

    render() {
        return (
            <div className="card bg-light mb-3 mt-3">
                <div className="card-header">Wallet: {this.props.wallet}
                </div>
                <div className="card-body">
                    <table className="table table-bordered">
                        <tbody>
                            <tr>
                                <th scope="row">Smart Contract Address</th>
                                <td>{this.props.wallet}</td>
                            </tr>
                            <tr>
                                <th scope="row">Merkel Hash</th>
                                <td>{this.state.wallet.rootHash}</td>
                            </tr>
                            <tr>
                                <th scope="row">Tree Height</th>
                                <td>{this.state.wallet.height && this.state.wallet.height.toString()}</td>
                            </tr>
                            <tr>
                                <th scope="row">Time Period</th>
                                <td>{this.state.wallet.timePeriod && this.state.wallet.timePeriod.toString()}</td>
                            </tr>
                            <tr>
                                <th scope="row">Time Offset</th>
                                <td>{this.state.wallet.timeOffset && this.state.wallet.timeOffset.toString()}</td>
                            </tr>
                            <tr>
                                <th scope="row">ETH Balance</th>
                                <td>{this.state.wallet.balance && web3.utils.fromWei(this.state.wallet.balance).toString()}</td>
                            </tr>
                        </tbody>
                    </table>       

                    <nav>
                        <div className="nav nav-tabs" id="nav-tab" role="tablist">
                            <a className="nav-item nav-link active" id="nav-home-tab" data-toggle="tab" href="#nav-home" role="tab" aria-controls="nav-home" aria-selected="true">Withdraw</a>
                            <a className="nav-item nav-link" id="nav-profile-tab" data-toggle="tab" href="#nav-profile" role="tab" aria-controls="nav-profile" aria-selected="false">Guardian</a>
                            <a className="nav-item nav-link" id="nav-contact-tab" data-toggle="tab" href="#nav-contact" role="tab" aria-controls="nav-contact" aria-selected="false">Recovery</a>
                        </div>
                    </nav>
                    <div className="tab-content" id="nav-tabContent">
                        <div className="tab-pane fade show active" id="nav-home" role="tabpanel" aria-labelledby="nav-home-tab">
                            <form>
                                <div className="form-group row">
                                    <label htmlFor="inputEmail3" className="col-sm-4 col-form-label">Destination Address</label>
                                    <div className="col-sm-8">
                                        <input type="text" className="form-control" id="inputEmail3" value={this.state.withdraw_to} onChange={(e)=>this.setState({withdraw_to: e.target.value})}/>
                                    </div>
                                </div>
                                <div className="form-group row">
                                    <label htmlFor="inputEmail3" className="col-sm-4 col-form-label">Amount (ETH)</label>
                                    <div className="col-sm-8">
                                        <input type="number" className="form-control" id="inputEmail3" value={this.state.withdraw_amount} onChange={(e)=>this.setState({withdraw_amount: e.target.value})}/>
                                    </div>
                                </div>
                                <div className="form-group row">
                                    <label htmlFor="inputEmail3" className="col-sm-4 col-form-label">TOTP Code</label>
                                    <div className="col-sm-8">
                                        <input type="number" className="form-control" id="inputEmail3" value={this.state.withdraw_totp} onChange={this.totpChanged.bind(this)} />
                                    </div>
                                </div>
                                <div className="form-group row">
                                    <label htmlFor="inputEmail3" className="col-sm-4 col-form-label">Proof</label>
                                    <div className="col-sm-8">
                                        <textarea readOnly className="form-control" value={this.state.withdraw_proof}></textarea>
                                    </div>
                                </div>
                                <div className="form-group row">
                                    <label htmlFor="inputEmail3" className="col-sm-4 col-form-label">Sides</label>
                                    <div className="col-sm-8">
                                        <input readOnly type="text" className="form-control" id="inputEmail3" value={this.state.withdraw_sides}/>
                                    </div>
                                </div>                                                
                                <div className="form-group row mt-4">
                                    <label htmlFor="inputEmail3" className="col-sm-4 col-form-label"></label>
                                    <div className="col-sm-8">
                                        {!this.state.submitting && <button className="btn btn-primary" onClick={this.submit.bind(this)}>Submit Transaction</button>}
                                        {this.state.submitting && <button className="btn btn-primary" disabled>Submitting..(wait)</button>}
                                    </div>

                                    {this.state.success && <div className="mt-4 alert alert-primary" role="alert">
                                        Success: Transaction hash: <a target="_NEW" href={"https://rinkeby.etherscan.io/tx/"+ this.state.success.tx}>{this.state.success.tx}</a>
                                    </div>}
                                    {this.state.err && <div className="mt-4 alert alert-danger" role="alert">
                                        Error: {this.state.err} <a target="_NEW" href={"https://rinkeby.etherscan.io/address/"+ this.props.wallet}>{this.props.wallet}</a>
                                    </div>}                                       
                                </div>                                                    
                            </form>     
                        </div>
                        <div className="tab-pane fade" id="nav-profile" role="tabpanel" aria-labelledby="nav-profile-tab">
                            <form>
                                <div className="form-group row">
                                    <label htmlFor="inputEmail3" className="col-sm-4 col-form-label">New Guardian Address</label>
                                    <div className="col-sm-8">
                                        <input type="text" className="form-control" id="inputEmail3" value={this.state.guardian_new} onChange={(e)=>this.setState({guardian_new: e.target.value})}/>
                                    </div>
                                </div>
                                <div className="form-group row">
                                    <label htmlFor="inputEmail3" className="col-sm-4 col-form-label">TOTP Code</label>
                                    <div className="col-sm-8">
                                        <input type="number" className="form-control" id="inputEmail3" value={this.state.withdraw_totp} onChange={this.totpChanged.bind(this)} />
                                    </div>
                                </div>
                                <div className="form-group row">
                                    <label htmlFor="inputEmail3" className="col-sm-4 col-form-label"></label>
                                    <div className="col-sm-8">
                                        {!this.state.submitting && <button className="btn btn-primary" onClick={this.addGuardian.bind(this)}>Add Guardian</button>}
                                        {this.state.submitting && <button className="btn btn-primary" disabled>Submitting..(wait)</button>}
                                    </div>
                                </div>
                            </form>
                        </div>
                        <div className="tab-pane fade" id="nav-contact" role="tabpanel" aria-labelledby="nav-contact-tab">

                        </div>
                    </div>                            
                </div>
            </div>
        );
    }
}

export default ShowWallet;