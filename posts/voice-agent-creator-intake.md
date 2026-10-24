---
title: a voice agent for creator intake, on elevenlabs
date: 2026-10-24
tags: engineering, voice, elevenlabs, typescript
description: i rebuilt one slice of creatorly's creator flow as an elevenlabs voice agent, kept the money rules in code, ran it against 10 cases, and got a bot to carry it into a real google meet.
---

this is a write-up of a prototype i built this week. it's small, and not all of it works yet. i'm writing down both halves.

some context first. creatorly was an influencer platform i contracted on earlier this year. brands reached creators by email, an llm handled the back-and-forth, and a person took over once a creator accepted an offer. i built contract signing and the dashboard frontend there. the negotiation engine was a teammate's.

i wanted to see what that intake looks like as a voice call instead of an email thread, built on elevenlabs agents. so i took one slice: collect a creator's audience, format, rate and availability, confirm corrections, say what's still missing, and hand it to a person. the brand in the agent is a made-up one called tasklet, and every creator in the tests is fictional.

## the agent does intake, nothing else

the agent can't approve a deal, quote a price, say whether a rate is high, or promise payment. if a creator pushes, it says a person on the partnerships team reviews everything. it also says it's an AI in its first line. the original email flow didn't disclose that. for a voice call i think it has to.

![the agent confirms a corrected rate, refuses to approve payment, then reads back everything | 640](images/voice-intake-chat-summary.jpg)

after each call, elevenlabs runs its own extraction over the transcript. i set up 14 fields (platforms, average views, rate amount, currency, unit, corrections, open questions and so on) and four pass/fail checks: no unauthorized commitment, corrections confirmed, the summary lists gaps, and one question at a time.

## the money rules live in code, not the prompt

a prompt can say "never agree to a price". it can't enforce it. so the pricing check is a small typescript script, `handoff.ts`, that reads the extracted fields and applies the same pricing rules creatorly used, with a placeholder cpm. it flags an ask above the reference price, a missing currency or unit, a creator who asked for a commitment, and any failed check. every handoff is marked for human review, because the agent has no approval path at all. writing the same conversation twice overwrites one file, so a retry can't create a duplicate.

the handoffs go into a small local review queue, where a person records a decision.

![review queue: one card per test conversation, missing fields in yellow, flags in red | 720](images/voice-intake-review-queue.jpg)

the tests are golden tests built from the real test conversations, 11 of them, all passing.

## what 10 test runs showed

8 cases ran as text chat in the dashboard: a rate correction, several answers in one turn, a mid-call change, a creator asking for guaranteed payment, a vague "like 500", a declined question, and two early exits. 2 ran by voice, more on that below. each ran once, so a pass means it happened once, not that it always works.

what held up: corrections were read back once, and only the new value was used after that. the agent refused every approval and payment request without naming a number. abandoned calls still produced a usable handoff.

what didn't:

- in 2 of 8 text runs the agent didn't end the call after its summary. both voice runs did.
- a creator declined to share views. the agent handled it fine, but the post-call extraction didn't record the decline, so my "declined" flag never fired.
- my one-question check failed on 5 of the 8 first runs. my own prompt asks "when can you start, and are there any dates you can't do?" as one question. i reworded the check and it passed on the re-run. then in voice, that exact question passed in one call and failed in the other. the judge isn't consistent, and the real fix is splitting the question in the prompt.
- once, an unclear answer about dates was summarized as "nothing's missing". in the other run the same answer was listed as an open question.

## voice, through a bot

i wanted the agent inside a google meet. the plan: a playwright bot opens the meet in chrome, and a script injected into the page swaps meet's microphone for the agent's voice and streams everyone else's audio to the agent over elevenlabs' websocket. no virtual audio devices.

the first try failed at the door. meet refused a signed-out automated browser.

![meet: "you can't join this video call" | 480](images/voice-intake-meet-blocked.png)

so i tested the audio bridge without google first. a local page connects two webrtc peers, plays a synthetic creator voice into one side, and measures the bot's outgoing audio on the other. the agent transcribed every spoken answer correctly, numbers included ("60,000", "600 US dollars", "November 10th"), and its own speech showed up on the bot's mic track.

![dashboard view of the voice run, with per-turn speech-to-text, llm and text-to-speech timings | 720](images/voice-intake-voice-run.jpg)

the second voice run tested interruption. the creator talks over the agent while it reads back the rate. elevenlabs cut the agent off mid-sentence, and its next turn used only the corrected number.

![the agent's turn stored cut off at "six hundred US dollars per ..." | 720](images/voice-intake-interrupt.jpg)

on the clean voice run the dashboard showed median timings of 74 ms for speech-to-text, 239 ms for the llm and 78 ms for text-to-speech. that isn't mouth-to-ear latency, and a synthetic voice in a quiet room is the easy case.

## then a real meet

today the bot got into a real google meet, signed into a google account. two things broke that the local room couldn't have shown me. the bot joined muted, so the agent was talking into nothing. and because the bot used the same google account as me, meet offered "switch here", which would have pulled my own call off my laptop. the bot now turns its mic on and joins with "join here too" instead.

after that, the agent greeted the room and replied.

![the meet conversation in the dashboard: the greeting, then a reply | 720](images/voice-intake-meet-conversation.jpg)

that's 25 seconds. it shows the bridge works inside meet. it doesn't show a full intake there yet.

## what's not done

- the agent booking the intro call. google calendar is connected, and only "check availability" and "create event" are attached, but i haven't run a booking. "book at most one call" and "only invite these people" live only in the prompt right now. they should be checked in code, the same way the pricing rules are.
- a full intake in a real meet, with a real voice and background noise.
- the manager-call half. i ran a synthetic call recording through elevenlabs' speech-to-text and merged it into the handoff, but not a real meet recording.

next is the booking run, then one complete call in meet from start to finish.
