# electronic poster

- [x] !!! send in the abstract... ~300 words or less

- [ ] poster  ~ A1/2 (A2?), keep simple stupid:
  - architecture of app/scheme simplified
  - datatypes (pdb ingestion + morisette + ingestion)
  - qr code to website
  - feedback forms/email
~1-2 sentences:

- motivate with tubulin significance (tub-specific data)
- stress the differtinating features from the PDB, domain-specific tools and knowledgebase
- motivate why the llm is useful and how it interfaces each type of data:
    - different levels of expertise:navigability
- walk through llm integration stages (what's here adn what's the roadmap -- regarding "Reasoning" either via open source models or chatgpt/anthropic integration)
- explain the dimer/lattice structures and what they are for? the few demos...
- DONT CLICK AROUND TOO FAST (meditate before the poster)

## Easy mode explanation (thorogun , but not jittery)

- what's the difference betwee expert/easy
- Take 1 particular structure, "produce" a medium difficulty figure as a result ~1-2 min.

## Expert mode explanation

- msa explanation: why did we pick human isotypes as refernece? common coordinate system spiel...
- the ability to renumber/map any arbitrary/raw/sequence to the common reference frame to access all the annotations from other species, isotypes etc.
- outline the sources (PDB, phosphositeplus, morisette), rolling schedule of ingestion and auto-annotation pipeline for either new structures OR arbitrary annotations OR mass-spec based datasets...


## expert mode demo

- work out a demo struct to show each peice of functionality (msa, ptms, reference)
- stress the manual navigability (scientific value)

## demo scripts

- polish the demo Qs
- work out the script (scope/motivation), a fwe sentnces
- come up with a demo "sentence" for filtering NLP processing that returns a few demostrable structs
- a little explanation abotu how the prompt transforms into the query

## ux/ui

- [x] make landing more reminiscent of llm ux (chatboxes)

## TODO

- [x]filter ptms by species to be tell differneces between positions (per Max human
  vs toxo example...)
- [ ] add uniprot ingestion (how does that work without a 3d struct annotations?)
- [x] Make the interactions (from landing to catalog to easy to expert) more
  obvious!! ("See all structures" too  subtle ). Bigger icons, add annotations
  to icons, add colors -- logical grouping (hierarchy)? Rename "Structures" to catalogue in sticky menu...
- [x] From landing to expert mode ??
- [x] tiered structure of prompt complexity ( start with a 3-tier system? per catalog/easy/expert)


-----------
- [x] ask Maxim and Carsten for some sample questions of different difficulties to try out (both landing and expert mode)..
- [x] Carste -- thoughts on what to stress regarding the MSA?
- [x] add Maxim logo

-----
## Todos:

- filter ligands in expert mode by binding associtation.
- make sure thumbnails are rendered (duh)

# Wed May 27th

- [x] send in the abstract to Carsten | Make sure under 250 wc.
- [ ] stabilize + start polishing, llm tooling optimization in separate worktree..
- [ ] add loggign for queries for history/postmortems.. --> 
- [ ] bubble up the feedback form on all pages (landing included)
- [ ] put yourself on landing as dev for feeback (email/site)

- poster structure
  - abstarct blended + brief overview with catalogue image
  - 4 showcases (meat): rendered a/b + msa with explanations + residue context panels


Todos: 
- [x] to  heidelberg from frankfurt + accommodations for 16th

Remind Maxim to share pdfs for software paper.
https://www.mpinat.mpg.de/grubmueller/kutzner/posters

# UX

- [x] name on the front page
- [x] tubexyz ->tubulinxyz

- [ ] switching structutures directly from the floating menu
- [ ] ligand binding sites are not shadowless/illustrative; make inherit the style/aesthetics of the rest of the protein...
- [ ] make all the annotations on aligned chains hidden by default...
- [ ] naming of the chains in the top-left expert/easy mode strucuture modes: no fucking rcsb's auth_asym_id letters please. Prefer family( where classified) and then perhaps parenthesized chain name...
- [ ] Is there anything preventing us from unifying representation and colors etc. state between the easy and expert modes (and also between the chains in expert mode)... in particular if i ask something to be painted in easy mode -- and the the llm does it -- i don't see why it shouldn't persist into the expert mode? or if i turn off or on the visibility of a ligand on one chain in the expert mode, it's super annoying that it doens't persist when i go to naother chain right now -- the ligand pops right back on....
- [ ] MSA headers -- let's expand the default width slightly so the titles and icons are always visible at the outset and the user doens't need to resize...


  ###  Articulate entity tooling boxes

  Ok bro i want to articual



# Devops --

- [ ] host the darn thing

