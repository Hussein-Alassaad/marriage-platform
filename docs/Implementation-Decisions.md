# Official Implementation Decisions

This file compiles the approved Official Implementation Decisions exactly as issued. These decisions override any conflicting content in the original PRD.

- Part A: Implementation Decisions #1–#6 (Official) — includes sections 1–8
- Part B: Implementation Decisions #7–#18 (Official)
- Part C: Implementation Decision – AI Recommendation System (Official)

---

# Part A — Implementation Decisions #1–#6 (Official)

The following implementation decisions resolve Issues #1 through #6.

These decisions now replace any previous ambiguous or conflicting behavior in the PRD and become the new authoritative specification.

======================================================================
GENERAL RULE
======================================================================

The platform must have ONE canonical journey state model.

Remove any duplicated or conflicting stage definitions from the PRD.

All platform behavior must reference this single journey state, including:
- Communication permissions
- AI behavior
- Guardian workflow
- Notifications
- Match progression
- Finance
- Marriage Assistant
- UI progression
- Analytics
- Future features

======================================================================
1. Introduction Stage
======================================================================

- 10 messages per person (administrator configurable).
- Every message is AI moderated.
- No phone numbers.
- No social media usernames.
- No external links.
- No QR codes.
- No contact information.
- No inappropriate, flirtatious, or haram conversations.
- AI should explain violations and suggest respectful rewrites.

======================================================================
2. Serious Communication Stage
======================================================================

Requirements:
- Both users completed the Introduction Stage.
- Both users explicitly choose to continue.
- Both users have an active Serious Member or Marriage Plus subscription.

Unlimited messaging is unlocked.

AI moderation remains fully active.

The following restrictions still apply:
- No phone numbers.
- No social media exchange.
- No external communication.
- No inappropriate or haram conversations.

Display a notice informing both users that unrestricted communication becomes available after entering the Family Stage.

======================================================================
3. Family Stage
======================================================================

The woman may invite one trusted guardian (father, mother, wali, brother, uncle, or another trusted guardian).

The guardian creates an account and verifies email and phone. Identity verification should be supported and recommended.

After acceptance, create a NEW private group conversation containing:
- The man
- The woman
- The guardian.

This conversation is separate from the previous private chat.

Once the Family Stage begins:
- Phone numbers may be exchanged.
- Social media may be exchanged.
- Meeting arrangements may be discussed.

The AI no longer blocks these actions.

AI continues moderating only for:
- Abuse
- Harassment
- Threats
- Scams
- Illegal content.

The AI should recommend arranging a respectful in-person meeting (رؤية شرعية) at the appropriate time and provide preparation guidance, but never force it.

======================================================================
4. Married Stage
======================================================================

When both users confirm they are married, transition them into the Married Stage.

Unlock:
- Shared Finance
- Shared Marriage Assistant
- Shared planning features
- Long-term couple tools

The platform should occasionally send respectful reminders asking whether the couple would like to:
- Confirm their marriage.
- Share their success story.
- Share wedding photos.
- Allow the platform to feature their journey on the website or social media.

Everything is optional and requires explicit consent from both users.

======================================================================
5. Identity Verification
======================================================================

Identity Verification is mandatory before any matchmaking or communication features become available.

Users may:
- Create an account.
- Verify email.
- Verify phone.
- Complete their profile.
- Browse the platform.

Users may NOT:
- Appear in AI recommendations.
- Send or receive interest requests.
- Start communication.
- Participate in matchmaking.

until identity verification is completed.

The platform should support officially accepted identity documents according to the user's country or region.

Verification includes:
- Document upload.
- Selfie/liveness verification.
- AI verification.
- Manual review when necessary.

Only the "Verified Identity" badge is visible to other users.

======================================================================
6. Women's Photo Privacy
======================================================================

A woman's profile photo is never visible to non-subscribed users.

Only Serious Member and Marriage Plus users may view women's profile photos.

The woman has full control over her photo visibility according to her selected privacy settings.

No subscription can override the woman's privacy choice.

