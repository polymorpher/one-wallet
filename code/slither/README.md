## Install Slither
[Install Slither](https://github.com/crytic/slither#how-to-install)
```
pip3 install slither-analyzer
```

## Running analysis

Run Slither
```
cd code
slither .
```

### Initial Analysis March 7th, 2022
[gist is here](https://gist.github.com/johnwhitton/fd6682e7b9ff72577e2e5021d93ba143)
[and here](./analysis.md)

## Generating Inheritance Graphs

```
cd code
slither . --print inheritance-graph
mv *.dot ./slither/.
cd slither
dot inheritance-graph.dot -Tpng -o inheritance-graph.png
rm *.dot
```
