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
};

export default adminValidation;