The platform does not allow inappropriate or immodest profile photos. Every uploaded photo should be reviewed by AI (and manual review when needed) to ensure it follows the platform's Islamic values.

======================================================================
7. AI Moderation
======================================================================

Every message must be checked by AI before delivery.

AI moderation must fully support both Arabic and English.

The AI blocks inappropriate, haram, abusive, or rule-breaking communication before it reaches the recipient.

======================================================================
8. AI Conversation Summary
======================================================================

Conversation summaries are available only for paid members.

Free users do not receive AI conversation summaries.

Summaries focus on marriage-related discussions, highlight important topics already discussed, and suggest respectful topics that should still be covered.

The AI must never encourage romantic or inappropriate conversations.

======================================================================

These implementation decisions override any conflicting content in the original PRD unless explicitly changed later.

---

# Part B — Implementation Decisions #7–#18 (Official)

The following implementation decisions resolve Issues #7 through #18.

These decisions replace any previous ambiguous or conflicting behavior in the PRD and become the new authoritative specification.

======================================================================
7. Minimum Age
======================================================================

The platform itself does not define a fixed minimum marriage age.

Instead, the minimum age requirement must be configurable by the platform administrator according to the laws and regulations of the country or region where the platform is deployed.

This setting should be configurable without modifying the platform's core logic.

======================================================================
8. Gender
======================================================================

Gender is selected during registration.

After successful identity verification, gender cannot be changed through the application.

Any future change requires manual review and approval by platform administrators.

======================================================================
9. Guardian (Wali) Verification
======================================================================

The platform cannot independently verify whether someone is the user's actual father or legal wali.

Instead, the following process should be used:

- The woman selects the relationship of the invited guardian (Father, Mother, Brother, Uncle, Wali, or Other Trusted Guardian).
- The invited guardian creates an account.
- The guardian verifies email and phone.
- Identity verification should be supported and strongly recommended.
- The guardian must explicitly declare that they are authorized by the woman to act as her guardian or family representative.

Display the guardian as:

"Verified Guardian (Relationship declared by the user and confirmed by the guardian)."

The platform must never claim that it has independently verified the actual family relationship or legal guardianship.

======================================================================
10. Configurable Platform Limits
======================================================================

All platform limits must be configurable from the Admin Dashboard.

Default values:

- Introduction messages: 10 messages per person.
- AI conversation summary: every 20 messages.
- Free users: 5 interest requests per day.
- Paid users: Unlimited interest requests.
- AI moderation mode: Strict by default.

Administrators may modify these values at any time without changing the source code.

======================================================================
11. Subscription Payments
======================================================================

The platform should support multiple payment methods.

International / Automatic:
- Visa
- Mastercard
- Apple Pay (where supported).
- Google Pay (where supported).

These payments should be processed through the integrated payment gateway (such as Areeba or another supported gateway in Lebanon) and subscriptions should activate automatically after successful payment.

Lebanon Payment Methods:
- OMT.
- Whish Money.
- Bank Transfer.

The payment system should be modular so additional payment providers can easily be added in the future.

The platform should support recurring monthly subscriptions whenever supported by the selected payment gateway.

======================================================================
12. AI Moderation Violations
======================================================================

Every message must be checked by AI before delivery.

AI moderation must fully support both Arabic and English.

If the AI moderation service is temporarily unavailable, the message must NOT be delivered.

Instead, inform the user that moderation is temporarily unavailable and ask them to try again later.

Violation handling:

• First violation:
- Block the message.
- Explain why.
- Suggest a respectful rewrite.

• Second violation:
- Official warning.

• Third violation:
- Temporary communication suspension.

• Repeated or severe violations:
- Administrator review.
- Temporary or permanent suspension depending on severity.

Immediate permanent suspension may occur for:
- Sexual harassment.
- Threats.
- Blackmail.
- Explicit content.
- Fraud or scams.
- Hate speech.
- Repeated attempts to bypass platform safety.

======================================================================
13. Match Termination
======================================================================

Either user may end a match at any time.

