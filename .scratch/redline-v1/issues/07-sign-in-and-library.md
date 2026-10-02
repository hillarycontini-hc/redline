# 07 — Sign in and see your library

**What to build:** A freelancer can create an account, sign in, and reach a library that
is theirs alone. Nobody sees anyone else's contracts, and nobody else sees theirs. The
library is empty, and says so, until they analyse something.

Schema is designed from scratch: no project exists yet. Nothing here drops or alters an
existing table, and if that ever looks necessary, ask first.

**Demo:** Sign up, land on an empty library that states it is empty, sign out, sign back
in, reload, and still be signed in.

**Blocked by:** None — can start immediately, alongside 02.

**Status:** built; two criteria cannot be demonstrated without a running Supabase project (see BUILD-REPORT.md)

- [ ] A person can sign up, sign out, and sign back in, and the session survives a page
      reload.
- [x] A signed-in person with nothing saved sees a library that states it is empty.
- [x] A signed-out visitor cannot reach the library.
- [x] Tables exist for documents, analyses, and red lines, each with row-level security
      keyed to the authenticated user.
- [ ] A read issued for another user's row returns nothing, verified against the running
      database rather than asserted against a test double.
