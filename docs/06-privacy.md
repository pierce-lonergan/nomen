# Privacy & ethics

Nomen's database is a file of photographs, voice recordings, and private notes about **real people
who are not users of this app and have not agreed to anything.** That is an unusual liability for a
personal-productivity tool and it drives several non-negotiable design decisions.

## Commitments implemented in the product

1. **Local-only by construction.** No backend exists. No analytics, no crash reporting, no fonts or
   scripts fetched at runtime. The app functions fully offline; there is no code path that
   transmits a person's data anywhere.
2. **No account, no identifier.** Nothing to correlate, nothing to subpoena from a server that does
   not exist.
3. **Photos are optional.** The app is fully usable with zero images — name, context, and hook are
   enough to run every non-face drill. Face drills degrade gracefully.
4. **Voice capture is opt-in per person**, and the recorder shows a persistent indicator. Recording
   someone's voice without their knowledge is a bigger step than taking a photo and the UI treats
   it as one.
5. **Hard delete.** Deleting a person cascades to their media, items, and attempts immediately.
   There is no trash, no soft-delete flag, no "recently deleted."
6. **Export is manual and explicit.** One button, one file, entirely under the user's control.
7. **A consent nudge, not a lecture.** First time a photo is added, the app says once: taking a
   photo of someone to remember their name is a normal thing to do — taking one covertly is not.
   Then it stops talking about it.

## Notes the app will not invite

The person-note field is for *memory hooks*. The placeholder text and examples steer toward
"met at Ana's birthday, architect, sails" and away from appearance-based descriptors of race,
body, or perceived attributes — which are both socially corrosive and, per the brief, weaker
retrieval cues than semantic/biographical ones anyway. The evidence and the ethics agree here.

## Known residual risk

The device itself is the security boundary. If you are logged in, the data is readable. Nomen does
not implement at-rest encryption in v1; it is on the roadmap (`07-roadmap.md`) as an
origin-private-filesystem + passphrase option. Until then, the honest statement is: **this is as
private as your phone's lock screen, and no more.**
