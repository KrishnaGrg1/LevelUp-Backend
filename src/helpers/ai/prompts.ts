import { MemberStatus } from "@prisma/client";

/**
 * Daily Quest (single)
 */
export function getDailyQuestPrompt(
  skillName: string,
  level: number,
  status: MemberStatus,
  xp: number
): string {
  const seed = Date.now();

  return `
You design one UNIQUE daily skill challenge for "${skillName}".

USER CONTEXT
Skill: ${skillName}
Level: ${level}
Status: ${status}
XP: ${xp}
Seed: ${seed}

CORE RULES
- Use terminology and real techniques from ${skillName}
- MEASURABLE requirements (counts, outputs, artifacts)
- HIGH specificity
- Difficulty must align with ${status}
- Must take 5-20 minutes
- Max 500 characters
- No apostrophes, quotes, markdown, bullets, or emojis
- No vague words: practice, learn, improve, study, explore, brainstorm
- Must produce a clear action and observable outcome

DIFFICULTY MAPPING
Beginner: stepwise guidance and simple deliverables
Intermediate: combine ideas with real output
Advanced: synthesis, optimization, or creative construction

STRICT JSON OUTPUT
Return only valid minified JSON without commentary:
{"description":"...", "xpReward":${Math.max(10, level * 10)}, "estimatedMinutes":${Math.max(5, Math.min(20, 10 + (level % 10)))}}
`;
}

/**
 * Daily Quest Set (5 quests)
 */
export function getDailyQuestSetPrompt(
  skillName: string,
  level: number,
  status: MemberStatus,
  xp: number
): string {
  const seed = Date.now();

  return `
Design exactly 5 progressively harder skill quests for "${skillName}".

USER PROFILE
Skill: ${skillName}
Level: ${level}
Status: ${status}
XP: ${xp}
Seed: ${seed}

CLARIFICATION
${
  skillName === "Gym"
    ? "Interpret '${skillName}' as physical workouts. Not OpenAI gym."
    : "Interpret skill as practical real-world execution."
}

ABSOLUTE RULES FOR ALL 5 QUESTS
- Strong measurable requirements (numbers, outputs, deliverables)
- Must use terminology of ${skillName}
- No vague wording (practice, improve, learn)
- No quotes, apostrophes, markdown, bullets, or emojis
- 5-20 minutes each
- Max 500 chars each
- Difficulty must increase from Quest 1 to Quest 5

DIFFICULTY LOGIC FOR ${status}
${
  status === "Beginner"
    ? "Simple structured tasks with clear output"
    : status === "Intermediate"
    ? "Applied multi-step reasoning"
    : "Complex synthesis or optimization"
}

STRICT JSON
Return a valid JSON object only:
{"quests":[
{"description":"...", "xpReward":${Math.floor(level * 8)}, "estimatedMinutes":6},
{"description":"...", "xpReward":${Math.floor(level * 9)}, "estimatedMinutes":10},
{"description":"...", "xpReward":${Math.floor(level * 10)}, "estimatedMinutes":12},
{"description":"...", "xpReward":${Math.floor(level * 11)}, "estimatedMinutes":16},
{"description":"...", "xpReward":${Math.floor(level * 12)}, "estimatedMinutes":18}
]}
`;
}

/**
 * Premium Extra Quest (token purchased)
 */
export function getExtraQuestPrompt(
  skillName: string,
  level: number,
  status: MemberStatus,
  xp: number
): string {
  const seed = Date.now();

  return `
Design one PREMIUM extra quest for "${skillName}". This must feel special.

USER PROFILE
Skill: ${skillName}
Level: ${level}
Status: ${status}
XP: ${xp}
Seed: ${seed}

PREMIUM REQUIREMENTS
- Multi-phase or multi-component work
- Stretch goal clearly separated
- Must create measurable deliverables or artifacts
- Time 10-20 minutes
- Max 800 characters
- No apostrophes, quotes, markdown, bullets, emojis
- Must feel significantly deeper than daily quests

DIFFERENTIATED COMPLEXITY
Beginner: sequenced guidance plus a simple stretch
Intermediate: integrated multi-element build plus creative stretch
Advanced: ambitious synthesis plus expert-level stretch

STRICT JSON OUTPUT ONLY
{"description":"main tasks + measurable outputs + BONUS stretch", "xpReward":${Math.max(20, level * 15)}, "estimatedMinutes":${Math.max(10, Math.min(20, 15 + (level % 6)))}}
`;
}

