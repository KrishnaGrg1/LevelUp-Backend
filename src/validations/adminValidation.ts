import Joi from 'joi';

const adminValidation = {
  updateDetails: {
    body: Joi.object().keys({
      username: Joi.string().min(2).max(150).required().messages({
        'string.empty': 'Username is required',
        'string.min': 'Username must contain altleast 2 characters long',
        'string.max': 'Username mustnot exceed 150 characters long',
      }),
    }),
  },

  deleteUser: {
    body: Joi.object().keys({
      id: Joi.string().min(2).max(150).required().messages({
        'string.empty': 'User ID is required',
        'string.min': 'User ID must contain at least 2 characters long',
        'string.max': 'User ID must not exceed 150 characters long',
      }),
    }),
  },
  updateTicket: {
    body: Joi.object().keys({
      status: Joi.string()
        .valid(
          'PENDING',
          'WORKING_ON',
          'TO_BE_DONE_LATER',
          'APPROVED',
          'REJECTED',
          'CANCELLED'
        )
        .required()
        .messages({
          'string.empty': 'Status is required',
          'any.only':
            'Status must be one of: OPEN, IN_PROGRESS, RESOLVED, CLOSED',
        }),
      priority: Joi.string()
        .valid('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')
        .optional()
        .messages({
          'string.empty': 'Priority is required',
          'any.only': 'Priority must be one of: LOW, MEDIUM, HIGH, CRITICAL',
        }),
      expectedDateOfCompletion: Joi.date().greater('now').required().messages({
        'any.required': 'Expected date of completion is required',
        'date.base': 'Expected date of completion must be a valid date',
        'date.greater': 'Expected date of completion must be in the future',
      }),
    }),
  },
};

export default adminValidation;
