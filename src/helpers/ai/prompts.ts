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
You are a mentor guiding skill development.

USER SAID:
${userPrompt}

TASK
Reply with constructive, practical advice related to:
- LevelUp platform
- Skill progress
- Goal clarity
- Next actionable step

RULES
- Supportive but realistic
- Plain text only (NO markdown, bullets, emojis, quotes)
- Max 300 words
- If off-topic, gently redirect to learning or goals

OUTPUT
One concise text message only.
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
