var W3 = require('web3');

// using only 16bytes to decrease storage requirement
function h(a) { return W3.utils.soliditySha3({v: a, t: "bytes", encoding: 'hex' }).substring(0, 34); }


import React, { Component } from 'react';
import Create from './create';
import * as truffleClient from "./truffle_client";
import ShowWallet from './show_wallet';

class MainScreen extends Component {
    constructor(props) {
        super(props);
        this.state = {wallets:[], create: false};
    }

    componentDidMount() {
        var wallets = truffleClient.getWallets();
        this.setState({wallets})
    }

    onSelect(e) {
        console.log(e.target.value);
        this.setState({'loaded': e.target.value});
    }
    create(e) {
        e.preventDefault();
        this.setState({create: true});
    }
    closeCreate(){
        this.setState({create: false});

    }
    onCreated(contract) {
        this.setState({create: false, loaded: contract.address});
    }
    render() {
        return (
            <div>
                <nav className="navbar navbar-expand-md navbar-dark bg-dark mb-4 d-flex justify-content-center">
                <span className="navbar-text ">
                    TOTP Smart Wallet Demo
                </span>
                </nav>
                <main role="main" className="container" style={{"maxWidth": 700}}>
                    <div className="row">
                        <div className="col-sm-12">
                            <div className="mb-3">Choose Local Wallet: <select  className="form-control"  onChange={this.onSelect.bind(this)}><option>Choose one</option>{this.state.wallets.map(e=><option>{e}</option>)}</select></div>
                            <i>or</i>
                            <div className="mt-3">
                                {!this.state.create && <a className="btn btn-primary" onClick={this.create.bind(this)}>New Wallet</a>}
                                {this.state.create && <Create onClose={this.closeCreate.bind(this)} onCreated={this.onCreated.bind(this)}/>}
                            </div>
                        </div>
                    </div>
                    <div className="row">
                        <div className="col-sm-12">
                            {this.state.loaded && <ShowWallet wallet={this.state.loaded}/>}
                        </div>
                    </div>
                </main>
            </div>
        );
    }
}

export default MainScreen;
function init() {
    ReactDOM.render(<MainScreen/>, document.getElementById('container'));

}

init();