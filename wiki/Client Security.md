## Client Security

As noted in https://github.com/polymorpher/one-wallet/issues/5, in ONE Wallet v0.1 the authenticator cannot provide security protection if the client is compromised. A compromised client means the information stored on the client is leaked to a malicious third-party. In the current setup, the third-party may use these leaked information to easily reverse engineer (by brute force) the proof needed to perform an unauthorized transfer from ONE Wallet. The 6-digit code input from Google Authenticator would not be required.

To quote from the Github issue:

> The core weakness resides in the small search space in how EOTP is generated from an OTP and several other client-side parameters (hseed, nonce). See code at
> 
> https://github.com/polymorpher/one-wallet/blob/ae1b113cdfe022d2ec65152e3b8654f27f756d99/code/lib/onewallet.js#L25
> 
> Since the OTP is confined to a 6-digit numerical number, and the generation process relies on SHA256, the right OTP (and by extension, its EOTP) at any given time can be easily enumerated by brute-force, for any given leaf hash value. See for the code of doing so at 
> 
> https://github.com/polymorpher/one-wallet/blob/afe39e657df1522ee8941e386025c4ddafc3ab94/code/lib/onewallet.js#L141 

An adequate solution must make it exceedingly difficult, if not practically impossible, for any party to perform any transfer (or similar operations) without the input from the Google Authenticator. At the same time, it must not significantly slow down the wallet creation process, or the process of making an authorized operation with the correct authenticator code.

This leaves us several options to enhance the security:

1. Substantially increase the search space required for brute force attack, from the current 1 million possible OTPs.
2. Substantially increase the memory required for enumerating or caching all possibilities during a brute force attack.
3. Substantially increase the computation cost and complexity for hash functions used in generating EOTP (Encoded OTPs) such that they are difficult to be executed in computing processors (e.g. GPU, FPGA, ASIC)

### Notations

We denote the size of the search space of OTPs by **M**, the number of leaves in the Merkle Tree as **N** (such that each operation requires a unique EOTP, which corresponds to each leaf). Note that **N** is also the product of the number of time intervals in the Merkle Tree, times the number of operations the client wants to execute per time interval.

In a standard setup, **M** is 10<sup>6</sup> and **N** is also roughly 10<sup>6</sup>. This two numbers should not be confused with each other. 

The choice of **M** is limited by the number of digits supported by Google Authenticator. In Android, this is unfortunately fixed to 6 at this time. 

The choice of **N** is set by the lifespan of the wallet and the number of operations per time interval. The time interval duration is fixed at 30 seconds at this time due to limitation of Android Google Authenticator. The default lifespan of a wallet is 1 year, which leads to 3600 * 24 / 30 * 365 = 1051200 ~= 10<sup>6</sup> leafs.

