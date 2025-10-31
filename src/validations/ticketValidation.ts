import Joi from 'joi';

enum TicketPriority {
  'LOW',
  'MEDIUM',
  'HIGH',
  'CRITICAL',
}

const ticketValidation = {
  createTicket: {
    body: Joi.object({
      subject: Joi.string()
        .valid(
          'ACCOUNT_ISSUE',
          'PAYMENT_ISSUE',
          'BUG_REPORT',
          'FEATURE_REQUEST',
          'PERFORMANCE_ISSUE',
          'COMMUNITY_MANAGEMENT',
          'CLAN_MANAGEMENT',
          'QUEST_MANAGEMENT',
          'OTHER'
        )
        .required()
        .messages({
          'string.empty': 'Subject is required',
          'any.only':
            'Subject must be one of: ACCOUNT_ISSUE, PAYMENT_ISSUE, BUG_REPORT, FEATURE_REQUEST, PERFORMANCE_ISSUE, COMMUNITY_MANAGEMENT, CLAN_MANAGEMENT, QUEST_MANAGEMENT, OTHER',
        }),
      message: Joi.string().min(10).max(1000).required().messages({
        'string.empty': 'Message is required',
        'string.min': 'Message must contain at least 10 characters',
        'string.max': 'Message must not exceed 1000 characters',
      }),
      priority: Joi.string()
        .valid('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')
        .optional()
        .messages({
          'any.only': 'Priority must be one of: LOW, MEDIUM, HIGH, CRITICAL',
        }),
    }),
  },
  updateTicket: {
    body: Joi.object({
      subject: Joi.string()
        .valid(
          'ACCOUNT_ISSUE',
          'PAYMENT_ISSUE',
          'BUG_REPORT',
          'FEATURE_REQUEST',
          'PERFORMANCE_ISSUE',
          'COMMUNITY_MANAGEMENT',
          'CLAN_MANAGEMENT',
          'QUEST_MANAGEMENT',
          'OTHER'
        )
        .required()
        .messages({
          'string.empty': 'Subject is required',
          'any.only':
            'Subject must be one of: ACCOUNT_ISSUE, PAYMENT_ISSUE, BUG_REPORT, FEATURE_REQUEST, PERFORMANCE_ISSUE, COMMUNITY_MANAGEMENT, CLAN_MANAGEMENT, QUEST_MANAGEMENT, OTHER',
        }),
      message: Joi.string().min(10).max(1000).required().messages({
        'string.empty': 'Message is required',
        'string.min': 'Message must contain at least 10 characters',
        'string.max': 'Message must not exceed 1000 characters',
      }),
      priority: Joi.string()
        .valid('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')
        .optional()
        .messages({
          'any.only': 'Priority must be one of: LOW, MEDIUM, HIGH, CRITICAL',
        }),
    }),
  },
};

export default ticketValidation;
