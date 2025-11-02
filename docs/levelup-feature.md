# LevelUp — AI Daily Quests + Skills + Tokens + Subscriptions + Upsell

## Overview

The LevelUp feature is a comprehensive skill development system that combines:
- **AI-generated quests** for personalized skill practice
- **Token economy** for premium features
- **Subscription tiers** (FREE, PRO, ULTRA)
- **Intelligent upsell triggers** based on user behavior
- **Progress tracking** with XP, levels, and milestones

---

## Database Schema Changes

### New Models

#### `Skill`
```prisma
model Skill {
  id          String   @id @default(cuid())
  name        String   @unique
  slug        String?  @unique
  description String?
  icon        String?
  isPremium   Boolean  @default(false)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  userSkills UserSkill[]
}
```

#### `UserSkill`
Per-skill progress tracking for each user.
```prisma
model UserSkill {
  id        String       @id @default(cuid())
  userId    String
  skillId   String
  level     Int          @default(1)
  xp        Int          @default(0)
  status    MemberStatus @default(Beginner)
  createdAt DateTime     @default(now())
  updatedAt DateTime     @updatedAt

  user   User    @relation(fields: [userId], references: [id], onDelete: Cascade)
  skill  Skill   @relation(fields: [skillId], references: [id], onDelete: Cascade)
  quests Quest[]

  @@unique([userId, skillId])
}
```

#### `Subscription`
```prisma
model Subscription {
  id        String           @id @default(cuid())
  userId    String           @unique
  plan      SubscriptionPlan @default(FREE)
  expiresAt DateTime?
  createdAt DateTime         @default(now())
  updatedAt DateTime         @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
}

enum SubscriptionPlan {
  FREE
  PRO
  ULTRA
}
```

#### `DailyStreak`
```prisma
model DailyStreak {
  id             String   @id @default(cuid())
  userId         String   @unique
  count          Int      @default(0)
  lastCompletedAt DateTime?
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

#### `Milestone` & `UserMilestone`
```prisma
model Milestone {
  id            String          @id @default(cuid())
  name          String
  description   String?
  xpReward      Int             @default(0)
  createdAt     DateTime        @default(now())
  UserMilestone UserMilestone[]
}

