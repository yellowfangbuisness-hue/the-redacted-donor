// Privacy policy and terms of service, shown from the Account page. Each entry is [heading, paragraph].
// Plain-language drafts that describe what the game actually does; they are not a lawyer's review.
export const LEGAL_DATE = '15 November 2026';
export const PRIVACY = [
  ['The short version', 'You can play the whole game as a guest without giving us anything. If you create an account, we store only what is needed to keep your progress and scores. There are no ads, no tracking and no selling of data.'],
  ['What we store if you play as a guest', 'Your progress is saved on this device. If cloud save is on, a copy of that save, any scores you file and a short report of each attempt (won or caught, time played, items bought) are stored online under a random code kept on this device. We do not know who you are.'],
  ['What we store if you create an account', 'Your email address or investigator ID, your password (stored in scrambled form by our sign-in provider; we can never read it), the name you choose for the leaderboard, your scores, your attempt reports and your cloud save.'],
  ['What other players can see', 'Only your leaderboard name and the scores you file. Your email, your save and your attempt reports are never shown to anyone else.'],
  ['Where it is kept', 'Online data is stored with Supabase, a database hosting service, on servers in Mumbai, India. Apart from the optional hand tracking described below, the game talks to that service and nothing else.'],
  ['Hand tracking and your camera', 'Hand tracking is off unless you turn it on, and you can turn it off at any moment with the H key or from Pause. The camera runs only while it is on. The picture is analysed on your own device to find your hands; no image or video is stored, recorded or sent anywhere, and the preview on screen (a line drawing of your hands, and during setup the camera picture itself) is shown only to you. Anyone else in the camera’s view is treated the same way: looked at on your device, never kept.'],
  ['Which camera, and what is remembered', 'You can use the built-in camera or another one, such as a phone used as a webcam, and switch between them in Pause. This device remembers three things so you do not have to set up again: a few numbers about your hand size and reach, which camera you chose, and your look speed. They stay on this device, are never sent online, and are removed when you clear the game’s saved data. In the Mac app, macOS asks for camera permission the first time; you can withdraw it in System Settings.'],
  ['What hand tracking downloads', 'Normally nothing: the tracking code and the hand model come with the game (the file hand-tracking.js beside it). Only if that file is missing does the game download them, from jsDelivr and from Google’s servers; those two services then see a download request from your device (your internet address, not your picture). Nothing about your hands or your play is ever sent to them.'],
  ['How long we keep it', 'Until you delete it, or until the project is shut down, when everything is erased.'],
  ['Deleting your data', 'Use “Delete my account and online data” on this page. It permanently removes your account, name, scores, attempt reports and cloud save. The save on this device stays until you start a new investigation or clear it yourself.'],
  ['Children', 'The story deals with human trafficking and is not written for young children. If you are under 13, play as a guest or ask a parent or guardian before creating an account.'],
  ['Changes', 'If this policy changes, the date at the top changes with it.'],
];
export const TERMS = [
  ['The game', 'The Redacted Donor is a work of fiction made for a hackathon. People, companies and events in it are invented. It is provided free, as it is, with no promise that it will always be available or free of faults.'],
  ['Your account', 'An account is optional. Keep your password to yourself; you are responsible for what happens under your account. One person per account.'],
  ['Fair play', 'Do not submit fake scores, use offensive or impersonating names, or try to break, overload or get into the online service. We may remove names, scores or accounts that do.'],
  ['Your content', 'The only things you add are a leaderboard name and your play results. By filing a score you agree that the name and score appear on the public leaderboard.'],
  ['Our content', 'The game, its story, art and code belong to its makers. You may play it and share it unmodified; do not sell it.'],
  ['Hand tracking', 'Hand tracking is optional and the whole game can be played without it. If you use it, make sure you have room to move your arms, take breaks, and stop if it is uncomfortable. Only point a camera where you are allowed to, and be considerate of other people in view. It reads hands from a camera picture and will sometimes get it wrong; nothing in the game depends on it being exact.'],
  ['Online features', 'Leaderboards and cloud saves can change, reset or stop at any time. The game still plays offline without them.'],
  ['Liability', 'To the extent the law allows, the makers are not liable for loss of progress, scores or data, or for any other loss from using the game.'],
  ['Ending', 'You can stop at any time and delete your account from the Privacy page. We can end accounts that break these terms.'],
];
