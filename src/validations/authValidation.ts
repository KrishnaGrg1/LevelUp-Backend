import Joi from 'joi';

const authValidation = {
  register: {
    body: Joi.object().keys({
      username: Joi.string().min(2).max(150).required().messages({
        'string.empty': 'Username is required',
        'string.min': 'Username must contain altleast 2 characters long',
        'string.max': 'Username mustnot exceed 150 characters long',
      }),
      email: Joi.string().email().required().messages({
        'string.empty': 'Username is required',
        'string.email': 'Username must be valid email address',
      }),
      password: Joi.string().min(8).max(50).required().messages({
        'string.empty': 'Password is required',
        'string.min': 'Passsword must be at least 8 character',
        'string.max': 'Password must not exceed 50 characters',
      }),
    }),
  },
  login: {
    body: Joi.object().keys({
      email: Joi.string().email().required().messages({
        'string.empty': 'Username is required',
        'string.email': 'Username must be valid email address',
      }),
      password: Joi.string().min(8).max(50).required().messages({
        'string.base': 'Password must be string',
        'string.empty': 'Password is required',
        'string.min': 'Password must be atleast 8 characters long',
        'string.max': 'Password mustnot exceed 50 characters long',
        'any.required': 'Password is required',
      }),
    }),
  },
  forget_password: {
    body: Joi.object().keys({
      email: Joi.string().email().required().messages({
        'string.empty': 'Username is required',
        'string.email': 'Username must be valid email address',
      }),
    }),
  },
  reset_password: {
    body: Joi.object().keys({
      userId: Joi.number().required().messages({
        'number.base': 'User ID must be a number',
        'any.required': 'User ID is required',
      }),
      newPassword: Joi.string().min(8).max(50).required().messages({
        'string.empty': 'Password is required',
        'string.min': 'Passsword must be at least 8 character',
        'string.max': 'Password must not exceed 50 characters',
      }),
      otp: Joi.number().min(100000).max(999999).required().messages({
        'number.base': 'OTP must be a number',
        'number.empty': 'OTP is required',
        'number.min': 'OTP must be a 6-digit number',
        'number.max': 'OTP must be a 6-digit number',
      }),
    }),
  },
};

export default authValidation;
