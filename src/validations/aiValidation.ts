import Joi from 'joi';

const aiValidation = {
  chat: {
    body: Joi.object().keys({
      prompt: Joi.string().min(1).max(2000).required().messages({
        'string.empty': 'prompt is required',
        'string.min': 'prompt cannot be empty',
        'string.max': 'prompt cannot exceed 2000 characters',
        'any.required': 'prompt is required',
      }),
    }),
  },
};

export default aiValidation;