model UserMilestone {
  id          String   @id @default(cuid())
  userId      String
  milestoneId String
  achievedAt  DateTime @default(now())

  user      User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  milestone Milestone @relation(fields: [milestoneId], references: [id], onDelete: Cascade)
}
```

#### `UpsellTrigger`
Tracks when to show upgrade prompts.
```prisma
model UpsellTrigger {
  id        String   @id @default(cuid())
  userId    String
  type      String
  meta      Json?
  createdAt DateTime @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

### Modified Models

#### `User`
Added token management and subscription fields:
```prisma
model User {
  // ... existing fields ...
  tokens        Int             @default(50) // daily refill
  userSkills    UserSkill[]
  subscription  Subscription?
  DailyStreak   DailyStreak?
  UserMilestone UserMilestone[]
  UpsellTrigger UpsellTrigger[]
}
```

#### `Quest`
Linked to `UserSkill` for per-skill progress:
```prisma
model Quest {
  // ... existing fields ...
  userSkillId String? // NEW: optional link to specific skill progress
  userSkill   UserSkill? @relation(fields: [userSkillId], references: [id])
}
```

---

## API Endpoints

### 1. Onboarding: Select Skills
**POST** `/skills/select`

Select skills during user onboarding.

**Request Body:**
```json
{
  "skillIds": ["skill_id_1", "skill_id_2"],
  "initialStatus": "Beginner" // optional: Beginner | Intermediate | Advanced
}
```

**Response:**
```json
{
  "success": true,
  "message": "Skills selected successfully",
  "data": {
    "userSkills": [
      {
        "id": "userskill_id",
        "userId": "user_id",
        "skillId": "skill_id_1",
        "level": 1,
        "xp": 0,
        "status": "Beginner"
      }
    ]
  }
}
```

---

### 2. Complete Quest (Enhanced)
**POST** `/quest/complete`

Complete a quest and gain XP using the formula: **50 × level²**

**Request Body:**
```json
{
  "questId": "quest_id"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Quest completed successfully",
  "data": {
    "quest": { /* quest object */ },
    "xpGained": 200,
    "leveledUp": true,
    "newLevel": 3,
    "streak": {
      "count": 5,
      "lastCompletedAt": "2025-01-15T10:30:00Z"
    }
  }
}
```

**XP Formula:**
- Level 1: 50 XP to next level
- Level 2: 200 XP to next level
- Level 3: 450 XP to next level
- Level N: 50 × N² XP to next level

---

### 3. AI Chat (Token-Protected)
**POST** `/ai/chat`

Chat with AI assistant (costs 3 tokens, FREE for ULTRA users).

**Request Body:**
```json
{
  "prompt": "How can I improve my coding skills?"
}
```

**Response:**
```json
{
  "success": true,
  "message": "AI chat successful",
  "data": {
    "response": "Here are 5 ways to improve your coding skills...",
    "tokensRemaining": 47
  }
}
```

**Error (Insufficient Tokens):**
```json
{
  "success": false,
  "error": "Insufficient tokens. You need 3 tokens.",
  "code": "error.ai.insufficient_tokens"
}
```
*Note: Creates an `UpsellTrigger` of type `INSUFFICIENT_TOKENS` for upgrade prompts.*

---

### 4. Generate Extra Quest (Token-Protected)
**POST** `/quest/generate-extra`

Generate an extra AI quest for a skill (costs 5 tokens).

**Request Body:**
```json
{
  "userSkillId": "userskill_id"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Extra quest generated successfully",
  "data": {
    "quest": {
      "id": "quest_id",
      "description": "Build a React component with hooks...",
      "xpValue": 150,
      "type": "Challenge"
    },
    "tokensRemaining": 45
  }
}
```

---

### 5. Dashboard Feed
**GET** `/feed/dashboard`

Comprehensive user dashboard with quests, streaks, and upsell logic.

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "user_id",
      "UserName": "john_doe",
      "level": 5,
      "xp": 1250,
      "tokens": 42
    },
    "subscription": {
      "plan": "FREE",
      "expiresAt": null
    },
    "todayQuests": {
      "Coding": [
        {
          "id": "quest_id",
          "description": "Complete a JavaScript challenge",
          "xpValue": 50,
          "isCompleted": false
        }
      ],
      "Fitness": []
    },
    "streak": {
      "count": 7,
      "lastCompletedAt": "2025-01-14T22:00:00Z"
    },
    "recentMilestones": [
      {
        "name": "Week Warrior",
        "achievedAt": "2025-01-14T22:05:00Z"
      }
    ],
    "showUpsell": true,
    "upsellReasons": ["LOW_TOKENS", "STREAK_MILESTONE"]
  }
}
```

**Upsell Trigger Conditions:**
- `LOW_TOKENS`: User has < 10 tokens
- `STREAK_MILESTONE`: User achieved a 3, 7, or 21-day streak
- `FREQUENT_AI_USER`: User has > 5 AI chat UpsellTriggers in the last 7 days

---

### 6. Upgrade Subscription
**POST** `/subscription/upgrade`

Upgrade user subscription (payment placeholder).

**Request Body:**
```json
{
  "plan": "PRO" // PRO | ULTRA
}
```

**Response:**
```json
{
  "success": true,
  "message": "Subscription upgrade initiated",
  "data": {
    "paymentSession": {
      "id": "session_placeholder",
      "url": "https://stripe.com/checkout/session_placeholder",
      "plan": "PRO",
      "amount": 999,
      "currency": "USD"
    }
  }
}
```

**Simulation Mode:**
Add `?simulate=true` to skip payment and directly upgrade:
```bash
POST /subscription/upgrade?simulate=true
```

---

## Token Economy

### Token Costs
| Feature | Cost | Notes |
|---------|------|-------|
| AI Chat | 3 tokens | FREE for ULTRA users |
| Generate Extra Quest | 5 tokens | Always costs tokens |

### Daily Token Refill (00:00 UTC)
| Plan | Daily Tokens |
|------|--------------|
| FREE | 50 |
| PRO | 200 |
| ULTRA | 999999 (unlimited) |

---

## Cron Jobs

### 1. Daily Quest Generation (`00:05 UTC`)
- **File:** `src/jobs/dailyQuestGeneration.ts`
- **Schedule:** `5 0 * * *` (5 minutes after midnight UTC)
- **Logic:**
  1. Find all `UserSkill` records without a quest for today
  2. For each, generate one AI-powered daily quest
  3. Use skill name, user level, and status for personalization
  4. Mark quest with `source: DAILY`

### 2. Daily Token Refill (`00:00 UTC`)
- **File:** `src/jobs/dailyTokenRefill.ts`
- **Schedule:** `0 0 * * *` (midnight UTC)
- **Logic:**
  1. Fetch all users with their subscription plan
  2. Refill tokens based on plan (FREE: 50, PRO: 200, ULTRA: 999999)
  3. **Note:** Tokens are SET, not incremented (resets daily)

**Start Cron Jobs:**
```typescript
import { startJobs } from './jobs';

