# Bloomora: Google Play listing

Everything to paste into Play Console once the developer account is open.

## Files
| What | File |
|---|---|
| App bundle (signed with the upload key) | `android/app/build/outputs/bundle/release/app-release.aab` (rebuild: `npm run android`, then `gradlew bundleRelease` in `android/`) |
| App icon 512x512 | `public/icons/icon-512.png` |
| Feature graphic 1024x500 | `docs/store/play-feature-graphic-1024x500.png` |
| Phone screenshots (1080x2160) | `docs/store/play-screens/` |
| Privacy policy | https://itsahadat.github.io/bloomora/privacy.html |

## Store listing
**App name** (max 30): Bloomora: Garden Match 3

**Short description** (max 80):
Swap fruits and flowers, clear the garden and bloom 100 cozy puzzle levels!

**Full description** (max 4000):
Welcome to Bloomora, a cozy garden match-3 puzzle!

Swap fruits and flowers to make matches of three or more, clear wooden crates, vines and soil, water thirsty pots and help Bea the bee bring every garden back to bloom.

🌸 100 hand-made levels across 10 beautiful gardens
🍓 Match 4 or 5 for powerful line blasts, burst blooms and rainbow bombs
🌻 Combine specials for huge garden-clearing combos
🧺 Boosters: trowel, breeze, swap and more to help on tricky levels
🎡 Daily lucky wheel, daily rewards and weekly quests
☁️ Save with Google: keep your progress on every phone
📶 Play offline, anytime
🎁 Free to play: optional videos give extra moves, lives and coins. No pop-up ads between levels.

Relax, think a move ahead and watch your garden grow. More gardens are on the way!

## Categorisation
- App or game: **Game**
- Category: **Puzzle**
- Tags: Match 3, Casual, Offline, Single player
- Contact email: dev.sahadat@gmail.com
- Website: https://itsahadat.github.io/bloomora/

## App content answers
- **Privacy policy:** the URL above.
- **Ads:** Yes, the app contains ads (AdMob rewarded videos).
- **App access:** All functionality available without special access (sign-in is optional).
- **Target audience:** 13+ (pick 13-15, 16-17, 18+). Do not pick under-13 ages: that turns on the Families policy and changes the ad rules.
- **Content rating questionnaire:** Puzzle game; no violence, no gambling with real money, no user-generated content, no chat. The lucky wheel gives only in-game coins and boosters and can't be bought, so answer "no" to simulated gambling with real-money purchase. Expected rating: Everyone / PEGI 3.
- **Data safety:**
  - Collected: Name, Email address, User IDs (Firebase sign-in, optional; for account management, app functionality); App interactions / game progress (cloud save, optional); Device or other IDs (AdMob, for advertising).
  - Shared: Device or other IDs with Google AdMob (advertising).
  - Data encrypted in transit: Yes. Users can request deletion: Yes (email in the privacy policy).
- **Government apps / financial / health:** No.

## Release steps
1. Pay the $25 fee and verify identity (Play Console).
2. Create the app "Bloomora: Garden Match 3", game, free.
3. Turn on Play App Signing (default), upload the AAB to **Internal testing** first.
4. Copy the **App signing key SHA-1** from Play Console (Setup → App signing) and add it in Firebase (Project settings → Bloomora Android → Add fingerprint), otherwise Google sign-in fails in Play-installed builds. The upload key SHA-1 is already added.
5. New personal accounts must run a **closed test with at least 12 testers for 14 days** before Production.
6. In AdMob, link the app to the Play listing once it is live (Apps → App settings → Add store).