Once a match is terminated:
- Both users lose access to the conversation.
- Shared Finance and all shared features are disconnected.
- User data is retained according to the platform's privacy policy.
- The same two users cannot send another interest request for 30 days (administrator configurable).

======================================================================
14. Multiple Currencies
======================================================================

The platform should support multiple currencies.

Users may choose their preferred currency.

Exchange rates should be updated automatically using a reliable exchange-rate service.

Reports, charts, and financial calculations should always use the user's selected currency.

======================================================================
15. Identity Document Retention
======================================================================

Identity documents must be securely encrypted.

Only authorized administrators may access them when necessary.

Identity documents should be deleted after successful verification unless local laws require longer retention.

Identity documents must never be shared or publicly accessible.

======================================================================
16. MVP Scope
======================================================================

The MVP should be a fully functional production-ready application.

It should include:
- Authentication.
- Database.
- AI systems.
- Messaging.
- Payments.
- Notifications.
- Administration.
- All core platform features.

Mock data should only be used for external services that cannot yet be integrated.

======================================================================
17. Finance Module Access
======================================================================

Free Users:
- Add income.
- Add expenses.
- View simple income and expense history.

Paid Members (Serious Member):
- Everything in Free.
- Financial charts and graphs.
- Statistics.
- Budget planning.
- Savings goals.
- Financial reports.
- AI financial insights.

Marriage Plus:
- Everything in Serious Member.
- Couple Finance.
- Shared Financial Planning.
- Advanced AI financial recommendations.
- Long-term marriage financial management tools.

======================================================================
18. Score Visibility
======================================================================

Marriage Readiness Score is visible only to the user.

Compatibility Score is visible only to the matched couple.

Scores are never visible to guardians unless explicitly shared by the user.

No other users may access these scores.

======================================================================

These implementation decisions override any conflicting content in the original PRD unless explicitly changed later.

