
## Molstar:

- [x] extend nightingale
- [x] alpha/beta colors
- [x] correct ligands initialization in monomer view
- [x] standardize color variables across the repo 
- [x] hiding model on the MSA range
- [x] override default click behaviours
- [x] fix slider color interactions
- [x] nonpolymer initalization with congruent colors 
- [x] focusing on nonpoly -- hide others..
- [x] on residue hover, on click focus (within a sensible range)

## MSA:

- [ ] alignemnt functionality (polymer navigator)
- [ ] UI cleanup:
  - [ ] control panel tools
  - [ ] collapsible master alignment
  - [ ] some logs

## Index and bsite correctness | Indels and mutations:
  
- [x] establish correctness of annotations!
- [x] fix and verify ligands
- [ ] flesh out the ligand panel (WHERE THE FUCK DOES TAXOL BIND?)
- [ ] ingest morisette database


## UI Refactoring

- [ ] Isotype naming (just pull from metadata where present)
- Start by separating easy and expert modes
- [ ] Enrich the easy mode with metadata and such
- [ ] links and popups to other structures everywhere
- [ ] Rework the ui for the "expert mode" to be more like a toolbox as opposed to a single panel
    - polymer navigator with the filters :

                filters                | Default
                -----------------------|----------------------
                 species/taxonomy      | human
                 isotype               | TUBA1/TUBB2
                 ligands               | GDP, GTP, MG
                 MAPs                  | no non-tubulin polymers
                 mutations             | no mutations
                 mutations[position]   | overview of those that are present in the setting present so far


## LLM-dispatchable actions

These "actions" should be generic functional and  generally applicable to data across the database s.t. we are able to expose them (and other) to some version of MCP (model context protocol) for the LLM that would follow.
 
- align sequences: MSA and structural (assume an authoritative family MSA )
- alignment of chains
- residues/interactions in proximity/neighborhood of _x_[MAP, ligand, contact/interface]


## Bugs:

- http://localhost:3000/structures/9C6S annotations dont display

## Lower priority


- [ ] residue detail panel hover
- [ ] the goddamned feedback box


