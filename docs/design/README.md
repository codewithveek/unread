# Unread design reference

Four phone screens (390x844) from the design canvas. They are the visual source of truth for the UI in prd-unread.md §8.

| File | Screen |
|---|---|
| Onboarding.dc.html | 1 · Pick topics, episode length, news edition |
| Main.dc.html | 2 · Home: today's episode + chapters |
| Player.dc.html | 3 · Now playing: transcript + source + controls |
| Sources.dc.html | 4 · Private feed link, paste a link, forwarding address, saved items |

How to use them:
- These are design files, not app code. Read the markup and inline styles for layout, spacing, sizes, colours and copy; rebuild them as React components (Tailwind + shadcn/ui) in the app.
- `{{accent}}` = the accent token (default #5B9BFF). The list data inside each `renderVals()` is sample content.
- Tokens: ground #0E0F12, surface #17181D, surface-2 #1F2128, line #2A2D35, text #F2F3F5, text-2 #D6D9DF, muted #A3A8B3, accent #5B9BFF, on-accent #0A1A33. Fonts: Geist, Geist Mono.
- Desktop (>= 1024px) layout is described in prd-unread.md §8; it is not drawn here.
