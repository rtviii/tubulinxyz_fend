# electronic poster

- [x] !!! send in the abstract... ~300 words or less

- [ ] poster  ~ A1/2 (A2?), keep simple stupid:
  - architecture of app/scheme simplified
  - datatypes (pdb ingestion + morisette + ingestion)
  - qr code to website
  - feedback forms/email

- polish the demo Qs


~1-2 sentences:

- motivate with tubulin significance (tub-specific data)
- stress the differtinating features from the PDB, domain-specific tools and knowledgebase
- motivate why the llm is useful and how it interfaces each type of data:
    - different levels of expertise:navigability
- walk through llm integration stages (what's here adn what's the roadmap -- regarding "Reasoning" either via open source models or chatgpt/anthropic integration)
- explain the dimer/lattice structures and what they are for? the few demos...
- DONT CLICK AROUND TOO FAST (meditate before the poster)

### Expert mode points

- msa explanation: why did we pick human isotypes as refernece? common coordinate system spiel...
- the ability to renumber/map any arbitrary/raw/sequence to the common reference frame to access all the annotations from other species, isotypes etc.
- outline the sources (PDB, phosphositeplus, morisette), rolling schedule of ingestion and auto-annotation pipeline for either new structures OR arbitrary annotations OR mass-spec based datasets...
## easy/expert mode

- what's the difference

### Easymode explanation (thorogun , but not jittery)

- Take 1 particular structure, "produce" a medium difficulty figure as a result ~1-2 min.

### expert mode demo

- work out a demo struct to show each peice of functionality (msa, ptms,
  reference)
- stress the manual navigability (scientific value)

# demo scripts

- come up with a demo "sentence" for filtering NLP processing that returns a few
  demostrable structs
- a little explanation abotu how the prompt transforms into the query


--------------------------------------

# ux/ui

- make landing more reminiscent of llm ux (chatboxes)

# TODO

- filter ptms by species to be tell differneces between positions (per Max human
  vs toxo example...)
- add uniprot ingestion (how does that work without a 3d struct annotations?)
- work out the script (scope/motivation), a fwe sentnces
- Make the interactions (from landing to catalog to easy to expert) more
  obvious!! ("See all structures" too  subtle ). Bigger icons, add annotations
  to icons, add colors -- logical grouping (hierarchy)? Rename "Structures" to
  catalogue in sticky menu...
- From landing to expert mode ??
- tiered structure of prompt complexity ( start with a 3-tier system? per
  catalog/easy/expert)


-----------
- [ ] ask Maxim and Carsten for some sample questions of different difficulties to try out (both landing and expert mode)..
- [ ] Carste -- thoughts on what to stress regarding the MSA?

- add Maxim logo
-----






