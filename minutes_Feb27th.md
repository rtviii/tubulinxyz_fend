# Minutes January the 26th

# Workflow[DONE]

The user is presented with two "generic" structures as a template for their future work. These are also the "modes" between which the user is able to switch inside a session as they are working with their data.

- heterodimer (agreed on 1JFF)
- lattice (6WNV) -- [!] picked arbitrarily.

# Beginner and expert modes define the richness of control over the data and annotations

## Beginner mode[DONE]

Simple clean representation of the structure with just some metadata about it(organism, ligands present, publication, etc.), chains and ligands interactable at a very simple level (select a particular component/view its sequence). No additional actions. MSA/sequence not displayed by default, but on click.

## Expert mode [partially-DONE]
### Filters for "expert mode":

A deeper view of a particular chain (either the generic dimer or a particular strucutre's chain) with a variety of filters that would let the user bring other chains into view (align the sequences) with their own annotations.

 filters                | Default
 -----------------------|----------------------
- species/taxonomy      | human
- isotype               | TUBA1/TUBB2
- ligands               | GDP, GTP, MG
- MAPs                  | no non-tubulin polymers
- mutations             | no mutations
- mutations[position]   | overview of those that are present in the setting present so far

## Actions of interest (Expert mode/mcp primitives/etc)[DONE]

These "actions" should be generic functional and  generally applicable to data across the database s.t. we are able to expose them (and other) to some version of MCP (model context protocol) for the LLM that would follow.
 
- align sequences: MSA and structural (assume an authoritative family MSA )
- alignment of chains
- residues/interactions in proximity/neighborhood of _x_[MAP, ligand, contact/interface]


# Other notes

- [ ] Carsten has suggested a resource to rely on for isotypes nomenclature: https://www.genenames.org/data/genegroup/#!/group/778

- [DONE]Carsten has suggested a faint/transparent coloring of alpha beta subunits to not associate any strong colors with the neutral data and reserve those for the highlights of the actually important stuff.

- [DONE] Carsten has again suggested a feedback box that the user can report the bugs in and include the "state of the system" to display what went wrong instead of describing in written detail.

# To decide:
- how should we define a fragment (as opposed to a ligand?) if we want to differentiate the two? For the fragments described in Muhlethaler 2021(https://pmc.ncbi.nlm.nih.gov/articles/PMC8251789/) are we able to provide more descriptive names than just indices?
- establish the next rendezvous date


------


- set up CLaude Code??

# TODO

- [ ] "improve ui"/make toolbox icons more intutive
- [!] present a litte overview of the Morisette method, get Carsten involved, decide whether to use their base alignments 
- [!] finalize the filters (workable) --> last step before sendign docker Joao
- [!] change the default hetero to curved structure [ ]
- [ ] set up a meet with Joao, deploy, metnion the LLM.
- [ ] ingest Morisette dataset??
- fix color interactions on the multiply aligned chains
- verify indexing schemes


Hi dear all. These are the "minutes" for the meeting of February 27th.

I have showed some UI and functionality updates: 
- the updated landing page, 
- the "beginner mode for high-level structure exploration and a canvas for the future AI assistant. 
- the "expert" mode where a single chain can be explored in detail, further monomers can be added (aligned in sequence and structure space) alongside their annotations and some variety of tools to navigate these sets of aligned structures exist, explore their binding sites and annotations.

The general feedback I got from Michel, Maxim and Zdenek is that the direction is more or less correct and we are quite close to being able to share the first version with students/trial users.

The issues that remain:


# UI & Logic

- [ ] Out of the 2 "canvas" structures that we have on the landing page, the dimer should be coming from a curved structure of tubulin instead of the historical 1JFF structure, Michel pointed out. Unless you specify a particular structure I will just pick a high-resolution recent oligomer and parse a dimer from there to replace 1JFF.
- [ ] In expert mode, the UI can be made much more intuitive and less crammed yet, the functions of icons and buttons for example can be more clearly stated as Maxim pointed out. I will try to do this to the best of my design ability.
- [ ] The expert mode filters (for finding a monomer of interest according to the criteria we defined in the last meetinng) should be a little more fleshed out and rely on the totality of our database entry instead of a few hardcoded defaults (ex. full taxonomic tree instead of 5 model species).

# Automating variants detection and annotations

I'm still not super confident in the annotations that my pipeline produces (that is, the automatic detection of deletions, insertions and mutations directly from the PDB data and vis a vis our given master alignment). Alongside some potential bugs inside the logic I feel like this process could use some input from an actual expert (like Carsten) as to what to flag as an actual mutation as opposed to just a highly variable region for example (tail).

My feeling is that until the quality of these automatic annotations is higher, we should rely on the Morisette database as the authoritative source of variants/annotations. We agreed that we should discuss the implementation and methods of the Morisette paper and I will put together a 15-20 minutes presentation about it for our next meeting

# Housekeeping

- [ ] Artem will set up a meeting with Joao and dicuss his general thoughts on our plan, the hosting of the LLM server alongside the application.
- [ ] Fix color interactions between the multiple aligned chains ()
- [ ] Verify indexing schemes
