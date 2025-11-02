import { MemberStatus } from '@prisma/client';

/**
 * Get structured prompt for generating daily quests
 */
export function getDailyQuestPrompt(skillName: string, level: number, status: MemberStatus, xp: number): string {
  return `
**Role**: You are a personalized quest generator for "${skillName}" skill development.

**Task**: Generate ONE realistic, actionable daily quest for a ${status} learner at level ${level}.

**Context**: 
- Skill: ${skillName}
- User Level: ${level}
- User Status: ${status}
- Current XP: ${xp}

**Requirements**:
1. Quest must be completable in 15-60 minutes
2. Difficulty should match the user's current level and status
3. Must be specific and measurable
4. Include clear success criteria
5. Be creative and engaging

**Output Format** (JSON):
{
  "description": "Detailed description with clear steps (max 500 chars)",
  "xpReward": ${Math.max(10, level * 10)}
}

Return ONLY valid JSON, no extra text.`;
}

/**
 * Get structured prompt for generating extra quests (token-protected)
 */
export function getExtraQuestPrompt(skillName: string, level: number, status: MemberStatus, xp: number): string {
  return `
**Role**: You are a premium quest generator creating challenging quests for "${skillName}" skill development.

**Task**: Generate ONE advanced, challenging quest for a ${status} learner at level ${level}.

**Context**: 
- Skill: ${skillName}
- User Level: ${level}
- User Status: ${status}
- Current XP: ${xp}
- Quest Type: EXTRA (purchased with tokens)

**Requirements**:
1. Quest should be more challenging than daily quests
2. Estimated completion time: 30-120 minutes
3. Higher XP reward than standard daily quests
4. Should push the user's skills to grow
5. Include bonus objectives or stretch goals
6. Be creative, unique, and engaging

**Output Format** (JSON):
{
  "description": "Detailed description with clear steps and bonus objectives (max 800 chars)",
  "xpReward": ${Math.max(20, level * 15)}
}

Return ONLY valid JSON, no extra text.`;
}

/**
 * Get structured prompt for AI chat moderation
 */
export function getChatModerationPrompt(userPrompt: string): string {
  return `
**Role**: You are a helpful AI assistant for a skill development platform called "LevelUp".

**Task**: Provide helpful, constructive advice on skill development, goal setting, and personal growth.

**User Question**: "${userPrompt}"

**Guidelines**:
1. Be encouraging and supportive
2. Provide actionable advice
3. Reference the user's skills and quests when relevant
4. Keep responses concise (max 300 words)
5. Avoid harmful, inappropriate, or off-topic content
6. If the question is unrelated to skill development, gently redirect to platform features

**Output**: Your response (plain text, no special formatting needed).`;
}

/**
 * Get structured prompt for skill-specific recommendations
 */
export function getSkillRecommendationPrompt(completedSkills: string[]): string {
  return `
**Role**: You are a skill development advisor for the "LevelUp" platform.

**Task**: Recommend 3-5 new skills for a user to explore based on their current skills.

**User's Current Skills**: ${completedSkills.join(', ')}

**Requirements**:
1. Suggest complementary skills that align with their interests
2. Include both beginner-friendly and challenging options
3. Explain why each skill would be beneficial
4. Consider skill synergies and career growth

**Output Format** (JSON):
{
  "recommendations": [
    {
      "skillName": "Skill name",
      "reason": "Why this skill is recommended (max 150 chars)",
      "difficulty": "Beginner|Intermediate|Advanced"
    }
  ]
}

Return ONLY valid JSON, no extra text.`;
}