**Subsequent official ruling (Shared Finance, resolving the #4/#17 interaction):** Shared Finance requires both users to be in the Married Stage. Marriage Plus unlocks advanced shared finance tools. Basic shared finance access is configurable by the admin, but advanced couple finance stays Marriage Plus.

---

# Part C — Implementation Decision – AI Recommendation System (Official)

Replace the previous recommendation system with the following:

1. AI-Curated Recommendations
- The platform must prioritize quality over quantity.
- Users should never browse an endless list of profiles.
- The AI should first filter all compatible users, rank them by compatibility, and recommend only the best candidates.

2. Daily Recommendations
- Free: 10 new AI-recommended profiles per day.
- Serious Member: 25 new AI-recommended profiles per day.
- Marriage Plus: 50 new AI-recommended profiles per day.

All limits must be configurable by the administrator.

3. Compatibility Card

Each recommendation should display:
- Overall compatibility percentage.
- Compatibility breakdown (Religion, Values, Personality, Marriage Goals, Lifestyle, Distance, etc.).
- A short AI explanation describing why this person was recommended.

4. Recommendation Refresh

Marriage Plus users can request new recommendations without waiting until the next day.

Instead of generating unlimited browsing, the AI replaces the current recommendation list with different high-quality compatible profiles.

The number of daily refreshes must be configurable by the administrator.

5. Recommendation History

Only Serious Member and Marriage Plus subscribers can access Recommendation History.

History should include:
- Today's recommendations.
- Previous recommendation days.
- Saved profiles.
- Viewed profiles.
- Declined profiles.

Free users cannot access Recommendation History.

6. General Rules
- Daily limits apply only to NEW recommendations generated each day.
- Previously recommended profiles remain available through Recommendation History for eligible subscribers.
- AI should avoid recommending the same profiles repeatedly unless they remain among the user's strongest compatible matches.
- Recommendation quality must always be prioritized over quantity.

These implementation decisions override any conflicting content in the original PRD unless explicitly changed later.

---

# Part D — Official Implementation Decision: Communication Stages & Media Rules (Official)

**This decision supersedes all previous communication rules** — including Part A items #1–#4 and the PRD's "Voice Messages (Future)" / "Video Calls (Future)" notes — wherever they conflict. The four-stage canonical journey model is unchanged; this decision defines the permitted media types, limits, and moderation rules per stage.

## General Principle
Communication becomes progressively more natural as the relationship becomes more serious. The platform protects users during the early stages and allows more natural communication after commitment and family involvement. The four communication stages are: Introduction → Serious Communication → Family → Married. Each stage has different permissions and AI moderation rules.

## 1. Introduction Stage
- **Allowed media: text only.** No voice, images, videos, files, documents, or attachments.
- Limit: configurable messages per person (default 10).
- Strict AI moderation on every message before delivery. The AI blocks: phone numbers, WhatsApp, Telegram, Instagram, Facebook, Snapchat, TikTok, Discord, email addresses, QR codes, external links, social media usernames, requests to communicate off-platform, safety-bypass attempts, inappropriate/sexual flirting, harassment, abuse, threats, explicit content, scams, illegal content.
- The AI encourages marriage-evaluation topics (education, career, family values, marriage goals, children, lifestyle, religious values, financial expectations, communication style, conflict resolution, future plans).
- On block: explain why + suggest a respectful alternative.

## 2. Serious Communication Stage
- Requirements: both users completed the Introduction Stage, both explicitly choose to continue, both hold an active Serious Member or Marriage Plus subscription.
- **Allowed media: unlimited text + unlimited voice.** Not allowed: images, videos, files, external contact information.
- **Voice moderation pipeline:** Record → upload to private storage → speech-to-text transcription → AI moderation of transcript → approved delivers the voice message / blocked rejects it with an explanation. Voice must never bypass moderation. **If transcription OR moderation fails, the voice message is not delivered.**
- Moderation remains as strict as the Introduction Stage: still blocks phone numbers, social media, external communication, links, QR codes, abuse, harassment, explicit sexual content, threats, fraud, illegal content.

## 3. Family Stage
- Requirements: the woman invites her guardian, guardian account is created and verified, Family Stage is officially activated.
- **Allowed media: unlimited text, unlimited voice, images, and videos.**
- **Media limits (admin-configurable):** images default 3 per day, videos default 2 per day. Images/videos remain limited to encourage meaningful communication over casual media sharing.
- All images and videos must pass AI moderation before delivery; voice continues to be transcribed and moderated. If moderation fails, the media is not delivered.
- Moderation relaxes because family is now involved: the AI **no longer blocks** phone numbers, WhatsApp, Telegram, Instagram, Facebook, email addresses, external contact information, or meeting arrangements.
- The AI continues blocking: harassment, abuse, threats, blackmail, fraud, scams, hate speech, explicit sexual content, illegal content.

## 4. Married Stage
- Requirement: both users confirm they are married.
- **No communication limits.** AI moderation continues **only for user safety**, blocking only: abuse, harassment, threats, fraud, scams, illegal content, explicit sexual content. The AI never interferes with normal conversation between married couples.
- Unlocks: Shared Finance, Shared Marriage Assistant, Shared Planning, long-term couple tools, Shared Financial Reports, Shared Goals, Shared AI Assistance.

## Technical Requirements
- The `messages` table must support message types: `text`, `voice`, `image`, `video`.
- New private storage buckets for chat voice messages, chat images, and chat videos — all accessed via **short-lived signed URLs** with server-side permission checks.
- New Edge Functions: `send-text-message`, `send-voice-message`, `send-image-message`, `send-video-message`.
- Every communication request must: validate permissions, validate journey stage, apply rate limits, run AI moderation, store moderation results, deliver only after approval, and broadcast via Supabase Realtime.
- **Clients must never insert messages directly into the database.**

## Design Philosophy
Protect users during early stages; encourage meaningful marriage-focused conversation; gradually increase communication freedom as trust and commitment grow; keep AI a respectful safety assistant rather than an intrusive censor; never let communication features make the platform resemble a dating or social media application.

This decision overrides any conflicting content in the PRD and earlier decisions unless explicitly changed later.