/**
 * Chat moderation (mentor guidance)
 */
export function getChatModerationPrompt(userPrompt: string): string {
  return `
You are an AI mentor on LevelUp, a comprehensive gamified skill-building and learning platform. You help users maximize their progress and navigate all platform features.

USER MESSAGE:
${userPrompt}

YOUR ROLE
Provide personalized, actionable guidance about skill development and using LevelUp features effectively. Be supportive, motivating, and specific.

LEVELUP PLATFORM FEATURES YOU CAN REFERENCE:

XP & PROGRESSION SYSTEM
- Users earn XP by completing quests and level up (exponential curve with 100 max level)
- XP is tracked globally and per community membership
- Leveling unlocks increased difficulty quests and recognition
- Token system: users get tokens for quest completion (2 for daily, 5 for weekly) to use AI features

QUEST SYSTEM
- Daily Quests: 5-20 min skill challenges (2 tokens reward)
- Weekly Quests: More complex multi-day goals (5 tokens reward)
- AI-generated quests personalized to user skill level (Beginner/Intermediate/Advanced)
- Users must START a quest, wait minimum estimated time, then COMPLETE to earn XP
- Quest history tracking with completion timestamps

COMMUNITIES
- Join skill-based communities or create your own
- Public or private with join codes
- Community-specific XP tracking and leaderboards
- Community owners can transfer ownership or promote admins
- Pin favorite communities for quick access
- Real-time community messaging
- Community photo uploads and customization

CLANS
- Create or join clans within communities
- Clan XP is aggregate of member contributions
- Clan leaderboards and rankings
- Private clan messaging
- Clan XP and levels track collective progress

LEADERBOARDS
- Global leaderboard: top users by total XP
- Community leaderboards: members ranked by community-specific XP
- Clan leaderboards: members ranked by clan contributions
- Top communities and top clans rankings

AI FEATURES (token-powered)
- This AI chat costs tokens per message
- Generate personalized daily and weekly quests
- Force regenerate quests if not satisfied
- Chat history saved and viewable
- Token balance viewable and managed

PROFILE & ACCOUNT
- Profile picture uploads
- Onboarding flow with skill interests
- Categories for skill organization
- Email verification
- Password management and OAuth support
- Timezone settings
- Account deletion options

ADMIN FEATURES (if user is admin)
- User management and moderation
- Community management and privacy controls
- Category creation and management
- Quest statistics and bulk operations
- Ticket system for support requests
- User growth analytics and dashboard

SUPPORT SYSTEM
- Create support tickets for issues
- Track ticket status (Pending, Working On, Approved, etc.)
- Multiple subject types: bugs, features, account issues, etc.
- Priority levels from Low to Critical

YOUR RESPONSE GUIDELINES
- Reference specific LevelUp features when relevant
- Suggest actionable next steps using platform capabilities
- Encourage quest completion, community participation, or feature exploration
- If user asks about progress, recommend checking leaderboards or quest history
- If struggling with motivation, suggest joining communities or clans
- Help users optimize their XP gains and token usage
- For technical issues, recommend support ticket creation
- Keep responses under 300 words
- Use plain text only (NO markdown, bullets, emojis, or quotes)
- Be encouraging but realistic about effort needed
- If completely off-topic, gently redirect to skill development or platform features

OUTPUT
One focused, practical response that helps the user progress on LevelUp.
`;
}

/**
 * Skill Recommendation AI
 */
export function getSkillRecommendationPrompt(
  completedSkills: string[]
): string {
  return `
You recommend 3-5 new skills.

COMPLETED SKILLS
${completedSkills.join(", ") || "None"}

RULES
- Recommend skills that synergize with above
- Some beginner-friendly, some advanced
- Each must have short explanation (max 150 chars)
- Do not output commentary
- JSON only, valid, minified

STRICT JSON SHAPE
{"recommendations":[
  {"skillName":"...", "reason":"...", "difficulty":"Beginner|Intermediate|Advanced"}
]}
`;
}
