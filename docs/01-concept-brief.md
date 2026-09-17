# Concept Brief

## Working Name
Crossfade (might change later)

## The Pitch
A playlist bridge between Apple Music and Spotify, so I can send a playlist to a friend on the other service and have it actually open and play for them instead of being a screenshot they have to retype.

## Who It's For
Me and my friends, honestly. I'm on Apple Music and a lot of the people I want to swap music with are on Spotify. It comes up when someone says "send me that playlist" — I'm usually on my phone, mid-conversation, and I want it to take five seconds. Right now it doesn't, so most of the time the playlist just never gets sent.

## The Job It Does
When a friend and I are on different music services and I want to share a playlist with them, I want to send one link that rebuilds the playlist in whatever app they already use, so we can trade music without either of us switching services or adding songs one at a time.

## What I Do Instead Today
I screenshot the track list and send the picture, or I paste a few individual song links into the group chat and let them look up the rest. Sometimes I just name a couple of artists and give up on sending the actual playlist. The paid converter apps exist, but I'm not paying a subscription to send a friend a playlist.

## My Biggest Unknown
Whether the song matching is good enough to be worth using. Even if I can read a playlist from one service and write it to the other, the two catalogs don't line up — remixes, live versions, features, explicit vs. clean, and songs that just aren't available on one of them. If a 40-song playlist arrives with 12 songs wrong or missing, nobody uses this twice. The other unknown is access: I don't know yet what Spotify's Web API and Apple's MusicKit will actually let me do with playlists on a free or student developer account, especially writing to someone else's library.

## Stack Guess
Spotify Web API and Apple MusicKit for reading and writing playlists, OAuth for both so each person connects their own account, and a small web app so there's nothing to install — probably a React front end with a Node or Python backend. This will almost certainly change by Week 7.
