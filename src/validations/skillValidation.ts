import Joi from 'joi';

const skillValidation = {
  createSkill: {
    body: Joi.object({
      name: Joi.string().min(2).max(100).required().messages({
        'string.empty': 'Skill name is required',
        'string.min': 'Skill name must be at least 2 characters',
        'string.max': 'Skill name must not exceed 100 characters',
      }),
      slug: Joi.string().min(2).max(100).optional().messages({
        'string.min': 'Slug must be at least 2 characters',
        'string.max': 'Slug must not exceed 100 characters',
      }),
      description: Joi.string().max(500).optional().messages({
        'string.max': 'Description must not exceed 500 characters',
      }),
      icon: Joi.string().optional().messages({
        'string.base': 'Icon must be a string',
      }),
      isPremium: Joi.boolean().optional().messages({
        'boolean.base': 'isPremium must be a boolean',
      }),
    }),
  },
  updateSkill: {
    body: Joi.object({
      name: Joi.string().min(2).max(100).optional().messages({
        'string.min': 'Skill name must be at least 2 characters',
        'string.max': 'Skill name must not exceed 100 characters',
      }),
      slug: Joi.string().min(2).max(100).optional().messages({
        'string.min': 'Slug must be at least 2 characters',
        'string.max': 'Slug must not exceed 100 characters',
      }),
      description: Joi.string().max(500).optional().messages({
        'string.max': 'Description must not exceed 500 characters',
      }),
      icon: Joi.string().optional().messages({
        'string.base': 'Icon must be a string',
      }),
      isPremium: Joi.boolean().optional().messages({
        'boolean.base': 'isPremium must be a boolean',
      }),
    }),
  },
  enrollSkill: {
    body: Joi.object({
      skillId: Joi.string().required().messages({
        'string.empty': 'Skill ID is required',
        'any.required': 'Skill ID is required',
      }),
    }),
  },
  selectSkills: {
    body: Joi.object({
      skillIds: Joi.array()
        .items(Joi.string().required())
        .min(1)
        .required()
        .messages({
          'array.base': 'skillIds must be an array',
          'array.min': 'At least one skill must be selected',
          'any.required': 'skillIds is required',
        }),
      initialStatus: Joi.string()
        .valid('Beginner', 'Intermediate', 'Advanced')
        .optional()
        .messages({
          'any.only':
            'initialStatus must be one of: Beginner, Intermediate, Advanced',
        }),
    }),
  },
};

export default skillValidation;