We also denote the hash of the OTP Seed as *k<sub>h</sub>* and the OTP Seed itself as *k*, similar to the notation in [Protocol](https://github.com/polymorpher/one-wallet/blob/43197c70e36cb58c2884c423c1e665feff232042/wiki/protocol.pdf).  

As described in Protocol § 1.1.5, each leaf node at index *i* is computed by the following process, which we will denote as ** GenLeaf**:

1. Taking first 26 bytes of *k<sub>h</sub>*, and concatenate with 2 bytes of nonce, and 4 bytes of OTP corresponding to index *i*. All bytes are in big endian encoding.
2. Hash the 32-byte result in (1) (e.g. SHA256 in Protocol). Denote this as EOTP.
3. Hash the 32-byte output in (2) (e.g. SHA256 in Protocol). This is the value of a leaf node.

For brevity, we refer to the time when the client needs to execute some operation (such as transfer) that requires an OTP code as **runtime**. We refer to the process when the wallet is created as **setup**.

### Solutions

#### I. Controlled Randomness

We can alter step (1) of the **GenLeaf** process by taking first 22 bytes of *k<sub>h</sub>*, and replace the other 4 bytes with a randomly generated number between [1, µ], where µ is a difficulty parameter we choose. After EOTP and its leaf is generated, the randomly generated number is discarded. Setup would not be slowed down because sampling from [1, µ] can be done in constant time. The randomness would not affect the recoverability of the wallet because the setup can be made repeatable and deterministic by using the OTP seed as the seed for random number generators. 

At runtime, the client possessing the correct OTP would still have to iterate through [1, µ] and use the altered step (1) with the steps (2) and (3) above until it can produce a hash value equals to the value in the leaf node. In comparison, an attacker without the correct OTP would have to enumerate permutations of [1, µ] and [1, M). In other words, the attacker would have to perform M times more operations than the user.

If we choose µ=10<sup>6</sup>, the attacker would need compute 10<sup>12</sup> hashes to brute-force both the randomly generated number and the OTP. We know µ=10<sup>6</sup> is a practical number for runtime, since in ONE Wallet v0.1 we perform this number of hashes every time we generate a new wallet, and it is typically completed within less than a few seconds in the client's browser. 

Using the [hashcat benchmark](https://github.com/siseci/hashcat-benchmark-comparison/blob/45a27b32a2f24d317cc29741d64fc739f3a30cb5/1x%20Gtx%201080%20TI%20with%20Overclock%20Hashcat%20Benchmark) for reference, a highend NVIDIA GPU would enable the attacker to complete the brute-force in roughly 10 minutes. However, if we require the user to provide two OTPs inputs, the attacker's job would become practically impossible: now he would need 19 years to complete the bruteforce using a highend NVIDIA GPU. The attacker would need to design an ASIC on par with the performance of AntMiner in Bitcoin mining (~100TH/s) to complete the bruteforce in a reasonable amount of time. At ~100TH/s, the time required is ~3 hours.

To increase the security strength of our solution, we can combine this technique with some of the following, to make even AntMiner impractical for double OTP, and to make GPU attack exceedingly slow and uneconomical even for single OTP.


#### II. Complex Hash Function

We can improve step (2) of **GenLeaf** by replacing the SHA256 hash function with a more complex alternative. Ideally, the alternative should be easy to compute on a user's device (using standard CPU and RAM) but much "harder" on devices for massive parallel computing (e.g. GPU, FPGA, ASIC). A natural starting point is scrypt, which can be configured to use an arbitrarily large amount of memory that is required to produce the hash result. In particular, scrypt is used by multiple cryptocurrency (such as Litecoin, Doge, and others) in their mining algorithms with the initial intent to make mining less advantageous on GPU, and to be ASIC-resilient. The design was effective initially<sup>[1](#f1)</sup>, but ultimately failed to achieve ASIC resilience<sup>[2](#f2)</sup>, because over the last few years it became considerably easier to fit reasonably sized memory chips on ASIC, and the choice of the security parameters did not consider such advancement. Nonetheless, based on our own benchmark result using NVIDIA Tesla K80 GPUs, by replacing the hash function to scrypt (even under very low memory settings), it would roughly increase 100-1000 the amount of time the attacker would need to complete the bruteforce for a client secured with a single OTP and the Controlled Randomness technique in (1).

After comparing several alternatives, we believe [argon2](https://github.com/P-H-C/phc-winner-argon2) is the optimal choice to replace step (2) of **GenLeaf** in the next version of ONE Wallet. Similar to scrypt, it can be configured to use a large size of memory and impose an arbitary workload to slow down the computation. Aside for its multiple advantages over other candidates (which are discussed at length in their Github repository, the password-hashing competition, and their paper), here are the other factors we have considered:

- Argon2 has a [browser-based implementation](https://github.com/antelle/argon2-browser) based on WebAssembly. It offers satisfactory performance under reasonably low memory settings, and can complete within a reasonable amount of time for 10<sup>6</sup> repeatitions. Therefore, it would not slow down the setup process
- Based on our knowledge, no one has built an ASIC miner for computing Argon2 hashes at this time. 
- Argon2 is not yet even popular enough to be included in [hashcat](https://hashcat.net/hashcat/), the well-known GPU/FPGA based password recovery tool by brute-forcing hash computations via GPU.

<a name="f1">[1]</a> See an outdated [Litecoin Mining Hardware Comparison](https://litecoin.info/index.php/Mining_hardware_comparison)

<a name="f2">[2]</a> See [AntMiner L3+](https://shop.bitmain.com/promote/antminer_l3_litecoin_asic_scrypt_miner/specification) which achieves 504MH/s

#### III. Scrambled Memory Layout

We can further improve the security of **GenLeaf** by placing the result in the memory where it would be difficult for the attacker to locate, but would be easy for the client with the correct OTP to retrieve. A naive construct following this intuition is to store each leaf at the position of the OTP they correspond to and a pointer to their neighbor. Unfortunately this naive approach leaks the OTP code of each leaf and renders OTP useless. A mild improvement from the naive approach is to swap each leaf with its neighbor's position (after first repositioning all leaves to their OTP values) and remove the pointer to the neighbor (since neighbor is part of the Merkle Proof, not the leaf node itself). This construct no longer leaks the OTP for each leaf, but an attacker would still be unable to identify the location for each pair of leaves by pre-comptuing the parent hash of all pairs of leaves, which can be done in M<sup>2</sup> operations and would only require 32 bytes * M amount of memory. Since each operation is a SHA256 hash, based on the analysis in Section I, an attacker with a high-end GPU only needs ~10 minutes to identify exact positions of all leaves before they are scrambled. Moreover, we cannot use the techniques in Section II by replacing the hash function to a complex one, since the hash function must be supported on blockchain as well and must be economical and fast enough to compute on blockchain.

These two naive approaches are unsatisfactory because they are missing a few critical elements:

1. They did not use randomness.
2. Their position mapping function for each leaf is invertible.
3. They did not expand the search space for brute-force attacker (confined within M<sup>2</sup>)

To address these issues, we introduce the following technique:

1. For each leaf, we use the corresponding OTP as the seed for a random number generator, to generate 4 consecutive numbers between [1, 4M]. Note this mapping is deterministic (hence repeatable) but is not invertible.
2. We break down the leaf into 4 parts of 8-byte chunks, and store the chunks at the position given by the 4 random numbers generated in the previous step.
3. If any two chunks fall into the same position, they are stored in a list at that position. For brevity we call this scenario a "collision".
4. For each pair of neighbors, we swap the position of their chunks since we only need the neighbor to complete the Merkle Proof, not the leaf itself.

At runtime, the client can easily recover the positions of each chunk by repeating (1). If there is a list consisting of more than one element at any position, the client can simply enumerate all possible combinations using each of the element in the list. In practice, the chance that any position has more than 1 or 2 elements in the list is very slim, since our the size of our random space in (1) equals to the number of elements we want to generate. We can further increase the space to increase sparsity and reduce collision. After recovering the chunks, the client can complete the Merkle Proof and proceed as usual. If there are multiple combinations of chunks due to collision, the client may test for each combination of whether it is correct, by computing the current leaf using **GenLeaf** and the user provided OTP, then check whether the hash of the concatenation of the current leaf and the neighbor chunk-combination candidate equals to the required hash value in the parent node corresponding to current timestamp or index.

With this approach the number of operations required for simple brute-force is increased to (4M)<sup>8</sup> since the attacker would have to enumerate all possible combinations of chunks for each pair of neighbors and test whether they produce the required hash value in a any parent node. There may be more efficient brute-force attacks which we have not explored or analyzed.

Overall, this techniques is the least straightforward, but may be the most secure and the fastest for runtime execution. In any case, this technique can be composed with the techniques in Part I or II or both to obtain multiplicative security protection, since they operate at different part of the process.
 