// In your main app initialization
startJobs();
```

---

## Upsell Triggers

The system creates `UpsellTrigger` records when:

| Type | Condition | Created In |
|------|-----------|------------|
| `INSUFFICIENT_TOKENS` | User tries AI feature without enough tokens | `aiController.chat`, `questController.generateExtraQuest` |
| `ULTRA_AI_USAGE` | ULTRA user uses AI chat (tracking) | `aiController.chat` |
| `STREAK_MILESTONE` | User achieves 3, 7, or 21-day streak | `questController.completeQuest` |

**Dashboard Upsell Logic** (`feedController.getDashboard`):
- Shows upgrade prompt if:
  - User has < 10 tokens
  - User achieved a streak milestone today
  - User has > 5 AI chat triggers in the last 7 days

---

## Migration & Seed Instructions

### 1. Run Migration
```bash
pnpm prisma migrate dev --name add_levelup_features
```

### 2. Generate Prisma Client
```bash
pnpm prisma generate
```

### 3. Seed Database
```bash
pnpm run db:seed
```

**Seeds:**
- **Skills:** Coding, Fitness, Productivity, Public Speaking, Creative Writing, Design
- **Milestones:** First Streak, Week Warrior, Level 3 Achieved, Level 5 Master, Quest Completion Champion, Skill Collector

---

## Testing Plan

### 1. Unit Tests

#### XP Helper Tests (`src/__tests__/xpHelper.test.ts`)
```typescript
describe('XP Helper', () => {
  test('getXpForLevel calculates 50 * level^2', () => {
    expect(getXpForLevel(1)).toBe(50);
    expect(getXpForLevel(2)).toBe(200);
    expect(getXpForLevel(3)).toBe(450);
  });

  test('applyXpAndMaybeLevelUp levels up correctly', () => {
    const result = applyXpAndMaybeLevelUp(40, 1, 20);
    expect(result.newXp).toBe(60);
    expect(result.newLevel).toBe(2);
    expect(result.leveledUp).toBe(true);
  });
});
```

#### Token Helper Tests (`src/__tests__/tokenHelper.test.ts`)
```typescript
describe('Token Helper', () => {
  test('deductTokens reduces user tokens', async () => {
    await deductTokens(userId, 5, 'AI_CHAT');
    const user = await prisma.user.findUnique({ where: { id: userId } });
    expect(user.tokens).toBe(45); // from 50
  });

  test('hasEnoughTokens returns false when insufficient', async () => {
    const result = await hasEnoughTokens(userId, 100);
    expect(result).toBe(false);
  });
});
```

### 2. Integration Tests

#### Quest Generation Test
```bash
# Manually trigger cron (or use `node-cron` test helpers)
curl -X POST http://localhost:3000/quest/generate \
  -H "Authorization: Bearer <token>" \
  -d '{"userSkillId": "skill_id", "count": 1}'
```

#### Token Deduction Test
```bash
# Test AI chat endpoint
curl -X POST http://localhost:3000/ai/chat \
  -H "Authorization: Bearer <token>" \
  -d '{"prompt": "How can I learn faster?"}'

# Verify tokens decreased by 3
curl http://localhost:3000/subscription/my-tokens \
  -H "Authorization: Bearer <token>"
```

### 3. End-to-End Testing Workflow

1. **Onboarding:**
   - POST `/skills/select` with 3 skills
   - Verify `UserSkill` records created

2. **Daily Quest Generation:**
   - Run cron job or wait until 00:05 UTC
   - GET `/quest/my` to verify daily quests exist

3. **Quest Completion:**
   - POST `/quest/complete` for a quest
   - Verify XP gained = 50 × level²
   - Check if level increased
   - Verify streak incremented

4. **Token Usage:**
   - POST `/ai/chat` (costs 3 tokens)
   - POST `/quest/generate-extra` (costs 5 tokens)
   - Verify tokens deducted correctly

5. **Subscription Upgrade:**
   - POST `/subscription/upgrade` with `plan: PRO`
   - Verify payment session returned
   - Simulate payment with `?simulate=true`
   - Verify tokens refilled to 200 next day

6. **Dashboard Feed:**
   - GET `/feed/dashboard`
   - Verify all data aggregated correctly
   - Check upsell logic triggers

---

## Verification Plan

### Database Checks
```sql
-- Verify skills seeded
SELECT * FROM "Skill";

-- Verify user has selected skills
SELECT * FROM "UserSkill" WHERE "userId" = '<user_id>';

-- Verify quests generated for today
SELECT * FROM "Quest" WHERE "userSkillId" IN (
  SELECT id FROM "UserSkill" WHERE "userId" = '<user_id>'
) AND DATE("createdAt") = CURRENT_DATE;

-- Verify subscription created
SELECT * FROM "Subscription" WHERE "userId" = '<user_id>';

-- Verify daily streak
SELECT * FROM "DailyStreak" WHERE "userId" = '<user_id>';

