## ADDED Requirements

### Requirement: Application boots to sign-in with theme switching in the shell
The development server MUST serve the application without errors, and opening the served URL without a session MUST lead to the sign-in screen rather than to an empty page. The authenticated shell MUST include a working light/dark theme toggle in its top bar whose selection persists across reloads.

#### Scenario: Dev server serves the sign-in screen
- **WHEN** a developer runs `npm run dev` and opens the served URL without a session
- **THEN** the sign-in screen renders without errors in the console or the server log

#### Scenario: Theme toggle in the top bar switches and persists
- **WHEN** a signed-in user on desktop activates the theme toggle in the top bar and reloads the page
- **THEN** the UI switches between light and dark mode and the chosen mode is still applied after the reload

## REMOVED Requirements

### Requirement: Application shell boots with theme switching
**Reason**: The root route no longer serves the KAM-01 empty scaffold page; it redirects by session (see `user-auth` — "The root route resolves by session"), so there is no empty page at the served URL to host the theme toggle.
**Migration**: Replaced by "Application boots to sign-in with theme switching in the shell": booting is verified by reaching the sign-in screen, and the theme toggle is required and tested in the authenticated shell's top bar.