-- Verify upsell triggers
SELECT * FROM "UpsellTrigger" WHERE "userId" = '<user_id>' ORDER BY "createdAt" DESC;
```

### API Health Checks
```bash
# Check all endpoints respond
curl http://localhost:3000/skills
curl http://localhost:3000/quest/my -H "Authorization: Bearer <token>"
curl http://localhost:3000/feed/dashboard -H "Authorization: Bearer <token>"
curl http://localhost:3000/subscription/my -H "Authorization: Bearer <token>"
```

### Cron Job Verification
```bash
# Check cron jobs are running
# Add logs to each cron job and verify console output

# Manually test quest generation logic
curl -X POST http://localhost:3000/quest/generate-extra \
  -H "Authorization: Bearer <token>" \
  -d '{"userSkillId": "<userskill_id>"}'

# Verify token refill (check after 00:00 UTC)
```

---

## File Structure

```
src/
├── controllers/
│   ├── aiController.ts          # AI chat endpoint
│   ├── feedController.ts        # Dashboard feed
│   ├── skillController.ts       # Skill selection
│   ├── questController.ts       # Quest generation & completion
│   └── subscriptionController.ts # Subscription management
├── helpers/
│   ├── xpHelper.ts              # XP calculation (50*level^2)
│   ├── tokenHelper.ts           # Token management
│   └── ai/
│       ├── aiHelper.ts          # OpenAI integration
│       └── prompts.ts           # AI prompt templates
├── jobs/
│   ├── index.ts                 # Job scheduler
│   ├── dailyQuestGeneration.ts  # Daily quest cron
│   └── dailyTokenRefill.ts      # Token refill cron
├── validations/
│   ├── aiValidation.ts          # AI endpoint validation
│   ├── skillValidation.ts       # Skill endpoint validation
│   ├── questValidation.ts       # Quest endpoint validation
│   └── subscriptionValidation.ts # Subscription validation
└── routes/
    ├── aiRoutes.ts              # AI endpoints
    ├── feedRoutes.ts            # Feed endpoints
    ├── skillRoutes.ts           # Skill endpoints
    ├── questRoutes.ts           # Quest endpoints
    └── subscriptionRoutes.ts    # Subscription endpoints

prisma/
├── schema.prisma                # Database schema
└── seed.ts                      # Seed script

docs/
└── levelup-feature.md           # This document
```

---

## Implementation Checklist

- [x] Database schema updated (Skill, UserSkill, Subscription, DailyStreak, Milestone, UserMilestone, UpsellTrigger)
- [x] XP helper with 50*level² formula
- [x] Token helper with deduction/addition logic
- [x] AI controller with token protection
- [x] Feed controller with dashboard aggregation
- [x] Skill controller with onboarding
- [x] Quest controller with extra quest generation
- [x] Subscription controller with upgrade placeholder
- [x] Validation schemas (Joi)
- [x] AI prompt templates
- [x] Daily quest generation cron job
- [x] Daily token refill cron job
- [x] Seed file with skills and milestones
- [x] Documentation (this file)
- [ ] Unit tests (XP helper, token helper)
- [ ] Integration tests (API endpoints)
- [ ] E2E testing workflow
- [ ] Production deployment

---

## Future Enhancements

1. **Payment Integration:**
   - Integrate Stripe or Razorpay for real subscription payments
   - Add webhook handlers for payment success/failure
   - Implement subscription renewal logic

2. **Advanced Features:**
   - Leaderboards per skill
   - Social features (share streaks, challenge friends)
   - Skill recommendations based on completed skills
   - Quest difficulty customization
   - AI-powered progress insights

3. **Analytics:**
   - Track conversion rates from upsell triggers
   - Monitor token usage patterns
   - Analyze quest completion rates by skill/level

4. **Performance:**
   - Cache dashboard feed data (Redis)
   - Optimize quest generation with batch processing
   - Add rate limiting to AI endpoints

---

## Support & Troubleshooting

### Common Issues

**Issue:** TypeScript errors after Prisma schema changes
**Solution:**
```bash
pnpm prisma generate
# Restart TypeScript server in VS Code
```

**Issue:** Cron jobs not running
**Solution:**
```typescript
// Verify startJobs() is called in index.ts
import { startJobs } from './jobs';
startJobs();
```

**Issue:** Tokens not refilling
**Solution:**
- Check cron schedule is correct (`0 0 * * *`)
- Verify server is running at 00:00 UTC
- Check subscription plan is set correctly

**Issue:** Quest generation fails
**Solution:**
- Verify OpenAI API key is set in `.env`
- Check AI response format (must be valid JSON)
- Review prompt templates in `src/helpers/ai/prompts.ts`

---

## License

This feature is part of the LevelUp backend project. All rights reserved.
